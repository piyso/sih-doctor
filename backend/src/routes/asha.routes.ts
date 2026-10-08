/**
 * ASHA / ANM field visits with offline-first sync.
 *
 * The field app records visits without network and uploads them later in batches. Sync is
 * idempotent and per record: each record carries its own client id and version; the server stores
 * the newest version and answers record by record, so the app marks as "synced" only what the
 * server actually accepted.
 *
 * High-risk flags follow MoHFW antenatal-care guidance for measurable signs (Hb, BP, age, danger
 * signs). They are computed on the server (source of truth) and mirrored in the app for offline use.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { securityConfig } from '../security/config';
import { audit } from '../security/audit';

export const ashaRouter = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS field_visits (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    asha_user_id TEXT NOT NULL,
    asha_name TEXT NOT NULL,
    village TEXT NOT NULL,
    household TEXT,
    patient_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT NOT NULL,
    is_pregnant INTEGER DEFAULT 0,
    gestational_weeks INTEGER,
    hemoglobin_gdl REAL,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    weight_kg REAL,
    danger_signs_json TEXT,
    home_remedies_json TEXT,
    notes TEXT,
    risk_flags_json TEXT,
    referral TEXT DEFAULT 'NONE',
    visit_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    is_demo INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_field_visits_asha ON field_visits(asha_user_id, visit_at);
  CREATE INDEX IF NOT EXISTS idx_field_visits_village ON field_visits(village);
`);

export const DANGER_SIGNS = [
  'bleeding', 'severe_headache_blurred_vision', 'convulsions', 'high_fever', 'reduced_fetal_movement',
  'swelling_face_hands', 'breathlessness', 'severe_abdominal_pain', 'leaking_fluid'
] as const;

const DANGER_LABEL: Record<string, string> = {
  bleeding: 'Bleeding',
  severe_headache_blurred_vision: 'Severe headache / blurred vision',
  convulsions: 'Fits / convulsions',
  high_fever: 'High fever',
  reduced_fetal_movement: 'Baby moving less',
  swelling_face_hands: 'Swelling of face or hands',
  breathlessness: 'Breathlessness',
  severe_abdominal_pain: 'Severe abdominal pain',
  leaking_fluid: 'Leaking water'
};

export interface RiskFlag {
  level: 'URGENT' | 'REFER' | 'WATCH';
  code: string;
  text: string;
}

/** MoHFW-aligned high-risk screening on measurable values. Missing values are never assumed normal. */
export function assessRisk(v: { isPregnant: boolean; age: number | null; hb: number | null; sys: number | null; dia: number | null; dangerSigns: string[] }): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const d of v.dangerSigns) {
    if (DANGER_LABEL[d]) flags.push({ level: 'URGENT', code: `danger_${d}`, text: `Danger sign: ${DANGER_LABEL[d]} — take to the nearest FRU/PHC now (call 108/102)` });
  }
  if (v.sys !== null && v.dia !== null) {
    if (v.sys >= 160 || v.dia >= 110) flags.push({ level: 'URGENT', code: 'bp_severe', text: `Very high BP ${v.sys}/${v.dia} — urgent referral` });
    else if (v.sys >= 140 || v.dia >= 90) flags.push({ level: 'REFER', code: 'bp_high', text: v.isPregnant ? `High BP in pregnancy ${v.sys}/${v.dia} — refer to PHC/FRU` : `High BP ${v.sys}/${v.dia} — refer to PHC for NCD check` });
  }
  if (v.hb !== null) {
    if (v.hb < 7) flags.push({ level: 'URGENT', code: 'hb_severe', text: `Severe anaemia (Hb ${v.hb}) — refer to FRU today` });
    else if (v.isPregnant && v.hb < 11) flags.push({ level: 'REFER', code: 'hb_low_preg', text: `Anaemia in pregnancy (Hb ${v.hb}, below 11) — IFA and MO review` });
    else if (!v.isPregnant && v.hb < 10) flags.push({ level: 'WATCH', code: 'hb_low', text: `Low Hb (${v.hb}) — IFA and recheck` });
  }
  if (v.isPregnant && v.age !== null && (v.age < 18 || v.age > 35)) {
    flags.push({ level: 'WATCH', code: 'age_risk', text: `Age ${v.age}: higher-risk pregnancy — ensure 4+ ANC visits and institutional delivery` });
  }
  if (v.isPregnant && v.hb === null) flags.push({ level: 'WATCH', code: 'hb_missing', text: 'Hb not measured — check at next visit' });
  if (v.isPregnant && v.sys === null) flags.push({ level: 'WATCH', code: 'bp_missing', text: 'BP not measured — check at next visit' });
  return flags;
}

const num = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

