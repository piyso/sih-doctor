/**
 * Physician / Vaidya consultation desk: queue (with claims and pharmacy referrals), the
 * pre-consultation brief, vitals, signing with per-alert reasons, and the pharmacy view.
 * Desk utilities (drafts, timeline, order sets, quality, ADR, notifiable events) are in
 * desk.routes.ts and mounted on the same router.
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
import { AbdmHipService } from '../services/abdmHip.service';
import { deniedSymptoms } from '../services/intakeExtraction.service';
import { claimOf, deleteDraft, detectNotifiable, createNotifiable, getDraft, recordingConsent, documentationAids, sinceLastVisit, patientTimeline, INVESTIGATIONS } from '../services/doctorDesk.service';
import { quantityToDispense } from '../services/safety/sig';
import { resolveAyushLine } from '../services/safety/resolver';
import { constituentsWithFlag } from '../services/safety/ayushDictionary';
import { drugById } from '../services/safety/drugDictionary';
import { resolveAllopathicLine } from '../services/safety/resolver';
import { ESignService } from '../services/externalSigning.service';
import { deskRouter } from './desk.routes';
import ayushOntology from '../shared/ayush_ontology.json';

try { db.exec('ALTER TABLE encounters ADD COLUMN signature_json TEXT;'); } catch {}
try { db.exec('ALTER TABLE encounters ADD COLUMN care_stream TEXT;'); } catch {}
try { db.exec('ALTER TABLE encounters ADD COLUMN prescription_bundle_json TEXT;'); } catch {}
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

/**
 * GET /api/doctor/queue: live OPD queue ordered by triage priority, plus prescriptions the
 * pharmacy referred back in the last 3 days (shown at the top for the prescriber to amend).
 */
