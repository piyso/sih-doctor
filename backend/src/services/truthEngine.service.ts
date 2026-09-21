/**
 * Dual-Pharmacology Truth Engine Service
 * Ported and adapted from project cloud's Bayesian Conflict & Truth Engine
 * Evaluates Herb-Drug, Drug-Drug, and Herb-Herb interactions using Beta-Binomial updating.
 */

import drugInteractions from '../shared/drug_interactions.json';
import { AllopathicMedication, AyushFormulation, ConflictAlert, ContraindicationSeverity } from '../shared/types';
import { ClinicalOntologyEngine, PatientClinicalContext } from './core/clinicalOntology.engine';

export interface BayesianConflictScore {
  alpha: number; // Positive clinical evidence trials
  beta: number;  // Trials showing zero adverse interaction
  expectedProbability: number; // alpha / (alpha + beta)
  confidence: number;
}

export class TruthEngineService {
  private static interactionRegistry = drugInteractions.interactions;

  /**
   * Bayesian Beta-Binomial Expectation Calculator
   * Prior: Beta(alpha_0, beta_0) updated with observed pharmacokinetic evidence
   */
  public static calculateBayesianEvidence(priorAlpha: number = 2, priorBeta: number = 2, positiveEvidence: number = 10, negativeEvidence: number = 1): BayesianConflictScore {
    const alpha = priorAlpha + positiveEvidence;
    const beta = priorBeta + negativeEvidence;
    const expectedProbability = alpha / (alpha + beta);
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    const confidence = 1 - Math.sqrt(variance);

    return {
      alpha,
      beta,
      expectedProbability: parseFloat(expectedProbability.toFixed(4)),
      confidence: parseFloat(confidence.toFixed(4))
    };
  }

