/**
 * Demonstration-mode switch battery: boots the real application and checks who may switch, that
 * switching off really closes every demo path, and that switching back on restores the demo.
 * Leaves the server with demonstration mode ON (later batteries rely on the demo accounts).
 *
 *   npx tsx tests/demo_mode.test.ts
 */
import './env';
import fs from 'fs';
import path from 'path';
import { createServer } from '../src/app';
import { DEMO_CARE_STREAMS } from '../src/db/seed';

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
  const realAdmin = `real.admin.${Date.now() % 100000}`;
  const realPin = '739215';
  const realPin2 = '715938';

  try {
    console.log('\n--- Demonstration mode: status and who may switch ---');
    const mode = await api('GET', '/api/system/mode');
    check(mode.status === 200 && mode.json.data.demoMode === true && mode.json.data.demoToggle === true, 'public status: demo mode on and switchable (development defaults)');
    const demoAdmin = (await login('admin')).json.token;
    const doctor = (await login('dr.sharma')).json.token;
    check((await api('POST', '/api/system/demo-mode', { on: 'off' }, demoAdmin)).status === 400, 'a non-boolean value is refused');
    check((await api('POST', '/api/system/demo-mode', { on: false })).json?.code === 'ADMIN_APPROVAL_REQUIRED', 'without sign-in an administrator must approve');
    check((await api('POST', '/api/system/demo-mode', { on: false }, doctor)).json?.code === 'ADMIN_APPROVAL_REQUIRED', 'a doctor alone cannot switch');
    check((await api('POST', '/api/system/demo-mode', { on: false, approver: { username: 'dr.sharma', pin: demoPin('dr.sharma') } }, doctor)).json?.code === 'FORBIDDEN', 'a doctor cannot approve');
    check((await api('POST', '/api/system/demo-mode', { on: false, approver: { username: 'admin', pin: '000000' } }, doctor)).status === 401, 'a wrong administrator PIN is refused');
    const noReal = await api('POST', '/api/system/demo-mode', { on: false }, demoAdmin);
    check(noReal.status === 409 && noReal.json.code === 'NO_REAL_ADMIN', 'switching off is refused while only demo administrators exist (no lock-out)');

    const created = await api('POST', '/api/admin/users', { username: realAdmin, displayName: 'Medical Superintendent', role: 'admin', pin: realPin }, demoAdmin);
    check(created.status === 200 && created.json.data.isDemo === false, 'a real administrator is added under Staff');

    console.log('\n--- Switching off ---');
    const off = await api('POST', '/api/system/demo-mode', { on: false }, demoAdmin);
    check(off.status === 200 && off.json.data.demoMode === false && off.json.data.kioskOpen === false && off.json.data.changedBy === 'Hospital Administrator', 'demo administrator switches off; kiosks now need enrolment');
    check((await api('GET', '/api/auth/me', undefined, demoAdmin)).status === 401, 'the demo administrator’s open session stops working');
    const demoLogin = await login('dr.sharma');
    check(demoLogin.status === 403 && demoLogin.json.code === 'DEMO_ACCOUNT_OFF', 'demo accounts cannot sign in (published PINs are useless)');
    const status = await api('GET', '/api/auth/status');
    check(status.json.demoMode === false && status.json.demoAccounts.length === 0 && status.json.needsSetup === false, 'sign-in screen lists no demo accounts');
    check((await api('POST', '/api/auth/setup', { username: 'intruder', displayName: 'X', pin: '583920' })).status === 409, 'first-run setup stays closed (a real administrator exists)');
    check((await api('POST', '/api/kiosk/intake', { patient: { name: 'Off kiosk', age: 30, gender: 'MALE' }, symptoms: [] })).json?.code === 'KIOSK_NOT_ENROLLED', 'an unenrolled kiosk is refused');

    const real = (await login(realAdmin, realPin)).json.token;
    check((await api('POST', '/api/auth/change-pin', { currentPin: realPin, newPin: realPin2 }, real)).status === 200, 'the real administrator sets their own PIN');
    check((await api('POST', '/api/doctor/demo-queue', undefined, real)).status === 404, 'demo endpoints are gone');
    const demoIds = Object.keys(DEMO_CARE_STREAMS);
    const queue = await api('GET', '/api/doctor/queue', undefined, real);
    const ids: string[] = (queue.json?.data || []).map((q: any) => q.sessionId);
    check(queue.status === 200 && !ids.some(id => demoIds.includes(id)), 'parked demo visits are out of the queue');
    const analytics = await api('GET', '/api/admin/analytics', undefined, real);
    check(analytics.status === 200, 'administration dashboard still works with demo visits parked');
    check((await api('POST', '/api/system/demo-mode', { on: true, approver: { username: 'admin', pin: demoPin('admin') } })).json?.code === 'DEMO_ACCOUNT_OFF', 'a demo administrator cannot approve while demonstration mode is off');

    console.log('\n--- Switching back on ---');
    const on = await api('POST', '/api/system/demo-mode', { on: true, approver: { username: realAdmin, pin: realPin2 } });
    check(on.status === 200 && on.json.data.demoMode === true && on.json.data.kioskOpen === true, 'a real administrator’s username and PIN approve switching on (no session kept)');
    const back = (await login('dr.sharma')).json.token;
    check(!!back, 'demo accounts sign in again');
    const backIds: string[] = ((await api('GET', '/api/doctor/queue', undefined, back)).json?.data || []).map((q: any) => q.sessionId);
    check(demoIds.every(id => backIds.includes(id)), 'all ten demo patients are back in the queue');
    const after = await api('GET', '/api/system/mode');
    check(after.json.data.demoMode === true && after.json.data.changedBy === 'Medical Superintendent', 'status shows who switched it');
  } catch (err: any) {
    check(false, `battery crashed: ${err.message}`);
  } finally {
    // Never leave the shared test database with demonstration mode off.
    try { const { setRuntimeDemoMode } = await import('../src/security/config'); setRuntimeDemoMode(true); } catch { /* ignore */ }
    server.close();
  }
  const isPassed = passed === total;
  console.log(`\nDemonstration-mode battery: ${passed}/${total} ${isPassed ? 'passed' : 'FAILED'} in ${(performance.now() - t0).toFixed(0)} ms`);
  return { passed, total, isPassed };
}

if (require.main === module) {
  runDemoModeBattery().then(r => process.exit(r.isPassed ? 0 : 1));
}
