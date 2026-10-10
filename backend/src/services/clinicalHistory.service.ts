/**
 * Structured clinical history (PS Module C): normalisation of whatever the kiosk or the interview
 * engine collected into one `ClinicalHistory`, and a deterministic physician-ready summary in the
 * standard order: chief complaint → HPI → past medical/surgical → drug & allergy → family →
 * personal → review of systems → prior investigations (+ Ayush pariksha when present).
 *
 * The summary distinguishes "denied" from "not asked", carries a completeness score, and is
 * produced from recorded data only (no language model). Hindi text is template-based.
 */

import {
  AllergyItem, ClinicalHistory, DrugHistoryItem, FamilyHistoryItem, HistoryCompleteness, HistoryItem, HistorySummary,
  HistorySummarySection, PersonalHistory, ReviewOfSystems, ROS_SYSTEMS, RosAnswer, SectionStatus, SocratesSymptom
} from '../shared/types';

const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim() && x.trim() !== 'None').map(x => x.trim().slice(0, 80)) : []);
const DENIAL = /^(none|nil|no|nahi|nahin|na|kuch nahi|koi nahi|नहीं|ना|कोई नहीं|कुछ नहीं)[.!]?$/i;
const splitText = (v: unknown): string[] => str(v, 500).split(/[,;।\n]+/).map(s => s.trim()).filter(s => s && !DENIAL.test(s));
/** A typed "none" / "nahi" is a denial, not an item. */
export const isDenialText = (v: unknown): boolean => DENIAL.test(str(v, 100));
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

function cleanItems(v: unknown): HistoryItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x: any) => (typeof x === 'string' ? { name: x } : x)).filter((x: any) => x && str(x.name)).slice(0, 30).map((x: any) => ({
    name: str(x.name, 80), since: str(x.since, 40) || undefined,
    status: oneOf(x.status, ['active', 'resolved', 'controlled', 'uncontrolled', 'unknown'] as const), notes: str(x.notes, 200) || undefined,
    source: oneOf(x.source, ['patient', 'document', 'clinician', 'asha'] as const)
  }));
}

function cleanDrugs(v: unknown): DrugHistoryItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x: any) => (typeof x === 'string' ? { name: x } : x)).filter((x: any) => x && str(x.name)).slice(0, 40).map((x: any) => ({
    name: str(x.name, 80), dose: str(x.dose, 40) || undefined, frequency: str(x.frequency, 40) || undefined, since: str(x.since, 40) || undefined,
    adherence: oneOf(x.adherence, ['regular', 'irregular', 'stopped', 'unknown'] as const), prescribedBy: str(x.prescribedBy, 80) || undefined,
    source: oneOf(x.source, ['patient', 'document', 'clinician', 'asha'] as const)
  }));
}

function cleanAllergies(v: unknown): AllergyItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x: any) => (typeof x === 'string' ? { agent: x } : x)).filter((x: any) => x && str(x.agent)).slice(0, 20).map((x: any) => ({
    agent: str(x.agent, 80), type: oneOf(x.type, ['drug', 'food', 'environment', 'other'] as const), reaction: str(x.reaction, 120) || undefined,
    severity: oneOf(x.severity, ['mild', 'moderate', 'severe', 'unknown'] as const), source: oneOf(x.source, ['patient', 'document', 'clinician', 'asha'] as const)
  }));
}

function cleanFamily(v: unknown): FamilyHistoryItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x: any) => (typeof x === 'string' ? { condition: x } : x)).filter((x: any) => x && str(x.condition)).slice(0, 20)
    .map((x: any) => ({ condition: str(x.condition, 80), relation: str(x.relation, 40) || undefined }));
}

