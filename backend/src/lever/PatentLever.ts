/**
 * Lever 3: Patent zk-SNARK & Hardware Arbiter Integration Adapter
 * Leverages the Real Groth16 / BN128 Circuit from /Users/piyushkumar/Desktop/patent
 *
 * Patent Identification:
 * Adaptive Distributed Memory Retrieval Apparatus with Reinforcement Learning
 * (IPO & USPTO Specification Section 5, Claims 1–43)
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const PATENT_CIRCUIT_ROOT = '/Users/piyushkumar/Desktop/patent/proof. and fixing/zkp_circuit';
const LOCAL_BACKUP_CIRCUIT_ROOT = [
  path.resolve(__dirname, '../data/zkp_circuit'),
  path.resolve(__dirname, '../../src/data/zkp_circuit'),
  path.resolve(__dirname, '../../dist/data/zkp_circuit'),
  path.resolve(process.cwd(), 'src/data/zkp_circuit'),
  path.resolve(process.cwd(), 'dist/data/zkp_circuit')
].find(p => fs.existsSync(p)) || path.resolve(__dirname, '../data/zkp_circuit');

const snarkjs = require('snarkjs');

export interface PatentZkVerificationResult {
  verified: boolean;
  protocol: string;
  curve: string;
  verificationLatencyMs: number;
  publicSignals: string[];
  patentClaimsCovered: string[];
  leverSource: 'PATENT_REPO_LIVE' | 'SOVEREIGN_LOCAL_BACKUP';
}

export class PatentLever {
  private static cachedVKey: any = null;
  private static cachedProof: any = null;
  private static cachedPublic: any = null;
  private static activeCircuitDir: string = LOCAL_BACKUP_CIRCUIT_ROOT;

  /**
   * Resolve best circuit assets (Patent repo primary, local backup fallback)
   */
  private static resolveAssets(): void {
    if (this.cachedVKey) return;

    let vKeyPath = path.join(PATENT_CIRCUIT_ROOT, 'verification_key.json');
    let proofPath = path.join(PATENT_CIRCUIT_ROOT, 'proof.json');
    let publicPath = path.join(PATENT_CIRCUIT_ROOT, 'public.json');

    if (fs.existsSync(vKeyPath) && fs.existsSync(proofPath)) {
      this.activeCircuitDir = PATENT_CIRCUIT_ROOT;
    } else {
      vKeyPath = path.join(LOCAL_BACKUP_CIRCUIT_ROOT, 'verification_key.json');
      proofPath = path.join(LOCAL_BACKUP_CIRCUIT_ROOT, 'proof.json');
      publicPath = path.join(LOCAL_BACKUP_CIRCUIT_ROOT, 'public.json');
      this.activeCircuitDir = LOCAL_BACKUP_CIRCUIT_ROOT;
    }

    if (fs.existsSync(vKeyPath)) {
      this.cachedVKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));
    }
    if (fs.existsSync(proofPath)) {
      this.cachedProof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    }
    if (fs.existsSync(publicPath)) {
      this.cachedPublic = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    }
  }

  /**
   * Verify a consultation cryptographic state proof using snarkjs Groth16 on BN128
   */
  public static async verifyConsultationIntegrity(
    proofObj?: any,
    publicSignals?: any[]
  ): Promise<PatentZkVerificationResult> {
    this.resolveAssets();

    const proof = proofObj || this.cachedProof;
    const signals = publicSignals || this.cachedPublic;

    const start = performance.now();
    let isVerified = false;

    if (this.cachedVKey && proof && signals) {
      try {
        isVerified = await snarkjs.groth16.verify(this.cachedVKey, signals, proof);
      } catch (err) {
        console.error('[PatentLever] Verification error:', err);
        isVerified = false;
      }
    }

    const latency = performance.now() - start;

    return {
      verified: isVerified,
      protocol: 'Groth16',
      curve: 'BN128 (alt_bn128)',
      verificationLatencyMs: parseFloat(latency.toFixed(2)),
      publicSignals: signals || ['1', '0'],
      patentClaimsCovered: [
        'Patent Claim 1: Zero-Knowledge Verification of Consultation State Invariance',
        'Patent Claim 14: Verhoeff D5 Identity Cryptographic Non-Linkability',
        'Patent Claim 27: Bayesian Conflict Soundness Proof without Exposing PHI',
        'Patent Claim 39: Sovereign Offline Hardware Arbiter Execution'
      ],
      leverSource: this.activeCircuitDir === PATENT_CIRCUIT_ROOT ? 'PATENT_REPO_LIVE' : 'SOVEREIGN_LOCAL_BACKUP'
    };
  }

  /**
   * Compute SHA-256 hash of patient consultation record for ZKP commitment
   */
  public static computeRecordHash(data: any): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }
}
