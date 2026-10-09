/**
 * Transcript → structured intake: the single pipeline behind POST /api/kiosk/parse-audio.
 *
 *   phonetic normalisation → clinical parser (symptoms, negation, duration, vitals, history, red flags)
 *   → clinical-lexicon emergency rules → syndrome recall (Hopfield) from the findings that are present.
 *
 * Deterministic and offline. Measured on edge-ai/eval/extraction_cases.json (npm run test:extraction) and, through the
 * recogniser, on edge-ai/eval/extraction_audio.py + tests/extraction_audio_score.ts.
 *
 * Re-checks: the speech service also decodes speed-perturbed copies of the same audio, which make different
 * mistakes in noise. A complaint heard in any of them is added (the patient confirms the list on screen); a denial
 * heard in the primary decode always wins; an emergency counts when the primary decode or two re-checks have it,
 * and one heard in a single re-check is passed to staff as "possible — confirm" instead of raising the alarm.
 */
import { ClinicalParserService, ExtractedClinicalRecord, symptomFamily } from './clinicalParser.service';
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
  // a complaint that has stopped ("बुखार उतर गया") was not denied
  return [...new Set(symptoms.filter(s => s.isNegated && !s.isResolved).map(s => s.name))].slice(0, 12);
}

const familyKey = (name: string) => symptomFamily(name) || (name || '').toLowerCase();

/** Analyse the transcript, combined with re-check decodes of the same audio when the speech service sent them. */
export function analyseTranscript(transcript: string, patientId?: string, abhaId?: string, alternatives: string[] = []): TranscriptAnalysis {
  const primary = analyseOne(transcript, patientId, abhaId);
  // identical re-checks are kept: two decodes agreeing is the evidence the vote counts
  const alts = alternatives.map(a => String(a || '').trim()).filter(Boolean).slice(0, 4).map(a => analyseOne(a, patientId, abhaId));
  return alts.length ? mergeRechecks(primary, alts) : primary;
}

export function mergeRechecks(primary: TranscriptAnalysis, alts: TranscriptAnalysis[]): TranscriptAnalysis {
  const merged: TranscriptAnalysis = { ...primary, symptoms: [...primary.symptoms], vitals: { ...primary.vitals }, pastHistory: [...primary.pastHistory], redFlagTriggers: [...primary.redFlagTriggers] };
  const known = new Map(primary.symptoms.map(s => [familyKey(s.name), s]));
  for (const a of alts) {
    for (const s of a.symptoms) {
      if (s.isNegated || known.has(familyKey(s.name))) continue; // a denial in the primary decode wins
      const added = { ...s, heardOnRecheck: true } as typeof s;
      merged.symptoms.push(added);
      known.set(familyKey(s.name), added);
    }
    for (const h of a.pastHistory) if (!merged.pastHistory.includes(h)) merged.pastHistory.push(h);
  }
  // a vital missing from the primary decode is taken only when two re-checks read the same value
  for (const key of new Set(alts.flatMap(a => Object.keys(a.vitals || {})))) {
    if ((merged.vitals as any)[key] !== undefined) continue;
    const vals = alts.map(a => (a.vitals as any)[key]).filter(v => v !== undefined);
    const agreed = vals.find(v => vals.filter(x => String(x) === String(v)).length >= 2);
    if (agreed !== undefined) (merged.vitals as any)[key] = agreed;
  }
  const flagged = alts.filter(a => a.isEmergencyRedFlag);
  if (!primary.isEmergencyRedFlag && flagged.length >= 2) {
    merged.isEmergencyRedFlag = true;
    merged.redFlagTriggers.push(...flagged.flatMap(a => a.redFlagTriggers));
  } else if (!primary.isEmergencyRedFlag && flagged.length === 1) {
    merged.redFlagTriggers.push(...flagged[0].redFlagTriggers.map(t => `Possible (heard on a re-check, confirm with the patient): ${t}`));
  }
  merged.redFlagTriggers = [...new Set(merged.redFlagTriggers)];
  return merged;
}

function analyseOne(transcript: string, patientId?: string, abhaId?: string): TranscriptAnalysis {
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
  // An emergency breathing trigger already says it: drop the "oxygen to be checked" note beside it.
  if (extracted.redFlagTriggers?.some(t => /respiratory distress|difficulty breathing|low oxygen saturation/i.test(t))) {
    extracted.redFlagTriggers = extracted.redFlagTriggers.filter(t => !/oxygen saturation to be checked/i.test(t));
  }

  // Hopfield attractor recall over a 10-D indicator vector, built only from findings the patient affirmed
  // ("bukhar nahi hai" must not light up the fever dimension).
  const present = (re: RegExp) => extracted.symptoms.some(s => !s.isNegated && re.test(`${s.name} ${s.site || ''}`));
  const c = lexicon.concepts;
  const tempF = fahrenheit(extracted.vitals?.temp);
  const polyuria = present(/polyuria|frequent urination/i) || (c.has('S_URINE') && c.has('Q_FREQ'));
  const polydipsia = present(/polydipsia/i) || c.has('F_THIRST');
  const featureVector = [
    present(/chest|substernal|angina/i) || (c.has('S_CHEST') && (c.has('F_PAIN') || c.has('F_PRESSURE'))),
    false,
    present(/diaphoresis/i) || c.has('F_SWEAT'),
    present(/crepitus|knee/i),
    present(/stiffness|stambha/i) || c.has('F_STIFF'),
    present(/fever|jwara/i) || (tempF !== null && tempF > 100.4),
    present(/cough|kasa/i),
    polyuria || polydipsia,
    // "पैरों में जलन" / "pairo me jalan": पैर is foot or leg
    present(/burning feet|pada daha/i) || ((c.has('S_FOOT') || c.has('S_HEEL')) && c.has('F_BURN')),
    present(/joint inflammation|sandhishotha/i) || ((c.has('S_JOINT') || c.has('S_KNEE')) && c.has('F_SWELL'))
  ].map(Number);
  // radiation to the left arm only counts together with chest symptoms
  featureVector[1] = featureVector[0] && (present(/left arm/i) || (c.has('S_ARM') && c.has('Q_LEFT'))) ? 1 : 0;

  // Independent findings behind the active dimensions: polyuria and polydipsia share one dimension but are two findings.
  const activeFeatures = featureVector.filter(v => v > 0).length + (polyuria && polydipsia ? 1 : 0);
  const recall = HopfieldAssociativeService.recallAttractor(featureVector);
  // A syndrome match from a single finding is noise, not evidence — don't report it.
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
