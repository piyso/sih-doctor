/**
 * Encrypted similar-case retrieval battery: the guarded arbitration, the CKKS path, the isolated path,
 * the two-stage index and the end-to-end orchestrator.
 *
 *   npx tsx tests/retrieval_layer.test.ts
 */
import './env';
import { ModeArbiter } from '../src/services/retrieval/arbiter';
import { LatencyPredictor } from '../src/services/retrieval/latencyPredictor';
import { CANDIDATES_PER_CIPHERTEXT, HeEngine, NOISE_FLOOR } from '../src/services/retrieval/heEngine';
import { IsolatedEvaluator } from '../src/services/retrieval/isolatedEvaluator';
import { CaseIndex } from '../src/services/retrieval/index';
import { buildReferenceShard } from '../src/services/retrieval/referenceCases';
import { CASE_DIM, caseTokens, dot, embed } from '../src/services/retrieval/embedding';
import { RetrievalOrchestrator } from '../src/services/retrieval/orchestrator';
import { wordKey } from '../src/services/clinicalLexicon';
import { ExecMode } from '../src/services/retrieval/types';

function unit(seed: number): Float32Array {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5; };
  const v = new Float32Array(CASE_DIM); let n = 0;
  for (let i = 0; i < CASE_DIM; i++) { v[i] = r(); n += v[i] * v[i]; }
  n = Math.sqrt(n); for (let i = 0; i < CASE_DIM; i++) v[i] /= n;
  return v;
}

