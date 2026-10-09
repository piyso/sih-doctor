/**
 * Beta-Binomial evidence engine for interaction beliefs.
 *
 * Model: the probability θ that a given pair (drug, herb) interacts is given a Beta(α0, β0) prior.
 * Each observation is a Bernoulli signal ("reinforce" = interaction observed / confirmed,
 * "contradict" = safe co-use observed) weighted by a power-prior exponent
 * w = reliability × methodWeight × 0.5^(age / halfLife), so weak or old evidence counts less than
 * one full observation (Ibrahim & Chen, 2000, "Power prior distributions for regression models").
 *
 * Posterior: Beta(α0 + Σw_reinforce, β0 + Σw_contradict). Reported quantities:
 *   - expectedConfidence  E[θ] = α / (α + β)
 *   - variance            αβ / ((α+β)²(α+β+1))
 *   - credibleInterval95  normal approximation, clipped to [0, 1]
 *   - bayesFactor         Savage–Dickey density ratio BF10 for H0: θ = 0.5 against the flat
 *                         Beta(1, 1) reference prior: BF10 = p_prior(0.5) / p_posterior(0.5) = 1 / Beta(0.5; α, β).
 *                         (Dickey & Lientz 1970; Wagenmakers et al. 2010.) BF10 > 1 means the data
 *                         moved belief away from "coin-flip", in either direction; see `direction`.
 *   - isStatisticallySignificant  BF10 ≥ 3, Jeffreys' "substantial" evidence.
 *
 * Nothing here fabricates observations. With no observations the posterior equals the prior and
 * BF10 reflects only how informative the prior itself is relative to Beta(1, 1).
 */

export type EvidenceMethod =
  | 'clinical_trial'
  | 'pharmacovigilance'
  | 'user_explicit'
  | 'operator_attested'
  | 'llm_extraction'
  | 'heuristic_nlp'
  | 'registry_prior';

export interface BayesianObservation {
  id: string;
  itemA: string;
  itemB: string;
  signal: 'reinforce' | 'contradict';
  sourceReliability: number; // [0.0 - 1.0]
  method: EvidenceMethod;
  createdAt: string; // ISO 8601
}

export interface PosteriorDistribution {
  itemA: string;
  itemB: string;
  priorAlpha: number;
  priorBeta: number;
  alpha: number;
  beta: number;
  expectedConfidence: number;
  variance: number;
  credibleInterval95: [number, number];
  bayesFactor: number;
  bayesFactorMethod: 'savage-dickey';
  nullHypothesis: 'theta=0.5';
  direction: 'interaction' | 'safe' | 'undetermined';
  isStatisticallySignificant: boolean;
  totalObservations: number;
  effectiveObservations: number;
}

export interface PosteriorOptions {
  /** Prior pseudo-counts. Default Beta(1, 1): no opinion. */
  prior?: { alpha: number; beta: number };
  /** Evidence half-life in days for the time-decay weight. Default 180. */
  halfLifeDays?: number;
  /** Reference time for decay (tests pass a fixed value). */
  now?: number;
  /** Most recent observations considered. Default 50. */
  window?: number;
}

export const METHOD_WEIGHTS: Record<EvidenceMethod, number> = {
  clinical_trial: 1.0,
  pharmacovigilance: 0.95,
  user_explicit: 0.9,
  operator_attested: 0.85,
  registry_prior: 0.8,
  llm_extraction: 0.5,
  heuristic_nlp: 0.4
};

/** Lanczos approximation of ln Γ(x), accurate to ~1e-10 for x > 0. */
export function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export const logBeta = (a: number, b: number): number => logGamma(a) + logGamma(b) - logGamma(a + b);

/** Beta(α, β) density at x. */
export function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

export class TruthEngine {
  static readonly DEFAULT_HALF_LIFE_DAYS = 180;
  static readonly WINDOW = 50;
  static readonly SIGNIFICANCE_BF = 3;

  static computePosterior(itemA: string, itemB: string, observations: BayesianObservation[], options: PosteriorOptions | boolean = {}): PosteriorDistribution {
    const opts: PosteriorOptions = typeof options === 'boolean' ? {} : options;
    const prior = opts.prior && opts.prior.alpha > 0 && opts.prior.beta > 0 ? opts.prior : { alpha: 1, beta: 1 };
    const halfLife = opts.halfLifeDays || this.DEFAULT_HALF_LIFE_DAYS;
    const now = opts.now ?? Date.now();
    const recent = [...(observations || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, opts.window || this.WINDOW);

    let alpha = prior.alpha;
    let beta = prior.beta;
    let effective = 0;
    for (const o of recent) {
      const ageDays = Math.max(0, now - new Date(o.createdAt).getTime()) / 86400000;
      const decay = Math.pow(0.5, ageDays / halfLife);
      const reliability = Math.max(0, Math.min(1, Number(o.sourceReliability) || 0));
      const w = reliability * (METHOD_WEIGHTS[o.method] ?? 0.4) * decay;
      if (w <= 0) continue;
      effective += w;
      if (o.signal === 'reinforce') alpha += w; else beta += w;
    }

    const n = alpha + beta;
    const mean = alpha / n;
    const variance = (alpha * beta) / (n * n * (n + 1));
    const sd = Math.sqrt(variance);
    const lo = Math.max(0, mean - 1.96 * sd);
    const hi = Math.min(1, mean + 1.96 * sd);
    const bf10 = 1 / betaPdf(0.5, alpha, beta); // prior density at 0.5 under Beta(1,1) is exactly 1
    const direction: PosteriorDistribution['direction'] = lo > 0.5 ? 'interaction' : hi < 0.5 ? 'safe' : 'undetermined';

    return {
      itemA,
      itemB,
      priorAlpha: prior.alpha,
      priorBeta: prior.beta,
      alpha: parseFloat(alpha.toFixed(4)),
      beta: parseFloat(beta.toFixed(4)),
      expectedConfidence: parseFloat(mean.toFixed(4)),
      variance: parseFloat(variance.toFixed(6)),
      credibleInterval95: [parseFloat(lo.toFixed(4)), parseFloat(hi.toFixed(4))],
      bayesFactor: parseFloat(bf10.toFixed(3)),
      bayesFactorMethod: 'savage-dickey',
      nullHypothesis: 'theta=0.5',
      direction,
      isStatisticallySignificant: bf10 >= this.SIGNIFICANCE_BF,
      totalObservations: (observations || []).length,
      effectiveObservations: parseFloat(effective.toFixed(3))
    };
  }
}

export type ITruthEngine = typeof TruthEngine;
