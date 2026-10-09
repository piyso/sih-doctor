/**
 * Transcript → structured intake: the single pipeline behind POST /api/kiosk/parse-audio.
 *
 *   phonetic normalisation → clinical parser (symptoms, negation, duration, vitals, history, red flags)
 *   → clinical-lexicon emergency rules → syndrome recall (Hopfield) from the findings that are present.
 *
 * Deterministic and offline. Measured on edge-ai/eval/extraction_cases.json (npm run test:extraction).
 */
import { ClinicalParserService, ExtractedClinicalRecord } from './clinicalParser.service';
import { PhoneticNormalizerService } from './phoneticNormalizer.service';
import { HopfieldAssociativeService } from './hopfieldAssociative.service';
import { PACConformalGateService, PACGateEvaluation } from './pacConformalGate.service';
import { analyseComplaint } from './clinicalLexicon';

export interface TranscriptAnalysis extends ExtractedClinicalRecord {
  normalizedTranscript: string;
  phoneticReplacements: Array<{ raw: string; canonical: string }>;
  hopfieldAttractor: {
    syndromeName: string;
    namasteCode: string;
    icd11Code: string;
    confidence: number;
    attractorEnergy: number;
    /** All syndromes with their recall weights, best first. */
    allWeights: Array<{ id: string; name: string; weight: number }>;
    /** Split-conformal gate: show the suggestion only when it is inside the calibrated prediction set. */
    conformal: PACGateEvaluation;
  } | null;
}

/** A temperature such as "102°F" or "38.5°C" in °F, or null. */
export function fahrenheit(temp: unknown): number | null {
  const m = String(temp ?? '').match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*([cf])?/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return (m[2] || '').toLowerCase() === 'c' || v < 50 ? v * 9 / 5 + 32 : v;
}

/**
 * Pertinent negatives: complaints the patient explicitly said they do NOT have ("बुखार नहीं है", "no chest pain"),
 * for the doctor's record. A complaint also affirmed elsewhere in the transcript is not listed.
 */
export function deniedSymptoms(transcript: string): string[] {
  const text = String(transcript || '').trim();
  if (!text) return [];
  const symptoms = ClinicalParserService.parse(text).symptoms;
  return [...new Set(symptoms.filter(s => s.isNegated).map(s => s.name))].slice(0, 12);
}

export function analyseTranscript(transcript: string, patientId?: string, abhaId?: string): TranscriptAnalysis {
  const text = String(transcript || '');
  const normalizedText = PhoneticNormalizerService.normalize(text);
  const phoneticReplacements = PhoneticNormalizerService.extractTerms(text);

  // parse() normalises internally and also reads the words as spoken (vitals, lexicon), so it gets the raw text.
  const extracted = ClinicalParserService.parse(text, patientId, abhaId);
  // Emergency rules from the shared clinical lexicon (Hindi / Hinglish / English, recall-first).
  const lexicon = analyseComplaint(text);
  if (lexicon.redFlags.length) {
    extracted.redFlagTriggers = Array.from(new Set([...(extracted.redFlagTriggers || []), ...lexicon.redFlags.map(f => f.label)]));
    if (lexicon.sos) extracted.isEmergencyRedFlag = true;
  }

  // Hopfield attractor recall over a 10-D indicator vector, built only from findings the patient affirmed
  // ("bukhar nahi hai" must not light up the fever dimension).
  const present = (re: RegExp) => extracted.symptoms.some(s => !s.isNegated && re.test(`${s.name} ${s.site || ''}`));
  const c = lexicon.concepts;
  const tempF = fahrenheit(extracted.vitals?.temp);
  const featureVector = [
    present(/chest|substernal|angina/i) || (c.has('S_CHEST') && (c.has('F_PAIN') || c.has('F_PRESSURE'))),
    false,
    present(/diaphoresis/i) || c.has('F_SWEAT'),
    present(/crepitus|knee/i),
    present(/stiffness|stambha/i) || c.has('F_STIFF'),
    present(/fever|jwara/i) || (tempF !== null && tempF > 100.4),
    present(/cough|kasa/i),
    present(/polyuria|polydipsia|frequent urination/i) || c.has('F_THIRST') || (c.has('S_URINE') && c.has('Q_FREQ')),
    (c.has('S_FOOT') || c.has('S_HEEL')) && c.has('F_BURN'),
    present(/joint inflammation|sandhishotha/i) || ((c.has('S_JOINT') || c.has('S_KNEE')) && c.has('F_SWELL'))
  ].map(Number);
  // radiation to the left arm only counts together with chest symptoms
  featureVector[1] = featureVector[0] && (present(/left arm/i) || (c.has('S_ARM') && c.has('Q_LEFT'))) ? 1 : 0;

  const activeFeatures = featureVector.filter(v => v > 0).length;
  const recall = HopfieldAssociativeService.recallAttractor(featureVector);
  // A syndrome match from a single feature is noise, not evidence — don't report it.
  const hopfieldAttractor = activeFeatures >= 2 ? {
    syndromeName: recall.bestMatchSyndrome.name,
    namasteCode: recall.bestMatchSyndrome.namasteCode,
    icd11Code: recall.bestMatchSyndrome.icd11Code,
    confidence: recall.retrievalConfidence,
    attractorEnergy: recall.attractorEnergy,
    allWeights: recall.allWeights,
    conformal: PACConformalGateService.evaluate({ topCandidateConfidence: recall.retrievalConfidence, runnerUpConfidence: recall.allWeights[1]?.weight })
  } : null;

  return { ...extracted, normalizedTranscript: normalizedText, phoneticReplacements, hopfieldAttractor };
}