function cleanPersonal(v: any): PersonalHistory {
  if (!v || typeof v !== 'object') return {};
  const out: PersonalHistory = {
    tobacco: oneOf(v.tobacco, ['never', 'current', 'former', 'unknown'] as const),
    tobaccoDetail: str(v.tobaccoDetail, 60) || undefined,
    alcohol: oneOf(v.alcohol, ['never', 'occasional', 'regular', 'former', 'unknown'] as const),
    diet: oneOf(v.diet, ['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan', 'unknown'] as const),
    appetite: oneOf(v.appetite, ['normal', 'reduced', 'increased', 'unknown'] as const),
    bowel: oneOf(v.bowel, ['regular', 'constipation', 'loose', 'irregular', 'unknown'] as const),
    sleep: oneOf(v.sleep, ['normal', 'disturbed', 'reduced', 'unknown'] as const),
    physicalActivity: oneOf(v.physicalActivity, ['sedentary', 'moderate', 'active', 'unknown'] as const),
    occupation: str(v.occupation, 60) || undefined,
    waterSource: str(v.waterSource, 60) || undefined
  };
  for (const k of Object.keys(out) as Array<keyof PersonalHistory>) if (out[k] === undefined) delete out[k];
  return out;
}

function cleanRos(v: any): ReviewOfSystems {
  const out: ReviewOfSystems = {};
  if (!v || typeof v !== 'object') return out;
  for (const sys of ROS_SYSTEMS) {
    const a = oneOf(v[sys], ['present', 'denied', 'not_asked'] as const);
    if (a) out[sys] = a as RosAnswer;
  }
  return out;
}

const sectionStatus = (asked: boolean, answered: boolean): SectionStatus => (!asked ? 'not_asked' : answered ? 'complete' : 'partial');

export function computeCompleteness(h: Omit<ClinicalHistory, 'completeness'>): HistoryCompleteness {
  const sections: Record<string, SectionStatus> = {};
  let asked = 0;
  let answered = 0;
  let skipped = 0;
  const mark = (id: string, wasAsked: boolean, wasAnswered: boolean) => {
    sections[id] = sectionStatus(wasAsked, wasAnswered);
    if (wasAsked) { asked++; if (wasAnswered) answered++; else skipped++; }
  };
  mark('chiefComplaint', true, !!h.chiefComplaint);
  mark('pastMedical', h.pastMedical.length > 0 || h.conditions.length > 0 || (h as any)._askedPastMedical === true, h.pastMedical.length > 0 || h.conditions.length > 0);
  mark('pastSurgical', (h as any)._askedPastSurgical === true || h.pastSurgical.length > 0, h.pastSurgical.length > 0 || (h as any)._deniedPastSurgical === true);
  mark('drugHistory', h.drugHistory.length > 0 || !!h.currentMedicines || (h as any)._askedDrugs === true, h.drugHistory.length > 0 || !!h.currentMedicines || (h as any)._deniedMedicines === true);
  mark('allergies', h.allergyList.length > 0 || !!h.allergies || (h as any)._askedAllergies === true, h.allergyList.length > 0 || !!h.allergies || (h as any)._deniedAllergies === true);
  mark('familyHistory', h.familyHistory.length > 0 || (h as any)._askedFamily === true, h.familyHistory.length > 0 || (h as any)._deniedFamily === true);
  mark('personal', Object.keys(h.personal).length > 0, Object.keys(h.personal).length >= 3);
  const rosAsked = ROS_SYSTEMS.filter(s => h.reviewOfSystems[s] && h.reviewOfSystems[s] !== 'not_asked').length;
  mark('reviewOfSystems', rosAsked > 0, rosAsked >= ROS_SYSTEMS.length);
  const score = asked ? parseFloat((answered / asked).toFixed(2)) : 0;
  return { asked, answered, skipped, score, sections };
}

/**
 * Accepts the legacy kiosk shape ({ conditions, allergies, currentMedicines }), a full v2
 * history, or nothing, and returns a clean ClinicalHistory. Legacy keys are always kept in sync.
 */
