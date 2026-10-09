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
 *  4. Rule engine (safety/safetyEngine.ts) over a drug dictionary: allergy and cross-reactivity,
 *     duplicate ingredients/classes, drug–drug pairs and list-level stacks, herb–drug flags,
 *     pregnancy, lactation, renal, paediatric and Beers checks, conditions, dose ceilings,
 *     banned FDCs, Schedule E(1)/H1/NDPS and antibiotic stewardship.
 *
 * Every alert carries a tier (STOP / WARN / INFO), a family and a group key; alerts on the same
 * lines and family form one group, and the earlier layers keep their established alert ids.
 *
 * `evaluatePrescriptionsDetailed` reports which checks ran and what context they had, so the
 * finalized record can say "checked for pregnancy: yes" rather than leaving it implicit.
 */

import drugInteractions from '../shared/drug_interactions.json';
import { AllopathicMedication, AyushFormulation, ConflictAlert, ContraindicationSeverity } from '../shared/types';
import { ClinicalOntologyEngine, PatientClinicalContext } from './core/clinicalOntology.engine';
import { AyushEngineService } from './ayushEngine.service';
import { canonicalNames } from './bayesianTruthEngine.service';
import { ResolvedLine, resolveAllopathicLine, resolveAyushLine, cleanName } from './safety/resolver';
import { evaluateSafety, groupKeyOf, tierForSeverity, Family, SafetyCoverage } from './safety/safetyEngine';
import { drugById } from './safety/drugDictionary';
import { constituentsWithFlag } from './safety/ayushDictionary';

export interface SafetyEvaluation {
  alerts: ConflictAlert[];
  contextUsed: PatientClinicalContext | null;
  checks: Array<{ check: string; ran: boolean; detail?: string }>;
  itemsConsidered: { drugs: string[]; herbs: string[]; ignoredAsNegated: string[] };
  coverage: SafetyCoverage;
  /** What each line resolved to (generic names for printing in capitals; statutory flags). */
  resolvedLines: Array<{ index: number; raw: string; kind: string; role: string; generics: string[]; unresolved: string[]; schedule?: string[]; aware?: string[]; scheduleE1?: string[] }>;
  /** Distinct STOP groups: each needs a typed reason before the prescription can be signed. */
  stopGroups: Array<{ groupKey: string; alertIds: string[]; summary: string }>;
}

export interface EvaluateOptions {
  /** Which list the prescriber is writing; the other list is what the patient already takes. */
  roles?: { allopathic?: 'prescribed' | 'ongoing'; ayush?: 'prescribed' | 'ongoing' };
  /** Pathya / diet advice lines checked for interacting foods (garlic, licorice, alcohol). */
  diet?: string[];
}

