/**
 * Ranks kiosk symptom cards against what the patient said or typed (Hindi, Hinglish, English).
 *
 * Every card is tagged with concepts from its own English + Hindi label and its body-map area, using the
 * same lexicon as the patient's words (clinicalLexicon.ts). Ranking is a weighted cosine over concepts:
 * rarer concepts count more, body sites and findings count more than qualifiers. Deterministic, offline,
 * explainable — the matched concepts are returned with every suggestion.
 *
 * Suggestions are only ever shown for the patient to confirm by tapping; nothing is added on its own.
 */
import { conceptMentions, conceptTypeWeight, extractConcepts, NEVER_NEGATED } from './clinicalLexicon';
import { KioskSymptom, PRIVATE_SYMPTOMS, REGIONAL_SYMPTOMS, SYSTEMIC_SYMPTOMS } from './kioskSymptomCatalog';

/** Concepts implied by a body-map area (applied at half weight). */
export const REGION_CONCEPTS: Record<string, string> = {
  'Head': 'S_HEAD', 'Face & Sinus': 'S_FACE', 'Ear': 'S_EAR', 'Neck': 'S_NECK S_THROAT', 'Cervical Spine': 'S_NECK',
  'Left Chest / Precordium': 'S_CHEST S_HEART Q_LEFT', 'Right Chest': 'S_CHEST Q_RIGHT', 'Lungs & Respiration': 'S_CHEST S_BREATH',
  'Epigastrium': 'S_STOMACH Q_UPPER', 'Umbilicus / Mid-Abdomen': 'S_STOMACH', 'Right Lower Quadrant (RLQ)': 'S_STOMACH Q_RIGHT Q_LOWER',
  'Left Lower Quadrant (LLQ)': 'S_STOMACH Q_LEFT Q_LOWER', 'Pelvic / Hypogastrium': 'S_STOMACH Q_LOWER', 'Upper Back / Thoracic': 'S_BACK Q_UPPER',
  'Lumbar Spine (Kati)': 'S_LOWBACK S_BACK Q_LOWER', 'Sacral / Sciatica Origin': 'S_LOWBACK S_HIP', 'Sciatic Pathway / Calves': 'S_LEG S_FOOT',
  'Left Shoulder': 'S_SHOULDER', 'Right Shoulder': 'S_SHOULDER', 'Left Arm': 'S_ARM', 'Right Arm': 'S_ARM', 'Left Hand': 'S_ARM S_FINGER',
  'Right Hand': 'S_ARM S_FINGER', 'Left Hip': 'S_HIP', 'Right Hip': 'S_HIP', 'Left Knee': 'S_KNEE', 'Right Knee': 'S_KNEE',
  'Left Leg': 'S_LEG', 'Right Leg': 'S_LEG', 'Left Foot': 'S_FOOT S_HEEL', 'Right Foot': 'S_FOOT S_HEEL'
};

export interface CatalogEntry { symptom: KioskSymptom; regions: string[] }

/** Every card in the kiosk catalog once, with the body-map areas it appears under. */
export function kioskCatalog(): CatalogEntry[] {
  const byEn = new Map<string, CatalogEntry>();
  const put = (s: KioskSymptom, region?: string) => {
    const e = byEn.get(s.en) || { symptom: s, regions: [] };
    if (region && !e.regions.includes(region)) e.regions.push(region);
    byEn.set(s.en, e);
  };
  Object.entries(REGIONAL_SYMPTOMS).forEach(([r, list]) => list.forEach(s => put(s, r)));
  Object.values(SYSTEMIC_SYMPTOMS).forEach(list => list.forEach(s => put(s)));
  PRIVATE_SYMPTOMS.forEach(s => put(s));
  return [...byEn.values()];
}

export interface SymptomMatch { symptom: KioskSymptom; score: number; matched: string[] }

export class SymptomMatcher {
  private tags: Array<Map<string, number>>;
  private weight = new Map<string, number>();

  constructor(private entries: CatalogEntry[]) {
    this.tags = entries.map(({ symptom, regions }) => {
      const t = new Map<string, number>();
      extractConcepts(`${symptom.en} . ${symptom.hi}`, { ignoreNegation: true }).forEach(c => t.set(c, 1));
      regions.forEach(r => (REGION_CONCEPTS[r] || '').split(' ').filter(Boolean).forEach(c => { if (!t.has(c)) t.set(c, 0.5); }));
      return t;
    });
    const df = new Map<string, number>();
    this.tags.forEach(t => t.forEach((_, c) => df.set(c, (df.get(c) || 0) + 1)));
    const n = entries.length;
    df.forEach((v, c) => this.weight.set(c, conceptTypeWeight(c) * Math.log(1 + n / v)));
  }

  /** Cards ranked by similarity to the text; `onlyEn` restricts to a set of cards (e.g. the tapped area). */
  rank(text: string, opts: { onlyEn?: Set<string>; limit?: number } = {}): SymptomMatch[] {
    const q = extractConcepts(text);
    // Findings the patient explicitly denied ("बुखार नहीं है"): a card built around one is pushed down.
    const denied = new Set(conceptMentions(text).filter(m => m.negated).flatMap(m => m.concepts)
      .filter(c => c.startsWith('F_') && !NEVER_NEGATED(c) && !q.has(c)));
    const w = (c: string) => this.weight.get(c) || 0;
    const qNorm = Math.sqrt([...q].reduce((a, c) => a + w(c) ** 2, 0)) || 1;
    const out: SymptomMatch[] = [];
    this.entries.forEach((e, i) => {
      if (opts.onlyEn && !opts.onlyEn.has(e.symptom.en)) return;
      const t = this.tags[i];
      let dot = 0;
      const matched: string[] = [];
      q.forEach(c => { const tw = t.get(c); if (tw) { dot += w(c) ** 2 * tw; if (w(c) > 0) matched.push(c); } });
      const tNorm = Math.sqrt([...t].reduce((a, [c, tw]) => a + (w(c) * tw) ** 2, 0)) || 1;
      const contradicted = [...denied].some(c => (t.get(c) || 0) >= 1);
      out.push({ symptom: e.symptom, score: (dot / (qNorm * tNorm)) * (contradicted ? 0.5 : 1), matched });
    });
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, opts.limit ?? out.length);
  }
}

let shared: SymptomMatcher | null = null;
export const kioskSymptomMatcher = () => (shared ||= new SymptomMatcher(kioskCatalog()));

/** Minimum score for a card to be offered as a suggestion (tuned on edge-ai/eval/cases.json). */
export const SUGGEST_MIN_SCORE = 0.3;
