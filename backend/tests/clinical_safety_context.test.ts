/**
 * Patient-context safety battery: the checks that only fire when the prescriber's screen knows
 * who the patient is (pregnancy, renal function, age), plus matcher hygiene and NEWS2 triage.
 *
 *   npx tsx tests/clinical_safety_context.test.ts
 */
import { TruthEngineService } from '../src/services/truthEngine.service';
import { assessVitals, raisePriority } from '../src/services/triage.service';
import { ckdEpi2021, cleanContext } from '../src/services/patientContext.service';
import { normaliseHistory, buildHistorySummary } from '../src/services/clinicalHistory.service';
import { BayesianTruthEngineService } from '../src/services/bayesianTruthEngine.service';
import { PiyGraphService } from '../src/services/piygraph.service';
import { TruthEngine } from '../src/services/core/truthEngine.engine';
import { calibrate, evaluate } from '../src/services/core/conformal.engine';
import { PACConformalGateService, loadCalibration } from '../src/services/pacConformalGate.service';

const med = (drugName: string) => ({ drugName, dosage: '1 tab', route: 'Oral' as const, frequency: 'OD' as const, timing: 'Anytime' as const, duration: '30d' });
const herb = (formulationName: string) => ({ formulationName, category: 'Churna' as const, dosage: '3g', frequency: 'BD', anupana: 'Water', timing: 'Morning' as const, duration: '15d' });
const ids = (alerts: Array<{ alertId: string }>) => alerts.map(a => a.alertId);