function cleanVisit(r: any) {
  const name = typeof r?.patientName === 'string' ? r.patientName.trim().slice(0, 80) : '';
  if (!name) throw new Error('patientName is required');
  if (typeof r?.id !== 'string' || !/^[\w-]{8,64}$/.test(r.id)) throw new Error('id must be a client-generated id');
  const bp = typeof r.bloodPressure === 'string' ? r.bloodPressure.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/) : null;
  const isPregnant = r.isPregnant === true;
  return {
    id: r.id,
    version: Math.max(1, Math.floor(Number(r.version) || 1)),
    village: typeof r.village === 'string' && r.village.trim() ? r.village.trim().slice(0, 80) : 'Not recorded',
    household: typeof r.household === 'string' ? r.household.trim().slice(0, 80) : null,
    patientName: name,
    age: num(r.age, 0, 120),
    gender: ['FEMALE', 'MALE', 'OTHER'].includes(r.gender) ? r.gender : 'FEMALE',
    isPregnant,
    gestationalWeeks: isPregnant ? num(r.gestationalWeeks, 1, 45) : null,
    hb: num(r.hemoglobinGdl, 2, 20),
    sys: bp ? num(bp[1], 50, 260) : null,
    dia: bp ? num(bp[2], 30, 160) : null,
    weight: num(r.weightKg, 1, 250),
    dangerSigns: (Array.isArray(r.dangerSigns) ? r.dangerSigns : []).filter((d: unknown) => typeof d === 'string' && (DANGER_SIGNS as readonly string[]).includes(d as string)),
    remedies: (Array.isArray(r.homeRemedies) ? r.homeRemedies : []).filter((x: unknown) => typeof x === 'string').map((x: string) => x.slice(0, 80)).slice(0, 10),
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 1000) : null,
    referral: ['NONE', 'ADVISED', 'REFERRED', 'ACCOMPANIED'].includes(r.referral) ? r.referral : 'NONE',
    visitAt: typeof r.visitAt === 'string' && !Number.isNaN(Date.parse(r.visitAt)) ? new Date(r.visitAt).toISOString() : new Date().toISOString(),
    clientUpdatedAt: typeof r.clientUpdatedAt === 'string' && !Number.isNaN(Date.parse(r.clientUpdatedAt)) ? new Date(r.clientUpdatedAt).toISOString() : new Date().toISOString()
  };
}

const toApi = (r: any) => ({
  id: r.id,
  version: r.version,
  ashaName: r.asha_name,
  village: r.village,
  household: r.household,
  patientName: r.patient_name,
  age: r.age,
  gender: r.gender,
  isPregnant: !!r.is_pregnant,
  gestationalWeeks: r.gestational_weeks,
  hemoglobinGdl: r.hemoglobin_gdl,
  bloodPressure: r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : null,
  weightKg: r.weight_kg,
  dangerSigns: JSON.parse(r.danger_signs_json || '[]'),
  homeRemedies: JSON.parse(r.home_remedies_json || '[]'),
  notes: r.notes,
  riskFlags: JSON.parse(r.risk_flags_json || '[]'),
  referral: r.referral,
  visitAt: r.visit_at,
  clientUpdatedAt: r.client_updated_at,
  receivedAt: r.received_at,
  synced: true
});

const upsert = db.prepare(`
  INSERT INTO field_visits (id, version, asha_user_id, asha_name, village, household, patient_name, age, gender, is_pregnant, gestational_weeks,
    hemoglobin_gdl, bp_systolic, bp_diastolic, weight_kg, danger_signs_json, home_remedies_json, notes, risk_flags_json, referral, visit_at,
    client_updated_at, received_at, is_demo)
  VALUES (@id, @version, @ashaUserId, @ashaName, @village, @household, @patientName, @age, @gender, @isPregnant, @gestationalWeeks,
    @hb, @sys, @dia, @weight, @dangerSigns, @remedies, @notes, @riskFlags, @referral, @visitAt, @clientUpdatedAt, @receivedAt, @isDemo)
  ON CONFLICT(id) DO UPDATE SET
    version = excluded.version, village = excluded.village, household = excluded.household, patient_name = excluded.patient_name,
    age = excluded.age, gender = excluded.gender, is_pregnant = excluded.is_pregnant, gestational_weeks = excluded.gestational_weeks,
    hemoglobin_gdl = excluded.hemoglobin_gdl, bp_systolic = excluded.bp_systolic, bp_diastolic = excluded.bp_diastolic,
    weight_kg = excluded.weight_kg, danger_signs_json = excluded.danger_signs_json, home_remedies_json = excluded.home_remedies_json,
    notes = excluded.notes, risk_flags_json = excluded.risk_flags_json, referral = excluded.referral, visit_at = excluded.visit_at,
    client_updated_at = excluded.client_updated_at, received_at = excluded.received_at
`);

