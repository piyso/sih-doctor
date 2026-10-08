/**
 * Shared vital-sign parsing and interpretation for the kiosk and the doctor desk.
 * Ranges are adult resting reference ranges used only to colour feedback — not for diagnosis.
 */
import { VitalsData } from '../types/api';

export type VitalStatus = 'empty' | 'invalid' | 'normal' | 'low' | 'veryLow' | 'high' | 'veryHigh' | 'fever';

export const VITAL_LIMITS = {
  sys: [50, 260],
  dia: [30, 160],
  pulse: [25, 220],
  spo2: [50, 100],
  temp: [90, 110]
} as const;

const inRange = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;

export const parseNumber = (raw: string | number | undefined | null): number | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const parseBp = (bp?: string): { sys: number | null; dia: number | null } => {
  const [s, d] = (bp || '').split('/');
  return { sys: parseNumber(s), dia: parseNumber(d) };
};

/** Accepts °F or °C (values 30–45 are treated as Celsius) and returns °F. */
export const normaliseTempF = (raw: string | number | undefined | null): number | null => {
  const n = parseNumber(raw);
  if (n === null) return null;
  if (n >= 30 && n <= 45) return Math.round((n * 9 / 5 + 32) * 10) / 10;
  return n;
};

export const sysStatus = (n: number | null): VitalStatus =>
  n === null ? 'empty' : !inRange(n, VITAL_LIMITS.sys) ? 'invalid' : n < 80 ? 'veryLow' : n < 90 ? 'low' : n < 140 ? 'normal' : n < 180 ? 'high' : 'veryHigh';

export const diaStatus = (n: number | null): VitalStatus =>
  n === null ? 'empty' : !inRange(n, VITAL_LIMITS.dia) ? 'invalid' : n < 60 ? 'low' : n < 90 ? 'normal' : n < 120 ? 'high' : 'veryHigh';

export const pulseStatus = (n: number | null): VitalStatus =>
  n === null ? 'empty' : !inRange(n, VITAL_LIMITS.pulse) ? 'invalid' : n < 40 ? 'veryLow' : n < 50 ? 'low' : n <= 100 ? 'normal' : n <= 130 ? 'high' : 'veryHigh';

export const spo2Status = (n: number | null): VitalStatus =>
  n === null ? 'empty' : !inRange(n, VITAL_LIMITS.spo2) ? 'invalid' : n < 92 ? 'veryLow' : n < 95 ? 'low' : 'normal';

export const tempStatus = (f: number | null): VitalStatus =>
  f === null ? 'empty' : !inRange(f, VITAL_LIMITS.temp) ? 'invalid' : f < 95 ? 'low' : f < 99.5 ? 'normal' : f < 100.4 ? 'high' : f < 103 ? 'fever' : 'veryHigh';

export const bpStatus = (sys: number | null, dia: number | null): VitalStatus => {
  const s = sysStatus(sys);
  const d = diaStatus(dia);
  if (s === 'empty' && d === 'empty') return 'empty';
  if (s === 'invalid' || d === 'invalid' || s === 'empty' || d === 'empty') return 'invalid';
  if (sys !== null && dia !== null && sys <= dia) return 'invalid';
  const rank: VitalStatus[] = ['veryLow', 'veryHigh', 'low', 'high', 'normal'];
  return rank.find(r => r === s || r === d) || 'normal';
};

export const isCritical = (status: VitalStatus) => status === 'veryLow' || status === 'veryHigh';
export const isAbnormal = (status: VitalStatus) => status !== 'normal' && status !== 'empty' && status !== 'invalid';

export const STATUS_TONE: Record<VitalStatus, string> = {
  empty: 'text-muted-foreground bg-muted/60 border-border',
  invalid: 'text-rose-700 bg-rose-500/10 border-rose-500/40 dark:text-rose-300',
  normal: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/40 dark:text-emerald-300',
  low: 'text-amber-800 bg-amber-500/10 border-amber-500/40 dark:text-amber-200',
  high: 'text-amber-800 bg-amber-500/10 border-amber-500/40 dark:text-amber-200',
  fever: 'text-orange-800 bg-orange-500/10 border-orange-500/40 dark:text-orange-200',
  veryLow: 'text-rose-700 bg-rose-500/15 border-rose-500/50 dark:text-rose-300',
  veryHigh: 'text-rose-700 bg-rose-500/15 border-rose-500/50 dark:text-rose-300'
};

/** Overall picture of a vitals record (for queue badges / summaries). */
export const summariseVitals = (v: VitalsData = {}) => {
  const { sys, dia } = parseBp(v.bp);
  const statuses = {
    bp: bpStatus(sys, dia),
    pulse: pulseStatus(parseNumber(v.pulse)),
    spo2: spo2Status(parseNumber(v.spo2)),
    temp: tempStatus(normaliseTempF(v.temp))
  };
  const values = Object.values(statuses);
  return {
    statuses,
    anyRecorded: values.some(s => s !== 'empty'),
    anyCritical: values.some(isCritical),
    anyAbnormal: values.some(isAbnormal)
  };
};
