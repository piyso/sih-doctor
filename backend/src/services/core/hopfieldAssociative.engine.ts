/**
 * One-step continuous Hopfield retrieval (Ramsauer et al., 2020, "Hopfield Networks is All You
 * Need") over a small set of stored prototype vectors.
 *
 *   p      = softmax(β · Xᵀ q)          (retrieval weights over stored patterns)
 *   q_new  = X p                        (reconstructed pattern)
 *   E(q)   = −(1/β) · lse(β · Xᵀ q) + ½ qᵀ q
 *
 * With a handful of hand-authored prototypes this is a soft nearest-prototype classifier; it is
 * used only to *suggest* a syndrome for the clinician to confirm. The engine reports the margin
 * between the top two weights and flags degenerate (empty) queries so callers never present a
 * suggestion that is really just the softmax of nothing.
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
  retrievalConfidence: number; // top softmax weight
  margin: number; // top weight minus runner-up weight
  attractorEnergy: number;
  reconstructedVector: number[];
  allWeights: Array<{ id: string; name: string; weight: number }>;
  isDegenerateQuery: boolean; // query vector had (near) zero norm
}

export class HopfieldAssociativeEngine {
  constructor(public readonly beta = 8) {}

  private dot(a: number[], b: number[]): number {
    let s = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
  }

  private softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => (sum > 0 ? e / sum : 1 / logits.length));
  }

  private l2(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm <= 1e-9 ? [...v] : v.map(x => x / norm);
  }

  recall(queryVector: number[], storedPatterns: HopfieldPattern[]): HopfieldRecallResult {
    if (!storedPatterns?.length) throw new Error('HopfieldAssociativeEngine: storedPatterns cannot be empty');
    const dim = queryVector.length;
    const qNorm = Math.sqrt(queryVector.reduce((s, x) => s + x * x, 0));
    const isDegenerateQuery = qNorm <= 1e-9;
    const q = this.l2(queryVector);
    const X = storedPatterns.map(p => this.l2(p.vector));
    const logits = X.map(x => this.beta * this.dot(x, q));
    const weights = this.softmax(logits);

    const reconstructed = new Array(dim).fill(0);
    for (let i = 0; i < X.length; i++) for (let d = 0; d < dim; d++) reconstructed[d] += (X[i][d] || 0) * weights[i];
    const rNorm = Math.sqrt(reconstructed.reduce((s, x) => s + x * x, 0));
    const reconstructedVector = reconstructed.map(x => parseFloat((rNorm > 1e-9 ? x / rNorm : 0).toFixed(4)));

    const ranked = storedPatterns.map((p, i) => ({ id: p.id, name: p.name, weight: parseFloat(weights[i].toFixed(4)), index: i })).sort((a, b) => b.weight - a.weight);
    const top = ranked[0];
    const runnerUp = ranked[1]?.weight ?? 0;

    const maxLogit = Math.max(...logits);
    const lse = maxLogit + Math.log(logits.reduce((s, l) => s + Math.exp(l - maxLogit), 0));
    const energy = -(lse / this.beta) + 0.5 * this.dot(q, q);

    return {
      bestMatchPattern: storedPatterns[top.index],
      retrievalConfidence: isDegenerateQuery ? 0 : top.weight,
      margin: isDegenerateQuery ? 0 : parseFloat((top.weight - runnerUp).toFixed(4)),
      attractorEnergy: parseFloat(energy.toFixed(4)),
      reconstructedVector,
      allWeights: ranked.map(({ id, name, weight }) => ({ id, name, weight })),
      isDegenerateQuery
    };
  }
}

export type IHopfieldAssociativeEngine = HopfieldAssociativeEngine;
