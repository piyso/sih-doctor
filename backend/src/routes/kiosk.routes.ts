/**
 * Patient-Facing MediKiosk Routes (Stage 1 Intake & Triage)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { ClinicalParserService } from '../services/clinicalParser.service';
import { SovereignNERService } from '../services/sovereignNER.service';
import { AyushEngineService } from '../services/ayushEngine.service';
import { analyseTranscript, fahrenheit } from '../services/intakeExtraction.service';
import ayushOntology from '../shared/ayush_ontology.json';
import { cleanConsent, recordConsent } from '../security/privacy.service';
import { blindIndex, encryptField, decryptField, normalisePhone } from '../security/fieldCrypto';
import { audit } from '../security/audit';
import { requireStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { routeCheckIn, issueToken, queuePosition } from '../services/hospitalRouting.service';
import { analyseComplaint } from '../services/clinicalLexicon';
import { AlertsService } from '../services/alerts.service';
import { publish } from '../services/eventBus.service';
import { SmsService } from '../services/sms.service';
import { normaliseHistory } from '../services/clinicalHistory.service';
import { assessVitals, raisePriority } from '../services/triage.service';
import { loadInterview, historyFrom } from '../services/interview.service';

export const kioskRouter = Router();

/**
 * POST /api/kiosk/parse-audio
 * Parse a kiosk transcript into symptoms, vitals, history and red flags (services/intakeExtraction.service.ts).
 */
