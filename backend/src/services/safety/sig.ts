/**
 * Parses how a medicine is taken: Indian "1-0-1" notation (morning-noon-night tablet counts) and
 * the Latin abbreviations (OD, BD, TDS, QID, HS, SOS), plus dose strings like "500 mg" or "1 tab".
 * Used for daily-dose checks and for the quantity the pharmacy should dispense.
 */

export interface ParsedSig {
  /** Administrations per day (null when "as needed" or not understood). */
  timesPerDay: number | null;
  /** Units (tablets/capsules) per day from 1-0-1 notation, when given that way. */
  unitsPerDay?: number;
  /** Morning / noon / night (/ bedtime) counts when written as 1-0-1. */
  pattern?: number[];
  asNeeded: boolean;
  food?: 'before' | 'after' | 'empty_stomach' | 'with';
  timing?: string[];
  weekly?: boolean;
}

const FRACTION = (s: string): number => {
  const t = s.trim();
  if (t === '½' || t === '1/2') return 0.5;
  if (t === '¼' || t === '1/4') return 0.25;
  if (t === '1½' || t === '1 1/2') return 1.5;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function parseFrequency(text: string | undefined | null): ParsedSig {
  const f = String(text || '').toLowerCase();
  const out: ParsedSig = { timesPerDay: null, asNeeded: false };
  if (/before\s*(food|meal|breakfast|lunch|dinner)|\bac\b|khane se pehle|खाने से पहले/.test(f)) out.food = 'before';
  else if (/after\s*(food|meal|breakfast|lunch|dinner)|\bpc\b|post\s*(lunch|meal|dinner)|khane ke baad|खाने के बाद/.test(f)) out.food = 'after';
  else if (/empty\s*stomach|khali pet|खाली पेट/.test(f)) out.food = 'empty_stomach';
  else if (/with\s*(food|meal|milk)/.test(f)) out.food = 'with';
  const timing: string[] = [];
  if (/morning|subah|सुबह/.test(f)) timing.push('morning');
  if (/noon|afternoon|lunch|dopahar|दोपहर/.test(f)) timing.push('noon');
  if (/evening|shaam|शाम/.test(f)) timing.push('evening');
  if (/\bhs\b|bedtime|night|raat|रात/.test(f)) timing.push('night');
  if (timing.length) out.timing = timing;

  const m = f.match(/(\d(?:\.\d)?|½|¼|1\/2)\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2)\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2)(?:\s*[-–]\s*(\d(?:\.\d)?|½|¼|1\/2))?/);
  if (m) {
    const parts = [m[1], m[2], m[3], m[4]].filter((p): p is string => p !== undefined).map(FRACTION);
    if (parts.every(p => Number.isFinite(p) && p >= 0 && p <= 10)) {
      out.pattern = parts;
      out.unitsPerDay = parts.reduce((a, b) => a + b, 0);
      out.timesPerDay = parts.filter(p => p > 0).length;
      return out;
    }
  }
  if (/\bsos\b|\bprn\b|as needed|when needed|if needed|zaroorat|ज़रूरत/.test(f)) { out.asNeeded = true; return out; }
  if (/\bstat\b|single dose|once only/.test(f)) { out.timesPerDay = 1; return out; }
  if (/once\s*(a|per)?\s*week|weekly|\bow\b/.test(f)) { out.timesPerDay = 1 / 7; out.weekly = true; return out; }
  const hourly = f.match(/(?:every|q)\s*(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\b|(\d{1,2})\s*(?:-|\s)?hourly/);
  if (hourly) {
    const h = Number(hourly[1] || hourly[2]);
    if (h > 0 && h <= 24) { out.timesPerDay = Math.round((24 / h) * 100) / 100; return out; }
  }
  if (/\bqid\b|\bqds\b|four times|4 times/.test(f)) out.timesPerDay = 4;
  else if (/\btds\b|\btid\b|thrice|three times|3 times/.test(f)) out.timesPerDay = 3;
  else if (/\bbd\b|\bbid\b|twice|two times|2 times/.test(f)) out.timesPerDay = 2;
  else if (/\bod\b|\bqd\b|once|1 time|daily|\bhs\b|bedtime|at night/.test(f)) out.timesPerDay = 1;
  return out;
}

