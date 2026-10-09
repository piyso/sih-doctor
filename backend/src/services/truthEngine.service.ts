/**
 * Prescription safety engine: herb–drug, drug–drug and patient-context contraindications.
 *
 * Layers, all deterministic and cited:
 *  1. Registry rules (shared/drug_interactions.json): matched on canonical names (brand → molecule,
 *     brand → classical formulation) with whole-word matching; negated mentions are ignored.
 *  2. Ontology rules (core/clinicalOntology.engine.ts): WHO ATC class × AFI phytochemical
 *     constituent mechanisms, plus pregnancy / renal / Schedule E(1) gates that need patient context.
 *  3. Vulnerable-demographics gate (ayushEngine.service.ts): pregnancy and paediatrics vs
 *     Rasashastra minerals and emmenagogues.
 *
 * `evaluatePrescriptionsDetailed` reports which checks ran and what context they had, so the
 * finalized record can say "checked for pregnancy: yes" rather than leaving it implicit.
 */

import drugInteractions from '../shared/drug_interactions.json';
import { AllopathicMedication, AyushFormulation, ConflictAlert, ContraindicationSeverity } from '../shared/types';
import { ClinicalOntologyEngine, PatientClinicalContext } from './core/clinicalOntology.engine';
import { AyushEngineService } from './ayushEngine.service';
import { canonicalNames } from './bayesianTruthEngine.service';

export interface SafetyEvaluation {
  alerts: ConflictAlert[];
  contextUsed: PatientClinicalContext | null;
  checks: Array<{ check: string; ran: boolean; detail?: string }>;
  itemsConsidered: { drugs: string[]; herbs: string[]; ignoredAsNegated: string[] };
}

