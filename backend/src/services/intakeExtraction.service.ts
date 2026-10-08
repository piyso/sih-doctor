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
  } | null;
}

export function analyseTranscript(transcript: string, patientId?: string, abhaId?: string): TranscriptAnalysis {
  const text = String(transcript || '');
  const normalizedText = PhoneticNormalizerService.normalize(text);
  const phoneticReplacements = PhoneticNormalizerService.extractTerms(text);

  const extracted = ClinicalParserService.parse(normalizedText, patientId, abhaId);
  // Emergency rules from the shared clinical lexicon (Hindi / Hinglish / English, recall-first).
  const lexicon = analyseComplaint(text);
  if (lexicon.redFlags.length) {
    extracted.redFlagTriggers = Array.from(new Set([...(extracted.redFlagTriggers || []), ...lexicon.redFlags.map(f => f.label)]));
    if (lexicon.sos) extracted.isEmergencyRedFlag = true;
  }

  // Hopfield attractor recall over a 10-D indicator vector.
  const featureVector = new Array(10).fill(0);
  const lower = normalizedText.toLowerCase();
  const symNames = (extracted.symptoms || []).map(s => (s.name || '').toLowerCase() + ' ' + (s.site || '').toLowerCase()).join(' ');
  if (lower.includes('chest') || lower.includes('substernal') || lower.includes('cardiac') || lower.includes('सीने') || lower.includes('छाती') || symNames.includes('chest')) featureVector[0] = 1.0;
  if (featureVector[0] === 1.0 && (lower.includes('left arm') || lower.includes('arm radiation') || lower.includes('बाएं हाथ') || lower.includes('बाईं बांह') || symNames.includes('arm'))) featureVector[1] = 1.0;
  if (lower.includes('diaphoresis') || lower.includes('sweat') || lower.includes('pasina') || lower.includes('पसीना') || symNames.includes('diaphoresis')) featureVector[2] = 1.0;
  if (lower.includes('crepitus') || lower.includes('cut cut') || lower.includes('knee') || lower.includes('घुटना') || lower.includes('कट-कट') || symNames.includes('knee') || symNames.includes('crepitus')) featureVector[3] = 1.0;
  if (lower.includes('morning stiffness') || lower.includes('stambha') || lower.includes('जकड़न') || lower.includes('अकड़न') || symNames.includes('stiffness')) featureVector[4] = 1.0;
  if (lower.includes('fever') || lower.includes('jwara') || lower.includes('बुखार') || symNames.includes('fever') || (extracted.vitals?.temp && parseFloat(extracted.vitals.temp) > 100)) featureVector[5] = 1.0;
  if (lower.includes('cough') || lower.includes('kasa') || lower.includes('balgam') || lower.includes('खांसी') || lower.includes('बलगम') || symNames.includes('cough')) featureVector[6] = 1.0;
  if (lower.includes('polyuria') || lower.includes('thirst') || lower.includes('urine') || lower.includes('पेशाब') || lower.includes('प्यास') || symNames.includes('urine')) featureVector[7] = 1.0;
  if (lower.includes('burning feet') || lower.includes('daha') || lower.includes('जलन') || symNames.includes('burning')) featureVector[8] = 1.0;
  if (lower.includes('joint swelling') || lower.includes('shotha') || lower.includes('जोड़ों में सूजन') || symNames.includes('joint')) featureVector[9] = 1.0;

  const activeFeatures = featureVector.filter(v => v > 0).length;
  const recall = HopfieldAssociativeService.recallAttractor(featureVector);
  // A syndrome match from a single feature is noise, not evidence — don't report it.
  const hopfieldAttractor = activeFeatures >= 2 ? {
    syndromeName: recall.bestMatchSyndrome.name,
    namasteCode: recall.bestMatchSyndrome.namasteCode,
    icd11Code: recall.bestMatchSyndrome.icd11Code,
    confidence: recall.retrievalConfidence,
    attractorEnergy: recall.attractorEnergy
  } : null;

  return { ...extracted, normalizedTranscript: normalizedText, phoneticReplacements, hopfieldAttractor };
}
