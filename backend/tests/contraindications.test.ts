/**
 * Dual-Pharmacology Lethal Herb-Drug Contraindication Benchmark
 * Evaluates Bayesian Truth Engine conflict resolution on lethal drug-herb pairs.
 */

import { TruthEngineService } from '../src/services/truthEngine.service';
import { AyushEngineService } from '../src/services/ayushEngine.service';
import { AllopathicMedication, AyushFormulation } from '../src/shared/types';

export function runContraindicationBenchmark() {
  console.log(`\n========================================================================`);
  console.log(`  RUNNING DUAL-PHARMACOLOGY TRUTH ENGINE CONTRAINDICATION BENCHMARK`);
  console.log(`========================================================================`);

  const tStart = performance.now();

  // Each pair must reach the tier its evidence supports (recalibrated 2026-10-09, see
  // docs/DOCTOR_DESK_DEEP_REVIEW.md): interrupt only for what must stop the prescriber.
  type Expect = 'STOP' | 'WARN';
  const pairs: Array<{ label: string; drug: string; herb: string; expect: Expect }> = [
    { label: 'Warfarin + Guggulu (case reports; INR change)', drug: 'Warfarin', herb: 'Yograj Guggulu', expect: 'WARN' },
    { label: 'Metformin + Shilajit (additive glucose lowering)', drug: 'Metformin', herb: 'Shilajit', expect: 'WARN' },
    { label: 'Digoxin + Yashtimadhu (hypokalaemia → digoxin toxicity)', drug: 'Digoxin', herb: 'Yashtimadhu Churna', expect: 'STOP' },
    { label: 'Alprazolam + Ashwagandha (additive sedation)', drug: 'Alprazolam', herb: 'Ashwagandha Churna', expect: 'WARN' },
    { label: 'Metronidazole + Draksharishta (alcohol in arishta)', drug: 'Metronidazole', herb: 'Draksharishta', expect: 'STOP' }
  ];
  let criticalCaught = 0;
  const totalCriticalTested = pairs.length;
  for (const p of pairs) {
    const alerts = TruthEngineService.evaluatePrescriptions(
      [{ drugName: p.drug, dosage: '1 tab', route: 'Oral', frequency: 'OD', timing: 'Anytime', duration: '30d' }],
      [{ formulationName: p.herb, category: 'Churna', dosage: '3g', frequency: 'BD', anupana: 'Warm Water', timing: 'Prathakaal (Morning)', duration: '15d' }]
    );
    const top = alerts.some(a => a.tier === 'STOP') ? 'STOP' : alerts.some(a => a.tier === 'WARN') ? 'WARN' : 'NONE';
    const ok = top === p.expect;
    if (ok) criticalCaught++;
    console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${p.label}: ${top} (expected ${p.expect})`);
  }

  // Safe combination (Paracetamol + Sitopaladi Churna) -> zero false positives
  const test5 = TruthEngineService.evaluatePrescriptions(
    [{ drugName: 'Paracetamol', dosage: '650mg', route: 'Oral', frequency: 'TDS', timing: 'After Food (PC)', duration: '3d' }],
    [{ formulationName: 'Sitopaladi Churna', category: 'Churna', dosage: '3g', frequency: 'BD', anupana: 'Honey', timing: 'Prathakaal (Morning)', duration: '5d' }]
  );
  const zeroFalsePositives = test5.filter(a => a.tier !== 'INFO').length === 0;

  // Viruddha Ahara check (heated honey)
  const viruddhaTest = AyushEngineService.checkViruddhaAhara([
    { formulationName: 'Sitopaladi Churna', category: 'Churna', dosage: '3g', frequency: 'BD', anupana: 'Hot boiling water with Honey', timing: 'Prathakaal (Morning)', duration: '5d' }
  ]);
  const viruddhaCaught = viruddhaTest.length > 0;

  const tEnd = performance.now();
  const totalTimeMs = tEnd - tStart;

  console.log(`• Herb–drug pairs tested:            ${totalCriticalTested}`);
  console.log(`• Pairs at the evidence-based tier:  ${criticalCaught} / ${totalCriticalTested}`);
  console.log(`• False Positive Resistance:         ${zeroFalsePositives ? '100.00% (Zero false alarms on safe pairs)' : 'FAILED'}`);
  console.log(`• Classical Viruddha Ahara Caught:   ${viruddhaCaught ? 'YES (Heated Honey detected)' : 'FAILED'}`);
  console.log(`• Evaluation Latency:                ${totalTimeMs.toFixed(3)} ms`);

  const passed = criticalCaught === totalCriticalTested && zeroFalsePositives && viruddhaCaught;
  console.log(`• Status:                            ${passed ? 'PASSED (tiers match evidence; zero false alarms)' : 'FAILED'}`);
  console.log(`========================================================================\n`);

  return { passed, totalTimeMs };
}

if (require.main === module) {
  runContraindicationBenchmark();
}
