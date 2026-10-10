/**
 * Put a demonstration server back to its starting state, in one command:
 *
 *   npx tsx scripts/reset-demo.ts              (from backend/; or: scripts/live-demo.sh --reset)
 *   npx tsx scripts/reset-demo.ts --keep-visits   keep patients who checked in for real
 *
 *  1. demo staff accounts: present, active, unlocked, published PINs (works even if a visitor
 *     changed, locked or deactivated them, because this step writes to the database directly);
 *  2. Mock mode on, and the ten sample patients waiting again with fresh times;
 *  3. visits that are not sample patients leave the queue (marked "not seen"; nothing is deleted);
 *  4. open SOS alerts are resolved.
 *
 * Steps 2–4 go through the running server so every open screen updates at once. Refuses to run
 * on a hospital installation (no demonstration server, demo data off).
 */
import 'dotenv/config';
import { securityConfig } from '../src/security/config';
import { resetDemoStaff, demoAdminCredentials } from '../src/db/demoStaff';
import { DEMO_CARE_STREAMS } from '../src/db/seed';

const base = `http://127.0.0.1:${process.env.PORT || 8001}`;
const keepVisits = process.argv.includes('--keep-visits');
const line = (ok: boolean, text: string) => console.log(`  ${ok ? '[ok]  ' : '[skip]'} ${text}`);

async function call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main(): Promise<number> {
  if (!securityConfig.demoAccountsOpen) {
    console.error('Refused: this is not a demonstration server (DEMO_TOGGLE is off and demo data is off).');
    return 1;
  }
  console.log('Hospital OS — reset the demonstration');

  const staff = resetDemoStaff();
  line(true, `demo staff accounts: ${staff.restored} restored, ${staff.created} created (active, unlocked, published PINs)`);

  let token = '';
  try {
    const login = await call('POST', '/api/auth/login', demoAdminCredentials());
    token = login.json?.token || '';
    if (!token) throw new Error(login.json?.error || `sign-in answered ${login.status}`);
  } catch (err: any) {
    line(false, `the server on ${base} is not answering (${err?.message || err}) — start it, then run this again for the queue`);
    return 2;
  }

  const mode = await call('GET', '/api/system/mode');
  if (mode.json?.data?.demoMode === false) {
    const sw = await call('POST', '/api/system/demo-mode', { on: true }, token);
    line(sw.status === 200, sw.status === 200 ? 'switched to Mock mode' : `could not switch to Mock mode (${sw.json?.error || sw.status})`);
  } else {
    line(true, 'Mock mode is on');
  }

  const samples = await call('POST', '/api/doctor/demo-queue', undefined, token);
  line(samples.status === 200, samples.status === 200 ? `${samples.json?.restored ?? 0} sample patients are waiting again` : `sample patients were not re-opened (${samples.json?.error || samples.status})`);

  if (keepVisits) {
    line(false, 'real check-ins kept (--keep-visits)');
  } else {
    const sampleIds = new Set(Object.keys(DEMO_CARE_STREAMS));
    const queue = await call('GET', '/api/doctor/queue', undefined, token);
    const leftovers: Array<{ sessionId: string; patientName: string }> = (queue.json?.data || []).filter((q: any) => !sampleIds.has(q.sessionId));
    let cleared = 0;
    for (const v of leftovers) {
      const r = await call('POST', `/api/queue/no-show/${encodeURIComponent(v.sessionId)}`, {}, token);
      if (r.status === 200) cleared++;
    }
    line(true, leftovers.length ? `${cleared} of ${leftovers.length} earlier check-ins taken out of the queue (${leftovers.map(v => v.patientName).join(', ')})` : 'no earlier check-ins in the queue');
  }

  const alerts = await call('GET', '/api/alerts', undefined, token);
  const open: Array<{ id: string }> = (alerts.json?.data || []).filter((a: any) => !a.resolvedAt);
  for (const a of open) await call('POST', `/api/alerts/${encodeURIComponent(a.id)}/resolve`, { note: 'Demonstration reset' }, token);
  line(true, open.length ? `${open.length} open SOS alert(s) resolved` : 'no open SOS alerts');

  await call('POST', '/api/auth/logout', undefined, token).catch(() => undefined);
  console.log('Ready: Mock mode, ten sample patients, all demo accounts working.');
  return 0;
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
