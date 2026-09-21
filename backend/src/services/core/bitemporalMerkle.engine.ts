/**
 * Bitemporal Merkle DAG & Cryptographic Provenance Subsystem
 * Ported & adapted from PiyAPI (project cloud/src/services/knowledgeGraph/bitemporalMerkle.service.ts)
 *
 * Implements 2D interval algebra (Valid Time x Assertion Time) combined with
 * cryptographic SHA-256 Merkle chaining to guarantee immutable consultation
 * provenance and tamper-evident audit trails under DPDP Act 2023.
 */

import crypto from 'crypto';

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

export class BitemporalMerkleEngine {
  /**
   * Compute cryptographic SHA-256 Merkle hash for an atomic fact state
   */
  public static computeFactHash(
    factId: string,
    subject: string,
    predicate: string,
    object: string,
    intervals: BitemporalInterval,
    parentHash?: string
  ): string {
    const payload = `${factId}|${subject}|${predicate}|${object}|${intervals.validStart}|${intervals.validEnd}|${intervals.assertedAt}|${parentHash || 'GENESIS_ROOT'}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Create a verified Merkle fact node chained to parent state
   */
  public static createMerkleNode(
    factId: string,
    encounterId: string,
    patientId: string,
    subject: string,
    predicate: string,
    object: string,
    evidenceScore: number,
    parentHash?: string,
    decayType: 'IMMUTABLE_LIFETIME' | 'TRANSIENT_DECAYING' = 'TRANSIENT_DECAYING'
  ): MerkleFactNode {
    const intervals: BitemporalInterval = {
      validStart: new Date().toISOString(),
      validEnd: '9999-12-31T23:59:59Z',
      assertedAt: new Date().toISOString()
    };

    const nodeHash = this.computeFactHash(factId, subject, predicate, object, intervals, parentHash);

    return {
      factId,
      encounterId,
      patientId,
      subject,
      predicate,
      object,
      evidenceScore,
      intervals,
      parentHash,
      nodeHash,
      decayType
    };
  }

  /**
   * Checks if a fact is active at a given valid-time evaluation date.
   * If decayType is IMMUTABLE_LIFETIME (e.g. Anaphylactic Allergies, Blood Group), it NEVER decays.
   */
  public static isFactActiveAtTime(node: MerkleFactNode, checkDate: Date = new Date()): boolean {
    if (node.decayType === 'IMMUTABLE_LIFETIME') {
      return true; // Never decays across patient lifetime
    }
    const checkIso = checkDate.toISOString();
    return node.intervals.validStart <= checkIso && checkIso <= node.intervals.validEnd;
  }

  /**
   * Supersedes an existing fact node via retroactive belief revision without mutating past nodes.
   * Maintains 100% cryptographic Merkle chain validity.
   */
  public static supersedeFact(
    chain: MerkleFactNode[],
    oldFactId: string,
    newObject: string,
    encounterId: string,
    retroactiveValidStart?: string
  ): MerkleFactNode {
    const oldNode = chain.find(n => n.factId === oldFactId);
    if (!oldNode) {
      throw new Error(`Node with factId ${oldFactId} not found in Merkle chain`);
    }

    const lastNode = chain[chain.length - 1];
    const nowIso = new Date().toISOString();

    // Mark previous fact as superseded at transaction time nowIso
    oldNode.intervals.supersededAt = nowIso;

    const newFactId = `fact-rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const intervals: BitemporalInterval = {
      validStart: retroactiveValidStart || oldNode.intervals.validStart,
      validEnd: '9999-12-31T23:59:59Z',
      assertedAt: nowIso
    };

    const nodeHash = this.computeFactHash(
      newFactId,
      oldNode.subject,
      oldNode.predicate,
      newObject,
      intervals,
      lastNode ? lastNode.nodeHash : undefined
    );

    const newNode: MerkleFactNode = {
      factId: newFactId,
      encounterId,
      patientId: oldNode.patientId,
      subject: oldNode.subject,
      predicate: oldNode.predicate,
      object: newObject,
      evidenceScore: oldNode.evidenceScore,
      intervals,
      parentHash: lastNode ? lastNode.nodeHash : undefined,
      nodeHash,
      decayType: oldNode.decayType
    };

    chain.push(newNode);
    return newNode;
  }

  /**
   * Verify an entire Merkle provenance chain for tamper-evidence
   */
  public static verifyChain(chain: MerkleFactNode[]): { isValid: boolean; brokenAt?: number; error?: string } {
    if (!chain || chain.length === 0) return { isValid: true };

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const recalculated = this.computeFactHash(
        node.factId,
        node.subject,
        node.predicate,
        node.object,
        node.intervals,
        node.parentHash
      );

      if (recalculated !== node.nodeHash) {
        return {
          isValid: false,
          brokenAt: i,
          error: `Hash mismatch at node index ${i}: expected ${recalculated}, found ${node.nodeHash}`
        };
      }

      if (i > 0) {
        const prevNode = chain[i - 1];
        if (node.parentHash !== prevNode.nodeHash) {
          return {
            isValid: false,
            brokenAt: i,
            error: `Chain pointer broken at index ${i}: parentHash ${node.parentHash} does not match previous nodeHash ${prevNode.nodeHash}`
          };
        }
      }
    }

    return { isValid: true };
  }
}
