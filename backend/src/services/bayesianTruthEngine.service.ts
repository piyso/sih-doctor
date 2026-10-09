/**
 * Pair-level interaction belief = registry prior + locally recorded observations.
 *
 *  - Prior: when the pair matches a rule in shared/drug_interactions.json, its evidence score e
 *    becomes a Beta prior with K = 10 pseudo-observations: Beta(1 + K·e, 1 + K·(1 − e)) for an
 *    interaction rule, Beta(1 + K·(1 − e), 1 + K·e) for a SAFE_COMBINATION rule. Unknown pairs get
 *    the flat Beta(1, 1).
 *  - Observations: only rows from the `bayesian_observations` table (pharmacovigilance reports,
 *    clinician attestations). Nothing is synthesised.
 *
 * See core/truthEngine.engine.ts for the posterior and Bayes-factor definitions.
 */

import { TruthEngine, BayesianObservation as CoreObs, PosteriorDistribution, EvidenceMethod } from './core/truthEngine.engine';
import { db } from '../db/database';
import drugInteractions from '../shared/drug_interactions.json';
import { ClinicalOntologyEngine } from './core/clinicalOntology.engine';

export type { EvidenceMethod, PosteriorDistribution };

export interface BayesianObservation {
  id: string;
  drug: string;
  herb: string;
  supportsContraindication: boolean;
  reliability: number;
  method: EvidenceMethod;
  timestamp: string;
}

export interface PairEvidence extends PosteriorDistribution {
  prior: { source: 'registry' | 'flat'; ruleId?: string; evidenceScore?: number; citation?: string; pseudoObservations: number };
  observationsUsed: number;
}

const PSEUDO_OBS = 10;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_CACHE = new Map<string, RegExp>();
const wholeWord = (term: string): RegExp => {
  let re = RE_CACHE.get(term);
  if (!re) { re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.toLowerCase())}(?![\\p{L}\\p{N}])`, 'iu'); RE_CACHE.set(term, re); }
  return re;
};
const CANON_CACHE = new Map<string, string[]>();

/** Names a raw string can be matched under: the text itself plus its resolved molecule / formulation. */
export function canonicalNames(raw: string): string[] {
  const cached = CANON_CACHE.get(raw);
  if (cached) return cached;
  const out = new Set<string>([raw.toLowerCase().trim()]);
  const d = ClinicalOntologyEngine.resolveAllopathicConcept(raw);
  if (d) out.add(d.canonicalMolecule.toLowerCase());
  const a = ClinicalOntologyEngine.resolveAyushConcept(raw);
  if (a) out.add(a.formulationName.toLowerCase());
  const list = Array.from(out);
  if (CANON_CACHE.size > 5000) CANON_CACHE.clear();
  CANON_CACHE.set(raw, list);
  return list;
}

const termHits = (names: string[], term: string): boolean => names.some(n => wholeWord(term).test(n));

/** Find the registry rule for a pair, matching whole words in either order. */
export function findRegistryRule(a: string, b: string): (typeof drugInteractions.interactions)[number] | null {
  const na = canonicalNames(a);
  const nb = canonicalNames(b);
  for (const rule of drugInteractions.interactions) {
    const termsA = [rule.itemA, ...(rule.aliasesA || [])];
    const termsB = [rule.itemB, ...(rule.aliasesB || [])];
    const matchA = termsA.some(t => termHits(na, t));
    const matchB = termsB.some(t => termHits(nb, t));
    const revA = termsA.some(t => termHits(nb, t));
    const revB = termsB.some(t => termHits(na, t));
    if ((matchA && matchB) || (revA && revB)) return rule;
  }
  return null;
}

export class BayesianTruthEngineService {
  static computePosterior(drug: string, herb: string, observations: BayesianObservation[], prior?: { alpha: number; beta: number }): PosteriorDistribution {
    const core: CoreObs[] = observations.map(o => ({
      id: o.id, itemA: o.drug, itemB: o.herb, signal: o.supportsContraindication ? 'reinforce' : 'contradict',
      sourceReliability: o.reliability, method: o.method, createdAt: o.timestamp
    }));
    return TruthEngine.computePosterior(drug, herb, core, { prior });
  }

  /** Locally recorded observations for a pair (either order), newest first. */
  static storedObservations(drug: string, herb: string): BayesianObservation[] {
    const d = drug.toLowerCase().trim();
    const h = herb.toLowerCase().trim();
    let rows: any[] = [];
    try {
      rows = db.prepare(`
        SELECT * FROM bayesian_observations
        WHERE (LOWER(item_a) = ? AND LOWER(item_b) = ?) OR (LOWER(item_a) = ? AND LOWER(item_b) = ?)
        ORDER BY created_at DESC LIMIT 200
      `).all(d, h, h, d);
    } catch { rows = []; }
    return rows.map(r => ({
      id: r.id, drug: r.item_a, herb: r.item_b, supportsContraindication: r.signal === 'reinforce',
      reliability: Number(r.source_reliability) || 0, method: r.method as EvidenceMethod, timestamp: r.created_at
    }));
  }

  /** Record a real observation (a pharmacovigilance report or a clinician's attestation). */
  static recordObservation(input: { drug: string; herb: string; supportsContraindication: boolean; reliability: number; method: EvidenceMethod; id?: string }): string {
    const id = input.id || `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare('INSERT INTO bayesian_observations (id, item_a, item_b, signal, source_reliability, method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.drug, input.herb, input.supportsContraindication ? 'reinforce' : 'contradict', Math.max(0, Math.min(1, input.reliability)), input.method, new Date().toISOString());
    return id;
  }

  static evaluatePair(drugName: string, herbName: string): PairEvidence {
    const rule = findRegistryRule(drugName, herbName);
    let prior: PairEvidence['prior'] = { source: 'flat', pseudoObservations: 0 };
    let priorParams: { alpha: number; beta: number } | undefined;
    if (rule) {
      const e = Math.max(0.5, Math.min(0.99, Number(rule.evidenceScore) || 0.9));
      const safe = rule.severity === 'SAFE_COMBINATION';
      priorParams = safe
        ? { alpha: 1 + PSEUDO_OBS * (1 - e), beta: 1 + PSEUDO_OBS * e }
        : { alpha: 1 + PSEUDO_OBS * e, beta: 1 + PSEUDO_OBS * (1 - e) };
      prior = { source: 'registry', ruleId: rule.id, evidenceScore: e, citation: rule.citation, pseudoObservations: PSEUDO_OBS };
    }
    const observations = this.storedObservations(drugName, herbName);
    const posterior = this.computePosterior(drugName, herbName, observations, priorParams);
    return { ...posterior, prior, observationsUsed: observations.length };
  }
}
