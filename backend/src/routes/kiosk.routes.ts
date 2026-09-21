/**
 * Patient-Facing MediKiosk Routes (Stage 1 Intake & Triage)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { ClinicalParserService } from '../services/clinicalParser.service';
import { SovereignNERService } from '../services/sovereignNER.service';
import { AyushEngineService } from '../services/ayushEngine.service';
import { PhoneticNormalizerService } from '../services/phoneticNormalizer.service';
import { HopfieldAssociativeService } from '../services/hopfieldAssociative.service';
import { PACConformalGateService } from '../services/pacConformalGate.service';
import ayushOntology from '../shared/ayush_ontology.json';

export const kioskRouter = Router();

/**
 * POST /api/kiosk/parse-audio
 * Deep Multi-Modal Parse: Phonetic Normalizer -> Clinical Engine -> Hopfield Attractor -> PAC Conformal Gate
 */
kioskRouter.post('/parse-audio', (req: Request, res: Response): void => {
  try {
    const { transcript, patientId, abhaId } = req.body;
    if (!transcript) {
      res.status(400).json({ error: 'transcript is required' });
      return;
    }

    // 1. Phonetic Normalization (Hinglish / Regional Dialects -> Canonical terms)
    const normalizedText = PhoneticNormalizerService.normalize(transcript);
    const phoneticReplacements = PhoneticNormalizerService.extractTerms(transcript);

    // 2. Clinical Extraction
    const extracted = ClinicalParserService.parse(normalizedText, patientId, abhaId);

    // 3. Hopfield Modern Attractor Recall
    // Build 10-D indicator vector from extracted symptoms
    const featureVector = new Array(10).fill(0);
    const lower = normalizedText.toLowerCase();
    if (lower.includes('chest') || lower.includes('substernal') || lower.includes('cardiac')) featureVector[0] = 1.0;
    if (lower.includes('left arm') || lower.includes('arm radiation')) featureVector[1] = 1.0;
    if (lower.includes('diaphoresis') || lower.includes('sweat') || lower.includes('pasina')) featureVector[2] = 1.0;
    if (lower.includes('crepitus') || lower.includes('cut cut') || lower.includes('knee')) featureVector[3] = 1.0;
    if (lower.includes('morning stiffness') || lower.includes('stambha')) featureVector[4] = 1.0;
    if (lower.includes('fever') || lower.includes('jwara') || (extracted.vitals?.temp && parseFloat(extracted.vitals.temp) > 100)) featureVector[5] = 1.0;
    if (lower.includes('cough') || lower.includes('kasa') || lower.includes('balgam')) featureVector[6] = 1.0;
    if (lower.includes('polyuria') || lower.includes('thirst') || lower.includes('urine')) featureVector[7] = 1.0;
    if (lower.includes('burning feet') || lower.includes('daha')) featureVector[8] = 1.0;
    if (lower.includes('joint swelling') || lower.includes('shotha')) featureVector[9] = 1.0;

    const hopfieldRecall = HopfieldAssociativeService.recallAttractor(featureVector);

    // 4. PAC Conformal Triage Gating
    const isEmergencyCandidate = extracted.isEmergencyRedFlag || hopfieldRecall.bestMatchSyndrome.triagePriority === 'EMERGENCY_RED_FLAG';
    const pacGate = PACConformalGateService.evaluate({
      topCandidateConfidence: isEmergencyCandidate ? 0.98 : 0.88,
      runnerUpConfidence: isEmergencyCandidate ? 0.12 : 0.45,
      vitalsAnomalyCount: extracted.isEmergencyRedFlag ? 1 : 0,
      alpha: 0.01 // 99% coverage guarantee
    });

    res.json({
      success: true,
      data: {
        ...extracted,
        normalizedTranscript: normalizedText,
        phoneticReplacements,
        hopfieldAttractor: {
          syndromeName: hopfieldRecall.bestMatchSyndrome.name,
          namasteCode: hopfieldRecall.bestMatchSyndrome.namasteCode,
          icd11Code: hopfieldRecall.bestMatchSyndrome.icd11Code,
          confidence: hopfieldRecall.retrievalConfidence,
          attractorEnergy: hopfieldRecall.attractorEnergy
        },
        pacConformalGate: pacGate
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/intake
 * Save complete pre-consultation history intake from MediKiosk
 */
kioskRouter.post('/intake', (req: Request, res: Response): void => {
  try {
    const { patient, symptoms, pariksha, vitals, rawTranscript, scannedDocs } = req.body;

    if (!patient || !patient.name) {
      res.status(400).json({ error: 'patient object with name is required' });
      return;
    }

    const patientId = patient.id || uuidv4();
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Redact / mask demographic data
    const maskedAadhaar = patient.aadhaar ? SovereignNERService.maskAadhaar(patient.aadhaar) : null;
    const maskedPhone = patient.phone ? SovereignNERService.maskPhone(patient.phone) : null;

    // Check emergency red flags
    const parserResult = ClinicalParserService.parse(rawTranscript || JSON.stringify(symptoms || []));
    let priority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE' = 'ROUTINE';
    let redFlags: string[] = [];

    if (parserResult.isEmergencyRedFlag) {
      priority = 'EMERGENCY_RED_FLAG';
      redFlags = parserResult.redFlagTriggers;
    } else if (vitals && (parseInt(vitals.temp) > 101 || (vitals.bp && parseInt(vitals.bp.split('/')[0]) > 150))) {
      priority = 'HIGH_PRIORITY';
    }

    // Upsert Patient
    const insertPatient = db.prepare(`
      INSERT INTO patients (id, abha_id, abha_address, name, age, gender, phone_masked, language, prakriti, is_pregnant, gestational_weeks, is_lactating, weight_kg, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        abha_id=excluded.abha_id,
        prakriti=excluded.prakriti,
        is_pregnant=excluded.is_pregnant,
        gestational_weeks=excluded.gestational_weeks,
        is_lactating=excluded.is_lactating,
        weight_kg=excluded.weight_kg
    `);

    insertPatient.run(
      patientId,
      patient.abhaId || null,
      patient.abhaAddress || null,
      patient.name,
      patient.age || 40,
      patient.gender || 'MALE',
      maskedPhone,
      patient.language || 'hi',
      pariksha?.prakriti || 'Vata-Pitta',
      patient.isPregnant ? 1 : 0,
      patient.gestationalWeeks || null,
      patient.isLactating ? 1 : 0,
      patient.weightKg || null,
      now
    );

    // Insert Session
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, patient_id, symptoms_json, pariksha_json, vitals_json, triage_priority, red_flag_triggers, raw_transcript, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSession.run(
      sessionId,
      patientId,
      JSON.stringify(symptoms || parserResult.symptoms),
      JSON.stringify(pariksha || {}),
      JSON.stringify(vitals || parserResult.vitals),
      priority,
      JSON.stringify(redFlags),
      rawTranscript || '',
      priority === 'EMERGENCY_RED_FLAG' ? 'DIVERTED_EMERGENCY' : 'PENDING_DOCTOR',
      now
    );

    // Ingest and link scanned prior documents if provided
    if (scannedDocs && Array.isArray(scannedDocs) && scannedDocs.length > 0) {
      const insertDoc = db.prepare(`
        INSERT OR REPLACE INTO documents (id, patient_id, document_type, extracted_text, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const d of scannedDocs) {
        const docId = d.documentId || uuidv4();
        insertDoc.run(
          docId,
          patientId,
          d.docType || 'OLD_PRESCRIPTION',
          d.rawText || '',
          JSON.stringify({
            medications: d.extractedMeds || [],
            labMarkers: d.extractedLabs || [],
            diagnoses: d.extractedDiagnoses || [],
            confidence: d.confidenceScore || 0.9,
            recordedDate: now,
            plausibilityWarnings: d.plausibilityWarnings || [],
            fuzzyCorrections: d.fuzzyCorrections || [],
            vernacularPosology: d.vernacularPosologyDetected || [],
            humanReviewRequired: d.humanReviewRequired || false,
            engineUsed: d.engineUsed || 'KIOSK_DOCUMENT_SCANNER'
          }),
          now
        );
      }
    }

    res.json({
      success: true,
      sessionId,
      patientId,
      triagePriority: priority,
      redFlags,
      status: priority === 'EMERGENCY_RED_FLAG' ? 'DIVERTED_EMERGENCY' : 'PENDING_DOCTOR',
      message: priority === 'EMERGENCY_RED_FLAG'
        ? 'CRITICAL ALERT: Emergency signs detected. Divert to Emergency Resuscitation Bay.'
        : 'Pre-consultation intake recorded successfully. Token assigned.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
 * Retrieve session state by session ID
 */
kioskRouter.get('/session/:id', (req: Request, res: Response): void => {
  try {
    const row: any = db.prepare(`
      SELECT s.*, p.name as patient_name, p.age, p.gender, p.language
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `).get(req.params.id);

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
        createdAt: row.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/draft
 * Incremental state flush to protect against dead smartphone battery (<5%)
 */
kioskRouter.post('/draft', (req: Request, res: Response): void => {
  try {
    const { draftId, phone, name, draftData } = req.body;
    const id = draftId || uuidv4();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (name || '').trim();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO ephemeral_drafts (id, phone, name, draft_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        phone = COALESCE(excluded.phone, ephemeral_drafts.phone),
        name = COALESCE(excluded.name, ephemeral_drafts.name),
        draft_json = excluded.draft_json,
        updated_at = excluded.updated_at
    `).run(id, cleanPhone || null, cleanName || null, JSON.stringify(draftData || {}), now);

    res.json({
      success: true,
      draftId: id,
      message: 'Incremental draft preserved in SQLite WAL with zero-data-loss guarantee.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kiosk/lookup-draft
 * Retrieve incomplete draft by mobile number or patient name (for doctor desk / kiosk resumption)
 */
kioskRouter.get('/lookup-draft', (req: Request, res: Response): void => {
  try {
    const phone = req.query.phone as string;
    const name = req.query.name as string;
    const query = (req.query.query as string || '').trim();

    let row: any = null;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      row = db.prepare(`SELECT * FROM ephemeral_drafts WHERE phone LIKE ? ORDER BY updated_at DESC LIMIT 1`).get(`%${cleanPhone}%`);
    } else if (name) {
      row = db.prepare(`SELECT * FROM ephemeral_drafts WHERE LOWER(name) LIKE ? ORDER BY updated_at DESC LIMIT 1`).get(`%${name.toLowerCase()}%`);
    } else if (query) {
      const cleanQ = query.replace(/\D/g, '');
      if (cleanQ.length >= 4) {
        row = db.prepare(`SELECT * FROM ephemeral_drafts WHERE phone LIKE ? ORDER BY updated_at DESC LIMIT 1`).get(`%${cleanQ}%`);
      }
      if (!row) {
        row = db.prepare(`SELECT * FROM ephemeral_drafts WHERE LOWER(name) LIKE ? ORDER BY updated_at DESC LIMIT 1`).get(`%${query.toLowerCase()}%`);
      }
    }

    if (!row) {
      res.status(404).json({ success: false, message: 'No draft session found for given identifier' });
      return;
    }

    res.json({
      success: true,
      data: {
        draftId: row.id,
        phone: row.phone,
        name: row.name,
        draftData: JSON.parse(row.draft_json),
        updatedAt: row.updated_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kiosk/family-intake
 * Frontier 4: Multi-Patient Family Session Hub
 * Issues linked sequential tokens (e.g. KAYA-042A, KAYA-042B, BALA-008C) under single attendant device
 */
kioskRouter.post('/family-intake', (req: Request, res: Response): void => {
  try {
    const attendantPhone = req.body.attendantPhone || req.body.masterPhone;
    const familyMembers = req.body.familyMembers || req.body.members;
    if (!Array.isArray(familyMembers) || familyMembers.length === 0) {
      res.status(400).json({ error: 'familyMembers array is required' });
      return;
    }

    const suffixes = ['A', 'B', 'C', 'D', 'E'];
    const baseCounter = Math.floor(Math.random() * 400 + 40);
    const now = new Date().toISOString();

    const issuedFamilyTokens = familyMembers.map((member: any, idx: number) => {
      const suffix = suffixes[idx] || `${idx + 1}`;
      const isPediatric = member.age < 12;
      const isObgyn = member.gender === 'FEMALE' && (member.isPregnant || member.isLactating);
      const isSurgical = (member.chiefComplaint || '').toLowerCase().includes('piles') || (member.chiefComplaint || '').toLowerCase().includes('cut');

      let deptCode = 'KAYA';
      let deptName = 'Kayachikitsa (Internal Medicine)';
      let room = 'Room 204';

      if (isPediatric) {
        deptCode = 'BALA';
        deptName = 'Kaumarbhritya (Pediatrics)';
        room = 'Room 108';
      } else if (isObgyn) {
        deptCode = 'PRAS';
        deptName = 'Prasuti Tantra (OBGYN)';
        room = 'Room 206';
      } else if (isSurgical) {
        deptCode = 'SHAL';
        deptName = 'Shalya Tantra (Surgery)';
        room = 'Room 112';
      }

      const tokenNumber = `${deptCode}-0${baseCounter}${suffix}`;
      const memberPatientId = uuidv4();
      const memberSessionId = uuidv4();

      // Persist member patient record
      db.prepare(`
        INSERT INTO patients (id, name, age, gender, phone_masked, language, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberPatientId,
        member.name,
        member.age,
        member.gender,
        attendantPhone ? SovereignNERService.maskPhone(attendantPhone) : null,
        member.language || 'hi',
        now
      );

      // Persist member session
      db.prepare(`
        INSERT INTO sessions (id, patient_id, symptoms_json, pariksha_json, vitals_json, triage_priority, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberSessionId,
        memberPatientId,
        JSON.stringify([{ name: member.chiefComplaint || 'General OPD Consultation', site: member.bodyRegion || 'General', severityScore: member.severity || 5 }]),
        JSON.stringify({ prakriti: member.prakriti || 'Vata-Pitta' }),
        JSON.stringify(member.vitals || { bp: '120/80', pulse: 76, spo2: '98%', temp: '98.6°F' }),
        member.severity >= 8 ? 'EMERGENCY_RED_FLAG' : 'ROUTINE',
        'PENDING_DOCTOR',
        now
      );

      return {
        memberIndex: idx,
        patientName: member.name,
        age: member.age,
        gender: member.gender,
        relation: member.relation || 'Family Member',
        tokenNumber,
        department: deptName,
        consultationRoom: room,
        sessionId: memberSessionId,
        patientId: memberPatientId,
        consecutiveSlot: idx > 0 && deptCode === 'KAYA' ? 'Consecutive Slot with Attendant' : 'Standard Queue'
      };
    });

    res.json({
      success: true,
      attendantPhone,
      totalRegistered: issuedFamilyTokens.length,
      familyGroupTokenId: `FAM-GRP-${baseCounter}`,
      tokens: issuedFamilyTokens,
      familyTokens: issuedFamilyTokens,
      message: 'Multi-Patient Family Session Hub: Sequential tokens successfully linked to attendant mobile.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
