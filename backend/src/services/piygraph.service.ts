/**
 * Clinical knowledge graph (Ayush + modern pharmacology) with causal path search.
 *
 * Hydrated from shared/ayush_ontology.json (diseases, classical formulations that pacify them)
 * and shared/drug_interactions.json (mechanism edges herb → drug with cited evidence weights).
 * Every answer is derived from edges in the graph; when the graph has no data the answer says so.
 */

import { CausalDAGEngine, CausalEdge, CounterfactualResult } from './core/causalDAG.engine';
import drugInteractions from '../shared/drug_interactions.json';
import ayushOntology from '../shared/ayush_ontology.json';

export interface GraphNode {
  id: string;
  type: 'DOSHA' | 'SUBDOSHA' | 'DHATU' | 'SROTAS' | 'AGNI' | 'DISEASE' | 'HERB' | 'DRUG' | 'SYMPTOM';
  label: string;
  namasteCode?: string;
  icd11Code?: string;
  metadata?: Record<string, any>;
}

export interface GraphCausalPath {
  source: string;
  target: string;
  path: string[];
  cumulativeWeight: number;
  mechanisms: string[];
  nodes: string[];
  edges: CausalEdge[];
  aggregateStrength: number;
}

export interface SubstitutionCandidate {
  nodeId: string;
  label: string;
  sharedIndications: string[];
  harmPathToDrug: number; // 0 when the graph has no risk path to the drug
}

export interface CounterfactualSubstitution extends CounterfactualResult {
  candidates: SubstitutionCandidate[];
  method: 'graph-grounded';
}

const slug = (s: string) => s.toLowerCase().replace(/[\s/()\-]+/g, '_');

export class PiyGraphService {
  private static causalDAG = new CausalDAGEngine();
  private static nodes: Map<string, GraphNode> = new Map();
  private static aliasMap: Map<string, Set<string>> = new Map(); // lower-case alias -> node ids
  private static outgoingEdges: Map<string, Array<{ targetId: string; weight: number; predicate: string; mechanism?: string }>> = new Map();
  private static initialized = false;

  private static alias(name: string, id: string): void {
    const k = name.toLowerCase().trim();
    if (!k) return;
    if (!this.aliasMap.has(k)) this.aliasMap.set(k, new Set());
    this.aliasMap.get(k)!.add(id);
  }

  /** All node ids a term can refer to (exact id, exact alias, then guarded substring match). */
  static resolveNodeIds(term: string): string[] {
    this.initialize();
    const clean = String(term || '').trim().toLowerCase();
    if (!clean) return [];
    const out = new Set<string>();
    for (const id of [clean, `drug_${clean}`, `herb_${clean}`, `dis_${clean}`]) if (this.nodes.has(id)) out.add(id);
    for (const id of this.aliasMap.get(clean) || []) out.add(id);
    if (out.size) return Array.from(out);
    for (const [alias, ids] of this.aliasMap) {
      if ((alias.length >= 4 && clean.includes(alias)) || (clean.length >= 4 && alias.includes(clean))) for (const id of ids) out.add(id);
    }
    if (out.size) return Array.from(out);
    for (const [id, node] of this.nodes) if (node.label.toLowerCase().includes(clean)) out.add(id);
    return Array.from(out);
  }

  /** First matching node id (prefers registry drug/herb nodes, then ontology nodes). */
  static resolveNodeId(term: string): string | null {
    const ids = this.resolveNodeIds(term);
    if (!ids.length) return null;
    return ids.find(i => i.startsWith('drug_')) || ids.find(i => i.startsWith('herb_')) || ids[0];
  }

