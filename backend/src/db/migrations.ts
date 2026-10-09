/**
 * Versioned schema migrations.
 *
 * Each step runs once, inside a transaction, and is recorded in `schema_migrations`. Modules still
 * create their own tables with CREATE TABLE IF NOT EXISTS (harmless and keeps them self-contained);
 * this file is the ordered record of what changed and the place for anything that must run exactly
 * once (data backfills, index rebuilds). `SCHEMA_VERSION` is reported by /health and the admin
 * system page so an operator can see which schema a site runs.
 */

import type Database from 'better-sqlite3';

export interface Migration { version: number; name: string; up: (db: Database.Database) => void }

export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'baseline (patients, sessions, documents, encounters, audit, provenance)', up: () => undefined },
  { version: 2, name: 'staff accounts, sessions, kiosk devices, consents, rights requests', up: () => undefined },
  { version: 3, name: 'departments, tokens, alerts, dispenses, field visits, sms log', up: () => undefined },
  {
    version: 4, name: 'structured history v2 on sessions.history_json; NEWS2 inside vitals_json',
    up: (db) => {
      // Backfill: legacy history objects get the v2 marker lazily on read (normaliseHistory); nothing destructive here.
      db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_patient_created ON sessions(patient_id, created_at);');
    }
  },
  {
    version: 5, name: 'interview_sessions (encrypted interview state)',
    up: (db) => db.exec(`CREATE TABLE IF NOT EXISTS interview_sessions (id TEXT PRIMARY KEY, state_enc TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`)
  },
  {
    version: 6, name: 'terminology search index (FTS5 trigram) + seed version marker',
    up: (db) => db.exec(`CREATE TABLE IF NOT EXISTS terminology_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`)
  },
  {
    version: 7, name: 'ABDM HIP: care contexts, consent artefacts, health-information requests',
    up: (db) => db.exec(`
      CREATE TABLE IF NOT EXISTS abdm_care_contexts (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, session_id TEXT, encounter_id TEXT UNIQUE, abha_address TEXT, abha_number TEXT, reference TEXT NOT NULL, display TEXT NOT NULL, hi_types_json TEXT NOT NULL, link_status TEXT NOT NULL, gateway_request_id TEXT, created_at TEXT NOT NULL, linked_at TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS abdm_consents (consent_id TEXT PRIMARY KEY, patient_id TEXT, abha_address TEXT NOT NULL, hi_types_json TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL, data_erase_at TEXT, care_context_refs_json TEXT NOT NULL, status TEXT NOT NULL, artefact_json TEXT NOT NULL, received_at TEXT NOT NULL, revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS abdm_hi_requests (transaction_id TEXT PRIMARY KEY, consent_id TEXT NOT NULL, request_id TEXT, status TEXT NOT NULL, entries_pushed INTEGER DEFAULT 0, error TEXT, requested_at TEXT NOT NULL, completed_at TEXT);
    `)
  },
  {
    version: 8, name: 'doctor desk: patient claims, prescription drafts, order sets, ADR reports, notifiable events, recording consent, HPR ids',
    up: (db) => {
      for (const col of ['claimed_by TEXT', 'claimed_by_name TEXT', 'claimed_at TEXT']) { try { db.exec(`ALTER TABLE sessions ADD COLUMN ${col};`); } catch { /* exists */ } }
      try { db.exec('ALTER TABLE staff_users ADD COLUMN hpr_id TEXT;'); } catch { /* exists or table created later */ }
      db.exec(`
        CREATE TABLE IF NOT EXISTS rx_drafts (session_id TEXT NOT NULL, staff_id TEXT NOT NULL, draft_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (session_id, staff_id));
        CREATE TABLE IF NOT EXISTS order_sets (id TEXT PRIMARY KEY, owner_staff_id TEXT, care_stream TEXT NOT NULL, name TEXT NOT NULL, condition TEXT, items_json TEXT NOT NULL, source TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS adr_reports (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, session_id TEXT, encounter_id TEXT, channel TEXT NOT NULL, report_json TEXT NOT NULL, status TEXT NOT NULL, reporter_id TEXT NOT NULL, reporter_name TEXT NOT NULL, created_at TEXT NOT NULL, submitted_at TEXT, reference_no TEXT);
        CREATE TABLE IF NOT EXISTS notifiable_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, patient_id TEXT NOT NULL, session_id TEXT, encounter_id TEXT, status TEXT NOT NULL, details_json TEXT NOT NULL, reference_no TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_by TEXT);
        CREATE TABLE IF NOT EXISTS recording_consents (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, patient_id TEXT NOT NULL, purpose TEXT NOT NULL, given INTEGER NOT NULL, method TEXT NOT NULL, recorded_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_notifiable_status ON notifiable_events(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_encounters_doctor_created ON encounters(doctor_id, created_at);
      `);
    }
  }
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function runMigrations(db: Database.Database): { applied: number[]; current: number } {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);');
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(r => r.version));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, new Date().toISOString());
    })();
    applied.push(m.version);
  }
  return { applied, current: SCHEMA_VERSION };
}

export function appliedMigrations(db: Database.Database): Array<{ version: number; name: string; appliedAt: string }> {
  return (db.prepare('SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version').all() as any[]);
}
