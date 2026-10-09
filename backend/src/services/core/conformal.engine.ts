/**
 * Split conformal prediction for a scored suggestion (Vovk, Gammerman & Shafer 2005; Angelopoulos
 * & Bates 2021, "A Gentle Introduction to Conformal Prediction").
 *
 * Given n calibration nonconformity scores s_1..s_n computed on held-out labelled cases, and a
 * miscoverage level α, the threshold is the k-th smallest score with k = ⌈(n + 1)(1 − α)⌉. For a
 * new case whose true label has nonconformity s, P(s ≤ q̂) ≥ 1 − α holds under exchangeability.
 * When k > n the finite-sample bound cannot be met, the threshold is +∞ and the engine abstains
 * instead of pretending.
 *
 * Nonconformity used by the syndrome suggester: s = 1 − (softmax weight of the correct prototype).
 */

export interface ConformalCalibration {
  alpha: number;
  n: number;
  k: number;
  qHat: number; // +Infinity when the guarantee cannot be met with n
  guaranteed: boolean;
  empiricalCoverage: number; // fraction of calibration scores ≤ qHat (sanity, ≥ 1 − α when guaranteed)
  source: string;
  createdAt: string;
  scoresSorted: number[];
}

export interface ConformalEvaluation {
  inPredictionSet: boolean;
  nonconformityScore: number;
  qHat: number;
  alpha: number;
  n: number;
  guaranteed: boolean;
  coverageStatement: string;
}

export function calibrate(scores: number[], alpha: number, source = 'unspecified'): ConformalCalibration {
  const s = scores.filter(x => Number.isFinite(x)).map(x => Math.max(0, Math.min(1, x))).sort((a, b) => a - b);
  const n = s.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  const guaranteed = n > 0 && k <= n;
  const qHat = guaranteed ? s[k - 1] : Number.POSITIVE_INFINITY;
  const covered = guaranteed ? s.filter(x => x <= qHat).length / n : 0;
  return { alpha, n, k, qHat, guaranteed, empiricalCoverage: parseFloat(covered.toFixed(4)), source, createdAt: new Date().toISOString(), scoresSorted: s };
}

export function evaluate(nonconformityScore: number, cal: ConformalCalibration | null): ConformalEvaluation {
  const s = Math.max(0, Math.min(1, nonconformityScore));
  if (!cal || !cal.guaranteed) {
    return {
      inPredictionSet: false, nonconformityScore: s, qHat: Number.POSITIVE_INFINITY, alpha: cal?.alpha ?? NaN, n: cal?.n ?? 0, guaranteed: false,
      coverageStatement: cal ? `Uncalibrated: n=${cal.n} is too small for α=${cal.alpha} (needs n ≥ ${Math.ceil(1 / cal.alpha) - 1}); suggestion withheld.` : 'No calibration set loaded; suggestion withheld.'
    };
  }
  return {
    inPredictionSet: s <= cal.qHat,
    nonconformityScore: s,
    qHat: cal.qHat,
    alpha: cal.alpha,
    n: cal.n,
    guaranteed: true,
    coverageStatement: `Split-conformal set at α=${cal.alpha} from n=${cal.n} calibration cases (q̂=${cal.qHat.toFixed(4)}); marginal coverage ≥ ${((1 - cal.alpha) * 100).toFixed(0)}% under exchangeability.`
  };
}

/** Nonconformity for the top suggestion: distance of its weight from certainty. */
export const nonconformityOf = (weightOfLabel: number): number => 1 - Math.max(0, Math.min(1, weightOfLabel));
