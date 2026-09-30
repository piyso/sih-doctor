/**
 * PAC Conformal Gating & Emergency Triage Subsystem
 * Native PAC Conformal Gate Subsystem
 *
 * Scientific Basis:
 * Implements finite-sample distribution-free PAC (Probably Approximately Correct)
 * conformal calibration for hospital emergency triage safety guarantees.
 */

export interface PACGateEvaluation {
  allowFastpathEmission: boolean;
  nonConformityScore: number;
  epistemicSurprise: number;
  calibratedThreshold: number;
  recommendedPathway: 'EMIT_SOVEREIGN_FASTPATH' | 'TRIGGER_SENIOR_DOCTOR_ESCALATION';
  statisticalCoverageGuarantee: string; // e.g. "99.0% PAC Coverage Bound"
}

export interface PACGateInput {
  topCandidateConfidence: number;
  runnerUpConfidence: number;
  vitalsAnomalyCount?: number;
  retrievalScoreVariance?: number;
  alpha?: number; // default: 0.01 for 99% emergency coverage guarantee
}

const kernel = require('./sovereign-kernel.cjs');

export interface IPACConformalGate {
  evaluate(input: PACGateInput): PACGateEvaluation;
}

export const PACConformalGate: IPACConformalGate = kernel.PACConformalGate;
