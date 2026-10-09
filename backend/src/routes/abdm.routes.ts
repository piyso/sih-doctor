/**
 * ABDM Interoperability & NAMASTE Gateway Routes (Module D)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { AyushEngineService } from '../services/ayushEngine.service';
import { FhirGeneratorService } from '../services/fhirGenerator.service';
import { AbdmClient } from '../services/abdm.client';
import { requireKioskOrStaff, requireStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { TerminologyService } from '../services/terminology.service';

export const abdmRouter = Router();

/**
 * POST /api/abdm/abha/verify
 * Verify 14-digit ABHA ID or username@abdm address
 */
abdmRouter.post('/abha/verify', requireKioskOrStaff, async (req: Request, res: Response): Promise<void> => {
  try {
    const { abhaNumber, abhaAddress } = req.body || {};
    if (!abhaNumber && !abhaAddress) {
      res.status(400).json({ error: 'Either abhaNumber or abhaAddress is required' });
      return;
    }
    const clean = abhaNumber ? String(abhaNumber).replace(/[\-\s]/g, '') : '';
    const isValidFormat = abhaNumber ? /^\d{14}$/.test(clean) : /^[a-zA-Z0-9_.]{3,32}@(abdm|sbx)$/i.test(String(abhaAddress));
    if (!isValidFormat) {
      res.status(400).json({ success: false, error: 'Invalid ABHA format. Expected a 14-digit number or username@abdm' });
      return;
    }
    if (!AbdmClient.isConfigured || !clean) {
      // Honest answer: the format is right, but nobody has checked it with NHA.
      res.json({
        success: true,
        verified: false,
        mode: AbdmClient.mode,
        data: { abhaNumber: clean || null, abhaAddress: abhaAddress || null, formatValid: true },
        message: 'ABHA format is valid. It has not been verified with NHA because ABDM is not connected on this server.'
      });
      return;
    }
    const found = await AbdmClient.searchAbha(clean);
    audit(req, 'abdm.abha_lookup', null, { found: !!found });
    res.json({
      success: true,
      verified: !!found && found.status === 'ACTIVE',
      mode: AbdmClient.mode,
      data: found ? { abhaNumber: clean, status: found.status, abhaAddress: found.abhaAddress } : { abhaNumber: clean, status: 'NOT_FOUND' }
    });
  } catch (err: any) {
    res.status(502).json({ error: `ABDM could not be reached: ${err.message}` });
  }
});

/**
 * GET /api/abdm/namaste/codes
 * Search and retrieve official NAMASTE morbidity A-Codes with tri-coding
 */
abdmRouter.get('/namaste/codes', requireKioskOrStaff, (req: Request, res: Response): void => {
  try {
    const { q } = req.query;
    let entries = AyushEngineService.getAllNamasteEntries();

    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      entries = entries.filter(e =>
        e.aCode.toLowerCase().includes(query) ||
        e.sanskritTerm.toLowerCase().includes(query) ||
        e.englishEquivalent.toLowerCase().includes(query) ||
        e.icd10DualCode.toLowerCase().includes(query) ||
        e.snomedConceptId.includes(query)
      );
    }

    res.json({
      success: true,
      count: entries.length,
      data: entries
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/abdm/namaste/search?q=&system=&limit=
 * Ranked terminology search (NAMASTE, ICD-11 TM2 when imported, AFI formulations). Candidates, not a guess.
 */
abdmRouter.get('/namaste/search', requireKioskOrStaff, (req: Request, res: Response): void => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.json({ success: true, count: 0, data: [], index: TerminologyService.stats() });
    return;
  }
  const system = typeof req.query.system === 'string' ? (req.query.system as any) : undefined;
  const hits = TerminologyService.search(q, { system, limit: Number(req.query.limit) || 10 });
  res.json({ success: true, count: hits.length, data: hits, index: TerminologyService.stats() });
});

/**
 * POST /api/abdm/fhir/generate
 * Generate standalone ABDM FHIR R4 Bundle from input case sheet
 */
abdmRouter.post('/fhir/generate', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const record = req.body;
    const bundle = FhirGeneratorService.buildBundle(record);
    res.json({
      success: true,
      bundle
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
/**
 * GET /api/abdm/fhir-bundle/:sessionId
 * Retrieve or dynamically construct real-time ABDM FHIR R4 Bundle from SQLite session
 */
abdmRouter.get('/fhir-bundle/:sessionId', requireStaff(...CLINICIAN_ROLES, 'pharmacist'), (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    const sessionRow: any = db.prepare(`
      SELECT s.*, p.name as patient_name, p.age, p.gender, p.language, p.prakriti, p.abha_id, p.abha_address
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `).get(sessionId);

    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // A finalized visit already has the signed bundle (with medicines) — return that one.
    const encounterRow: any = db.prepare(`SELECT fhir_bundle_json FROM encounters WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`).get(sessionId);
    if (encounterRow?.fhir_bundle_json) {
      try {
        res.json({ success: true, bundle: JSON.parse(encounterRow.fhir_bundle_json), finalized: true });
        return;
      } catch { /* fall through and rebuild */ }
    }

    const symptoms = JSON.parse(sessionRow.symptoms_json || '[]');
    const pariksha = JSON.parse(sessionRow.pariksha_json || '{}');
    const vitals = JSON.parse(sessionRow.vitals_json || '{}');

    const provisionalDiagnoses = symptoms
      .filter((s: any) => !s?.isNegated)
      .map((s: any) => AyushEngineService.resolveDiagnosis(s))
      .filter(Boolean);

    const record = {
      encounterId: `enc-${sessionId}`,
      sessionId: sessionRow.id,
      patientId: sessionRow.patient_id,
      patient: {
        id: sessionRow.patient_id,
        name: sessionRow.patient_name,
        age: sessionRow.age,
        gender: sessionRow.gender,
        language: sessionRow.language,
        prakriti: sessionRow.prakriti,
        abhaId: sessionRow.abha_id,
        abhaAddress: sessionRow.abha_address
      },
      symptoms,
      pariksha,
      vitals,
      diagnoses: provisionalDiagnoses,
      doctorName: 'Consulting doctor (not yet finalized)',
      createdAt: sessionRow.created_at
    };

    const bundle = FhirGeneratorService.buildBundle(record as any);
    res.json({
      success: true,
      bundle
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

