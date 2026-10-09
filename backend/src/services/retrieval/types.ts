/**
 * Encrypted similar-case retrieval: shared types.
 *
 * This module is the first working embodiment, inside the hospital OS, of the pending patent
 * application "Adaptive Distributed Memory Retrieval Apparatus with Reinforcement Learning"
 * (Indian application 202531095594, PCT/IN2026/052065). It implements the guarded arbitration of
 * claims 8 and 20 (latency-predicted mode choice, prospective enclave-ratio guard, secure-memory
 * guard), the two-stage retrieval of claim 19 (coarse search over quantized vectors, full-precision
 * re-ranking in the chosen mode, packed CKKS evaluation), the noise-floor admission check of claims
 * 11 and 21, the predictor release gate of claim 13, the tier override of claim 15 and in-enclave
 * score smudging of claim 21.
 *
 * What it is NOT (stated so nobody oversells it): there is no hardware enclave on this host, so the
 * "enclave mode" is a software-isolated worker thread; there is one peer node (this facility); the
 * orchestrator also holds the client key; the mode-switching threshold is fixed (the basic embodiment)
 * rather than tuned by a reinforcement-learning agent; there is no zero-knowledge proof of enclave
 * results and no attested telemetry. See docs/RETRIEVAL_LAYER.md.
 */

export type CaseSource = 'encounter' | 'session' | 'reference';
export type CareStream = 'AYURVEDA' | 'ALLOPATHY' | 'UNDECIDED' | string;
export type ConfidentialityTier = 1 | 2;
export type ExecMode = 'HE' | 'ISOLATED';

/** A de-identified case: what the index stores and what a result may show a clinician. */
export interface CaseRecord {
  id: string;
  source: CaseSource;
  department: string;
  careStream: CareStream;
  ageBand: string;
  sex: string;
  symptoms: string[];
  sites: string[];
  diagnoses: string[];
  medicines: string[];
  investigations: string[];
  redFlags: string[];
  /** ISO month, e.g. 2026-09; never a full timestamp, so results cannot be matched to a visit. */
  month: string;
  tier: ConfidentialityTier;
}

/** The query side of a search; the same fields a case has, all optional. */
export interface CaseQuery {
  department?: string;
  careStream?: CareStream;
  ageBand?: string;
  sex?: string;
  symptoms?: string[];
  sites?: string[];
  diagnoses?: string[];
  medicines?: string[];
  investigations?: string[];
  redFlags?: string[];
  complaintText?: string;
  tier?: ConfidentialityTier;
}

export interface GuardFlags {
  /** Highest-confidentiality shard: homomorphic mode irrespective of latency (claim 15). */
  tierOverride: boolean;
  /** Prospective enclave-ratio guard changed the candidate mode (claims 8, 20). */
  enclaveRatio: boolean;
  /** Prospective secure-memory guard changed the candidate mode (claim 9). */
  secureMemory: boolean;
  /** The chosen mode was not available on this host and the other mode was used instead. */
  availabilityFallback: boolean;
}

export interface ArbitrationDecision {
  mode: ExecMode;
  candidateMode: ExecMode;
  predictedHeMs: number | null;
  thresholdMs: number;
  predictorReleased: boolean;
  tier: ConfidentialityTier;
  guards: GuardFlags;
  /** Enclave share of the last W operations after this one is recorded. */
  windowEnclaveShare: number;
  secureMemoryUtilisation: number;
}

export interface SimilarCase {
  caseId: string;
  source: CaseSource;
  department: string;
  careStream: CareStream;
  ageBand: string;
  sex: string;
  symptoms: string[];
  diagnoses: string[];
  medicines: string[];
  investigations: string[];
  month: string;
  /** Cosine similarity in [-1, 1]; in isolated mode it carries calibrated smudging noise. */
  similarity: number;
}

export interface RetrievalResponse {
  results: SimilarCase[];
  decision: ArbitrationDecision;
  stages: {
    corpusSize: number;
    coarseCandidates: number;
    coarseMs: number;
    rerankMs: number;
    ciphertexts: number;
    refreshes: number;
    smudgingSigma: number | null;
    totalMs: number;
  };
  privacy: {
    queryProtection: string;
    isolation: string;
    resultsDeidentified: true;
  };
}