function store(v: ReturnType<typeof cleanVisit>, ashaUserId: string, ashaName: string, isDemo = false) {
  const risk = assessRisk({ isPregnant: v.isPregnant, age: v.age, hb: v.hb, sys: v.sys, dia: v.dia, dangerSigns: v.dangerSigns });
  upsert.run({
    ...v,
    ashaUserId,
    ashaName,
    isPregnant: v.isPregnant ? 1 : 0,
    dangerSigns: JSON.stringify(v.dangerSigns),
    remedies: JSON.stringify(v.remedies),
    riskFlags: JSON.stringify(risk),
    receivedAt: new Date().toISOString(),
    isDemo: isDemo ? 1 : 0
  });
  return risk;
}

// Demo visits (demo servers only), replacing the old fixed records.
if (securityConfig.allowDemo && (db.prepare('SELECT COUNT(*) AS n FROM field_visits').get() as any).n === 0) {
  const demo = [
    { id: 'demo-visit-0001', patientName: 'Sunita Devi', age: 24, gender: 'FEMALE', isPregnant: true, gestationalWeeks: 28, hemoglobinGdl: 6.8, bloodPressure: '148/96', village: 'Nuh Rural - Sector 4', dangerSigns: ['swelling_face_hands'], homeRemedies: ['Gud aur chana'] },
    { id: 'demo-visit-0002', patientName: 'Pooja Kumari', age: 21, gender: 'FEMALE', isPregnant: true, gestationalWeeks: 14, hemoglobinGdl: 11.2, bloodPressure: '118/76', village: 'Nuh Rural - Sector 4' },
    { id: 'demo-visit-0003', patientName: 'Kamla Bai', age: 68, gender: 'FEMALE', isPregnant: false, hemoglobinGdl: 10.4, bloodPressure: '160/100', village: 'Ferozepur Namak - Basti 2' }
  ];
  for (const d of demo) store(cleanVisit({ ...d, visitAt: new Date(Date.now() - 86400000).toISOString() }), 'demo', 'Sunita Devi (ASHA, demo)', true);
}

/**
 * GET /api/asha/records — an ASHA sees her own visits; nurses, doctors and admins see all.
 * Optional ?village=…&since=ISO.
 */
ashaRouter.get('/records', (req: Request, res: Response): void => {
  try {
    const where: string[] = [];
    const args: any[] = [];
    if (req.staff!.role === 'asha') {
      where.push("(asha_user_id = ? OR (is_demo = 1 AND ? = 1))");
      args.push(req.staff!.id, req.staff!.isDemo ? 1 : 0);
    }
    if (typeof req.query.village === 'string' && req.query.village) { where.push('village = ?'); args.push(req.query.village); }
    if (typeof req.query.since === 'string' && !Number.isNaN(Date.parse(req.query.since))) { where.push('received_at > ?'); args.push(req.query.since); }
    const rows = db.prepare(`
      SELECT * FROM field_visits ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY visit_at DESC LIMIT 500
    `).all(...args);
    res.json({ success: true, data: rows.map(toApi), serverTime: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/asha/sync — body { records: [...] } (max 200). Returns one result per record.
 * A record older than what the server already has (lower version, or same version but older
 * client timestamp) is reported as a conflict and the server copy is returned.
 */
ashaRouter.post('/sync', (req: Request, res: Response): void => {
  const input: any[] = Array.isArray(req.body?.records) ? req.body.records.slice(0, 200) : [];
  if (!input.length) {
    res.status(400).json({ error: 'records array is required' });
    return;
  }
  const results: any[] = [];
  const tx = db.transaction(() => {
    for (const raw of input) {
      try {
        const v = cleanVisit(raw);
        const existing: any = db.prepare('SELECT * FROM field_visits WHERE id = ?').get(v.id);
        if (existing && existing.asha_user_id !== req.staff!.id && req.staff!.role === 'asha') {
          results.push({ id: v.id, status: 'rejected', reason: 'Belongs to another worker' });
          continue;
        }
        if (existing && (existing.version > v.version || (existing.version === v.version && existing.client_updated_at > v.clientUpdatedAt))) {
          results.push({ id: v.id, status: 'conflict', server: toApi(existing) });
          continue;
        }
        const risk = store(v, existing?.asha_user_id || req.staff!.id, existing?.asha_name || req.staff!.displayName);
        results.push({ id: v.id, status: 'accepted', version: v.version, riskFlags: risk });
      } catch (e: any) {
        results.push({ id: raw?.id ?? null, status: 'rejected', reason: e.message });
      }
    }
  });
  try {
    tx();
    audit(req, 'asha.sync', null, { received: input.length, accepted: results.filter(r => r.status === 'accepted').length });
    res.json({ success: true, results, serverTime: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Single-record save (same rules as sync), kept for simple clients. */
ashaRouter.post('/record', (req: Request, res: Response): void => {
  try {
    const v = cleanVisit(req.body);
    const risk = store(v, req.staff!.id, req.staff!.displayName);
    res.json({ success: true, id: v.id, riskFlags: risk });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
