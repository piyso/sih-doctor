/**
 * Doctor / Vaidya desk services: who is seeing which patient, prescription drafts that survive a
 * refresh, the patient's timeline and "what changed since last visit", the doctor's own day and
 * favourites, order sets from national protocols, prescribing-quality indicators, adverse-reaction
 * reports, notifiable-disease prompts and recording consent.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { drugById } from './safety/drugDictionary';
import { resolveAllopathicLine } from './safety/resolver';
import { DEFAULT_ORDER_SETS } from './orderSets.seed';

// Columns/tables are also ensured here so the module works whichever loads first.
for (const col of ['claimed_by TEXT', 'claimed_by_name TEXT', 'claimed_at TEXT']) { try { db.exec(`ALTER TABLE sessions ADD COLUMN ${col};`); } catch { /* exists */ } }
try { db.exec('ALTER TABLE staff_users ADD COLUMN hpr_id TEXT;'); } catch { /* exists */ }
db.exec(`
  CREATE TABLE IF NOT EXISTS rx_drafts (session_id TEXT NOT NULL, staff_id TEXT NOT NULL, draft_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (session_id, staff_id));
  CREATE TABLE IF NOT EXISTS order_sets (id TEXT PRIMARY KEY, owner_staff_id TEXT, care_stream TEXT NOT NULL, name TEXT NOT NULL, condition TEXT, items_json TEXT NOT NULL, source TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS adr_reports (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, session_id TEXT, encounter_id TEXT, channel TEXT NOT NULL, report_json TEXT NOT NULL, status TEXT NOT NULL, reporter_id TEXT NOT NULL, reporter_name TEXT NOT NULL, created_at TEXT NOT NULL, submitted_at TEXT, reference_no TEXT);
  CREATE TABLE IF NOT EXISTS notifiable_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, patient_id TEXT NOT NULL, session_id TEXT, encounter_id TEXT, status TEXT NOT NULL, details_json TEXT NOT NULL, reference_no TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_by TEXT);
  CREATE TABLE IF NOT EXISTS recording_consents (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, patient_id TEXT NOT NULL, purpose TEXT NOT NULL, given INTEGER NOT NULL, method TEXT NOT NULL, recorded_by TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS scribe_usage (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, staff_id TEXT NOT NULL, mode TEXT NOT NULL, seconds REAL NOT NULL, language TEXT, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_scribe_usage_session ON scribe_usage(session_id);
`);
// Consent events carry who agreed, after which notice, in which language, and whether others present were told.
for (const col of ['event TEXT', 'consenter TEXT', 'consenter_name TEXT', 'relationship TEXT', 'notice_version TEXT', 'notice_language TEXT', 'others_informed INTEGER', 'recorded_by_id TEXT']) {
  try { db.exec(`ALTER TABLE recording_consents ADD COLUMN ${col};`); } catch { /* exists */ }
}

const safe = <T>(raw: any, fallback: T): T => { if (!raw) return fallback; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch { return fallback; } };
const now = () => new Date().toISOString();
interface Staff { id: string; displayName: string; role: string }

/** A past diagnosis as text. Seed NAMASTE codes (AYU-…) are placeholders and are not shown as codes. */
const dxLabel = (d: any): string => {
  const text = typeof d === 'string' ? d : d?.display || d?.englishEquivalent || d?.sanskritTerm || '';
  return String(text).replace(/^AYU-[A-Z]+-\d+\s*[·:-]?\s*/i, '').trim();
};

// ── Claims ──────────────────────────────────────────────────────────────────
export function claimSession(sessionId: string, staff: Staff, takeOver = false): { ok: boolean; claimedBy?: { id: string; name: string; at: string }; status?: string } {
  const row: any = db.prepare('SELECT status, claimed_by, claimed_by_name, claimed_at FROM sessions WHERE id = ?').get(sessionId);
  if (!row) return { ok: false };
  const claimedByOther = row.claimed_by && row.claimed_by !== staff.id && ['PENDING_DOCTOR', 'IN_CONSULTATION', 'DIVERTED_EMERGENCY'].includes(row.status);
  if (claimedByOther && !takeOver) return { ok: false, claimedBy: { id: row.claimed_by, name: row.claimed_by_name, at: row.claimed_at }, status: row.status };
  const at = now();
  db.prepare(`UPDATE sessions SET claimed_by = ?, claimed_by_name = ?, claimed_at = ?,
    status = CASE WHEN status = 'PENDING_DOCTOR' THEN 'IN_CONSULTATION' ELSE status END,
    consult_started_at = COALESCE(consult_started_at, ?) WHERE id = ?`).run(staff.id, staff.displayName, at, at, sessionId);
  return { ok: true, claimedBy: { id: staff.id, name: staff.displayName, at } };
}

export function releaseClaim(sessionId: string, staff: Staff): boolean {
  const r = db.prepare(`UPDATE sessions SET claimed_by = NULL, claimed_by_name = NULL, claimed_at = NULL,
    status = CASE WHEN status = 'IN_CONSULTATION' THEN 'PENDING_DOCTOR' ELSE status END WHERE id = ? AND (claimed_by = ? OR claimed_by IS NULL)`).run(sessionId, staff.id);
  return r.changes > 0;
}

