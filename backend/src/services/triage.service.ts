/**
 * Vital-sign triage with the National Early Warning Score 2 (NEWS2).
 *
 * Source: Royal College of Physicians (2017), "National Early Warning Score (NEWS) 2: Standardising
 * the assessment of acute-illness severity in the NHS". Thresholds reproduced exactly:
 *
 *   Respiration /min   ≤8:3   9–11:1   12–20:0   21–24:2   ≥25:3
 *   SpO2 % (scale 1)   ≤91:3  92–93:2  94–95:1   ≥96:0
 *   Systolic BP mmHg   ≤90:3  91–100:2 101–110:1 111–219:0 ≥220:3
 *   Pulse /min         ≤40:3  41–50:1  51–90:0   91–110:1  111–130:2  ≥131:3
 *   Temperature °C     ≤35.0:3 35.1–36.0:1 36.1–38.0:0 38.1–39.0:1 ≥39.1:2
 *   Consciousness      Alert:0  C/V/P/U:3
 *   Supplemental O2    yes:2   no:0
 *
 * Aggregate 0–4 low; a 3 in any single parameter low-medium (urgent review); 5–6 medium (urgent
 * response); ≥7 high (emergency response). NEWS2 is validated for adults; for children the
 * service reports "not applicable" and leaves triage to the red-flag rules. Self-reported kiosk
 * vitals are scored but flagged unverified; a nurse confirms before the score is trusted.
 */

export interface VitalsInput {
  bp?: string | number;             // "150/95" or systolic number
  pulse?: number | string;
  spo2?: number | string;           // "96%" or 96
  temp?: number | string;           // "101 F", "38.5°C", 38.5 (C if < 50)
  respiratoryRate?: number | string;
  consciousness?: 'A' | 'C' | 'V' | 'P' | 'U' | string;
  onOxygen?: boolean;
}

export interface News2Parameter {
  parameter: 'respiration' | 'spo2' | 'systolic' | 'pulse' | 'temperature' | 'consciousness' | 'oxygen';
  value: number | string;
  score: 0 | 1 | 2 | 3;
}

export interface VitalsAssessment {
  applicable: boolean;
  reason?: string;
  news2: number;
  band: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';
  anySingleThree: boolean;
  parameters: News2Parameter[];
  missing: string[];
  complete: boolean;
  selfReported: boolean;
  suggestedPriority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
  clinicalResponse: string;
  reference: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function systolicOf(bp: unknown): number | null {
  if (bp === null || bp === undefined) return null;
  const s = String(bp);
  const m = s.match(/(\d{2,3})\s*(?:\/|by|बटा|\\)\s*(\d{2,3})/i);
  if (m) return parseInt(m[1], 10);
  const n = num(s);
  return n !== null && n >= 40 && n <= 300 ? n : null;
}

export function celsiusOf(temp: unknown): number | null {
  if (temp === null || temp === undefined || temp === '') return null;
  const s = String(temp);
  const m = s.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*([cf])?/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'f' || (!unit && v >= 50)) return parseFloat(((v - 32) * 5 / 9).toFixed(1));
  return v;
}

const score = (p: News2Parameter['parameter'], value: number | string, s: 0 | 1 | 2 | 3): News2Parameter => ({ parameter: p, value, score: s });

export function assessVitals(vitals: VitalsInput | null | undefined, opts: { selfReported?: boolean; age?: number | null; isPregnant?: boolean } = {}): VitalsAssessment {
  const selfReported = opts.selfReported !== false;
  const base = { parameters: [] as News2Parameter[], missing: [] as string[], selfReported, reference: 'RCP NEWS2 (2017)' };
  if (opts.age !== undefined && opts.age !== null && opts.age < 16) {
    return { ...base, applicable: false, reason: 'NEWS2 is validated for adults (16+); paediatric vitals are triaged by the red-flag rules.', news2: 0, band: 'LOW', anySingleThree: false, complete: false, suggestedPriority: 'ROUTINE', clinicalResponse: 'Use paediatric assessment.' };
  }
  const v = vitals || {};
  const params: News2Parameter[] = [];
  const missing: string[] = [];

  const rr = num(v.respiratoryRate);
  if (rr === null) missing.push('respiratoryRate');
  else params.push(score('respiration', rr, rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3));

  const sp = num(v.spo2);
  if (sp === null) missing.push('spo2');
  else params.push(score('spo2', sp, sp <= 91 ? 3 : sp <= 93 ? 2 : sp <= 95 ? 1 : 0));

  const sbp = systolicOf(v.bp);
  if (sbp === null) missing.push('bp');
  else params.push(score('systolic', sbp, sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3));

  const hr = num(v.pulse);
  if (hr === null) missing.push('pulse');
  else params.push(score('pulse', hr, hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3));

  const tc = celsiusOf(v.temp);
  if (tc === null) missing.push('temp');
  else params.push(score('temperature', tc, tc <= 35.0 ? 3 : tc <= 36.0 ? 1 : tc <= 38.0 ? 0 : tc <= 39.0 ? 1 : 2));

  const c = typeof v.consciousness === 'string' ? v.consciousness.trim().toUpperCase().charAt(0) : '';
  if (c) params.push(score('consciousness', c, c === 'A' ? 0 : 3));
  if (v.onOxygen === true) params.push(score('oxygen', 'supplemental', 2));

  const total = params.reduce((s, p) => s + p.score, 0);
  const anySingleThree = params.some(p => p.score === 3);
  const band: VitalsAssessment['band'] = total >= 7 ? 'HIGH' : total >= 5 ? 'MEDIUM' : anySingleThree ? 'LOW_MEDIUM' : 'LOW';
  const suggestedPriority: VitalsAssessment['suggestedPriority'] = band === 'HIGH' ? 'EMERGENCY_RED_FLAG' : band === 'MEDIUM' || band === 'LOW_MEDIUM' ? 'HIGH_PRIORITY' : 'ROUTINE';
  const response = band === 'HIGH' ? 'Emergency response: immediate clinician assessment.'
    : band === 'MEDIUM' ? 'Urgent response: clinician review within minutes.'
    : band === 'LOW_MEDIUM' ? 'Urgent ward-based review of the parameter scoring 3.'
    : 'Routine monitoring.';
  return {
    ...base,
    applicable: true,
    reason: opts.isPregnant ? 'NEWS2 thresholds are not validated in pregnancy; use obstetric judgement (MEOWS).' : undefined,
    news2: total,
    band,
    anySingleThree,
    parameters: params,
    missing,
    complete: missing.length === 0,
    suggestedPriority,
    clinicalResponse: `${response}${selfReported ? ' Vitals are patient-reported: verify before acting.' : ''}`
  };
}

const RANK = { ROUTINE: 0, HIGH_PRIORITY: 1, EMERGENCY_RED_FLAG: 2 } as const;

/** Never lowers an existing priority. */
export function raisePriority<T extends keyof typeof RANK>(current: T | string, suggested: keyof typeof RANK): keyof typeof RANK {
  const c = (current in RANK ? current : 'ROUTINE') as keyof typeof RANK;
  return RANK[suggested] > RANK[c] ? suggested : c;
}
