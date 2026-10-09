/**
 * DPDP Act 2023 support: consent records, retention clean-up, and patient rights requests
 * (access / correction / erasure of identifiers).
 *
 * Clinical records are kept for the legal retention period even after an erasure request; what is
 * removed immediately is everything that identifies the person (name, phone, ABHA, Aadhaar, raw
 * voice transcripts, document text).
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { securityConfig } from './config';
import { appendAudit } from './audit';
import { purgeInterviews } from '../services/interview.service';

export const CONSENT_VERSION = 'kiosk-consent-2026-10-v1';
export const CONSENT_PURPOSES = ['care', 'abha_link', 'sms', 'research'] as const;
export type ConsentPurpose = typeof CONSENT_PURPOSES[number];

db.exec(`
  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    session_id TEXT,
    version TEXT NOT NULL,
    language TEXT,
    purposes_json TEXT NOT NULL,
    method TEXT NOT NULL,
    recorded_by TEXT,
    given_at TEXT NOT NULL,
    withdrawn_at TEXT,
    withdrawn_purposes_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);

  CREATE TABLE IF NOT EXISTS rights_requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    handled_by TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );
`);

for (const col of ['phone_hash TEXT', 'phone_enc TEXT', 'erased_at TEXT', 'aadhaar_masked TEXT']) {
  try { db.exec(`ALTER TABLE patients ADD COLUMN ${col};`); } catch {}
}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash);'); } catch {}

export interface ConsentInput {
  purposes: Partial<Record<ConsentPurpose, boolean>>;
  language?: string;
  method?: 'kiosk_self' | 'kiosk_assisted' | 'emergency' | 'staff_desk';
  version?: string;
}

/** Normalise the consent sent by the kiosk. `care` is mandatory except for emergencies. */
export function cleanConsent(raw: any): ConsentInput | null {
  if (!raw || typeof raw !== 'object' || !raw.purposes) return null;
  const purposes: Partial<Record<ConsentPurpose, boolean>> = {};
  for (const p of CONSENT_PURPOSES) purposes[p] = raw.purposes[p] === true;
  const method = ['kiosk_self', 'kiosk_assisted', 'emergency', 'staff_desk'].includes(raw.method) ? raw.method : 'kiosk_self';
  return { purposes, language: typeof raw.language === 'string' ? raw.language.slice(0, 8) : undefined, method, version: CONSENT_VERSION };
}

