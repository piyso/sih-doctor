/**
 * Resolves what a prescriber typed ("Tab. Dolo 650", "Amoxycillin 500mg", "Telma-H",
 * "Aceclofenac 100 + Paracetamol 325", "Yograj Guggulu") into ingredients the rules understand.
 * Matching is whole-name / whole-word only: "dolo" never matches inside another word. A small
 * edit-distance step catches one-letter misspellings of long generic names. Anything that cannot
 * be resolved is reported, never guessed.
 */

import { DRUG_CONCEPTS, DrugConcept, drugById } from './drugDictionary';
import { AYUSH_FORMULATIONS, AYUSH_INGREDIENTS, AyushFlag, AyushFormulation, formulationFlags } from './ayushDictionary';
import { normaliseIngredient, splitCombination } from './bannedFdc';
import { strengthFromName } from './sig';

const NEGATION = /(?:^|[^\p{L}])(?:no|not|stopped|discontinued|never|without|allergic to|nahi|nahin|band|bandh|chhod|नहीं|बंद|छोड़)(?=[^\p{L}]|$)/iu;

const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|susp|suspension|inj|injection|drops?|cream|ointment|gel|sachet|dt|er|sr|xl|cr|mr|od tab|kid|kids|lotion|inhaler|rotacap|respule|vati|tablet\.)\b|\b(tab|cap|syp|inj)\.|\./gi;

