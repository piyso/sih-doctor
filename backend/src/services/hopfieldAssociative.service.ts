/**
 * Continuous Modern Hopfield Associative Memory Subsystem
 * Ported from PiyAPI (project cloud/src/services/scoring/hopfieldAssociative.service.ts)
 *
 * Implements Continuous Modern Hopfield Networks (Ramsauer et al., 2020):
 *   E(z) = -lse(beta, X^T z) + (1/2) z^T z + C
 *   z_new = X * softmax(beta * X^T * z)
 *
 * Clinical Application:
 * Resolves noisy, partial, or fragmentary patient symptom reports into canonical
 * clinical diagnostic attractors (e.g. partial "chest pain" -> completed Acute Coronary Syndrome).
 */

export interface ClinicalSyndromeAttractor {
  id: string;
  name: string;
  namasteCode: string;
  icd11Code: string;
  triagePriority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
  featureVector: number[]; // 10-dimensional clinical indicator embedding
}

export class HopfieldAssociativeService {
  private static readonly BETA = 8.0; // Inverse temperature parameter

  // 10 Key Clinical Dimensions:
  // [0: Chest Pain, 1: Left Arm Radiation, 2: Diaphoresis/Sweat, 3: Joint Crepitus, 4: Morning Stiffness,
  //  5: Fever >100F, 6: Productive Cough, 7: Polyuria/Thirst, 8: Burning Feet, 9: Joint Swelling/Heat]
  private static readonly STORED_SYNDROMES: ClinicalSyndromeAttractor[] = [
    {
      id: 'syn_acs',
      name: 'Acute Coronary Syndrome / Myocardial Infarction',
      namasteCode: 'A-C-201.1',
      icd11Code: 'BA40.Z',
      triagePriority: 'EMERGENCY_RED_FLAG',
      featureVector: [1.0, 0.95, 0.90, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    },
    {
      id: 'syn_sandhivata',
      name: 'Sandhigata Vata (Osteoarthritis of Knee)',
      namasteCode: 'A-J-102.1',
      icd11Code: 'FA00.Z',
      triagePriority: 'ROUTINE',
      featureVector: [0.0, 0.0, 0.0, 0.95, 0.85, 0.0, 0.0, 0.0, 0.0, 0.2]
    },
    {
      id: 'syn_kasa_jwara',
      name: 'Kaphaja Kasa with Jwara (Pediatric Respiratory Infection)',
      namasteCode: 'A-R-101.3',
      icd11Code: 'CA23.0',
      triagePriority: 'HIGH_PRIORITY',
      featureVector: [0.0, 0.0, 0.0, 0.0, 0.0, 0.95, 0.90, 0.0, 0.0, 0.0]
    },
    {
      id: 'syn_madhumeha',
      name: 'Madhumeha (Type 2 Diabetes Mellitus)',
      namasteCode: 'A-E-301.2',
      icd11Code: '5A11',
      triagePriority: 'ROUTINE',
      featureVector: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.95, 0.80, 0.0]
    },
    {
      id: 'syn_amavata',
      name: 'Amavata (Rheumatoid Polyarthritis)',
      namasteCode: 'A-J-101.4',
      icd11Code: 'FA20.0',
      triagePriority: 'HIGH_PRIORITY',
      featureVector: [0.0, 0.0, 0.0, 0.4, 0.95, 0.2, 0.0, 0.0, 0.0, 0.90]
    }
  ];

  private static dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private static softmax(logits: number[]): number[] {
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
    return exps.map((e) => (sum > 0 ? e / sum : 1 / logits.length));
  }

  /**
   * Run one-step Continuous Modern Hopfield retrieval on a partial patient symptom vector
   */
  public static recallAttractor(queryVector: number[]): {
    bestMatchSyndrome: ClinicalSyndromeAttractor;
    retrievalConfidence: number;
    attractorEnergy: number;
    reconstructedVector: number[];
  } {
    const patterns = this.STORED_SYNDROMES.map((s) => s.featureVector);
    const logits = patterns.map((p) => this.BETA * this.dot(p, queryVector));
    const weights = this.softmax(logits);

    // Reconstruct z_new = X * weights
    const dim = queryVector.length;
    const reconstructed = new Array(dim).fill(0);
    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      const w = weights[i];
      for (let d = 0; d < dim; d++) {
        reconstructed[d] += p[d] * w;
      }
    }

    // Identify winning attractor
    let bestIndex = 0;
    let highestWeight = -1;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > highestWeight) {
        highestWeight = weights[i];
        bestIndex = i;
      }
    }

    // Compute Modern Hopfield Energy: E(z) = -lse(beta, X^T z) + (1/2) z^T z
    const lse = Math.log(
      patterns.reduce((acc, p) => acc + Math.exp(this.BETA * this.dot(p, queryVector)), 0)
    ) / this.BETA;
    const energy = -lse + 0.5 * this.dot(queryVector, queryVector);

    return {
      bestMatchSyndrome: this.STORED_SYNDROMES[bestIndex],
      retrievalConfidence: parseFloat(highestWeight.toFixed(4)),
      attractorEnergy: parseFloat(energy.toFixed(4)),
      reconstructedVector: reconstructed.map((v) => parseFloat(v.toFixed(3)))
    };
  }
}
