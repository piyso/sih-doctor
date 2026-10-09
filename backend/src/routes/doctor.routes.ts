/**
 * Physician consultation desk: queue, pre-consultation brief, vitals, finalization, pharmacy.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { ClinicalParserService } from '../services/clinicalParser.service';
import { AyushEngineService } from '../services/ayushEngine.service';
import { TruthEngineService } from '../services/truthEngine.service';
import { FhirGeneratorService } from '../services/fhirGenerator.service';
import { ZkProofService } from '../services/zkProof.service';
import { ConsultationRecord } from '../shared/types';
import { seedDatabase, restoreDemoQueue } from '../db/seed';
import { requireStaff, demoOnly } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { signRecord } from '../security/recordSigning';
import { publish } from '../services/eventBus.service';
import { ensureSessionToken, DEPARTMENT_ROOMS, DepartmentCode } from '../services/hospitalRouting.service';
import { getOperationalSnapshot, getSyndromicSignals, getPrescribingSafety } from '../services/analytics.service';
import { SmsService } from '../services/sms.service';
import { buildPatientContext } from '../services/patientContext.service';
import { normaliseHistory, buildHistorySummary } from '../services/clinicalHistory.service';
import { assessVitals, raisePriority } from '../services/triage.service';

try { db.exec('ALTER TABLE encounters ADD COLUMN signature_json TEXT;'); } catch {}
try { db.exec('ALTER TABLE encounters ADD COLUMN care_stream TEXT;'); } catch {}
db.exec(`
  CREATE TABLE IF NOT EXISTS dispenses (
    id TEXT PRIMARY KEY,
    encounter_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    pharmacist_id TEXT NOT NULL,
    pharmacist_name TEXT NOT NULL,
    items_json TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );
`);

export const doctorRouter = Router();

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** POST /api/doctor/seed (demo only) */
doctorRouter.post('/seed', demoOnly, requireStaff('admin'), (req: Request, res: Response): void => {
  try {
    seedDatabase();
    audit(req, 'demo.seed_database');
    res.json({ success: true, message: 'Database seeded with the demo cohort' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor/demo-queue (demo only): re-open demo patients without deleting records. */
doctorRouter.post('/demo-queue', demoOnly, requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const restored = restoreDemoQueue();
    audit(req, 'demo.restore_queue', null, { restored });
    publish({ type: 'queue.changed', reason: 'demo_restore' });
    res.json({ success: true, restored });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/doctor/queue: live OPD queue ordered by triage priority. */
doctorRouter.get('/queue', requireStaff(...CLINICIAN_ROLES, 'reception'), (_req: Request, res: Response): void => {
  try {
    const missing = db.prepare(`SELECT id FROM sessions WHERE status IN ('PENDING_DOCTOR', 'DIVERTED_EMERGENCY', 'IN_CONSULTATION') AND token_no IS NULL`).all() as Array<{ id: string }>;
    for (const m of missing) ensureSessionToken(m.id);

    const rows: any[] = db.prepare(`
      SELECT s.id as session_id, s.triage_priority, s.status, s.created_at, s.vitals_json, s.red_flag_triggers,
             s.care_stream, s.symptoms_json, s.department, s.token_no, s.called_at, s.call_count,
             p.id as patient_id, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id,
             p.is_pregnant, p.gestational_weeks, p.is_lactating, p.weight_kg
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.status IN ('PENDING_DOCTOR', 'DIVERTED_EMERGENCY', 'IN_CONSULTATION')
      ORDER BY CASE s.triage_priority WHEN 'EMERGENCY_RED_FLAG' THEN 1 WHEN 'HIGH_PRIORITY' THEN 2 ELSE 3 END, s.created_at ASC
    `).all();

    const queue = rows.map(r => ({
      sessionId: r.session_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      age: r.age,
      gender: r.gender,
      language: r.language,
      prakriti: r.prakriti,
      abhaId: r.abha_id,
      isPregnant: Boolean(r.is_pregnant),
      gestationalWeeks: r.gestational_weeks || undefined,
      isLactating: Boolean(r.is_lactating),
      weightKg: r.weight_kg || undefined,
      triagePriority: r.triage_priority,
      status: r.status,
      redFlags: safeJsonParse(r.red_flag_triggers, []),
      vitals: safeJsonParse(r.vitals_json, {}),
      careStream: r.care_stream || 'UNDECIDED',
      primaryComplaint: (() => {
        const first: any = safeJsonParse<any[]>(r.symptoms_json, [])[0];
        return first ? (first.name || first.symptom_name || first.site || undefined) : undefined;
      })(),
      registeredAt: r.created_at,
      department: r.department || undefined,
      tokenNo: r.token_no || undefined,
      room: r.department && DEPARTMENT_ROOMS[r.department as DepartmentCode] ? DEPARTMENT_ROOMS[r.department as DepartmentCode].room : undefined,
      calledAt: r.called_at || undefined,
      callCount: r.call_count || 0
    }));

    res.json({ success: true, data: queue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/doctor/encounter/:sessionId
 * Pre-consultation brief: structured history and summary, documents, provisional codes,
 * patient safety context and vitals assessment.
 */
doctorRouter.get(['/encounter/:sessionId', '/session/:sessionId'], requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  const t0 = performance.now();
  try {
    const sessionRow: any = db.prepare(`
      SELECT s.*, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id, p.abha_address,
             p.is_pregnant, p.gestational_weeks, p.is_lactating, p.weight_kg
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `).get(String(req.params.sessionId));

    if (!sessionRow) {
      res.status(404).json({ error: 'Consultation session not found' });
      return;
    }

    const docRows: any[] = db.prepare(`SELECT * FROM documents WHERE patient_id = ? ORDER BY created_at DESC`).all(sessionRow.patient_id);
    const documents = docRows.map(d => {
      const meta: any = safeJsonParse(d.metadata_json, {});
      return {
        documentId: d.id,
        documentType: d.document_type,
        extractedMedications: meta.medications || [],
        extractedLabMarkers: meta.labMarkers || [],
        extractedDiagnoses: meta.diagnoses || [],
        plausibilityWarnings: meta.plausibilityWarnings || [],
        humanReviewRequired: meta.humanReviewRequired || false,
        recordedDate: meta.recordedDate,
        createdAt: d.created_at
      };
    });

    const symptoms: any[] = safeJsonParse(sessionRow.symptoms_json, []);
    const pariksha: any = safeJsonParse(sessionRow.pariksha_json, {});
    const vitals: any = safeJsonParse(sessionRow.vitals_json, {});
    const redFlags: any[] = safeJsonParse(sessionRow.red_flag_triggers, []);
    const history = normaliseHistory(safeJsonParse(sessionRow.history_json, null));

    const encounterRow: any = db.prepare(`SELECT * FROM encounters WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`).get(sessionRow.id);
    const existingEncounter: any = encounterRow ? safeJsonParse(encounterRow.case_sheet_json, null) : null;

    const provisionalDiagnoses = symptoms.filter((s: any) => !s?.isNegated).map((s: any) => AyushEngineService.resolveDiagnosis(s)).filter(Boolean);
    const parikshaAdvisory = AyushEngineService.evaluatePariksha(pariksha);
    const patient = {
      id: sessionRow.patient_id,
      name: sessionRow.patient_name,
      age: sessionRow.age,
      gender: sessionRow.gender,
      language: sessionRow.language,
      prakriti: sessionRow.prakriti,
      isPregnant: Boolean(sessionRow.is_pregnant),
      gestationalWeeks: sessionRow.gestational_weeks || undefined,
      isLactating: Boolean(sessionRow.is_lactating),
      weightKg: sessionRow.weight_kg || undefined,
      abhaId: sessionRow.abha_id,
      abhaAddress: sessionRow.abha_address
    };
    const historySummary = buildHistorySummary({ patient, symptoms, history, vitals, pariksha, documents, rawTranscript: sessionRow.raw_transcript });
    const patientContext = buildPatientContext(sessionRow.patient_id);
    const vitalsAssessment = assessVitals(vitals, { selfReported: vitals.source !== 'clinician', age: sessionRow.age, isPregnant: !!sessionRow.is_pregnant });

    audit(req, 'record.view', sessionRow.id, { patientId: sessionRow.patient_id });

    res.json({
      success: true,
      latencyMs: parseFloat((performance.now() - t0).toFixed(2)),
      data: {
        sessionId: sessionRow.id,
        patient,
        triagePriority: sessionRow.triage_priority,
        redFlags,
        symptoms,
        pariksha,
        parikshaAdvisory,
        vitals,
        vitalsAssessment,
        rawTranscript: sessionRow.raw_transcript,
        careStream: sessionRow.care_stream || 'UNDECIDED',
        history,
        historySummary,
        patientContext,
        pastDocuments: documents,
        provisionalDiagnoses,
        existingEncounter,
        tokenNo: sessionRow.token_no || undefined,
        department: sessionRow.department || undefined,
        status: sessionRow.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/doctor/encounter/:sessionId/vitals
 * Nurse / doctor measured vitals. NEWS2 is recomputed and can only raise the triage priority.
 */
doctorRouter.patch('/encounter/:sessionId/vitals', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const incoming = req.body?.vitals;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'vitals object is required' });
      return;
    }
    const row: any = db.prepare(`
      SELECT s.vitals_json, s.triage_priority, p.age, p.is_pregnant FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?
    `).get(String(req.params.sessionId));
    if (!row) {
      res.status(404).json({ error: 'Consultation session not found' });
      return;
    }
    const allowed = ['bp', 'pulse', 'spo2', 'temp', 'respiratoryRate', 'bloodSugar', 'weightKg', 'consciousness', 'onOxygen'];
    const merged: Record<string, any> = { ...safeJsonParse(row.vitals_json, {}) };
    for (const key of allowed) {
      if (key in incoming) {
        const value = incoming[key];
        if (value === null || value === '' || value === undefined) delete merged[key];
        else merged[key] = value;
      }
    }
    merged.recordedAt = new Date().toISOString();
    merged.recordedBy = req.staff!.displayName;
    merged.source = 'clinician';
    const assessment = assessVitals(merged, { selfReported: false, age: row.age, isPregnant: !!row.is_pregnant });
    merged.news2 = assessment.applicable ? { score: assessment.news2, band: assessment.band, at: merged.recordedAt } : null;
    const newPriority = assessment.applicable ? raisePriority(row.triage_priority, assessment.suggestedPriority) : row.triage_priority;
    db.prepare(`UPDATE sessions SET vitals_json = ?, triage_priority = ? WHERE id = ?`).run(JSON.stringify(merged), newPriority, String(req.params.sessionId));
    audit(req, 'record.vitals_updated', String(req.params.sessionId), { fields: Object.keys(incoming).filter(k => allowed.includes(k)), news2: assessment.news2, priority: newPriority });
    publish({ type: 'queue.changed', reason: 'vitals', sessionId: String(req.params.sessionId) });
    res.json({ success: true, vitals: merged, vitalsAssessment: assessment, triagePriority: newPriority, priorityRaised: newPriority !== row.triage_priority });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/doctor/encounter/:sessionId/status */
doctorRouter.patch('/encounter/:sessionId/status', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const status = req.body?.status;
    const allowed = ['PENDING_DOCTOR', 'IN_CONSULTATION', 'DIVERTED_EMERGENCY'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
      return;
    }
    const result = db.prepare(`
      UPDATE sessions SET status = ?,
        triage_priority = CASE WHEN ? = 'DIVERTED_EMERGENCY' THEN 'EMERGENCY_RED_FLAG' ELSE triage_priority END,
        consult_started_at = CASE WHEN ? = 'IN_CONSULTATION' THEN COALESCE(consult_started_at, ?) ELSE consult_started_at END
      WHERE id = ?
    `).run(status, status, status, new Date().toISOString(), String(req.params.sessionId));
    if (result.changes === 0) {
      res.status(404).json({ error: 'Consultation session not found' });
      return;
    }
    audit(req, 'queue.status_changed', String(req.params.sessionId), { status });
    publish({ type: 'queue.changed', reason: 'status', sessionId: String(req.params.sessionId) });
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/doctor/encounters & /api/doctor/pharmacy-queue */
doctorRouter.get(['/encounters', '/pharmacy-queue'], requireStaff('pharmacist', ...CLINICIAN_ROLES), (_req: Request, res: Response): void => {
  try {
    const rows: any[] = db.prepare(`
      SELECT e.*, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id,
             s.triage_priority, s.token_no, s.department AS dept_code,
             d.status AS dispense_status, d.pharmacist_name, d.created_at AS dispensed_at, d.note AS dispense_note
      FROM encounters e
      JOIN patients p ON e.patient_id = p.id
      JOIN sessions s ON e.session_id = s.id
      LEFT JOIN dispenses d ON d.encounter_id = e.id
      WHERE e.created_at > datetime('now', '-3 days')
      ORDER BY (d.status IS NOT NULL), e.created_at DESC
    `).all();

    const queue = rows.map(r => {
      const sheet: any = safeJsonParse(r.case_sheet_json, {});
      const signature: any = safeJsonParse(r.signature_json, null);
      const stream = r.care_stream || sheet.careStream;
      return {
        id: r.id,
        prescriptionToken: r.token_no || `RX-${r.id.slice(0, 6).toUpperCase()}`,
        patientName: r.patient_name,
        age: r.age,
        gender: r.gender,
        language: r.language,
        doctorName: r.doctor_name,
        doctorRegistration: sheet.doctorRegistration || '',
        roomNumber: r.dept_code && DEPARTMENT_ROOMS[r.dept_code as DepartmentCode] ? DEPARTMENT_ROOMS[r.dept_code as DepartmentCode].room : r.department,
        department: r.department,
        careStream: stream,
        prescribedAt: r.created_at,
        allopathicMeds: stream === 'AYURVEDA' ? [] : (sheet.allopathicPrescription || []),
        ayushFormulations: stream === 'ALLOPATHY' ? [] : (sheet.ayushPrescription || []),
        ongoingMedicines: sheet.ongoingMedicines || [],
        advice: sheet.advice || '',
        followUpDays: sheet.followUpDays || null,
        lasaAlerts: (sheet.conflictAlerts || []).filter((a: any) => a.severity === 'CRITICAL_LASA' || a.severity === 'CRITICAL_CONTRAINDICATION'),
        conflictAlerts: sheet.conflictAlerts || [],
        safetyChecks: sheet.safetyChecks || [],
        scheduleE1PoisonVerification: {
          containsScheduleE1: (sheet.ayushPrescription || []).some((m: any) => /rasa|bhasma|sindura|vatsanabha|kupilu|gunja|bhanga/i.test(m.classicalName || m.formulationName || '')),
          doctorSigned: !!signature,
          digitalSignatureDigest: signature ? `Ed25519 · key ${signature.keyId} · record ${String(signature.recordSha256).slice(0, 16)}…` : 'Not signed',
          statutoryRule: 'Drugs & Cosmetics Rules 1945 — Schedule E(1) items need a registered practitioner\'s prescription'
        },
        signature,
        dispenseStatus: r.dispense_status || 'PENDING_VERIFICATION',
        dispensedBy: r.pharmacist_name || null,
        dispensedAt: r.dispensed_at || null,
        dispenseNote: r.dispense_note || null
      };
    });

    res.json({ success: true, data: queue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor/encounters/:encounterId/dispense */
doctorRouter.post('/encounters/:encounterId/dispense', requireStaff('pharmacist', 'admin'), (req: Request, res: Response): void => {
  try {
    const status = req.body?.status;
    if (!['DISPENSED', 'PARTIAL', 'NOT_DISPENSED', 'REFERRED_BACK'].includes(status)) {
      res.status(400).json({ error: 'status must be DISPENSED, PARTIAL, NOT_DISPENSED or REFERRED_BACK' });
      return;
    }
    const enc: any = db.prepare('SELECT id FROM encounters WHERE id = ?').get(String(req.params.encounterId));
    if (!enc) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO dispenses (id, encounter_id, status, pharmacist_id, pharmacist_name, items_json, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(encounter_id) DO UPDATE SET status = excluded.status, pharmacist_id = excluded.pharmacist_id,
        pharmacist_name = excluded.pharmacist_name, items_json = excluded.items_json, note = excluded.note, created_at = excluded.created_at
    `).run(uuidv4(), enc.id, status, req.staff!.id, req.staff!.displayName, JSON.stringify(req.body?.items || null), String(req.body?.note || '').slice(0, 500) || null, now);
    audit(req, 'pharmacy.dispense', enc.id, { status });
    res.json({ success: true, status, dispensedAt: now, dispensedBy: req.staff!.displayName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/doctor/telemetry */
doctorRouter.get('/telemetry', requireStaff('admin', ...CLINICIAN_ROLES), (_req: Request, res: Response): void => {
  try {
    res.json({ success: true, data: { ...getOperationalSnapshot(), syndromicSignals: getSyndromicSignals(), prescribingSafety: getPrescribingSafety(30) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor/ambient-stream: parse a transcript chunk into structured findings. */
doctorRouter.post('/ambient-stream', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const { transcriptChunk, patientId } = req.body;
    if (!transcriptChunk) {
      res.status(400).json({ error: 'transcriptChunk is required' });
      return;
    }
    const parsed = ClinicalParserService.parse(transcriptChunk, patientId);
    const namasteDiagnoses = parsed.provisionalDiagnoses.map(d => AyushEngineService.resolveDiagnosis(d)).filter(Boolean);
    res.json({ success: true, data: { ...parsed, namasteDiagnoses } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const cleanText = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * POST /api/doctor/prescribe
 * Finalize: safety checks with the patient's real context, FHIR bundle, Ed25519 signature,
 * provenance node, close the visit. The prescriber is always the signed-in doctor or vaidya.
 */
doctorRouter.post('/prescribe', requireStaff('doctor', 'vaidya'), async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = req.staff!;
    const {
      sessionId, symptoms, pariksha, vitals, diagnoses, allopathicPrescription, ayushPrescription, investigationsOrdered,
      doctorNotes, pathya, apathya, advice, followUpDays, adviceLocal, adviceLanguage, amend, acknowledgeAlerts
    } = req.body || {};

    const session: any = sessionId ? db.prepare('SELECT id, patient_id, status, department, history_json FROM sessions WHERE id = ?').get(sessionId) : null;
    if (!session) {
      res.status(404).json({ error: 'This visit was not found. Refresh the queue and try again.' });
      return;
    }
    const existing: any = db.prepare('SELECT id FROM encounters WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(sessionId);
    if (existing && !amend) {
      res.status(409).json({ error: 'A prescription was already finalized for this visit.', code: 'ALREADY_FINALIZED', encounterId: existing.id });
      return;
    }

    const careStream = staff.role === 'vaidya' ? 'AYURVEDA' : 'ALLOPATHY';
    const allo = asArray(allopathicPrescription);
    const ayush = asArray(ayushPrescription);
    const prescribed = careStream === 'AYURVEDA' ? ayush : allo;
    const ongoing = careStream === 'AYURVEDA' ? allo : ayush;
    if (prescribed.length === 0 && !cleanText(advice).trim()) {
      res.status(400).json({ error: 'Add at least one medicine or written advice before finalizing.' });
      return;
    }
    const followUp = Number(followUpDays);
    if (followUpDays !== undefined && followUpDays !== null && followUpDays !== '' && (!Number.isInteger(followUp) || followUp < 0 || followUp > 365)) {
      res.status(400).json({ error: 'Follow-up must be between 0 and 365 days.' });
      return;
    }

    const encounterId = uuidv4();
    const now = new Date().toISOString();

    // 1. Safety checks over everything the patient will be taking, with the patient's real context.
    const patientContext = buildPatientContext(session.patient_id);
    const safety = TruthEngineService.evaluatePrescriptionsDetailed(allo, ayush, patientContext);
    const conflictAlerts = safety.alerts;
    for (const w of AyushEngineService.checkViruddhaAhara(ayush)) {
      conflictAlerts.push({ alertId: `viruddha-${uuidv4().substring(0, 6)}`, severity: 'AYUSH_INCOMPATIBILITY', itemA: 'Prescribed Anupana', itemB: 'Incompatible Vehicle', mechanism: w, evidenceScore: 0.99, clinicalAction: 'Modify the vehicle per the classical pharmacopoeia directive.' });
    }
    const critical = conflictAlerts.filter(a => a.severity === 'CRITICAL_CONTRAINDICATION');
    // A critical contraindication must be acknowledged explicitly by the prescriber (recorded in the signed record).
    if (critical.length && acknowledgeAlerts !== true) {
      res.status(422).json({
        error: 'Critical contraindications were found. Review them and re-submit with acknowledgeAlerts: true to proceed on your clinical judgement.',
        code: 'CRITICAL_CONTRAINDICATION',
        conflictAlerts,
        safetyChecks: safety.checks,
        patientContextUsed: patientContext
      });
      return;
    }

    const deptCode = session.department as DepartmentCode | undefined;
    const department = staff.department && DEPARTMENT_ROOMS[staff.department as DepartmentCode]
      ? DEPARTMENT_ROOMS[staff.department as DepartmentCode].name
      : deptCode && DEPARTMENT_ROOMS[deptCode] ? DEPARTMENT_ROOMS[deptCode].name : (staff.department || 'OPD');

    // 2. The consultation record.
    const history = normaliseHistory(safeJsonParse(session.history_json, null));
    const consultationRecord: ConsultationRecord = {
      encounterId,
      sessionId,
      patientId: session.patient_id,
      doctorId: staff.id,
      doctorName: staff.displayName,
      department,
      symptoms: asArray(symptoms),
      pariksha: careStream === 'AYURVEDA' ? (pariksha || {}) : {} as any,
      vitals: vitals || {},
      diagnoses: asArray(diagnoses),
      allopathicPrescription: careStream === 'ALLOPATHY' ? allo : [],
      ayushPrescription: careStream === 'AYURVEDA' ? ayush : [],
      investigationsOrdered: asArray(investigationsOrdered).map(String),
      conflictAlerts,
      doctorNotes: cleanText(doctorNotes),
      createdAt: now
    };
    Object.assign(consultationRecord as any, {
      careStream,
      doctorQualification: staff.qualification || '',
      doctorRegistration: staff.registrationNo || '',
      ongoingMedicines: ongoing,
      pathya: careStream === 'AYURVEDA' ? asArray(pathya).map(String) : [],
      apathya: careStream === 'AYURVEDA' ? asArray(apathya).map(String) : [],
      advice: cleanText(advice),
      adviceLocal: cleanText(adviceLocal) || undefined,
      adviceLanguage: typeof adviceLanguage === 'string' ? adviceLanguage.slice(0, 5) : undefined,
      followUpDays: Number.isFinite(followUp) && followUp > 0 ? followUp : undefined,
      amendsEncounterId: existing ? existing.id : undefined,
      history,
      safetyChecks: safety.checks,
      patientContextUsed: patientContext ? { age: patientContext.age, gender: patientContext.gender, isPregnant: patientContext.isPregnant, gestationalWeeks: patientContext.gestationalWeeks, isLactating: patientContext.isLactating, eGfr: patientContext.eGfr, eGfrMethod: patientContext.eGfrMethod, sources: patientContext.sources, missing: patientContext.missing } : null,
      criticalAlertsAcknowledged: critical.length ? { count: critical.length, by: staff.id, at: now } : undefined
    });

    // 3. ABDM FHIR R4 bundle (patient and practitioner details come from the records, never invented).
    const patientRow: any = db.prepare('SELECT id, name, age, gender, abha_id, abha_address, is_pregnant, gestational_weeks, weight_kg FROM patients WHERE id = ?').get(session.patient_id);
    const scannedDocuments = (db.prepare('SELECT id, document_type, extracted_text, metadata_json, created_at FROM documents WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10').all(session.patient_id) as any[])
      .map(d => ({ id: d.id, documentType: d.document_type, extractedText: d.extracted_text, recordedDate: safeJsonParse<any>(d.metadata_json, {}).recordedDate, createdAt: d.created_at }));
    const fhirBundle = FhirGeneratorService.buildBundle({
      ...consultationRecord,
      scannedDocuments,
      patient: patientRow ? { id: patientRow.id, name: patientRow.name, age: patientRow.age, gender: patientRow.gender, abhaId: patientRow.abha_id, abhaAddress: patientRow.abha_address, isPregnant: !!patientRow.is_pregnant, gestationalWeeks: patientRow.gestational_weeks, weightKg: patientRow.weight_kg } : undefined,
      practitioner: { id: staff.id, name: staff.displayName, registrationNo: staff.registrationNo, qualification: staff.qualification, role: staff.role }
    });
    consultationRecord.fhirBundleId = fhirBundle.id;

    // 4. Signature over the complete canonical record, then the provenance node inside the same transaction.
    const signature = signRecord(consultationRecord, staff.id);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO encounters (id, session_id, patient_id, doctor_id, doctor_name, department, case_sheet_json, fhir_bundle_json, zkp_proof_json, created_at, signature_json, care_stream)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `).run(encounterId, sessionId, session.patient_id, staff.id, staff.displayName, department, JSON.stringify(consultationRecord), JSON.stringify(fhirBundle), now, JSON.stringify(signature), careStream);
      db.prepare(`UPDATE sessions SET status = 'COMPLETED', completed_at = ?, consult_started_at = COALESCE(consult_started_at, ?) WHERE id = ?`).run(now, now, sessionId);
      ZkProofService.recordEncounterMerkleNode(encounterId, session.patient_id, consultationRecord, signature);
    })();

    audit(req, existing ? 'prescription.amended' : 'prescription.finalized', encounterId, {
      sessionId, patientId: session.patient_id, items: prescribed.length, warnings: conflictAlerts.length, critical: critical.length, contextSources: patientContext?.sources || []
    });
    publish({ type: 'queue.changed', reason: 'completed', sessionId });

    // 5. Optional SMS (consent + configured gateway only).
    const sms = await SmsService.notifyPrescriptionReady(session.patient_id, sessionId).catch(() => ({ sent: false, reason: 'error' }));

    res.json({
      success: true,
      encounterId,
      consultationRecord,
      fhirBundle,
      signature,
      sms,
      safetyChecks: safety.checks,
      patientContextUsed: patientContext,
      hasCriticalContraindications: critical.length > 0,
      message: 'Prescription finalized and digitally signed.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
