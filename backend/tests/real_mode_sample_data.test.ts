/**
 * "Real mode shows no sample data" battery.
 *
 * Boots the real application, uses it the way a demonstration does in Mock mode (signs and
 * dispenses a sample visit, calls and drafts another, raises an SOS, checks a patient in at the
 * kiosk, records an ASHA visit), switches to Real mode and then asks every read endpoint for data
 * while looking for anything that belongs to a sample record: names, ids, ABHA numbers, tokens.
 * It also checks that a screen left open from Mock mode cannot write to a sample visit, that the
 * two worlds never share a patient, and that switching back restores everything.
 * Leaves the server in Mock mode for later batteries.
 *
 *   npx tsx tests/real_mode_sample_data.test.ts
 */
import './env';
import fs from 'fs';
import path from 'path';
import { createServer } from '../src/app';
import { db } from '../src/db/database';
import { securityConfig, setRuntimeDemoMode } from '../src/security/config';
import { AuthService } from '../src/security/auth.service';
import { setDemoMode } from '../src/services/demoMode.service';
import { localDate } from '../src/services/hospitalRouting.service';

function demoPin(username: string): string {
  const file = fs.readFileSync(path.resolve(__dirname, '../src/db/demoStaff.ts'), 'utf8');
  const m = file.match(new RegExp(`^ \\*\\s+${username.replace('.', '\\.')}\\s+\\S+\\s+(\\d+)`, 'm'));
  if (!m) throw new Error(`No demo PIN for ${username}`);
  return m[1];
}