  static initialize(): void {
    if (this.initialized) return;

    for (const d of [
      { id: 'dosha_vata', label: 'Vata Dosha' }, { id: 'dosha_pitta', label: 'Pitta Dosha' }, { id: 'dosha_kapha', label: 'Kapha Dosha' }
    ]) this.addNode({ id: d.id, type: 'DOSHA', label: d.label });
    for (const a of [
      { id: 'agni_samagni', label: 'Samagni (balanced)' }, { id: 'agni_vishamagni', label: 'Vishamagni (irregular, Vata)' },
      { id: 'agni_tikshnagni', label: 'Tikshnagni (hyperactive, Pitta)' }, { id: 'agni_mandagni', label: 'Mandagni (hypoactive, Kapha)' }
    ]) this.addNode({ id: a.id, type: 'AGNI', label: a.label });
    for (const dh of [
      { id: 'dhatu_rasa', label: 'Rasa Dhatu' }, { id: 'dhatu_rakta', label: 'Rakta Dhatu' }, { id: 'dhatu_medas', label: 'Medas Dhatu' },
      { id: 'dhatu_asthi', label: 'Asthi Dhatu' }, { id: 'dhatu_majja', label: 'Majja Dhatu' }
    ]) this.addNode({ id: dh.id, type: 'DHATU', label: dh.label });

    // Diseases and the classical formulations that pacify them (AFI / NAMASTE seed).
    for (const entry of ayushOntology.namasteEntries) {
      const disId = `dis_${slug(entry.sanskritTerm)}`;
      this.addNode({ id: disId, type: 'DISEASE', label: `${entry.sanskritTerm} (${entry.englishEquivalent})`, namasteCode: entry.aCode, icd11Code: entry.icd10DualCode });
      this.alias(entry.sanskritTerm, disId);
      this.alias(entry.englishEquivalent, disId);
      this.alias(entry.aCode, disId);
      for (const formName of entry.classicalFormulations) {
        const herbId = `herb_${slug(formName)}`;
        this.addNode({ id: herbId, type: 'HERB', label: formName, metadata: { recommendedAnupana: entry.recommendedAnupana } });
        this.alias(formName, herbId);
        this.addEdge({ sourceId: herbId, targetId: disId, predicate: 'PACIFIES', weight: 0.9, mechanism: `${formName} is indicated for ${entry.sanskritTerm} (AFI)`, evidenceSource: 'Ayurvedic Formulary of India' });
      }
    }

    // Mechanism edges from the cited interaction registry.
    for (const rule of drugInteractions.interactions) {
      const drugId = `drug_${slug(rule.itemA)}`;
      const herbId = `herb_${slug(rule.itemB)}`;
      this.addNode({ id: drugId, type: 'DRUG', label: rule.itemA, metadata: { severity: rule.severity } });
      this.alias(rule.itemA, drugId);
      for (const al of rule.aliasesA || []) this.alias(al, drugId);
      this.addNode({ id: herbId, type: 'HERB', label: rule.itemB, metadata: { severity: rule.severity, clinicalAction: rule.clinicalAction } });
      this.alias(rule.itemB, herbId);
      for (const al of rule.aliasesB || []) this.alias(al, herbId);

      let predicate = 'INHIBITS_CYP';
      const m = rule.mechanism.toLowerCase();
      if (rule.type === 'VIRUDDHA_AHARA') predicate = 'CONTRADICTS';
      else if (m.includes('synerg')) predicate = 'SYNERGISTIC_WITH';
      else if (m.includes('inhib')) predicate = 'INHIBITS_CYP';
      else if (m.includes('induc')) predicate = 'INDUCES_CYP';
      else if (m.includes('potentiat')) predicate = 'POTENTIATES';
      else if (rule.severity === 'SAFE_COMBINATION') predicate = 'PACIFIES';
      this.addEdge({ sourceId: herbId, targetId: drugId, predicate, weight: rule.evidenceScore || 0.9, mechanism: rule.mechanism, evidenceSource: rule.citation });
    }

    this.addEdge({ sourceId: 'dosha_vata', targetId: 'agni_vishamagni', predicate: 'VITIATES', weight: 0.92, mechanism: 'Vata vitiation disturbs agni', evidenceSource: 'Charaka Samhita, Chikitsa Sthana 15' });
    this.addEdge({ sourceId: 'agni_vishamagni', targetId: 'dhatu_asthi', predicate: 'VITIATES', weight: 0.88, mechanism: 'Irregular agni impairs dhatu nourishment', evidenceSource: 'Charaka Samhita, Chikitsa Sthana 15' });
    this.addEdge({ sourceId: 'dhatu_asthi', targetId: 'dis_sandhivata', predicate: 'LOCATED_IN', weight: 0.95, mechanism: 'Asthi dhatu kshaya manifests at joints', evidenceSource: 'Charaka Samhita, Chikitsa Sthana 28' });

    this.initialized = true;
    console.log(`[PiyGraph] Knowledge graph ready: ${this.nodes.size} nodes, ${this.causalDAG.getAllEdges().length} edges.`);
  }

