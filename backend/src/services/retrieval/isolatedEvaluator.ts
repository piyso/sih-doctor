/**
 * Isolated-mode evaluator: the stand-in for the hardware enclave of the application.
 *
 * On a host with Intel SGX/TDX or ARM CCA this would be an attested enclave that decrypts the query
 * inside its memory and never exposes plaintext scores. This host has none, so the evaluator is a
 * separate worker thread with its own heap. Two properties of the real thing are kept exactly:
 *   - calibrated Gaussian noise is added to every score before it leaves the worker (claim 21(c));
 *   - a bounded "secure-memory" budget is accounted for prospectively, so the arbiter's secure-memory
 *     guard (claim 9) has something real to bound.
 * The label below is returned to callers so that no screen can call this a TEE.
 */
import { Worker } from 'worker_threads';
import { CASE_DIM } from './embedding';

export const ISOLATION_LABEL = 'software-isolated worker thread (no hardware enclave on this host)';
export const DEFAULT_SMUDGING_SIGMA = Math.pow(2, -9); // the application's operating point (Section 4.7.3.1)

const WORKER_SOURCE = `
const { parentPort } = require('worker_threads');
const crypto = require('crypto');
function gauss() {
  const b = crypto.randomBytes(8);
  const u1 = (b.readUInt32LE(0) + 1) / 4294967297;
  const u2 = b.readUInt32LE(4) / 4294967296;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
parentPort.on('message', (m) => {
  const { id, dim, query, cands, sigma } = m;
  const q = new Float32Array(query);
  const c = new Float32Array(cands);
  const n = Math.floor(c.length / dim);
  const scores = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const off = i * dim;
    for (let j = 0; j < dim; j++) s += q[j] * c[off + j];
    scores[i] = s + (sigma > 0 ? sigma * gauss() : 0);
  }
  parentPort.postMessage({ id, scores });
});
`;

export interface IsolatedConfig {
  /** Stand-in for the enclave page cache available to this evaluator, in bytes. */
  secureMemoryQuotaBytes: number;
  /** Resident footprint of the evaluator itself (code, keys, workspace reserve). */
  baseFootprintBytes: number;
  smudgingSigma: number;
}

export const DEFAULT_ISOLATED_CONFIG: IsolatedConfig = {
  secureMemoryQuotaBytes: 16 * 1024 * 1024,
  baseFootprintBytes: 2 * 1024 * 1024,
  smudgingSigma: DEFAULT_SMUDGING_SIGMA
};

export class IsolatedEvaluator {
  readonly cfg: IsolatedConfig;
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (s: number[]) => void; reject: (e: Error) => void }>();
  private inflightBytes = 0;
  /** Extra committed bytes a test or the orchestrator can pin (e.g. an enclave-resident cache). */
  pinnedBytes = 0;
  readonly counters = { evaluations: 0, candidates: 0 };

  constructor(cfg: Partial<IsolatedConfig> = {}) { this.cfg = { ...DEFAULT_ISOLATED_CONFIG, ...cfg }; }

  available(): boolean { return true; }

  /** Workspace an operation over `k` candidates needs inside the isolated region. */
  footprintBytes(k: number): number { return (k + 1) * CASE_DIM * 4 + k * 8; }

  utilisation(extraBytes = 0): number {
    return (this.cfg.baseFootprintBytes + this.pinnedBytes + this.inflightBytes + extraBytes) / this.cfg.secureMemoryQuotaBytes;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(WORKER_SOURCE, { eval: true });
    w.on('message', (m: { id: number; scores: number[] }) => {
      const p = this.pending.get(m.id);
      if (p) { this.pending.delete(m.id); p.resolve(m.scores); }
    });
    w.on('error', (e) => { for (const p of this.pending.values()) p.reject(e); this.pending.clear(); this.worker = null; });
    w.on('exit', () => { this.worker = null; });
    w.unref();
    this.worker = w;
    return w;
  }

  /** Scores of `query` against `candidates` (row-major, CASE_DIM each), smudged inside the worker. */
  async evaluate(query: Float32Array, candidates: Float32Array, sigma: number = this.cfg.smudgingSigma): Promise<{ scores: number[]; sigma: number }> {
    const k = Math.floor(candidates.length / CASE_DIM);
    const bytes = this.footprintBytes(k);
    this.inflightBytes += bytes;
    try {
      const w = this.ensureWorker();
      const id = ++this.seq;
      w.ref(); // keep the event loop alive while a result is outstanding
      let scores: number[];
      try {
        scores = await new Promise<number[]>((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          w.postMessage({ id, dim: CASE_DIM, query: Float32Array.from(query).buffer, cands: Float32Array.from(candidates).buffer, sigma });
        });
      } finally {
        if (this.pending.size === 0) w.unref();
      }
      this.counters.evaluations++; this.counters.candidates += k;
      return { scores, sigma };
    } finally {
      this.inflightBytes -= bytes;
    }
  }

  async close(): Promise<void> { if (this.worker) { await this.worker.terminate(); this.worker = null; } }
}
