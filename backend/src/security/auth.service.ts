/**
 * Staff accounts, staff sessions and kiosk device enrolment.
 *
 * - PINs/passwords are hashed with scrypt and a per-user salt; comparisons are constant-time.
 * - Session and device tokens are 256-bit random values; only their SHA-256 is stored, so a copy of
 *   the database cannot be used to log in.
 * - Repeated wrong PINs lock the account for a while.
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { securityConfig, StaffRole, STAFF_ROLES } from './config';
import { appendAudit } from './audit';

db.exec(`
  CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    qualification TEXT,
    registration_no TEXT,
    pin_hash TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    must_change_pin INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TEXT,
    is_demo INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS staff_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    revoked_at TEXT,
    FOREIGN KEY(user_id) REFERENCES staff_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS kiosk_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    enrolled_by TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    revoked_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id);
`);
try { db.exec('ALTER TABLE staff_users ADD COLUMN hpr_id TEXT;'); } catch { /* exists */ }

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: StaffRole;
  department: string | null;
  qualification: string | null;
  registrationNo: string | null;
  /** ABDM Healthcare Professionals Registry id (written into FHIR Practitioner.identifier). */
  hprId: string | null;
  mustChangePin: boolean;
  active: boolean;
  isDemo: boolean;
  lastLoginAt: string | null;
}

export interface KioskDevice {
  id: string;
  name: string;
  location: string | null;
}

const toUser = (r: any): StaffUser => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  role: r.role,
  department: r.department,
  qualification: r.qualification,
  registrationNo: r.registration_no,
  hprId: r.hpr_id || null,
  mustChangePin: !!r.must_change_pin,
  active: !!r.active,
  isDemo: !!r.is_demo,
  lastLoginAt: r.last_login_at
});

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
}

const WEAK_PINS = new Set(['000000', '111111', '123456', '654321', '123123', '121212', '112233', 'password', 'password1', '12345678']);

/** Returns an error message, or null when the secret is acceptable. */
export function pinPolicyError(pin: unknown): string | null {
  if (typeof pin !== 'string') return 'PIN is required.';
  const p = pin.trim();
  const numeric = /^\d+$/.test(p);
  if (numeric && p.length < 6) return 'A numeric PIN must have at least 6 digits.';
  if (!numeric && p.length < 8) return 'A password must have at least 8 characters.';
  if (p.length > 128) return 'PIN/password is too long.';
  if (WEAK_PINS.has(p.toLowerCase()) || /^(.)\1+$/.test(p)) return 'This PIN is too easy to guess. Choose another.';
  if (numeric && '01234567890'.includes(p)) return 'Sequential PINs are not allowed.';
  return null;
}

