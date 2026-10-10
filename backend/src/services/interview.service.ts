/**
 * Adaptive clinical-history interview (PS Module A): a deterministic dialogue manager driven by
 * shared/interview_ontology.json.
 *
 *  - The plan (ordered list of question ids) is recomputed from the answers so far: the HPI and
 *    red-flag branches follow the chief-complaint family; `showIf` gates skip questions that do
 *    not apply (e.g. obstetric questions for men); Ayush questions appear for the Ayurveda stream.
 *  - Every answer is mapped into the structured ClinicalHistory; asked / answered / skipped are
 *    recorded so the completeness score is real.
 *  - Red flags are rules on answers; the kiosk shows the SOS banner and the server records them.
 *  - State is encrypted at rest and expires with the draft retention window.
 *
 * No language model is involved; every question is a template in the ontology.
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { encryptField, decryptField } from '../security/fieldCrypto';
import ontology from '../shared/interview_ontology.json';
import { ClinicalHistory, SocratesSymptom } from '../shared/types';
import { normaliseHistory } from './clinicalHistory.service';

db.exec(`
  CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    state_enc TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_interview_updated ON interview_sessions(updated_at);
`);

type Lang = 'en' | 'hi';
export interface QuestionOption { value: string; en: string; hi: string }
export interface Question {
  section: string;
  type: 'single' | 'multi' | 'yesno' | 'number' | 'text' | 'scale';
  text: Record<string, string>;
  options?: QuestionOption[];
  optionsFrom?: 'complaintFamilies';
  maps: string;
  families?: string[];
  careStream?: string;
  showIf?: any;
  optional?: boolean;
  required?: boolean;
  voice?: boolean;
  sensitive?: boolean;
  min?: number;
  max?: number;
  redFlag?: { anyOf?: string[]; allOf?: string[]; equals?: boolean; label: string; tier: 'sos' | 'urgent' };
  redFlag2?: { anyOf?: string[]; allOf?: string[]; equals?: boolean; label: string; tier: 'sos' | 'urgent' };
}

export interface InterviewPatient { age?: number | null; gender?: string | null; isPregnant?: boolean | null }
export interface InterviewState {
  id: string;
  language: Lang;
  careStream: 'AYURVEDA' | 'ALLOPATHY' | 'UNDECIDED';
  patient: InterviewPatient;
  /** 'kiosk': the short walk-in set (about 12-18 questions); 'full': every section (clinician-assisted). */
  scope: 'kiosk' | 'full';
  answers: Record<string, any>;
  asked: string[];
  skipped: string[];
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface RedFlagHit { questionId: string; label: string; tier: 'sos' | 'urgent' }

export interface PresentedQuestion {
  id: string;
  section: string;
  type: Question['type'];
  text: string;
  textEn: string;
  textHi: string;
  options?: Array<{ value: string; label: string; labelEn: string; labelHi: string }>;
  optional: boolean;
  voice: boolean;
  min?: number;
  max?: number;
  progress: { answered: number; planned: number; section: string; sectionIndex: number; sectionCount: number };
}

const Q = ontology.questions as Record<string, Question>;
const FAMILIES = ontology.complaintFamilies as Array<{ id: string; en: string; hi: string; symptom: string; site: string }>;
const SECTION_ORDER = ontology.sectionOrder as string[];

function visible(q: Question, state: InterviewState): boolean {
  const fam = state.answers.cc_family as string | undefined;
  if (q.families && !q.families.includes(fam || '')) return false;
  if (q.careStream && q.careStream !== state.careStream) return false;
  const c = q.showIf;
  if (!c) return true;
  if (c.patient) {
    const g = String(state.patient.gender || '').toUpperCase();
    if (c.patient.pregnancyUnknown && state.patient.isPregnant !== null && state.patient.isPregnant !== undefined) return false;
    if (c.patient.gender && g !== c.patient.gender) return false;
    if (c.patient.ageBetween) {
      const a = Number(state.patient.age);
      if (!Number.isFinite(a) || a < c.patient.ageBetween[0] || a > c.patient.ageBetween[1]) return false;
    }
  }
  if (c.question) {
    const v = state.answers[c.question];
    if (c.equals !== undefined && v !== c.equals) return false;
    if (c.anyOf && !(Array.isArray(v) ? v.some((x: string) => c.anyOf.includes(x)) : c.anyOf.includes(v))) return false;
    if (c.nonEmpty && !(typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length : v)) return false;
    if (c.notOnly && (v === undefined || (Array.isArray(v) && v.length === 1 && v[0] === c.notOnly) || v === c.notOnly)) return false;
  }
  return true;
}