export interface ParsedDose {
  /** Amount per administration in mg, when stated in mass units. */
  mg?: number;
  /** Tablets/capsules/sachets per administration, when stated in units. */
  units?: number;
  /** Volume per administration in ml (syrups, decoctions). */
  ml?: number;
}

export function parseDose(text: string | undefined | null): ParsedDose {
  const s = String(text || '').toLowerCase().replace(/,/g, '.');
  const out: ParsedDose = {};
  const mass = s.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|gm|gram|grams)\b/);
  if (mass) {
    const v = Number(mass[1]);
    const u = mass[2];
    out.mg = u === 'g' || u === 'gm' || u.startsWith('gram') ? v * 1000 : u === 'mg' ? v : v / 1000;
  }
  const units = s.match(/(\d+(?:\.\d+)?|½|one|two|half)\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|sachet|sachets|pill|pills|vati|goli)\b/);
  if (units) {
    const word = units[1];
    out.units = word === 'one' ? 1 : word === 'two' ? 2 : word === 'half' || word === '½' ? 0.5 : Number(word);
  }
  const vol = s.match(/(\d+(?:\.\d+)?)\s*(ml|millilitre|milliliter)\b/);
  if (vol) out.ml = Number(vol[1]);
  return out;
}

/** Strength in mg written into a product name ("Paracetamol 650", "Metformin 500 SR"). */
export function strengthFromName(name: string): number | undefined {
  const m = String(name || '').match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)?\b/i);
  if (!m) return undefined;
  const v = Number(m[1]);
  const unit = (m[2] || 'mg').toLowerCase();
  if (unit === 'g') return v * 1000;
  if (unit === 'mcg') return v / 1000;
  return v;
}

/**
 * Daily dose in mg for one single-ingredient line, or undefined when it cannot be worked out
 * honestly (as-needed, units without a known strength, liquids without concentration).
 */
export function dailyDoseMg(dosage: string | undefined, frequency: string | undefined, nameStrengthMg?: number): number | undefined {
  const sig = parseFrequency(frequency);
  const dose = parseDose(dosage);
  if (sig.asNeeded) return undefined;
  if (sig.unitsPerDay !== undefined) {
    // 1-0-1: counts are units; the dose field (or the name) carries the strength of one unit.
    const perUnit = dose.mg ?? nameStrengthMg;
    if (perUnit === undefined) return undefined;
    return sig.unitsPerDay * perUnit;
  }
  if (sig.timesPerDay === null) return undefined;
  if (dose.mg !== undefined) {
    // "2 tablets (500 mg)" means two tablets of 500 mg when both are written.
    const each = dose.units && dose.units > 1 && /\(\s*\d/.test(String(dosage)) ? dose.mg * dose.units : dose.mg;
    return each * sig.timesPerDay;
  }
  if (dose.units !== undefined && nameStrengthMg !== undefined) return dose.units * nameStrengthMg * sig.timesPerDay;
  return undefined;
}

/** Units to dispense for a course (tablets), when it can be computed. */
export function quantityToDispense(dosage: string | undefined, frequency: string | undefined, durationDays: number | undefined): number | undefined {
  if (!durationDays || durationDays <= 0) return undefined;
  const sig = parseFrequency(frequency);
  if (sig.asNeeded) return undefined;
  if (sig.unitsPerDay !== undefined) return Math.ceil(sig.unitsPerDay * durationDays);
  const dose = parseDose(dosage);
  if (sig.timesPerDay !== null) {
    const units = dose.units ?? (dose.mg !== undefined || dose.ml !== undefined ? 1 : undefined);
    if (units === undefined || dose.ml !== undefined) return undefined;
    return Math.ceil(units * sig.timesPerDay * durationDays);
  }
  return undefined;
}