export function runClinicalSafetyBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };

  console.log('\n--- Patient context gates ---');
  check(ids(TruthEngineService.evaluatePrescriptions([med('Warfarin')], [], { isPregnant: true })).includes('ONT-PREG-WARFARIN'), 'warfarin in pregnancy raises ONT-PREG-WARFARIN');
  check(!ids(TruthEngineService.evaluatePrescriptions([med('Warfarin')], [], { isPregnant: false })).includes('ONT-PREG-WARFARIN'), 'warfarin without pregnancy does not');
  check(ids(TruthEngineService.evaluatePrescriptions([med('Metformin')], [], { eGfr: 22 })).includes('ONT-RENAL-METFORMIN'), 'metformin with eGFR 22 raises ONT-RENAL-METFORMIN');
  check(ids(TruthEngineService.evaluatePrescriptions([], [herb('Kalonji Churna')], { isPregnant: true })).includes('ONT-GARBHINI-ABORT'), 'uterotonic churna in pregnancy raises ONT-GARBHINI-ABORT');
  check(ids(TruthEngineService.evaluatePrescriptions([], [herb('Arogyavardhini Vati')], { age: 7 })).some(i => i.startsWith('VULN-PAED')), 'bhasma-containing vati in a 7-year-old raises the paediatric gate');
  const detailed = TruthEngineService.evaluatePrescriptionsDetailed([med('Paracetamol')], [], null);
  check(detailed.checks.some(c => c.check === 'pregnancy_gate' && c.ran === false), 'with no context the record says the pregnancy gate did not run');

  console.log('\n--- Matcher hygiene ---');
  check(!ids(TruthEngineService.evaluatePrescriptions([med('Nystatin')], [herb('Trikatu Churna')])).includes('INT-010'), 'Nystatin + Trikatu does not trip the statin rule');
  check(ids(TruthEngineService.evaluatePrescriptions([med('Atorvastatin')], [herb('Trikatu Churna')])).includes('INT-010'), 'Atorvastatin + Trikatu does');
  check(ids(TruthEngineService.evaluatePrescriptions([med('stopped warfarin last year')], [herb('Yograj Guggulu')])).length === 0, 'a negated mention ("stopped warfarin") is ignored');
  check(ids(TruthEngineService.evaluatePrescriptions([med('Coumadin')], [herb('Yograj Guggulu')])).includes('ONT-VKA-GUGGUL'), 'brand name (Coumadin) resolves to warfarin for the ontology rule');
  check(ids(TruthEngineService.evaluatePrescriptions([med('Paracetamol')], [herb('Sitopaladi Churna')])).length === 0, 'safe pair stays silent');

  console.log('\n--- Evidence engine ---');
  const pair = BayesianTruthEngineService.evaluatePair('Warfarin', 'Yograj Guggulu');
  check(pair.prior.source === 'registry' && pair.observationsUsed === 0, 'registry prior used, no fabricated observations');
  check(pair.bayesFactor > 3 && pair.direction === 'interaction', `BF10 ${pair.bayesFactor} (Savage-Dickey) favours interaction`);
  const flat = TruthEngine.computePosterior('a', 'b', []);
  check(flat.bayesFactor === 1 && flat.direction === 'undetermined', 'no data: BF10 = 1, direction undetermined');
  const unknown = BayesianTruthEngineService.evaluatePair('Paracetamol', 'Triphala Churna');
  check(unknown.prior.source === 'flat' && unknown.bayesFactor === 1, 'unknown pair: flat prior, no invented evidence');

  console.log('\n--- Graph-grounded counterfactual ---');
  const cf = PiyGraphService.evaluateCounterfactualSubstitution('Yograj Guggulu', 'Warfarin', 'Chocolate Cake');
  check(cf.recommendedSubstitution === null && cf.evidence === 'NO_DATA_FOR_SUBSTITUTE', 'an unknown substitute is never recommended');
  const auto = PiyGraphService.evaluateCounterfactualSubstitution('Yograj Guggulu', 'Warfarin');
  check(auto.candidates.every(c => c.sharedIndications.length > 0), 'auto candidates share an indication with the original formulation');
  check(!('bayesFactor' in PiyGraphService.evaluateHigherOrderPolypharmacy([med('Warfarin'), med('Aspirin')], [herb('Yograj Guggulu')])), 'polypharmacy screen carries no invented Bayes factor');

  console.log('\n--- Split conformal gate ---');
  const cal = calibrate([0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.2, 0.3, 0.6, 0.9], 0.2, 'unit');
  check(cal.k === 9 && cal.qHat === 0.6 && cal.guaranteed, 'k = ceil((n+1)(1-alpha)) = 9 picks the 9th smallest score (0.6)');
  check(evaluate(0.55, cal).inPredictionSet && !evaluate(0.65, cal).inPredictionSet, 'scores at or below q-hat are in the set');
  check(!calibrate([0.1, 0.2], 0.1).guaranteed && !evaluate(0.01, calibrate([0.1, 0.2], 0.1)).inPredictionSet, 'n too small: no guarantee, gate abstains');
  const shipped = loadCalibration();
  check(!!shipped && shipped.guaranteed && shipped.n >= 20, `shipped calibration present (n=${shipped?.n}, alpha=${shipped?.alpha})`);
  check(PACConformalGateService.evaluate({ topCandidateConfidence: 0.999 }).allowFastpathEmission, 'a 0.999-weight suggestion is inside the shipped prediction set');
  check(!PACConformalGateService.evaluate({ topCandidateConfidence: 0.55 }).allowFastpathEmission, 'a 0.55-weight suggestion is withheld');

  console.log('\n--- NEWS2 triage ---');
  const a = assessVitals({ bp: '85/60', pulse: 135, spo2: 90, respiratoryRate: 26, temp: '39.5 C' }, { selfReported: false, age: 50 });
  check(a.news2 === 14 && a.band === 'HIGH' && a.suggestedPriority === 'EMERGENCY_RED_FLAG', `shock picture scores NEWS2 ${a.news2} (expected 14)`);
  const b = assessVitals({ bp: '120/80', pulse: 72, spo2: 98, respiratoryRate: 16, temp: '98.6 F' }, { selfReported: true, age: 30 });
  check(b.news2 === 0 && b.band === 'LOW' && b.selfReported, 'normal vitals score 0 and are flagged patient-reported');
  const c = assessVitals({ bp: '150/95', spo2: 92 }, { selfReported: true, age: 60 });
  check(c.news2 === 2 && c.missing.includes('pulse') && !c.complete, 'partial vitals: SpO2 92 scores 2, missing parameters listed');
  const d = assessVitals({ bp: '88/50' }, { age: 40 });
  check(d.anySingleThree && d.band === 'LOW_MEDIUM' && d.suggestedPriority === 'HIGH_PRIORITY', 'a single parameter scoring 3 triggers urgent review');
  check(!assessVitals({ pulse: 150 }, { age: 4 }).applicable, 'NEWS2 is not applied to a 4-year-old');
  check(raisePriority('EMERGENCY_RED_FLAG', 'ROUTINE') === 'EMERGENCY_RED_FLAG' && raisePriority('ROUTINE', 'HIGH_PRIORITY') === 'HIGH_PRIORITY', 'priority only ever rises');

  console.log('\n--- Renal function and context parsing ---');
  check(ckdEpi2021(1.0, 50, 'male') === 92 && ckdEpi2021(1.0, 50, 'female') === 69, `CKD-EPI 2021 (Scr 1.0, age 50): male ${ckdEpi2021(1.0, 50, 'male')}, female ${ckdEpi2021(1.0, 50, 'female')}`);
  check(ckdEpi2021(3.2, 70, 'male') < 25, 'Scr 3.2 at 70 gives stage 4 CKD');
  check(cleanContext({ isPregnant: 'yes', eGfr: '25', age: 'x' })?.eGfr === 25 && cleanContext({ isPregnant: 'yes' }) === undefined, 'explicit context is parsed strictly');

  console.log('\n--- Structured history ---');
  const legacy = normaliseHistory({ conditions: ['Diabetes', 'None'], allergies: 'Sulpha, peanuts', currentMedicines: 'Metformin 500' });
  check(legacy.version === 2 && legacy.pastMedical.length === 1 && legacy.allergyList.length === 2 && legacy.drugHistory.length === 1, 'legacy kiosk history upgrades to v2 with items');
  check(legacy.conditions.includes('Diabetes') && legacy.allergies === 'Sulpha, peanuts', 'legacy keys are preserved for older screens');
  check(legacy.completeness.sections.reviewOfSystems === 'not_asked' && legacy.completeness.sections.pastSurgical === 'not_asked', 'sections never asked are reported as not asked');
  const full = normaliseHistory({ chiefComplaint: 'Chest pain', conditions: [], allergies: '', currentMedicines: '', pastSurgical: [{ name: 'Appendicectomy', since: '2015' }], familyHistory: [{ condition: 'Diabetes', relation: 'father' }], personal: { tobacco: 'current', tobaccoDetail: 'bidi', alcohol: 'never', diet: 'vegetarian' }, reviewOfSystems: { cardiovascular: 'present', respiratory: 'denied' }, askedSections: { pastSurgical: true, familyHistory: true } });
  const summary = buildHistorySummary({ patient: { name: 'Test', age: 50, gender: 'MALE' }, symptoms: [{ name: 'Chest Pain', site: 'Substernal', onset: '2 hours', severity: 8, isNegated: false }, { name: 'Fever', isNegated: true, severity: 0 }], history: full, vitals: { bp: '140/90', source: 'patient_self_report' } });
  check(summary.sections.map(s => s.id).join(',').startsWith('chiefComplaint,hpi,pastMedical,pastSurgical,drugAllergy,family,personal,ros'), 'summary follows the standard section order');
  check(/Denies: Fever/.test(summary.text) && /Not asked/.test(summary.sections.find(s => s.id === 'ros')!.text) && /Denied: respiratory/.test(summary.sections.find(s => s.id === 'ros')!.text), 'denied and not-asked are distinguished');
  check(/tobacco: current \(bidi\)/.test(summary.text) && /Appendicectomy \(2015\)/.test(summary.text) && /Diabetes \(father\)/.test(summary.text), 'surgical, family and personal history appear');
  check(summary.textHi.includes('मुख्य शिकायत') && summary.textHi.includes('तम्बाकू'), 'Hindi rendering present');
  check(summary.completeness.score > 0 && summary.completeness.sections.reviewOfSystems === 'partial', 'completeness score computed, partial ROS flagged');

  const durationMs = performance.now() - t0;
  const ok = passed === total;
  console.log(`\n${ok ? '[PASS]' : '[FAIL]'} Clinical safety & history battery: ${passed}/${total} checks in ${durationMs.toFixed(1)} ms\n`);
  return { passed, total, isPassed: ok, durationMs };
}

if (require.main === module) {
  const r = runClinicalSafetyBattery();
  process.exit(r.isPassed ? 0 : 1);
}
