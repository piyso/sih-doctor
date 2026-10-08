/**
 * Create a staff account from the command line (first administrator, or recovery).
 *   npm run create-admin -- <username> "<Display Name>" <PIN> [role]
 * The user is asked to choose a new PIN at first sign-in.
 */
import { AuthService } from '../src/security/auth.service';
import { STAFF_ROLES, StaffRole } from '../src/security/config';

const [username, displayName, pin, role = 'admin'] = process.argv.slice(2);
if (!username || !displayName || !pin || !STAFF_ROLES.includes(role as StaffRole)) {
  console.error(`Usage: npm run create-admin -- <username> "<Display Name>" <PIN> [${STAFF_ROLES.join('|')}]`);
  process.exit(1);
}
try {
  const u = AuthService.createUser({ username, displayName, pin, role: role as StaffRole, mustChangePin: true });
  console.log(`Created ${u.role} account "${u.username}".`);
  process.exit(0);
} catch (e: any) {
  console.error(e.message);
  process.exit(1);
}
