/**
 * Continuous Modern Hopfield Associative Memory Engine
 * Native Hopfield Associative Subsystem
 *
 * Scientific Basis:
 * Ramsauer et al. (2020) "Hopfield Networks is All You Need"
 *
 * Implements one-step global associative recall:
 *   z_new = X * softmax(beta * X^T * z)
 *   E(z) = -(1/beta) * lse(beta * X^T * z) + (1/2) * z^T * z
 */

export interface HopfieldPattern {
  id: string;
  name: string;
  category: string;
  namasteCode?: string;
  icd11Code?: string;
  triagePriority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
  vector: number[];
}

export interface HopfieldRecallResult {
  bestMatchPattern: HopfieldPattern;
  retrievalConfidence: number;
  attractorEnergy: number;
  reconstructedVector: number[];
  allWeights: Array<{ id: string; name: string; weight: number }>;
}

const kernel = require('./sovereign-kernel.cjs');

export interface IHopfieldAssociativeEngine {
  recall(queryVector: number[], storedPatterns: HopfieldPattern[]): HopfieldRecallResult;
}

export const HopfieldAssociativeEngine: new (beta?: number) => IHopfieldAssociativeEngine =
  kernel.HopfieldAssociativeEngine;
