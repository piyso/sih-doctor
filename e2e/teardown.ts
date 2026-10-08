import { execFileSync } from 'child_process';
import path from 'path';

/** Remove everything the tests created from the local development database. */
export default async function teardown() {
  const db = process.env.E2E_DB_PATH || path.resolve(__dirname, '../backend/data/hospital.db');
  const sql = `
    PRAGMA foreign_keys = ON;
    DELETE FROM consents WHERE patient_id IN (SELECT id FROM patients WHERE name LIKE 'E2E-%');
    DELETE FROM alerts WHERE message LIKE '%E2E-%' OR session_id IN (SELECT s.id FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE p.name LIKE 'E2E-%');
    DELETE FROM patients WHERE name LIKE 'E2E-%';
    DELETE FROM field_visits WHERE patient_name LIKE 'E2E-%';
  `;
  try {
    execFileSync('sqlite3', [db, sql]);
  } catch (e) {
    console.warn('[e2e teardown] cleanup skipped:', (e as Error).message);
  }
}
