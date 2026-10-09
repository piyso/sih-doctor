/**
 * Suggestion gate built on split conformal prediction (see conformal.engine.ts).
 *
 * The gate answers one question: "is the top automated suggestion inside the conformal prediction
 * set at the configured α?" If the calibration set is missing or too small it abstains. Vitals
 * anomalies are handled by the deterministic triage rules (triage.service.ts), not here.
 *
 * The calibration file is produced by `npm run calibrate:conformal` from labelled gold cases and
 * lives in src/data/conformal_calibration.json; it records n, α, q̂ and the sorted scores so a
 * reviewer can recompute the threshold by hand.
 */

import fs from 'fs';
import path from 'path';
import { ConformalCalibration, ConformalEvaluation, calibrate, evaluate, nonconformityOf } from './conformal.engine';

export interface PACGateInput {
  topCandidateConfidence: number;
  runnerUpConfidence?: number;
  alpha?: number;
}

export interface PACGateEvaluation extends ConformalEvaluation {
  allowFastpathEmission: boolean;
  recommendedPathway: 'SHOW_SUGGESTION' | 'WITHHOLD_SUGGESTION';
  margin: number;
}

const CALIBRATION_PATHS = [
  path.resolve(__dirname, '../../data/conformal_calibration.json'),
  path.resolve(__dirname, '../../../src/data/conformal_calibration.json'),
  path.resolve(process.cwd(), 'src/data/conformal_calibration.json')
];

let loaded: ConformalCalibration | null | undefined;

export function loadCalibration(force = false): ConformalCalibration | null {
  if (loaded !== undefined && !force) return loaded;
  loaded = null;
  for (const p of CALIBRATION_PATHS) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as ConformalCalibration;
        if (Array.isArray(raw.scoresSorted) && Number.isFinite(raw.alpha)) {
          loaded = { ...calibrate(raw.scoresSorted, raw.alpha, raw.source), createdAt: raw.createdAt };
          break;
        }
      } catch { /* ignore a bad file; the gate abstains */ }
    }
  }
  return loaded;
}

export class PACConformalGate {
  static evaluate(input: PACGateInput, calibration: ConformalCalibration | null = loadCalibration()): PACGateEvaluation {
    const top = Math.max(0, Math.min(1, input.topCandidateConfidence));
    const runnerUp = Math.max(0, Math.min(1, input.runnerUpConfidence ?? 0));
    const cal = calibration && input.alpha && input.alpha !== calibration.alpha
      ? calibrate(calibration.scoresSorted, input.alpha, calibration.source)
      : calibration;
    const ev = evaluate(nonconformityOf(top), cal);
    return {
      ...ev,
      margin: parseFloat((top - runnerUp).toFixed(4)),
      allowFastpathEmission: ev.inPredictionSet,
      recommendedPathway: ev.inPredictionSet ? 'SHOW_SUGGESTION' : 'WITHHOLD_SUGGESTION'
    };
  }
}

export type IPACConformalGate = typeof PACConformalGate;
