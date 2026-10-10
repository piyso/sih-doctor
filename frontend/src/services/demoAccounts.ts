import { StaffRole } from './session';

/**
 * The demo staff accounts of a demonstration server (backend/src/db/demoStaff.ts), with their
 * published PINs, so that the sign-in screen can offer one-tap sign-in and the Mock / Real switch
 * can carry the demo administrator's approval. They exist only on demonstration servers: a
 * hospital installation has no demo accounts, so nothing here opens anything there.
 *
 * Keep in step with backend/src/db/demoStaff.ts.
 */
export interface DemoAccount { username: string; displayName: string; role: StaffRole; pin: string }

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'dr.sharma', displayName: 'Dr. Ananya Sharma', role: 'doctor', pin: '482913' },
  { username: 'vaidya.sharma', displayName: 'Vaidya V. K. Sharma', role: 'vaidya', pin: '573920' },
  { username: 'nurse.priya', displayName: 'Sr. Nurse Priya Nair', role: 'nurse', pin: '619384' },
  { username: 'pharma.ravi', displayName: 'Ravi Kumar (Pharmacist)', role: 'pharmacist', pin: '735102' },
  { username: 'asha.sunita', displayName: 'Sunita Devi (ASHA)', role: 'asha', pin: '846257' },
  { username: 'admin', displayName: 'Hospital Administrator', role: 'admin', pin: '802211' }
];

export const DEMO_ADMIN = DEMO_ACCOUNTS.find(a => a.role === 'admin')!;

export const demoAccount = (username: string): DemoAccount | undefined =>
  DEMO_ACCOUNTS.find(a => a.username === username.trim().toLowerCase());