export function normaliseHistory(raw: any): ClinicalHistory {
  const r = raw && typeof raw === 'object' ? raw : {};
  const conditions = list(r.conditions);
  const allergiesText = str(r.allergies, 500);
  const medsText = str(r.currentMedicines, 500);

  const pastMedical = cleanItems(r.pastMedical);
  for (const c of conditions) if (!pastMedical.some(p => p.name.toLowerCase() === c.toLowerCase())) pastMedical.push({ name: c, source: 'patient' });
  const allergyList = cleanAllergies(r.allergyList);
  for (const a of splitText(allergiesText)) if (!allergyList.some(x => x.agent.toLowerCase() === a.toLowerCase())) allergyList.push({ agent: a, source: 'patient' });
  const drugHistory = cleanDrugs(r.drugHistory);
  for (const m of splitText(medsText)) if (!drugHistory.some(x => x.name.toLowerCase() === m.toLowerCase())) drugHistory.push({ name: m, source: 'patient' });

  const allergyStatus = (['none', 'unknown', 'listed'] as const).find(x => x === r.allergyStatus) || (isDenialText(allergiesText) ? 'none' : undefined);
  const medicineStatus = (['none', 'unknown', 'listed'] as const).find(x => x === r.medicineStatus) || (isDenialText(medsText) ? 'none' : undefined);
  const mentioned = r.mentionedInSpeech && typeof r.mentionedInSpeech === 'object' ? { conditions: list(r.mentionedInSpeech.conditions), medicines: list(r.mentionedInSpeech.medicines) } : undefined;
  const base = {
    version: 2 as const,
    allergyStatus,
    medicineStatus,
    mentionedInSpeech: mentioned && (mentioned.conditions.length || mentioned.medicines.length) ? mentioned : undefined,
    chiefComplaint: str(r.chiefComplaint, 200) || undefined,
    conditions: Array.from(new Set([...conditions, ...pastMedical.map(p => p.name)])),
    allergies: isDenialText(allergiesText) ? '' : allergiesText || allergyList.map(a => a.agent).join(', '),
    currentMedicines: isDenialText(medsText) ? '' : medsText || drugHistory.map(d => d.name).join(', '),
    pastMedical,
    pastSurgical: cleanItems(r.pastSurgical),
    drugHistory,
    allergyList,
    familyHistory: cleanFamily(r.familyHistory),
    personal: cleanPersonal(r.personal),
    reviewOfSystems: cleanRos(r.reviewOfSystems),
    obstetric: r.obstetric && typeof r.obstetric === 'object' ? {
      isPregnant: r.obstetric.isPregnant === true, gestationalWeeks: Number(r.obstetric.gestationalWeeks) || undefined,
      gravida: Number(r.obstetric.gravida) || undefined, para: Number(r.obstetric.para) || undefined, lmp: str(r.obstetric.lmp, 20) || undefined, isLactating: r.obstetric.isLactating === true
    } : undefined,
    immunisation: list(r.immunisation).length ? list(r.immunisation) : undefined,
    ayush: r.ayush && typeof r.ayush === 'object' ? r.ayush : undefined,
    interviewId: str(r.interviewId, 64) || undefined
  };
  const flags: any = { _askedPastMedical: Array.isArray(r.conditions) || r.askedSections?.pastMedical === true, _askedPastSurgical: r.askedSections?.pastSurgical === true,
    _askedDrugs: typeof r.currentMedicines === 'string' || r.askedSections?.drugHistory === true, _askedAllergies: typeof r.allergies === 'string' || r.askedSections?.allergies === true,
    _askedFamily: r.askedSections?.familyHistory === true,
    // Explicit denials come from the interview (answered 'none' / 'no'); a blank kiosk text box is not a denial.
    _deniedAllergies: r.deniedSections?.allergies === true || allergyStatus === 'none', _deniedMedicines: medicineStatus === 'none', _deniedFamily: r.deniedSections?.familyHistory === true, _deniedPastSurgical: r.deniedSections?.pastSurgical === true };
  const completeness = r.completeness && typeof r.completeness === 'object' && Number.isFinite(r.completeness.asked)
    ? r.completeness as HistoryCompleteness
    : computeCompleteness({ ...base, ...flags });
  return { ...base, completeness };
}

// ---------------------------------------------------------------- Summary

