/**
 * Causal DAG engine (Pearl-style association / intervention / counterfactual queries over a
 * curated, cited knowledge graph).
 *
 * What this is: a directed acyclic graph of mechanism edges (herb → CYP enzyme → drug, formulation
 * → disease, dosha → agni → dhatu → disease) with weighted path search, graph surgery for do(X)
 * queries, and a counterfactual substitution helper that only reasons over edges that exist.
 *
 * What this is not: a learned causal model. Edge strengths are curated evidence weights from
 * `shared/drug_interactions.json` and `shared/ayush_ontology.json`; the engine never invents an
 * edge, a strength or an efficacy claim. When the graph has no data for a query it says so.
 *
 * Reference: Pearl, J. (2009). Causality: Models, Reasoning, and Inference (2nd ed.), ch. 1, 3, 7.
 */

export type CausalRelationType =
  | 'CAUSED_BY'
  | 'LED_TO'
  | 'ENABLED'
  | 'PREVENTED'
  | 'RESULTED_IN'
  | 'DEPENDS_ON'
  | 'REQUIRES'
  | 'INHIBITS_CYP'
  | 'INDUCES_CYP'
  | 'POTENTIATES'
  | 'ANTAGONIZES'
  | 'SYNERGISTIC_WITH'
  | 'CONTRADICTS'
  | 'VITIATES'
  | 'PACIFIES'
  | 'LOCATED_IN';

export interface CausalEdge {
  id: string;
  sourceEntityId: string;
  sourceName: string;
  relation: CausalRelationType;
  targetEntityId: string;
  targetName: string;
  strength: number; // [0.0 - 1.0], curated evidence weight
  mechanismDescription?: string;
  evidenceSource?: string;
}

export interface CausalPath {
  nodes: string[];
  edges: CausalEdge[];
  aggregateStrength: number; // product of edge strengths along the path
}

export interface CounterfactualQuery {
  factualObservation: { drugOrHerb: string; targetCondition: string };
  hypotheticalSubstitution: { substituteItem: string };
}

export interface CounterfactualResult {
  /** Strongest harm path from the original item to the target condition, or null when none exists. */
  originalRiskProbability: number | null;
  /** Strongest harm path from the substitute to the target condition, or null when the substitute is unknown. */
  substitutedRiskProbability: number | null;
  /** True only when the substitute shares at least one PACIFIES target with the original item. */
  therapeuticEfficacyPreserved: boolean | null;
  recommendedSubstitution: string | null;
  evidence: 'GRAPH' | 'NO_DATA_FOR_SUBSTITUTE' | 'NO_DATA_FOR_ORIGINAL';
  clinicalExplanation: string;
}

const RISK_RELATIONS = new Set<CausalRelationType>(['INHIBITS_CYP', 'INDUCES_CYP', 'POTENTIATES', 'SYNERGISTIC_WITH', 'CONTRADICTS', 'ANTAGONIZES', 'VITIATES', 'CAUSED_BY', 'LED_TO', 'RESULTED_IN']);

export class CausalDAGEngine {
  private edges: CausalEdge[] = [];
  private adjacency = new Map<string, CausalEdge[]>();
  private reverseAdjacency = new Map<string, CausalEdge[]>();

  /** True when adding source → target keeps the graph acyclic (no existing path target → source). */
  validateAcyclicity(source: string, target: string): boolean {
    if (source === target) return false;
    const seen = new Set<string>();
    const stack = [target];
    while (stack.length) {
      const node = stack.pop()!;
      if (node === source) return false;
      if (seen.has(node)) continue;
      seen.add(node);
      for (const e of this.adjacency.get(node) || []) stack.push(e.targetEntityId);
    }
    return true;
  }

