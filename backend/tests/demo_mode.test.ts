/**
 * Mock / Real switch battery: boots the real application and checks who may switch, that Real
 * mode leaves no mock data anywhere while staff can still sign in and a real check-in works, that
 * switching back restores the sample patients, and that a hospital installation (no switch) keeps
 * demo accounts and unenrolled kiosks out. Leaves the server in Mock mode for later batteries.
 *
 *   npx tsx tests/demo_mode.test.ts
 */
import './env';
import fs from 'fs';
import path from 'path';
import { createServer } from '../src/app';
import { DEMO_CARE_STREAMS } from '../src/db/seed';
import { securityConfig, setRuntimeDemoMode } from '../src/security/config';
import { resetDemoStaff } from '../src/db/demoStaff';

function demoPin(username: string): string {
  const file = fs.readFileSync(path.resolve(__dirname, '../src/db/demoStaff.ts'), 'utf8');
  const m = file.match(new RegExp(`^ \\*\\s+${username.replace('.', '\\.')}\\s+\\S+\\s+(\\d+)`, 'm'));
  if (!m) throw new Error(`No demo PIN for ${username}`);
  return m[1];
}

export async function runDemoModeBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };

  const { server } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const api = async (method: string, p: string, body?: any, token?: string) => {
    const r = await fetch(`${base}${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json: any = null;
    try { json = await r.json(); } catch { json = null; }
    return { status: r.status, json };
  };
  const login = async (username: string, pin = demoPin(username)) => api('POST', '/api/auth/login', { username, pin });
  const demoIds = Object.keys(DEMO_CARE_STREAMS);
  const queueIds = async (token: string): Promise<string[]> => ((await api('GET', '/api/doctor/queue', undefined, token)).json?.data || []).map((q: any) => q.sessionId);
  const approve = { username: 'admin', pin: demoPin('admin') };
  const consent = { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };

  try {
    console.log('\n--- Mock / Real switch on a demonstration server: who may switch ---');
    const mode = await api('GET', '/api/system/mode');
    check(mode.status === 200 && mode.json.data.demoMode === true && mode.json.data.demoToggle === true, 'public status: Mock mode on and switchable (development defaults)');
    const demoAdmin = (await login('admin')).json.token;
    const doctor = (await login('dr.sharma')).json.token;
    check((await api('POST', '/api/system/demo-mode', { on: 'off' }, demoAdmin)).status === 400, 'a non-boolean value is refused');
    check((await api('POST', '/api/system/demo-mode', { on: false })).json?.code === 'ADMIN_APPROVAL_REQUIRED', 'without sign-in an administrator must approve');
    check((await api('POST', '/api/system/demo-mode', { on: false }, doctor)).json?.code === 'ADMIN_APPROVAL_REQUIRED', 'a doctor alone cannot switch');
    check((await api('POST', '/api/system/demo-mode', { on: false, approver: { username: 'dr.sharma', pin: demoPin('dr.sharma') } }, doctor)).json?.code === 'FORBIDDEN', 'a doctor cannot approve');
    check((await api('POST', '/api/system/demo-mode', { on: false, approver: { username: 'admin', pin: '000000' } }, doctor)).status === 401, 'a wrong administrator PIN is refused');
    const same = await api('POST', '/api/system/demo-mode', { on: true }, demoAdmin);
    check(same.status === 200 && same.json.data.demoMode === true && same.json.data.restored === 0, 'asking for the mode already active changes nothing');
    const mockIds = await queueIds(doctor);
    check(demoIds.every(id => mockIds.includes(id)), 'Mock mode: all ten sample patients are in the queue');

    console.log('\n--- Switching to Real mode (no mock data) ---');
    const off = await api('POST', '/api/system/demo-mode', { on: false, approver: approve }, doctor);
    check(off.status === 200 && off.json.data.demoMode === false && off.json.data.parked >= demoIds.length && off.json.data.changedBy === 'Hospital Administrator', 'the doctor switches with the administrator’s approval; the sample visits are parked');
    check(off.json.data.kioskOpen === true, 'kiosks stay open on a demonstration server, so a real check-in can be shown');
    check((await api('GET', '/api/auth/me', undefined, doctor)).status === 200 && (await api('GET', '/api/auth/me', undefined, demoAdmin)).status === 200, 'nobody is signed out by the switch');
    check((await login('pharma.ravi')).status === 200, 'staff sign in the same way in Real mode (no lock-out)');
    check((await queueIds(doctor)).every(id => !demoIds.includes(id)), 'no sample patient is left in the doctor queue');
    const pharmacy = await api('GET', '/api/doctor/encounters', undefined, demoAdmin);
    check(pharmacy.status === 200 && (pharmacy.json.data || []).length === 0, 'no sample prescription is left at the pharmacy');
    check((await api('POST', '/api/doctor/demo-queue', undefined, doctor)).status === 404, 'demo endpoints are gone (no mock data can be added)');
    check((await api('GET', '/api/admin/analytics', undefined, demoAdmin)).status === 200, 'the administration dashboard works with the sample visits parked');
    const status = await api('GET', '/api/auth/status');
    check(status.json.demoMode === false && status.json.needsSetup === false && status.json.demoAccounts.length >= 6, 'the sign-in screen reports Real mode and still offers the staff accounts');
    const intake = await api('POST', '/api/kiosk/intake', { patient: { name: `Real Mode ${Date.now() % 100000}`, age: 41, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Fever', severityScore: 4 }], history: { conditions: [], allergies: 'none', currentMedicines: '' }, consent });
    check(intake.status === 200 && !!intake.json.sessionId, 'a patient checks in at the kiosk in Real mode');
    const realQueue = await queueIds(doctor);
    check(realQueue.includes(intake.json.sessionId) && realQueue.every(id => !demoIds.includes(id)), 'only the patient who really checked in is in the queue');
    const again = await api('POST', '/api/system/demo-mode', { on: false }, demoAdmin);
    check(again.status === 200 && again.json.data.parked === 0, 'switching to Real twice is harmless');

    console.log('\n--- Switching back to Mock mode ---');
    const on = await api('POST', '/api/system/demo-mode', { on: true, approver: approve });
    check(on.status === 200 && on.json.data.demoMode === true && on.json.data.restored === demoIds.length, 'a visitor switches back with the administrator’s approval; ten sample patients return');
    const backIds = await queueIds(doctor);
    check(demoIds.every(id => backIds.includes(id)) && backIds.includes(intake.json.sessionId), 'sample patients are back and the real check-in was kept');
    check((await api('POST', '/api/doctor/demo-queue', undefined, doctor)).status === 200, 'demo endpoints answer again');

    console.log('\n--- Wrong PINs on a demonstration server ---');
    let wrong = 0;
    for (let i = 0; i < 7; i++) if ((await login('asha.sunita', '000000')).status === 401) wrong++;
    check(wrong === 7, 'seven wrong PINs are each refused');
    check((await login('asha.sunita')).status === 200, 'but a demo account is never locked (its PIN is public; a lock would only let a visitor disable it)');

    console.log('\n--- A hospital installation (no switch) keeps its protections ---');
    (securityConfig as any).demoToggle = false;
    try {
      const tries: number[] = [];
      for (let i = 0; i < 6; i++) tries.push((await login('asha.sunita', '000000')).status);
      check(tries.slice(0, 4).every(s => s === 401) && tries[5] === 423 && (await login('asha.sunita')).status === 423, 'the same account locks after five wrong PINs');
      check((await api('POST', '/api/system/demo-mode', { on: false }, demoAdmin)).json?.code === 'TOGGLE_DISABLED', 'there is no switch');
      setRuntimeDemoMode(false);
      const blocked = await login('dr.sharma');
      check(blocked.status === 403 && blocked.json.code === 'DEMO_ACCOUNT_OFF', 'with demo data off, demo accounts cannot sign in (published PINs are useless)');
      check((await api('GET', '/api/auth/me', undefined, doctor)).status === 401, 'and their open sessions stop working');
      check((await api('GET', '/api/auth/status')).json.demoAccounts.length === 0, 'the sign-in screen lists no demo accounts');
      check((await api('POST', '/api/kiosk/intake', { patient: { name: 'Hospital kiosk', age: 30, gender: 'MALE' }, symptoms: [] })).json?.code === 'KIOSK_NOT_ENROLLED', 'an unenrolled kiosk is refused');
    } finally {
      (securityConfig as any).demoToggle = true;
      setRuntimeDemoMode(true);
    }
    check((await api('GET', '/api/auth/me', undefined, doctor)).status === 200, 'back on the demonstration server the session works again');

    console.log('\n--- Reset after a visitor tampered with the demo accounts ---');
    const users = (await api('GET', '/api/admin/users', undefined, demoAdmin)).json.data as Array<{ id: string; username: string }>;
    const nurse = users.find(u => u.username === 'nurse.priya')!;
    await api('POST', `/api/admin/users/${nurse.id}/reset-pin`, { pin: '864213' }, demoAdmin);
    await api('PATCH', `/api/admin/users/${users.find(u => u.username === 'pharma.ravi')!.id}`, { active: false }, demoAdmin);
    check((await login('nurse.priya')).status === 401 && (await login('pharma.ravi')).status === 401, 'a changed PIN and a deactivated account stop one-tap sign-in');
    const restored = resetDemoStaff();
    check(restored.restored === 6 && (await login('nurse.priya')).status === 200 && (await login('pharma.ravi')).status === 200 && (await login('asha.sunita')).status === 200, 'resetDemoStaff() puts all six back: active, unlocked, published PINs');
  } catch (err: any) {
    check(false, `battery crashed: ${err.message}`);
  } finally {
    // Never leave the shared test database in Real mode or with the switch disabled.
    (securityConfig as any).demoToggle = true;
    setRuntimeDemoMode(true);
    server.close();
  }
  const isPassed = passed === total;
  console.log(`\nDemonstration-mode battery: ${passed}/${total} ${isPassed ? 'passed' : 'FAILED'} in ${(performance.now() - t0).toFixed(0)} ms`);
  return { passed, total, isPassed };
}

if (require.main === module) {
  runDemoModeBattery().then(r => process.exit(r.isPassed ? 0 : 1));
}
