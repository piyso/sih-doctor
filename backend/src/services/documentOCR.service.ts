/**
 * Medical Document Digitization & Laboratory Intelligence Service
 * PS ID 26047 — AIIA Sovereign MediKiosk
 * 
 * Production-Grade Dual-Pharmacology & Clinical Laboratory Extraction Engine
 * Integrates:
 * 1. Fuzzy Clinical Entity Resolution (Levenshtein & Canonical AFI/Allopathic maps)
 * 2. Physiological Plausibility Audit (Dropped decimal point safeguards & critical flags)
 * 3. Multi-Page Orphan Page Detection
 * 4. Vernacular Devanagari Posology Normalization
 */

import { LabMarker, DigitizedDocument } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { FuzzyClinicalMatcherService } from './fuzzyClinicalMatcher.service';
import { PhysiologicalPlausibilityService, AnalyteDefinition } from './physiologicalPlausibility.service';
import { PharmacopoeiaFTSService, ClinicalPriorContext } from './pharmacopoeiaFTS.service';

export class DocumentOCRService {
  /**
   * Process raw document text from camera, scanner, or local native OCR stream
   * with Bayesian Clinical Prior conditioning from Steps 1-5
   */
  public static processDocumentText(
    text: string,
    patientId: string = 'patient-default',
    documentType: 'OLD_PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'OTHER' = 'OLD_PRESCRIPTION',
    clinicalPrior?: ClinicalPriorContext
  ): DigitizedDocument {
    // 0. Normalize Devanagari Numerals (०-९ -> 0-9)
    const normalizedText = FuzzyClinicalMatcherService.normalizeDevanagariNumerals(text);

    // Extract Hindi Vernacular Posology & Anupana instructions
    const vernacularPosologyDetected = FuzzyClinicalMatcherService.extractVernacularPosology(normalizedText);

    const extractedMedications: string[] = [];
    const fuzzyCorrections: Array<{ original: string; corrected: string; confidence: number; category: string }> = [];
    const extractedDiagnoses: string[] = [];
    const rawLabCandidateMarkers: Array<{ testName: string; value: number; unit?: string }> = [];

    // Multi-Page Orphan Page Detection
    let isOrphanPage = false;
    const missingPages: string[] = [];
    const pageMatch = normalizedText.match(/\bPage\s*([2-9])\s*of\s*(\d+)\b/i);
    if (pageMatch && !/\bPage\s*1\b/i.test(normalizedText)) {
      isOrphanPage = true;
      const currentPage = parseInt(pageMatch[1], 10);
      for (let p = 1; p < currentPage; p++) {
        missingPages.push(`Page ${p}`);
      }
    }

    const matchedSpans: Array<{ start: number; end: number }> = [];

    // 1. Extract Lab Markers using Comprehensive 40-Analyte Registry & Noise-Resilient Patterns
    for (const def of PhysiologicalPlausibilityService.REGISTRY) {
      // Sort aliases by length descending so longer phrases match first
      const sortedAliases = [...def.aliases].sort((a, b) => b.length - a.length);

      for (const alias of sortedAliases) {
        const escaped = alias.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        
        // Flexible pattern supporting dots, colons, equals, tabs, pipes, or spaces
        const regex = new RegExp(
          `(?:\\b|[*»•-]\\s*)${escaped}(?:\\s*\\([A-Za-z0-9\\s/]+\\))?[\\s.:=()\\|\\-]+(\\d+(?:\\.\\d+)?)(?:\\s*([a-zA-Z/%µu]+(?:\\/[a-zA-Z]+)?)?)`,
          'i'
        );
        const match = regex.exec(normalizedText);

        if (match && match.index !== undefined) {
          const matchStart = match.index;
          const matchEnd = match.index + match[0].length;
          const overlaps = matchedSpans.some(span => Math.max(span.start, matchStart) < Math.min(span.end, matchEnd));
          if (overlaps) continue;
          matchedSpans.push({ start: matchStart, end: matchEnd });

          const val = parseFloat(match[1]);
          const detectedUnit = match[2] ? match[2].trim() : '';

          rawLabCandidateMarkers.push({
            testName: def.canonicalName,
            value: val,
            unit: detectedUnit || def.unit
          });
          break; // Matched primary alias for this analyte
        }
      }
    }

    // Run Laboratory Markers through 40-Analyte Physiological Plausibility Engine
    const auditResult = PhysiologicalPlausibilityService.auditMarkers(rawLabCandidateMarkers, normalizedText);
    const extractedLabMarkers: LabMarker[] = auditResult.auditedMarkers;
    const unitConversionsApplied: string[] = auditResult.unitConversions;
    const plausibilityWarnings: string[] = auditResult.warnings;
    let humanReviewRequired: boolean = auditResult.requiresHumanReview;
    let reviewReason: string | undefined = auditResult.reviewReason;

    // 2. Extract Medications using Posology Parser, FTS5 Trigram & Damerau-Levenshtein
    const drugPatterns = [
      /\b(Tab|Tablet|Cap|Capsule|Syp|Syrup|Inj|Injection|Churna|Choornam|Vati|Gutika|Taila|Tailam|Ghrita|Ghritam|Kwath|Kashayam|Avaleha|Lehyam|Asava|Arishta|Bhasma|Pishti|Lepa)\.?\s+([A-Za-z0-9\-\s/]{2,36}?(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|drops|vati|tab))?)(?=\s+(?:OD|BD|TDS|TID|BID|HS|SOS|PC|AC|daily|twice|subah|shaam|रात|सुबह)|\s*\n|\s*,|\s*\.|$)/gi,
      /\b([A-Z][a-zA-Z0-9\-]+(?:\s+[A-Za-z0-9\-]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml))\b/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Guggulu|Guggul|Churna|Vati|Gutika|Kwath|Kashaya|Avaleha|Asava|Arishta|Bhasma|Pishti|Ras|Rasa))\b/g
    ];

    for (const pat of drugPatterns) {
      let m;
      while ((m = pat.exec(normalizedText)) !== null) {
        const found = (m[2] ? `${m[1]} ${m[2]}` : m[1]).trim();
        const isNoise = /^(Blood|Report|Patient|Doctor|Hospital|Clinic|Prescription|History|Investigation|Treatment|Advice|Biochemistry|Diagnosis|Discharge|Page)$/i.test(found);
        if (isNoise || found.length < 3) continue;

        // Try FTS5 Trigram Knowledge Engine first with Bayesian Clinical Prior
        const ftsMatch = PharmacopoeiaFTSService.resolveMedication(found, clinicalPrior);
        if (ftsMatch.matched && ftsMatch.confidence >= 0.70) {
          if (ftsMatch.canonicalName.toLowerCase() !== found.toLowerCase() || ftsMatch.bayesianPriorBoostApplied) {
            fuzzyCorrections.push({
              original: found,
              corrected: ftsMatch.canonicalName,
              confidence: ftsMatch.confidence,
              category: ftsMatch.category
            });
          }
          if (!extractedMedications.some(d => d.toLowerCase() === ftsMatch.canonicalName.toLowerCase())) {
            extractedMedications.push(ftsMatch.canonicalName);
          }
          if (ftsMatch.contraindicationFlag) {
            plausibilityWarnings.push(ftsMatch.contraindicationFlag);
            humanReviewRequired = true;
            reviewReason = ftsMatch.contraindicationFlag;
          }
          continue;
        }

        // Fallback to FuzzyClinicalMatcherService
        const resolution = FuzzyClinicalMatcherService.resolveMedicationString(found);
        if (resolution.wasCorrected) {
          fuzzyCorrections.push({
            original: found,
            corrected: resolution.resolvedString,
            confidence: resolution.confidence,
            category: resolution.category
          });
        }

        const medName = resolution.resolvedString;
        if (!extractedMedications.some(d => d.toLowerCase() === medName.toLowerCase())) {
          extractedMedications.push(medName);
        }
      }
    }

    // 3. Extract Common Chronic Diagnoses
    const dxKeywords = [
      'Type 2 Diabetes Mellitus', 'T2DM', 'Diabetes Mellitus', 'Diabetes',
      'Hypertension', 'Stage 2 Hypertension', 'HTN',
      'Hypothyroidism', 'Chronic Kidney Disease', 'CKD', 'Asthma', 'COPD',
      'Osteoarthritis', 'Sandhigata Vata', 'Rheumatoid Arthritis', 'Amavata',
      'Dyslipidemia', 'GERD', 'Amlapitta', 'UTI', 'Fatty Liver',
      'Coronary Artery Disease', 'CAD'
    ];

    for (const dx of dxKeywords) {
      if (new RegExp(`\\b${dx}\\b`, 'i').test(normalizedText)) {
        if (!extractedDiagnoses.includes(dx)) {
          extractedDiagnoses.push(dx);
        }
      }
    }

    // 4. Extract Date if present
    const dateMatch = normalizedText.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
    const recordedDate = dateMatch ? dateMatch[1] : undefined;

    // 5. Calculate Honest Clinical Confidence Score
    let confidenceScore = 0.85;
    if (extractedMedications.length > 0 && extractedLabMarkers.length > 0) {
      confidenceScore = 0.95;
    } else if (extractedMedications.length > 0 || extractedLabMarkers.length > 0) {
      confidenceScore = 0.90;
    } else {
      confidenceScore = 0.65;
    }

    // Penalize confidence if dropped decimals, orphan pages, or heavy fuzzy distance
    if (isOrphanPage) {
      confidenceScore = Math.max(0.60, confidenceScore - 0.10);
      humanReviewRequired = true;
      reviewReason = reviewReason || 'Multi-page document with missing preceding pages.';
    }

    if (plausibilityWarnings.length > 0) {
      confidenceScore = Math.max(0.65, confidenceScore - 0.08);
      humanReviewRequired = true;
    }

    if (fuzzyCorrections.some(c => c.confidence < 0.80)) {
      confidenceScore = Math.max(0.70, confidenceScore - 0.05);
      humanReviewRequired = true;
      reviewReason = reviewReason || 'Fuzzy drug matching required manual physician confirmation.';
    }

    return {
      documentId: uuidv4(),
      patientId,
      documentType,
      extractedText: normalizedText.trim(),
      extractedMedications,
      extractedLabMarkers,
      extractedDiagnoses,
      recordedDate,
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      isOrphanPage,
      missingPages: missingPages.length > 0 ? missingPages : undefined,
      unitConversionsApplied: unitConversionsApplied.length > 0 ? unitConversionsApplied : undefined,
      plausibilityWarnings: plausibilityWarnings.length > 0 ? plausibilityWarnings : undefined,
      fuzzyCorrections: fuzzyCorrections.length > 0 ? fuzzyCorrections : undefined,
      vernacularPosologyDetected: vernacularPosologyDetected.length > 0 ? vernacularPosologyDetected : undefined,
      humanReviewRequired,
      reviewReason
    };
  }
}