export function claimOf(sessionId: string): { id: string; name: string; at: string } | null {
  const r: any = db.prepare('SELECT claimed_by, claimed_by_name, claimed_at FROM sessions WHERE id = ?').get(sessionId);
  return r?.claimed_by ? { id: r.claimed_by, name: r.claimed_by_name, at: r.claimed_at } : null;
}

// ── Drafts ──────────────────────────────────────────────────────────────────
export function getDraft(sessionId: string, staffId: string): { draft: any; updatedAt: string } | null {
  const r: any = db.prepare('SELECT draft_json, updated_at FROM rx_drafts WHERE session_id = ? AND staff_id = ?').get(sessionId, staffId);
  return r ? { draft: safe(r.draft_json, null), updatedAt: r.updated_at } : null;
}
export function saveDraft(sessionId: string, staffId: string, draft: unknown): string {
  const json = JSON.stringify(draft ?? {});
  if (json.length > 200_000) throw new Error('Draft is too large');
  const at = now();
  db.prepare(`INSERT INTO rx_drafts (session_id, staff_id, draft_json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, staff_id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at`).run(sessionId, staffId, json, at);
  return at;
}
export function deleteDraft(sessionId: string, staffId?: string) {
  if (staffId) db.prepare('DELETE FROM rx_drafts WHERE session_id = ? AND staff_id = ?').run(sessionId, staffId);
  else db.prepare('DELETE FROM rx_drafts WHERE session_id = ?').run(sessionId);
}

// ── Timeline and "what changed" ─────────────────────────────────────────────
const numberOf = (v: any): number | null => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };

export function patientTimeline(patientId: string, excludeSessionId?: string) {
  const encounters = (db.prepare(`
    SELECT e.id, e.session_id, e.created_at, e.doctor_name, e.department, e.care_stream, e.case_sheet_json, d.status AS dispense_status, d.created_at AS dispensed_at, d.note AS dispense_note
    FROM encounters e LEFT JOIN dispenses d ON d.encounter_id = e.id
    WHERE e.patient_id = ? ORDER BY e.created_at DESC LIMIT 20`).all(patientId) as any[])
    .filter(e => e.session_id !== excludeSessionId)
    .map(e => {
      const sheet: any = safe(e.case_sheet_json, {});
      const meds = [...(sheet.allopathicPrescription || []).map((m: any) => ({ name: m.name || m.drugName, dosage: m.dosage, frequency: m.frequency, durationDays: m.durationDays, stream: 'ALLOPATHY' })),
        ...(sheet.ayushPrescription || []).map((a: any) => ({ name: a.classicalName || a.formulationName, dosage: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana, stream: 'AYURVEDA' }))];
      return {
        encounterId: e.id, sessionId: e.session_id, date: e.created_at, doctorName: e.doctor_name, department: e.department, careStream: e.care_stream || sheet.careStream,
        diagnoses: (sheet.diagnoses || []).map(dxLabel).filter(Boolean),
        medicines: meds, advice: sheet.advice || '', followUpDays: sheet.followUpDays || null,
        investigations: (sheet.investigationsOrdered || []).map((i: any) => typeof i === 'string' ? i : i.display),
        dispensed: e.dispense_status || 'PENDING_VERIFICATION', dispensedAt: e.dispensed_at || null, dispenseNote: e.dispense_note || null,
        acknowledgedAlerts: (sheet.criticalAlertsAcknowledged?.items || []).map((a: any) => ({ summary: a.summary, reason: a.reason }))
      };
    });
  const vitals = (db.prepare(`SELECT id, created_at, vitals_json FROM sessions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 12`).all(patientId) as any[])
    .map(s => ({ sessionId: s.id, date: s.created_at, ...safe<any>(s.vitals_json, {}) }))
    .filter(v => v.bp || v.pulse || v.spo2 || v.temp || v.weightKg || v.bloodSugar);
  const labs = (db.prepare(`SELECT id, created_at, metadata_json FROM documents WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20`).all(patientId) as any[])
    .flatMap(d => (safe<any>(d.metadata_json, {}).labMarkers || []).map((m: any) => ({ documentId: d.id, date: safe<any>(d.metadata_json, {}).recordedDate || d.created_at, test: m.testName || m.marker, value: m.value, unit: m.unit, flag: m.flag || (m.isAbnormal ? 'abnormal' : undefined) })));
  return { encounters, vitals, labs };
}

