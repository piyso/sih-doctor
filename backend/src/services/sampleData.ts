/**
 * Sample ("mock") records, and the one rule that keeps them out of Real mode.
 *
 * A patient is a sample record when the demo seed loaded it or when it was created while the
 * server was in Mock mode (patients.is_demo = 1). Visits, prescriptions, documents, alerts and
 * every figure derived from them belong to the world of their patient. Mock mode shows both
 * worlds; Real mode shows only real records:
 *
 *   - lists and reports leave sample rows out (realOnly() below, or the DEMO_PARKED visit status
 *     that services/demoMode.service.ts gives every sample visit while Real mode is on);
 *   - a request that names a sample record by id is answered 404 (hideSampleRecords), so a
 *     screen left open from Mock mode can neither keep showing a sample patient nor write to one;
 *   - a check-in never joins the two worlds (worldOf / abhaForNewPatient).
 *
 * A hospital installation has no Mock mode, flags nothing and filters nothing.
 */

import type { RequestHandler } from 'express';
import { db } from '../db/database';
import { securityConfig } from '../security/config';

/** True while sample records must stay out of sight (Real mode). */
export const samplesHidden = (): boolean => !securityConfig.allowDemo;

/** The flag for a record created now: 1 in Mock mode, 0 in Real mode. */
export const sampleFlag = (): 0 | 1 => (securityConfig.allowDemo ? 1 : 0);

/**
 * SQL condition for "this row may be shown now", given the column that holds its patient id.
 * Rows without a patient (the column is NULL) are always shown.
 */
export const realOnly = (patientIdColumn: string): string =>
  samplesHidden() ? `(${patientIdColumn} IS NULL OR ${patientIdColumn} NOT IN (SELECT id FROM patients WHERE is_demo = 1))` : '1 = 1';

export const isSamplePatient = (patientId: string): boolean =>
  !!db.prepare('SELECT 1 FROM patients WHERE id = ? AND is_demo = 1').get(patientId);

/** Tables whose rows are addressed by id in the API, with how to tell that a row is a sample record. */
const LOOKUPS = [
  'SELECT 1 FROM patients WHERE id = ? AND is_demo = 1',
  'SELECT 1 FROM sessions WHERE id = ? AND is_demo = 1',
  'SELECT 1 FROM encounters e JOIN patients p ON p.id = e.patient_id WHERE e.id = ? AND p.is_demo = 1',
  'SELECT 1 FROM alerts WHERE id = ? AND is_demo = 1',
  'SELECT 1 FROM field_visits WHERE id = ? AND is_demo = 1',
  'SELECT 1 FROM abdm_care_contexts c JOIN patients p ON p.id = c.patient_id WHERE c.id = ? AND p.is_demo = 1'
];

const prepared = new Map<string, ReturnType<typeof db.prepare>>();
const lookup = (sql: string) => {
  let stmt = prepared.get(sql);
  if (!stmt) { stmt = db.prepare(sql); prepared.set(sql, stmt); }
  return stmt;
};

/** Whether an id names a sample patient, visit, prescription, alert, field visit or care context. */
export function isSampleRecordId(id: string): boolean {
  if (!id || id.length > 80) return false;
  for (const sql of LOOKUPS) {
    try { if (lookup(sql).get(id)) return true; } catch { /* that table belongs to a module that is not loaded yet */ }
  }
  return false;
}

const ID_KEY = /^(session|patient|encounter|alert|visit)_?id$/i;

/** The ids a request names: path segments, and sessionId / patientId / encounterId… in the query or body. */
function namedIds(req: { path: string; query: any; body: any }): string[] {
  const ids: string[] = [];
  for (const seg of req.path.split('/')) {
    if (!seg) continue;
    try { ids.push(decodeURIComponent(seg)); } catch { ids.push(seg); }
  }
  for (const bag of [req.query, req.body]) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag) || Buffer.isBuffer(bag)) continue;
    for (const [k, v] of Object.entries(bag)) if (ID_KEY.test(k) && typeof v === 'string') ids.push(v);
  }
  return ids;
}

/**
 * Real mode: any API request that names a sample record is answered 404, before it reaches a
 * route. This is what stops a doctor desk left open from Mock mode from showing, changing or
 * signing for a sample patient once the server is in Real mode.
 */
export const hideSampleRecords: RequestHandler = (req, res, next) => {
  if (!samplesHidden()) return next();
  if (namedIds(req).some(isSampleRecordId)) {
    res.status(404).json({ error: 'This is a sample record. Sample data is hidden in Real mode.', code: 'SAMPLE_HIDDEN' });
    return;
  }
  next();
};

/**
 * ABHA numbers are unique. A patient about to be created in the current mode gets the number
 * unless a patient of the other world holds it: a real person takes it over from a sample record,
 * and a sample check-in never takes a real patient's number (it is stored without one).
 */
export function abhaForNewPatient(abhaId: string | null): string | null {
  if (!abhaId) return null;
  const holder: any = db.prepare('SELECT id, is_demo FROM patients WHERE abha_id = ?').get(abhaId);
  if (!holder || holder.is_demo === sampleFlag()) return abhaId;
  if (holder.is_demo === 1) {
    db.prepare('UPDATE patients SET abha_id = NULL WHERE id = ?').run(holder.id);
    return abhaId;
  }
  return null;
}