/** Ordered question ids given the answers so far. */
const KIOSK_SECTIONS = new Set(['chiefComplaint', 'hpi', 'redFlags', 'pastMedical', 'drugHistory', 'allergies', 'obstetric', 'ros']);
const KIOSK_SKIP = new Set(['hpi_treated', 'pmh_other', 'pmh_control', 'drug_adherence', 'allergy_severity', 'ob_lmp', 'ob_lactating']);

export function planFor(state: InterviewState): string[] {
  const out: string[] = [];
  const kiosk = (state.scope || 'full') === 'kiosk';
  for (const section of SECTION_ORDER) {
    if (kiosk && !KIOSK_SECTIONS.has(section)) continue;
    for (const [id, q] of Object.entries(Q)) {
      if (q.section !== section) continue;
      if (kiosk && KIOSK_SKIP.has(id)) continue;
      if (kiosk ? id.startsWith('ros_') && id !== 'ros_any' : id === 'ros_any') continue;
      if (id !== 'cc_family' && !state.answers.cc_family) continue; // nothing before the chief complaint
      if (visible(q, state)) out.push(id);
    }
  }
  return out;
}

function present(id: string, state: InterviewState, plan: string[]): PresentedQuestion {
  const q = Q[id];
  const lang = state.language;
  const opts = q.optionsFrom === 'complaintFamilies'
    ? FAMILIES.map(f => ({ value: f.id, label: f[lang], labelEn: f.en, labelHi: f.hi }))
    : q.options?.map(o => ({ value: o.value, label: o[lang], labelEn: o.en, labelHi: o.hi }));
  const answered = plan.filter(p => p in state.answers || state.skipped.includes(p)).length;
  const sectionIndex = SECTION_ORDER.indexOf(q.section);
  return {
    id, section: q.section, type: q.type, text: q.text[lang] || q.text.en, textEn: q.text.en, textHi: q.text.hi,
    options: opts, optional: !!q.optional, voice: !!q.voice, min: q.min, max: q.max,
    progress: { answered, planned: plan.length, section: q.section, sectionIndex, sectionCount: SECTION_ORDER.length }
  };
}

function validateAnswer(q: Question, value: any): any {
  switch (q.type) {
    case 'yesno': if (typeof value !== 'boolean') throw new Error('Answer must be true or false'); return value;
    case 'single': {
      const allowed = (q.optionsFrom === 'complaintFamilies' ? FAMILIES.map(f => f.id) : (q.options || []).map(o => o.value));
      if (!allowed.includes(value)) throw new Error('Answer must be one of the offered options'); return value;
    }
    case 'multi': {
      const allowed = (q.options || []).map(o => o.value);
      const arr = Array.isArray(value) ? value : [value];
      if (!arr.length || !arr.every(v => allowed.includes(v))) throw new Error('Answer must be a list of offered options');
      return Array.from(new Set(arr));
    }
    case 'number': case 'scale': {
      const n = Number(value);
      if (!Number.isFinite(n) || (q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max)) throw new Error(`Answer must be a number${q.min !== undefined ? ` between ${q.min} and ${q.max}` : ''}`);
      return n;
    }
    case 'text': default: {
      const s = String(value ?? '').trim().slice(0, 500);
      if (!s && !q.optional) throw new Error('Answer cannot be empty');
      return s;
    }
  }
}

export function redFlagsFor(state: InterviewState): RedFlagHit[] {
  const hits: RedFlagHit[] = [];
  for (const [id, v] of Object.entries(state.answers)) {
    const q = Q[id];
    if (!q) continue;
    for (const rule of [q.redFlag, q.redFlag2]) {
      if (!rule) continue;
      const arr = Array.isArray(v) ? v : [v];
      const hit = (rule.equals !== undefined && v === rule.equals) || (rule.anyOf && arr.some((x: string) => rule.anyOf!.includes(x))) || (rule.allOf && rule.allOf.every(x => arr.includes(x)));
      if (hit) hits.push({ questionId: id, label: rule.label, tier: rule.tier });
    }
  }
  return hits;
}