/** Differences between this visit and the patient's previous completed visit. */
export function sinceLastVisit(patientId: string, sessionId: string, current: { symptoms: any[]; vitals: any }) {
  const prev: any = db.prepare(`SELECT s.id, s.created_at, s.symptoms_json, s.vitals_json FROM sessions s WHERE s.patient_id = ? AND s.id != ? AND s.status = 'COMPLETED' ORDER BY s.created_at DESC LIMIT 1`).get(patientId, sessionId);
  if (!prev) return { firstVisit: true, changes: [] as string[] };
  const changes: string[] = [];
  const pv = safe<any>(prev.vitals_json, {});
  const cv = current.vitals || {};
  const sys = (bp: any) => { const m = String(bp || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/); return m ? { s: +m[1], d: +m[2] } : null; };
  const a = sys(pv.bp), b = sys(cv.bp);
  if (a && b && Math.abs(a.s - b.s) >= 10) changes.push(`BP ${pv.bp} → ${cv.bp}`);
  const wA = numberOf(pv.weightKg), wB = numberOf(cv.weightKg);
  if (wA && wB && Math.abs(wA - wB) >= 2) changes.push(`Weight ${wA} → ${wB} kg`);
  const sA = numberOf(pv.bloodSugar), sB = numberOf(cv.bloodSugar);
  if (sA && sB && Math.abs(sA - sB) >= 30) changes.push(`Blood sugar ${sA} → ${sB} mg/dL`);
  const names = (list: any[]) => new Set((list || []).filter((x: any) => !x?.isNegated).map((x: any) => String(x?.name || x?.symptom_name || '').toLowerCase()).filter(Boolean));
  const before = names(safe<any[]>(prev.symptoms_json, []));
  const nowNames = names(current.symptoms);
  const fresh = Array.from(nowNames).filter(n => !before.has(n));
  if (fresh.length) changes.push(`New complaint: ${fresh.join(', ')}`);
  const resolved = Array.from(before).filter(n => !nowNames.has(n));
  if (resolved.length) changes.push(`No longer reported: ${resolved.join(', ')}`);
  const lastEnc: any = db.prepare('SELECT e.id, e.created_at, d.status FROM encounters e LEFT JOIN dispenses d ON d.encounter_id = e.id WHERE e.session_id = ? ORDER BY e.created_at DESC LIMIT 1').get(prev.id);
  if (lastEnc?.status && lastEnc.status !== 'DISPENSED') changes.push(`Last prescription was ${String(lastEnc.status).toLowerCase().replace(/_/g, ' ')} at the pharmacy`);
  const newLabs = (db.prepare(`SELECT metadata_json FROM documents WHERE patient_id = ? AND created_at > ?`).all(patientId, prev.created_at) as any[])
    .flatMap(d => (safe<any>(d.metadata_json, {}).labMarkers || []).filter((m: any) => m.isAbnormal || /high|low|abnormal/i.test(String(m.flag || ''))).map((m: any) => `${m.testName || m.marker} ${m.value}${m.unit ? ` ${m.unit}` : ''}`));
  if (newLabs.length) changes.push(`New abnormal results: ${newLabs.slice(0, 4).join(', ')}`);
  return { firstVisit: false, previousVisit: prev.created_at, changes };
}

// ── The doctor's own day ────────────────────────────────────────────────────
export function seenToday(staffId: string) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return (db.prepare(`
    SELECT e.id, e.session_id, e.created_at, e.case_sheet_json, p.name AS patient_name, p.age, p.gender, s.token_no, d.status AS dispense_status, d.note AS dispense_note
    FROM encounters e JOIN patients p ON p.id = e.patient_id JOIN sessions s ON s.id = e.session_id LEFT JOIN dispenses d ON d.encounter_id = e.id
    WHERE e.doctor_id = ? AND e.created_at >= ? ORDER BY e.created_at DESC`).all(staffId, start.toISOString()) as any[])
    .map(r => {
      const sheet: any = safe(r.case_sheet_json, {});
      return {
        encounterId: r.id, sessionId: r.session_id, at: r.created_at, patientName: r.patient_name, age: r.age, gender: r.gender, tokenNo: r.token_no,
        items: [...(sheet.allopathicPrescription || []), ...(sheet.ayushPrescription || [])].length,
        diagnosis: (sheet.diagnoses || []).map(dxLabel).filter(Boolean)[0] || null,
        dispenseStatus: r.dispense_status || 'PENDING_VERIFICATION', dispenseNote: r.dispense_note || null, amended: !!sheet.amendsEncounterId
      };
    });
}

