/**
 * Mock / Real mode of a demonstration server, switchable while the server runs.
 *
 * MOCK (demo mode on)  — the ten sample patients wait in the queue, demo seed / restore endpoints
 *       answer, and the kiosk offers sample profiles and a demo OTP.
 * REAL (demo mode off) — no mock data anywhere: the sample visits are parked out of every queue,
 *       board and report, demo endpoints return 404, and only patients who actually check in
 *       appear. Nothing is deleted, so switching back restores the sample patients exactly.
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
import { DEMO_CARE_STREAMS, restoreDemoQueue, applyDemoCareStreams, seedDatabase } from '../db/seed';
import { ensureDemoStaff } from '../db/demoStaff';
import { publish } from './eventBus.service';

db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);`);

const KEY = 'demo_mode';
/** Demo visits taken out of the queue while demonstration mode is off. No query lists this status. */
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

const demoIds = () => Object.keys(DEMO_CARE_STREAMS);

/** Take open demo visits out of the queue (and out of claims), without touching their records. */
function parkDemoVisits(): number {
  const ids = demoIds();
  return db.prepare(`
    UPDATE sessions SET status = '${DEMO_PARKED}', claimed_by = NULL, claimed_by_name = NULL, claimed_at = NULL
    WHERE id IN (${ids.map(() => '?').join(',')}) AND status IN ('PENDING_DOCTOR', 'IN_CONSULTATION', 'DIVERTED_EMERGENCY')
  `).run(...ids).changes;
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
    applyDemoCareStreams();
  } else {
    parkDemoVisits();
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
      restored = restoreDemoQueue(); // never wipes real records
    } else {
      parked = parkDemoVisits();
    }
  })();

  appendAudit({ action: 'system.demo_mode', actor: actor.id, actorRole: actor.role, ip, outcome: 'success', metadata: { on, restored, parked } });
  publish({ type: 'system.mode', demoMode: on });
  publish({ type: 'queue.changed', reason: on ? 'demo_mode_on' : 'demo_mode_off' });
  return { ...getDemoModeState(), restored, parked };
}
