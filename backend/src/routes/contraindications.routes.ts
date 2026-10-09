/**
 * Prescription safety endpoints (herb–drug, drug–drug, patient-context contraindications).
 *
 * Patient context is resolved on the server from `sessionId` or `patientId` (pregnancy, age, renal
 * function from the latest lab report); an explicit `patientContext` object is accepted for
 * what-if checks. Every response says which checks ran and with what context.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { TruthEngineService } from '../services/truthEngine.service';
import { AyushEngineService } from '../services/ayushEngine.service';
import { PiyGraphService } from '../services/piygraph.service';
import { BayesianTruthEngineService } from '../services/bayesianTruthEngine.service';
import { buildPatientContext, cleanContext } from '../services/patientContext.service';
import { PatientClinicalContext } from '../services/core/clinicalOntology.engine';

export const contraindicationsRouter = Router();

function resolveContext(body: any): { context: PatientClinicalContext | null; source: string } {
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  let patientId = typeof body?.patientId === 'string' ? body.patientId : null;
  if (!patientId && sessionId) {
    const s: any = db.prepare('SELECT patient_id FROM sessions WHERE id = ?').get(sessionId);
    patientId = s?.patient_id || null;
  }
  if (patientId) {
    const ctx = buildPatientContext(patientId);
    if (ctx) return { context: { ...ctx, ...(cleanContext(body?.patientContext) || {}) }, source: `patient record${ctx.eGfr !== undefined ? ' + lab report' : ''}` };
  }
  const explicit = cleanContext(body?.patientContext);
  return explicit ? { context: explicit, source: 'request body' } : { context: null, source: 'none (no sessionId, patientId or patientContext supplied)' };
}

function augment(alerts: ReturnType<typeof TruthEngineService.evaluatePrescriptions>) {
  return alerts.map(alert => {
    const drugName = alert.itemA;
    const herbName = alert.itemB;
    const causalPaths = PiyGraphService.findCausalPaths(herbName, drugName, 4);
    const evidence = BayesianTruthEngineService.evaluatePair(drugName, herbName);
    const cf = PiyGraphService.evaluateCounterfactualSubstitution(herbName, drugName);
    return {
      ...alert,
      allopathicDrug: drugName,
      ayushHerb: herbName,
      clinicalConsequence: alert.mechanism,
      recommendedAction: alert.clinicalAction,
      bayesianConfidence: evidence.expectedConfidence,
      bayesianPosterior: {
        alpha: evidence.alpha, beta: evidence.beta, variance: evidence.variance, credibleInterval95: evidence.credibleInterval95,
        bayesFactor: evidence.bayesFactor, bayesFactorMethod: evidence.bayesFactorMethod, isStatisticallySignificant: evidence.isStatisticallySignificant,
        prior: evidence.prior, observationsUsed: evidence.observationsUsed
      },
      piyGraphCausalPaths: causalPaths,
      counterfactualSubstitution: {
        recommendedHerb: cf.recommendedSubstitution,
        candidates: cf.candidates,
        explanation: cf.clinicalExplanation,
        originalRisk: cf.originalRiskProbability,
        substitutedRisk: cf.substitutedRiskProbability,
        efficacyPreserved: cf.therapeuticEfficacyPreserved,
        evidence: cf.evidence
      }
    };
  });
}

/** POST /api/contraindications/evaluate */
contraindicationsRouter.post('/evaluate', (req: Request, res: Response): void => {
  try {
    const allopathic = req.body.allopathic || req.body.allopathicMeds || req.body.allopathicPrescriptions || req.body.drugs || [];
    const ayush = req.body.ayush || req.body.ayushFormulations || req.body.ayushPrescriptions || req.body.herbs || [];
    const { context, source } = resolveContext(req.body);
    const evaluation = TruthEngineService.evaluatePrescriptionsDetailed(allopathic, ayush, context);
    const alerts = augment(evaluation.alerts);
    const viruddhaWarnings = AyushEngineService.checkViruddhaAhara(ayush);
    const hypergraphPolypharmacy = PiyGraphService.evaluateHigherOrderPolypharmacy(allopathic, ayush);
    res.json({
      success: true,
      alerts,
      hasConflicts: alerts.length > 0 || hypergraphPolypharmacy.hasHypergraphConflict,
      hasCriticalLethalConflict: alerts.some(a => a.severity === 'CRITICAL_CONTRAINDICATION'),
      viruddhaWarnings,
      hypergraphPolypharmacy,
      safetyChecks: evaluation.checks,
      patientContextUsed: evaluation.contextUsed,
      patientContextSource: source,
      itemsConsidered: evaluation.itemsConsidered
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/contraindications/counterfactual — body { herb, drug, proposedAlternative? } */
contraindicationsRouter.post('/counterfactual', (req: Request, res: Response): void => {
  try {
    const herb = req.body.herb || req.body.primaryIntervention;
    const drug = req.body.drug || req.body.targetCondition || req.body.coPrescribedAllopathic;
    const proposed = req.body.proposedAlternative || req.body.alternative;
    if (!herb || !drug) {
      res.status(400).json({ error: 'herb and drug are required' });
      return;
    }
    res.json({ success: true, data: PiyGraphService.evaluateCounterfactualSubstitution(String(herb), String(drug), proposed ? String(proposed) : undefined) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/contraindications/check — legacy shape kept for older clients. */
contraindicationsRouter.post('/check', (req: Request, res: Response): void => {
  try {
    const { allopathicPrescriptions, ayushPrescriptions, candidateDrug } = req.body;
    const { context, source } = resolveContext(req.body);
    const allo = [...(allopathicPrescriptions || []), ...(candidateDrug ? [candidateDrug] : [])];
    const evaluation = TruthEngineService.evaluatePrescriptionsDetailed(allo, ayushPrescriptions || [], context);
    const alerts = augment(evaluation.alerts);
    const viruddhaWarnings = AyushEngineService.checkViruddhaAhara(ayushPrescriptions || []);
    res.json({
      success: true,
      hasConflicts: alerts.length > 0,
      hasCriticalLethalConflict: alerts.some(a => a.severity === 'CRITICAL_CONTRAINDICATION'),
      conflictAlerts: alerts,
      alerts,
      viruddhaWarnings,
      safetyChecks: evaluation.checks,
      patientContextUsed: evaluation.contextUsed,
      patientContextSource: source
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
