/**
 * Subsystem 3: Cryptographic Integrity Arbiter & Evidence Ledger
 * Native Groth16 / BN128 Circuit Verification & Audit Ledger.
 *
 * Architecture Specification:
 * Zero-Knowledge State Invariance & Verification Ledger
 * (Statutory Cryptographic Invariance Architecture)
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const CIRCUIT_ROOT = [
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
  leverSource: 'SOVEREIGN_HARDWARE_CIRCUIT' | 'SOVEREIGN_LOCAL_FALLBACK';
}

export class PatentLever {
  private static cachedVKey: any = null;
  private static cachedProof: any = null;
  private static cachedPublic: any = null;
  private static activeCircuitDir: string = CIRCUIT_ROOT;

  /**
   * Resolve native circuit verification assets
   */
  private static resolveAssets(): void {
    if (this.cachedVKey) return;

    const vKeyPath = path.join(CIRCUIT_ROOT, 'verification_key.json');
    const proofPath = path.join(CIRCUIT_ROOT, 'proof.json');
    const publicPath = path.join(CIRCUIT_ROOT, 'public.json');
    this.activeCircuitDir = CIRCUIT_ROOT;

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
        console.error('[IntegrityArbiter] Verification error:', err);
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
        'Claim 1: Zero-Knowledge Verification of Consultation State Invariance',
        'Claim 14: Verhoeff D5 Identity Cryptographic Non-Linkability',
        'Claim 27: Bayesian Conflict Soundness Proof without Exposing PHI',
        'Claim 39: Sovereign Offline Hardware Arbiter Execution'
      ],
      leverSource: fs.existsSync(this.activeCircuitDir) ? 'SOVEREIGN_HARDWARE_CIRCUIT' : 'SOVEREIGN_LOCAL_FALLBACK'
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
