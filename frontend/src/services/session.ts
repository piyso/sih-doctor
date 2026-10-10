/**
 * Who is using this browser: a signed-in staff member and/or an enrolled kiosk device.
 *
 * - Staff token: kept in sessionStorage (cleared when the browser tab closes) so a shared hospital
 *   PC does not stay signed in. The server additionally enforces an idle timeout.
 * - Kiosk device token: kept in localStorage; it identifies the machine, not a person.
 */

export type StaffRole = 'admin' | 'doctor' | 'vaidya' | 'nurse' | 'pharmacist' | 'asha' | 'reception';

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: StaffRole;
  department: string | null;
  qualification: string | null;
  registrationNo: string | null;
  /** ABDM Healthcare Professionals Registry id, when set by the administrator. */
  hprId?: string | null;
  mustChangePin: boolean;
  isDemo: boolean;
}

const STAFF_KEY = 'hos_staff_session';
const SANDBOX_KEY = 'hos_sandbox_mode';
// Earlier builds kept the sandbox flag for the whole browser; drop that so it cannot leak between tabs.
try { localStorage.removeItem(SANDBOX_KEY); } catch {}
const DEVICE_KEY = 'hos_kiosk_device_token';

type Listener = () => void;
const listeners = new Set<Listener>();

let staff: { token: string; user: StaffUser; expiresAt: string } | null = (() => {
  try {
    const raw = sessionStorage.getItem(STAFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return new Date(parsed.expiresAt).getTime() > Date.now() ? parsed : null;
  } catch {
    return null;
  }
})();

const emit = () => listeners.forEach(l => { try { l(); } catch {} });

export const session = {
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  get staffToken(): string {
    return staff?.token || '';
  },

  get user(): StaffUser | null {
    return staff?.user || null;
  },

  setStaff(token: string, user: StaffUser, expiresAt: string) {
    staff = { token, user, expiresAt };
    try { sessionStorage.setItem(STAFF_KEY, JSON.stringify(staff)); } catch {}
    emit();
  },

  updateUser(user: StaffUser) {
    if (!staff) return;
    staff = { ...staff, user };
    try { sessionStorage.setItem(STAFF_KEY, JSON.stringify(staff)); } catch {}
    emit();
  },

  clearStaff() {
    staff = null;
    try { sessionStorage.removeItem(STAFF_KEY); } catch {}
    emit();
  },

  get deviceToken(): string {
    try { return localStorage.getItem(DEVICE_KEY) || ''; } catch { return ''; }
  },

  setDeviceToken(token: string) {
    try { localStorage.setItem(DEVICE_KEY, token); } catch {}
    emit();
  },

  clearDeviceToken() {
    try { localStorage.removeItem(DEVICE_KEY); } catch {}
    emit();
  },

  /**
   * Offline sandbox (Mock mode without a reachable server; see runtimeMode.ts). Kept per tab, like
   * the staff session: one tab losing its connection must never put other tabs on stand-in data.
   */
  get isSandbox(): boolean {
    try { return sessionStorage.getItem(SANDBOX_KEY) === 'true'; } catch { return false; }
  },

  setSandbox(val: boolean) {
    try {
      if (val) sessionStorage.setItem(SANDBOX_KEY, 'true');
      else sessionStorage.removeItem(SANDBOX_KEY);
    } catch {}
    emit();
  }
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Administrator',
  doctor: 'Doctor (Modern medicine)',
  vaidya: 'Vaidya (Ayurveda)',
  nurse: 'Nurse',
  pharmacist: 'Pharmacist',
  asha: 'ASHA worker',
  reception: 'Reception'
};
