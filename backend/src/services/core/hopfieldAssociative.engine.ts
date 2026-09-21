/**
 * Continuous Modern Hopfield Associative Memory Engine
 * Ported & adapted from PiyAPI (project cloud/src/services/scoring/hopfieldAssociative.service.ts)
 *
 * Scientific Basis:
 * Ramsauer et al. (2020) "Hopfield Networks is All You Need"
 *
 * Implements one-step global associative recall:
 *   z_new = X * softmax(beta * X^T * z)
 *   E(z) = -(1/beta) * lse(beta * X^T * z) + (1/2) * z^T * z
 *
 * Guarantees exponential storage capacity C approx 2^(d/2) and one-step global
 * convergence to the nearest clinical syndrome attractor basin.
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

export class HopfieldAssociativeEngine {
  private beta: number;

  constructor(beta: number = 8.0) {
    this.beta = beta;
  }

  /**
   * Dot product between two equal-length numeric vectors
   */
  private dot(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Numerically stable softmax with maximum logit subtraction
   */
  private softmax(logits: number[]): number[] {
    let max = -Infinity;
    for (const val of logits) {
      if (val > max) max = val;
    }

    let sum = 0;
    const exps = logits.map((val) => {
      const e = Math.exp(val - max);
      sum += e;
      return e;
    });

    return exps.map((e) => (sum > 0 ? e / sum : 1.0 / logits.length));
  }

  /**
   * L2 vector normalization helper
   */
  private l2Normalize(v: number[]): number[] {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    const norm = Math.sqrt(sum);
    if (norm <= 1e-9) return [...v];
    return v.map((x) => x / norm);
  }

  /**
   * Perform single-step continuous Modern Hopfield associative retrieval
   */
  public recall(queryVector: number[], storedPatterns: HopfieldPattern[]): HopfieldRecallResult {
    if (!storedPatterns || storedPatterns.length === 0) {
      throw new Error('HopfieldAssociativeEngine: storedPatterns cannot be empty');
    }

    const dim = queryVector.length;
    const normQuery = this.l2Normalize(queryVector);
    const normMatrix = storedPatterns.map((p) => this.l2Normalize(p.vector));

    // Compute inner products: beta * X^T * z with normalized vectors
    const logits = normMatrix.map((p) => this.beta * this.dot(p, normQuery));

    // Softmax attention weights
    const weights = this.softmax(logits);

    // Reconstruct z_new = X * weights
    const reconstructed = new Array(dim).fill(0);
    for (let i = 0; i < normMatrix.length; i++) {
      const p = normMatrix[i];
      const w = weights[i];
      for (let d = 0; d < dim; d++) {
        reconstructed[d] += (p[d] || 0) * w;
      }
    }

    // L2 Normalization
    let normSq = 0;
    for (let d = 0; d < dim; d++) {
      normSq += reconstructed[d] * reconstructed[d];
    }
    const norm = Math.sqrt(normSq);
    if (norm > 1e-9) {
      for (let d = 0; d < dim; d++) {
        reconstructed[d] = parseFloat((reconstructed[d] / norm).toFixed(4));
      }
    }

    // Find winning attractor
    let bestIndex = 0;
    let maxWeight = -1;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > maxWeight) {
        maxWeight = weights[i];
        bestIndex = i;
      }
    }

    // Numerically stable Log-Sum-Exp with max logit subtraction
    let maxLogit = -Infinity;
    for (const logit of logits) {
      if (logit > maxLogit) maxLogit = logit;
    }
    let expSum = 0;
    for (const logit of logits) {
      expSum += Math.exp(logit - maxLogit);
    }
    const lse = (maxLogit + Math.log(expSum)) / this.beta;
    const energy = -lse + 0.5 * this.dot(normQuery, normQuery);

    const allWeights = storedPatterns.map((p, idx) => ({
      id: p.id,
      name: p.name,
      weight: parseFloat(weights[idx].toFixed(4))
    })).sort((a, b) => b.weight - a.weight);

    return {
      bestMatchPattern: storedPatterns[bestIndex],
      retrievalConfidence: parseFloat(maxWeight.toFixed(4)),
      attractorEnergy: parseFloat(energy.toFixed(4)),
      reconstructedVector: reconstructed,
      allWeights
    };
  }
}