export async function runRetrievalBattery() {
  const t0 = performance.now();
  let passed = 0; let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };
  console.log('\n========================================================================');
  console.log('  ENCRYPTED SIMILAR-CASE RETRIEVAL: GUARDED ARBITRATION, CKKS, TWO-STAGE INDEX');
  console.log('========================================================================');

  console.log('\n--- Embedding ---');
  const a = embed(caseTokens({ symptoms: ['Fever', 'Cough'], ageBand: '19-40' }), null);
  const b = embed(caseTokens({ symptoms: ['fever ', 'COUGH'], ageBand: '19-40' }), null);
  check(Math.abs(dot(a, a) - 1) < 1e-5 && dot(a, b) > 0.999, 'embedding is unit-norm and case/space insensitive');
  const hi = embed(caseTokens({ symptoms: ['बुखार'] }), null), rom = embed(caseTokens({ symptoms: ['bukhar'] }), null);
  const sameKey = wordKey('बुखार') === wordKey('bukhar');
  check(!sameKey || dot(hi, rom) > 0.999, `Devanagari and romanised spellings share a feature when the phonetic key agrees (keys equal: ${sameKey}, cosine ${dot(hi, rom).toFixed(3)})`);
  check(dot(a, embed(caseTokens({ symptoms: ['Knee pain', 'Morning stiffness'], ageBand: '61+' }), null)) < 0.3, 'unrelated presentations are far apart');

  console.log('\n--- Two-stage index over the reference shard ---');
  const shard = buildReferenceShard(400);
  const index = CaseIndex.build(shard);
  check(index.size() === 400 && shard.every(r => r.source === 'reference'), '400 reference cases indexed, all labelled reference');
  let recallSum = 0; const trials = 40;
  for (let t = 0; t < trials; t++) {
    const rec = shard[(t * 37) % shard.length];
    const q = { ...rec, symptoms: rec.symptoms.slice(0, Math.max(1, rec.symptoms.length - 1)) };
    const qv = index.embedQuery(q);
    const exact = index.records.map((_, i) => ({ i, s: dot(qv, index.vectors[i]) })).sort((x, y) => y.s - x.s).slice(0, 10).map(x => x.i);
    const coarse = new Set(index.coarse(qv, 48).map(c => c.idx));
    recallSum += exact.filter(i => coarse.has(i)).length / 10;
  }
  const recall = recallSum / trials;
  check(recall >= 0.9, `coarse stage (int8, k=48) keeps ${(recall * 100).toFixed(1)}% of the exact top-10`);
  const qTop = index.coarse(index.embedQuery({ symptoms: ['Knee pain', 'Morning stiffness', 'Joint crepitus'], ageBand: '61+' }), 5);
  check(qTop.length === 5 && /Sandhivata/.test(index.records[qTop[0].idx].diagnoses[0]), 'knee stiffness query ranks Sandhivata first');

  console.log('\n--- Mode arbiter: guards hold under an adversarial controller ---');
  const arb = new ModeArbiter({ windowW: 10, maxEnclaveRatio: 0.8, secureMemoryCeiling: 0.85, thresholdMs: 100, defaultMode: 'HE' });
  const history: ExecMode[] = []; let candidateIsolated = 0; let ratioTrips = 0;
  for (let i = 0; i < 200; i++) {
    const d = arb.decide({ predictedHeMs: 10_000, predictorReleased: true, tier: 2, secureMemoryUtilAfter: 0.3, heAvailable: true, isolatedAvailable: true });
    if (d.candidateMode === 'ISOLATED') candidateIsolated++;
    if (d.guards.enclaveRatio) ratioTrips++;
    arb.record(d.mode); history.push(d.mode);
  }
  let maxShare = 0;
  for (let i = 0; i + 10 <= history.length; i++) { const w = history.slice(i, i + 10); maxShare = Math.max(maxShare, w.filter(m => m === 'ISOLATED').length / 10); }
  check(candidateIsolated === 200, 'the controller wanted the isolated mode for every one of 200 operations');
  check(maxShare <= 0.8 + 1e-9, `G1: isolated share of every window of 10 is at most 0.80 (max ${maxShare.toFixed(2)})`);
  check(ratioTrips >= 40 && history.filter(m => m === 'HE').length >= 40, `G1: at least 20% of operations ran homomorphically (${history.filter(m => m === 'HE').length}/200)`);
  const g2 = arb.decide({ predictedHeMs: 10_000, predictorReleased: true, tier: 2, secureMemoryUtilAfter: 0.9, heAvailable: true, isolatedAvailable: true });
  check(g2.mode === 'HE' && g2.guards.secureMemory, 'G2: an isolated dispatch above the secure-memory ceiling is redirected to HE');
  const tier = arb.decide({ predictedHeMs: 10_000, predictorReleased: true, tier: 1, secureMemoryUtilAfter: 0.1, heAvailable: true, isolatedAvailable: true });
  check(tier.mode === 'HE' && tier.guards.tierOverride, 'tier override: a highest-confidentiality query stays homomorphic whatever the latency');
  const unrel = arb.decide({ predictedHeMs: 10_000, predictorReleased: false, tier: 2, secureMemoryUtilAfter: 0.1, heAvailable: true, isolatedAvailable: true });
  check(unrel.mode === 'HE' && unrel.candidateMode === 'HE', 'release gate: before the predictor is released the default mode is used');
  const fast = arb.decide({ predictedHeMs: 50, predictorReleased: true, tier: 2, secureMemoryUtilAfter: 0.1, heAvailable: true, isolatedAvailable: true });
  check(fast.mode === 'HE' && !fast.guards.enclaveRatio, 'a prediction below the threshold keeps the homomorphic mode without any guard');

  console.log('\n--- Latency predictor and release gate ---');
  const pred = new LatencyPredictor({ minObservations: 6 });
  check(!pred.released() && pred.predict({ ciphertexts: 3, queueDepth: 0, cpuUtil: 0.2 }) === null, 'no prediction before any observation');
  for (let i = 0; i < 14; i++) { const c = 1 + (i % 4); const q = i % 3; pred.observe({ ciphertexts: c, queueDepth: q, cpuUtil: 0.2 }, 40 + 35 * c + 10 * q); }
  const p3 = pred.predict({ ciphertexts: 3, queueDepth: 0, cpuUtil: 0.2 })!;
  check(pred.released() && Math.abs(p3 - 145) < 10, `released after consistent observations; predicts ${p3.toFixed(1)} ms for 3 ciphertexts (expected 145)`);

  console.log('\n--- Homomorphic path (CKKS, node-seal) ---');
  const he = new HeEngine();
  const heAvailable = await he.init();
  check(heAvailable, `CKKS engine initialised${heAvailable ? '' : ` (${he.lastError})`}`);
  if (heAvailable) {
    const q = unit(1); const k = 20; const cands = new Float32Array(k * CASE_DIM);
    const expected: number[] = [];
    for (let i = 0; i < k; i++) { const c = unit(100 + i); cands.set(c, i * CASE_DIM); expected.push(dot(q, c)); }
    const eq = he.encryptQuery(q);
    const t1 = performance.now();
    const r = he.evaluate(eq, cands);
    const ms = performance.now() - t1;
    const maxErr = Math.max(...r.scores.map((s, i) => Math.abs(s - expected[i])));
    check(r.ciphertexts === Math.ceil(k / CANDIDATES_PER_CIPHERTEXT) && maxErr < 1e-3, `packed evaluation of ${k} candidates in ${r.ciphertexts} ciphertexts matches plaintext (max error ${maxErr.toExponential(2)}, ${ms.toFixed(0)} ms)`);
    check(eq.residualBudget() === 1 && r.refreshes === 0, 'a fresh query ciphertext passes the noise-floor admission check without a refresh');
    he.modSwitchDown(eq);
    const before = eq.residualBudget();
    const adm = he.admit(eq, 1);
    check(before < 1 && adm.refreshed && adm.budgetAfter >= NOISE_FLOOR, `G3: a ciphertext whose budget would fall below the floor (${before.toFixed(2)} before) is refreshed before the operation`);
    const r2 = he.evaluate(eq, cands);
    const maxErr2 = Math.max(...r2.scores.map((s, i) => Math.abs(s - expected[i])));
    check(maxErr2 < 1e-3 && he.counters.refreshes === 1, `after the refresh the evaluation is still exact (max error ${maxErr2.toExponential(2)})`);
    he.release(eq);
  }

  console.log('\n--- Isolated path (worker thread, smudging) ---');
  const iso = new IsolatedEvaluator();
  const q = unit(7); const k = 16; const cands = new Float32Array(k * CASE_DIM); const exp: number[] = [];
  for (let i = 0; i < k; i++) { const c = unit(300 + i); cands.set(c, i * CASE_DIM); exp.push(dot(q, c)); }
  const exact = await iso.evaluate(q, cands, 0);
  check(Math.max(...exact.scores.map((s, i) => Math.abs(s - exp[i]))) < 1e-5, 'isolated evaluator computes exact scores when smudging is off');
  const smudged = await iso.evaluate(q, cands);
  const dev = smudged.scores.map((s, i) => Math.abs(s - exp[i]));
  check(dev.every(d => d < 8 * smudged.sigma) && dev.some(d => d > 0), `smudging adds calibrated noise (sigma = 2^-9) to every score before it leaves the worker`);
  check(iso.utilisation(iso.footprintBytes(48)) < 0.85 && iso.utilisation(iso.footprintBytes(48)) > 0, 'secure-memory accounting reports a utilisation below the ceiling for a normal operation');
  await iso.close();

  console.log('\n--- Orchestrator end to end (reference shard, no database rows needed) ---');
  const orch = new RetrievalOrchestrator({ arbiter: { thresholdMs: 0, windowW: 10, maxEnclaveRatio: 0.8, defaultMode: 'ISOLATED' } });
  orch.useRecords(shard);
  const r1 = await orch.similar({ query: { symptoms: ['Polyuria', 'Excessive thirst', 'Fatigue'], ageBand: '41-60', sex: 'MALE' }, topN: 5 });
  check(r1.results.length === 5 && r1.results.every(x => x.source === 'reference') && r1.privacy.resultsDeidentified, 'returns five de-identified reference cases');
  check(/Prameha|diabetes/i.test(r1.results[0].diagnoses.join(' ')), `top result is the diabetes presentation (${r1.results[0].diagnoses[0]})`);
  check(['HE', 'ISOLATED'].includes(r1.decision.mode) && r1.stages.coarseCandidates === 48, `decision attached (mode ${r1.decision.mode}, ${r1.stages.totalMs} ms total)`);
  for (let i = 0; i < 30; i++) await orch.similar({ query: { symptoms: ['Cough', 'Fever'], ageBand: '19-40' }, topN: 3 });
  const st = orch.status();
  check(st.arbiter.counters.maxWindowEnclaveShare <= 0.8 + 1e-9 && st.arbiter.counters.he >= 6, `over 31 operations with a zero threshold the isolated share never exceeded 0.80 (max ${st.arbiter.counters.maxWindowEnclaveShare.toFixed(2)}; HE ran ${st.arbiter.counters.he} times)`);
  const rt = await orch.similar({ query: { symptoms: ['Low mood', 'Insomnia'], department: 'Manas Roga' }, topN: 3 });
  check(rt.decision.tier === 1 && (rt.decision.mode === 'HE' || !heAvailable), `a Manas Roga query is tier 1 and ran in ${rt.decision.mode} mode`);
  const ex = await orch.similar({ query: { symptoms: ['Knee pain', 'Morning stiffness'] }, topN: 3, excludeIds: [shard[3].id] });
  check(!ex.results.some(x => x.caseId === shard[3].id), 'excluded ids never appear in results');
  await orch.isolated.close();

  const durationMs = performance.now() - t0;
  const ok = passed === total;
  console.log(`\n${ok ? '[PASS]' : '[FAIL]'} Encrypted similar-case retrieval battery: ${passed}/${total} checks in ${durationMs.toFixed(0)} ms (HE ${heAvailable ? 'available' : 'unavailable'})\n`);
  return { passed, total, isPassed: ok, durationMs, heAvailable };
}

if (require.main === module) {
  runRetrievalBattery().then(r => process.exit(r.isPassed ? 0 : 1)).catch(e => { console.error(e); process.exit(1); });
}
