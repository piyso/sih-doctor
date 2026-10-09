/**
 * Scanned Medical Document Digitization & OCR Routes (Module B)
 * AIIA Sovereign MediKiosk
 * 
 * Supports both:
 * 1. POST /api/documents/ocr - Raw text stream normalization & clinical extraction
 * 2. POST /api/documents/ocr-image - Native edge hardware-accelerated image OCR via Tesseract 5.5
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { DocumentOCRService } from '../services/documentOCR.service';
import { NativeImageOCRService } from '../services/nativeImageOCR.service';
import { requireStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';

export const documentsRouter = Router();

/**
 * POST /api/documents/ocr-image
 * Ingest raw base64 image data from kiosk optical scanner or mobile camera
 * Runs native bilingual hardware-accelerated Tesseract with local tessdata
 */
documentsRouter.post('/ocr-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, fileName, patientId, documentType } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 field is required for image OCR' });
      return;
    }

    // A scan taken before check-in has no patient yet: the result is returned for the kiosk to attach to the
    // intake (which persists it under consent). Only an existing patient id is written to directly.
    const targetPatientId = typeof patientId === 'string' && db.prepare(`SELECT id FROM patients WHERE id = ?`).get(patientId) ? patientId : null;

    const digitized = await NativeImageOCRService.processImage(
      imageBase64,
      fileName || 'kiosk_scanned_document.png',
      targetPatientId || 'pending-intake',
      documentType || 'OLD_PRESCRIPTION'
    );

    if (!targetPatientId) {
      res.json({ success: true, persisted: false, data: digitized });
      return;
    }
    const insertDoc = db.prepare(`
      INSERT INTO documents (id, patient_id, document_type, extracted_text, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertDoc.run(
      digitized.documentId,
      digitized.patientId,
      digitized.documentType,
      digitized.extractedText,
      JSON.stringify({
        medications: digitized.extractedMedications,
        labMarkers: digitized.extractedLabMarkers,
        diagnoses: digitized.extractedDiagnoses,
        confidence: digitized.confidenceScore,
        recordedDate: digitized.recordedDate,
        plausibilityWarnings: digitized.plausibilityWarnings,
        fuzzyCorrections: digitized.fuzzyCorrections,
        vernacularPosology: digitized.vernacularPosologyDetected,
        humanReviewRequired: digitized.humanReviewRequired,
        engineUsed: digitized.engineUsed
      }),
      new Date().toISOString()
    );

    res.json({ success: true, persisted: true, data: digitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/ocr
 * Ingest raw scanned prescription/lab report text or stream data and extract structured markers
 */
documentsRouter.post('/ocr', (req: Request, res: Response): void => {
  try {
    const { text, patientId, documentType, clinicalPrior } = req.body;

    if (!text) {
      res.status(400).json({ error: 'text field is required for document OCR parsing' });
      return;
    }

    // A scan taken before check-in has no patient yet: the result is returned for the kiosk to attach to the
    // intake (which persists it under consent). Only an existing patient id is written to directly.
    const targetPatientId = typeof patientId === 'string' && db.prepare(`SELECT id FROM patients WHERE id = ?`).get(patientId) ? patientId : null;

    const digitized = DocumentOCRService.processDocumentText(
      text,
      targetPatientId || 'pending-intake',
      documentType || 'OLD_PRESCRIPTION',
      clinicalPrior
    );
    digitized.engineUsed = 'TEXT_STREAM';

    if (!targetPatientId) {
      res.json({ success: true, persisted: false, data: digitized });
      return;
    }
    const insertDoc = db.prepare(`
      INSERT INTO documents (id, patient_id, document_type, extracted_text, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertDoc.run(
      digitized.documentId,
      digitized.patientId,
      digitized.documentType,
      digitized.extractedText,
      JSON.stringify({
        medications: digitized.extractedMedications,
        labMarkers: digitized.extractedLabMarkers,
        diagnoses: digitized.extractedDiagnoses,
        confidence: digitized.confidenceScore,
        recordedDate: digitized.recordedDate,
        plausibilityWarnings: digitized.plausibilityWarnings,
        fuzzyCorrections: digitized.fuzzyCorrections,
        vernacularPosology: digitized.vernacularPosologyDetected,
        humanReviewRequired: digitized.humanReviewRequired,
        engineUsed: digitized.engineUsed
      }),
      new Date().toISOString()
    );

    res.json({ success: true, persisted: true, data: digitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/patient/:patientId
 * Retrieve chronological health timeline of digitized paper records for a patient
 */
documentsRouter.get('/patient/:patientId', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  try {
    const rows: any[] = db.prepare(`
      SELECT * FROM documents
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `).all(req.params.patientId);

    const documents = rows.map(r => {
      const meta = JSON.parse(r.metadata_json || '{}');
      return {
        documentId: r.id,
        patientId: r.patient_id,
        documentType: r.document_type,
        extractedText: r.extracted_text,
        extractedMedications: meta.medications || [],
        extractedLabMarkers: meta.labMarkers || [],
        extractedDiagnoses: meta.diagnoses || [],
        confidenceScore: meta.confidence || 0.85,
        recordedDate: meta.recordedDate,
        plausibilityWarnings: meta.plausibilityWarnings || [],
        fuzzyCorrections: meta.fuzzyCorrections || [],
        vernacularPosology: meta.vernacularPosology || [],
        humanReviewRequired: meta.humanReviewRequired || false,
        engineUsed: meta.engineUsed || 'UNKNOWN',
        createdAt: r.created_at
      };
    });

    res.json({
      success: true,
      data: documents
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
