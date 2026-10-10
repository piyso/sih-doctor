/**
 * Runtime security configuration, read once from the environment.
 *
 * Production defaults are strict: demo endpoints are off, kiosks must be enrolled, CORS only allows
 * the origins listed in CORS_ORIGIN. Development keeps the open behaviour so the prototype can be
 * run with `npm run dev` and no setup.
 */

const env = process.env;
const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

export const IS_PRODUCTION = env.NODE_ENV === 'production';

/**
 * A demonstration server (DEMO_TOGGLE; the default in development, never on a hospital
 * installation) can be switched between Mock mode (sample patients) and Real mode (no mock data)
 * while it runs (services/demoMode.service.ts). ALLOW_DEMO_DATA gives the starting mode.
 */
const DEMO_SERVER = bool(env.DEMO_TOGGLE, !IS_PRODUCTION);
const runtime = { demo: bool(env.ALLOW_DEMO_DATA, !IS_PRODUCTION) };
export function setRuntimeDemoMode(on: boolean): void { runtime.demo = on; }

export const securityConfig = {
  isProduction: IS_PRODUCTION,
  /**
   * Mock mode: sample patients in the queues, demo seed / restore endpoints, the kiosk's sample
   * profiles and demo OTP. Never on with real patients.
   */
  get allowDemo(): boolean { return runtime.demo; },
  /** Whether this is a demonstration server, where Mock / Real mode can be switched at run time. */
  demoToggle: DEMO_SERVER,
  /**
   * Whether the demo staff accounts may sign in (with their PINs): in Mock mode, and in both modes
   * on a demonstration server so that switching to Real mode never locks the presenter out. On a
   * hospital installation with demo data off they cannot sign in at all.
   */
  get demoAccountsOpen(): boolean { return runtime.demo || this.demoToggle; },
  /**
   * When false, kiosk endpoints need an enrolled device token (X-Kiosk-Token). Set KIOSK_OPEN to
   * fix it; left unset, kiosks are open in Mock mode and on a demonstration server (so a real
   * check-in can be shown in Real mode), and need enrolment on a hospital installation.
   */
  get kioskOpen(): boolean { return env.KIOSK_OPEN === undefined || env.KIOSK_OPEN === '' ? runtime.demo || this.demoToggle : bool(env.KIOSK_OPEN, false); },
  /** Comma separated list of allowed browser origins. Empty in production means same-origin only. */
  corsOrigins: (env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== '*'),
  corsAllowAll: !IS_PRODUCTION && (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim() === '*'),
  /** Staff session lifetime (one clinical shift) and idle timeout, in minutes. */
  sessionHours: Number(env.STAFF_SESSION_HOURS) || 12,
  idleMinutes: Number(env.STAFF_IDLE_MINUTES) || 30,
  maxFailedLogins: 5,
  lockMinutes: 15,
  /** Behind nginx / a cloud load balancer the client IP arrives in X-Forwarded-For. */
  trustProxy: bool(env.TRUST_PROXY, true),
  /** Days to keep unfinished kiosk drafts and abandoned sessions before purging. */
  draftRetentionHours: Number(env.DRAFT_RETENTION_HOURS) || 24,
  abandonedSessionDays: Number(env.ABANDONED_SESSION_DAYS) || 30,
  /** Indian medical-record rules expect OPD records to be kept for at least 3 years. */
  clinicalRetentionYears: Number(env.CLINICAL_RETENTION_YEARS) || 3,
  dataDir: env.DATA_DIR || '',
  grievanceOfficer: {
    name: env.GRIEVANCE_OFFICER_NAME || 'Hospital Data Protection Officer',
    email: env.GRIEVANCE_OFFICER_EMAIL || 'dpo@hospital.example',
    phone: env.GRIEVANCE_OFFICER_PHONE || ''
  }
};

export type StaffRole = 'admin' | 'doctor' | 'vaidya' | 'nurse' | 'pharmacist' | 'asha' | 'reception';
export const STAFF_ROLES: StaffRole[] = ['admin', 'doctor', 'vaidya', 'nurse', 'pharmacist', 'asha', 'reception'];

/** Roles that can see and treat patients at the doctor desk. */
export const CLINICIAN_ROLES: StaffRole[] = ['doctor', 'vaidya', 'nurse', 'admin'];
export const PRESCRIBER_ROLES: StaffRole[] = ['doctor', 'vaidya'];