  addCausalEdge(edge: CausalEdge): boolean {
    if (!this.validateAcyclicity(edge.sourceEntityId, edge.targetEntityId)) {
      console.warn(`[CausalDAG] Acyclic invariant violated: ${edge.sourceEntityId} -> ${edge.targetEntityId}. Edge rejected.`);
      return false;
    }
    const duplicate = this.edges.some(e => e.sourceEntityId === edge.sourceEntityId && e.targetEntityId === edge.targetEntityId && e.relation === edge.relation);
    if (!duplicate) {
      this.edges.push(edge);
      if (!this.adjacency.has(edge.sourceEntityId)) this.adjacency.set(edge.sourceEntityId, []);
      this.adjacency.get(edge.sourceEntityId)!.push(edge);
      if (!this.reverseAdjacency.has(edge.targetEntityId)) this.reverseAdjacency.set(edge.targetEntityId, []);
      this.reverseAdjacency.get(edge.targetEntityId)!.push(edge);
    }
    return true;
  }

  addEdge(source: string, target: string, strength = 1, relation: CausalRelationType = 'CAUSED_BY', mechanism?: string, sourceRef?: string): boolean {
    return this.addCausalEdge({
      id: `causal_${source}_${target}_${relation}`,
      sourceEntityId: source,
      sourceName: source,
      relation,
      targetEntityId: target,
      targetName: target,
      strength: Math.max(0, Math.min(1, strength)),
      mechanismDescription: mechanism || `${source} ${relation} ${target}`,
      evidenceSource: sourceRef || 'Curated knowledge graph'
    });
  }

  /** All simple paths source → target up to maxDepth, strongest first. */
  findCausalChain(source: string, target: string, maxDepth = 6): CausalPath[] {
    if (!source || !target || source === target) return [];
    const out: CausalPath[] = [];
    const onPath = new Set<string>();
    const walk = (node: string, names: string[], edges: CausalEdge[], strength: number, depth: number) => {
      if (depth > 0 && node === target) {
        out.push({ nodes: [...names], edges: [...edges], aggregateStrength: parseFloat(strength.toFixed(4)) });
        return;
      }
      if (depth >= maxDepth) return;
      onPath.add(node);
      for (const e of this.adjacency.get(node) || []) {
        if (onPath.has(e.targetEntityId)) continue;
        walk(e.targetEntityId, [...names, e.targetName], [...edges, e], strength * e.strength, depth + 1);
      }
      onPath.delete(node);
    };
    walk(source, [source], [], 1, 0);
    return out.sort((a, b) => b.aggregateStrength - a.aggregateStrength);
  }

  /** do(X): remove every incoming edge of the intervened nodes (Pearl's graph surgery). */
  applyGraphSurgery(cutInterventions: string[]): CausalDAGEngine {
    const cut = new Set(cutInterventions.map(s => s.toLowerCase()));
    const g = new CausalDAGEngine();
    for (const e of this.edges) if (!cut.has(e.targetEntityId.toLowerCase())) g.addCausalEdge(e);
    return g;
  }

  evaluateIntervention(interventionNode: string, targetOutcome: string): { reachable: boolean; causalEffect: number; downstreamAffectedNodes: string[] } {
    const paths = this.applyGraphSurgery([interventionNode]).findCausalChain(interventionNode, targetOutcome, 5);
    if (!paths.length) return { reachable: false, causalEffect: 0, downstreamAffectedNodes: [] };
    return {
      reachable: true,
      causalEffect: paths[0].aggregateStrength,
      downstreamAffectedNodes: Array.from(new Set(paths.flatMap(p => p.nodes)))
    };
  }

  /** Strongest path made only of risk-type relations (a PACIFIES path is not a harm path). */
  private strongestRiskPath(from: string, to: string, maxDepth = 4): CausalPath | null {
    const paths = this.findCausalChain(from, to, maxDepth).filter(p => p.edges.every(e => RISK_RELATIONS.has(e.relation)));
    return paths[0] || null;
  }