const NEGATION = /(?:^|[^\p{L}])(?:no|not|stopped|discontinued|never|without|allergic to|nahi|nahin|band|bandh|chhod|नहीं|बंद|छोड़)(?=[^\p{L}]|$)/iu;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_CACHE = new Map<string, RegExp>();
const wholeWord = (term: string): RegExp => {
  let re = RE_CACHE.get(term);
  if (!re) { re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.toLowerCase())}(?![\\p{L}\\p{N}])`, 'iu'); RE_CACHE.set(term, re); }
  return re;
};

function namesOf(items: any[], keys: string[]): { names: string[]; negated: string[] } {
  const names: string[] = [];
  const negated: string[] = [];
  for (const it of items || []) {
    const raw = typeof it === 'string' ? it : keys.map(k => it?.[k]).find(v => typeof v === 'string' && v.trim());
    if (!raw) continue;
    const text = String(raw).trim();
    if (NEGATION.test(text)) { negated.push(text); continue; }
    names.push(text.toLowerCase());
  }
  return { names: Array.from(new Set(names)), negated };
}

export class TruthEngineService {
  private static registry = drugInteractions.interactions;

  /** Registry evidence score as a Beta mean with K=10 pseudo-observations (documented, not fitted). */
  static registryEvidence(score: number): { alpha: number; beta: number; expectedProbability: number } {
    const e = Math.max(0.5, Math.min(0.99, score || 0.9));
    const alpha = 1 + 10 * e;
    const beta = 1 + 10 * (1 - e);
    return { alpha: parseFloat(alpha.toFixed(2)), beta: parseFloat(beta.toFixed(2)), expectedProbability: parseFloat((alpha / (alpha + beta)).toFixed(4)) };
  }

  /** Kept for callers of the old helper; same mapping as registryEvidence. */
  static calculateBayesianEvidence(priorAlpha = 1, priorBeta = 1, positive = 0, negative = 0) {
    const alpha = priorAlpha + positive;
    const beta = priorBeta + negative;
    const n = alpha + beta;
    const variance = (alpha * beta) / (n * n * (n + 1));
    return { alpha, beta, expectedProbability: parseFloat((alpha / n).toFixed(4)), confidence: parseFloat((1 - Math.sqrt(variance)).toFixed(4)) };
  }

  private static matchTerm(canon: Map<string, string[]>, names: string[], term: string): boolean {
    const re = wholeWord(term);
    return names.some(n => (canon.get(n) || [n]).some(c => re.test(c)));
  }

  static evaluatePrescriptionsDetailed(allopathicList: (AllopathicMedication | any)[] = [], ayushList: (AyushFormulation | any)[] = [], patientContext?: PatientClinicalContext | null): SafetyEvaluation {
    const alerts: ConflictAlert[] = [];
    const checks: SafetyEvaluation['checks'] = [];
    const drugs = namesOf(allopathicList, ['drugName', 'name', 'genericName', 'brandName']);
    const herbs = namesOf(ayushList, ['formulationName', 'classicalName', 'name', 'ayushHerb', 'herbName']);
    const herbNames = Array.from(new Set([...herbs.names, ...(ayushList || []).map((a: any) => (typeof a?.anupana === 'string' ? a.anupana.toLowerCase() : '')).filter(Boolean)]));
    const ctx = patientContext || null;
    const canon = new Map<string, string[]>();
    for (const n of [...drugs.names, ...herbNames]) canon.set(n, canonicalNames(n));
    const pushUnique = (a: ConflictAlert) => {
      if (!alerts.some(x => x.alertId === a.alertId && x.itemA.toLowerCase() === a.itemA.toLowerCase() && x.itemB.toLowerCase() === a.itemB.toLowerCase())) alerts.push(a);
    };

    // 1. Registry rules.
    for (const rule of this.registry) {
      if (rule.severity === 'SAFE_COMBINATION') continue;
      const termsA = [rule.itemA, ...(rule.aliasesA || [])];
      const termsB = [rule.itemB, ...(rule.aliasesB || [])];
      const all = [...drugs.names, ...herbNames];
      const hitA = termsA.find(t => this.matchTerm(canon, all, t));
      const hitB = termsB.find(t => this.matchTerm(canon, all, t));
      // Context-only rules (e.g. "Pregnancy + uterotonic herbs") carry their condition in itemA.
      const contextRule = /^(pregnancy|renal impairment|schedule e\(1\))/i.test(rule.itemA);
      if (contextRule) {
        const fromContext = (/pregnancy/i.test(rule.itemA) && !!ctx?.isPregnant) || (/renal/i.test(rule.itemA) && ctx?.eGfr !== undefined && ctx.eGfr < 30) || /schedule/i.test(rule.itemA);
        const applies = fromContext || !!hitA; // the condition may also be listed explicitly ("CKD", "pregnant")
        if (applies && hitB) pushUnique({ alertId: rule.id, severity: rule.severity as ContraindicationSeverity, itemA: hitA || rule.itemA, itemB: hitB, mechanism: rule.mechanism, evidenceScore: this.registryEvidence(rule.evidenceScore).expectedProbability, clinicalAction: rule.clinicalAction, citation: rule.citation });
        continue;
      }
      if (hitA && hitB) {
        pushUnique({ alertId: rule.id, severity: rule.severity as ContraindicationSeverity, itemA: hitA, itemB: hitB, mechanism: rule.mechanism, evidenceScore: this.registryEvidence(rule.evidenceScore).expectedProbability, clinicalAction: rule.clinicalAction, citation: rule.citation });
      }
    }
    checks.push({ check: 'registry_rules', ran: true, detail: `${this.registry.length} cited rules` });

    const fromOnt = (o: ReturnType<typeof ClinicalOntologyEngine.evaluateInteractions>[number], citation: string): ConflictAlert => ({
      alertId: o.alertId, severity: o.severity as ContraindicationSeverity, itemA: o.triggerA, itemB: o.triggerB, mechanism: o.ruleMechanism, evidenceScore: o.evidenceConfidence, clinicalAction: o.clinicalExplanation, citation
    });

    // 2. Ontology: herb–drug pairs, drug–drug pairs, and single-item context gates.
    for (const d of drugs.names) for (const h of herbNames) for (const o of ClinicalOntologyEngine.evaluateInteractions(d, h, ctx || undefined)) pushUnique(fromOnt(o, 'WHO ATC Index & Ayurvedic Formulary of India (AFI)'));
    for (let i = 0; i < drugs.names.length; i++) for (let j = i + 1; j < drugs.names.length; j++) for (const o of ClinicalOntologyEngine.evaluateAllopathicInteractions(drugs.names[i], drugs.names[j], ctx || undefined)) pushUnique(fromOnt(o, 'WHO ATC Index & British National Formulary (BNF)'));
    for (const d of drugs.names) for (const o of ClinicalOntologyEngine.evaluateInteractions(d, '', ctx || undefined)) pushUnique(fromOnt(o, 'WHO ATC Index; FDA pregnancy categories; KDIGO renal dosing'));
    for (const h of herbNames) for (const o of ClinicalOntologyEngine.evaluateInteractions('', h, ctx || undefined)) pushUnique(fromOnt(o, 'Ayurvedic Formulary of India (AFI); Drugs & Cosmetics Rules Schedule E(1)'));
    checks.push({ check: 'atc_phytochemical_ontology', ran: true });

    // 3. Vulnerable demographics (pregnancy, paediatrics) for Ayush formulations.
    if (ctx && (ctx.isPregnant || (ctx.age !== undefined && ctx.age < 12))) {
      const v = AyushEngineService.checkVulnerableDemographics({ age: ctx.age, isPregnant: ctx.isPregnant, isLactating: ctx.isLactating }, ayushList || []);
      v.violations.forEach((text, i) => pushUnique({ alertId: `VULN-${ctx.isPregnant ? 'PREG' : 'PAED'}-${i + 1}`, severity: 'CRITICAL_CONTRAINDICATION', itemA: ctx.isPregnant ? 'Pregnancy' : `Age ${ctx.age}`, itemB: 'Ayush formulation', mechanism: text, evidenceScore: 0.95, clinicalAction: v.safeRecommendations.length ? `Consider: ${v.safeRecommendations.join('; ')}` : 'Review with the vaidya.', citation: 'Kashyapa Samhita; AFI' }));
      // Constituent-level check: a brand name may hide a mineral calx or a Schedule E(1) ingredient.
      if (ctx.age !== undefined && ctx.age < 12) {
        for (const h of herbNames) {
          const r = ClinicalOntologyEngine.resolveAyushConcept(h);
          if (!r) continue;
          if (r.bioactives.includes('PHYT_HEAVY_METAL_CALX')) pushUnique({ alertId: 'VULN-PAED-CALX', severity: 'CRITICAL_CONTRAINDICATION', itemA: `Age ${ctx.age}`, itemB: r.formulationName, mechanism: `${r.formulationName} contains mineral calx constituents (${r.constituents.filter(c => /bhasma|parada|gandhaka|tamra|lauha|abhraka/i.test(c)).join(', ') || 'Rasashastra minerals'}); immature renal clearance in children under 12.`, evidenceScore: 0.95, clinicalAction: 'Choose a herbal (non-mineral) paediatric formulation; mineral preparations only under specialist supervision.', citation: 'Kashyapa Samhita; AFI constituent list' });
          if (r.isScheduleE1) pushUnique({ alertId: 'VULN-PAED-E1', severity: 'CRITICAL_CONTRAINDICATION', itemA: `Age ${ctx.age}`, itemB: r.formulationName, mechanism: `${r.formulationName} contains a Schedule E(1) ingredient.`, evidenceScore: 0.98, clinicalAction: 'Not for paediatric self-medication; registered practitioner only.', citation: 'Drugs & Cosmetics Rules 1945, Schedule E(1)' });
        }
      }
      checks.push({ check: 'vulnerable_demographics', ran: true, detail: ctx.isPregnant ? 'pregnancy' : 'paediatric' });
    } else {
      checks.push({ check: 'vulnerable_demographics', ran: false, detail: ctx ? 'not pregnant, not paediatric' : 'no patient context supplied' });
    }
    checks.push({ check: 'pregnancy_gate', ran: !!ctx, detail: ctx ? (ctx.isPregnant ? 'pregnant' : 'not pregnant') : 'no patient context supplied' });
    checks.push({ check: 'renal_gate', ran: !!ctx && ctx.eGfr !== undefined, detail: ctx?.eGfr !== undefined ? `eGFR ${ctx.eGfr}` : 'no renal function on file' });

    const rank: Record<string, number> = { CRITICAL_CONTRAINDICATION: 0, STATUTORY_SCHEDULE_E1: 1, WARNING: 2, AYUSH_INCOMPATIBILITY: 3, INFO: 4 };
    alerts.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
    return { alerts, contextUsed: ctx, checks, itemsConsidered: { drugs: drugs.names, herbs: herbNames, ignoredAsNegated: [...drugs.negated, ...herbs.negated] } };
  }

  static evaluatePrescriptions(allopathicList: (AllopathicMedication | any)[] = [], ayushList: (AyushFormulation | any)[] = [], patientContext?: PatientClinicalContext | null): ConflictAlert[] {
    return this.evaluatePrescriptionsDetailed(allopathicList, ayushList, patientContext).alerts;
  }

  static checkSingleCandidate(candidateName: string, existingAllopathic: string[] = [], existingAyush: string[] = [], patientContext?: PatientClinicalContext | null): ConflictAlert[] {
    return this.evaluatePrescriptions([...existingAllopathic, candidateName], existingAyush, patientContext);
  }
}