const HI: Record<string, string> = {
  chiefComplaint: 'मुख्य शिकायत', hpi: 'वर्तमान बीमारी का इतिहास', pastMedical: 'पुरानी बीमारियाँ', pastSurgical: 'पूर्व शल्य-चिकित्सा',
  drugAllergy: 'दवाइयाँ और एलर्जी', family: 'पारिवारिक इतिहास', personal: 'व्यक्तिगत आदतें', ros: 'अंग-प्रणाली समीक्षा', investigations: 'पूर्व जाँचें',
  ayush: 'आयुर्वेदीय परीक्षा', vitals: 'जीवन-चिह्न',
  notAsked: 'नहीं पूछा गया', denied: 'नकारा', none: 'कोई नहीं', present: 'उपस्थित',
  never: 'कभी नहीं', current: 'वर्तमान में', former: 'पहले', occasional: 'कभी-कभी', regular: 'नियमित', unknown: 'अज्ञात',
  vegetarian: 'शाकाहारी', non_vegetarian: 'मांसाहारी', eggetarian: 'अंडा-शाकाहारी', vegan: 'वीगन', normal: 'सामान्य', reduced: 'कम', increased: 'अधिक',
  constipation: 'कब्ज़', loose: 'पतले दस्त', irregular: 'अनियमित', disturbed: 'बाधित', sedentary: 'बैठे रहने वाला', moderate: 'मध्यम', active: 'सक्रिय'
};
const hi = (k: string) => HI[k] || k;
const ROS_HI: Record<string, string> = {
  constitutional: 'सामान्य', cardiovascular: 'हृदय', respiratory: 'श्वसन', gastrointestinal: 'पाचन', genitourinary: 'मूत्र-जनन',
  musculoskeletal: 'हड्डी-जोड़', neurological: 'तंत्रिका', dermatological: 'त्वचा', psychiatric: 'मानसिक', endocrine: 'अंतःस्रावी'
};

export interface SummaryInput {
  patient: { name?: string; age?: number; gender?: string; isPregnant?: boolean; gestationalWeeks?: number; isLactating?: boolean };
  symptoms: SocratesSymptom[] | any[];
  history: ClinicalHistory;
  vitals?: Record<string, any> | null;
  pariksha?: Record<string, any> | null;
  documents?: Array<{ documentType?: string; recordedDate?: string; createdAt?: string; extractedMedications?: any[]; extractedLabMarkers?: any[]; extractedDiagnoses?: any[] }>;
  rawTranscript?: string | null;
}

function symptomLine(s: any): string {
  const name = s.name || s.symptom_name || 'Complaint';
  const parts = [name];
  if (s.site && !/^(general|unspecified)$/i.test(s.site)) parts.push(`at ${s.site}`);
  if (s.onset && !/unspecified/i.test(s.onset)) parts.push(`since ${s.onset}`);
  if (s.character) parts.push(`(${s.character})`);
  if (s.radiation) parts.push(`radiating to ${s.radiation}`);
  if (s.severityScore !== undefined || s.severity !== undefined) {
    const sev = Number(s.severityScore ?? s.severity);
    if (Number.isFinite(sev) && sev > 0) parts.push(`severity ${sev}/10`);
  }
  if (s.timing) parts.push(`timing ${s.timing}`);
  if (s.exacerbating) parts.push(`worse with ${s.exacerbating}`);
  if (s.relieving) parts.push(`better with ${s.relieving}`);
  if (Array.isArray(s.associated) && s.associated.length) parts.push(`associated: ${s.associated.join(', ')}`);
  return parts.join(' ');
}