  /** Targets the node pacifies / treats according to the graph. */
  pacifiedTargets(node: string): Set<string> {
    const out = new Set<string>();
    for (const e of this.adjacency.get(node) || []) if (e.relation === 'PACIFIES' || e.relation === 'PREVENTED') out.add(e.targetEntityId);
    return out;
  }

  hasNode(id: string): boolean {
    return this.adjacency.has(id) || this.reverseAdjacency.has(id);
  }

  /**
   * Counterfactual substitution restricted to what the graph knows. Risk is the strongest harm
   * path to the target condition; efficacy is judged by shared PACIFIES targets. Unknown items
   * produce `null`, never a made-up number.
   */
  evaluateCounterfactual(query: CounterfactualQuery): CounterfactualResult {
    const { factualObservation: f, hypotheticalSubstitution: h } = query;
    const originalKnown = this.hasNode(f.drugOrHerb);
    const substituteKnown = this.hasNode(h.substituteItem);
    if (!originalKnown) {
      return {
        originalRiskProbability: null, substitutedRiskProbability: null, therapeuticEfficacyPreserved: null,
        recommendedSubstitution: null, evidence: 'NO_DATA_FOR_ORIGINAL',
        clinicalExplanation: `The knowledge graph has no edges for "${f.drugOrHerb}"; no counterfactual can be computed.`
      };
    }
    const originalPath = this.strongestRiskPath(f.drugOrHerb, f.targetCondition);
    const originalRisk = originalPath ? originalPath.aggregateStrength : 0;
    if (!substituteKnown) {
      return {
        originalRiskProbability: originalRisk, substitutedRiskProbability: null, therapeuticEfficacyPreserved: null,
        recommendedSubstitution: null, evidence: 'NO_DATA_FOR_SUBSTITUTE',
        clinicalExplanation: `"${h.substituteItem}" is not in the knowledge graph, so its risk and efficacy cannot be assessed. Do not treat it as a validated substitute.`
      };
    }
    const substitutePath = this.strongestRiskPath(h.substituteItem, f.targetCondition);
    const substituteRisk = substitutePath ? substitutePath.aggregateStrength : 0;
    const originalTargets = this.pacifiedTargets(f.drugOrHerb);
    const shared = Array.from(this.pacifiedTargets(h.substituteItem)).filter(t => originalTargets.has(t));
    const efficacy = originalTargets.size === 0 ? null : shared.length > 0;
    const delta = originalRisk - substituteRisk;
    return {
      originalRiskProbability: parseFloat(originalRisk.toFixed(4)),
      substitutedRiskProbability: parseFloat(substituteRisk.toFixed(4)),
      therapeuticEfficacyPreserved: efficacy,
      recommendedSubstitution: delta > 0 && efficacy !== false ? h.substituteItem : null,
      evidence: 'GRAPH',
      clinicalExplanation: delta > 0
        ? `Along the graph, ${h.substituteItem} has ${substituteRisk === 0 ? 'no known harm path' : `a weaker harm path (${substituteRisk.toFixed(2)} vs ${originalRisk.toFixed(2)})`} to ${f.targetCondition}` +
          (efficacy === true ? ` and shares ${shared.length} indication(s) with ${f.drugOrHerb}.` : efficacy === false ? `, but it does not share any recorded indication with ${f.drugOrHerb}.` : '.')
        : `${h.substituteItem} does not reduce the known harm path to ${f.targetCondition}.`
    };
  }

  getStats(): { nodeCount: number; edgeCount: number } {
    const nodes = new Set<string>();
    for (const e of this.edges) { nodes.add(e.sourceEntityId); nodes.add(e.targetEntityId); }
    return { nodeCount: nodes.size, edgeCount: this.edges.length };
  }

  getAllEdges(): CausalEdge[] {
    return [...this.edges];
  }

  clear(): void {
    this.edges = [];
    this.adjacency.clear();
    this.reverseAdjacency.clear();
  }
}

export type ICausalDAGEngine = CausalDAGEngine;