  /**
   * Evaluate all active allopathic and AYUSH prescriptions for lethal and high-risk interactions
   * Integrates both empirical registry rules AND the 4-tier Clinical Ontology Engine (WHO ATC + AFI Decompounding).
   */
  public static evaluatePrescriptions(
    allopathicList: AllopathicMedication[] = [],
    ayushList: AyushFormulation[] = [],
    patientContext?: PatientClinicalContext
  ): ConflictAlert[] {
    const alerts: ConflictAlert[] = [];

    const activeDrugs = allopathicList.map((d: any) => (d?.drugName || d?.name || (typeof d === 'string' ? d : '')).toLowerCase()).filter(Boolean);
    const activeHerbs = ayushList.flatMap((a: any) => [
      (a?.formulationName || a?.classicalName || a?.name || (typeof a === 'string' ? a : '')).toLowerCase(),
      (a?.anupana || '').toLowerCase()
    ]).filter(Boolean);

    for (const rule of this.interactionRegistry) {
      let matchedA = false;
      let matchedB = false;
      let actualItemA = rule.itemA;
      let actualItemB = rule.itemB;

      // Check itemA in allopathic or herbs
      if (
        activeDrugs.some(d => d.includes(rule.itemA.toLowerCase())) ||
        activeHerbs.some(h => h.includes(rule.itemA.toLowerCase()))
      ) {
        matchedA = true;
      } else if (rule.aliasesA) {
        for (const alias of rule.aliasesA) {
          if (
            activeDrugs.some(d => d.includes(alias.toLowerCase())) ||
            activeHerbs.some(h => h.includes(alias.toLowerCase()))
          ) {
            matchedA = true;
            actualItemA = alias;
            break;
          }
        }
      }

      // Check itemB in allopathic or herbs
      if (
        activeDrugs.some(d => d.includes(rule.itemB.toLowerCase())) ||
        activeHerbs.some(h => h.includes(rule.itemB.toLowerCase()))
      ) {
        matchedB = true;
      } else if (rule.aliasesB) {
        for (const alias of rule.aliasesB) {
          if (
            activeDrugs.some(d => d.includes(alias.toLowerCase())) ||
            activeHerbs.some(h => h.includes(alias.toLowerCase()))
          ) {
            matchedB = true;
            actualItemB = alias;
            break;
          }
        }
      }

      // If both matched, trigger Bayesian conflict alert
      if (matchedA && matchedB) {
        if (rule.severity === 'SAFE_COMBINATION') {
          continue;
        }
        const bayesian = this.calculateBayesianEvidence(3, 1, Math.round(rule.evidenceScore * 20), 2);

        alerts.push({
          alertId: rule.id,
          severity: rule.severity as ContraindicationSeverity,
          itemA: actualItemA,
          itemB: actualItemB,
          mechanism: rule.mechanism,
          evidenceScore: bayesian.expectedProbability,
          clinicalAction: rule.clinicalAction,
          citation: rule.citation
        });
      }
    }

    // 2. Ontological WHO ATC & Phytochemical Constituent Decompounding (AFI / NAMASTE)
    const evaluatedPairs = new Set<string>();

    for (const drug of activeDrugs) {
      for (const herb of activeHerbs) {
        const pairKey = `${drug}::${herb}`;
        if (evaluatedPairs.has(pairKey)) continue;
        evaluatedPairs.add(pairKey);

        const ontAlerts = ClinicalOntologyEngine.evaluateInteractions(drug, herb, patientContext);
        for (const ont of ontAlerts) {
          if (!alerts.some(a => a.alertId === ont.alertId || (a.itemA.toLowerCase() === ont.triggerA.toLowerCase() && a.itemB.toLowerCase() === ont.triggerB.toLowerCase()))) {
            alerts.push({
              alertId: ont.alertId,
              severity: ont.severity as ContraindicationSeverity,
              itemA: ont.triggerA,
              itemB: ont.triggerB,
              mechanism: ont.ruleMechanism,
              evidenceScore: ont.evidenceConfidence,
              clinicalAction: ont.clinicalExplanation,
              citation: 'WHO ATC Index & Ayurvedic Formulary of India (AFI)'
            });
          }
        }
      }
    }

    // 2b. Allopathic-to-Allopathic High-Rigor DDI Evaluation (Triple Whammy, Serotonin Syndrome, Heart Block, etc.)
    const evaluatedAllopathPairs = new Set<string>();
    for (let i = 0; i < activeDrugs.length; i++) {
      for (let j = i + 1; j < activeDrugs.length; j++) {
        const pairKey = `${activeDrugs[i]}::${activeDrugs[j]}`;
        if (evaluatedAllopathPairs.has(pairKey)) continue;
        evaluatedAllopathPairs.add(pairKey);

        const ddiAlerts = ClinicalOntologyEngine.evaluateAllopathicInteractions(activeDrugs[i], activeDrugs[j], patientContext);
        for (const ddi of ddiAlerts) {
          if (!alerts.some(a => a.alertId === ddi.alertId || (a.itemA.toLowerCase() === ddi.triggerA.toLowerCase() && a.itemB.toLowerCase() === ddi.triggerB.toLowerCase()))) {
            alerts.push({
              alertId: ddi.alertId,
              severity: ddi.severity as ContraindicationSeverity,
              itemA: ddi.triggerA,
              itemB: ddi.triggerB,
              mechanism: ddi.ruleMechanism,
              evidenceScore: ddi.evidenceConfidence,
              clinicalAction: ddi.clinicalExplanation,
              citation: 'WHO ATC Index & British National Formulary (BNF)'
            });
          }
        }
      }
    }

    // Check standalone context contraindications (e.g. Garbhini pregnancy, renal eGFR, Schedule E1)
    if (patientContext) {
      // Check allopathic drugs against patient context (e.g. Warfarin/Methotrexate in pregnancy, Metformin in eGFR < 30)
      for (const drug of activeDrugs) {
        const drugContextAlerts = ClinicalOntologyEngine.evaluateInteractions(drug, '', patientContext);
        for (const ont of drugContextAlerts) {
          if (!alerts.some(a => a.alertId === ont.alertId)) {
            alerts.push({
              alertId: ont.alertId,
              severity: ont.severity as ContraindicationSeverity,
              itemA: ont.triggerA,
              itemB: ont.triggerB,
              mechanism: ont.ruleMechanism,
              evidenceScore: ont.evidenceConfidence,
              clinicalAction: ont.clinicalExplanation,
              citation: 'WHO ATC Index & Renal/Pregnancy Pharmacopeia'
            });
          }
        }
      }
    }

    if (patientContext || activeHerbs.length > 0) {
      for (const herb of activeHerbs) {
        const contextAlerts = ClinicalOntologyEngine.evaluateInteractions('', herb, patientContext);
        for (const ont of contextAlerts) {
          if (!alerts.some(a => a.alertId === ont.alertId)) {
            alerts.push({
              alertId: ont.alertId,
              severity: ont.severity as ContraindicationSeverity,
              itemA: ont.triggerA,
              itemB: ont.triggerB,
              mechanism: ont.ruleMechanism,
              evidenceScore: ont.evidenceConfidence,
              clinicalAction: ont.clinicalExplanation,
              citation: 'WHO ATC Index & Ayurvedic Formulary of India (AFI)'
            });
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Fast pairwise check for a single candidate drug against existing list
   */
  public static checkSingleCandidate(
    candidateName: string,
    existingAllopathic: string[] = [],
    existingAyush: string[] = []
  ): ConflictAlert[] {
    const candidateAllopath: AllopathicMedication[] = [
      ...existingAllopathic.map(d => ({ drugName: d, dosage: 'std', route: 'Oral' as const, frequency: 'OD' as const, timing: 'With Food' as const, duration: '5d' })),
      { drugName: candidateName, dosage: 'std', route: 'Oral' as const, frequency: 'OD' as const, timing: 'With Food' as const, duration: '5d' }
    ];

    const candidateAyush: AyushFormulation[] = existingAyush.map(a => ({
      formulationName: a,
      category: 'Churna',
      dosage: 'std',
      frequency: 'BD',
      anupana: 'Water',
      timing: 'Prathakaal (Morning)',
      duration: '15d'
    }));

    return this.evaluatePrescriptions(candidateAllopath, candidateAyush);
  }
}