const ONSET: Record<string, string> = { hours: 'a few hours', '1-3d': '1-3 days', '4-7d': '4-7 days', weeks: 'a few weeks', months: 'months' };
const CHARACTER: Record<string, string> = { sharp: 'Sharp / stabbing', dull: 'Dull aching', burning: 'Burning', pressure: 'Pressure / heaviness', cramping: 'Colicky', throbbing: 'Throbbing' };

/** Build the structured history and the SOCRATES symptom from the answers. */
export function historyFrom(state: InterviewState): { history: ClinicalHistory; symptoms: SocratesSymptom[]; redFlags: RedFlagHit[]; suggestedPriority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE' } {
  const a = state.answers;
  const fam = FAMILIES.find(f => f.id === a.cc_family);
  const asked = new Set(state.asked);
  const sectionsAsked = (section: string) => Object.entries(Q).some(([id, q]) => q.section === section && asked.has(id));

  const pastMedical = (Array.isArray(a.pmh_conditions) ? a.pmh_conditions : []).filter((c: string) => c !== 'none').map((c: string) => ({ name: c, status: a.pmh_control || undefined, source: 'patient' as const }));
  if (typeof a.pmh_other === 'string' && a.pmh_other) for (const c of a.pmh_other.split(/[,;।]+/)) if (c.trim()) pastMedical.push({ name: c.trim().slice(0, 80), status: undefined, source: 'patient' });
  const pastSurgical = a.psh_any === true && typeof a.psh_detail === 'string' && a.psh_detail ? [{ name: a.psh_detail.slice(0, 120), source: 'patient' as const }] : [];
  const denial = (v: unknown) => typeof v === 'string' && /^(none|nil|no|nahi|nahin|na|kuch nahi|koi nahi|नहीं|ना|कोई नहीं|कुछ नहीं)[.!]?$/i.test(v.trim());
  const drugHistory = [
    ...(typeof a.drug_current === 'string' && !denial(a.drug_current) ? a.drug_current.split(/[,;।\n]+/).map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ name: name.slice(0, 80), adherence: a.drug_adherence || undefined, source: 'patient' as const })) : []),
    ...(a.drug_ayush === true && typeof a.drug_ayush_detail === 'string' ? a.drug_ayush_detail.split(/[,;।\n]+/).map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ name: name.slice(0, 80), source: 'patient' as const })) : [])
  ];
  const allergyList = a.allergy_any === true && typeof a.allergy_detail === 'string' && a.allergy_detail && !denial(a.allergy_detail)
    ? [{ agent: a.allergy_detail.slice(0, 120), severity: a.allergy_severity || 'unknown', source: 'patient' as const }] : [];
  const familyHistory = (Array.isArray(a.fam_conditions) ? a.fam_conditions : []).filter((c: string) => c !== 'none').map((c: string) => ({ condition: c, relation: 'first-degree relative' }));
  const personal: any = {
    tobacco: a.per_tobacco, tobaccoDetail: Array.isArray(a.per_tobacco_type) ? a.per_tobacco_type.join(', ') : undefined, alcohol: a.per_alcohol, diet: a.per_diet,
    appetite: a.per_appetite, bowel: a.per_bowel, sleep: a.per_sleep, physicalActivity: a.per_activity, occupation: a.per_occupation || undefined
  };
  const reviewOfSystems: Record<string, 'present' | 'denied' | 'not_asked'> = {};
  for (const sys of ['constitutional', 'cardiovascular', 'respiratory', 'gastrointestinal', 'genitourinary', 'musculoskeletal', 'neurological', 'dermatological', 'psychiatric', 'endocrine']) {
    const id = `ros_${sys}`;
    if (Array.isArray(a.ros_any)) reviewOfSystems[sys] = a.ros_any.includes(sys) ? 'present' : 'denied';
    else reviewOfSystems[sys] = a[id] === true ? 'present' : a[id] === false ? 'denied' : 'not_asked';
  }
  const obstetric = a.ob_pregnant !== undefined || a.ob_lactating !== undefined
    ? { isPregnant: a.ob_pregnant === true, gestationalWeeks: Number(a.ob_weeks) || undefined, isLactating: a.ob_lactating === true, lmp: a.ob_lmp || undefined } : undefined;
  const ayush = a.ay_agni || a.ay_koshtha || a.ay_ama !== undefined
    ? { pariksha: { agni: a.ay_agni, koshtha: a.ay_koshtha, amaPresent: a.ay_ama === true }, aharaVihara: { sleep: a.ay_sleep_time, diet: a.per_diet } } : undefined;

  const chief = [fam ? fam.en : '', typeof a.cc_text === 'string' ? a.cc_text : ''].filter(Boolean).join(': ');
  const history = normaliseHistory({
    chiefComplaint: chief || undefined,
    conditions: pastMedical.map(p => p.name), allergies: allergyList.map(x => x.agent).join(', '), currentMedicines: drugHistory.map(d => d.name).join(', '),
    pastMedical, pastSurgical, drugHistory, allergyList, familyHistory, personal, reviewOfSystems, obstetric, ayush, interviewId: state.id,
    askedSections: { pastMedical: sectionsAsked('pastMedical'), pastSurgical: sectionsAsked('pastSurgical'), drugHistory: sectionsAsked('drugHistory'), allergies: sectionsAsked('allergies'), familyHistory: sectionsAsked('familyHistory') },
    allergyStatus: a.allergy_any === false || denial(a.allergy_detail) ? 'none' : allergyList.length ? 'listed' : undefined,
    medicineStatus: denial(a.drug_current) ? 'none' : drugHistory.length ? 'listed' : undefined,
    deniedSections: { allergies: a.allergy_any === false || denial(a.allergy_detail), familyHistory: Array.isArray(a.fam_conditions) && a.fam_conditions.length === 1 && a.fam_conditions[0] === 'none', pastSurgical: a.psh_any === false }
  });
  // Completeness from the real interview log.
  const plan = planFor(state);
  const answered = plan.filter(p => p in state.answers).length;
  const skipped = plan.filter(p => state.skipped.includes(p)).length;
  history.completeness = { ...history.completeness, asked: plan.length, answered, skipped, score: plan.length ? parseFloat((answered / plan.length).toFixed(2)) : 0 };

  const assoc: string[] = [];
  for (const id of ['rf_cp_assoc', 'rf_ab_severe', 'rf_jt_swelling', 'rf_ur_symptoms', 'rf_skin_spread', 'rf_dz_syncope', 'rf_pg_bleed']) if (Array.isArray(a[id])) assoc.push(...a[id].filter((x: string) => x !== 'none'));
  const symptoms: SocratesSymptom[] = fam ? [{
    name: fam.symptom, symptom_name: fam.symptom, rawVernacular: typeof a.cc_text === 'string' ? a.cc_text : undefined,
    site: a.rf_ab_site ? String(a.rf_ab_site).replace('_', ' ') : fam.site,
    onset: a.hpi_onset ? `${ONSET[a.hpi_onset] || a.hpi_onset}${a.hpi_sudden ? ` (${a.hpi_sudden})` : ''}` : 'Unspecified',
    character: a.hpi_character ? CHARACTER[a.hpi_character] || a.hpi_character : undefined,
    radiation: Array.isArray(a.rf_cp_radiation) ? a.rf_cp_radiation.filter((x: string) => x !== 'none').join(', ') || undefined : undefined,
    associated: assoc.length ? assoc : undefined,
    timing: a.hpi_timing || undefined,
    exacerbating: Array.isArray(a.hpi_worse) ? a.hpi_worse.filter((x: string) => x !== 'nothing').join(', ') || undefined : undefined,
    relieving: Array.isArray(a.hpi_better) ? a.hpi_better.filter((x: string) => x !== 'nothing').join(', ') || undefined : undefined,
    severity: Number(a.hpi_severity) || 5, severityScore: Number(a.hpi_severity) || 5, isNegated: false
  }] : [];
  const redFlags = redFlagsFor(state);
  const suggestedPriority = redFlags.some(r => r.tier === 'sos') ? 'EMERGENCY_RED_FLAG' : redFlags.length ? 'HIGH_PRIORITY' : 'ROUTINE';
  return { history, symptoms, redFlags, suggestedPriority };
}

