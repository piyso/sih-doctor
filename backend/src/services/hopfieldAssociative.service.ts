/**
 * Syndrome suggester: one-step Hopfield retrieval over five hand-authored clinical prototypes.
 *
 * The 10 indicator dimensions are filled by intakeExtraction.service.ts from findings the patient
 * affirmed. A suggestion is only shown when at least two indicators are active and, when a
 * conformal calibration is present, when the top weight is inside the prediction set. The
 * clinician always confirms; this never sets triage priority on its own.
 */

import { HopfieldAssociativeEngine, HopfieldPattern, HopfieldRecallResult } from './core/hopfieldAssociative.engine';

export interface ClinicalSyndromeAttractor extends HopfieldPattern {
  namasteCode: string;
  icd11Code: string;
  featureVector: number[];
}

export const SYNDROME_FEATURES = [
  'chest_pain', 'left_arm_radiation', 'diaphoresis', 'joint_crepitus', 'morning_stiffness',
  'fever', 'productive_cough', 'polyuria_thirst', 'burning_feet', 'joint_swelling'
] as const;

const define = (p: Omit<ClinicalSyndromeAttractor, 'vector' | 'category'> & { category?: string }): ClinicalSyndromeAttractor =>
  ({ category: 'syndrome', ...p, vector: p.featureVector });

export class HopfieldAssociativeService {
  private static readonly engine = new HopfieldAssociativeEngine(8.0);

  static readonly STORED_SYNDROMES: ClinicalSyndromeAttractor[] = [
    define({ id: 'syn_acs', name: 'Acute Coronary Syndrome / Myocardial Infarction', namasteCode: 'A-C-201.1', icd11Code: 'BA40.Z', triagePriority: 'EMERGENCY_RED_FLAG', featureVector: [1.0, 0.95, 0.90, 0, 0, 0, 0, 0, 0, 0] }),
    define({ id: 'syn_sandhivata', name: 'Sandhigata Vata (Osteoarthritis of Knee)', namasteCode: 'A-J-102.1', icd11Code: 'FA00.Z', triagePriority: 'ROUTINE', featureVector: [0, 0, 0, 0.95, 0.85, 0, 0, 0, 0, 0.2] }),
    define({ id: 'syn_kasa_jwara', name: 'Kaphaja Kasa with Jwara (Lower Respiratory Infection)', namasteCode: 'A-R-101.3', icd11Code: 'CA23.0', triagePriority: 'HIGH_PRIORITY', featureVector: [0, 0, 0, 0, 0, 0.95, 0.90, 0, 0, 0] }),
    define({ id: 'syn_madhumeha', name: 'Madhumeha (Type 2 Diabetes Mellitus)', namasteCode: 'A-E-301.2', icd11Code: '5A11', triagePriority: 'ROUTINE', featureVector: [0, 0, 0, 0, 0, 0, 0, 0.95, 0.80, 0] }),
    define({ id: 'syn_amavata', name: 'Amavata (Rheumatoid Polyarthritis)', namasteCode: 'A-J-101.4', icd11Code: 'FA20.0', triagePriority: 'HIGH_PRIORITY', featureVector: [0, 0, 0, 0.4, 0.95, 0.2, 0, 0, 0, 0.90] })
  ];

  static recallAttractor(queryVector: number[]): HopfieldRecallResult & { bestMatchSyndrome: ClinicalSyndromeAttractor } {
    const r = this.engine.recall(queryVector, this.STORED_SYNDROMES);
    return { ...r, bestMatchSyndrome: r.bestMatchPattern as ClinicalSyndromeAttractor };
  }

  static weightFor(queryVector: number[], syndromeId: string): number {
    return this.recallAttractor(queryVector).allWeights.find(w => w.id === syndromeId)?.weight ?? 0;
  }
}