export const AuthService = {
  countUsers(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM staff_users').get() as { n: number }).n;
  },

  createUser(input: {
    username: string; displayName: string; role: StaffRole; pin: string;
    department?: string; qualification?: string; registrationNo?: string; mustChangePin?: boolean; isDemo?: boolean;
  }): StaffUser {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3-40 letters, digits, dot, dash or underscore.');
    if (!STAFF_ROLES.includes(input.role)) throw new Error('Unknown role.');
    if (!input.displayName?.trim()) throw new Error('Display name is required.');
    if (!input.isDemo) {
      const err = pinPolicyError(input.pin);
      if (err) throw new Error(err);
    }
    const id = `staff-${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO staff_users (id, username, display_name, role, department, qualification, registration_no, pin_hash, pin_salt, must_change_pin, is_demo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, username, input.displayName.trim(), input.role, input.department || null, input.qualification || null,
      input.registrationNo || null, hashPin(input.pin.trim(), salt), salt, input.mustChangePin ? 1 : 0, input.isDemo ? 1 : 0,
      new Date().toISOString()
    );
    return this.getUser(id)!;
  },

  getUser(id: string): StaffUser | null {
    const r = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(id);
    return r ? toUser(r) : null;
  },

  listUsers(): StaffUser[] {
    return (db.prepare('SELECT * FROM staff_users ORDER BY role, display_name').all() as any[]).map(toUser);
  },

  updateUser(id: string, patch: Partial<{ displayName: string; role: StaffRole; department: string; qualification: string; registrationNo: string; hprId: string; active: boolean }>): StaffUser | null {
    const current: any = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(id);
    if (!current) return null;
    if (patch.role && !STAFF_ROLES.includes(patch.role)) throw new Error('Unknown role.');
    db.prepare(`
      UPDATE staff_users SET display_name = ?, role = ?, department = ?, qualification = ?, registration_no = ?, active = ? WHERE id = ?
    `).run(
      patch.displayName?.trim() || current.display_name,
      patch.role || current.role,
      patch.department ?? current.department,
      patch.qualification ?? current.qualification,
      patch.registrationNo ?? current.registration_no,
      patch.active === undefined ? current.active : patch.active ? 1 : 0,
      id
    );
    if (patch.hprId !== undefined) {
      const hpr = String(patch.hprId || '').trim();
      if (hpr && !/^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$|^[A-Za-z0-9.\-@_]{6,64}$/.test(hpr)) throw new Error('HPR id should look like 71-1234-5678-9012 (or the HPR address).');
      db.prepare('UPDATE staff_users SET hpr_id = ? WHERE id = ?').run(hpr || null, id);
    }
    if (patch.active === false) this.revokeAllSessions(id);
    return this.getUser(id);
  },

  setPin(id: string, pin: string, mustChange: boolean): void {
    const err = pinPolicyError(pin);
    if (err) throw new Error(err);
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE staff_users SET pin_hash = ?, pin_salt = ?, must_change_pin = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(hashPin(pin.trim(), salt), salt, mustChange ? 1 : 0, id);
  },

  verifyPin(id: string, pin: string): boolean {
    const r: any = db.prepare('SELECT pin_hash, pin_salt FROM staff_users WHERE id = ?').get(id);
    if (!r) return false;
    const candidate = Buffer.from(hashPin(String(pin).trim(), r.pin_salt), 'hex');
    const stored = Buffer.from(r.pin_hash, 'hex');
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  },

  /**
   * Check credentials and open a session. Unknown usernames still pay the hashing cost so response
   * time does not reveal which usernames exist.
   */
  login(username: string, pin: string, meta: { ip?: string; userAgent?: string }):
    | { ok: true; token: string; user: StaffUser; expiresAt: string }
    | { ok: false; reason: 'invalid' | 'locked' | 'inactive'; retryAfterMinutes?: number } {
    const r: any = db.prepare('SELECT * FROM staff_users WHERE username = ?').get(String(username || '').trim().toLowerCase());
    if (!r) {
      hashPin(String(pin || ''), 'timing-equaliser');
      appendAudit({ action: 'auth.login', actor: String(username || '').slice(0, 40), ip: meta.ip, outcome: 'denied', metadata: { reason: 'unknown_user' } });
      return { ok: false, reason: 'invalid' };
    }
    if (!r.active) {
      appendAudit({ action: 'auth.login', actor: r.id, actorRole: r.role, ip: meta.ip, outcome: 'denied', metadata: { reason: 'inactive' } });
      return { ok: false, reason: 'inactive' };
    }
    // The demo accounts of a demonstration server have published PINs, so a lockout protects
    // nothing there and would only let any visitor disable an account (and the Mock / Real switch,
    // which the demo administrator approves) for everyone. Every other account, and every account
    // on a hospital installation, locks as usual. Wrong PINs are refused and audited either way.
    const lockable = !(r.is_demo && securityConfig.demoToggle);
    if (lockable && r.locked_until && new Date(r.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(r.locked_until).getTime() - Date.now()) / 60000);
      appendAudit({ action: 'auth.login', actor: r.id, actorRole: r.role, ip: meta.ip, outcome: 'denied', metadata: { reason: 'locked' } });
      return { ok: false, reason: 'locked', retryAfterMinutes: mins };
    }
    if (!this.verifyPin(r.id, pin)) {
      const attempts = (r.failed_attempts || 0) + 1;
      const lock = lockable && attempts >= securityConfig.maxFailedLogins
        ? new Date(Date.now() + securityConfig.lockMinutes * 60000).toISOString()
        : null;
      db.prepare('UPDATE staff_users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : attempts, lock, r.id);
      appendAudit({ action: 'auth.login', actor: r.id, actorRole: r.role, ip: meta.ip, outcome: 'denied', metadata: { reason: 'bad_pin', attempts, locked: !!lock } });
      return lock ? { ok: false, reason: 'locked', retryAfterMinutes: securityConfig.lockMinutes } : { ok: false, reason: 'invalid' };
    }

    const token = newToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + securityConfig.sessionHours * 3600000).toISOString();
    db.prepare(`
      INSERT INTO staff_sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), sha256(token), r.id, now.toISOString(), expiresAt, now.toISOString(), meta.ip || null, (meta.userAgent || '').slice(0, 200));
    db.prepare('UPDATE staff_users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(now.toISOString(), r.id);
    appendAudit({ action: 'auth.login', actor: r.id, actorRole: r.role, ip: meta.ip, outcome: 'success' });
    return { ok: true, token, user: toUser({ ...r, last_login_at: now.toISOString() }), expiresAt };
  },

  /** Resolve a bearer token to its user, enforcing expiry and the idle timeout. */
  resolveSession(token: string): { user: StaffUser; sessionId: string } | null {
    if (!token) return null;
    const s: any = db.prepare('SELECT * FROM staff_sessions WHERE token_hash = ?').get(sha256(token));
    if (!s || s.revoked_at) return null;
    const now = Date.now();
    if (new Date(s.expires_at).getTime() < now) return null;
    if (now - new Date(s.last_seen_at).getTime() > securityConfig.idleMinutes * 60000) {
      db.prepare('UPDATE staff_sessions SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), s.id);
      return null;
    }
    const u: any = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(s.user_id);
    if (!u || !u.active) return null;
    // Touch at most once a minute to keep writes low.
    if (now - new Date(s.last_seen_at).getTime() > 60000) {
      db.prepare('UPDATE staff_sessions SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), s.id);
    }
    return { user: toUser(u), sessionId: s.id };
  },

  logout(token: string): void {
    db.prepare('UPDATE staff_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(new Date().toISOString(), sha256(token));
  },

  revokeAllSessions(userId: string): void {
    db.prepare('UPDATE staff_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), userId);
  },

  // ---------- Kiosk devices ----------

  enrollDevice(name: string, location: string | undefined, enrolledBy: string): { device: KioskDevice; token: string } {
    if (!name?.trim()) throw new Error('Device name is required.');
    const id = `kiosk-${crypto.randomBytes(4).toString('hex')}`;
    const token = newToken();
    db.prepare('INSERT INTO kiosk_devices (id, name, location, token_hash, enrolled_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name.trim().slice(0, 60), location?.trim().slice(0, 80) || null, sha256(token), enrolledBy, new Date().toISOString());
    return { device: { id, name: name.trim(), location: location?.trim() || null }, token };
  },

  resolveDevice(token: string): KioskDevice | null {
    if (!token) return null;
    const d: any = db.prepare('SELECT * FROM kiosk_devices WHERE token_hash = ?').get(sha256(token));
    if (!d || d.revoked_at) return null;
    if (!d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() > 60000) {
      db.prepare('UPDATE kiosk_devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), d.id);
    }
    return { id: d.id, name: d.name, location: d.location };
  },

  listDevices(): any[] {
    return db.prepare('SELECT id, name, location, enrolled_by AS enrolledBy, created_at AS createdAt, last_seen_at AS lastSeenAt, revoked_at AS revokedAt FROM kiosk_devices ORDER BY created_at DESC').all();
  },

  revokeDevice(id: string): boolean {
    return db.prepare('UPDATE kiosk_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(new Date().toISOString(), id).changes > 0;
  }
};

// ---------- Short-lived tickets for EventSource / WebSocket (they cannot send headers) ----------

const tickets = new Map<string, { userId: string; expires: number }>();

export function issueStreamTicket(userId: string): string {
  const t = newToken();
  tickets.set(t, { userId, expires: Date.now() + 60_000 });
  for (const [k, v] of tickets) if (v.expires < Date.now()) tickets.delete(k);
  return t;
}

/** Tickets are single use. */
export function redeemStreamTicket(ticket: string): StaffUser | null {
  const t = tickets.get(ticket);
  if (!t) return null;
  tickets.delete(ticket);
  if (t.expires < Date.now()) return null;
  const user = AuthService.getUser(t.userId);
  return user && user.active ? user : null;
}