/** Family of an alert from the earlier layers, by its established id. */
function legacyFamily(alertId: string, itemA: string): Family {
  if (/^INT-0(08|09|15|16|17|18)$/.test(alertId) || alertId.startsWith('viruddha')) return 'viruddha';
  if (alertId === 'INT-014' || alertId.startsWith('ONT-RENAL')) return 'renal';
  if (alertId === 'INT-034' || alertId.startsWith('ONT-PREG') || alertId === 'ONT-GARBHINI-ABORT' || alertId.startsWith('VULN-PREG')) return 'pregnancy';
  if (alertId === 'INT-035' || alertId === 'ONT-SCHED-E1') return 'statutory';
  if (alertId.startsWith('VULN-PAED')) return 'paediatric';
  if (alertId.startsWith('ONT-DDI')) return 'ddi';
  if (/^pregnan/i.test(itemA)) return 'pregnancy';
  return 'herb_drug';
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

for (const rule of drugInteractions.interactions) for (const t of [rule.itemA, rule.itemB, ...(rule.aliasesA || []), ...(rule.aliasesB || [])]) wholeWord(t);

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

  static evaluatePrescriptionsDetailed(allopathicList: (AllopathicMedication | any)[] = [], ayushList: (AyushFormulation | any)[] = [], patientContext?: PatientClinicalContext | null, options: EvaluateOptions = {}): SafetyEvaluation {
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
    const fullText = [...(allopathicList || []), ...(ayushList || [])].map((x: any) => typeof x === 'string' ? x : [x?.name, x?.classicalName, x?.formulationName, x?.anupana, x?.dose, x?.dosage, x?.frequency].filter(Boolean).join(' ')).join(' ; ');
    for (const rule of this.registry) {
      if (rule.severity === 'SAFE_COMBINATION') continue;
      if ((rule as any).requires && !new RegExp((rule as any).requires, 'i').test(fullText)) continue;
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

    // 4. Rule engine over resolved lines.
    const lines: ResolvedLine[] = [];
    (allopathicList || []).forEach((it: any) => lines.push(resolveAllopathicLine(it, lines.length, options.roles?.allopathic || 'prescribed')));
    (ayushList || []).forEach((it: any) => lines.push(resolveAyushLine(it, lines.length, options.roles?.ayush || 'prescribed')));
    const onList = new Set(lines.flatMap(l => l.conceptIds));
    const onListAyush = new Set(lines.map(l => l.ayush?.formulation?.id).filter(Boolean));
    const unrecognisedReported: string[] = [];
    for (const name of ctx?.reportedMedicines || []) {
      const allo = resolveAllopathicLine({ name }, lines.length, 'reported');
      if (allo.conceptIds.length && !allo.unresolved.length) {
        if (allo.conceptIds.some(id => onList.has(id))) continue;
        allo.conceptIds.forEach(id => onList.add(id));
        lines.push(allo);
        continue;
      }
      const ay = resolveAyushLine({ name }, lines.length, 'reported');
      if (ay.ayush?.formulation && !onListAyush.has(ay.ayush.formulation.id)) { onListAyush.add(ay.ayush.formulation.id); lines.push(ay); continue; }
      if (!ay.ayush?.formulation) unrecognisedReported.push(name);
    }
    for (const d of options.diet || []) {
      const l = resolveAyushLine({ name: d }, lines.length, 'prescribed', 'diet');
      if (l.ayush && (l.ayush.flags.has('antiplatelet') || l.ayush.flags.has('glycyrrhizin') || l.ayush.flags.has('alcohol'))) lines.push(l);
    }
    const engine = evaluateSafety(lines, {
      age: ctx?.age, gender: ctx?.gender, isPregnant: ctx?.isPregnant, pregnancyStatus: (ctx as any)?.pregnancyStatus, gestationalWeeks: ctx?.gestationalWeeks, isLactating: ctx?.isLactating,
      eGfr: ctx?.eGfr, weightKg: ctx?.weightKg, isDiabetic: ctx?.isDiabetic, allergies: ctx?.allergies, conditions: ctx?.conditions, teleconsult: ctx?.teleconsult
    });

    // Annotate the earlier layers' alerts with lines, family, tier and group.
    const findLines = (term: string): number[] => {
      const t = cleanName(term);
      if (!t || t.length < 3) return [];
      return lines.filter(l => {
        const names = [cleanName(l.raw), cleanName(l.ayush?.name || ''), ...l.components.map(c => cleanName(c.name)), cleanName(l.anupana || '')].filter(Boolean);
        return names.some(n => n.includes(t) || (n.length >= 4 && t.includes(n)));
      }).map(l => l.index);
    };
    for (const a of alerts) {
      const family = legacyFamily(a.alertId, a.itemA);
      const lineRefs = Array.from(new Set([...findLines(a.itemA), ...findLines(a.itemB)]));
      Object.assign(a, {
        tier: tierForSeverity(a.severity),
        family,
        lineRefs,
        groupKey: groupKeyOf(family, lineRefs),
        source: a.alertId.startsWith('INT-') ? 'registry' : a.alertId.startsWith('ONT-') ? 'ontology' : 'ayush_engine'
      });
    }
    const tierRank: Record<string, number> = { STOP: 0, WARN: 1, INFO: 2 };
    for (const n of engine.alerts) {
      const sameGroup = alerts.filter(a => a.groupKey === n.groupKey);
      // An earlier-layer alert on the same lines and family stands, unless the new rule is stricter.
      if (sameGroup.some(a => tierRank[a.tier || 'WARN'] <= tierRank[n.tier])) continue;
      alerts.push(n as ConflictAlert);
    }
    // A herb–drug alert that names every formulation carrying the herb replaces the earlier layers'
    // per-formulation copies of the same interaction (unless one of those is stricter).
    for (const n of engine.alerts.filter(x => x.family === 'herb_drug' && x.lineRefs.length > 2)) {
      for (let i = alerts.length - 1; i >= 0; i--) {
        const a = alerts[i];
        if (a === (n as any) || a.family !== 'herb_drug' || !a.lineRefs?.length) continue;
        if (a.lineRefs.every(r => n.lineRefs.includes(r)) && tierRank[a.tier || 'WARN'] >= tierRank[n.tier] && alerts.includes(n as any)) alerts.splice(i, 1);
      }
    }
    checks.push({ check: 'allergy', ran: ctx?.allergies !== undefined, detail: ctx?.allergies === undefined ? 'allergy history not on file' : ctx.allergies.length ? ctx.allergies.map(a => a.agent).join(', ') : 'no known allergies' });
    checks.push({ check: 'duplicate_therapy', ran: true });
    checks.push({ check: 'drug_drug', ran: true, detail: 'pairs and list-level combinations' });
    checks.push({ check: 'dose_ceiling', ran: true, detail: ctx?.age !== undefined && ctx.age < 12 ? (ctx.weightKg ? `weight-based (${ctx.weightKg} kg)` : 'weight missing') : 'adult maximum daily dose' });
    checks.push({ check: 'banned_fdc', ran: true, detail: 'Section 26A notifications (Aug 2024, Jun 2023)' });
    checks.push({ check: 'conditions', ran: !!ctx?.conditions?.length, detail: ctx?.conditions?.length ? ctx.conditions.join(', ') : 'no conditions on file' });
    checks.push({ check: 'stewardship', ran: true, detail: 'WHO AWaRe; antibiotic indication' });

    const rank: Record<string, number> = { CRITICAL_CONTRAINDICATION: 0, STATUTORY_SCHEDULE_E1: 3, WARNING: 1, AYUSH_INCOMPATIBILITY: 2, INFO: 4 };
    alerts.sort((a, b) => (tierRank[a.tier || 'WARN'] - tierRank[b.tier || 'WARN']) || ((rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)));

    const stopMap = new Map<string, ConflictAlert[]>();
    for (const a of alerts) if (a.tier === 'STOP' && a.groupKey) stopMap.set(a.groupKey, [...(stopMap.get(a.groupKey) || []), a]);
    const stopGroups = Array.from(stopMap.entries()).map(([groupKey, list]) => ({ groupKey, alertIds: list.map(a => a.alertId), summary: `${list[0].itemA} × ${list[0].itemB}` }));
    const coverage: SafetyCoverage = { ...engine.coverage, unresolved: [...engine.coverage.unresolved, ...unrecognisedReported.map(name => ({ line: -1, name: `${name} (reported)` }))] };
    const resolvedLines = lines.map(l => {
      const concepts = l.conceptIds.map(id => drugById(id)).filter(Boolean) as any[];
      return {
        index: l.index, raw: l.raw, kind: l.kind, role: l.role,
        generics: l.kind === 'allopathic' ? concepts.map(c => c.inn) : (l.ayush?.formulation ? [l.ayush.formulation.name] : []),
        unresolved: l.unresolved,
        schedule: concepts.map(c => c.ndps ? 'NDPS' : c.schedule).filter(Boolean),
        aware: concepts.map(c => c.aware).filter(Boolean),
        scheduleE1: l.ayush?.formulation && l.ayush.flags.has('schedule_e1') ? constituentsWithFlag(l.ayush.formulation, 'schedule_e1') : undefined
      };
    });
    return { alerts, contextUsed: ctx, checks, itemsConsidered: { drugs: drugs.names, herbs: herbNames, ignoredAsNegated: [...drugs.negated, ...herbs.negated] }, coverage, stopGroups, resolvedLines };
  }

  static evaluatePrescriptions(allopathicList: (AllopathicMedication | any)[] = [], ayushList: (AyushFormulation | any)[] = [], patientContext?: PatientClinicalContext | null, options: EvaluateOptions = {}): ConflictAlert[] {
    return this.evaluatePrescriptionsDetailed(allopathicList, ayushList, patientContext, options).alerts;
  }

  static checkSingleCandidate(candidateName: string, existingAllopathic: string[] = [], existingAyush: string[] = [], patientContext?: PatientClinicalContext | null): ConflictAlert[] {
    return this.evaluatePrescriptions([...existingAllopathic, candidateName], existingAyush, patientContext);
  }
}
