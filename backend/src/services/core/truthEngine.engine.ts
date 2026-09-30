/**
 * Beta-Binomial Bayesian Truth Engine
 * Native Truth Engine Subsystem
 *
 * Scientific Basis:
 * - Conjugate Beta-Binomial updating with observation windowing (N=50).
 * - Method-aware evidence weighting (Clinical trial: 0.99, Pharmacovigilance: 0.96, Heuristic: 0.70).
 * - Predicate-aware exponential temporal decay: decay = 0.5^(ageDays / halfLifeDays).
 * - Dual inertia clamping (C_inertia = 0.10, C_inertia_exclusive = 0.20) and C_prior = 0.30 floor.
 * - Savage-Dickey Bayes Factor calculation for hypothesis testing vs Null (H0: theta = 0.5).
 */

export type EvidenceMethod =
  | 'clinical_trial'
  | 'pharmacovigilance'
  | 'user_explicit'
  | 'operator_attested'
  | 'llm_extraction'
  | 'heuristic_nlp';

export interface BayesianObservation {
  id: string;
  itemA: string;
  itemB: string;
  signal: 'reinforce' | 'contradict'; // reinforce = confirms interaction; contradict = safe/no interaction
  sourceReliability: number; // [0.0 - 1.0]
  method: EvidenceMethod;
  createdAt: string; // ISO 8601
}

export interface PosteriorDistribution {
  itemA: string;
  itemB: string;
  alpha: number;
  beta: number;
  expectedConfidence: number; // E[theta] = alpha / (alpha + beta)
  variance: number;
  credibleInterval95: [number, number];
  bayesFactor: number; // Savage-Dickey density ratio vs H0 (theta = 0.5)
  isStatisticallySignificant: boolean; // BF10 >= 3.0 (substantial evidence)
  totalObservations: number;
}

const kernel = require('./sovereign-kernel.cjs');

export interface ITruthEngine {
  computePosterior(
    itemA: string,
    itemB: string,
    observations: BayesianObservation[],
    isExclusive?: boolean
  ): PosteriorDistribution;
}

export const TruthEngine: ITruthEngine = kernel.TruthEngine;
