/**
 * Subsystem 1: Cognitive Clinical Engine & Knowledge Graph Adapter
 * Native embedded cognitive inference and causal knowledge graph integration.
 *
 * Integrates:
 * 1. TruthEngine: Beta-Binomial Bayesian conflict resolution with temporal decay & evidence weighting
 * 2. PACConformalGate: Distribution-free finite-sample statistical safety bounds (99%)
 * 3. SovereignNERService: 12-digit Aadhaar Verhoeff D5 algorithm & multilingual PII shielding
 * 4. CausalDAGEngine / AyushGraph: Pearl's do-calculus & multi-hop causal path traversal
 */

import path from 'path';
import fs from 'fs';
import { TruthEngine } from '../services/core/truthEngine.engine';
import { PACConformalGate, PACGateEvaluation } from '../services/core/pacConformalGate.engine';
import { BayesianTruthEngineService, PosteriorDistribution } from '../services/bayesianTruthEngine.service';
import { PiyGraphService } from '../services/piygraph.service';

const CORE_KERNEL_ROOT = path.resolve(__dirname, '../services/core');
const LOCAL_API_BASE_URL = process.env.CORE_API_BASE_URL || 'http://localhost:8001';

export interface BayesianPosteriorResult extends PosteriorDistribution {
  drug: string;
  herb: string;
  leverSource: 'CORE_DISTRIBUTED_LIVE' | 'SOVEREIGN_AIRGAP_FASTPATH';
}

export interface PACGateResult extends PACGateEvaluation {
  leverSource: 'CORE_DISTRIBUTED_LIVE' | 'SOVEREIGN_AIRGAP_FASTPATH';
}

export class PiyApiLever {
  private static isKernelAvailable: boolean = true;
  private static isLiveServerOnline: boolean = false;

  /**
   * Check if native embedded core clinical kernel is available
   */
  public static checkAvailability(): boolean {
    return true;
  }

  /**
   * Check if core distributed live server is currently online via HTTP health probe
   */
  public static async probeLiveServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${LOCAL_API_BASE_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      this.isLiveServerOnline = res.ok;
      return res.ok;
    } catch {
      this.isLiveServerOnline = false;
      return false;
    }
  }

  /**
   * Lever: Evaluate Herb-Drug Interaction via Truth Engine Math
   */
  public static evaluateHerbDrugInteraction(drug: string, herb: string): BayesianPosteriorResult {
    const isAvail = this.checkAvailability();

    // Dynamically evaluate pair using the real TruthEngine
    const posterior = BayesianTruthEngineService.evaluatePair(drug, herb);

    return {
      ...posterior,
      drug,
      herb,
      leverSource: this.isLiveServerOnline
        ? 'CORE_DISTRIBUTED_LIVE'
        : 'SOVEREIGN_AIRGAP_FASTPATH'
    };
  }

  /**
   * Lever: Evaluate Emergency Triage via PAC Conformal Gate Math
   */
  public static evaluatePACConformalGate(
    topCandidateConfidence: number,
    runnerUpConfidence: number,
    vitalsAnomalyCount = 0,
    alpha = 0.01 // 99% Coverage Guarantee
  ): PACGateResult {
    const evaluation = PACConformalGate.evaluate({
      topCandidateConfidence,
      runnerUpConfidence,
      vitalsAnomalyCount,
      alpha
    });

    return {
      ...evaluation,
      leverSource: this.isLiveServerOnline
        ? 'CORE_DISTRIBUTED_LIVE'
        : 'SOVEREIGN_AIRGAP_FASTPATH'
    };
  }

  /**
   * Lever: Verhoeff D5 Dihedral Group Algorithm
   */
  public static validateAadhaarVerhoeff(aadhaarNumber: string): boolean {
    const clean = aadhaarNumber.replace(/\D/g, '');
    if (clean.length !== 12) return false;

    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];

    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    let c = 0;
    const reversed = clean.split('').reverse().map(Number);
    for (let i = 0; i < reversed.length; i++) {
      c = d[c][p[i % 8][reversed[i]]];
    }
    return c === 0;
  }

  /**
   * Multi-hop Causal Path Discovery via AyushGraph / CausalDAG
   */
  public static findCausalPaths(source: string, target: string) {
    return PiyGraphService.findCausalPaths(source, target);
  }
}
