/**
 * Prescription-safety benchmark: eval/safety_cases.json run through the same evaluation the
 * desk and /api/doctor/prescribe use. Gates (see docs/DOCTOR_DESK_DEEP_REVIEW.md §1.4):
 *   - MUST cases raise at least a warning:                    ≥ 95%
 *   - MUST cases that should stop the prescriber reach STOP:   ≥ 95%, and 100% for allergy,
 *     banned FDCs and absolute pregnancy contraindications
 *   - BENIGN cases raise no STOP:                              100%
 *   - BENIGN cases raise no WARN either (alarm noise):         ≥ 90%
 *
 *   npm run eval:safety            (prints every case)
 */
import './env';
import fs from 'fs';
import path from 'path';
import { TruthEngineService } from '../src/services/truthEngine.service';
import { cleanContext } from '../src/services/patientContext.service';

interface Case {
  id: string; kind: 'MUST' | 'BENIGN'; expect: 'STOP' | 'WARN' | 'NONE' | 'INFO_ONLY' | 'NO_STOP'; category: string; label: string;
  allopathic: any[]; ayush: any[]; context?: any; diet?: string[];
}

export function runSafetyBenchmark(verbose = false) {
  const t0 = performance.now();
  const file = path.join(__dirname, '..', 'eval', 'safety_cases.json');
  const cases: Case[] = JSON.parse(fs.readFileSync(file, 'utf8')).cases;
  const rows: Array<{ c: Case; tiers: string[]; pass: boolean; reachedStop: boolean; anyAlert: boolean }> = [];
  for (const c of cases) {
    const ctx = c.context ? (cleanContext(c.context) || null) : null;
    const res = TruthEngineService.evaluatePrescriptionsDetailed(c.allopathic, c.ayush, ctx, { diet: c.diet });
    const tiers = res.alerts.map(a => a.tier || 'WARN');
    const reachedStop = tiers.includes('STOP');
    const anyAlert = tiers.some(t => t === 'STOP' || t === 'WARN');
    let pass: boolean;
    if (c.expect === 'STOP') pass = reachedStop;
    else if (c.expect === 'WARN') pass = anyAlert;
    else if (c.expect === 'NO_STOP') pass = !reachedStop;
    else pass = !anyAlert;
    rows.push({ c, tiers, pass, reachedStop, anyAlert });
    if (verbose || !pass) {
      const summary = res.alerts.filter(a => a.tier !== 'INFO' || !pass).map(a => `${a.tier}:${a.alertId}`).join(', ') || 'no alerts';
      console.log(`  ${pass ? '[OK]  ' : '[FAIL]'} ${c.id} ${c.kind.padEnd(6)} ${c.expect.padEnd(9)} ${c.label}  -> ${summary}`);
    }
  }
  const must = rows.filter(r => r.c.kind === 'MUST');
  const stopCases = must.filter(r => r.c.expect === 'STOP');
  const benign = rows.filter(r => r.c.kind === 'BENIGN');
  const sensitivity = must.filter(r => r.anyAlert).length / must.length;
  const stopRate = stopCases.filter(r => r.reachedStop).length / stopCases.length;
  const absolute = stopCases.filter(r => ['ALLERGY', 'FDC', 'PREG'].includes(r.c.category));
  const absoluteRate = absolute.filter(r => r.reachedStop).length / Math.max(1, absolute.length);
  const benignNoStop = benign.filter(r => !r.reachedStop).length / benign.length;
  const benignQuiet = benign.filter(r => r.c.expect === 'NO_STOP' || !r.anyAlert).length / benign.length;
  const gates = [
    { name: 'MUST cases raise at least a warning', value: sensitivity, target: 0.95 },
    { name: 'STOP cases reach STOP', value: stopRate, target: 0.95 },
    { name: 'Allergy / banned FDC / absolute pregnancy reach STOP', value: absoluteRate, target: 1 },
    { name: 'BENIGN cases raise no STOP', value: benignNoStop, target: 1 },
    { name: 'BENIGN cases raise no warning (noise)', value: benignQuiet, target: 0.9 }
  ];
  for (const g of gates) console.log(`  ${g.value >= g.target ? '[OK]  ' : '[FAIL]'} ${g.name}: ${(g.value * 100).toFixed(1)}% (target ${(g.target * 100).toFixed(0)}%)`);
  const passed = rows.filter(r => r.pass).length;
  return {
    isPassed: gates.every(g => g.value >= g.target),
    passed,
    total: rows.length,
    sensitivity, stopRate, absoluteRate, benignNoStop, benignQuiet,
    latencyMs: performance.now() - t0
  };
}

if (require.main === module) {
  const r = runSafetyBenchmark(process.argv.includes('--verbose') || process.argv.includes('-v'));
  console.log(`\nSafety benchmark: ${r.passed}/${r.total} cases · sensitivity ${(r.sensitivity * 100).toFixed(1)}% · STOP reached ${(r.stopRate * 100).toFixed(1)}% · benign without STOP ${(r.benignNoStop * 100).toFixed(1)}% · ${r.latencyMs.toFixed(0)} ms`);
  process.exit(r.isPassed ? 0 : 1);
}
