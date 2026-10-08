/**
 * Demo staff accounts for development and demonstrations.
 *
 * Created only when ALLOW_DEMO_DATA is on (the default outside production) and only if no staff
 * account exists yet. They are flagged `is_demo` and listed by username on the sign-in screen.
 * Never enable demo data on a real hospital deployment.
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
  { username: 'vaidya.sharma', displayName: 'Vaidya V. K. Sharma', role: 'vaidya', pin: '573920', department: 'KAYA', qualification: 'BAMS, MD (Ayu)', registrationNo: 'CCIM Reg. AYU/84920' },
  { username: 'nurse.priya', displayName: 'Sr. Nurse Priya Nair', role: 'nurse', pin: '619384', department: 'OPD' },
  { username: 'pharma.ravi', displayName: 'Ravi Kumar (Pharmacist)', role: 'pharmacist', pin: '735102', department: 'PHARMACY', registrationNo: 'Pharmacy Council Reg. 22841' },
  { username: 'asha.sunita', displayName: 'Sunita Devi (ASHA)', role: 'asha', pin: '846257', department: 'COMMUNITY' }
];

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
