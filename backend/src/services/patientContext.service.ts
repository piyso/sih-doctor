/**
 * Patient clinical context for safety checks: demographics, pregnancy and lactation, weight,
 * known conditions, and renal function derived from the most recent creatinine on file.
 *
 * eGFR uses the race-free CKD-EPI 2021 creatinine equation (Inker et al., NEJM 2021):
 *   eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age × 1.012 [if female]
 *   κ = 0.7 (female) / 0.9 (male); α = −0.241 (female) / −0.302 (male)
 */

import { db } from '../db/database';
import { PatientClinicalContext } from './core/clinicalOntology.engine';

export interface PatientContextResult extends PatientClinicalContext {
  patientId: string;
  sources: string[];
  knownConditions: string[];
  latestCreatinine?: { value: number; unit: string; recordedAt: string | null };
  eGfrMethod?: 'CKD-EPI-2021' | 'reported';
  missing: string[];
}

export function ckdEpi2021(creatinineMgDl: number, age: number, sex: 'male' | 'female'): number {
  const k = sex === 'female' ? 0.7 : 0.9;
  const a = sex === 'female' ? -0.241 : -0.302;
  const r = creatinineMgDl / k;
  const egfr = 142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, age) * (sex === 'female' ? 1.012 : 1);
  return Math.round(egfr);
}

const safe = <T>(raw: any, fallback: T): T => { if (!raw) return fallback; try { return JSON.parse(raw); } catch { return fallback; } };

export function buildPatientContext(patientId: string): PatientContextResult | null {
  const p: any = db.prepare('SELECT id, age, gender, is_pregnant, gestational_weeks, is_lactating, weight_kg FROM patients WHERE id = ?').get(patientId);
  if (!p) return null;
  const sources: string[] = ['patient record'];
  const missing: string[] = [];
  const gender = String(p.gender || '').toLowerCase();
  const sex: 'male' | 'female' | undefined = gender === 'male' ? 'male' : gender === 'female' ? 'female' : undefined;
  const age = Number.isFinite(Number(p.age)) && Number(p.age) > 0 ? Number(p.age) : undefined;
  if (age === undefined) missing.push('age');

  // Known conditions from the newest kiosk history (legacy or structured).
  const sessions = db.prepare('SELECT history_json FROM sessions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5').all(patientId) as any[];
  const conditions = new Set<string>();
  for (const s of sessions) {
    const h = safe<any>(s.history_json, null);
    if (!h) continue;
    for (const c of h.conditions || []) if (typeof c === 'string' && c && c !== 'None') conditions.add(c);
    for (const c of h.pastMedical || []) if (c?.name) conditions.add(String(c.name));
  }
  if (conditions.size) sources.push('kiosk history');

  // Most recent creatinine / eGFR from digitized documents.
  const docs = db.prepare('SELECT metadata_json, created_at FROM documents WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20').all(patientId) as any[];
  let eGfr: number | undefined;
  let eGfrMethod: PatientContextResult['eGfrMethod'];
  let latestCreatinine: PatientContextResult['latestCreatinine'];
  for (const d of docs) {
    const markers: any[] = safe<any>(d.metadata_json, {}).labMarkers || [];
    const reported = markers.find(m => /\begfr\b/i.test(String(m?.testName || '')) && Number.isFinite(Number(m?.value)));
    const creat = markers.find(m => /creatinine/i.test(String(m?.testName || '')) && Number.isFinite(Number(m?.value)));
    if (creat) {
      const value = Number(creat.value);
      const unit = String(creat.unit || 'mg/dL');
      const mgdl = /umol|µmol|μmol/i.test(unit) ? value / 88.4 : value;
      latestCreatinine = { value, unit, recordedAt: d.created_at || null };
      if (age !== undefined && sex && mgdl > 0) { eGfr = ckdEpi2021(mgdl, age, sex); eGfrMethod = 'CKD-EPI-2021'; }
      sources.push('lab report');
      break;
    }
    if (reported) { eGfr = Number(reported.value); eGfrMethod = 'reported'; sources.push('lab report'); break; }
  }
  if (eGfr === undefined) missing.push('renal function');

  const gestationalWeeks = Number(p.gestational_weeks) || undefined;
  const isPregnant = !!p.is_pregnant;
  return {
    patientId,
    age,
    gender: sex || (gender || undefined),
    isPregnant,
    gestationalWeeks,
    trimester: isPregnant && gestationalWeeks ? (gestationalWeeks <= 12 ? 1 : gestationalWeeks <= 27 ? 2 : 3) : undefined,
    isLactating: !!p.is_lactating,
    weightKg: Number(p.weight_kg) || undefined,
    eGfr,
    eGfrMethod,
    latestCreatinine,
    isDiabetic: Array.from(conditions).some(c => /diabet|sugar|prameha|madhumeha/i.test(c)),
    knownConditions: Array.from(conditions),
    sources,
    missing
  };
}

/** Accepts an explicit context object from a request body, keeping only known fields. */
export function cleanContext(raw: any): PatientClinicalContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: PatientClinicalContext = {};
  if (Number.isFinite(Number(raw.age))) out.age = Number(raw.age);
  if (typeof raw.gender === 'string') out.gender = raw.gender.toLowerCase();
  if (raw.isPregnant === true) out.isPregnant = true;
  if (Number.isFinite(Number(raw.gestationalWeeks))) out.gestationalWeeks = Number(raw.gestationalWeeks);
  if (raw.isLactating === true) out.isLactating = true;
  if (Number.isFinite(Number(raw.eGfr))) out.eGfr = Number(raw.eGfr);
  if (Number.isFinite(Number(raw.weightKg))) out.weightKg = Number(raw.weightKg);
  if (raw.isDiabetic === true) out.isDiabetic = true;
  return Object.keys(out).length ? out : undefined;
}
