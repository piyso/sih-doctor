/**
 * Doctor-desk HTTP battery: boots the real app on an ephemeral port and drives the rebuilt desk —
 * claims, drafts, live safety with the patient's allergies and reported medicines, signing with
 * typed reasons, PrescriptionRecord, pharmacy referral loop, order sets, TB notification prompt,
 * diagnosis search, ADR reports and prescribing-quality indicators.
 *
 *   npx tsx tests/desk_http.test.ts
 */
import './env';
import fs from 'fs';
import path from 'path';
import { createServer } from '../src/app';

function demoPin(username: string): string {
  const file = fs.readFileSync(path.resolve(__dirname, '../src/db/demoStaff.ts'), 'utf8');
  const m = file.match(new RegExp(`^ \\*\\s+${username.replace('.', '\\.')}\\s+\\S+\\s+(\\d+)`, 'm'));
  if (!m) throw new Error(`No demo PIN for ${username}`);
  return m[1];
}
const consent = { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };

export async function runDeskHttpBattery() {
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
  const login = async (u: string) => (await api('POST', '/api/auth/login', { username: u, pin: demoPin(u) })).json.token as string;
  const tag = `DESK-${Date.now()}`;

  try {
    const doctor = await login('dr.sharma');
    const vaidya = await login('vaidya.sharma');
    const pharm = await login('pharma.ravi');

    console.log('\n--- Intake: older patient, penicillin allergy, on warfarin ---');
    const intake = await api('POST', '/api/kiosk/intake', {
      patient: { name: `${tag} Ramesh`, age: 67, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi',
      symptoms: [{ name: 'Knee pain', site: 'Knee', severityScore: 5 }, { name: 'Sore throat', severityScore: 3 }],
      history: { conditions: ['Hypertension', 'Peptic ulcer'], allergies: 'Penicillin', currentMedicines: 'Warfarin 5 mg' }, consent
    });
    check(intake.status === 200, 'intake accepted');
    const sessionId = intake.json.sessionId;
    const patientId = intake.json.patientId;

    console.log('\n--- Claims and drafts ---');
    check((await api('POST', `/api/doctor/encounter/${sessionId}/claim`, {}, doctor)).status === 200, 'doctor claims the patient');
    const other = await api('POST', `/api/doctor/encounter/${sessionId}/claim`, {}, vaidya);
    check(other.status === 409 && other.json.code === 'CLAIMED_BY_OTHER' && /Sharma/.test(other.json.claimedBy?.name || ''), 'a second clinician is told who is seeing the patient');
    const q = await api('GET', '/api/doctor/queue', undefined, doctor);
    check(q.json.data.some((i: any) => i.sessionId === sessionId && i.claimedBy?.name && i.status === 'IN_CONSULTATION'), 'queue shows the claim and IN_CONSULTATION');
    const saved = await api('PUT', `/api/doctor/drafts/${sessionId}`, { draft: { allopathic: [{ name: 'Paracetamol' }], advice: 'rest' } }, doctor);
    const got = await api('GET', `/api/doctor/drafts/${sessionId}`, undefined, doctor);
    check(saved.status === 200 && got.json.data?.draft?.advice === 'rest', 'draft is saved on the server and read back');
    const brief = await api('GET', `/api/doctor/encounter/${sessionId}`, undefined, doctor);
    check(brief.json.data.savedDraft?.draft?.advice === 'rest' && brief.json.data.claimedBy?.name && brief.json.data.legalSignature?.configured === false, 'brief carries the draft, the claim and the e-signature status');
    check(brief.json.data.patientContext?.allergies?.some((a: any) => /penicillin/i.test(a.agent)) && brief.json.data.patientContext?.reportedMedicines?.some((m: string) => /warfarin/i.test(m)), 'patient context carries allergies and reported medicines');

    console.log('\n--- Live safety with the patient context ---');
    const live = await api('POST', '/api/contraindications/evaluate', { sessionId, careStream: 'ALLOPATHY', allopathic: [{ name: 'Amoxicillin', dosage: '500 mg', frequency: '1-1-1', durationDays: 5 }, { name: 'Ibuprofen', dosage: '400 mg', frequency: '1-0-1', durationDays: 3 }], ayush: [] }, doctor);
    const ids = (live.json.alerts || []).map((a: any) => `${a.tier}:${a.alertId}`);
    check(ids.includes('STOP:ALLERGY-MATCH'), 'penicillin allergy stops amoxicillin');
    check(ids.includes('STOP:DDI-VKA-NSAID'), 'reported warfarin + prescribed ibuprofen stops');
    check(ids.some((i: string) => i.startsWith('WARN:DIS-PEPTIC-NSAID')), 'peptic ulcer + NSAID warns');
    check(live.json.stopGroups?.length >= 2 && live.json.coverage?.contextUsed?.some((c: string) => /allergies: Penicillin/i.test(c)), 'response lists STOP groups and what context was used');
    const fdc = await api('POST', '/api/contraindications/evaluate', { sessionId, allopathic: [{ name: 'Cetirizine + Paracetamol + Phenylephrine' }], ayush: [] }, doctor);
    check(fdc.json.alerts.some((a: any) => a.alertId === 'FDC-BANNED' && a.tier === 'STOP' && /3385/.test(a.itemB)), 'banned FDC stops with its gazette number');

    console.log('\n--- Signing needs a reason for each STOP ---');
    const rx = { sessionId, allopathicPrescription: [{ name: 'Amoxicillin', dosage: '500 mg', frequency: '1-1-1', durationDays: 5, indication: 'Streptococcal pharyngitis' }], diagnoses: [{ display: 'Acute pharyngitis', status: 'provisional', source: 'doctor' }], investigationsOrdered: ['cbc', { id: 'inr', display: 'PT / INR' }], advice: 'Warm saline gargles' };
    const blocked = await api('POST', '/api/doctor/prescribe', rx, doctor);
    check(blocked.status === 422 && blocked.json.code === 'CRITICAL_CONTRAINDICATION' && blocked.json.missingAcknowledgements?.length === 1, 'unacknowledged STOP is refused with the group to acknowledge');
    const group = blocked.json.stopGroups[0].groupKey;
    const tooShort = await api('POST', '/api/doctor/prescribe', { ...rx, alertAcknowledgements: [{ groupKey: group, reason: 'ok' }] }, doctor);
    check(tooShort.status === 422, 'a two-letter reason is not accepted');
    const signed = await api('POST', '/api/doctor/prescribe', { ...rx, alertAcknowledgements: [{ groupKey: group, reason: 'Rash in 2019 was viral; tolerated amoxicillin in 2024 (records seen)' }] }, doctor);
    check(signed.status === 200, 'signed with a documented reason');
    const rec = signed.json.consultationRecord || {};
    check(rec.criticalAlertsAcknowledged?.items?.[0]?.reason?.startsWith('Rash in 2019') && rec.criticalAlertsAcknowledged?.byName, 'the reason is inside the sealed record');
    check(rec.allopathicPrescription?.[0]?.quantity === 15 && rec.allopathicPrescription?.[0]?.indication, 'quantity to dispense (1-1-1 × 5 days = 15) and indication are recorded');
    check(rec.diagnoses?.[0]?.display === 'Acute pharyngitis' && rec.diagnoses?.[0]?.source === 'doctor', 'diagnosis is the doctor’s');
    const comp = signed.json.prescriptionBundle?.entry?.[0]?.resource;
    check(comp?.type?.coding?.[0]?.code === '440545006' && comp?.section?.[0]?.entry?.length === 1, 'PrescriptionRecord document with SNOMED 440545006');
    const sr = signed.json.fhirBundle.entry.map((e: any) => e.resource).filter((r: any) => r.resourceType === 'ServiceRequest');
    check(sr.some((r: any) => r.code?.coding?.[0]?.code === '58410-2'), 'CBC ServiceRequest carries LOINC 58410-2');
    check(signed.json.signature?.legal?.configured === false && signed.json.signature?.algorithm === 'Ed25519', 'seal present; legal e-signature reported as not configured');

    console.log('\n--- Pharmacy loop ---');
    const pq = await api('GET', '/api/doctor/pharmacy-queue', undefined, pharm);
    const item = pq.json.data.find((x: any) => x.id === signed.json.encounterId);
    check(item?.acknowledgedAlerts?.length === 1 && item.allopathicMeds[0].quantity === 15, 'pharmacy sees the acknowledged alert and the quantity');
    check((await api('POST', `/api/doctor/encounters/${signed.json.encounterId}/dispense`, { status: 'REFERRED_BACK' }, pharm)).status === 400, 'referral back needs a note');
    check((await api('POST', `/api/doctor/encounters/${signed.json.encounterId}/dispense`, { status: 'REFERRED_BACK', note: 'Amoxicillin out of stock; please choose another' }, pharm)).status === 200, 'pharmacist refers back with a note');
    const q2 = await api('GET', '/api/doctor/queue', undefined, doctor);
    check(q2.json.data.some((i: any) => i.sessionId === sessionId && i.visitType === 'PHARMACY_REFERRED' && /out of stock/.test(i.pharmacyReferral?.note || '')), 'referral returns to the doctor’s queue');
    const today = await api('GET', '/api/doctor/seen-today', undefined, doctor);
    check(today.json.data.some((e: any) => e.encounterId === signed.json.encounterId && e.dispenseStatus === 'REFERRED_BACK'), 'seen-today shows the visit and its pharmacy status');
    const tl = await api('GET', `/api/doctor/patient/${patientId}/timeline`, undefined, doctor);
    check(tl.json.data.encounters[0]?.medicines?.[0]?.name === 'Amoxicillin', 'timeline lists the visit and its medicines');

    console.log('\n--- Pharmacy counter: patient context, amendment, per-line record, Schedule H1 register ---');
    check(item?.patientContext?.allergies?.some((a: any) => /penicillin/i.test(a.agent)) && item?.patientContext?.pregnancy === null, 'pharmacy sees the allergies the checks used (and no pregnancy field for a man)');
    check(Array.isArray(item?.lasaAlerts) && item.lasaAlerts.length === 0, 'interaction alerts are not passed off as look-alike alerts');
    const amended = await api('POST', '/api/doctor/prescribe', {
      sessionId, amend: true, diagnoses: [{ display: 'Acute pain', status: 'final', source: 'doctor' }],
      allopathicPrescription: [{ name: 'Paracetamol', dosage: '650 mg', frequency: '1-1-1 after food', durationDays: 3 }, { name: 'Tramadol', dosage: '50 mg', frequency: '1-0-1', durationDays: 3 }], advice: 'rest'
    }, doctor);
    check(amended.status === 200, 'doctor signs an amended prescription after the referral');
    const pq2 = await api('GET', '/api/doctor/pharmacy-queue', undefined, pharm);
    const newer = pq2.json.data.find((x: any) => x.id === amended.json.encounterId);
    check(newer?.amendsEncounterId === signed.json.encounterId && newer?.dispenseStatus === 'PENDING_VERIFICATION', 'the amended prescription names the one it replaces');
    check(newer?.scheduleH1?.some((h: any) => /tramadol/i.test(h.generic)), 'tramadol is flagged for the register');
    const partly = await api('POST', `/api/doctor/encounters/${amended.json.encounterId}/dispense`, {
      status: 'PARTIAL', note: 'Not given: Paracetamol',
      items: [{ name: 'Paracetamol', given: false, quantity: 9 }, { name: 'Tramadol', given: true, quantity: 6, batch: 'TRM-2291', secret: 'dropped' }]
    }, pharm);
    check(partly.status === 200, 'partly-given hand-over recorded line by line');
    const pq3 = await api('GET', '/api/doctor/pharmacy-queue', undefined, pharm);
    const done = pq3.json.data.find((x: any) => x.id === amended.json.encounterId);
    check(done?.dispensedItems?.length === 2 && done.dispensedItems[1].given === true && done.dispensedItems[1].batch === 'TRM-2291' && !('secret' in done.dispensedItems[1]), 'the queue returns what was given per line, and only the known fields');
    const reg = await api('GET', '/api/doctor/h1-register', undefined, pharm);
    const entry = reg.json?.data?.entries?.find((e: any) => e.encounterId === amended.json.encounterId);
    check(reg.status === 200 && !!entry && /tramadol/i.test(entry.medicine) && entry.quantity === 6 && entry.batch === 'TRM-2291' && entry.supplied === 'yes' && /Sharma/.test(entry.prescriber) && entry.patient === `${tag} Ramesh`, 'Schedule H1 register lists the supply: prescriber, patient, medicine, quantity, batch');
    check(!reg.json.data.entries.some((e: any) => /paracetamol/i.test(e.medicine)), 'the register holds only Schedule H1 / NDPS medicines');
    check((await api('GET', '/api/doctor/h1-register', undefined, doctor)).status === 403, 'the register is for the pharmacist and the administrator');

    console.log('\n--- Vitals, order sets, terminology, quality, ADR ---');
    const vit = await api('PATCH', `/api/doctor/encounter/${sessionId}/vitals`, { vitals: { respiratoryRate: 18, weightKg: 62, consciousness: 'A' } }, doctor);
    check(vit.status === 200 && vit.json.vitals.weightKg === 62 && vit.json.vitalsAssessment, 'RR, AVPU and weight recorded');
    const sets = await api('GET', '/api/doctor/order-sets?stream=ALLOPATHY', undefined, doctor);
    check(sets.json.data.some((s: any) => s.id === 'os-ihci-htn' && s.steps?.length === 6), 'IHCI hypertension protocol order set with 6 steps');
    const mine = await api('POST', '/api/doctor/order-sets', { name: `${tag} my fever`, careStream: 'ALLOPATHY', medicines: [{ name: 'Paracetamol', dosage: '650 mg', frequency: '1-1-1', durationDays: 3 }] }, doctor);
    check(mine.status === 200 && (await api('DELETE', `/api/doctor/order-sets/${mine.json.id}`, undefined, doctor)).json.success === true, 'doctor saves and deletes an own order set');
    // Medicine search: only medicines whose own name or brand matches are offered. An unknown name must come back
    // empty, because Enter on the desk picks the first hit; padding the list would prescribe a different medicine.
    const find = async (q: string) => ((await api('GET', `/api/doctor/formulary/search?q=${encodeURIComponent(q)}&stream=ALLOPATHY`, undefined, doctor)).json.data || []) as any[];
    const unknown = [await find('zzzz'), await find('bilastine'), await find('rifaximin'), await find('pain')];
    check(unknown.every(h => h.length === 0), `medicine search returns nothing for text that matches no medicine (${unknown.map(h => h.length).join(', ')} hits)`);
    const dolo = await find('dolo'), amox = await find('amox'), tene = await find('teneligliptin');
    check(dolo[0]?.generic === 'Paracetamol' && dolo[0]?.matchedBrand && amox[0]?.generic === 'Amoxicillin' && amox.every(h => /amox/i.test(h.generic + ' ' + (h.brands || []).join(' ') + (h.matchedBrand || ''))) && tene.length === 1 && tene[0].defaults === undefined,
      `a brand finds its generic first ("dolo" → ${dolo[0]?.generic}), a prefix finds only matching medicines ("amox" → ${amox.length}), an exact name finds one`);
    const dx = await api('GET', '/api/doctor/diagnosis-search?q=fever', undefined, doctor);
    check(dx.status === 200 && dx.json.data.length > 0 && dx.json.data.every((d: any) => typeof d.codeVerified === 'boolean'), 'diagnosis search marks placeholder codes as unverified');
    const qual = await api('GET', '/api/doctor/prescribing-quality?scope=me&days=30', undefined, doctor);
    check(qual.json.data.indicators.some((i: any) => i.id === 'abx_indication_pct') && qual.json.data.encounters >= 1, 'prescribing-quality indicators computed');
    const adr = await api('POST', '/api/doctor/adr', { patientId, sessionId, reaction: 'Urticarial rash 2 hours after first dose', suspectedMedicines: [{ name: 'Amoxicillin', stream: 'ALLOPATHY' }], seriousness: 'non-serious' }, doctor);
    check(adr.status === 200 && /PvPI/.test(adr.json.data.channel), 'ADR report prepared for PvPI');

    console.log('\n--- TB notification prompt ---');
    const tb = await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} TB`, age: 40, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Cough', severityScore: 5 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent });
    const tbRx = await api('POST', '/api/doctor/prescribe', { sessionId: tb.json.sessionId, diagnoses: [{ display: 'Pulmonary tuberculosis', status: 'final', source: 'doctor' }], allopathicPrescription: [{ name: '4FDC', dosage: '3 tablets', frequency: '1-0-0 empty stomach', durationDays: 56 }], advice: 'Daily DOTS' }, doctor);
    check(tbRx.status === 200 && tbRx.json.notifiable?.some((n: any) => n.type === 'NIKSHAY_TB'), 'TB diagnosis creates a pending Nikshay notification');
    const pending = await api('GET', '/api/doctor/notifiable?status=PENDING', undefined, doctor);
    const n = pending.json.data.find((x: any) => x.sessionId === tb.json.sessionId);
    check(!!n && (await api('POST', `/api/doctor/notifiable/${n.id}/submitted`, { referenceNo: 'NKS-TEST-1' }, doctor)).json.success === true, 'notification marked submitted with a reference');

    console.log('\n--- Animal bite: NRCP order set, IHIP prompt, ontology codes ---');
    const allSets = await api('GET', '/api/doctor/order-sets?careStream=ALLOPATHY', undefined, doctor);
    const cat3 = allSets.json.data?.find((x: any) => x.id === 'os-animal-bite-cat3');
    check(!!cat3 && cat3.medicines.some((m: any) => /immunoglobulin/i.test(m.name)), 'NRCP category III set includes rabies immunoglobulin');
    const bite = await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} Bite`, age: 30, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Wound', severityScore: 3 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent });
    const biteEval = await api('POST', '/api/contraindications/evaluate', { allopathicPrescription: cat3.medicines, ayushPrescription: [] }, doctor);
    check(biteEval.status === 200 && (biteEval.json.coverage?.unresolved || []).length === 0, 'every medicine in the bite set is in the safety database');
    const biteRx = await api('POST', '/api/doctor/prescribe', { sessionId: bite.json.sessionId, diagnoses: [{ display: 'Dog bite, category II exposure', status: 'final', source: 'doctor' }], allopathicPrescription: [{ name: 'Rabies vaccine (cell culture)', dosage: '0.1 mL ID at 2 sites', frequency: 'Days 0, 3, 7, 28', durationDays: 28, route: 'INTRADERMAL' }], advice: 'Wash the wound' }, doctor);
    check(biteRx.status === 200 && biteRx.json.notifiable?.some((x: any) => x.type === 'IHIP_ANIMAL_BITE'), 'animal bite creates a pending IHIP notification');
    const oaRx = await api('POST', '/api/doctor/prescribe', { sessionId: (await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} OA`, age: 60, gender: 'FEMALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Knee pain', severityScore: 4 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent })).json.sessionId,
      diagnoses: [{ display: 'Osteoarthritis of knee', system: 'NAMASTE', code: 'AYU-SAN-005', snomed: '399269003', status: 'provisional', source: 'accepted_suggestion' }], allopathicPrescription: [{ name: 'Paracetamol', dosage: '650 mg', frequency: '1-0-1', durationDays: 5 }] }, doctor);
    check(oaRx.status === 200 && oaRx.json.consultationRecord.diagnoses[0].snomed === '239873007', 'a stale SNOMED code in a draft is replaced from the ontology at signing');
    const pv = await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} Preview`, age: 45, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Fever', severityScore: 3 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent });
    const preview = await api('POST', `/api/doctor/encounter/${pv.json.sessionId}/fhir-preview`, { diagnoses: [{ display: 'Acute febrile illness', status: 'provisional', source: 'doctor' }], allopathicPrescription: [{ name: 'Paracetamol', dosage: '650 mg', frequency: '1-1-1', durationDays: 3 }] }, doctor);
    const res = (preview.json.bundle?.entry || []).map((e: any) => e.resource);
    check(preview.status === 200 && res.find((r: any) => r.resourceType === 'Composition')?.status === 'preliminary'
      && res.some((r: any) => r.resourceType === 'MedicationRequest' && /paracetamol/i.test(JSON.stringify(r.medicationCodeableConcept)))
      && res.some((r: any) => r.resourceType === 'Condition' && /febrile/i.test(JSON.stringify(r.code)))
      && res.find((r: any) => r.resourceType === 'Encounter')?.status === 'in-progress', 'ABDM preview is built from the draft and marked preliminary / in-progress');
    const stillOpen = await api('GET', `/api/doctor/encounter/${pv.json.sessionId}`, undefined, doctor);
    check(!stillOpen.json.data?.existingEncounter, 'the preview stores nothing');

    console.log('\n--- Scribe: consent for room recording, enforced by the server ---');
    const audio = async (sid: string, mode: string, bytes: number, token = doctor) => {
      const r = await fetch(`${base}/api/doctor/encounter/${sid}/scribe/transcribe?mode=${mode}&lang=hi`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', Authorization: `Bearer ${token}` }, body: Buffer.alloc(bytes) });
      return { status: r.status, json: await r.json().catch(() => null) };
    };
    const adult = (await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} Scribe adult`, age: 40, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Cough', severityScore: 3 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent })).json.sessionId;
    const child = (await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} Scribe child`, age: 9, gender: 'FEMALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Fever', severityScore: 3 }], history: { conditions: [], allergies: '', currentMedicines: '' }, consent })).json.sessionId;
    const consentUrl = (sid: string) => `/api/doctor/encounter/${sid}/recording-consent`;
    check((await audio(adult, 'room', 4000)).json?.code === 'RECORDING_CONSENT_REQUIRED', 'room audio without consent is refused by the server');
    check((await audio(adult, 'dictation', 10)).status === 400, 'dictation needs no consent (only the audio check applies)');
    check((await api('POST', consentUrl(adult), { event: 'given', consenter: 'patient', noticeLanguage: 'hi' }, doctor)).json?.code === 'OTHERS_NOT_INFORMED', 'consent cannot be recorded until others in the room were told');
    check((await api('POST', consentUrl(child), { event: 'given', consenter: 'patient', othersInformed: true, noticeLanguage: 'hi' }, doctor)).json?.code === 'GUARDIAN_REQUIRED', 'a child cannot consent alone: a parent or guardian answers');
    check((await api('POST', consentUrl(child), { event: 'given', consenter: 'guardian', othersInformed: true }, doctor)).json?.code === 'CONSENTER_DETAILS_REQUIRED', 'the guardian’s name and relationship are required');
    const g = await api('POST', consentUrl(child), { event: 'given', consenter: 'guardian', consenterName: 'Sunita', relationship: 'mother', othersInformed: true, noticeLanguage: 'hi' }, doctor);
    check(g.status === 200 && g.json.data.event === 'given' && g.json.data.consenterName === 'Sunita' && /notice-v1/.test(g.json.data.noticeVersion), 'guardian consent recorded with name, relationship and notice version');
    const ok = await api('POST', consentUrl(adult), { event: 'given', consenter: 'patient', othersInformed: true, noticeLanguage: 'hi' }, doctor);
    check(ok.status === 200 && ok.json.data.given === true, 'adult patient consent recorded');
    check((await audio(adult, 'room', 10)).status === 400, 'with consent, room audio passes the consent gate');
    const scribeBrief = await api('GET', `/api/doctor/encounter/${adult}`, undefined, doctor);
    check(scribeBrief.json.data?.recordingConsent?.event === 'given', 'the encounter brief carries the consent for this visit');
    check((await api('POST', consentUrl(adult), { event: 'withdrawn' }, doctor)).json?.data?.event === 'withdrawn', 'withdrawal is recorded');
    check((await audio(adult, 'room', 4000)).json?.code === 'RECORDING_CONSENT_REQUIRED', 'after withdrawal the server refuses room audio again');
    check((await api('POST', consentUrl(adult), { event: 'withdrawn' }, doctor)).json?.code === 'NO_ACTIVE_CONSENT', 'there is nothing to withdraw twice');
    check((await audio(adult, 'room', 4000, pharm)).status === 403, 'only a doctor or vaidya can use the scribe');
    const signedAids = await api('POST', '/api/doctor/prescribe', { sessionId: adult, diagnoses: [{ display: 'Acute bronchitis', status: 'provisional', source: 'doctor' }], allopathicPrescription: [{ name: 'Paracetamol', dosage: '500 mg', frequency: '1-0-1', durationDays: 3 }] }, doctor);
    const abxVisit = (await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} Abx server`, age: 30, gender: 'FEMALE' }, careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Sore throat', severityScore: 3 }], history: { conditions: [], allergies: 'none', currentMedicines: '' }, consent })).json.sessionId;
    const noInd = await api('POST', '/api/doctor/prescribe', { sessionId: abxVisit, diagnoses: [{ display: 'Acute pharyngitis', status: 'provisional', source: 'doctor' }], allopathicPrescription: [{ name: 'Amoxicillin', dosage: '500 mg', frequency: '1-1-1', durationDays: 5 }] }, doctor);
    check(noInd.status === 422 && noInd.json.code === 'INDICATION_REQUIRED', 'the server refuses an antibiotic without an indication (not only the screen)');
    check(signedAids.status === 200 && 'documentationAids' in signedAids.json.consultationRecord && signedAids.json.consultationRecord.documentationAids.roomRecording === null, 'the signed record states how its notes were prepared (no room clips here)');
  } catch (err: any) {
    check(false, `battery crashed: ${err.message}`);
  } finally {
    server.close();
  }
  const isPassed = passed === total;
  console.log(`\nDesk HTTP battery: ${passed}/${total} ${isPassed ? 'passed' : 'FAILED'} in ${(performance.now() - t0).toFixed(0)} ms`);
  return { passed, total, isPassed };
}

if (require.main === module) {
  runDeskHttpBattery().then(r => process.exit(r.isPassed ? 0 : 1));
}
