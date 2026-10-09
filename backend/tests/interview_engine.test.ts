/**
 * Adaptive interview battery: branching by complaint, red-flag probes, skip handling,
 * gating by patient attributes and care stream, and the structured history it produces.
 *
 *   npx tsx tests/interview_engine.test.ts
 */
import { InterviewService, loadInterview, planFor, purgeInterviews } from '../src/services/interview.service';

export function runInterviewBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };

  console.log('\n--- Chest pain, male, Ayurveda stream ---');
  const a = InterviewService.start({ language: 'hi', careStream: 'AYURVEDA', patient: { age: 58, gender: 'MALE' } });
  check(a.question.id === 'cc_family' && a.question.text.includes('आज'), 'starts with the chief complaint in Hindi');
  check(planFor(a.state).length === 1, 'nothing is planned before the chief complaint is known');
  let r = InterviewService.answer(a.state, 'cc_family', 'chest_pain');
  const plan = planFor(a.state);
  check(plan.includes('rf_cp_radiation') && plan.includes('rf_cp_assoc') && !plan.includes('rf_ha_worst') && !plan.includes('ob_pregnant'), 'chest-pain branch planned; headache and obstetric probes excluded');
  check(plan.includes('ay_agni') && plan.includes('ay_koshtha'), 'Ayurveda stream adds Agni and Koshtha questions');
  check(plan.filter(id => id.startsWith('ros_')).length === 10, 'all ten review-of-systems questions planned');
  r = InterviewService.answer(a.state, 'cc_text', 'seene me dard aur pasina');
  r = InterviewService.answer(a.state, 'hpi_onset', 'hours');
  r = InterviewService.answer(a.state, 'hpi_sudden', 'sudden');
  r = InterviewService.answer(a.state, 'hpi_character', 'pressure');
  r = InterviewService.answer(a.state, 'hpi_severity', 8);
  r = InterviewService.answer(a.state, 'hpi_timing', 'continuous');
  r = InterviewService.answer(a.state, 'hpi_worse', ['exertion']);
  r = InterviewService.answer(a.state, 'hpi_better', ['rest']);
  r = InterviewService.answer(a.state, 'hpi_treated', undefined, true);
  check(r.question?.id === 'rf_cp_radiation', `after HPI the chest-pain red-flag probe follows (got ${r.question?.id})`);
  r = InterviewService.answer(a.state, 'rf_cp_radiation', ['left_arm']);
  check(r.redFlags.some(f => f.tier === 'sos' && /coronary/i.test(f.label)), 'radiation to the left arm raises an SOS-tier red flag immediately');
  r = InterviewService.answer(a.state, 'rf_cp_assoc', ['sweating', 'breathless']);
  r = InterviewService.answer(a.state, 'rf_cp_exertion', true);
  r = InterviewService.answer(a.state, 'pmh_conditions', ['Diabetes', 'Hypertension']);
  r = InterviewService.answer(a.state, 'pmh_other', undefined, true);
  check(r.question?.id === 'pmh_control', 'control question appears once a condition is reported');
  r = InterviewService.answer(a.state, 'pmh_control', 'uncontrolled');
  r = InterviewService.answer(a.state, 'psh_any', false);
  check(r.question?.id === 'drug_current', 'surgical detail is skipped when there was no operation');
  r = InterviewService.answer(a.state, 'drug_current', 'Metformin 500, Amlodipine 5');
  r = InterviewService.answer(a.state, 'drug_adherence', 'irregular');
  r = InterviewService.answer(a.state, 'drug_ayush', false);
  r = InterviewService.answer(a.state, 'allergy_any', true);
  r = InterviewService.answer(a.state, 'allergy_detail', 'Sulpha drugs, rash');
  r = InterviewService.answer(a.state, 'allergy_severity', 'moderate');
  r = InterviewService.answer(a.state, 'fam_conditions', ['Heart disease']);
  for (const [q, v] of [['per_tobacco', 'current'], ['per_tobacco_type', ['bidi']], ['per_alcohol', 'never'], ['per_diet', 'vegetarian'], ['per_appetite', 'normal'], ['per_bowel', 'regular'], ['per_sleep', 'disturbed'], ['per_activity', 'moderate']] as const) r = InterviewService.answer(a.state, q, v as any);
  r = InterviewService.answer(a.state, 'per_occupation', 'farmer');
  for (const sys of ['constitutional', 'cardiovascular', 'respiratory', 'gastrointestinal', 'genitourinary', 'musculoskeletal', 'neurological', 'dermatological', 'psychiatric', 'endocrine']) r = InterviewService.answer(a.state, `ros_${sys}`, sys === 'cardiovascular');
  r = InterviewService.answer(a.state, 'ay_agni', 'Mandagni');
  r = InterviewService.answer(a.state, 'ay_koshtha', 'Krura');
  r = InterviewService.answer(a.state, 'ay_ama', true);
  r = InterviewService.answer(a.state, 'ay_sleep_time', 'late');
  check(r.done === true && r.question === null, 'interview completes after the last planned question');
  const out = InterviewService.finish(a.state);
  check(out.suggestedPriority === 'EMERGENCY_RED_FLAG' && out.redFlags.length >= 2, `red flags (${out.redFlags.length}) make the suggested priority EMERGENCY_RED_FLAG`);
  check(out.symptoms[0]?.name === 'Chest Pain' && out.symptoms[0]?.radiation === 'left_arm' && out.symptoms[0]?.severity === 8 && /sudden/.test(out.symptoms[0]?.onset || ''), 'SOCRATES symptom assembled from the answers');
  const h = out.history;
  check(h.pastMedical.length === 2 && h.pastMedical[0].status === 'uncontrolled', 'past medical items carry control status');
  check(h.drugHistory.length === 2 && h.drugHistory[0].adherence === 'irregular', 'drug history split into items with adherence');
  check(h.allergyList[0]?.severity === 'moderate' && /Sulpha/.test(h.allergyList[0].agent), 'allergy with severity');
  check(h.familyHistory[0]?.condition === 'Heart disease', 'family history recorded');
  check(h.personal.tobacco === 'current' && h.personal.tobaccoDetail === 'bidi' && h.personal.occupation === 'farmer', 'personal history recorded');
  check(h.reviewOfSystems.cardiovascular === 'present' && h.reviewOfSystems.respiratory === 'denied', 'ROS distinguishes present and denied');
  check(h.ayush?.pariksha?.agni === 'Mandagni' && h.ayush?.pariksha?.amaPresent === true, 'Ayurveda pariksha captured');
  check(h.completeness.asked === out.transcript.length && h.completeness.skipped === 2 && h.completeness.score > 0.9, `completeness: ${h.completeness.answered}/${h.completeness.asked} answered, ${h.completeness.skipped} skipped`);
  check(out.transcript.filter(t => t.status === 'skipped').map(t => t.questionId).join(',') === 'hpi_treated,pmh_other', 'transcript lists exactly the skipped questions');
  check(loadInterview(a.state.id)?.finishedAt !== undefined, 'state persisted (encrypted) and marked finished');

  console.log('\n--- Pregnant woman, headache ---');
  const b = InterviewService.start({ language: 'en', careStream: 'ALLOPATHY', patient: { age: 28, gender: 'FEMALE' } });
  InterviewService.answer(b.state, 'cc_family', 'headache');
  const planB = planFor(b.state);
  check(planB.includes('ob_pregnant') && planB.includes('rf_ha_worst') && planB.includes('rf_fever_neck') && !planB.includes('ay_agni'), 'obstetric and headache probes planned; no Ayurveda questions on the allopathy stream');
  InterviewService.answer(b.state, 'cc_text', undefined, true);
  for (const q of ['hpi_onset', 'hpi_sudden', 'hpi_character', 'hpi_severity', 'hpi_timing', 'hpi_worse', 'hpi_better']) InterviewService.answer(b.state, q, q === 'hpi_onset' ? 'hours' : q === 'hpi_sudden' ? 'sudden' : q === 'hpi_character' ? 'throbbing' : q === 'hpi_severity' ? 10 : q === 'hpi_timing' ? 'continuous' : ['nothing']);
  InterviewService.answer(b.state, 'hpi_treated', undefined, true);
  let rb = InterviewService.answer(b.state, 'rf_fever_neck', false);
  rb = InterviewService.answer(b.state, 'rf_fever_fits', false);
  rb = InterviewService.answer(b.state, 'rf_ha_worst', true);
  check(rb.redFlags.some(f => /thunderclap/i.test(f.label) && f.tier === 'sos'), 'worst-ever headache raises the subarachnoid red flag');
  rb = InterviewService.answer(b.state, 'rf_ha_neuro', ['none']);
  check(!rb.redFlags.some(f => /stroke/i.test(f.label)), '"none" does not trigger the stroke flag');
  let threw = false;
  try { InterviewService.answer(b.state, 'rf_ha_neuro', ['teleport']); } catch { threw = true; }
  check(threw, 'an option outside the ontology is rejected');
  threw = false;
  try { InterviewService.answer(b.state, 'hpi_severity', 42); } catch { threw = true; }
  check(threw, 'a scale value outside 1-10 is rejected');
  threw = false;
  try { InterviewService.answer(b.state, 'ob_weeks', 20); } catch { threw = true; }
  check(threw, 'a gated question (weeks pregnant) cannot be answered before its gate');

  console.log('\n--- Child, injury ---');
  const c = InterviewService.start({ language: 'hi', careStream: 'UNDECIDED', patient: { age: 6, gender: 'MALE' } });
  InterviewService.answer(c.state, 'cc_family', 'injury');
  const planC = planFor(c.state);
  check(planC.includes('rf_inj_type') && planC.includes('rf_inj_head') && !planC.includes('ob_pregnant') && !planC.includes('hpi_character'), 'injury probes planned; no obstetric or character questions');
  const rc = InterviewService.answer(c.state, 'cc_text', undefined, true);
  check(rc.question?.id === 'hpi_onset', 'skipping free text moves on');
  InterviewService.answer(c.state, 'hpi_onset', 'hours');
  InterviewService.answer(c.state, 'hpi_sudden', 'sudden');
  InterviewService.answer(c.state, 'hpi_severity', 6);
  InterviewService.answer(c.state, 'hpi_timing', 'continuous');
  InterviewService.answer(c.state, 'hpi_worse', ['movement']);
  InterviewService.answer(c.state, 'hpi_better', ['rest']);
  InterviewService.answer(c.state, 'hpi_treated', undefined, true);
  InterviewService.answer(c.state, 'rf_jt_trauma', true);
  const rcs = InterviewService.answer(c.state, 'rf_inj_type', 'snake');
  check(rcs.redFlags.some(f => /snake/i.test(f.label) && f.tier === 'sos'), 'snake bite is an SOS-tier flag');

  console.log('\n--- Housekeeping ---');
  check(purgeInterviews(-1 / 3600) >= 3, 'expired interview states are purged');
  check(loadInterview(a.state.id) === null, 'purged interview no longer loads');
  check(InterviewService.questionBankSize() >= 70, `question bank has ${InterviewService.questionBankSize()} templated questions`);

  const durationMs = performance.now() - t0;
  const ok = passed === total;
  console.log(`\n${ok ? '[PASS]' : '[FAIL]'} Interview engine battery: ${passed}/${total} checks in ${durationMs.toFixed(1)} ms\n`);
  return { passed, total, isPassed: ok, durationMs };
}

if (require.main === module) {
  const r = runInterviewBattery();
  process.exit(r.isPassed ? 0 : 1);
}
