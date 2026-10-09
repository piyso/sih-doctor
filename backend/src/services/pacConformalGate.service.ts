/**
 * Suggestion gate (split conformal). Thin wrapper over core/pacConformalGate.engine.ts so callers
 * have one import; see that file for the mathematics and the calibration file format.
 */

export { PACConformalGate as PACConformalGateService, loadCalibration } from './core/pacConformalGate.engine';
export type { PACGateInput, PACGateEvaluation } from './core/pacConformalGate.engine';
