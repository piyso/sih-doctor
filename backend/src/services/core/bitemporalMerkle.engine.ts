/**
 * Bitemporal Merkle DAG & Cryptographic Provenance Subsystem
 * Native Bitemporal Merkle Subsystem
 *
 * Implements 2D interval algebra (Valid Time x Assertion Time) combined with
 * cryptographic SHA-256 Merkle chaining to guarantee immutable consultation
 * provenance and tamper-evident audit trails under DPDP Act 2023.
 */

export interface BitemporalInterval {
  validStart: string;    // ISO 8601 UTC (when clinically true in patient reality)
  validEnd: string;      // ISO 8601 UTC (ongoing = "9999-12-31T23:59:59Z")
  assertedAt: string;    // ISO 8601 UTC (when recorded in MediKiosk system)
  supersededAt?: string; // ISO 8601 UTC (when amended or updated by physician)
}

export interface MerkleFactNode {
  factId: string;
  encounterId: string;
  patientId: string;
  subject: string;
  predicate: string;
  object: string;
  evidenceScore: number;
  intervals: BitemporalInterval;
  parentHash?: string;
  nodeHash: string;
  decayType?: 'IMMUTABLE_LIFETIME' | 'TRANSIENT_DECAYING';
}

const kernel = require('./sovereign-kernel.cjs');

export interface IBitemporalMerkleEngine {
  computeFactHash(
    factId: string,
    subject: string,
    predicate: string,
    object: string,
    intervals: BitemporalInterval,
    parentHash?: string
  ): string;
  createMerkleNode(
    factId: string,
    encounterId: string,
    patientId: string,
    subject: string,
    predicate: string,
    object: string,
    evidenceScore: number,
    parentHash?: string,
    decayType?: 'IMMUTABLE_LIFETIME' | 'TRANSIENT_DECAYING'
  ): MerkleFactNode;
  isFactActiveAtTime(node: MerkleFactNode, targetTime?: Date): boolean;
  supersedeFact(
    chain: MerkleFactNode[],
    targetFactId: string,
    newObjectValue: string,
    encounterId: string,
    newValidStart?: string
  ): MerkleFactNode;
  verifyChain(chain: MerkleFactNode[]): { isValid: boolean; brokenAt?: number; error?: string };
}

export const BitemporalMerkleEngine: IBitemporalMerkleEngine = kernel.BitemporalMerkleEngine;
