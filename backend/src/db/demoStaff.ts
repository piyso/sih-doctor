/**
 * Demo staff accounts for development and demonstrations.
 *
 * Created when demonstration mode is on (ALLOW_DEMO_DATA, or the admin switch where DEMO_TOGGLE
 * allows it). They are flagged `is_demo`, listed by username on the sign-in screen, and cannot sign
 * in while demonstration mode is off. Never enable demo data on a real hospital deployment.
 *
 *   username        role         PIN
 *   admin           admin        802211
 *   dr.sharma       doctor       482913
 *   vaidya.sharma   vaidya       573920
 *   nurse.priya     nurse        619384
 *   pharma.ravi     pharmacist   735102
 *   asha.sunita     asha         846257
 */

import { AuthService } from '../security/auth.service';
import { securityConfig, StaffRole } from '../security/config';

const DEMO_STAFF: Array<{ username: string; displayName: string; role: StaffRole; pin: string; department?: string; qualification?: string; registrationNo?: string }> = [
  { username: 'admin', displayName: 'Hospital Administrator', role: 'admin', pin: '802211' },
  { username: 'dr.sharma', displayName: 'Dr. Ananya Sharma', role: 'doctor', pin: '482913', department: 'GENMED', qualification: 'MBBS, MD (General Medicine)', registrationNo: 'DMC Reg. 98421' },
  { username: 'vaidya.sharma', displayName: 'Vaidya V. K. Sharma', role: 'vaidya', pin: '573920', department: 'KAYA', qualification: 'BAMS, MD (Ayu)', registrationNo: 'NCISM Reg. AYU/84920' },
  { username: 'nurse.priya', displayName: 'Sr. Nurse Priya Nair', role: 'nurse', pin: '619384', department: 'OPD' },
  { username: 'pharma.ravi', displayName: 'Ravi Kumar (Pharmacist)', role: 'pharmacist', pin: '735102', department: 'PHARMACY', registrationNo: 'Pharmacy Council Reg. 22841' },
  { username: 'asha.sunita', displayName: 'Sunita Devi (ASHA)', role: 'asha', pin: '846257', department: 'COMMUNITY' }
];

/**
 * Demonstration mode switched on at run time: create any demo account that is missing. A real
 * account that already uses a demo username is never touched.
 */
export function ensureDemoStaff(): number {
  const taken = new Set(AuthService.listUsers().map(u => u.username));
  let created = 0;
  for (const s of DEMO_STAFF) {
    if (taken.has(s.username)) continue;
    AuthService.createUser({ ...s, isDemo: true });
    created++;
  }
  return created;
}

export function ensureStaffAccounts(): void {
  if (AuthService.countUsers() > 0) return;

  if (securityConfig.allowDemo) {
    for (const s of DEMO_STAFF) AuthService.createUser({ ...s, isDemo: true });
    console.log(`[Auth] Created ${DEMO_STAFF.length} demo staff accounts (see src/db/demoStaff.ts). Disable with ALLOW_DEMO_DATA=false.`);
    return;
  }

  const u = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const pin = process.env.ADMIN_BOOTSTRAP_PIN;
  if (u && pin) {
    AuthService.createUser({ username: u, displayName: 'Administrator', role: 'admin', pin, mustChangePin: true });
    console.log(`[Auth] Created bootstrap administrator "${u}". They must choose a new PIN at first sign-in.`);
  } else {
    console.warn('[Auth] No staff accounts exist. Open the staff sign-in screen to run first-time setup (needs SETUP_CODE in production).');
  }
}