// ---------------------------------------------------------------- Persistence

function save(state: InterviewState): void {
  state.updatedAt = new Date().toISOString();
  db.prepare(`INSERT INTO interview_sessions (id, state_enc, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET state_enc = excluded.state_enc, updated_at = excluded.updated_at`)
    .run(state.id, encryptField(JSON.stringify(state)), state.startedAt, state.updatedAt);
}

export function loadInterview(id: string): InterviewState | null {
  const row: any = db.prepare('SELECT state_enc FROM interview_sessions WHERE id = ?').get(id);
  const plain = row ? decryptField(row.state_enc) : null;
  return plain ? (JSON.parse(plain) as InterviewState) : null;
}

export function purgeInterviews(olderThanHours: number): number {
  return db.prepare('DELETE FROM interview_sessions WHERE updated_at <= ?').run(new Date(Date.now() - olderThanHours * 3600000).toISOString()).changes;
}

export const InterviewService = {
  start(input: { language?: string; careStream?: string; patient?: InterviewPatient; scope?: 'kiosk' | 'full' }): { state: InterviewState; question: PresentedQuestion } {
    const state: InterviewState = {
      id: `iv-${crypto.randomBytes(8).toString('hex')}`,
      language: input.language === 'hi' ? 'hi' : 'en',
      careStream: input.careStream === 'AYURVEDA' || input.careStream === 'ALLOPATHY' ? input.careStream : 'UNDECIDED',
      patient: { age: Number.isFinite(Number(input.patient?.age)) ? Number(input.patient!.age) : null, gender: input.patient?.gender ? String(input.patient.gender).toUpperCase() : null, isPregnant: input.patient?.isPregnant === true ? true : input.patient?.isPregnant === false ? false : null },
      scope: input.scope === 'kiosk' ? 'kiosk' : 'full',
      answers: {}, asked: ['cc_family'], skipped: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    save(state);
    return { state, question: present('cc_family', state, planFor(state)) };
  },

  next(state: InterviewState): PresentedQuestion | null {
    const plan = planFor(state);
    const id = plan.find(p => !(p in state.answers) && !state.skipped.includes(p));
    if (!id) return null;
    if (!state.asked.includes(id)) { state.asked.push(id); save(state); }
    return present(id, state, plan);
  },

  answer(state: InterviewState, questionId: string, value: any, skip = false): { question: PresentedQuestion | null; done: boolean; redFlags: RedFlagHit[]; progress: PresentedQuestion['progress'] | null } {
    const q = Q[questionId];
    if (!q) throw new Error('Unknown question');
    if (!planFor(state).includes(questionId)) throw new Error('This question is not part of the current interview');
    if (!state.asked.includes(questionId)) state.asked.push(questionId);
    if (skip) {
      if (q.required) throw new Error('This question cannot be skipped');
      delete state.answers[questionId];
      if (!state.skipped.includes(questionId)) state.skipped.push(questionId);
    } else {
      state.answers[questionId] = validateAnswer(q, value);
      state.skipped = state.skipped.filter(s => s !== questionId);
    }
    // Answers that change the plan may hide earlier answers; keep only answers still on the plan.
    const plan = planFor(state);
    for (const k of Object.keys(state.answers)) if (!plan.includes(k)) delete state.answers[k];
    save(state);
    const question = this.next(state);
    const progress = question?.progress || (plan.length ? { answered: plan.filter(p => p in state.answers || state.skipped.includes(p)).length, planned: plan.length, section: 'done', sectionIndex: SECTION_ORDER.length, sectionCount: SECTION_ORDER.length } : null);
    return { question, done: !question, redFlags: redFlagsFor(state), progress };
  },

  finish(state: InterviewState) {
    state.finishedAt = new Date().toISOString();
    save(state);
    const built = historyFrom(state);
    return {
      ...built,
      transcript: planFor(state).map(id => ({ questionId: id, section: Q[id].section, question: Q[id].text.en, answer: id in state.answers ? state.answers[id] : null, status: id in state.answers ? 'answered' : state.skipped.includes(id) ? 'skipped' : 'not_asked' }))
    };
  },

  questionBankSize(): number {
    return Object.keys(Q).length;
  }
};