/** The doctor's most-prescribed items over the last 180 days (their real favourites). */
export function favourites(staffId: string, careStream: 'ALLOPATHY' | 'AYURVEDA', limit = 12) {
  const since = new Date(Date.now() - 180 * 86400_000).toISOString();
  const rows = db.prepare('SELECT case_sheet_json FROM encounters WHERE doctor_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 500').all(staffId, since) as any[];
  const counts = new Map<string, { item: any; n: number }>();
  for (const r of rows) {
    const sheet: any = safe(r.case_sheet_json, {});
    const list = careStream === 'AYURVEDA' ? sheet.ayushPrescription || [] : sheet.allopathicPrescription || [];
    for (const it of list) {
      const key = String(careStream === 'AYURVEDA' ? it.classicalName || it.formulationName : it.name || it.drugName || '').toLowerCase().trim();
      if (!key) continue;
      const prev = counts.get(key);
      counts.set(key, { item: prev?.item || it, n: (prev?.n || 0) + 1 });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.n - a.n).slice(0, limit).map(x => ({ ...x.item, timesPrescribed: x.n }));
}

// ── Order sets ──────────────────────────────────────────────────────────────
/** Adds starter sets that are not in the table yet. Retired sets keep their row (active = 0), so they do not come back. */
function seedOrderSets() {
  const ins = db.prepare('INSERT OR IGNORE INTO order_sets (id, owner_staff_id, care_stream, name, condition, items_json, source, active, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)');
  const at = now();
  db.transaction(() => { for (const s of DEFAULT_ORDER_SETS) ins.run(s.id, s.careStream, s.name, s.condition, JSON.stringify(s.items), s.source, at, at); })();
}
seedOrderSets();

export function listOrderSets(staffId: string, careStream?: string) {
  const rows = db.prepare(`SELECT * FROM order_sets WHERE active = 1 AND (owner_staff_id IS NULL OR owner_staff_id = ?) ${careStream ? 'AND care_stream = ?' : ''} ORDER BY owner_staff_id IS NULL, name`).all(...(careStream ? [staffId, careStream] : [staffId])) as any[];
  return rows.map(r => ({ id: r.id, careStream: r.care_stream, name: r.name, condition: r.condition, source: r.source, mine: r.owner_staff_id === staffId, ...safe<any>(r.items_json, {}) }));
}
export function saveOrderSet(staffId: string, input: any, id?: string): string {
  const name = String(input?.name || '').trim().slice(0, 120);
  const careStream = input?.careStream === 'AYURVEDA' ? 'AYURVEDA' : 'ALLOPATHY';
  if (!name) throw new Error('name is required');
  const items = { medicines: Array.isArray(input?.medicines) ? input.medicines.slice(0, 20) : [], investigations: Array.isArray(input?.investigations) ? input.investigations.slice(0, 20) : [], advice: String(input?.advice || '').slice(0, 1000), pathya: Array.isArray(input?.pathya) ? input.pathya.slice(0, 20) : [], apathya: Array.isArray(input?.apathya) ? input.apathya.slice(0, 20) : [], followUpDays: Number(input?.followUpDays) || undefined };
  const at = now();
  if (id) {
    const r = db.prepare('UPDATE order_sets SET name = ?, condition = ?, items_json = ?, care_stream = ?, updated_at = ? WHERE id = ? AND owner_staff_id = ?').run(name, String(input?.condition || '').slice(0, 120), JSON.stringify(items), careStream, at, id, staffId);
    if (!r.changes) throw new Error('Only your own order sets can be edited');
    return id;
  }
  const newId = uuidv4();
  db.prepare('INSERT INTO order_sets (id, owner_staff_id, care_stream, name, condition, items_json, source, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').run(newId, staffId, careStream, name, String(input?.condition || '').slice(0, 120), JSON.stringify(items), 'Saved by the doctor', at, at);
  return newId;
}
export function deleteOrderSet(staffId: string, id: string): boolean {
  return db.prepare('UPDATE order_sets SET active = 0 WHERE id = ? AND owner_staff_id = ?').run(id, staffId).changes > 0;
}

// ── Prescribing quality (WHO/INRUD core indicators + AWaRe) ──────────────────
export function prescribingQuality(opts: { staffId?: string; days?: number }) {
  const days = Math.max(1, Math.min(365, opts.days || 30));
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = (opts.staffId
    ? db.prepare(`SELECT case_sheet_json, care_stream FROM encounters WHERE doctor_id = ? AND created_at >= ?`).all(opts.staffId, since)
    : db.prepare(`SELECT case_sheet_json, care_stream FROM encounters WHERE created_at >= ?`).all(since)) as any[];
  let encounters = 0, medicines = 0, generic = 0, nlem = 0, resolved = 0, withAntibiotic = 0, withInjection = 0, access = 0, watch = 0, reserve = 0, abxItems = 0, abxWithIndication = 0;
  for (const r of rows) {
    const sheet: any = safe(r.case_sheet_json, {});
    const allo: any[] = sheet.allopathicPrescription || [];
    if (!allo.length) continue;
    encounters++;
    let hasAbx = false, hasInj = false;
    for (const m of allo) {
      medicines++;
      const line = resolveAllopathicLine(m, 0, 'prescribed');
      const concepts = line.conceptIds.map(drugById).filter(Boolean) as any[];
      if (concepts.length) resolved++;
      const raw = String(m.name || m.drugName || '').toLowerCase();
      // Generic naming: the written name is the generic (INN) itself, not a brand synonym.
      if (concepts.length && concepts.every(c => raw.includes(String(c.inn).toLowerCase().split(' ')[0]))) generic++;
      if (concepts.length && concepts.every(c => c.nlem)) nlem++;
      for (const c of concepts) {
        if (c.aware) {
          hasAbx = true; abxItems++;
          if (m.indication) abxWithIndication++;
          if (c.aware === 'ACCESS') access++; else if (c.aware === 'WATCH') watch++; else reserve++;
        }
      }
      if (/inj|iv|im|sc/i.test(String(m.route || ''))) hasInj = true;
    }
    if (hasAbx) withAntibiotic++;
    if (hasInj) withInjection++;
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  return {
    windowDays: days,
    encounters,
    indicators: [
      { id: 'drugs_per_encounter', label: 'Medicines per encounter', value: encounters ? Math.round((medicines / encounters) * 100) / 100 : null, target: '1.6–1.8', unit: '' },
      { id: 'generic_pct', label: 'Medicines prescribed by generic name', value: pct(generic, medicines), target: '100', unit: '%' },
      { id: 'antibiotic_pct', label: 'Encounters with an antibiotic', value: pct(withAntibiotic, encounters), target: '20–26.8', unit: '%' },
      { id: 'injection_pct', label: 'Encounters with an injection', value: pct(withInjection, encounters), target: '13.4–24.1', unit: '%' },
      { id: 'nlem_pct', label: 'Medicines from the National List of Essential Medicines', value: pct(nlem, medicines), target: '100', unit: '%' },
      { id: 'access_pct', label: 'Antibiotics from the WHO Access group', value: pct(access, abxItems), target: '≥ 60', unit: '%' },
      { id: 'abx_indication_pct', label: 'Antibiotics with a recorded indication', value: pct(abxWithIndication, abxItems), target: '100', unit: '%' }
    ],
    aware: { access, watch, reserve },
    coverage: { medicines, recognised: resolved },
    source: 'WHO/INRUD core prescribing indicators (WHO 1993); WHO AWaRe 2023 (≥ 60% Access target)'
  };
}

/** Per-rule alert outcomes in signed prescriptions: how often each STOP was overridden, with reasons. */
export function alertOutcomes(days = 90) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = db.prepare('SELECT case_sheet_json FROM encounters WHERE created_at >= ?').all(since) as any[];
  const stats = new Map<string, { alertId: string; tier: string; shown: number; signedAnyway: number; reasons: string[]; summary: string }>();
  for (const r of rows) {
    const sheet: any = safe(r.case_sheet_json, {});
    for (const a of sheet.conflictAlerts || []) {
      const k = a.alertId;
      const s = stats.get(k) || { alertId: k, tier: a.tier || 'WARN', shown: 0, signedAnyway: 0, reasons: [], summary: `${a.itemA} × ${a.itemB}` };
      s.shown++;
      stats.set(k, s);
    }
    for (const ack of sheet.criticalAlertsAcknowledged?.items || []) {
      for (const id of ack.alertIds || []) {
        const s = stats.get(id);
        if (s) { s.signedAnyway++; if (ack.reason && s.reasons.length < 5) s.reasons.push(ack.reason); }
      }
    }
  }
  return Array.from(stats.values()).map(s => ({ ...s, overrideRate: s.tier === 'STOP' && s.shown ? Math.round((s.signedAnyway / s.shown) * 100) : null, reviewSuggested: s.tier === 'STOP' && s.shown >= 10 && s.signedAnyway / s.shown > 0.9 }))
    .sort((a, b) => b.shown - a.shown);
}

// ── Adverse drug reaction reports (PvPI / Ayush Suraksha) ──────────────────
export function createAdrReport(input: any, staff: Staff) {
  const patientId = String(input?.patientId || '');
  if (!patientId) throw new Error('patientId is required');
  const suspected = Array.isArray(input?.suspectedMedicines) ? input.suspectedMedicines.slice(0, 10) : [];
  if (!suspected.length) throw new Error('At least one suspected medicine is required');
  const reaction = String(input?.reaction || '').trim();
  if (reaction.length < 3) throw new Error('Describe the reaction');
  const isAyush = suspected.some((m: any) => m?.stream === 'AYURVEDA');
  const channel = isAyush ? 'Ayush Suraksha (ASU&H pharmacovigilance)' : 'PvPI (Indian Pharmacopoeia Commission)';
  const report = {
    reaction, onset: input?.onset || null, seriousness: input?.seriousness || 'non-serious', outcome: input?.outcome || 'unknown',
    suspectedMedicines: suspected, concomitant: Array.isArray(input?.concomitant) ? input.concomitant.slice(0, 20) : [],
    actionTaken: input?.actionTaken || null, notes: String(input?.notes || '').slice(0, 1000),
    form: isAyush ? 'Ayush Suraksha portal report' : 'PvPI Suspected ADR Reporting Form (healthcare professional, v1.4 fields)'
  };
  const id = uuidv4();
  db.prepare('INSERT INTO adr_reports (id, patient_id, session_id, encounter_id, channel, report_json, status, reporter_id, reporter_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, patientId, input?.sessionId || null, input?.encounterId || null, channel, JSON.stringify(report), 'READY_TO_SUBMIT', staff.id, staff.displayName, now());
  return { id, channel, status: 'READY_TO_SUBMIT', report };
}
export function listAdrReports(patientId?: string) {
  const rows = (patientId ? db.prepare('SELECT * FROM adr_reports WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) : db.prepare('SELECT * FROM adr_reports ORDER BY created_at DESC LIMIT 200').all()) as any[];
  return rows.map(r => ({ id: r.id, patientId: r.patient_id, sessionId: r.session_id, encounterId: r.encounter_id, channel: r.channel, status: r.status, reporter: r.reporter_name, createdAt: r.created_at, submittedAt: r.submitted_at, referenceNo: r.reference_no, report: safe(r.report_json, {}) }));
}
export function markAdrSubmitted(id: string, referenceNo: string) {
  return db.prepare('UPDATE adr_reports SET status = ?, submitted_at = ?, reference_no = ? WHERE id = ?').run('SUBMITTED', now(), String(referenceNo || '').slice(0, 80) || null, id).changes > 0;
}

// ── Notifiable events (TB → Nikshay) ─────────────────────────────────────────
const TB_DRUGS = new Set(['isoniazid', 'rifampicin', 'pyrazinamide', 'ethambutol']);
export function detectNotifiable(input: { diagnoses: any[]; medicines: any[] }): Array<{ type: string; reason: string }> {
  const out: Array<{ type: string; reason: string }> = [];
  const dxText = (input.diagnoses || []).map((d: any) => typeof d === 'string' ? d : `${d.display || ''} ${d.code || ''} ${d.englishEquivalent || ''}`).join(' ; ');
  const tbByDx = /\btuberculosis\b|\bkoch|\bptb\b|\beptb\b|\btb\b|rajayakshma|\bA1[5-9]\b/i.test(dxText);
  const tbDrugs = (input.medicines || []).flatMap((m: any) => resolveAllopathicLine(m, 0, 'prescribed').conceptIds).filter(id => TB_DRUGS.has(id));
  if (tbByDx || new Set(tbDrugs).size >= 2) out.push({ type: 'NIKSHAY_TB', reason: tbByDx ? 'Tuberculosis diagnosis recorded' : 'Two or more first-line anti-TB drugs prescribed' });
  // Animal bites and rabies are reported to IHIP under the National Rabies Control Programme.
  const biteByDx = /\b(dog|cat|monkey|animal|mammal|bat|jackal|mongoose)\s*(bite|scratch|lick)|\brabies\b|\bZ20\.3\b|\bA82\b/i.test(dxText);
  const pep = (input.medicines || []).some((m: any) => resolveAllopathicLine(m, 0, 'prescribed').conceptIds.some(id => id === 'rabies_vaccine' || id === 'rabies_immunoglobulin'));
  if (biteByDx || pep) out.push({ type: 'IHIP_ANIMAL_BITE', reason: biteByDx ? 'Animal bite / rabies recorded' : 'Rabies post-exposure prophylaxis prescribed' });
  return out;
}
export function createNotifiable(type: string, patientId: string, sessionId: string | null, encounterId: string | null, details: unknown) {
  const exists: any = db.prepare('SELECT id FROM notifiable_events WHERE type = ? AND patient_id = ? AND status != ?').get(type, patientId, 'SUBMITTED');
  if (exists) return exists.id as string;
  const id = uuidv4();
  const at = now();
  db.prepare('INSERT INTO notifiable_events (id, type, patient_id, session_id, encounter_id, status, details_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, type, patientId, sessionId, encounterId, 'PENDING', JSON.stringify(details || {}), at, at);
  return id;
}
export function listNotifiable(status?: string) {
  const rows = (status ? db.prepare(`SELECT n.*, p.name AS patient_name, p.age, p.gender, p.abha_id FROM notifiable_events n JOIN patients p ON p.id = n.patient_id WHERE n.status = ? ORDER BY n.created_at DESC`).all(status)
    : db.prepare(`SELECT n.*, p.name AS patient_name, p.age, p.gender, p.abha_id FROM notifiable_events n JOIN patients p ON p.id = n.patient_id ORDER BY n.created_at DESC LIMIT 200`).all()) as any[];
  return rows.map(r => ({ id: r.id, type: r.type, status: r.status, patientId: r.patient_id, patientName: r.patient_name, age: r.age, gender: r.gender, abhaId: r.abha_id, sessionId: r.session_id, encounterId: r.encounter_id, details: safe(r.details_json, {}), referenceNo: r.reference_no, createdAt: r.created_at, updatedAt: r.updated_at }));
}
export function markNotifiableSubmitted(id: string, referenceNo: string, staff: Staff) {
  return db.prepare('UPDATE notifiable_events SET status = ?, reference_no = ?, updated_at = ?, submitted_by = ? WHERE id = ?').run('SUBMITTED', String(referenceNo || '').slice(0, 80) || null, now(), staff.displayName, id).changes > 0;
}

// ── IDSP / IHIP weekly syndromic counts (S-form style) ──────────────────────
const SYNDROMES: Array<{ id: string; label: string; test: (s: { name: string; duration: string }[], text: string) => boolean }> = [
  { id: 'fever_7d', label: 'Fever ≤ 7 days (only fever)', test: (s, t) => /fever|jwara|bukhar/i.test(t) && !/rash|bleed|unconscious|altered|confus/i.test(t) },
  { id: 'fever_rash', label: 'Fever with rash', test: (_s, t) => /fever|jwara|bukhar/i.test(t) && /rash/i.test(t) },
  { id: 'fever_bleeding', label: 'Fever with bleeding', test: (_s, t) => /fever|jwara/i.test(t) && /bleed|blood in/i.test(t) },
  { id: 'fever_sensorium', label: 'Fever with altered sensorium', test: (_s, t) => /fever|jwara/i.test(t) && /unconscious|altered|confus|drows/i.test(t) },
  { id: 'cough_2wk', label: 'Cough ≥ 2 weeks', test: (s, t) => /cough|kasa|khansi/i.test(t) && /(2|3|4|5|6|two|three|four)\s*(week|weeks|hafte)|month/i.test(t) },
  { id: 'diarrhoea', label: 'Acute diarrhoea (loose watery stools < 2 weeks)', test: (_s, t) => /diarr|loose motion|loose stool|dast|atisara/i.test(t) && !/blood/i.test(t) },
  { id: 'diarrhoea_blood', label: 'Diarrhoea with blood', test: (_s, t) => /diarr|loose motion|dast|pravahika/i.test(t) && /blood/i.test(t) },
  { id: 'jaundice', label: 'Jaundice < 4 weeks', test: (_s, t) => /jaundice|kamala|piliya|yellow eyes/i.test(t) },
  { id: 'afp', label: 'Acute flaccid paralysis (< 15 years)', test: (_s, t) => /sudden weakness|flaccid|paralysis|lakwa/i.test(t) }
];
export function ihipWeekly(weekStartIso: string) {
  const start = new Date(weekStartIso);
  if (Number.isNaN(start.getTime())) throw new Error('weekStart must be a date');
  const end = new Date(start.getTime() + 7 * 86400_000);
  const rows = db.prepare('SELECT s.symptoms_json, s.raw_transcript, p.age FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.created_at >= ? AND s.created_at < ?').all(start.toISOString(), end.toISOString()) as any[];
  const counts: Record<string, { label: string; under5: number; over5: number }> = Object.fromEntries(SYNDROMES.map(s => [s.id, { label: s.label, under5: 0, over5: 0 }]));
  for (const r of rows) {
    const symptoms = safe<any[]>(r.symptoms_json, []).filter(x => !x?.isNegated).map(x => ({ name: String(x?.name || x?.symptom_name || ''), duration: String(x?.onset || x?.duration || '') }));
    const text = `${symptoms.map(x => `${x.name} ${x.duration}`).join(' ; ')} ; ${r.raw_transcript || ''}`;
    for (const s of SYNDROMES) {
      if (s.id === 'afp' && !(Number(r.age) < 15)) continue;
      if (s.test(symptoms, text)) { if (Number(r.age) < 5) counts[s.id].under5++; else counts[s.id].over5++; }
    }
  }
  return { form: 'S (syndromic)', weekStart: start.toISOString().slice(0, 10), weekEnd: new Date(end.getTime() - 86400_000).toISOString().slice(0, 10), visits: rows.length, counts, note: 'Counts from kiosk symptoms; enter on IHIP (ihip.mohfw.gov.in). Syndromic, not diagnostic.' };
}

// ── Recording consent (room recording for the scribe) ──────────────────────
/**
 * Room recording needs the consent of the patient (or, for a child, a parent or guardian) for this
 * visit, after the notice has been read to them. Each event — given, declined, withdrawn — is a new
 * row, so the history stays. Dictation records only the clinician and needs no consent here.
 *
 * Basis: DPDP Act 2023 s.6 (free, specific, informed, unambiguous consent by a clear affirmative act;
 * withdrawal as easy as giving), s.5 (notice first, in English or an Eighth-Schedule language), s.9
 * (children: parent or guardian; the Rules' health-services exemption covers only what care needs,
 * and recording is a convenience, not a need).
 */
export const RECORDING_NOTICE_VERSION = 'room-recording-notice-v1 (2026-10-10)';
export type ConsentEvent = 'given' | 'declined' | 'withdrawn';
export interface RecordingConsentInput {
  event: ConsentEvent;
  consenter?: 'patient' | 'guardian' | 'representative';
  consenterName?: string;
  relationship?: string;
  noticeLanguage?: string;
  othersInformed?: boolean;
  method?: string;
}
export interface RecordingConsentState {
  given: boolean; event: ConsentEvent; at: string; by: string;
  consenter?: string; consenterName?: string; relationship?: string; noticeVersion?: string; noticeLanguage?: string; othersInformed?: boolean;
}

export function recordRecordingConsent(sessionId: string, input: RecordingConsentInput, staff: Staff) {
  const s: any = db.prepare('SELECT s.patient_id, p.age FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?').get(sessionId);
  if (!s) throw Object.assign(new Error('Visit not found'), { status: 404 });
  const event: ConsentEvent = (['given', 'declined', 'withdrawn'] as const).includes(input.event) ? input.event : 'declined';
  const consenter = (['patient', 'guardian', 'representative'] as const).includes(input.consenter as any) ? input.consenter! : 'patient';
  const name = String(input.consenterName || '').trim().slice(0, 80);
  const relationship = String(input.relationship || '').trim().slice(0, 40);
  if (event === 'given') {
    if (Number(s.age) < 18 && consenter === 'patient') throw Object.assign(new Error('The patient is under 18: a parent or guardian gives consent for room recording.'), { status: 400, code: 'GUARDIAN_REQUIRED' });
    if (consenter !== 'patient' && (!name || !relationship)) throw Object.assign(new Error('Record the name and relationship of the person giving consent.'), { status: 400, code: 'CONSENTER_DETAILS_REQUIRED' });
    if (input.othersInformed !== true) throw Object.assign(new Error('Everyone else in the room must be told about the recording first.'), { status: 400, code: 'OTHERS_NOT_INFORMED' });
  }
  if (event === 'withdrawn' && !consentActive(sessionId)) throw Object.assign(new Error('There is no active consent to withdraw.'), { status: 409, code: 'NO_ACTIVE_CONSENT' });
  db.prepare(`INSERT INTO recording_consents (id, session_id, patient_id, purpose, given, method, recorded_by, created_at, event, consenter, consenter_name, relationship, notice_version, notice_language, others_informed, recorded_by_id)
    VALUES (?, ?, ?, 'ambient_scribe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), sessionId, s.patient_id, event === 'given' ? 1 : 0, String(input.method || 'verbal, notice read aloud').slice(0, 40), staff.displayName, now(),
    event, consenter, name || null, relationship || null, RECORDING_NOTICE_VERSION, String(input.noticeLanguage || '').slice(0, 5) || null, input.othersInformed === true ? 1 : 0, staff.id);
}

/** The latest consent event for this visit (events from before a re-opened demo visit started do not count). */
export function recordingConsent(sessionId: string): RecordingConsentState | null {
  const r: any = db.prepare(`SELECT c.* FROM recording_consents c WHERE c.session_id = ? AND c.purpose = 'ambient_scribe'
    AND c.created_at >= (SELECT created_at FROM sessions WHERE id = ?) ORDER BY c.created_at DESC, c.rowid DESC LIMIT 1`).get(sessionId, sessionId);
  if (!r) return null;
  const event: ConsentEvent = r.event || (r.given ? 'given' : 'declined');
  return {
    given: event === 'given', event, at: r.created_at, by: r.recorded_by,
    consenter: r.consenter || undefined, consenterName: r.consenter_name || undefined, relationship: r.relationship || undefined,
    noticeVersion: r.notice_version || undefined, noticeLanguage: r.notice_language || undefined, othersInformed: r.others_informed === 1
  };
}
export const consentActive = (sessionId: string) => recordingConsent(sessionId)?.event === 'given';

/** One row per transcribed clip (seconds and mode only — never audio or text), so the record can say how it was written. */
export function logScribeUsage(sessionId: string, staffId: string, mode: 'dictation' | 'room', seconds: number, language: string) {
  db.prepare('INSERT INTO scribe_usage (id, session_id, staff_id, mode, seconds, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), sessionId, staffId, mode, Math.max(0, Number(seconds) || 0), language, now());
}
/** What the signed record states about how its notes were prepared (computed on the server, not claimed by the client). */
export function documentationAids(sessionId: string) {
  const rows = db.prepare(`SELECT mode, SUM(seconds) AS secs, COUNT(*) AS clips FROM scribe_usage WHERE session_id = ?
    AND created_at >= (SELECT created_at FROM sessions WHERE id = ?) GROUP BY mode`).all(sessionId, sessionId) as Array<{ mode: string; secs: number; clips: number }>;
  const by = (m: string) => rows.find(r => r.mode === m);
  const room = by('room');
  const consent = recordingConsent(sessionId);
  return {
    dictation: by('dictation') ? { clips: by('dictation')!.clips, seconds: Math.round(by('dictation')!.secs) } : null,
    roomRecording: room ? { clips: room.clips, seconds: Math.round(room.secs), consent: consent ? { event: consent.event, at: consent.at, consenter: consent.consenter, noticeVersion: consent.noticeVersion, noticeLanguage: consent.noticeLanguage } : null, audioKept: false } : null
  };
}

// ── Investigations catalogue ───────────────────────────────────────────────
/** Common OPD investigations. LOINC codes only where the code is certain; others are coded locally. */
export const INVESTIGATIONS: Array<{ id: string; display: string; loinc?: string; group: string }> = [
  { id: 'cbc', display: 'Complete blood count (CBC)', loinc: '58410-2', group: 'Haematology' },
  { id: 'hb', display: 'Haemoglobin', loinc: '718-7', group: 'Haematology' },
  { id: 'esr', display: 'ESR', group: 'Haematology' },
  { id: 'fbs', display: 'Fasting blood sugar', loinc: '1558-6', group: 'Biochemistry' },
  { id: 'rbs', display: 'Random blood sugar', loinc: '2345-7', group: 'Biochemistry' },
  { id: 'ppbs', display: 'Post-prandial blood sugar', group: 'Biochemistry' },
  { id: 'hba1c', display: 'HbA1c', loinc: '4548-4', group: 'Biochemistry' },
  { id: 'creatinine', display: 'Serum creatinine (with eGFR)', loinc: '2160-0', group: 'Biochemistry' },
  { id: 'urea', display: 'Blood urea', group: 'Biochemistry' },
  { id: 'electrolytes', display: 'Serum sodium and potassium', group: 'Biochemistry' },
  { id: 'lft', display: 'Liver function tests', group: 'Biochemistry' },
  { id: 'lipid', display: 'Lipid profile', group: 'Biochemistry' },
  { id: 'tsh', display: 'TSH', loinc: '3016-3', group: 'Biochemistry' },
  { id: 'uric_acid', display: 'Serum uric acid', group: 'Biochemistry' },
  { id: 'urine_routine', display: 'Urine routine and microscopy', group: 'Urine' },
  { id: 'urine_culture', display: 'Urine culture and sensitivity', group: 'Microbiology' },
  { id: 'upt', display: 'Urine pregnancy test (hCG)', loinc: '2106-3', group: 'Urine' },
  { id: 'dengue_ns1', display: 'Dengue NS1 antigen / IgM', group: 'Fever panel' },
  { id: 'malaria_rdt', display: 'Malaria rapid test / smear', group: 'Fever panel' },
  { id: 'typhoid', display: 'Blood culture (suspected enteric fever)', group: 'Fever panel' },
  { id: 'sputum_cbnaat', display: 'Sputum CBNAAT / TrueNat (suspected TB)', group: 'TB' },
  { id: 'cxr', display: 'Chest X-ray PA view', group: 'Imaging' },
  { id: 'ecg', display: 'ECG (12-lead)', loinc: '11524-6', group: 'Cardiac' },
  { id: 'usg_abdomen', display: 'Ultrasound abdomen', group: 'Imaging' },
  { id: 'hiv', display: 'HIV 1/2 (with pre-test counselling)', group: 'Serology' },
  { id: 'hbsag', display: 'HBsAg', group: 'Serology' },
  { id: 'vit_d', display: '25-OH vitamin D', group: 'Biochemistry' },
  { id: 'inr', display: 'PT / INR', group: 'Haematology' }
];
