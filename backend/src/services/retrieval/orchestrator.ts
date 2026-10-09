/**
 * Retrieval orchestrator: the single-node counterpart of the application's orchestration server.
 *
 * For every similar-case query it runs the two-stage search, obtains a latency prediction for the
 * homomorphic path from runtime telemetry (ciphertext count, queue depth, CPU utilisation), lets the
 * arbiter choose and guard the execution mode, executes in that mode, records the outcome for the
 * predictor and the window guard, and returns de-identified results with the decision attached so
 * that every screen can show exactly what happened.
 */
import os from 'os';
import crypto from 'crypto';
import { ArbiterConfig, ModeArbiter } from './arbiter';
import { LatencyPredictor } from './latencyPredictor';
import { CANDIDATES_PER_CIPHERTEXT, HeEngine } from './heEngine';
import { ISOLATION_LABEL, IsolatedEvaluator } from './isolatedEvaluator';
import { CaseIndex } from './index';
import { buildQueryFromSession, corpusSignature, loadAllCases, tierForDepartment } from './caseStore';
import { CaseQuery, CaseRecord, RetrievalResponse, SimilarCase } from './types';

class CpuSampler {
  private last = process.cpuUsage();
  private lastT = process.hrtime.bigint();
  private ewma = 0;
  sample(): number {
    const now = process.cpuUsage();
    const t = process.hrtime.bigint();
    const wallUs = Number(t - this.lastT) / 1000;
    const cpuUs = (now.user - this.last.user) + (now.system - this.last.system);
    if (wallUs > 1000) {
      this.last = now; this.lastT = t;
      const u = Math.min(1, cpuUs / (wallUs * Math.max(1, os.cpus().length)));
      this.ewma = this.ewma === 0 ? u : 0.7 * this.ewma + 0.3 * u;
    }
    return this.ewma;
  }
}

const envNum = (name: string, fallback: number): number => {
  const v = Number(process.env[name]); return Number.isFinite(v) && process.env[name] !== undefined ? v : fallback;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const round = (v: number) => Math.round(v * 100) / 100;
const displayId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 12);

export class RetrievalError extends Error {
  constructor(public readonly code: 'SESSION_NOT_FOUND' | 'QUERY_REQUIRED' | 'EMPTY_CORPUS') { super(code); }
}

export interface OrchestratorOptions { arbiter?: Partial<ArbiterConfig>; coarseK?: number }

export class RetrievalOrchestrator {
  readonly he = new HeEngine();
  readonly isolated = new IsolatedEvaluator();
  readonly predictor = new LatencyPredictor();
  readonly arbiter: ModeArbiter;
  readonly coarseK: number;
  private index: CaseIndex | null = null;
  private indexSig = '';
  private indexMeta = { facility: 0, reference: 0 };
  private inflight = 0;
  private readonly cpu = new CpuSampler();
  private ready: Promise<boolean> | null = null;

  constructor(opts: OrchestratorOptions = {}) {
    this.arbiter = new ModeArbiter({
      thresholdMs: envNum('RETRIEVAL_THRESHOLD_MS', 250),
      windowW: envNum('RETRIEVAL_WINDOW_W', 100),
      maxEnclaveRatio: envNum('RETRIEVAL_MAX_ENCLAVE_RATIO', 0.8),
      secureMemoryCeiling: envNum('RETRIEVAL_SECURE_MEMORY_CEILING', 0.85),
      ...opts.arbiter
    });
    this.coarseK = opts.coarseK ?? 48;
  }

  /** Loads the homomorphic engine once (key generation takes about a second). */
  init(): Promise<boolean> { if (!this.ready) this.ready = this.he.init(); return this.ready; }

  /** Rebuilds the index when the facility data changed. */
  ensureIndex(force = false): CaseIndex {
    if (this.indexSig === 'manual' && this.index && !force) return this.index;
    const sig = corpusSignature();
    if (!this.index || force || sig !== this.indexSig) {
      const { cases, facility, reference } = loadAllCases();
      this.index = CaseIndex.build(cases);
      this.indexSig = sig;
      this.indexMeta = { facility, reference };
    }
    return this.index;
  }

  /** Index over supplied records instead of the database (tests, offline evaluation). */
  useRecords(records: CaseRecord[]): void {
    this.index = CaseIndex.build(records);
    this.indexSig = 'manual';
    this.indexMeta = { facility: records.length, reference: 0 };
  }

