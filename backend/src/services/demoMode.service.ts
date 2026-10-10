/**
 * Mock / Real mode of a demonstration server, switchable while the server runs.
 *
 * MOCK (demo mode on)  — the ten sample patients wait in the queue, demo seed / restore endpoints
 *       answer, and the kiosk offers sample profiles and a demo OTP. Whatever is created now —
 *       a kiosk check-in, a prescription, an SOS alert — is a sample record too.
 * REAL (demo mode off) — no mock data anywhere: every sample visit (the seeded ten and anything
 *       made in Mock mode) is parked out of every queue, board and report, requests that name a
 *       sample record get 404 (services/sampleData.ts), demo endpoints return 404, and only
 *       patients who check in now appear. Nothing is deleted: switching back gives every visit
 *       its status again and re-opens the ten seeded patients.
 *
 * Staff sign in the same way in both modes: on a demonstration server the demo accounts stay
 * usable (securityConfig.demoAccountsOpen), so switching never signs anyone out or locks them out.
 *
 * ALLOW_DEMO_DATA gives the starting mode. The last choice is stored in the database and wins
 * after a restart, but only on a demonstration server (DEMO_TOGGLE): a hospital installation
 * always gets the environment's value and has no switch.
 */

import { db } from '../db/database';
import { securityConfig, setRuntimeDemoMode } from '../security/config';
import { AuthService } from '../security/auth.service';
import { appendAudit } from '../security/audit';
import { restoreDemoQueue, applyDemoCareStreams, seedDatabase } from '../db/seed';
import { ensureDemoStaff } from '../db/demoStaff';
import { publish } from './eventBus.service';

db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);`);

const KEY = 'demo_mode';
/**
 * The status of every sample visit while Real mode is on (its own status waits in parked_status).
 * No queue, board or report lists it.
 */
export const DEMO_PARKED = 'DEMO_PARKED';

export interface DemoModeState {
  demoMode: boolean;
  /** Whether the switch exists on this server (DEMO_TOGGLE). */
  demoToggle: boolean;
  kioskOpen: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

export class DemoModeError extends Error {
  constructor(public code: 'TOGGLE_DISABLED', message: string) { super(message); }
}

const stored = (): { value: string; updated_at: string; updated_by: string | null } | undefined =>
  db.prepare('SELECT value, updated_at, updated_by FROM system_settings WHERE key = ?').get(KEY) as any;

export function getDemoModeState(): DemoModeState {
  const row = stored();
  return {
    demoMode: securityConfig.allowDemo,
    demoToggle: securityConfig.demoToggle,
    kioskOpen: securityConfig.kioskOpen,
    changedAt: row?.updated_at || null,
    changedBy: row?.updated_by || null
  };
}

/**
 * Take every sample visit out of sight, whatever state it is in — waiting, in consultation, signed
 * or closed — and remember that state. Claims are released; the records themselves are untouched.
 * Returns how many visits were waiting or being seen (the ones a screen was showing in a queue).
 */
function parkSampleVisits(): number {
  const open = (db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 1 AND status IN ('PENDING_DOCTOR', 'IN_CONSULTATION', 'DIVERTED_EMERGENCY')`).get() as any).n as number;
  db.prepare(`
    UPDATE sessions SET parked_status = status, status = '${DEMO_PARKED}', claimed_by = NULL, claimed_by_name = NULL, claimed_at = NULL
    WHERE is_demo = 1 AND status != '${DEMO_PARKED}'
  `).run();
  return open;
}

/** Give parked sample visits their own status back (Mock mode). */
function unparkSampleVisits(): number {
  return db.prepare(`UPDATE sessions SET status = parked_status, parked_status = NULL WHERE status = '${DEMO_PARKED}' AND parked_status IS NOT NULL`).run().changes;
}

/**
 * Called once at start-up, before the server listens: apply the stored choice where the switch is
 * allowed, then make sure the data matches the mode.
 */
export function initDemoMode(): void {
  const row = stored();
  if (securityConfig.demoToggle && row) setRuntimeDemoMode(row.value === 'on');
  if (securityConfig.allowDemo) {
    const sessions = (db.prepare('SELECT count(*) AS n FROM sessions').get() as any)?.n || 0;
    if (sessions === 0) {
      console.log('[Database] Fresh database: loading demo patients (demonstration mode is on).');
      seedDatabase();
    }
    unparkSampleVisits();
    applyDemoCareStreams();
  } else {
    parkSampleVisits();
  }
  // Wherever the demo accounts may sign in they must exist, also when real accounts were made first.
  if (securityConfig.demoAccountsOpen && AuthService.countUsers() > 0) ensureDemoStaff();
}

/**
 * Switch between Mock mode (on) and Real mode (off). Only a demonstration server has the switch;
 * there the demo accounts stay usable in both modes (securityConfig.demoAccountsOpen), so
 * switching to Real can never lock the administrators out. Asking for the mode that is already
 * active changes nothing and is not an error.
 */
export function setDemoMode(on: boolean, actor: { id: string; name: string; role: string }, ip?: string): DemoModeState & { restored: number; parked: number } {
  if (!securityConfig.demoToggle) {
    throw new DemoModeError('TOGGLE_DISABLED', 'This server has no Mock / Real switch (it is not a demonstration server). Its mode is set by ALLOW_DEMO_DATA in the server settings.');
  }
  if (on === securityConfig.allowDemo) return { ...getDemoModeState(), restored: 0, parked: 0 };

  let restored = 0;
  let parked = 0;
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .run(KEY, on ? 'on' : 'off', now, actor.name);
    setRuntimeDemoMode(on);
    if (on) {
      ensureDemoStaff();
      unparkSampleVisits();
      restored = restoreDemoQueue(); // never wipes real records
    } else {
      parked = parkSampleVisits();
    }
  })();

  appendAudit({ action: 'system.demo_mode', actor: actor.id, actorRole: actor.role, ip, outcome: 'success', metadata: { on, restored, parked } });
  publish({ type: 'system.mode', demoMode: on });
  publish({ type: 'queue.changed', reason: on ? 'demo_mode_on' : 'demo_mode_off' });
  return { ...getDemoModeState(), restored, parked };
}
