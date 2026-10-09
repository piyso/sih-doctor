/**
 * HTTP integration battery: boots the real application on an ephemeral port and drives the
 * patient journey through the public API, including the safety, signature, ABDM and privacy paths.
 *
 *   npx tsx tests/http_api.test.ts
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

const consent = { purposes: { care: true, abha_link: true, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };

export async function runHttpApiBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };

  const { server } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  const api = async (method: string, p: string, body?: any, token?: string) => {
    const r = await fetch(`${base}${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json: any = null;
    try { json = await r.json(); } catch { json = null; }
    return { status: r.status, json };
  };
  const login = async (username: string) => (await api('POST', '/api/auth/login', { username, pin: demoPin(username) })).json.token as string;
  const tag = `HTTP-${Date.now()}`;

  try {
    console.log('\n--- Health, auth, access control ---');
    const health = await api('GET', '/health');
    check(health.status === 200 && health.json.status === 'HEALTHY' && Number.isInteger(health.json.schemaVersion), 'health reports schema version');
    check((await api('GET', '/api/doctor/queue')).status === 401, 'doctor queue needs sign-in');
    const doctor = await login('dr.sharma');
    const pharm = await login('pharma.ravi');
    const admin = await login('admin');
    check(!!doctor && !!pharm && !!admin, 'demo staff sign in');
    check((await api('GET', '/api/doctor/queue', undefined, pharm)).status === 403, 'pharmacist cannot read the doctor queue');

    console.log('\n--- Kiosk: parse, interview, intake ---');
    const parse = await api('POST', '/api/kiosk/parse-audio', { transcript: 'मुझे तीन दिन से बुखार है और सीने में दर्द नहीं है, BP 150 by 95' });
    check(parse.status === 200 && parse.json.data.symptoms.some((s: any) => s.name === 'Fever' && !s.isNegated) && parse.json.data.symptoms.some((s: any) => /chest/i.test(s.name) && s.isNegated) && parse.json.data.vitals.bp === '150/95', 'parse-audio: fever present, chest pain negated, BP read');
    const iv = await api('POST', '/api/kiosk/interview/start', { language: 'hi', careStream: 'ALLOPATHY', patient: { age: 34, gender: 'FEMALE' } });
    check(iv.status === 200 && iv.json.question.id === 'cc_family' && iv.json.question.options.length > 10, 'interview starts with the chief-complaint question');
    const ans = await api('POST', `/api/kiosk/interview/${iv.json.interviewId}/answer`, { questionId: 'cc_family', value: 'pregnancy' });
    check(ans.status === 200 && ans.json.question.id === 'cc_text' && ans.json.progress.planned > 30, 'answering plans the pregnancy branch');
    const bad = await api('POST', `/api/kiosk/interview/${iv.json.interviewId}/answer`, { questionId: 'hpi_severity', value: 99 });
    check(bad.status === 400, 'invalid answers are rejected');
    const noConsent = await api('POST', '/api/kiosk/intake', { patient: { name: `${tag} NoConsent`, age: 30, gender: 'FEMALE' }, symptoms: [] });
    check(noConsent.status === 400 && noConsent.json.code === 'CONSENT_REQUIRED', 'intake without consent is refused');
    const intake = await api('POST', '/api/kiosk/intake', {
      patient: { name: `${tag} Pregnant`, age: 29, gender: 'FEMALE', isPregnant: true, gestationalWeeks: 20, abhaAddress: `${tag.toLowerCase()}@sbx` },
      careStream: 'ALLOPATHY', language: 'hi', symptoms: [{ name: 'Fever', site: 'General', severityScore: 4 }],
      vitals: { bp: '150/95', pulse: 118, spo2: 93, temp: '102 F' },
      history: { conditions: ['Hypertension'], allergies: 'Sulpha', currentMedicines: 'Amlodipine 5 mg' }, consent
    });
    check(intake.status === 200 && /^[A-Z]+-\d{3}$/.test(intake.json.tokenNo), 'check-in issues a token');
    check(intake.json.vitalsAssessment?.news2 >= 5 && intake.json.triagePriority === 'HIGH_PRIORITY' && intake.json.redFlags.some((f: string) => /NEWS2/.test(f)), `NEWS2 ${intake.json.vitalsAssessment?.news2} on self-reported vitals raised priority to HIGH`);
    check(intake.json.historyCompleteness?.sections?.pastMedical === 'complete' && intake.json.historyCompleteness?.sections?.reviewOfSystems === 'not_asked', 'intake reports history completeness');
    const sessionId = intake.json.sessionId;
    const patientId = intake.json.patientId;

    console.log('\n--- Doctor desk: brief, safety, finalization ---');
    const brief = await api('GET', `/api/doctor/encounter/${sessionId}`, undefined, doctor);
    check(brief.status === 200 && brief.json.data.historySummary?.sections?.length >= 9 && /Hypertension/.test(brief.json.data.historySummary.text) && /Not asked/.test(brief.json.data.historySummary.text), 'brief carries the structured summary with not-asked sections');
    check(brief.json.data.patientContext?.isPregnant === true && brief.json.data.patientContext?.gestationalWeeks === 20 && brief.json.data.vitalsAssessment?.applicable === true, 'brief carries pregnancy context and the vitals assessment');
    const ci = await api('POST', '/api/contraindications/evaluate', { sessionId, allopathic: [{ name: 'Warfarin' }], ayush: [] });
    check(ci.status === 200 && ci.json.alerts.some((a: any) => a.alertId === 'ONT-PREG-WARFARIN') && ci.json.safetyChecks.some((c: any) => c.check === 'pregnancy_gate' && c.ran && /pregnant/.test(c.detail)), 'contraindication check resolves pregnancy from the session and fires the warfarin gate');
    const blocked = await api('POST', '/api/doctor/prescribe', { sessionId, allopathicPrescription: [{ name: 'Warfarin', dosage: '5 mg', frequency: 'OD', durationDays: 30 }] }, doctor);
    check(blocked.status === 422 && blocked.json.code === 'CRITICAL_CONTRAINDICATION', 'finalizing warfarin for a pregnant patient is blocked until acknowledged');
    const rx = await api('POST', '/api/doctor/prescribe', { sessionId, allopathicPrescription: [{ name: 'Paracetamol', dosage: '500 mg', frequency: 'TDS', durationDays: 3 }], investigationsOrdered: ['CBC'], followUpDays: 5, doctorName: 'Someone Else' }, doctor);
    check(rx.status === 200 && rx.json.signature?.algorithm === 'Ed25519' && rx.json.consultationRecord.doctorName === 'Dr. Ananya Sharma', 'paracetamol finalizes, signed, prescriber from the session');
    check(Array.isArray(rx.json.consultationRecord.safetyChecks) && rx.json.consultationRecord.patientContextUsed?.isPregnant === true, 'signed record states which safety checks ran and the context used');
    check(rx.json.abdmCareContext?.linkStatus === 'PENDING_GATEWAY' && rx.json.abdmCareContext?.abhaAddress === `${tag.toLowerCase()}@sbx`, 'ABHA patient becomes a care context (queued until the gateway is configured)');
    const encounterId = rx.json.encounterId;
    check((await api('POST', '/api/doctor/prescribe', { sessionId, advice: 'x' }, doctor)).status === 409, 'second finalization is refused');

    console.log('\n--- FHIR, seal, provenance, audit ---');
    const bundle = await api('GET', `/api/abdm/fhir-bundle/${sessionId}`, undefined, doctor);
    const types = (bundle.json.bundle?.entry || []).map((e: any) => e.resource.resourceType);
    const ids = ((bundle.json.bundle?.entry || []).find((e: any) => e.resource.resourceType === 'Patient')?.resource.identifier || []).map((i: any) => i.value);
    check(bundle.json.finalized === true && types[0] === 'Composition' && types.includes('AllergyIntolerance') && types.includes('MedicationStatement') && types.includes('ServiceRequest') && types.includes('Appointment'), 'finalized FHIR bundle has the OPConsultRecord resources');
    check(ids.includes(`${tag.toLowerCase()}@sbx`) && !ids.some((v: string) => /^(ABHA-|12-3456)/.test(v)), 'bundle carries the real ABHA address and invents nothing');
    const seal = await api('POST', '/api/security/verify-offline-seal', { encounterId }, doctor);
    check(seal.status === 200 && seal.json.verification.authentic === true && seal.json.verification.keyId, 'offline seal verifies the stored signature');
    const tamper = await api('POST', '/api/security/verify-offline-seal', { encounterId, simulateTamper: true }, doctor);
    check(tamper.json.verification.tamperDetected === true && tamper.json.verification.pharmacistLockout === true, 'a tampered record is detected');
    const zk = await api('POST', '/api/security/verify-zkp', {}, doctor);
    check(zk.status === 400, 'ZKP verifier refuses to verify without a proof');
    const prox = await api('POST', '/api/security/verify-proximity', {});
    check(prox.status === 400 && prox.json.authorized === false, 'proximity check cannot pass on an empty body');
    const merkle = await api('GET', '/api/security/verify-merkle', undefined, doctor);
    check(merkle.json.data.isValid === true && merkle.json.data.totalNodes >= 1, 'provenance chain verifies');
    const verify = await api('GET', `/api/admin/verify-encounter/${encounterId}`, undefined, pharm);
    check(verify.json.valid === true, 'pharmacist verifies the signed prescription');
    const auditChain = await api('GET', '/api/admin/audit/verify', undefined, admin);
    check(auditChain.json.data.valid === true && auditChain.json.data.checked > 5, 'audit chain verifies');

    console.log('\n--- ABDM HIP: consent and encrypted health-information exchange ---');
    const sim = await api('POST', `/api/abdm/hip/simulate-hiu/${patientId}`, undefined, doctor);
    check(sim.status === 200 && sim.json.data.entries === 1 && sim.json.data.decryptedBundles[0].valid === true && sim.json.data.decryptedBundles[0].checksumOk === true, 'HIU simulation: consent → request → encrypted push → decrypt → bundle validates');
    const hipStatus = await api('GET', '/api/abdm/hip/status', undefined, doctor);
    check(hipStatus.json.data.hiRequests?.TRANSFERRED >= 1 && hipStatus.json.data.consents >= 1, 'HIP status records the transfer and the consent');
    const noToken = await api('POST', '/api/abdm/hip/v0.5/consents/hip/notify', { notification: { consentId: 'x', status: 'GRANTED', consentDetail: { patient: { id: 'nobody@sbx' }, hiTypes: ['OPConsultation'], permission: { dateRange: { from: '2026-01-01', to: '2026-12-31' } } } } });
    check(noToken.status === 202 && noToken.json.acknowledgement.status === 'DENIED', 'consent for an unknown patient is denied');
    const term = await api('GET', '/api/abdm/namaste/search?q=bukhar');
    check(term.status === 200 && term.json.data[0]?.term === 'Vataja Jwara' && term.json.index.NAMASTE >= 20, 'terminology search ranks Vataja Jwara for "bukhar"');

    console.log('\n--- Documents and privacy ---');
    const ocr = await api('POST', '/api/documents/ocr', { text: 'Serum Creatinine 11 mg/dL\nBUN 22 mg/dL\nHb 135' });
    check(ocr.status === 200 && ocr.json.persisted === false && ocr.json.data.extractedLabMarkers.length >= 2, 'OCR without a patient returns the result and persists nothing');
    const ocrFor = await api('POST', '/api/documents/ocr', { text: 'Serum Creatinine 2.4 mg/dL\nBUN 30 mg/dL', patientId }, doctor);
    check(ocrFor.status === 200 && ocrFor.json.persisted === true, 'OCR for an existing patient is persisted');
    const ctxAfterLab = await api('POST', '/api/contraindications/evaluate', { patientId, allopathic: [{ name: 'Metformin' }], ayush: [] });
    check(ctxAfterLab.json.patientContextUsed?.eGfr !== undefined && ctxAfterLab.json.patientContextUsed.eGfr < 30 && ctxAfterLab.json.alerts.some((a: any) => a.alertId === 'ONT-RENAL-METFORMIN'), `creatinine 2.4 → eGFR ${ctxAfterLab.json.patientContextUsed?.eGfr} (CKD-EPI 2021) fires the metformin renal gate`);
    const exp = await api('GET', `/api/admin/patients/${patientId}/export`, undefined, admin);
    check(exp.status === 200 && Array.isArray(exp.json.consents) && exp.json.consents.length >= 1, 'patient data export works');
    const erase = await api('POST', `/api/admin/patients/${patientId}/erase`, { confirm: 'ERASE' }, admin);
    const after = await api('GET', `/api/doctor/encounter/${sessionId}`, undefined, doctor);
    check(erase.json.success === true && /^Erased patient/.test(after.json.data.patient.name) && after.json.data.rawTranscript === null, 'erasure pseudonymises identifiers but keeps the clinical record');
    const diag = await api('GET', '/api/security/diagnostics', undefined, doctor);
    check(diag.json.diagnostics.cognitiveEngine.conformal.calibrated === true && diag.json.diagnostics.integrityLedger.provenanceChain.isValid === true, 'diagnostics report the calibrated gate and valid chains');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }

  const durationMs = performance.now() - t0;
  const ok = passed === total;
  console.log(`\n${ok ? '[PASS]' : '[FAIL]'} HTTP API battery: ${passed}/${total} checks in ${durationMs.toFixed(0)} ms\n`);
  return { passed, total, isPassed: ok, durationMs };
}

if (require.main === module) {
  runHttpApiBattery().then(r => process.exit(r.isPassed ? 0 : 1)).catch(err => { console.error(err); process.exit(1); });
}