export function recordConsent(patientId: string, sessionId: string | null, c: ConsentInput, recordedBy: string): string {
  const id = `consent-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO consents (id, patient_id, session_id, version, language, purposes_json, method, recorded_by, given_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patientId, sessionId, c.version || CONSENT_VERSION, c.language || null, JSON.stringify(c.purposes), c.method || 'kiosk_self', recordedBy, new Date().toISOString());
  return id;
}

/** Latest effective consent per purpose for a patient (withdrawals applied). */
export function effectiveConsent(patientId: string): Record<ConsentPurpose, boolean> {
  const out: Record<ConsentPurpose, boolean> = { care: false, abha_link: false, sms: false, research: false };
  const rows = db.prepare('SELECT purposes_json, withdrawn_purposes_json FROM consents WHERE patient_id = ? ORDER BY given_at ASC').all(patientId) as any[];
  for (const r of rows) {
    const given = JSON.parse(r.purposes_json || '{}');
    const withdrawn: string[] = JSON.parse(r.withdrawn_purposes_json || '[]');
    for (const p of CONSENT_PURPOSES) {
      if (given[p] === true) out[p] = true;
      else if (given[p] === false) out[p] = false;
      if (withdrawn.includes(p)) out[p] = false;
    }
  }
  return out;
}

export function withdrawConsent(patientId: string, purposes: ConsentPurpose[], actor: string): void {
  const latest: any = db.prepare('SELECT id, withdrawn_purposes_json FROM consents WHERE patient_id = ? ORDER BY given_at DESC LIMIT 1').get(patientId);
  if (!latest) return;
  const prev: string[] = JSON.parse(latest.withdrawn_purposes_json || '[]');
  const next = Array.from(new Set([...prev, ...purposes.filter(p => p !== 'care')]));
  db.prepare('UPDATE consents SET withdrawn_purposes_json = ?, withdrawn_at = ? WHERE id = ?').run(JSON.stringify(next), new Date().toISOString(), latest.id);
  appendAudit({ action: 'privacy.consent_withdrawn', entityId: patientId, actor, metadata: { purposes: next } });
}

/** Everything held about one patient, for a right-to-access request. */
export function exportPatientData(patientId: string): Record<string, unknown> | null {
  const patient: any = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!patient) return null;
  const { phone_enc, phone_hash, ...patientPublic } = patient;
  return {
    exportedAt: new Date().toISOString(),
    patient: patientPublic,
    consents: db.prepare('SELECT * FROM consents WHERE patient_id = ? ORDER BY given_at').all(patientId),
    visits: db.prepare('SELECT * FROM sessions WHERE patient_id = ? ORDER BY created_at').all(patientId),
    consultations: (db.prepare('SELECT id, session_id, doctor_name, department, case_sheet_json, created_at FROM encounters WHERE patient_id = ? ORDER BY created_at').all(patientId) as any[])
      .map(e => ({ ...e, case_sheet_json: undefined, caseSheet: JSON.parse(e.case_sheet_json || '{}') })),
    documents: db.prepare('SELECT id, document_type, metadata_json, created_at FROM documents WHERE patient_id = ?').all(patientId)
  };
}

/**
 * Remove direct identifiers now. The clinical content stays (under a pseudonym) until the legal
 * retention period ends, after which `runRetention` deletes it.
 */
export function eraseIdentifiers(patientId: string, actor: string, note?: string): boolean {
  const p: any = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
  if (!p) return false;
  const pseudonym = `Erased patient ${crypto.createHash('sha256').update(patientId).digest('hex').slice(0, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`DELETE FROM ephemeral_drafts WHERE phone_hash IS NOT NULL AND phone_hash = (SELECT phone_hash FROM patients WHERE id = ?)`).run(patientId);
    db.prepare(`UPDATE patients SET name = ?, abha_id = NULL, abha_address = NULL, phone_masked = NULL, phone_hash = NULL, phone_enc = NULL, aadhaar_masked = NULL, erased_at = ? WHERE id = ?`)
      .run(pseudonym, now, patientId);
    db.prepare(`UPDATE sessions SET raw_transcript = NULL WHERE patient_id = ?`).run(patientId);
    db.prepare(`UPDATE documents SET extracted_text = NULL WHERE patient_id = ?`).run(patientId);
    db.prepare(`UPDATE consents SET withdrawn_at = ?, withdrawn_purposes_json = ? WHERE patient_id = ?`).run(now, JSON.stringify(['abha_link', 'sms', 'research']), patientId);
    db.prepare(`INSERT INTO rights_requests (id, patient_id, kind, status, note, handled_by, created_at, completed_at) VALUES (?, ?, 'erasure', 'COMPLETED', ?, ?, ?, ?)`)
      .run(`rr-${crypto.randomUUID()}`, patientId, note || null, actor, now, now);
  })();
  appendAudit({ action: 'privacy.identifiers_erased', entityId: patientId, actor, metadata: { note: note || null } });
  return true;
}

/** Periodic clean-up. Safe to run often. */
export function runRetention(): Record<string, number> {
  const now = Date.now();
  const draftCutoff = new Date(now - securityConfig.draftRetentionHours * 3600000).toISOString();
  const abandonedCutoff = new Date(now - securityConfig.abandonedSessionDays * 86400000).toISOString();
  const clinicalCutoff = new Date(now - securityConfig.clinicalRetentionYears * 365.25 * 86400000).toISOString();
  const sessionCutoff = new Date(now - 30 * 86400000).toISOString();

  const result = db.transaction(() => ({
    draftsDeleted: db.prepare('DELETE FROM ephemeral_drafts WHERE updated_at < ?').run(draftCutoff).changes,
    interviewsDeleted: purgeInterviews(securityConfig.draftRetentionHours),
    abandonedVisitsClosed: db.prepare(`UPDATE sessions SET status = 'NOT_SEEN' WHERE status IN ('PENDING_DOCTOR', 'IN_CONSULTATION') AND created_at < ?`).run(abandonedCutoff).changes,
    staffSessionsDeleted: db.prepare('DELETE FROM staff_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)').run(sessionCutoff, sessionCutoff).changes,
    // Past the legal retention period with no newer visit: delete the clinical record entirely.
    expiredPatientsDeleted: db.prepare(`
      DELETE FROM patients WHERE created_at < ? AND id NOT IN (SELECT patient_id FROM sessions WHERE created_at >= ?)
    `).run(clinicalCutoff, clinicalCutoff).changes
  }))();

  if (Object.values(result).some(n => n > 0)) {
    appendAudit({ action: 'privacy.retention_run', actor: 'system', metadata: result });
  }
  return result;
}

export function startRetentionSchedule(): void {
  try { runRetention(); } catch (e) { console.error('[Retention] Initial run failed', e); }
  setInterval(() => {
    try { runRetention(); } catch (e) { console.error('[Retention] Scheduled run failed', e); }
  }, 6 * 3600000).unref();
}