kioskRouter.post('/parse-audio', (req: Request, res: Response): void => {
  try {
    const { transcript, patientId, abhaId } = req.body;
    if (!transcript) {
      res.status(400).json({ error: 'transcript is required' });
      return;
    }
    // re-check decodes of the same recording from the speech service (optional, at most 4)
    const alternatives: string[] = Array.isArray(req.body.alternatives)
      ? req.body.alternatives.filter((a: unknown) => typeof a === 'string').slice(0, 4).map((a: string) => a.slice(0, 5000))
      : [];

    res.json({ success: true, data: analyseTranscript(String(transcript).slice(0, 5000), patientId, abhaId, alternatives) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/intake
 * Save the completed kiosk check-in, assign a department and token, and raise an SOS if needed.
 */
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const normName = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

kioskRouter.post('/intake', (req: Request, res: Response): void => {
  try {
    const { patient, symptoms, pariksha, vitals, rawTranscript, scannedDocs, careStream, history, language, triageOverride, sosTriggered, routingHints, interviewId } = req.body || {};
    // The adaptive interview's answers live on the server (encrypted); red flags and history are re-derived here, not trusted from the kiosk.
    const interview = typeof interviewId === 'string' ? loadInterview(interviewId) : null;
    const interviewResult = interview ? historyFrom(interview) : null;
    const isSos = triageOverride === 'EMERGENCY_RED_FLAG' || !!sosTriggered;

    // DPDP Act: process health data only with consent. A medical emergency is a permitted
    // exception (s.7), so an SOS check-in proceeds and is recorded as such.
    let consent = cleanConsent(req.body?.consent);
    if (!isSos && (!consent || !consent.purposes.care)) {
      res.status(400).json({ error: 'Consent to use your information for treatment is needed to continue.', code: 'CONSENT_REQUIRED' });
      return;
    }
    if (isSos && (!consent || !consent.purposes.care)) {
      consent = { purposes: { care: true, abha_link: false, sms: false, research: false }, method: 'emergency', language };
    }

    // ---- Validate input ----
    const cleanCareStream = ['AYURVEDA', 'ALLOPATHY', 'UNDECIDED'].includes(careStream) ? careStream : 'UNDECIDED';
    const extraRedFlags: string[] = Array.isArray(req.body.redFlags) ? req.body.redFlags.filter((f: unknown) => typeof f === 'string').slice(0, 20) : [];
    const rawName = typeof patient?.name === 'string' ? patient.name.trim().slice(0, 80) : '';
    const cleanName = rawName || (isSos ? 'Emergency patient (name not given)' : 'Self-registered patient');
    const age = Number(patient?.age);
    if (patient?.age !== undefined && patient?.age !== '' && (!Number.isFinite(age) || age < 0 || age > 120)) {
      res.status(400).json({ error: 'Age must be between 0 and 120.' });
      return;
    }
    const gender = GENDERS.includes(patient?.gender) ? patient.gender : 'OTHER';
    const cleanAbha = typeof patient?.abhaId === 'string' && patient.abhaId.trim() ? patient.abhaId.trim().slice(0, 40) : null;
    const cleanSymptoms = (Array.isArray(symptoms) && symptoms.length ? symptoms : (interviewResult?.symptoms || [])).slice(0, 30);
    const transcript = typeof rawTranscript === 'string' ? rawTranscript.slice(0, 5000) : '';
    const lang = typeof language === 'string' ? language.slice(0, 8) : (patient?.language || 'hi');

    const phone = normalisePhone(patient?.phone);
    const phoneHash = phone ? blindIndex(phone) : null;
    // Keep the full number (encrypted) only if the patient wants SMS updates.
    const phoneEnc = phone && consent?.purposes.sms ? encryptField(phone) : null;
    const maskedPhone = phone ? SovereignNERService.maskPhone(phone) : null;
    const maskedAadhaar = patient?.aadhaar ? SovereignNERService.maskAadhaar(String(patient.aadhaar)) : null;

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // ---- Find the patient: ABHA is exact; a phone number alone is NOT enough because families
    // share phones, so the name and age must match too.
    let patientId: string | null = null;
    if (cleanAbha) {
      const byAbha: any = db.prepare(`SELECT id FROM patients WHERE abha_id = ?`).get(cleanAbha);
      if (byAbha) patientId = byAbha.id;
    }
    if (!patientId && phoneHash && rawName) {
      const candidates = db.prepare(`SELECT id, name, age FROM patients WHERE phone_hash = ? AND erased_at IS NULL`).all(phoneHash) as any[];
      const match = candidates.find(c => normName(c.name) === normName(rawName) && (!Number.isFinite(age) || Math.abs((c.age || 0) - age) <= 2));
      if (match) patientId = match.id;
    }
    const isNewPatient = !patientId;
    if (!patientId) patientId = uuidv4();

    // ---- Triage ----
    const parserResult = ClinicalParserService.parse(transcript || JSON.stringify(cleanSymptoms));
    let priority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE' = 'ROUTINE';
    let redFlags: string[] = [];

    const sbp = vitals?.bp ? parseInt(String(vitals.bp).split('/')[0], 10) : NaN;
    const spo2 = vitals?.spo2 ? parseInt(String(vitals.spo2), 10) : NaN;
    const pulse = vitals?.pulse ? Number(vitals.pulse) : NaN;
    const tempF = fahrenheit(vitals?.temp) ?? NaN;
    const severeEmergencySymptom = cleanSymptoms.some((s: any) => s?.isEmergency && Number(s?.severityScore) >= 8);
    // Re-run the emergency rules here so a kiosk that was offline or modified cannot skip them.
    const lexicon = analyseComplaint([transcript, ...cleanSymptoms.map((s: any) => `${s?.name || ''} ${s?.labelLocal || ''}`)].join(' . '));
    const lexiconFlags = lexicon.redFlags.map(f => f.label);
    const criticalVitals = (sbp >= 180 || sbp < 90) || spo2 < 92 || pulse > 130 || pulse < 40;

    if (isSos) {
      priority = 'EMERGENCY_RED_FLAG';
      redFlags = [...extraRedFlags, ...(parserResult.redFlagTriggers || [])];
      if (!redFlags.length) redFlags = ['Patient pressed the SOS button at the kiosk'];
    } else if (parserResult.isEmergencyRedFlag || severeEmergencySymptom || lexicon.sos) {
      priority = 'EMERGENCY_RED_FLAG';
      redFlags = [...(parserResult.redFlagTriggers || []), ...lexiconFlags, ...(severeEmergencySymptom ? ['Severe pain with an emergency warning symptom reported at kiosk'] : [])];
    } else if (criticalVitals || tempF > 101 || sbp > 150 || lexiconFlags.length) {
      priority = 'HIGH_PRIORITY';
      redFlags = [...lexiconFlags];
    }
    // NEWS2 on the self-reported vitals (RCP 2017): can only raise the priority, and a nurse verifies before acting.
    const vitalsAssessment = assessVitals(vitals, { selfReported: true, age: Number.isFinite(age) ? age : null, isPregnant: !!patient?.isPregnant });
    if (vitalsAssessment.applicable && vitalsAssessment.suggestedPriority !== 'ROUTINE') {
      priority = raisePriority(priority, vitalsAssessment.suggestedPriority);
      redFlags.push(`NEWS2 ${vitalsAssessment.news2} (${vitalsAssessment.band.toLowerCase().replace('_', '-')}) on patient-reported vitals: nurse to verify`);
    }
    // Interview red-flag probes (chest pain radiation, thunderclap headache, obstetric danger signs, ...).
    if (interviewResult?.redFlags.length) {
      priority = raisePriority(priority, interviewResult.suggestedPriority);
      redFlags.push(...interviewResult.redFlags.map(f => f.label));
    }
    // Age- and pregnancy-aware rules that keyword triage alone misses.
    const complaintAll = [transcript, ...cleanSymptoms.map((s: any) => `${s?.name || ''} ${s?.labelLocal || ''}`), typeof patient?.chiefComplaint === 'string' ? patient.chiefComplaint : ''].join(' . ').toLowerCase();
    if (Number.isFinite(age) && age < 2 && patient?.age !== undefined && patient?.age !== '' && /fever|bukhar|बुखार|breath|saans|सांस|साँस|vomit|ulti|उल्टी|dast|दस्त|diarrh|not feeding|doodh nahi|दूध नहीं|lethargic|sust|सुस्त/.test(complaintAll)) {
      priority = raisePriority(priority, 'HIGH_PRIORITY');
      redFlags.push('Infant under 2 years with fever, breathing, feeding or fluid-loss complaint: same-day paediatric review (IMNCI)');
    }
    if (patient?.isPregnant) {
      if (/bleed|khoon|खून|रक्त|rakt|fits|convuls|jhatke|झटके|daura|दौरा|blurred|dhundhla|धुंधला|severe headache|tez sir dard|तेज़ सिर दर्द|तेज सिर दर्द/.test(complaintAll)) {
        priority = 'EMERGENCY_RED_FLAG';
        redFlags.push('Pregnancy danger sign reported (bleeding, fits, or severe headache / visual disturbance): obstetric emergency pathway');
      } else if (/movement less|halchal kam|हलचल कम|hil nahi|leaking|pani nikal|पानी निकल|swelling|sujan|सूजन|labour|dard uth|प्रसव/.test(complaintAll)) {
        priority = raisePriority(priority, 'HIGH_PRIORITY');
        redFlags.push('Pregnancy warning sign reported (reduced fetal movement, leaking fluid, swelling or labour pains): priority obstetric review');
      }
    }
    redFlags = Array.from(new Set(redFlags));
    let structuredHistory = history ? normaliseHistory(history) : null;
    if (interviewResult) {
      // Interview answers are the richer source; keep anything the kiosk forms added on top.
      const kiosk = structuredHistory;
      structuredHistory = normaliseHistory({
        ...interviewResult.history,
        conditions: Array.from(new Set([...(interviewResult.history.conditions || []), ...(kiosk?.conditions || [])])),
        allergies: interviewResult.history.allergies || kiosk?.allergies || '',
        currentMedicines: interviewResult.history.currentMedicines || kiosk?.currentMedicines || '',
        completeness: interviewResult.history.completeness,
        ayush: interviewResult.history.ayush || kiosk?.ayush
      });
    }

    // ---- Department and token ----
    const complaintText = [...cleanSymptoms.map((s: any) => `${s?.site || ''} ${s?.name || ''}`), transcript].join(' ');
    const department = routeCheckIn({
      careStream: cleanCareStream,
      age: Number.isFinite(age) ? age : undefined,
      gender,
      isPregnant: !!patient?.isPregnant,
      isEmergency: priority === 'EMERGENCY_RED_FLAG',
      isAirborne: !!routingHints?.isAirborne,
      isMlc: !!routingHints?.isMlc,
      complaintText
    });
    const { tokenNo, tokenDate } = issueToken(department);
    const status = priority === 'EMERGENCY_RED_FLAG' ? 'DIVERTED_EMERGENCY' : 'PENDING_DOCTOR';

    db.transaction(() => {
      if (isNewPatient) {
        db.prepare(`
          INSERT INTO patients (id, abha_id, abha_address, name, age, gender, phone_masked, phone_hash, phone_enc, aadhaar_masked, language, prakriti, is_pregnant, gestational_weeks, is_lactating, weight_kg, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          patientId, cleanAbha, patient?.abhaAddress || null, cleanName, Number.isFinite(age) ? age : 0, gender,
          maskedPhone, phoneHash, phoneEnc, maskedAadhaar, lang, pariksha?.prakriti || null,
          patient?.isPregnant ? 1 : 0, patient?.gestationalWeeks || null, patient?.isLactating ? 1 : 0, patient?.weightKg || null, now
        );
      } else {
        db.prepare(`
          UPDATE patients SET
            name = CASE WHEN ? != '' THEN ? ELSE name END,
            age = CASE WHEN ? > 0 THEN ? ELSE age END,
            gender = ?, language = ?,
            phone_masked = COALESCE(?, phone_masked), phone_hash = COALESCE(?, phone_hash),
            phone_enc = CASE WHEN ? IS NOT NULL THEN ? ELSE phone_enc END,
            aadhaar_masked = COALESCE(?, aadhaar_masked),
            prakriti = COALESCE(?, prakriti), is_pregnant = ?, gestational_weeks = ?, is_lactating = ?, weight_kg = COALESCE(?, weight_kg)
          WHERE id = ?
        `).run(
          rawName, rawName, Number.isFinite(age) ? age : 0, Number.isFinite(age) ? age : 0, gender, lang,
          maskedPhone, phoneHash, phoneEnc, phoneEnc, maskedAadhaar,
          pariksha?.prakriti || null, patient?.isPregnant ? 1 : 0, patient?.gestationalWeeks || null, patient?.isLactating ? 1 : 0, patient?.weightKg || null,
          patientId
        );
      }

      db.prepare(`
        INSERT INTO sessions (id, patient_id, symptoms_json, pariksha_json, vitals_json, triage_priority, red_flag_triggers, raw_transcript, status, created_at, care_stream, history_json, language, department, token_no, token_date, kiosk_device_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId, patientId,
        // only complaints the patient affirmed; denied ones ("बुखार नहीं है") are shown to the doctor separately
        JSON.stringify(cleanSymptoms.length ? cleanSymptoms : (parserResult.symptoms || []).filter(s => !s.isNegated)),
        JSON.stringify(pariksha || {}),
        JSON.stringify(vitals ? { ...vitals, source: 'patient_self_report', news2: vitalsAssessment.applicable ? { score: vitalsAssessment.news2, band: vitalsAssessment.band } : null } : {}),
        priority, JSON.stringify(redFlags), transcript, status, now, cleanCareStream,
        structuredHistory ? JSON.stringify(structuredHistory) : null, lang, department, tokenNo, tokenDate, req.kioskDevice?.id || null
      );

      recordConsent(patientId!, sessionId, consent!, req.kioskDevice ? `kiosk:${req.kioskDevice.id}` : req.staff?.id || 'kiosk');

      if (Array.isArray(scannedDocs) && scannedDocs.length > 0) {
        const insertDoc = db.prepare(`
          INSERT OR REPLACE INTO documents (id, patient_id, document_type, extracted_text, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const d of scannedDocs.slice(0, 10)) {
          insertDoc.run(
            d.documentId || uuidv4(),
            patientId,
            d.docType || 'OLD_PRESCRIPTION',
            String(d.rawText || '').slice(0, 20000),
            JSON.stringify({
              medications: d.extractedMeds || [],
              labMarkers: d.extractedLabs || [],
              diagnoses: d.extractedDiagnoses || [],
              confidence: d.confidenceScore ?? null,
              recordedDate: now,
              plausibilityWarnings: d.plausibilityWarnings || [],
              fuzzyCorrections: d.fuzzyCorrections || [],
              vernacularPosology: d.vernacularPosologyDetected || [],
              humanReviewRequired: d.humanReviewRequired || false,
              patientConfirmed: d.patientConfirmed ?? null,
              engineUsed: d.engineUsed || 'KIOSK_DOCUMENT_SCANNER'
            }),
            now
          );
        }
      }
    })();

    audit(req, 'kiosk.check_in', sessionId, { patientId, department, priority, sos: isSos, newPatient: isNewPatient });

    let alertId: string | null = null;
    if (isSos) {
      alertId = AlertsService.raiseSos({
        sessionId,
        tokenNo,
        location: req.kioskDevice ? `${req.kioskDevice.name}${req.kioskDevice.location ? ` · ${req.kioskDevice.location}` : ''}` : 'Kiosk',
        message: `SOS at kiosk${rawName ? ` — ${rawName}` : ''}${redFlags.length ? `: ${redFlags[0]}` : ''}`,
        raisedBy: req.kioskDevice ? `kiosk:${req.kioskDevice.id}` : req.staff?.id || 'kiosk'
      }).id;
    }
    publish({ type: 'queue.changed', reason: 'check_in', sessionId });

    const position = queuePosition(sessionId);
    if (consent?.purposes.sms && phoneEnc && position) {
      SmsService.notifyTokenIssued(patientId!, tokenNo, position.room).catch(() => {});
    }

    res.json({
      success: true,
      sessionId,
      patientId,
      triagePriority: priority,
      redFlags,
      vitalsAssessment,
      historyCompleteness: structuredHistory?.completeness || null,
      status,
      tokenNo,
      department,
      room: position?.room,
      floor: position?.floor,
      ahead: position?.ahead ?? 0,
      estimatedWaitMinutes: position?.estimatedWaitMinutes ?? 0,
      smsConfigured: SmsService.isConfigured,
      alertId,
      message: priority === 'EMERGENCY_RED_FLAG'
        ? 'Emergency signs detected. Please go to the Emergency Room now; staff have been alerted.'
        : 'Check-in recorded. Token assigned.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/sos
 * SOS pressed before a check-in exists (or from a screen without a session).
 */
kioskRouter.post('/sos', (req: Request, res: Response): void => {
  try {
    const alert = AlertsService.raiseSos({
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : null,
      tokenNo: null,
      location: req.kioskDevice ? `${req.kioskDevice.name}${req.kioskDevice.location ? ` · ${req.kioskDevice.location}` : ''}` : 'Kiosk',
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
      raisedBy: req.kioskDevice ? `kiosk:${req.kioskDevice.id}` : req.staff?.id || 'kiosk'
    });
    res.json({ success: true, alertId: alert.id, acknowledged: !!alert.acknowledgedAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kiosk/alert/:id — lets the kiosk show "a nurse is coming" once the alert is acknowledged.
 */
kioskRouter.get('/alert/:id', (req: Request, res: Response): void => {
  const a = AlertsService.get(String(req.params.id));
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ success: true, acknowledged: !!a.acknowledgedAt, resolved: !!a.resolvedAt });
});

/**
 * GET /api/kiosk/position/:sessionId — queue position for the token slip (no other patients' data).
 */
kioskRouter.get('/position/:sessionId', (req: Request, res: Response): void => {
  const p = queuePosition(String(req.params.sessionId));
  if (!p) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ success: true, data: p });
});

/**
 * GET /api/kiosk/pariksha-factors
 * Get official Charaka Dashavidha Pariksha questionnaire cards and options
 */
kioskRouter.get('/pariksha-factors', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      factors: ayushOntology.dashavidhaParikshaFactors,
      agniClassifications: ayushOntology.agniClassifications
    }
  });
});

/**
 * GET /api/kiosk/session/:id
 * Visit summary — staff only (it contains health information).
 */
kioskRouter.get('/session/:id', requireStaff(...CLINICIAN_ROLES, 'reception'), (req: Request, res: Response): void => {
  try {
    const row: any = db.prepare(`
      SELECT s.*, p.name as patient_name, p.age, p.gender, p.language
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `).get(String(req.params.id));

    if (!row) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionId: row.id,
        patientId: row.patient_id,
        patientName: row.patient_name,
        age: row.age,
        gender: row.gender,
        language: row.language,
        symptoms: JSON.parse(row.symptoms_json || '[]'),
        pariksha: JSON.parse(row.pariksha_json || '{}'),
        vitals: JSON.parse(row.vitals_json || '{}'),
        triagePriority: row.triage_priority,
        redFlags: JSON.parse(row.red_flag_triggers || '[]'),
        status: row.status,
        tokenNo: row.token_no,
        createdAt: row.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/*
 * Unfinished check-ins ("drafts") let a patient continue after a power cut or a dead phone battery.
 * Contents are encrypted at rest, looked up only by the exact mobile number (via a keyed hash),
 * and deleted automatically after DRAFT_RETENTION_HOURS.
 */
try { db.exec('ALTER TABLE ephemeral_drafts ADD COLUMN phone_hash TEXT;'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_drafts_phone_hash ON ephemeral_drafts(phone_hash);'); } catch {}
// Drafts saved before encryption was introduced held plain phone numbers and names: remove them.
db.exec("DELETE FROM ephemeral_drafts WHERE draft_json NOT LIKE 'v1:%'");

/**
 * POST /api/kiosk/draft
 */
kioskRouter.post('/draft', (req: Request, res: Response): void => {
  try {
    const draftData = req.body.draftData ?? (req.body.draftPayload ? { stepNumber: req.body.stepNumber, draftPayload: req.body.draftPayload } : null);
    if (!draftData || (typeof draftData === 'object' && Object.keys(draftData).length === 0)) {
      res.status(400).json({ error: 'draftPayload is required' });
      return;
    }
    const serialized = JSON.stringify(draftData);
    if (serialized.length > 200_000) {
      res.status(413).json({ error: 'Draft is too large' });
      return;
    }
    const id = typeof req.body.draftId === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.draftId) ? req.body.draftId : uuidv4();
    const phone = normalisePhone(req.body.phone || req.body.draftPayload?.patient?.phone);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO ephemeral_drafts (id, phone, name, draft_json, updated_at, phone_hash)
      VALUES (?, NULL, NULL, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        draft_json = excluded.draft_json,
        updated_at = excluded.updated_at,
        phone_hash = COALESCE(excluded.phone_hash, ephemeral_drafts.phone_hash)
    `).run(id, encryptField(serialized), now, phone ? blindIndex(phone) : null);

    res.json({ success: true, draftId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/kiosk/draft/:draftId
 */
kioskRouter.delete('/draft/:draftId', (req: Request, res: Response): void => {
  try {
    db.prepare(`DELETE FROM ephemeral_drafts WHERE id = ?`).run(String(req.params.draftId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kiosk/lookup-draft?phone=XXXXXXXXXX
 * Resume an unfinished check-in. Requires the full 10-digit mobile number.
 */
kioskRouter.get('/lookup-draft', (req: Request, res: Response): void => {
  try {
    const phone = normalisePhone(req.query.phone || req.query.query);
    if (!phone) {
      res.status(400).json({ success: false, message: 'Enter the full 10-digit mobile number.' });
      return;
    }
    const row: any = db.prepare(`SELECT * FROM ephemeral_drafts WHERE phone_hash = ? ORDER BY updated_at DESC LIMIT 1`).get(blindIndex(phone));
    const plain = row ? decryptField(row.draft_json) : null;
    if (!row || !plain) {
      res.status(404).json({ success: false, message: 'No unfinished check-in found for this number.' });
      return;
    }
    audit(req, 'kiosk.draft_resumed', row.id);
    res.json({ success: true, data: { draftId: row.id, draftData: JSON.parse(plain), updatedAt: row.updated_at } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/family-intake
 * Check in several family members from one device. Each member gets their own department and
 * token. Nothing is invented: no default vitals, no default prakriti.
 */
kioskRouter.post('/family-intake', (req: Request, res: Response): void => {
  try {
    const familyMembers = req.body.familyMembers || req.body.members;
    if (!Array.isArray(familyMembers) || familyMembers.length === 0 || familyMembers.length > 6) {
      res.status(400).json({ error: 'Add between 1 and 6 family members.' });
      return;
    }
    const consent = cleanConsent(req.body?.consent);
    if (!consent || !consent.purposes.care) {
      res.status(400).json({ error: 'Consent to use their information for treatment is needed to continue.', code: 'CONSENT_REQUIRED' });
      return;
    }
    const careStream = ['AYURVEDA', 'ALLOPATHY', 'UNDECIDED'].includes(req.body.careStream) ? req.body.careStream : 'UNDECIDED';
    const phone = normalisePhone(req.body.attendantPhone || req.body.masterPhone);
    const now = new Date().toISOString();
    const groupId = `FAM-${uuidv4().slice(0, 8).toUpperCase()}`;

    for (const m of familyMembers) {
      const age = Number(m?.age);
      if (!String(m?.name || '').trim() || !Number.isFinite(age) || age < 0 || age > 120) {
        res.status(400).json({ error: 'Each family member needs a name and an age between 0 and 120.' });
        return;
      }
    }

    const issued = db.transaction(() => familyMembers.map((member: any, idx: number) => {
      const name = String(member.name).trim().slice(0, 80);
      const age = Number(member.age);
      const gender = GENDERS.includes(member.gender) ? member.gender : 'OTHER';
      const complaint = String(member.chiefComplaint || '').trim().slice(0, 200);
      const department = routeCheckIn({ careStream, age, gender, isPregnant: !!member.isPregnant, isEmergency: false, complaintText: complaint });
      const { tokenNo, tokenDate } = issueToken(department);
      const patientId = uuidv4();
      const sessionId = uuidv4();

      db.prepare(`
        INSERT INTO patients (id, name, age, gender, phone_masked, phone_hash, language, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, name, age, gender, phone ? SovereignNERService.maskPhone(phone) : null, phone ? blindIndex(phone) : null, member.language || req.body.language || 'hi', now);

      db.prepare(`
        INSERT INTO sessions (id, patient_id, symptoms_json, pariksha_json, vitals_json, triage_priority, red_flag_triggers, status, created_at, care_stream, language, department, token_no, token_date, kiosk_device_id, raw_transcript)
        VALUES (?, ?, ?, '{}', '{}', 'ROUTINE', '[]', 'PENDING_DOCTOR', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId, patientId,
        JSON.stringify(complaint ? [{ name: complaint, site: 'General', source: 'family', labelLocal: complaint }] : []),
        now, careStream, member.language || req.body.language || 'hi', department, tokenNo, tokenDate, req.kioskDevice?.id || null,
        `Family check-in (${groupId}), relation: ${String(member.relationship || member.relation || '').slice(0, 40)}`
      );
      recordConsent(patientId, sessionId, { ...consent, method: 'kiosk_assisted' }, req.kioskDevice ? `kiosk:${req.kioskDevice.id}` : 'kiosk');
      const pos = queuePosition(sessionId);
      return {
        memberIndex: idx,
        patientName: name,
        age,
        gender,
        relation: member.relationship || member.relation || '',
        tokenNumber: tokenNo,
        departmentCode: department,
        consultationRoom: pos?.room || '',
        estimatedWaitMinutes: pos?.estimatedWaitMinutes ?? null,
        sessionId,
        patientId
      };
    }))();

    audit(req, 'kiosk.family_check_in', groupId, { members: issued.length });
    publish({ type: 'queue.changed', reason: 'family_check_in' });

    res.json({
      success: true,
      totalRegistered: issued.length,
      familyGroupTokenId: groupId,
      tokens: issued,
      familyTokens: issued
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