export function buildHistorySummary(input: SummaryInput): HistorySummary {
  const h = input.history;
  const sections: HistorySummarySection[] = [];
  const st = h.completeness.sections;
  const add = (id: string, title: string, text: string, textHi: string, status: SectionStatus) => sections.push({ id, title, titleHi: hi(id), text, textHi, status });

  const present = (input.symptoms || []).filter((s: any) => s && !s.isNegated);
  const denied = (input.symptoms || []).filter((s: any) => s && s.isNegated).map((s: any) => s.name || s.symptom_name);
  const cc = h.chiefComplaint || (present[0] ? symptomLine(present[0]) : '');
  add('chiefComplaint', 'Chief complaint', cc || 'Not recorded.', cc ? cc : 'दर्ज नहीं।', cc ? 'complete' : 'not_asked');

  const hpi = present.map(symptomLine);
  const hpiText = [hpi.length ? hpi.join('; ') + '.' : 'No presenting complaints recorded.', denied.length ? `Denies: ${denied.join(', ')}.` : ''].filter(Boolean).join(' ');
  add('hpi', 'History of present illness', hpiText, hpi.length ? `${hpi.join('; ')}।${denied.length ? ` ${hi('denied')}: ${denied.join(', ')}।` : ''}` : 'कोई शिकायत दर्ज नहीं।', hpi.length ? 'complete' : 'not_asked');

  const pm = h.pastMedical.map(p => `${p.name}${p.since ? ` (since ${p.since})` : ''}${p.status && p.status !== 'unknown' ? `, ${p.status}` : ''}`);
  add('pastMedical', 'Past medical history', st.pastMedical === 'not_asked' ? 'Not asked.' : pm.length ? pm.join('; ') + '.' : st.pastMedical === 'partial' ? 'Asked at the kiosk, not answered.' : 'No known chronic illness (patient denies).',
    st.pastMedical === 'not_asked' ? hi('notAsked') : pm.length ? pm.join('; ') + '।' : st.pastMedical === 'partial' ? 'पूछा गया, उत्तर नहीं मिला।' : 'कोई पुरानी बीमारी नहीं (मरीज़ ने नकारा)।', st.pastMedical);

  const ps = h.pastSurgical.map(p => `${p.name}${p.since ? ` (${p.since})` : ''}`);
  add('pastSurgical', 'Past surgical history', st.pastSurgical === 'not_asked' ? 'Not asked.' : ps.length ? ps.join('; ') + '.' : st.pastSurgical === 'partial' ? 'Asked, not answered.' : 'No previous surgery (patient denies).',
    st.pastSurgical === 'not_asked' ? hi('notAsked') : ps.length ? ps.join('; ') + '।' : st.pastSurgical === 'partial' ? 'पूछा गया, उत्तर नहीं मिला।' : 'कोई शल्य-चिकित्सा नहीं।', st.pastSurgical);

  const drugs = h.drugHistory.map(d => [d.name, d.dose, d.frequency, d.adherence && d.adherence !== 'unknown' ? `(${d.adherence})` : ''].filter(Boolean).join(' '));
  const allergies = h.allergyList.map(a => `${a.agent}${a.reaction ? `: ${a.reaction}` : ''}${a.severity && a.severity !== 'unknown' ? ` (${a.severity})` : ''}`);
  const drugText = [
    st.drugHistory === 'not_asked' ? 'Current medicines: not asked.' : drugs.length ? `Current medicines: ${drugs.join('; ')}.` : st.drugHistory === 'partial' ? 'Current medicines: asked, not answered.' : 'No current medicines (patient denies).',
    st.allergies === 'not_asked' ? 'Allergies: not asked.' : allergies.length ? `ALLERGIES: ${allergies.join('; ')}.` : st.allergies === 'partial' ? 'Allergies: asked, not answered. Confirm before prescribing.' : 'No known allergies (patient denies).'
  ].join(' ');
  const drugStatus: SectionStatus = st.drugHistory === 'not_asked' && st.allergies === 'not_asked' ? 'not_asked' : st.drugHistory === 'complete' && st.allergies === 'complete' ? 'complete' : 'partial';
  add('drugAllergy', 'Drug and allergy history', drugText,
    `${drugs.length ? `वर्तमान दवाइयाँ: ${drugs.join('; ')}।` : st.drugHistory === 'not_asked' ? `दवाइयाँ: ${hi('notAsked')}।` : 'कोई दवा नहीं।'} ${allergies.length ? `एलर्जी: ${allergies.join('; ')}।` : st.allergies === 'not_asked' ? `एलर्जी: ${hi('notAsked')}।` : 'कोई एलर्जी नहीं।'}`, drugStatus);

  const fam = h.familyHistory.map(f => `${f.condition}${f.relation ? ` (${f.relation})` : ''}`);
  add('family', 'Family history', st.familyHistory === 'not_asked' ? 'Not asked.' : fam.length ? fam.join('; ') + '.' : st.familyHistory === 'partial' ? 'Asked, not answered.' : 'Nothing significant (patient denies).',
    st.familyHistory === 'not_asked' ? hi('notAsked') : fam.length ? fam.join('; ') + '।' : 'कुछ विशेष नहीं।', st.familyHistory);

  const p = h.personal;
  const personalParts: string[] = [];
  const personalHi: string[] = [];
  if (p.tobacco) { personalParts.push(`tobacco: ${p.tobacco}${p.tobaccoDetail ? ` (${p.tobaccoDetail})` : ''}`); personalHi.push(`तम्बाकू: ${hi(p.tobacco)}`); }
  if (p.alcohol) { personalParts.push(`alcohol: ${p.alcohol}`); personalHi.push(`शराब: ${hi(p.alcohol)}`); }
  if (p.diet) { personalParts.push(`diet: ${p.diet.replace('_', '-')}`); personalHi.push(`आहार: ${hi(p.diet)}`); }
  if (p.appetite) { personalParts.push(`appetite: ${p.appetite}`); personalHi.push(`भूख: ${hi(p.appetite)}`); }
  if (p.bowel) { personalParts.push(`bowel: ${p.bowel}`); personalHi.push(`मल: ${hi(p.bowel)}`); }
  if (p.sleep) { personalParts.push(`sleep: ${p.sleep}`); personalHi.push(`नींद: ${hi(p.sleep)}`); }
  if (p.physicalActivity) { personalParts.push(`activity: ${p.physicalActivity}`); personalHi.push(`गतिविधि: ${hi(p.physicalActivity)}`); }
  if (p.occupation) { personalParts.push(`occupation: ${p.occupation}`); personalHi.push(`व्यवसाय: ${p.occupation}`); }
  add('personal', 'Personal and social history (Ahara-Vihara)', personalParts.length ? personalParts.join('; ') + '.' : 'Not asked.', personalHi.length ? personalHi.join('; ') + '।' : hi('notAsked'), st.personal);

  const rosPresent = ROS_SYSTEMS.filter(s => h.reviewOfSystems[s] === 'present');
  const rosDenied = ROS_SYSTEMS.filter(s => h.reviewOfSystems[s] === 'denied');
  const rosNot = ROS_SYSTEMS.filter(s => !h.reviewOfSystems[s] || h.reviewOfSystems[s] === 'not_asked');
  const rosText = [rosPresent.length ? `Positive: ${rosPresent.join(', ')}.` : '', rosDenied.length ? `Denied: ${rosDenied.join(', ')}.` : '', rosNot.length ? `Not asked: ${rosNot.join(', ')}.` : ''].filter(Boolean).join(' ') || 'Not asked.';
  add('ros', 'Review of systems', rosText,
    [rosPresent.length ? `${hi('present')}: ${rosPresent.map(s => ROS_HI[s]).join(', ')}।` : '', rosDenied.length ? `${hi('denied')}: ${rosDenied.map(s => ROS_HI[s]).join(', ')}।` : '', rosNot.length ? `${hi('notAsked')}: ${rosNot.map(s => ROS_HI[s]).join(', ')}।` : ''].filter(Boolean).join(' ') || hi('notAsked'), st.reviewOfSystems);

  const docs = (input.documents || []).slice().sort((a, b) => String(b.recordedDate || b.createdAt || '').localeCompare(String(a.recordedDate || a.createdAt || '')));
  const invLines: string[] = [];
  for (const d of docs) {
    const date = (d.recordedDate || d.createdAt || '').slice(0, 10);
    const abnormal = (d.extractedLabMarkers || []).filter((m: any) => m?.isAbnormal).map((m: any) => `${m.testName} ${m.value}${m.unit ? ` ${m.unit}` : ''} (${m.flag || 'abnormal'})`);
    const meds = (d.extractedMedications || []).slice(0, 6).map((m: any) => (typeof m === 'string' ? m : m?.name || '')).filter(Boolean);
    const dx = (d.extractedDiagnoses || []).slice(0, 4).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
    const bits = [abnormal.length ? `abnormal: ${abnormal.join(', ')}` : '', dx.length ? `diagnoses: ${dx.join(', ')}` : '', meds.length ? `medicines: ${meds.join(', ')}` : ''].filter(Boolean);
    invLines.push(`${date || 'undated'} ${String(d.documentType || 'document').replace(/_/g, ' ').toLowerCase()}${bits.length ? `: ${bits.join('; ')}` : ''}`);
  }
  add('investigations', 'Prior investigations and documents', invLines.length ? invLines.join('. ') + '.' : 'No prior documents scanned.', invLines.length ? invLines.join('। ') + '।' : 'कोई पुराना दस्तावेज़ नहीं।', invLines.length ? 'complete' : 'not_asked');

  const pk = input.pariksha || h.ayush?.pariksha;
  if (pk && (pk.prakriti || pk.agni || pk.koshtha || pk.sara)) {
    const parts = [pk.prakriti && `Prakriti ${pk.prakriti}`, pk.vikriti && `Vikriti ${pk.vikriti}`, pk.agni && `Agni ${pk.agni}`, pk.koshtha && `Koshtha ${pk.koshtha}`, pk.sara && `Sara ${pk.sara}`, pk.satmya && `Satmya ${pk.satmya}`, pk.sattva && `Sattva ${pk.sattva}`, pk.vyayamaShakti && `Vyayama shakti ${pk.vyayamaShakti}`, pk.amaPresent !== undefined && `Ama ${pk.amaPresent ? 'present' : 'absent'}`].filter(Boolean) as string[];
    add('ayush', 'Dashavidha Pariksha (self-assessed)', parts.join('; ') + '.', parts.join('; ') + '।', 'complete');
  }

  const v = input.vitals || {};
  const vit = [v.bp && `BP ${v.bp}`, v.pulse && `pulse ${v.pulse}/min`, v.spo2 && `SpO2 ${String(v.spo2).replace('%', '')}%`, v.temp && `temperature ${v.temp}`, v.respiratoryRate && `RR ${v.respiratoryRate}/min`, v.bloodSugar && `glucose ${v.bloodSugar}`].filter(Boolean).join(', ');
  const vitSrc = v.source === 'clinician' ? `measured by ${v.recordedBy || 'staff'}` : 'patient-reported, unverified';
  add('vitals', 'Vitals', vit ? `${vit} (${vitSrc})${v.news2 ? `; NEWS2 ${v.news2.news2 ?? v.news2}` : ''}.` : 'Not recorded.', vit ? `${vit} (${v.source === 'clinician' ? 'स्टाफ द्वारा मापा' : 'मरीज़ द्वारा बताया, असत्यापित'})।` : 'दर्ज नहीं।', vit ? 'complete' : 'not_asked');

  const demo = [input.patient.name, input.patient.age !== undefined ? `${input.patient.age} y` : '', input.patient.gender ? String(input.patient.gender).toLowerCase() : '', input.patient.isPregnant ? `pregnant${input.patient.gestationalWeeks ? ` ${input.patient.gestationalWeeks} wk` : ''}` : '', input.patient.isLactating ? 'lactating' : ''].filter(Boolean).join(', ');
  const text = [demo ? `${demo}.` : '', ...sections.map(s => `${s.title}: ${s.text}`)].filter(Boolean).join('\n');
  const textHi = [demo ? `${demo}।` : '', ...sections.map(s => `${s.titleHi}: ${s.textHi}`)].filter(Boolean).join('\n');
  return { generatedAt: new Date().toISOString(), method: 'deterministic-template', language: ['en', 'hi'], sections, text, textHi, completeness: h.completeness };
}
