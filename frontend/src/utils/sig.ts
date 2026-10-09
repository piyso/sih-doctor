/**
 * How a medicine is taken: Indian "1-0-1" notation (morning-noon-night counts) plus food timing,
 * and the quantity to dispense. Mirrors backend/src/services/safety/sig.ts.
 */

export type FoodTiming = '' | 'before food' | 'after food' | 'empty stomach' | 'with food';

export interface SigParts {
  /** Counts for morning, noon, night (and optional bedtime). */
  pattern: number[] | null;
  /** Free-form frequency when not written as 1-0-1 (SOS, weekly, every 6 hours…). */
  other: string;
  food: FoodTiming;
}

const FRACTION = (t: string): number => (t === '½' || t === '1/2' ? 0.5 : t === '¼' || t === '1/4' ? 0.25 : Number(t));

export function parseSig(frequency: string | undefined | null): SigParts {
  const f = String(frequency || '');
  const lower = f.toLowerCase();
  const food: FoodTiming = /empty\s*stomach|khali pet/.test(lower) ? 'empty stomach' : /before\s*(food|meal|breakfast)/.test(lower) ? 'before food' : /after\s*(food|meal)|post\s*(lunch|meal)/.test(lower) ? 'after food' : /with\s*(food|meal)/.test(lower) ? 'with food' : '';
  const m = lower.match(/(\d(?:\.\d)?|½|¼|1\/2)\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2)\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2)(?:\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2))?/);
  if (m) {
    const pattern = [m[1], m[2], m[3], m[4]].filter((x): x is string => x !== undefined).map(FRACTION);
    if (pattern.every(n => Number.isFinite(n))) return { pattern, other: '', food };
  }
  // Translate the Latin abbreviations into the pattern when unambiguous.
  if (/\bod\b|once daily|^once$/.test(lower) && !/week/.test(lower)) return { pattern: /night|hs|bedtime/.test(lower) ? [0, 0, 1] : [1, 0, 0], other: '', food };
  if (/\bhs\b|bedtime/.test(lower) && !/\bbd\b|twice/.test(lower)) return { pattern: [0, 0, 1], other: '', food };
  if (/\bbd\b|\bbid\b|twice/.test(lower)) return { pattern: [1, 0, 1], other: '', food };
  if (/\btds\b|\btid\b|thrice|three times/.test(lower)) return { pattern: [1, 1, 1], other: '', food };
  if (/\bqid\b|four times/.test(lower)) return { pattern: [1, 1, 1, 1], other: '', food };
  const other = f.replace(/\(?\s*(before|after|with)\s*(food|meal)s?\s*\)?|empty\s*stomach/ig, '').trim();
  return { pattern: null, other, food };
}

export function formatSig(parts: SigParts): string {
  const base = parts.pattern ? parts.pattern.map(n => (n === 0.5 ? '½' : String(n))).join('-') : parts.other;
  return [base, parts.food].filter(Boolean).join(' ').trim();
}

export function unitsPerDay(frequency: string): number | null {
  const p = parseSig(frequency);
  if (p.pattern) return p.pattern.reduce((a, b) => a + b, 0);
  const l = p.other.toLowerCase();
  if (/sos|as needed|when needed|prn/.test(l)) return null;
  if (/week/.test(l)) return 1 / 7;
  const h = l.match(/(?:every|q)\s*(\d{1,2})\s*h|(\d{1,2})\s*-?\s*hourly/);
  if (h) return 24 / Number(h[1] || h[2]);
  if (/single dose|once only|stat/.test(l)) return 1;
  return null;
}

/** Tablets/capsules to dispense; null when not computable (liquids, as-needed, unknown units). */
export function quantity(dosage: string, frequency: string, durationDays: number): number | null {
  if (!durationDays || durationDays <= 0) return null;
  const perDay = unitsPerDay(frequency);
  if (perDay === null) return null;
  const d = String(dosage || '').toLowerCase();
  if (/\bml\b|application|apply|external|puff|sachet in|drops?/.test(d)) return null;
  if (/single dose|once only/.test(String(frequency).toLowerCase())) {
    const n = d.match(/(\d+(?:\.\d+)?)\s*(tab|tablet|cap)/);
    return n ? Math.ceil(Number(n[1])) : 1;
  }
  const units = d.match(/(\d+(?:\.\d+)?)\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules)/);
  const perAdmin = units ? Number(units[1]) : 1;
  const p = parseSig(frequency);
  // With 1-0-1 the counts already are units; "2 tablets" with BD means 2 per dose.
  const total = p.pattern ? (units && perAdmin > 1 && p.pattern.every(x => x <= 1) ? perDay * perAdmin : perDay) * durationDays : perDay * perAdmin * durationDays;
  return Math.ceil(total);
}

export const PATTERN_LABELS = ['Morning', 'Noon', 'Night', 'Bedtime'];