doctorRouter.get('/queue', requireStaff(...CLINICIAN_ROLES, 'reception'), (_req: Request, res: Response): void => {
  try {
    const missing = db.prepare(`SELECT id FROM sessions WHERE status IN ('PENDING_DOCTOR', 'DIVERTED_EMERGENCY', 'IN_CONSULTATION') AND token_no IS NULL`).all() as Array<{ id: string }>;
    for (const m of missing) ensureSessionToken(m.id);

    const rows: any[] = db.prepare(`
      SELECT s.id as session_id, s.triage_priority, s.status, s.created_at, s.vitals_json, s.red_flag_triggers,
             s.care_stream, s.symptoms_json, s.department, s.token_no, s.called_at, s.call_count, s.history_json,
             s.claimed_by, s.claimed_by_name, s.claimed_at,
             p.id as patient_id, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id,
             p.is_pregnant, p.gestational_weeks, p.is_lactating, p.weight_kg,
             (SELECT COUNT(*) FROM sessions s2 WHERE s2.patient_id = p.id AND s2.status = 'COMPLETED' AND s2.created_at < s.created_at) AS prior_visits
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.status IN ('PENDING_DOCTOR', 'DIVERTED_EMERGENCY', 'IN_CONSULTATION')
      ORDER BY CASE s.triage_priority WHEN 'EMERGENCY_RED_FLAG' THEN 1 WHEN 'HIGH_PRIORITY' THEN 2 ELSE 3 END, s.created_at ASC
    `).all();

    const queue = rows.map(r => {
      const symptoms = safeJsonParse<any[]>(r.symptoms_json, []);
      const followUp = symptoms.some((s: any) => /follow.?up|refill|medicine (finished|over)|repeat/i.test(String(s?.name || s?.category || '')));
      return {
        sessionId: r.session_id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        age: r.age,
        gender: r.gender,
        language: r.language,
        prakriti: r.prakriti,
        abhaId: r.abha_id,
        isPregnant: r.is_pregnant === null || r.is_pregnant === undefined ? null : Boolean(r.is_pregnant), // null = not answered / not sure
        gestationalWeeks: r.gestational_weeks || undefined,
        isLactating: r.is_lactating === null || r.is_lactating === undefined ? null : Boolean(r.is_lactating),
        weightKg: r.weight_kg || undefined,
        triagePriority: r.triage_priority,
        status: r.status,
        redFlags: safeJsonParse(r.red_flag_triggers, []),
        vitals: safeJsonParse(r.vitals_json, {}),
        careStream: r.care_stream || 'UNDECIDED',
        primaryComplaint: (() => {
          const first: any = symptoms.find((s: any) => !s?.isNegated);
          return first ? (first.name || first.symptom_name || first.site || undefined) : undefined;
        })(),
        registeredAt: r.created_at,
        department: r.department || undefined,
        tokenNo: r.token_no || undefined,
        room: r.department && DEPARTMENT_ROOMS[r.department as DepartmentCode] ? DEPARTMENT_ROOMS[r.department as DepartmentCode].room : undefined,
        calledAt: r.called_at || undefined,
        callCount: r.call_count || 0,
        claimedBy: r.claimed_by ? { id: r.claimed_by, name: r.claimed_by_name, at: r.claimed_at } : undefined,
        visitType: followUp ? 'FOLLOW_UP' : r.prior_visits > 0 ? 'REVISIT' : 'NEW'
      };
    });

    // Pharmacy referrals back to the prescriber (latest encounter of the visit, last 3 days).
    const referred = (db.prepare(`
      SELECT e.id AS encounter_id, e.session_id, e.doctor_id, e.doctor_name, e.created_at, d.note, d.pharmacist_name, d.created_at AS referred_at,
             s.triage_priority, s.care_stream, s.department, s.token_no, p.id AS patient_id, p.name AS patient_name, p.age, p.gender, p.language
      FROM encounters e JOIN dispenses d ON d.encounter_id = e.id JOIN sessions s ON s.id = e.session_id JOIN patients p ON p.id = e.patient_id
      WHERE d.status = 'REFERRED_BACK' AND d.created_at > datetime('now', '-3 days') AND s.status != 'DEMO_PARKED'
        AND e.created_at = (SELECT MAX(e2.created_at) FROM encounters e2 WHERE e2.session_id = e.session_id)
      ORDER BY d.created_at DESC
    `).all() as any[]).map(r => ({
      sessionId: r.session_id, patientId: r.patient_id, patientName: r.patient_name, age: r.age, gender: r.gender, language: r.language,
      triagePriority: r.triage_priority, status: 'PHARMACY_REFERRED', careStream: r.care_stream || 'UNDECIDED', department: r.department || undefined,
      tokenNo: r.token_no || undefined, registeredAt: r.referred_at, redFlags: [], vitals: {}, visitType: 'PHARMACY_REFERRED',
      pharmacyReferral: { encounterId: r.encounter_id, note: r.note, pharmacist: r.pharmacist_name, at: r.referred_at, prescriber: r.doctor_name, prescriberId: r.doctor_id }
    }));

    res.json({ success: true, data: [...referred, ...queue] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/doctor/encounter/:sessionId
 * Pre-consultation brief: structured history and summary, documents, provisional codes,
 * patient safety context, vitals assessment, what changed since the last visit, the doctor's
 * saved draft, who has claimed the patient, and recording consent.
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

    const encounterRow: any = visitEncounter(sessionRow.id);
    const existingEncounter: any = encounterRow ? { ...safeJsonParse<any>(encounterRow.case_sheet_json, {}), encounterId: encounterRow.id, doctorId: encounterRow.doctor_id, doctorName: encounterRow.doctor_name } : null;
    const dispense: any = encounterRow ? db.prepare('SELECT status, note, pharmacist_name, created_at FROM dispenses WHERE encounter_id = ?').get(encounterRow.id) : null;

    const provisionalDiagnoses = symptoms.filter((s: any) => !s?.isNegated).map((s: any) => AyushEngineService.resolveDiagnosis(s)).filter(Boolean);
    const parikshaAdvisory = AyushEngineService.evaluatePariksha(pariksha);
    const patient = {
      id: sessionRow.patient_id,
      name: sessionRow.patient_name,
      age: sessionRow.age,
      gender: sessionRow.gender,
      language: sessionRow.language,
      prakriti: sessionRow.prakriti,
      isPregnant: sessionRow.is_pregnant === null || sessionRow.is_pregnant === undefined ? null : Boolean(sessionRow.is_pregnant), // null = not answered / not sure
      gestationalWeeks: sessionRow.gestational_weeks || undefined,
      isLactating: sessionRow.is_lactating === null || sessionRow.is_lactating === undefined ? null : Boolean(sessionRow.is_lactating),
      weightKg: sessionRow.weight_kg || undefined,
      abhaId: sessionRow.abha_id,
      abhaAddress: sessionRow.abha_address
    };
    const historySummary = buildHistorySummary({ patient: { ...patient, isPregnant: patient.isPregnant ?? undefined, isLactating: patient.isLactating ?? undefined }, symptoms, history, vitals, pariksha, documents, rawTranscript: sessionRow.raw_transcript });
    const patientContext = buildPatientContext(sessionRow.patient_id);
    const vitalsAssessment = assessVitals(vitals, { selfReported: vitals.source !== 'clinician', age: sessionRow.age, isPregnant: !!sessionRow.is_pregnant });
    const timeline = patientTimeline(sessionRow.patient_id, sessionRow.id);

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
        deniedSymptoms: deniedSymptoms(sessionRow.raw_transcript || ''),
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
        dispense: dispense ? { status: dispense.status, note: dispense.note, pharmacist: dispense.pharmacist_name, at: dispense.created_at } : null,
        tokenNo: sessionRow.token_no || undefined,
        department: sessionRow.department || undefined,
        status: sessionRow.status,
        claimedBy: claimOf(sessionRow.id),
        sinceLastVisit: sinceLastVisit(sessionRow.patient_id, sessionRow.id, { symptoms, vitals }),
        previousEncounters: timeline.encounters.slice(0, 5),
        savedDraft: getDraft(sessionRow.id, req.staff!.id),
        recordingConsent: recordingConsent(sessionRow.id),
        legalSignature: ESignService.status()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/doctor/encounter/:sessionId/vitals
 * Nurse / doctor measured vitals. NEWS2 is recomputed and can only raise the triage priority.
 * A measured weight also updates the patient record (used for children's dose checks).
 */
doctorRouter.patch('/encounter/:sessionId/vitals', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const incoming = req.body?.vitals;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'vitals object is required' });
      return;
    }
    const row: any = db.prepare(`
      SELECT s.vitals_json, s.triage_priority, s.patient_id, p.age, p.is_pregnant FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?
    `).get(String(req.params.sessionId));
    if (!row) {
      res.status(404).json({ error: 'Consultation session not found' });
      return;
    }
    const allowed = ['bp', 'pulse', 'spo2', 'temp', 'respiratoryRate', 'bloodSugar', 'bloodSugarType', 'weightKg', 'heightCm', 'consciousness', 'onOxygen'];
    const merged: Record<string, any> = { ...safeJsonParse(row.vitals_json, {}) };
    for (const key of allowed) {
      if (key in incoming) {
        const value = incoming[key];
        if (value === null || value === '' || value === undefined) delete merged[key];
        else merged[key] = value;
      }
    }
    const w = Number(merged.weightKg);
    if (merged.weightKg !== undefined && !(w > 0.3 && w < 350)) {
      res.status(400).json({ error: 'Weight must be between 0.3 and 350 kg.' });
      return;
    }
    merged.recordedAt = new Date().toISOString();
    merged.recordedBy = req.staff!.displayName;
    merged.source = 'clinician';
    const assessment = assessVitals(merged, { selfReported: false, age: row.age, isPregnant: !!row.is_pregnant });
    merged.news2 = assessment.applicable ? { score: assessment.news2, band: assessment.band, at: merged.recordedAt, missing: (assessment as any).missing || [] } : null;
    const newPriority = assessment.applicable ? raisePriority(row.triage_priority, assessment.suggestedPriority) : row.triage_priority;
    db.transaction(() => {
      db.prepare(`UPDATE sessions SET vitals_json = ?, triage_priority = ? WHERE id = ?`).run(JSON.stringify(merged), newPriority, String(req.params.sessionId));
      if ('weightKg' in incoming && w > 0) db.prepare('UPDATE patients SET weight_kg = ? WHERE id = ?').run(w, row.patient_id);
    })();
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

/** Schedule E(1) ingredients of a formulation, from its constituents (never from its name). */
function scheduleE1Of(name: string): string[] {
  const line = resolveAyushLine({ name }, 0, 'prescribed');
  if (!line.ayush || line.ayush.external || !line.ayush.flags.has('schedule_e1')) return [];
  return line.ayush.formulation ? constituentsWithFlag(line.ayush.formulation, 'schedule_e1') : ['(ingredient named in the product)'];
}

/** The part of the signed patient context a pharmacist needs at the counter (no conditions, no lab values). */
function pharmacyContext(used: any): { allergies?: Array<{ agent: string; reaction?: string }>; pregnancy: 'yes' | 'no' | 'unknown' | null; gestationalWeeks?: number; lactating: boolean; weightKg?: number } | null {
  if (!used || typeof used !== 'object') return null;
  const missing: string[] = Array.isArray(used.missing) ? used.missing.map(String) : [];
  const female = String(used.gender || '').toLowerCase() === 'female';
  return {
    allergies: Array.isArray(used.allergies) ? used.allergies.map((a: any) => ({ agent: String(a?.agent || a || '').slice(0, 80), reaction: a?.reaction ? String(a.reaction).slice(0, 80) : undefined })).filter((a: any) => a.agent) : undefined,
    pregnancy: !female ? null : used.isPregnant === true ? 'yes' : missing.some(m => /pregnan/i.test(m)) ? 'unknown' : 'no',
    gestationalWeeks: used.isPregnant === true && Number(used.gestationalWeeks) > 0 ? Number(used.gestationalWeeks) : undefined,
    lactating: used.isLactating === true,
    weightKg: Number(used.weightKg) > 0 ? Number(used.weightKg) : undefined
  };
}

/** GET /api/doctor/encounters & /api/doctor/pharmacy-queue */
doctorRouter.get(['/encounters', '/pharmacy-queue'], requireStaff('pharmacist', ...CLINICIAN_ROLES), (_req: Request, res: Response): void => {
  try {
    const rows: any[] = db.prepare(`
      SELECT e.*, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id,
             s.triage_priority, s.token_no, s.department AS dept_code,
             d.status AS dispense_status, d.pharmacist_name, d.created_at AS dispensed_at, d.note AS dispense_note, d.items_json AS dispense_items
      FROM encounters e
      JOIN patients p ON e.patient_id = p.id
      JOIN sessions s ON e.session_id = s.id
      LEFT JOIN dispenses d ON d.encounter_id = e.id
      WHERE e.created_at > datetime('now', '-3 days') AND s.status != 'DEMO_PARKED'
      ORDER BY (d.status IS NOT NULL), e.created_at DESC
    `).all();

    const queue = rows.map(r => {
      const sheet: any = safeJsonParse(r.case_sheet_json, {});
      const signature: any = safeJsonParse(r.signature_json, null);
      const stream = r.care_stream || sheet.careStream;
      const allo: any[] = stream === 'AYURVEDA' ? [] : (sheet.allopathicPrescription || []);
      const ayush: any[] = stream === 'ALLOPATHY' ? [] : (sheet.ayushPrescription || []);
      const e1 = ayush.map((m: any) => ({ name: m.classicalName || m.formulationName || '', ingredients: scheduleE1Of(m.classicalName || m.formulationName || '') })).filter(x => x.ingredients.length);
      const h1 = allo.flatMap((m: any) => resolveAllopathicLine(m, 0, 'prescribed').conceptIds.map(drugById).filter(c => c && (c.schedule === 'H1' || c.ndps)).map(c => ({ medicine: m.name || m.drugName, generic: c!.inn, schedule: c!.schedule || 'NDPS', ndps: !!c!.ndps })));
      return {
        id: r.id,
        prescriptionToken: r.token_no || `RX-${String(r.id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`,
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
        allopathicMeds: allo,
        ayushFormulations: ayush,
        ongoingMedicines: sheet.ongoingMedicines || [],
        diagnoses: (sheet.diagnoses || []).map((d: any) => typeof d === 'string' ? d : d.display || d.englishEquivalent || d.sanskritTerm).filter(Boolean),
        advice: sheet.advice || '',
        followUpDays: sheet.followUpDays || null,
        // Only true look-alike records (a name and what it is confused with); interaction alerts are in conflictAlerts.
        lasaAlerts: (sheet.conflictAlerts || []).filter((a: any) => a.severity === 'CRITICAL_LASA' && a.drugName && a.confusedWith),
        conflictAlerts: sheet.conflictAlerts || [],
        acknowledgedAlerts: sheet.criticalAlertsAcknowledged?.items || [],
        safetyChecks: sheet.safetyChecks || [],
        // What the safety checks knew about the patient when the doctor signed — the pharmacist's last check
        // (allergies: [] = asked and none, absent = never asked). Only what is needed to dispense.
        patientContext: pharmacyContext(sheet.patientContextUsed),
        notChecked: (sheet.safetyCoverage?.unresolved || []).map((u: any) => String(u?.name || '')).filter(Boolean).slice(0, 12),
        scheduleH1: h1,
        scheduleE1PoisonVerification: {
          containsScheduleE1: e1.length > 0,
          items: e1,
          doctorSigned: !!signature,
          digitalSignatureDigest: signature ? `Ed25519 seal · key ${signature.keyId} · record ${String(signature.recordSha256).slice(0, 16)}…` : 'Not sealed',
          statutoryRule: 'Drugs & Cosmetics Rules 1945 — Schedule E(1) items carry "Caution: to be taken under medical supervision" and are dispensed only against a registered practitioner\'s prescription'
        },
        signature,
        dispenseStatus: r.dispense_status || 'PENDING_VERIFICATION',
        dispensedBy: r.pharmacist_name || null,
        dispensedAt: r.dispensed_at || null,
        dispenseNote: r.dispense_note || null,
        // What was handed over, line by line (null when the pharmacist recorded only a status and a note).
        dispensedItems: cleanDispensedItems(safeJsonParse(r.dispense_items, null)),
        amendsEncounterId: sheet.amendsEncounterId || null
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
    if (status === 'REFERRED_BACK' && String(req.body?.note || '').trim().length < 5) {
      res.status(400).json({ error: 'Write why the prescription is referred back to the doctor.' });
      return;
    }
    const enc: any = db.prepare('SELECT id, session_id FROM encounters WHERE id = ?').get(String(req.params.encounterId));
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
    `).run(uuidv4(), enc.id, status, req.staff!.id, req.staff!.displayName, JSON.stringify(cleanDispensedItems(req.body?.items)), String(req.body?.note || '').slice(0, 500) || null, now);
    audit(req, 'pharmacy.dispense', enc.id, { status });
    if (status === 'REFERRED_BACK') publish({ type: 'queue.changed', reason: 'pharmacy_referred', sessionId: enc.session_id });
    res.json({ success: true, status, dispensedAt: now, dispensedBy: req.staff!.displayName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** The per-line hand-over record: name, whether it was given, quantity and batch — nothing else is stored. */
function cleanDispensedItems(raw: unknown): Array<{ name: string; given: boolean; quantity?: number; batch?: string }> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items = raw.slice(0, 40).map((x: any) => ({
    name: cleanText(x?.name, 160).trim(),
    given: x?.given === true,
    quantity: Number(x?.quantity) > 0 && Number(x?.quantity) < 100000 ? Number(x.quantity) : undefined,
    batch: cleanText(x?.batch, 40).trim() || undefined
  })).filter(x => x.name);
  return items.length ? items : null;
}

/** Schedule H1 / NDPS medicines on a signed sheet (resolved from the medicine, never from a free-text flag). */
function registerLines(sheet: any, stream: string | null): Array<{ medicine: string; generic: string; schedule: string; ndps: boolean; quantity?: number }> {
  const allo: any[] = (stream || sheet.careStream) === 'AYURVEDA' ? [] : (sheet.allopathicPrescription || []);
  return allo.flatMap((m: any) => resolveAllopathicLine(m, 0, 'prescribed').conceptIds.map(drugById).filter(c => c && (c.schedule === 'H1' || c.ndps))
    .map(c => ({ medicine: String(m.name || m.drugName || ''), generic: c!.inn, schedule: c!.schedule || 'NDPS', ndps: !!c!.ndps, quantity: Number(m.quantity) > 0 ? Number(m.quantity) : undefined })));
}

/**
 * GET /api/doctor/h1-register?from=YYYY-MM-DD&to=YYYY-MM-DD
 * The Schedule H1 register (Drugs & Cosmetics Rules, rule 65): for every supply of a Schedule H1 or NDPS
 * medicine — prescriber, patient, medicine and the quantity supplied. Built from the signed prescriptions
 * and the pharmacy's hand-over records, so it cannot drift from what was dispensed. Kept for three years.
 */
doctorRouter.get('/h1-register', requireStaff('pharmacist', 'admin'), (req: Request, res: Response): void => {
  try {
    const day = (v: unknown, fallback: string) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback);
    const today = new Date().toISOString().slice(0, 10);
    const from = day(req.query.from, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const to = day(req.query.to, today);
    const rows: any[] = db.prepare(`
      SELECT e.id, e.doctor_name, e.case_sheet_json, e.care_stream, p.name AS patient_name, p.age, p.gender, s.token_no,
             d.status, d.pharmacist_name, d.created_at AS supplied_at, d.items_json
      FROM dispenses d JOIN encounters e ON e.id = d.encounter_id JOIN patients p ON p.id = e.patient_id JOIN sessions s ON s.id = e.session_id
      WHERE d.status IN ('DISPENSED', 'PARTIAL') AND date(d.created_at) >= ? AND date(d.created_at) <= ? AND s.status != 'DEMO_PARKED'
      ORDER BY d.created_at ASC
    `).all(from, to);
    const entries = rows.flatMap(r => {
      const sheet: any = safeJsonParse(r.case_sheet_json, {});
      const given = cleanDispensedItems(safeJsonParse(r.items_json, null));
      return registerLines(sheet, r.care_stream).map(line => {
        const rec = given?.find(g => g.name.toLowerCase() === line.medicine.toLowerCase());
        // A partly-given prescription without a per-line record does not say which lines were supplied.
        const supplied: 'yes' | 'no' | 'not recorded' = rec ? (rec.given ? 'yes' : 'no') : r.status === 'DISPENSED' ? 'yes' : 'not recorded';
        return {
          suppliedAt: r.supplied_at, encounterId: r.id, token: r.token_no || null,
          prescriber: r.doctor_name, prescriberRegistration: sheet.doctorRegistration || '',
          patient: r.patient_name, age: r.age, gender: r.gender,
          medicine: line.medicine, generic: line.generic, schedule: line.ndps ? 'NDPS' : 'H1',
          quantity: rec?.quantity ?? line.quantity ?? null, batch: rec?.batch || null,
          supplied, pharmacist: r.pharmacist_name
        };
      }).filter(x => x.supplied !== 'no');
    });
    audit(req, 'pharmacy.h1_register_viewed', null, { from, to, entries: entries.length });
    res.json({ success: true, data: { from, to, entries } });
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
 * This visit's latest signed encounter. A demo visit that was re-opened keeps its earlier encounters as
 * history (nothing is deleted); only an encounter signed since the visit (re)started belongs to it.
 */
function visitEncounter<T = any>(sessionId: string, columns = '*'): T | undefined {
  return db.prepare(`SELECT ${columns} FROM encounters e WHERE e.session_id = ? AND e.created_at >= (SELECT created_at FROM sessions WHERE id = ?) ORDER BY e.created_at DESC LIMIT 1`).get(sessionId, sessionId) as T | undefined;
}

/** Ontology entries by aCode: a draft saved before a code correction must not carry the old code into the record. */
const ONTOLOGY_BY_ACODE = new Map<string, { icd10DualCode?: string; snomedConceptId?: string }>(ayushOntology.namasteEntries.map((e: any) => [e.aCode, e]));

/** Doctor-confirmed diagnoses: { display, system?, code?, icd10?, snomed?, status, source }. Strings are kept as text. */
function cleanDiagnoses(raw: unknown): any[] {
  return asArray(raw).slice(0, 10).map((d: any) => {
    const known = d && typeof d === 'object' ? ONTOLOGY_BY_ACODE.get(String(d.code || d.aCode || '')) : undefined;
    if (known) d = { ...d, icd10: known.icd10DualCode, icd10DualCode: known.icd10DualCode, snomed: known.snomedConceptId, snomedConceptId: known.snomedConceptId };
    if (typeof d === 'string') return d.trim() ? { display: d.trim().slice(0, 200), status: 'provisional', source: 'doctor' } : null;
    if (!d || typeof d !== 'object') return null;
    if (d.sanskritTerm || d.englishEquivalent) return d; // a resolved suggestion object (legacy clients)
    const display = cleanText(d.display, 200).trim();
    if (!display) return null;
    return {
      display,
      system: ['NAMASTE', 'ICD-11-MMS', 'ICD-11-TM2', 'ICD-10', 'FREE_TEXT'].includes(d.system) ? d.system : 'FREE_TEXT',
      code: d.code ? cleanText(String(d.code), 40) : undefined,
      codeVerified: d.codeVerified === true,
      icd10: d.icd10 ? cleanText(String(d.icd10), 12) : undefined,
      snomed: d.snomed ? cleanText(String(d.snomed), 20) : undefined,
      english: d.english ? cleanText(d.english, 200) : undefined,
      status: d.status === 'final' ? 'final' : 'provisional',
      source: d.source === 'accepted_suggestion' ? 'accepted_suggestion' : 'doctor'
    };
  }).filter(Boolean);
}

function cleanInvestigations(raw: unknown): any[] {
  return asArray(raw).slice(0, 30).map((i: any) => {
    if (typeof i === 'string') {
      const hit = INVESTIGATIONS.find(x => x.id === i || x.display.toLowerCase() === i.toLowerCase());
      return hit ? { id: hit.id, display: hit.display, loinc: hit.loinc } : (i.trim() ? { display: i.trim().slice(0, 120) } : null);
    }
    if (!i || typeof i !== 'object') return null;
    const hit = INVESTIGATIONS.find(x => x.id === i.id);
    const display = cleanText(i.display || hit?.display, 120).trim();
    return display ? { id: hit?.id || i.id, display, loinc: hit?.loinc, urgency: i.urgency === 'urgent' ? 'urgent' : 'routine', note: cleanText(i.note, 200) || undefined } : null;
  }).filter(Boolean);
}

/** Adds the quantity to dispense where it can be computed; keeps the indication. */
function withQuantity(list: any[]): any[] {
  return list.map(m => {
    if (!m || typeof m !== 'object') return m;
    const q = m.quantity ?? quantityToDispense(m.dosage || m.dose, m.frequency, Number(m.durationDays) || undefined);
    return { ...m, ...(q ? { quantity: q } : {}), ...(m.indication ? { indication: cleanText(m.indication, 200) } : {}) };
  });
}

/**
 * POST /api/doctor/prescribe
 * Finalize: safety checks with the patient's real context, typed reasons for every STOP group,
 * FHIR OPConsultRecord + PrescriptionRecord, Ed25519 seal, provenance node, notifiable-disease
 * prompts, close the visit. The prescriber is always the signed-in doctor or vaidya.
 */
doctorRouter.post('/prescribe', requireStaff('doctor', 'vaidya'), async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = req.staff!;
    const {
      sessionId, symptoms, pariksha, vitals, diagnoses, allopathicPrescription, ayushPrescription, investigationsOrdered,
      doctorNotes, pathya, apathya, advice, followUpDays, adviceLocal, adviceLanguage, amend, acknowledgeAlerts, alertAcknowledgements,
      acknowledgementReason, takeOver, clinicalExamination, consultationMinutes
    } = req.body || {};

    const session: any = sessionId ? db.prepare('SELECT id, patient_id, status, department, history_json, claimed_by, claimed_by_name FROM sessions WHERE id = ?').get(sessionId) : null;
    if (!session) {
      res.status(404).json({ error: 'This visit was not found. Refresh the queue and try again.' });
      return;
    }
    if (session.claimed_by && session.claimed_by !== staff.id && session.status !== 'COMPLETED' && takeOver !== true) {
      res.status(409).json({ error: `${session.claimed_by_name} is seeing this patient. Take over only if you have agreed with them.`, code: 'CLAIMED_BY_OTHER', claimedBy: { id: session.claimed_by, name: session.claimed_by_name } });
      return;
    }
    const existing: any = visitEncounter(sessionId, 'id, doctor_id, doctor_name');
    if (existing && !amend) {
      res.status(409).json({
        error: existing.doctor_id === staff.id ? 'You already signed a prescription for this visit.' : `${existing.doctor_name} already signed a prescription for this visit.`,
        code: 'ALREADY_FINALIZED', encounterId: existing.id, finalizedBy: existing.doctor_name, sameDoctor: existing.doctor_id === staff.id
      });
      return;
    }

    const careStream = staff.role === 'vaidya' ? 'AYURVEDA' : 'ALLOPATHY';
    const allo = withQuantity(asArray(allopathicPrescription));
    const ayush = withQuantity(asArray(ayushPrescription));
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
    const safety = TruthEngineService.evaluatePrescriptionsDetailed(allo, ayush, patientContext, {
      roles: careStream === 'AYURVEDA' ? { ayush: 'prescribed', allopathic: 'ongoing' } : { allopathic: 'prescribed', ayush: 'ongoing' },
      diet: careStream === 'AYURVEDA' ? asArray(pathya).map(String) : []
    });
    const conflictAlerts = safety.alerts;
    for (const w of AyushEngineService.checkViruddhaAhara(ayush)) {
      if (conflictAlerts.some(a => a.mechanism === w)) continue;
      conflictAlerts.push({ alertId: `viruddha-${uuidv4().substring(0, 6)}`, severity: 'AYUSH_INCOMPATIBILITY', tier: 'WARN', family: 'viruddha', itemA: 'Prescribed Anupana', itemB: 'Incompatible Vehicle', mechanism: w, evidenceScore: 0.99, clinicalAction: 'Modify the vehicle per the classical pharmacopoeia directive.' } as any);
    }

    // Every STOP group needs a typed reason (stored in the signed record). The legacy boolean
    // acknowledgeAlerts is accepted only with a reason that then applies to every group.
    const ackList: Array<{ groupKey: string; reason: string }> = asArray(alertAcknowledgements)
      .map((a: any) => ({ groupKey: String(a?.groupKey || ''), reason: cleanText(a?.reason, 500).trim() }))
      .filter(a => a.groupKey);
    const legacyReason = acknowledgeAlerts === true ? cleanText(acknowledgementReason, 500).trim() : '';
    const missing = safety.stopGroups.filter(g => {
      const r = ackList.find(a => a.groupKey === g.groupKey)?.reason || legacyReason;
      return !r || r.length < 5;
    });
    if (missing.length) {
      res.status(422).json({
        error: missing.length === 1
          ? `One serious safety alert needs your reason before signing: ${missing[0].summary}.`
          : `${missing.length} serious safety alerts need your reason before signing.`,
        code: 'CRITICAL_CONTRAINDICATION',
        stopGroups: safety.stopGroups,
        missingAcknowledgements: missing.map(g => g.groupKey),
        conflictAlerts,
        safetyChecks: safety.checks,
        coverage: safety.coverage,
        patientContextUsed: patientContext
      });
      return;
    }
    const acknowledged = safety.stopGroups.map(g => ({ groupKey: g.groupKey, alertIds: g.alertIds, summary: g.summary, reason: ackList.find(a => a.groupKey === g.groupKey)?.reason || legacyReason }));
    // WHO AWaRe stewardship: every prescribed antibiotic carries its indication (checked here too, not only on screen).
    if (careStream === 'ALLOPATHY') {
      const noIndication = safety.resolvedLines
        .filter(l => l.kind === 'allopathic' && l.role === 'prescribed' && (l.aware?.length || 0) > 0 && !String(allo[l.index]?.indication || '').trim())
        .map(l => ({ index: l.index, name: allo[l.index]?.name || l.raw }));
      if (noIndication.length) {
        res.status(422).json({ error: `Record the indication for ${noIndication.map(n => n.name).join(', ')} (antibiotic stewardship).`, code: 'INDICATION_REQUIRED', lines: noIndication });
        return;
      }
    }

    const deptCode = session.department as DepartmentCode | undefined;
    const department = staff.department && DEPARTMENT_ROOMS[staff.department as DepartmentCode]
      ? DEPARTMENT_ROOMS[staff.department as DepartmentCode].name
      : deptCode && DEPARTMENT_ROOMS[deptCode] ? DEPARTMENT_ROOMS[deptCode].name : (staff.department || 'OPD');

    // 2. The consultation record.
    const history = normaliseHistory(safeJsonParse(session.history_json, null));
    const cleanDx = cleanDiagnoses(diagnoses);
    const cleanInv = cleanInvestigations(investigationsOrdered);
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
      diagnoses: cleanDx,
      allopathicPrescription: careStream === 'ALLOPATHY' ? allo : [],
      ayushPrescription: careStream === 'AYURVEDA' ? ayush : [],
      investigationsOrdered: cleanInv as any,
      conflictAlerts,
      doctorNotes: cleanText(doctorNotes, 6000),
      createdAt: now
    };
    Object.assign(consultationRecord as any, {
      careStream,
      doctorQualification: staff.qualification || '',
      doctorRegistration: staff.registrationNo || '',
      doctorHprId: (staff as any).hprId || undefined,
      ongoingMedicines: ongoing,
      pathya: careStream === 'AYURVEDA' ? asArray(pathya).map(String) : [],
      apathya: careStream === 'AYURVEDA' ? asArray(apathya).map(String) : [],
      advice: cleanText(advice),
      adviceLocal: cleanText(adviceLocal) || undefined,
      adviceLanguage: typeof adviceLanguage === 'string' ? adviceLanguage.slice(0, 5) : undefined,
      followUpDays: Number.isFinite(followUp) && followUp > 0 ? followUp : undefined,
      clinicalExamination: clinicalExamination && typeof clinicalExamination === 'object' ? clinicalExamination : undefined,
      consultationMinutes: Number(consultationMinutes) > 0 && Number(consultationMinutes) < 240 ? Number(consultationMinutes) : undefined,
      amendsEncounterId: existing ? existing.id : undefined,
      history,
      safetyChecks: safety.checks,
      safetyCoverage: safety.coverage,
      patientContextUsed: patientContext ? { age: patientContext.age, gender: patientContext.gender, isPregnant: patientContext.isPregnant, gestationalWeeks: patientContext.gestationalWeeks, isLactating: patientContext.isLactating, eGfr: patientContext.eGfr, eGfrMethod: patientContext.eGfrMethod, weightKg: patientContext.weightKg, allergies: patientContext.allergies, conditions: patientContext.conditions, sources: patientContext.sources, missing: patientContext.missing } : null,
      criticalAlertsAcknowledged: acknowledged.length ? { count: acknowledged.length, by: staff.id, byName: staff.displayName, at: now, items: acknowledged } : undefined,
      // How the notes were prepared (from the scribe usage log: mode and seconds, never audio or text).
      documentationAids: documentationAids(sessionId)
    });

    // 3. ABDM FHIR R4: OPConsultRecord and PrescriptionRecord (identifiers from the records, never invented).
    const patientRow: any = db.prepare('SELECT id, name, age, gender, abha_id, abha_address, is_pregnant, gestational_weeks, weight_kg FROM patients WHERE id = ?').get(session.patient_id);
    const scannedDocuments = (db.prepare('SELECT id, document_type, extracted_text, metadata_json, created_at FROM documents WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10').all(session.patient_id) as any[])
      .map(d => ({ id: d.id, documentType: d.document_type, extractedText: d.extracted_text, recordedDate: safeJsonParse<any>(d.metadata_json, {}).recordedDate, createdAt: d.created_at }));
    const fhirBundle = FhirGeneratorService.buildBundle({
      ...consultationRecord,
      scannedDocuments,
      patient: patientRow ? { id: patientRow.id, name: patientRow.name, age: patientRow.age, gender: patientRow.gender, abhaId: patientRow.abha_id, abhaAddress: patientRow.abha_address, isPregnant: !!patientRow.is_pregnant, gestationalWeeks: patientRow.gestational_weeks, weightKg: patientRow.weight_kg } : undefined,
      practitioner: { id: staff.id, name: staff.displayName, registrationNo: staff.registrationNo, qualification: staff.qualification, role: staff.role, hprId: (staff as any).hprId || null }
    } as any);
    const prescriptionBundle = FhirGeneratorService.buildPrescriptionRecord(fhirBundle);
    consultationRecord.fhirBundleId = fhirBundle.id;

    // 4. Seal over the complete canonical record, then the provenance node inside the same transaction.
    const signature: any = signRecord(consultationRecord, staff.id);
    const legal = ESignService.status();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO encounters (id, session_id, patient_id, doctor_id, doctor_name, department, case_sheet_json, fhir_bundle_json, zkp_proof_json, created_at, signature_json, care_stream, prescription_bundle_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `).run(encounterId, sessionId, session.patient_id, staff.id, staff.displayName, department, JSON.stringify(consultationRecord), JSON.stringify(fhirBundle), now, JSON.stringify(signature), careStream, JSON.stringify(prescriptionBundle));
      db.prepare(`UPDATE sessions SET status = 'COMPLETED', completed_at = ?, consult_started_at = COALESCE(consult_started_at, ?) WHERE id = ?`).run(now, now, sessionId);
      ZkProofService.recordEncounterMerkleNode(encounterId, session.patient_id, consultationRecord, signature);
    })();
    deleteDraft(sessionId);

    // ABDM: an ABHA-linked patient's visit becomes a care context (linked only with their abha_link consent).
    const careContext = AbdmHipService.registerCareContext({ patientId: session.patient_id, sessionId, encounterId, at: now });

    // Notifiable diseases (TB → Nikshay): create a pending notification for the desk to complete.
    const notifiable = detectNotifiable({ diagnoses: cleanDx, medicines: prescribed }).map(n => ({ ...n, id: createNotifiable(n.type, session.patient_id, sessionId, encounterId, { reason: n.reason, diagnoses: cleanDx.map((d: any) => d.display || d), medicines: prescribed.map((m: any) => m.name || m.classicalName), prescriber: staff.displayName }) }));

    audit(req, existing ? 'prescription.amended' : 'prescription.finalized', encounterId, {
      sessionId, patientId: session.patient_id, items: prescribed.length, warnings: conflictAlerts.length, stopGroupsAcknowledged: acknowledged.length, contextSources: patientContext?.sources || []
    });
    publish({ type: 'queue.changed', reason: 'completed', sessionId });

    // 5. Optional SMS (consent + configured gateway only).
    const sms = await SmsService.notifyPrescriptionReady(session.patient_id, sessionId).catch(() => ({ sent: false, reason: 'error' }));

    res.json({
      success: true,
      encounterId,
      consultationRecord,
      fhirBundle,
      prescriptionBundle,
      signature: { ...signature, legal },
      sms,
      safetyChecks: safety.checks,
      safetyCoverage: safety.coverage,
      patientContextUsed: patientContext,
      abdmCareContext: careContext,
      notifiable,
      hasCriticalContraindications: safety.stopGroups.length > 0,
      message: 'Prescription finalized and sealed.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/doctor/encounter/:id/fhir-preview — the ABDM record as it would be built from the doctor's
 * current draft (Composition status "preliminary"; nothing is stored). A signed visit returns its signed bundle.
 */
doctorRouter.post('/encounter/:id/fhir-preview', requireStaff('doctor', 'vaidya'), (req: Request, res: Response): void => {
  try {
    const staff = req.staff!;
    const sessionId = String(req.params.id);
    const session: any = db.prepare('SELECT id, patient_id, department, created_at FROM sessions WHERE id = ?').get(sessionId);
    if (!session) { res.status(404).json({ error: 'This visit was not found.' }); return; }
    const signed: any = visitEncounter(sessionId, 'fhir_bundle_json');
    if (signed?.fhir_bundle_json) { res.json({ success: true, bundle: safeJsonParse(signed.fhir_bundle_json, null), finalized: true }); return; }

    const { symptoms, pariksha, vitals, diagnoses, allopathicPrescription, ayushPrescription, investigationsOrdered, pathya, apathya, advice, followUpDays } = req.body || {};
    const careStream = staff.role === 'vaidya' ? 'AYURVEDA' : 'ALLOPATHY';
    const allo = withQuantity(asArray(allopathicPrescription));
    const ayush = withQuantity(asArray(ayushPrescription));
    const followUp = Number(followUpDays);
    const patientRow: any = db.prepare('SELECT id, name, age, gender, abha_id, abha_address, is_pregnant, gestational_weeks, weight_kg FROM patients WHERE id = ?').get(session.patient_id);
    const record: any = {
      encounterId: `draft-${sessionId}`, sessionId, patientId: session.patient_id, doctorId: staff.id, doctorName: staff.displayName, department: session.department,
      symptoms: asArray(symptoms), pariksha: careStream === 'AYURVEDA' ? (pariksha || {}) : {}, vitals: vitals || {},
      diagnoses: cleanDiagnoses(diagnoses),
      allopathicPrescription: careStream === 'ALLOPATHY' ? allo : [], ayushPrescription: careStream === 'AYURVEDA' ? ayush : [],
      ongoingMedicines: careStream === 'AYURVEDA' ? allo : ayush,
      investigationsOrdered: cleanInvestigations(investigationsOrdered), conflictAlerts: [], doctorNotes: '', createdAt: new Date().toISOString(),
      careStream, doctorQualification: staff.qualification || '', doctorRegistration: staff.registrationNo || '', doctorHprId: (staff as any).hprId || undefined,
      pathya: careStream === 'AYURVEDA' ? asArray(pathya).map(String) : [], apathya: careStream === 'AYURVEDA' ? asArray(apathya).map(String) : [],
      advice: cleanText(advice), followUpDays: Number.isFinite(followUp) && followUp > 0 ? followUp : undefined,
      patient: patientRow ? { id: patientRow.id, name: patientRow.name, age: patientRow.age, gender: patientRow.gender, abhaId: patientRow.abha_id, abhaAddress: patientRow.abha_address, isPregnant: !!patientRow.is_pregnant, gestationalWeeks: patientRow.gestational_weeks, weightKg: patientRow.weight_kg } : undefined,
      practitioner: { id: staff.id, name: staff.displayName, registrationNo: staff.registrationNo, qualification: staff.qualification, role: staff.role, hprId: (staff as any).hprId || null }
    };
    const bundle: any = FhirGeneratorService.buildBundle(record);
    for (const e of bundle.entry || []) {
      if (e.resource?.resourceType === 'Composition') e.resource.status = 'preliminary';
      if (e.resource?.resourceType === 'Encounter') { e.resource.status = 'in-progress'; if (e.resource.period) delete e.resource.period.end; }
      if (e.resource?.resourceType === 'MedicationRequest' && e.resource.intent === 'order') e.resource.status = 'draft';
    }
    res.json({ success: true, bundle, finalized: false, preview: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doctorRouter.use(deskRouter);
