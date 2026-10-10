/**
 * Reads de-identified cases out of the facility database and builds the query for a session.
 * No name, phone, ABHA or full timestamp ever enters a CaseRecord.
 */
import { db } from '../../db/database';
import { ageBandOf } from './embedding';
import { buildReferenceShard } from './referenceCases';
import { CaseQuery, CaseRecord, ConfidentialityTier } from './types';
import { realOnly, samplesHidden } from '../sampleData';

const TIER1_KEYWORDS = (process.env.RETRIEVAL_TIER1_KEYWORDS || 'psychiat,manas,mental,hiv,art centre,addiction,prasuti,obstet,gynae,reproductive,sexual')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export function tierForDepartment(department: string | null | undefined, extra: { isPregnant?: boolean } = {}): ConfidentialityTier {
  const d = String(department || '').toLowerCase();
  if (extra.isPregnant) return 1;
  return TIER1_KEYWORDS.some(k => d.includes(k)) ? 1 : 2;
}

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

const str = (v: unknown): string => (v == null ? '' : String(v)).trim();
const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

function symptomNames(symptoms: any[]): { names: string[]; sites: string[] } {
  const names: string[] = []; const sites: string[] = [];
  for (const s of Array.isArray(symptoms) ? symptoms : []) {
    if (!s) continue;
    if (typeof s === 'string') { names.push(s); continue; }
    if (s.isNegated) continue;
    const n = str(s.name || s.symptom_name || s.symptom); if (n) names.push(n);
    const site = str(s.site); if (site) sites.push(site);
    for (const a of Array.isArray(s.associated) ? s.associated : []) { const t = str(a); if (t) names.push(t); }
  }
  return { names: uniq(names), sites: uniq(sites) };
}

function diagnosisNames(dx: any[]): string[] {
  return uniq((Array.isArray(dx) ? dx : []).map(d => {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return [str(d.aCode), str(d.sanskritTerm), str(d.englishEquivalent || d.name || d.label)].filter(Boolean).join(' ');
  }));
}

function medicineNames(...lists: any[][]): string[] {
  const out: string[] = [];
  for (const list of lists) for (const m of Array.isArray(list) ? list : []) {
    if (!m) continue;
    if (typeof m === 'string') { out.push(m); continue; }
    const n = str(m.drugName || m.formulationName || m.name || m.classicalName); if (n) out.push(n);
  }
  return uniq(out);
}

function monthOf(iso: string | null | undefined): string {
  const s = str(iso); return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : 'unknown';
}

function historyBits(history: any): { conditions: string[]; medicines: string[] } {
  if (!history || typeof history !== 'object') return { conditions: [], medicines: [] };
  const conditions: string[] = [];
  for (const c of Array.isArray(history.conditions) ? history.conditions : []) { const t = str(c); if (t && t.toLowerCase() !== 'none') conditions.push(t); }
  for (const c of Array.isArray(history.pastMedical) ? history.pastMedical : []) { const t = str(c?.name); if (t) conditions.push(t); }
  const medicines: string[] = [];
  if (typeof history.currentMedicines === 'string') for (const m of history.currentMedicines.split(/[,;\n]/)) { const t = str(m); if (t && t.toLowerCase() !== 'none') medicines.push(t); }
  for (const d of Array.isArray(history.drugHistory) ? history.drugHistory : []) { const t = str(d?.name); if (t) medicines.push(t); }
  return { conditions: uniq(conditions), medicines: uniq(medicines) };
}

function redFlagList(raw: string | null | undefined): string[] {
  const v = parse<any>(raw, raw || '');
  if (Array.isArray(v)) return uniq(v.map(x => str(typeof x === 'string' ? x : x?.id || x?.label)));
  return uniq(str(v).split(/[,;]/).map(s => s.trim()));
}