export function cleanName(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu|%)\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(FORM_WORDS, ' ')
    .replace(/[^a-zऀ-ॿ+\-' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Allopathic index ────────────────────────────────────────────────────────
const ALLO_INDEX = new Map<string, string>(); // normalised name -> concept id
const addKey = (k: string, id: string) => { const key = cleanName(k); if (key && !ALLO_INDEX.has(key)) ALLO_INDEX.set(key, id); };
for (const c of DRUG_CONCEPTS) {
  addKey(c.id.replace(/_/g, ' '), c.id);
  addKey(c.inn, c.id);
  const inParens = c.inn.match(/\(([^)]+)\)/);
  if (inParens) addKey(inParens[1], c.id);
  for (const s of c.synonyms || []) addKey(s, c.id);
}
const ALLO_KEYS_BY_LENGTH = Array.from(ALLO_INDEX.keys()).sort((a, b) => b.length - a.length);
const SINGLE_WORD_KEYS = Array.from(ALLO_INDEX.keys()).filter(k => !k.includes(' ') && k.length >= 6);

function editDistanceAtMost1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function lookupAllo(name: string): string | undefined {
  const key = cleanName(name);
  if (!key) return undefined;
  const exact = ALLO_INDEX.get(key);
  if (exact) return exact;
  // Longest whole-word key inside the text ("tab dolo sr" -> "dolo").
  const padded = ` ${key.replace(/[+\-]/g, ' ')} `;
  for (const k of ALLO_KEYS_BY_LENGTH) {
    if (k.length < 3) continue;
    if (padded.includes(` ${k.replace(/[+\-]/g, ' ')} `)) return ALLO_INDEX.get(k);
  }
  // One-letter misspelling of a long single-word name.
  for (const token of key.split(/[\s+\-]+/)) {
    if (token.length < 6) continue;
    const hit = SINGLE_WORD_KEYS.find(k => editDistanceAtMost1(token, k));
    if (hit) return ALLO_INDEX.get(hit);
  }
  return undefined;
}

// ── Ayush index ─────────────────────────────────────────────────────────────
const FORMULATION_INDEX = new Map<string, AyushFormulation>();
for (const f of AYUSH_FORMULATIONS) {
  for (const k of [f.name, ...f.aliases]) {
    const key = cleanName(k);
    if (key && !FORMULATION_INDEX.has(key)) FORMULATION_INDEX.set(key, f);
  }
}
const FORMULATION_KEYS = Array.from(FORMULATION_INDEX.keys()).sort((a, b) => b.length - a.length);
const INGREDIENT_INDEX = new Map<string, string>();
for (const i of AYUSH_INGREDIENTS) for (const k of [i.name, i.id.replace(/_/g, ' '), ...i.aliases]) { const key = cleanName(k); if (key && !INGREDIENT_INDEX.has(key)) INGREDIENT_INDEX.set(key, i.id); }
const INGREDIENT_KEYS = Array.from(INGREDIENT_INDEX.keys()).sort((a, b) => b.length - a.length);

export interface ResolvedComponent {
  conceptId?: string;
  name: string;
  normalised: string;
  strengthMg?: number;
}

export interface ResolvedLine {
  index: number;
  raw: string;
  kind: 'allopathic' | 'ayush' | 'diet';
  role: 'prescribed' | 'ongoing' | 'reported';
  negated: boolean;
  components: ResolvedComponent[];
  /** Resolved concept ids of every component (allopathic). */
  conceptIds: string[];
  unresolved: string[];
  ayush?: { formulation?: AyushFormulation; name: string; constituents: string[]; flags: Set<AyushFlag>; external: boolean; compositionKnown: boolean };
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  route?: string;
  indication?: string;
  anupana?: string;
}

const nameOf = (it: any, keys: string[]): string => {
  if (typeof it === 'string') return it;
  for (const k of keys) if (typeof it?.[k] === 'string' && it[k].trim()) return it[k];
  return '';
};

export function resolveAllopathicLine(item: any, index: number, role: ResolvedLine['role']): ResolvedLine {
  const raw = nameOf(item, ['name', 'drugName', 'genericName', 'brandName']);
  const generic = typeof item === 'object' ? String(item?.genericName || '') : '';
  const line: ResolvedLine = {
    index, raw, kind: 'allopathic', role, negated: NEGATION.test(raw), components: [], conceptIds: [], unresolved: [],
    dosage: typeof item === 'object' ? item?.dosage : undefined,
    frequency: typeof item === 'object' ? item?.frequency : undefined,
    durationDays: typeof item === 'object' ? Number(item?.durationDays) || undefined : undefined,
    route: typeof item === 'object' ? item?.route : undefined,
    indication: typeof item === 'object' ? (item?.indication || undefined) : undefined
  };
  if (!raw.trim()) return line;

  const pushConcept = (c: DrugConcept, name: string, strengthMg?: number, strengthsKnown = true) => {
    if (c.ingredients?.length) {
      c.ingredients.forEach((ing, i) => {
        const comp = drugById(ing);
        if (comp) { line.components.push({ conceptId: comp.id, name: comp.inn, normalised: normaliseIngredient(comp.inn), strengthMg: strengthsKnown ? c.fdcStrengthsMg?.[i] : undefined }); line.conceptIds.push(comp.id); }
      });
      return;
    }
    line.components.push({ conceptId: c.id, name: c.inn, normalised: normaliseIngredient(c.inn), strengthMg });
    line.conceptIds.push(c.id);
  };

  // 1a. A combination product written by its generic name ("Amoxicillin + clavulanic acid") is one concept,
  //     unless the prescriber wrote strengths (then the parts are checked, e.g. against banned strengths).
  if (/\+/.test(raw) && !/\d/.test(raw)) {
    const exactId = ALLO_INDEX.get(cleanName(raw));
    const exact = exactId ? drugById(exactId) : undefined;
    // The generic name says nothing about strength, so the brand's usual strengths are not assumed.
    if (exact) { pushConcept(exact, raw, undefined, false); line.conceptIds = Array.from(new Set(line.conceptIds)); return line; }
  }
  // 1b. A combination written out ("Aceclofenac 100 + Paracetamol 325").
  if (/\+/.test(raw)) {
    for (const part of splitCombination(raw)) {
      const original = raw.split(/\s*\+\s*/).find(p => normaliseIngredient(p) === part.ingredient) || part.ingredient;
      const id = lookupAllo(original) || lookupAllo(part.ingredient);
      const c = id ? drugById(id) : undefined;
      if (c && !c.ingredients) {
        line.components.push({ conceptId: c.id, name: c.inn, normalised: part.ingredient, strengthMg: part.strengthMg });
        line.conceptIds.push(c.id);
      } else {
        line.components.push({ name: original.trim(), normalised: part.ingredient, strengthMg: part.strengthMg });
        line.unresolved.push(original.trim());
      }
    }
    line.conceptIds = Array.from(new Set(line.conceptIds));
    return line;
  }

  // 2. A single product name, then the generic field as a fallback.
  const id = lookupAllo(raw) || (generic ? lookupAllo(generic) : undefined);
  const c = id ? drugById(id) : undefined;
  if (c) {
    pushConcept(c, raw, strengthFromName(raw));
  } else if (generic && /\+/.test(generic)) {
    return { ...resolveAllopathicLine({ ...item, name: generic }, index, role), raw };
  } else {
    line.components.push({ name: raw.trim(), normalised: normaliseIngredient(raw) });
    line.unresolved.push(raw.trim());
  }
  line.conceptIds = Array.from(new Set(line.conceptIds));
  return line;
}

export function resolveAyushLine(item: any, index: number, role: ResolvedLine['role'], kind: 'ayush' | 'diet' = 'ayush'): ResolvedLine {
  const raw = nameOf(item, ['classicalName', 'formulationName', 'name', 'ayushHerb', 'herbName']);
  const line: ResolvedLine = {
    index, raw, kind, role, negated: NEGATION.test(raw), components: [], conceptIds: [], unresolved: [],
    dosage: typeof item === 'object' ? (item?.dose || item?.dosage) : undefined,
    frequency: typeof item === 'object' ? item?.frequency : undefined,
    durationDays: typeof item === 'object' ? Number(item?.durationDays) || undefined : undefined,
    anupana: typeof item === 'object' ? item?.anupana : undefined
  };
  const key = cleanName(raw);
  if (!key) return line;
  let formulation = FORMULATION_INDEX.get(key);
  if (!formulation) {
    const padded = ` ${key} `;
    const hit = FORMULATION_KEYS.find(k => k.length >= 4 && padded.includes(` ${k} `));
    if (hit) formulation = FORMULATION_INDEX.get(hit);
  }
  if (formulation) {
    line.ayush = { formulation, name: formulation.name, constituents: formulation.constituents, flags: formulationFlags(formulation), external: !!formulation.external, compositionKnown: true };
    return line;
  }
  // Not a known formulation: look for named single drugs inside the text ("Guggulu tablet").
  const padded = ` ${key} `;
  const found = new Set<string>();
  for (const k of INGREDIENT_KEYS) if (k.length >= 3 && padded.includes(` ${k} `)) found.add(INGREDIENT_INDEX.get(k)!);
  const flags = new Set<AyushFlag>();
  for (const id of found) for (const fl of AYUSH_INGREDIENTS.find(i => i.id === id)?.flags || []) flags.add(fl);
  // Asava/Arishta are fermented by definition, so the alcohol flag is certain from the name.
  if (/\b\w*(asava|arishta|asavam|arishtam)\b/.test(key)) flags.add('alcohol');
  const isExternal = /\b(taila|tailam|thailam|oil|lepa|malahara)\b/.test(key) && !/\b(internal|pana|orally)\b/.test(key);
  if (isExternal) flags.add('external_only');
  line.ayush = { name: raw.trim(), constituents: Array.from(found), flags, external: isExternal, compositionKnown: false };
  if (!found.size && !flags.size) line.unresolved.push(raw.trim());
  return line;
}

/** Display key for grouping (concept id, formulation id or cleaned name). */
export const lineKey = (l: ResolvedLine) => l.kind === 'allopathic' ? (l.conceptIds.join('+') || cleanName(l.raw)) : (l.ayush?.formulation?.id || cleanName(l.raw));

export { lookupAllo };