  static addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
    if (!this.outgoingEdges.has(node.id)) this.outgoingEdges.set(node.id, []);
  }

  static addEdge(edge: { sourceId: string; targetId: string; predicate: any; weight: number; mechanism?: string; evidenceSource?: string }): void {
    if (!this.outgoingEdges.has(edge.sourceId)) this.outgoingEdges.set(edge.sourceId, []);
    this.outgoingEdges.get(edge.sourceId)!.push({ targetId: edge.targetId, weight: edge.weight, predicate: edge.predicate, mechanism: edge.mechanism });
    this.causalDAG.addEdge(edge.sourceId, edge.targetId, edge.weight, edge.predicate, edge.mechanism, edge.evidenceSource);
  }

  static getNode(id: string): GraphNode | undefined {
    this.initialize();
    return this.nodes.get(id);
  }

  static findCausalPaths(sourceId: string, targetId: string, maxDepth = 4): GraphCausalPath[] {
    this.initialize();
    const sources = this.resolveNodeIds(sourceId);
    const targets = this.resolveNodeIds(targetId);
    const pairs: Array<[string, string]> = [];
    for (const s of sources.length ? sources : [sourceId]) for (const t of targets.length ? targets : [targetId]) pairs.push([s, t], [t, s]);
    const out: GraphCausalPath[] = [];
    for (const [s, t] of pairs) {
      for (const c of this.causalDAG.findCausalChain(s, t, maxDepth)) {
        out.push({
          source: s, target: t, path: c.nodes, cumulativeWeight: c.aggregateStrength,
          mechanisms: c.edges.map(e => e.mechanismDescription || `${e.sourceName} ${e.relation} ${e.targetName}`),
          nodes: c.nodes, edges: c.edges, aggregateStrength: c.aggregateStrength
        });
      }
    }
    return out.sort((a, b) => b.aggregateStrength - a.aggregateStrength);
  }

  static evaluateIntervention(interventionId: string, targetOutcomeId: string) {
    this.initialize();
    return this.causalDAG.evaluateIntervention(this.resolveNodeId(interventionId) || interventionId, this.resolveNodeId(targetOutcomeId) || targetOutcomeId);
  }

  /** Diseases a formulation is indicated for, by node id. */
  private static indicationsOf(nodeIds: string[]): Set<string> {
    const out = new Set<string>();
    for (const id of nodeIds) for (const t of this.causalDAG.pacifiedTargets(id)) if (t.startsWith('dis_')) out.add(t);
    return out;
  }

  private static harmPath(fromIds: string[], toIds: string[]): number {
    let best = 0;
    for (const f of fromIds) for (const t of toIds) {
      for (const p of this.causalDAG.findCausalChain(f, t, 4)) {
        if (p.edges.every(e => e.relation !== 'PACIFIES' && e.relation !== 'LOCATED_IN')) best = Math.max(best, p.aggregateStrength);
      }
    }
    return best;
  }

  /**
   * Substitutes for `problematicHerb` that keep at least one of its indications (per the AFI seed)
   * and have no recorded harm path to `drug`. Nothing outside the graph is ever recommended.
   */
  static evaluateCounterfactualSubstitution(problematicHerb: string, drug: string, proposedAlternative?: string): CounterfactualSubstitution {
    this.initialize();
    const herbIds = this.resolveNodeIds(problematicHerb);
    const drugIds = this.resolveNodeIds(drug);
    const base: CounterfactualResult = this.causalDAG.evaluateCounterfactual({
      factualObservation: { drugOrHerb: herbIds[0] || problematicHerb, targetCondition: drugIds[0] || drug },
      hypotheticalSubstitution: { substituteItem: proposedAlternative ? (this.resolveNodeId(proposedAlternative) || proposedAlternative) : '' }
    });
    const indications = this.indicationsOf(herbIds);
    const originalHarm = this.harmPath(herbIds, drugIds);
    const candidates: SubstitutionCandidate[] = [];
    if (indications.size) {
      const seen = new Set<string>();
      for (const [id, node] of this.nodes) {
        if (node.type !== 'HERB' || herbIds.includes(id) || seen.has(id)) continue;
        const shared = Array.from(this.causalDAG.pacifiedTargets(id)).filter(t => indications.has(t));
        if (!shared.length) continue;
        seen.add(id);
        candidates.push({ nodeId: id, label: node.label, sharedIndications: shared.map(s => this.nodes.get(s)?.label || s), harmPathToDrug: parseFloat(this.harmPath([id], drugIds).toFixed(4)) });
      }
      candidates.sort((a, b) => a.harmPathToDrug - b.harmPathToDrug || b.sharedIndications.length - a.sharedIndications.length);
    }
    const safe = candidates.filter(c => c.harmPathToDrug === 0);
    const recommended = proposedAlternative ? base.recommendedSubstitution : (safe[0]?.label ?? null);
    return {
      ...base,
      originalRiskProbability: herbIds.length ? parseFloat(originalHarm.toFixed(4)) : null,
      recommendedSubstitution: recommended,
      therapeuticEfficacyPreserved: proposedAlternative ? base.therapeuticEfficacyPreserved : (safe.length ? true : indications.size ? false : null),
      evidence: proposedAlternative ? base.evidence : herbIds.length ? 'GRAPH' : 'NO_DATA_FOR_ORIGINAL',
      clinicalExplanation: proposedAlternative
        ? base.clinicalExplanation
        : !herbIds.length
          ? `"${problematicHerb}" is not in the knowledge graph.`
          : !indications.size
            ? `The graph records no indication for ${problematicHerb}, so it cannot propose an equivalent; ask the vaidya to choose.`
            : safe.length
              ? `${safe.length} formulation(s) share an indication with ${problematicHerb} and have no recorded interaction path to ${drug}; first: ${safe[0].label}. Confirm suitability clinically.`
              : `Every formulation sharing an indication with ${problematicHerb} also has a recorded interaction path to ${drug}; no safe graph substitute.`,
      candidates: candidates.slice(0, 8),
      method: 'graph-grounded'
    };
  }

  /** Spreading activation (Anderson's ACT-R style) from seed nodes. */
  static spreadActivation(seedNodeIds: string[], steps = 3, decayGamma = 0.85): Map<string, number> {
    this.initialize();
    const act = new Map<string, number>();
    for (const raw of seedNodeIds) act.set(this.resolveNodeId(raw) || raw, 1.0);
    for (let s = 0; s < steps; s++) {
      const delta = new Map<string, number>();
      for (const [id, a] of act) for (const e of this.outgoingEdges.get(id) || []) delta.set(e.targetId, (delta.get(e.targetId) || 0) + a * e.weight * decayGamma);
      for (const [id, v] of delta) act.set(id, Math.min(2.0, (act.get(id) || 0) + v));
    }
    return act;
  }

  static getGraphStats(): { nodeCount: number; edgeCount: number } {
    this.initialize();
    return { nodeCount: this.nodes.size, edgeCount: this.causalDAG.getAllEdges().length };
  }

  /**
   * Additive pathway-load heuristic for polypharmacy. Each agent adds a fixed, documented load to
   * the pathways it is known to occupy; a pathway above 0.8 is flagged. This is a screening
   * heuristic with no probabilistic claim attached; the pairwise engines carry the evidence.
   */
  static evaluateHigherOrderPolypharmacy(allopathicList: any[], ayushList: any[]): HypergraphPolypharmacyResult {
    this.initialize();
    const names = [
      ...allopathicList.map(a => (typeof a === 'string' ? a : a?.name || a?.drugName || a?.genericName || '')),
      ...ayushList.map(b => (typeof b === 'string' ? b : b?.classicalName || b?.formulationName || b?.name || ''))
    ].map(s => String(s).toLowerCase());
    const has = (re: RegExp) => names.some(n => re.test(n));
    const hasAntiplatelet = has(/\b(aspirin|ecosprin|clopidogrel)\b/);
    const hasWarfarin = has(/\b(warfarin|coumadin|acenocoumarol|acitrom)\b/);
    const hasGuggulu = has(/guggul/);
    const hasGarlic = has(/\b(garlic|lashuna|allium|lasun)\b/);
    const hasStatin = has(/(?<!ny)statin\b/);
    const hasPiperine = has(/\b(pippali|piperine|trikatu)\b/);

    const load = (agents: Array<[boolean, string, number]>) => {
      const list = agents.filter(a => a[0]);
      return { level: Math.min(1, 0.05 + list.reduce((s, a) => s + a[2], 0)), agents: list.map(a => a[1]) };
    };
    const cyp2c9 = load([[hasWarfarin, 'Warfarin', 0.4], [hasAntiplatelet, 'Aspirin / antiplatelet', 0.2], [hasGuggulu, 'Guggulu (guggulsterones)', 0.35], [hasGarlic, 'Garlic (allicin)', 0.15]]);
    const cyp3a4 = load([[hasStatin, 'Statin', 0.4], [hasPiperine, 'Piperine (Pippali / Trikatu)', 0.45], [hasGuggulu, 'Guggulu', 0.15]]);
    const platelet = load([[hasAntiplatelet, 'Aspirin (COX-1)', 0.45], [hasWarfarin, 'Warfarin (VKORC1)', 0.35], [hasGuggulu, 'Guggulsterone antiplatelet effect', 0.25], [hasGarlic, 'Allicin', 0.2]]);

    const enzymes: EnzymeSaturation[] = [
      { enzyme: 'CYP2C9', saturationLevel: parseFloat(cyp2c9.level.toFixed(2)), isCritical: cyp2c9.level >= 0.8, contributingAgents: cyp2c9.agents },
      { enzyme: 'Platelet_IIb_IIIa', saturationLevel: parseFloat(platelet.level.toFixed(2)), isCritical: platelet.level >= 0.8, contributingAgents: platelet.agents },
      { enzyme: 'CYP3A4', saturationLevel: parseFloat(cyp3a4.level.toFixed(2)), isCritical: cyp3a4.level >= 0.8, contributingAgents: cyp3a4.agents }
    ];
    const cumulativeIndex = parseFloat(Math.max(cyp2c9.level, platelet.level, cyp3a4.level).toFixed(2));
    const coagulopathy = (hasWarfarin && hasGuggulu && (hasAntiplatelet || hasGarlic)) || (hasWarfarin && hasAntiplatelet && hasGarlic) || (platelet.level >= 0.85 && cyp2c9.level >= 0.8);
    const statinLoad = hasStatin && hasPiperine;
    const base = { enzymes, cumulativeSaturationIndex: cumulativeIndex, method: 'additive-pathway-load-heuristic' as const };

    if (coagulopathy) {
      return {
        ...base, hasHypergraphConflict: true, riskCategory: 'LETHAL_SYNERGISTIC_COAGULOPATHY',
        pathologyMechanism: 'Three or more agents converge on CYP2C9 clearance and platelet aggregation: bleeding risk is additive to synergistic (see pairwise alerts for citations).',
        bottleneck: 'CYP2C9 clearance and platelet aggregation both near saturation',
        recommendedSubstitution: { remove: [...(hasGuggulu ? ['Guggulu-containing formulation'] : []), ...(hasGarlic ? ['Garlic / Lashuna preparation'] : [])], substitute: [], clinicalRationale: 'Remove the Ayush agents that add to anticoagulant load; choose a replacement from the graph-grounded substitution list and re-check.' }
      };
    }
    if (statinLoad) {
      return {
        ...base, hasHypergraphConflict: true, riskCategory: 'HEPATIC_METABOLIC_BOTTLENECK',
        pathologyMechanism: 'Piperine inhibits intestinal P-gp and CYP3A4, raising statin exposure (pairwise rule INT-010 carries the citation).',
        bottleneck: 'CYP3A4 first-pass clearance',
        recommendedSubstitution: { remove: ['Pippali / Trikatu-containing formulation'], substitute: [], clinicalRationale: 'Avoid piperine bio-enhancers with statins; pick a replacement from the graph-grounded substitution list.' }
      };
    }
    return {
      ...base, hasHypergraphConflict: false, riskCategory: 'CLEAR',
      pathologyMechanism: 'No multi-agent pathway load above the screening threshold.',
      bottleneck: 'None',
      recommendedSubstitution: { remove: [], substitute: [], clinicalRationale: 'No change suggested by the multi-agent screen; pairwise alerts still apply.' }
    };
  }
}

export interface EnzymeSaturation {
  enzyme: 'CYP2C9' | 'CYP3A4' | 'CYP1A2' | 'CYP2D6' | 'Platelet_IIb_IIIa';
  saturationLevel: number;
  isCritical: boolean;
  contributingAgents: string[];
}

export interface HypergraphPolypharmacyResult {
  hasHypergraphConflict: boolean;
  cumulativeSaturationIndex: number;
  method: 'additive-pathway-load-heuristic';
  riskCategory: 'LETHAL_SYNERGISTIC_COAGULOPATHY' | 'HEPATIC_METABOLIC_BOTTLENECK' | 'MODERATE_ACCUMULATION' | 'CLEAR';
  pathologyMechanism: string;
  enzymes: EnzymeSaturation[];
  bottleneck: string;
  recommendedSubstitution: { remove: string[]; substitute: string[]; clinicalRationale: string };
}