/** Finalized encounters first, then sessions that have no encounter yet. */
export function loadFacilityCases(): CaseRecord[] {
  const out: CaseRecord[] = [];
  const encounters: any[] = db.prepare(`
    SELECT e.id, e.session_id, e.department, e.case_sheet_json, e.created_at, p.age, p.gender, p.is_pregnant, s.red_flag_triggers
    FROM encounters e JOIN patients p ON p.id = e.patient_id LEFT JOIN sessions s ON s.id = e.session_id
    WHERE ${realOnly('e.patient_id')}
  `).all();
  for (const e of encounters) {
    const cs = parse<any>(e.case_sheet_json, {});
    const { names, sites } = symptomNames(cs.symptoms);
    out.push({
      id: e.id, source: 'encounter', department: str(e.department || cs.department), careStream: str(cs.careStream || 'UNDECIDED'),
      ageBand: ageBandOf(e.age), sex: str(e.gender).toUpperCase() || 'unknown',
      symptoms: names, sites, diagnoses: diagnosisNames(cs.diagnoses),
      medicines: medicineNames(cs.allopathicPrescription, cs.ayushPrescription),
      investigations: uniq((Array.isArray(cs.investigationsOrdered) ? cs.investigationsOrdered : []).map(str)),
      redFlags: redFlagList(e.red_flag_triggers), month: monthOf(e.created_at), tier: tierForDepartment(e.department, { isPregnant: !!e.is_pregnant })
    });
  }
  const sessions: any[] = db.prepare(`
    SELECT s.id, s.symptoms_json, s.red_flag_triggers, s.care_stream, s.history_json, s.created_at, p.age, p.gender, p.is_pregnant
    FROM sessions s JOIN patients p ON p.id = s.patient_id
    WHERE s.id NOT IN (SELECT session_id FROM encounters) AND ${realOnly('s.patient_id')}
  `).all();
  for (const s of sessions) {
    const { names, sites } = symptomNames(parse<any[]>(s.symptoms_json, []));
    const h = historyBits(parse<any>(s.history_json, null));
    if (names.length === 0 && h.conditions.length === 0) continue;
    out.push({
      id: s.id, source: 'session', department: '', careStream: str(s.care_stream || 'UNDECIDED'),
      ageBand: ageBandOf(s.age), sex: str(s.gender).toUpperCase() || 'unknown',
      symptoms: names, sites, diagnoses: h.conditions, medicines: h.medicines, investigations: [],
      redFlags: redFlagList(s.red_flag_triggers), month: monthOf(s.created_at), tier: tierForDepartment('', { isPregnant: !!s.is_pregnant })
    });
  }
  return out;
}

/**
 * The synthetic reference shard is invented data. RETRIEVAL_REFERENCE_SHARD=on|off fixes it; left
 * unset it follows the mode: on in Mock mode, off in Real mode, where "similar past cases" are
 * only cases of this facility (an empty list until doctors have signed some).
 */
export function referenceShardEnabled(): boolean {
  const setting = (process.env.RETRIEVAL_REFERENCE_SHARD || '').toLowerCase();
  return setting === 'on' || setting === 'off' ? setting === 'on' : !samplesHidden();
}

export function loadAllCases(): { cases: CaseRecord[]; facility: number; reference: number } {
  const facility = loadFacilityCases();
  const reference = referenceShardEnabled() ? buildReferenceShard() : [];
  return { cases: facility.concat(reference), facility: facility.length, reference: reference.length };
}

/** Cheap change signature so the index is rebuilt only when the data changed. */
export function corpusSignature(): string {
  const e: any = db.prepare('SELECT COUNT(*) n, MAX(created_at) t FROM encounters').get();
  const s: any = db.prepare('SELECT COUNT(*) n, MAX(created_at) t FROM sessions').get();
  return `${e.n}:${e.t || ''}:${s.n}:${s.t || ''}:${referenceShardEnabled() ? 'ref' : 'noref'}:${samplesHidden() ? 'real' : 'mock'}`;
}

/** The query for a session: its intake, history and demographics. Never the transcript or identifiers. */
export function buildQueryFromSession(sessionId: string): { query: CaseQuery; excludeIds: string[] } | null {
  const s: any = db.prepare(`
    SELECT s.id, s.symptoms_json, s.red_flag_triggers, s.care_stream, s.history_json, p.age, p.gender, p.is_pregnant
    FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) return null;
  const { names, sites } = symptomNames(parse<any[]>(s.symptoms_json, []));
  const h = historyBits(parse<any>(s.history_json, null));
  const enc: any = db.prepare('SELECT id FROM encounters WHERE session_id = ?').get(sessionId);
  return {
    query: {
      careStream: str(s.care_stream || ''), ageBand: ageBandOf(s.age), sex: str(s.gender).toUpperCase() || 'unknown',
      symptoms: names, sites, diagnoses: h.conditions, medicines: h.medicines, redFlags: redFlagList(s.red_flag_triggers),
      tier: tierForDepartment('', { isPregnant: !!s.is_pregnant })
    },
    excludeIds: [sessionId, enc?.id].filter(Boolean)
  };
}