  async similar(opts: { sessionId?: string; query?: CaseQuery; topN?: number; k?: number; excludeIds?: string[] }): Promise<RetrievalResponse> {
    await this.init();
    const t0 = performance.now();
    const index = this.ensureIndex();
    if (index.size() === 0) throw new RetrievalError('EMPTY_CORPUS');

    const exclude = new Set<string>(opts.excludeIds || []);
    let query: CaseQuery;
    if (opts.sessionId) {
      const built = buildQueryFromSession(opts.sessionId);
      if (!built) throw new RetrievalError('SESSION_NOT_FOUND');
      query = built.query;
      built.excludeIds.forEach(id => exclude.add(id));
    } else if (opts.query) {
      query = opts.query;
    } else {
      throw new RetrievalError('QUERY_REQUIRED');
    }
    const tier = query.tier ?? tierForDepartment(query.department);
    const topN = clamp(opts.topN ?? 8, 1, 25);
    const k = clamp(opts.k ?? this.coarseK, topN, 256);

    // Stage 1: coarse search over the compressed copy.
    const qv = index.embedQuery(query);
    const tCoarse = performance.now();
    const coarse = index.coarse(qv, k, exclude);
    const coarseMs = performance.now() - tCoarse;
    const idxs = coarse.map(c => c.idx);
    const matrix = index.candidateMatrix(idxs);

    // Telemetry, prediction, arbitration.
    const ciphertexts = Math.ceil(idxs.length / CANDIDATES_PER_CIPHERTEXT);
    const features = { ciphertexts, queueDepth: this.inflight, cpuUtil: this.cpu.sample() };
    const decision = this.arbiter.decide({
      predictedHeMs: this.predictor.predict(features),
      predictorReleased: this.predictor.released(),
      tier,
      secureMemoryUtilAfter: this.isolated.utilisation(this.isolated.footprintBytes(idxs.length)),
      heAvailable: this.he.available(),
      isolatedAvailable: this.isolated.available()
    });

    // Stage 2: full-precision re-ranking in the chosen mode.
    this.inflight++;
    let scores: number[] = [];
    let usedCiphertexts = 0;
    let refreshes = 0;
    let sigma: number | null = null;
    const tRerank = performance.now();
    try {
      if (decision.mode === 'HE') {
        const eq = this.he.encryptQuery(qv);
        try {
          const r = this.he.evaluate(eq, matrix);
          scores = r.scores; usedCiphertexts = r.ciphertexts; refreshes = r.refreshes;
        } finally { this.he.release(eq); }
        this.predictor.observe(features, performance.now() - tRerank);
      } else {
        const r = await this.isolated.evaluate(qv, matrix);
        scores = r.scores; sigma = r.sigma;
      }
    } finally {
      this.inflight--;
    }
    const rerankMs = performance.now() - tRerank;
    this.arbiter.record(decision.mode);
    decision.windowEnclaveShare = this.arbiter.windowEnclaveShare();

    const ranked = idxs.map((idx, i) => ({ idx, score: scores[i] })).sort((a, b) => b.score - a.score).slice(0, topN);
    const results: SimilarCase[] = ranked.map(r => {
      const rec = index.records[r.idx];
      return {
        caseId: rec.source === 'reference' ? rec.id : displayId(rec.id), source: rec.source, department: rec.department, careStream: rec.careStream,
        ageBand: rec.ageBand, sex: rec.sex, symptoms: rec.symptoms, diagnoses: rec.diagnoses, medicines: rec.medicines,
        investigations: rec.investigations, month: rec.month, similarity: Math.max(-1, Math.min(1, r.score))
      };
    });

    return {
      results,
      decision,
      stages: { corpusSize: index.size(), coarseCandidates: idxs.length, coarseMs: round(coarseMs), rerankMs: round(rerankMs), ciphertexts: usedCiphertexts, refreshes, smudgingSigma: sigma, totalMs: round(performance.now() - t0) },
      privacy: {
        queryProtection: decision.mode === 'HE'
          ? 'query encrypted with CKKS; similarity evaluated without decrypting it on the peer'
          : 'query in plaintext inside the isolated worker; scores smudged with calibrated noise before leaving it',
        isolation: decision.mode === 'HE' ? 'homomorphic evaluation (Microsoft SEAL, CKKS)' : ISOLATION_LABEL,
        resultsDeidentified: true
      }
    };
  }

  status() {
    const index = this.index;
    return {
      embodiment: 'single peer node; fixed threshold (basic embodiment); no hardware enclave; see docs/RETRIEVAL_LAYER.md',
      corpus: { indexed: index ? index.size() : 0, facilityCases: this.indexMeta.facility, referenceCases: this.indexMeta.reference, builtAt: index ? index.builtAt : null },
      homomorphic: { available: this.he.available(), error: this.he.lastError, parameters: this.he.available() ? this.he.parameters() : null, counters: this.he.counters, lastTimingsMs: this.he.timings },
      isolated: { label: ISOLATION_LABEL, secureMemoryUtilisation: round(this.isolated.utilisation()), quotaBytes: this.isolated.cfg.secureMemoryQuotaBytes, smudgingSigma: this.isolated.cfg.smudgingSigma, counters: this.isolated.counters },
      predictor: this.predictor.state(),
      arbiter: { config: this.arbiter.cfg, counters: this.arbiter.counters, windowEnclaveShare: round(this.arbiter.windowEnclaveShare()), windowLength: this.arbiter.windowLength() },
      inflight: this.inflight
    };
  }
}

export const retrievalOrchestrator = new RetrievalOrchestrator();