export async function runRealModeSampleDataBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };

  const { server } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const api = async (method: string, p: string, body?: any, token?: string) => {
    const r = await fetch(`${base}${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: r.status, json, text };
  };
  // Sign-in and the switch go straight to their services: inside `npm test` the batteries before this
  // one have used up the per-minute limits of POST /api/auth/login and POST /api/system/demo-mode
  // (both endpoints have batteries of their own: http_api and demo_mode).
  const login = (username: string): string => {
    const r: any = AuthService.login(username, demoPin(username), { ip: '127.0.0.1', userAgent: 'real-mode-battery' });
    if (!r.ok) throw new Error(`sign-in failed for ${username}: ${r.reason}`);
    return r.token;
  };
  const switchTo = (on: boolean) => setDemoMode(on, { id: 'real-mode-battery', name: 'Real-mode battery', role: 'admin' }, '127.0.0.1');
  const consent = { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };
  const stamp = Date.now() % 1000000;

  try {
    if (!securityConfig.allowDemo) setRuntimeDemoMode(true);
    const admin = login('admin');
    const doctor = login('dr.sharma');
    const vaidya = login('vaidya.sharma');
    const pharmacist = login('pharma.ravi');
    const asha = login('asha.sunita');
    switchTo(true);
    await api('POST', '/api/doctor/demo-queue', undefined, doctor);

    console.log('\n--- Mock mode: an ordinary demonstration ---');
    const signed = await api('POST', '/api/doctor/prescribe', { sessionId: 'sess-003', advice: 'Plenty of fluids, tepid sponging.', allopathicPrescription: [{ name: 'Paracetamol 250 mg/5 ml syrup', dosage: '5 ml', frequency: 'TDS', durationDays: 3 }], diagnoses: [], amend: true, takeOver: true }, doctor);
    const sampleEncounter = signed.json?.encounterId as string;
    check(signed.status === 200 && !!sampleEncounter, 'a doctor signs a prescription for a sample patient');
    check((await api('POST', `/api/doctor/encounters/${sampleEncounter}/dispense`, { status: 'DISPENSED', items: [] }, pharmacist)).status === 200, 'the pharmacy dispenses it');
    const called = await api('POST', '/api/queue/call/sess-007', undefined, doctor);
    check(called.status === 200 && !!called.json?.tokenNo, 'a sample patient is called to the room');
    await api('POST', '/api/doctor/encounter/sess-007/claim', { takeOver: true }, doctor);
    await api('PUT', '/api/doctor/drafts/sess-007', { draft: { notes: 'draft for a sample patient', allopathic: [], ayush: [] } }, doctor);
    const sos = await api('POST', '/api/kiosk/sos', { sessionId: 'sess-009', message: 'SOS for a sample patient' });
    check(sos.status === 200 && !!sos.json?.alertId, 'an SOS is raised in Mock mode');
    const mockName = `Mockmode Walkin ${stamp}`;
    const mockAbha = `77-${String(stamp).padStart(6, '0').slice(0, 4)}-1111-2222`;
    const mockIntake = await api('POST', '/api/kiosk/intake', { patient: { name: mockName, age: 52, gender: 'FEMALE', abhaId: mockAbha, phone: '9876500011' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Knee pain', severityScore: 5 }], history: { conditions: [], allergies: 'none', currentMedicines: '' }, consent });
    check(mockIntake.status === 200 && !!mockIntake.json?.sessionId, 'a patient checks in at the kiosk in Mock mode');
    const family = await api('POST', '/api/kiosk/family-intake', { familyMembers: [{ name: `Mockmode Family ${stamp}`, age: 9, gender: 'MALE', chiefComplaint: 'cough' }], consent, careStream: 'ALLOPATHY' });
    check(family.status === 200, 'a family check-in is made in Mock mode');
    const mockVisit = `mock-field-${stamp}`;
    const visitBody = { id: mockVisit, version: 1, patientName: `Mockmode Village ${stamp}`, age: 30, gender: 'FEMALE', village: 'Test Village', visitAt: new Date().toISOString(), clientUpdatedAt: new Date().toISOString() };
    const synced = await api('POST', '/api/asha/sync', { records: [visitBody] }, asha);
    check(synced.json?.results?.[0]?.status === 'accepted', 'an ASHA records a field visit in Mock mode');
    const draftPhone = `98${String(stamp).padStart(6, '0')}77`.slice(0, 10);
    const draft = await api('POST', '/api/kiosk/draft', { phone: draftPhone, stepNumber: 4, draftPayload: { patient: { name: `Mockmode Draft ${stamp}`, age: 33, gender: 'MALE', phone: draftPhone }, symptoms: [] } });
    check(draft.status === 200 && (await api('GET', `/api/kiosk/lookup-draft?phone=${draftPhone}`)).status === 200, 'an unfinished kiosk check-in is saved in Mock mode and can be resumed there');
    const flags = db.prepare('SELECT p.is_demo AS p, s.is_demo AS s FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?').get(mockIntake.json.sessionId) as any;
    check(flags?.p === 1 && flags?.s === 1, 'the Mock-mode check-in is stored as a sample record (patient and visit)');
    const famFlags = db.prepare(`SELECT COUNT(*) AS n FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE p.name = ? AND p.is_demo = 1 AND s.is_demo = 1`).get(`Mockmode Family ${stamp}`) as any;
    check(famFlags.n === 1, 'so is the family check-in');

    // Everything that could give a sample record away: names, ids, ABHA numbers, token numbers.
    const samplePatients = db.prepare('SELECT id, name, abha_id FROM patients WHERE is_demo = 1').all() as any[];
    const sampleSessions = db.prepare('SELECT id, token_no FROM sessions WHERE is_demo = 1').all() as any[];
    const markers = new Set<string>([sampleEncounter, sos.json.alertId, mockVisit, `Mockmode Village ${stamp}`, 'demo-visit-0001']);
    for (const p of samplePatients) { markers.add(p.id); if (p.name && p.name.length > 5) markers.add(p.name); if (p.abha_id) markers.add(p.abha_id); }
    for (const s of sampleSessions) { markers.add(s.id); if (s.token_no) markers.add(s.token_no); }
    const leaks = (text: string) => [...markers].filter(m => text.includes(m));
    check(samplePatients.length >= 12 && sampleSessions.length >= 12, `${samplePatients.length} sample patients and ${sampleSessions.length} sample visits exist before the switch`);

    // The same figures the Real-mode checks below expect to be empty are not empty now.
    const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const figures = async () => {
      const a = (await api('GET', '/api/admin/analytics', undefined, admin)).json?.data;
      return {
        waiting: a?.snapshot?.totals?.waitingNow as number, completed: a?.snapshot?.totals?.completedToday as number, prescriptions: a?.prescribingSafety?.prescriptions as number,
        favourites: ((await api('GET', '/api/doctor/favourites?stream=ALLOPATHY', undefined, doctor)).json?.data || []).length as number,
        quality: (await api('GET', '/api/doctor/prescribing-quality?scope=hospital&days=30', undefined, doctor)).json?.data?.encounters as number,
        surveillance: (await api('GET', `/api/doctor/ihip/weekly?weekStart=${weekStart}`, undefined, doctor)).json?.data?.visits as number,
        seen: ((await api('GET', '/api/doctor/seen-today', undefined, doctor)).json?.data || []).length as number
      };
    };
    const mock = await figures();
    check(mock.waiting > 0 && mock.completed > 0 && mock.prescriptions > 0 && mock.favourites > 0 && mock.quality > 0 && mock.surveillance > 0 && mock.seen > 0,
      `Mock mode counts the sample visits everywhere (waiting ${mock.waiting}, completed ${mock.completed}, favourites ${mock.favourites}, surveillance visits ${mock.surveillance})`);

    console.log('\n--- Switching to Real mode ---');
    const off = switchTo(false);
    check(off.demoMode === false && off.parked >= 10 && (await api('GET', '/api/system/mode')).json?.data?.demoMode === false, 'the server is in Real mode; every open sample visit was taken out of the queues');
    const stillVisible = (db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 1 AND status != 'DEMO_PARKED'`).get() as any).n;
    check(stillVisible === 0, 'no sample visit keeps a visible status, whatever state it was in (waiting, signed, dispensed, called)');

    console.log('\n--- Real mode: every list, board and report ---');
    const lists: Array<[string, string, string | undefined]> = [
      ['doctor queue', '/api/doctor/queue', doctor],
      ['pharmacy queue', '/api/doctor/pharmacy-queue', pharmacist],
      ['Schedule H1 register', '/api/doctor/h1-register', pharmacist],
      ['telemetry', '/api/doctor/telemetry', doctor],
      ['administration dashboard', '/api/admin/analytics', admin],
      ['seen today', '/api/doctor/seen-today', doctor],
      ['the doctor\'s favourite medicines', '/api/doctor/favourites?stream=ALLOPATHY', doctor],
      ['prescribing quality', '/api/doctor/prescribing-quality?scope=hospital&days=30', doctor],
      ['alert outcomes', '/api/doctor/alert-outcomes', doctor],
      ['adverse-reaction reports', '/api/doctor/adr', doctor],
      ['notifiable diseases', '/api/doctor/notifiable', doctor],
      ['waiting-room board', '/api/queue/board', doctor],
      ['SOS alerts', '/api/alerts', doctor],
      ['ASHA visits (demo ASHA account)', '/api/asha/records', asha],
      ['ASHA visits (administrator)', '/api/asha/records', admin],
      ['patient search by name', `/api/admin/patients?q=${encodeURIComponent('Mockmode')}`, admin],
      ['patient search for a seeded sample patient', '/api/admin/patients?q=Ramesh', admin],
      ['SMS log', '/api/admin/sms-log', admin],
      ['ABDM consents', '/api/abdm/hip/consents', doctor],
      ['ABDM status', '/api/abdm/hip/status', doctor]
    ];
    for (const [label, p, token] of lists) {
      const r = await api('GET', p, undefined, token);
      const found = leaks(r.text);
      check(r.status === 200 && found.length === 0, `${label}: answers, with no sample record${found.length ? ` — LEAKED: ${found.slice(0, 4).join(', ')}` : ''}`);
    }
    // What Real mode may count: the real records only. Run alone this battery has none (every figure
    // is 0); inside `npm test` earlier batteries leave a few real visits in the shared database.
    const n = (sql: string, ...args: any[]) => (db.prepare(sql).get(...args) as any).n as number;
    const doctorId = (db.prepare(`SELECT id FROM staff_users WHERE username = 'dr.sharma'`).get() as any).id as string;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const weekFrom = new Date(weekStart);
    const expected = {
      waiting: n(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 0 AND status = 'PENDING_DOCTOR'`),
      completed: n(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 0 AND status = 'COMPLETED' AND (token_date = ? OR (token_date IS NULL AND date(created_at) = date('now')))`, localDate()),
      prescriptions: n(`SELECT COUNT(*) AS n FROM encounters e JOIN patients p ON p.id = e.patient_id WHERE p.is_demo = 0 AND e.created_at > datetime('now', '-30 days')`),
      doctorPrescriptions: n(`SELECT COUNT(*) AS n FROM encounters e JOIN patients p ON p.id = e.patient_id WHERE p.is_demo = 0 AND e.doctor_id = ?`, doctorId),
      surveillance: n(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 0 AND created_at >= ? AND created_at < ?`, weekFrom.toISOString(), new Date(weekFrom.getTime() + 7 * 86400000).toISOString()),
      seen: n(`SELECT COUNT(*) AS n FROM encounters e JOIN patients p ON p.id = e.patient_id WHERE p.is_demo = 0 AND e.doctor_id = ? AND e.created_at >= ?`, doctorId, dayStart.toISOString())
    };
    const real = await figures();
    check(real.favourites < mock.favourites && (expected.doctorPrescriptions > 0 || real.favourites === 0), 'medicines prescribed to sample patients are not offered as the doctor\'s favourites');
    check(real.quality <= expected.prescriptions && real.quality < mock.quality && real.prescriptions === expected.prescriptions, `prescribing-quality and medicine-safety figures count no sample prescription (${real.prescriptions} real)`);
    check(real.surveillance === expected.surveillance && real.surveillance < mock.surveillance, `the weekly disease-surveillance return counts no sample visit (${real.surveillance} real)`);
    check(real.waiting === expected.waiting && real.completed === expected.completed && real.seen === expected.seen && real.waiting < mock.waiting && real.completed < mock.completed && real.seen < mock.seen,
      `the dashboard and the doctor\'s day count no sample visit (waiting ${real.waiting}, completed ${real.completed}, seen today ${real.seen} — all real)`);
    const isSampleVisit = (id: string) => n('SELECT COUNT(*) AS n FROM sessions WHERE id = ? AND is_demo = 1', id) > 0;
    const queueNow = async (): Promise<string[]> => ((await api('GET', '/api/doctor/queue', undefined, doctor)).json.data || []).map((q: any) => q.sessionId);
    const realBefore = await queueNow();
    check(realBefore.every(id => !isSampleVisit(id)) && realBefore.length === n(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 0 AND status IN ('PENDING_DOCTOR', 'DIVERTED_EMERGENCY', 'IN_CONSULTATION')`), `the doctor queue holds real visits only (${realBefore.length})`);

    console.log('\n--- Real mode: a sample record asked for by id ---');
    const byId: Array<[string, string, string, string | undefined, any?]> = [
      ['a sample visit (doctor desk)', 'GET', '/api/doctor/session/sess-001', doctor],
      ['a sample visit signed in Mock mode', 'GET', '/api/doctor/session/sess-003', doctor],
      ['the Mock-mode check-in', 'GET', `/api/doctor/session/${mockIntake.json.sessionId}`, doctor],
      ['the kiosk visit summary', 'GET', '/api/kiosk/session/sess-001', doctor],
      ['the queue position of a sample visit', 'GET', '/api/kiosk/position/sess-002', undefined],
      ['a sample patient\'s timeline', 'GET', '/api/doctor/patient/pat-003/timeline', doctor],
      ['a sample patient\'s documents', 'GET', '/api/documents/patient/pat-001', doctor],
      ['a draft for a sample visit', 'GET', '/api/doctor/drafts/sess-007', doctor],
      ['the FHIR bundle of a sample visit', 'GET', '/api/abdm/fhir-bundle/sess-003', doctor],
      ['a sample patient\'s ABDM care contexts', 'GET', '/api/abdm/hip/care-contexts/pat-003', doctor],
      ['a sample patient\'s data export', 'GET', '/api/admin/patients/pat-001/export', admin],
      ['verifying a sample prescription', 'GET', `/api/admin/verify-encounter/${sampleEncounter}`, admin],
      ['the sample SOS alert (kiosk view)', 'GET', `/api/kiosk/alert/${sos.json.alertId}`, undefined],
      ['similar cases for a sample visit', 'POST', '/api/retrieval/similar', doctor, { sessionId: 'sess-001' }],
      ['a safety check with a sample patient\'s context', 'POST', '/api/contraindications/evaluate', doctor, { sessionId: 'sess-001', careStream: 'ALLOPATHY', allopathic: [{ name: 'Aspirin 75 mg' }], ayush: [] }]
    ];
    for (const [label, method, p, token, body] of byId) {
      const r = await api(method, p, body, token);
      check(r.status === 404 && r.json?.code === 'SAMPLE_HIDDEN' && leaks(r.text).length === 0, `${label}: 404, sample data is hidden`);
    }

    console.log('\n--- Real mode: a screen left open from Mock mode cannot write to a sample visit ---');
    const writes: Array<[string, string, string, string | undefined, any?]> = [
      ['save vitals', 'PATCH', '/api/doctor/encounter/sess-001/vitals', doctor, { vitals: { bp: '150/95', pulse: 100 } }],
      ['claim the patient', 'POST', '/api/doctor/encounter/sess-001/claim', doctor, {}],
      ['save a draft', 'PUT', '/api/doctor/drafts/sess-001', doctor, { draft: { notes: 'x', allopathic: [], ayush: [] } }],
      ['call to the room', 'POST', '/api/queue/call/sess-001', doctor],
      ['send to the emergency room', 'PATCH', '/api/doctor/encounter/sess-001/status', doctor, { status: 'DIVERTED_EMERGENCY' }],
      ['mark not present', 'POST', '/api/queue/no-show/sess-002', doctor],
      ['sign a prescription', 'POST', '/api/doctor/prescribe', vaidya, { sessionId: 'sess-005', advice: 'Rest.', ayushPrescription: [], allopathicPrescription: [] }],
      ['dispense a sample prescription', 'POST', `/api/doctor/encounters/${sampleEncounter}/dispense`, pharmacist, { status: 'DISPENSED', items: [] }],
      ['raise an SOS for a sample visit', 'POST', '/api/kiosk/sos', undefined, { sessionId: 'sess-009' }],
      ['resolve the sample SOS', 'POST', `/api/alerts/${sos.json.alertId}/resolve`, doctor, {}],
      ['record consent for the room recording', 'POST', '/api/doctor/encounter/sess-001/recording-consent', doctor, { given: true, method: 'verbal' }],
      ['erase a sample patient', 'POST', '/api/admin/patients/pat-001/erase', admin, { note: 'test' }]
    ];
    for (const [label, method, p, token, body] of writes) {
      const r = await api(method, p, body, token);
      check(r.status === 404 && r.json?.code === 'SAMPLE_HIDDEN', `${label}: refused`);
    }
    const untouched = (db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 1 AND status != 'DEMO_PARKED'`).get() as any).n;
    const afterWrites = await queueNow();
    check(untouched === 0 && afterWrites.length === realBefore.length && afterWrites.every(id => realBefore.includes(id)), 'the Real queue is unchanged and every sample visit is still parked');
    check((await api('GET', `/api/kiosk/lookup-draft?phone=${draftPhone}`)).status === 404, 'an unfinished check-in started in Mock mode is not offered for resuming in Real mode');
    const resync = await api('POST', '/api/asha/sync', { records: [{ ...visitBody, version: 2, clientUpdatedAt: new Date().toISOString() }] }, asha);
    check(resync.json?.results?.[0]?.status === 'rejected', 'a Mock-mode field visit is not stored again from a device in Real mode');

    console.log('\n--- Real mode: similar cases use no invented data ---');
    const status = (await api('GET', '/api/retrieval/status', undefined, doctor)).json?.data;
    check(status?.corpus && (status.corpus.referenceCases ?? 0) === 0 || !status?.corpus?.indexed, 'the synthetic reference cases are not part of the Real-mode index');

    console.log('\n--- Real mode: the two worlds never share a patient ---');
    const realA = await api('POST', '/api/kiosk/intake', { patient: { name: mockName, age: 52, gender: 'FEMALE', abhaId: mockAbha, phone: '9876500011' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Fever', severityScore: 4 }], history: { conditions: [], allergies: 'none', currentMedicines: '' }, consent });
    check(realA.status === 200 && realA.json.patientId !== mockIntake.json.patientId, 'the same name, phone and ABHA number checked in for real becomes a new, real patient (not the sample record)');
    const realRow = db.prepare('SELECT is_demo, abha_id FROM patients WHERE id = ?').get(realA.json.patientId) as any;
    const mockRow = db.prepare('SELECT is_demo, abha_id FROM patients WHERE id = ?').get(mockIntake.json.patientId) as any;
    check(realRow.is_demo === 0 && realRow.abha_id === mockAbha && mockRow.is_demo === 1 && mockRow.abha_id === null, 'the real patient holds the ABHA number; the sample record gave it up');
    const realB = await api('POST', '/api/kiosk/intake', { patient: { name: 'Seeded Number Tester', age: 58, gender: 'MALE', abhaId: '91-4567-8901-2345' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Cough', severityScore: 3 }], history: { conditions: [], allergies: 'none', currentMedicines: '' }, consent });
    check(realB.status === 200 && realB.json.patientId !== 'pat-001', 'typing a seeded sample patient\'s ABHA number does not open that sample record');
    const detail = await api('GET', `/api/doctor/session/${realB.json.sessionId}`, undefined, doctor);
    check(detail.status === 200 && (detail.json.data.pastDocuments || []).length === 0 && !detail.text.includes('Ramesh Kumar'), 'and the new real visit carries none of the sample patient\'s documents or history');
    const realQueue = await queueNow();
    check(realQueue.length === realBefore.length + 2 && realQueue.includes(realA.json.sessionId) && realQueue.includes(realB.json.sessionId) && realQueue.every(id => !isSampleVisit(id)), 'the Real queue gained exactly the two patients who checked in now');
    const similar = await api('POST', '/api/retrieval/similar', { sessionId: realB.json.sessionId }, doctor);
    check(similar.status === 200 && (similar.json.data.results || []).every((c: any) => c.source !== 'reference') && leaks(similar.text).length === 0, 'similar cases for a real visit: nothing synthetic, nothing from a sample visit');

    console.log('\n--- Back to Mock mode ---');
    const on = switchTo(true);
    check(on.demoMode === true && on.restored === 10, 'the ten seeded patients are back in the queue');
    const mockQueue = ((await api('GET', '/api/doctor/queue', undefined, doctor)).json.data || []).map((q: any) => q.sessionId);
    check(mockQueue.includes('sess-001') && mockQueue.includes(mockIntake.json.sessionId) && mockQueue.includes(realA.json.sessionId), 'Mock mode shows the sample visits, the Mock-mode check-in (with its status back) and the real check-ins');
    const dispensedBack = ((await api('GET', '/api/doctor/pharmacy-queue', undefined, pharmacist)).json.data || []).some((e: any) => e.id === sampleEncounter);
    check(dispensedBack, 'the sample prescription is at the pharmacy again');
    check(((await api('GET', '/api/asha/records', undefined, asha)).json.data || []).some((r: any) => r.id === mockVisit), 'the Mock-mode field visit is listed again');
    check((await api('GET', '/api/doctor/session/sess-001', undefined, doctor)).status === 200, 'a sample visit opens again');
    check((await api('GET', `/api/kiosk/lookup-draft?phone=${draftPhone}`)).status === 200, 'the unfinished Mock-mode check-in can be resumed again');
    await api('DELETE', `/api/kiosk/draft/${draft.json.draftId}`);
    // Leave the shared test database tidy for later batteries.
    for (const id of [realA.json.sessionId, realB.json.sessionId, mockIntake.json.sessionId]) await api('POST', `/api/queue/no-show/${id}`, undefined, doctor);
    await api('POST', `/api/alerts/${sos.json.alertId}/resolve`, {}, doctor);
  } catch (err: any) {
    check(false, `battery crashed: ${err.message}`);
  } finally {
    if (!securityConfig.allowDemo) { try { switchTo(true); } catch { setRuntimeDemoMode(true); } }
    server.close();
  }
  const isPassed = passed === total;
  console.log(`\nReal-mode sample-data battery: ${passed}/${total} ${isPassed ? 'passed' : 'FAILED'} in ${(performance.now() - t0).toFixed(0)} ms`);
  return { passed, total, isPassed };
}

if (require.main === module) {
  runRealModeSampleDataBattery().then(r => process.exit(r.isPassed ? 0 : 1));
}
