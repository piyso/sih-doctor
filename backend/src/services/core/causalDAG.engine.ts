/**
 * Judea Pearl's Causal DAG & Counterfactual Engine
 * Native Causal DAG Subsystem
 *
 * Scientific Basis:
 * Judea Pearl (2000, 2009) "Causality: Models, Reasoning, and Inference"
 *
 * Provides Level 1 (Association), Level 2 (Intervention do(X)), and Level 3 (Counterfactuals)
 * for clinical pharmacology, herb-drug safety, and posology substitution.
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
  strength: number; // [0.0 - 1.0]
  mechanismDescription?: string;
  evidenceSource?: string;
}

export interface CausalPath {
  nodes: string[];
  edges: CausalEdge[];
  aggregateStrength: number;
}

export interface CounterfactualQuery {
  factualObservation: {
    drugOrHerb: string;
    targetCondition: string;
  };
  hypotheticalSubstitution: {
    substituteItem: string;
  };
}

export interface CounterfactualResult {
  originalRiskProbability: number;
  substitutedRiskProbability: number;
  therapeuticEfficacyPreserved: boolean;
  recommendedSubstitution: string;
  clinicalExplanation: string;
}

const kernel = require('./sovereign-kernel.cjs');

export interface ICausalDAGEngine {
  validateAcyclicity(source: string, target: string): boolean;
  addCausalEdge(edge: CausalEdge): boolean;
  addEdge(
    source: string,
    target: string,
    strength?: number,
    relation?: CausalRelationType,
    mechanism?: string,
    sourceRef?: string
  ): boolean;
  findCausalChain(source: string, target: string, maxDepth?: number): CausalPath[];
  applyGraphSurgery(cutInterventions: string[]): ICausalDAGEngine;
  evaluateIntervention(
    interventionNode: string,
    targetOutcome: string
  ): { reachable: boolean; causalEffect: number; downstreamAffectedNodes: string[] };
  evaluateCounterfactual(query: CounterfactualQuery): CounterfactualResult;
  getStats(): { nodeCount: number; edgeCount: number };
  getAllEdges(): CausalEdge[];
  clear(): void;
}

export const CausalDAGEngine: new () => ICausalDAGEngine = kernel.CausalDAGEngine;
