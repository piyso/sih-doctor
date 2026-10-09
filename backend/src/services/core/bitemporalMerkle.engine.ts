/**
 * Bitemporal fact nodes with SHA-256 hash chaining.
 *
 * Each node records a fact (subject, predicate, object) with a valid-time interval (when it was
 * clinically true) and an assertion time (when the system recorded it). Nodes are chained by
 * `parentHash`, so editing or deleting any earlier node changes every later hash. This gives a
 * tamper-evident provenance log; it is not a Merkle *tree* and is not a zero-knowledge proof.
 */

import crypto from 'crypto';

export interface BitemporalInterval {
  validStart: string;    // ISO 8601 UTC (when clinically true)
  validEnd: string;      // ISO 8601 UTC ("9999-12-31T23:59:59Z" while ongoing)
  assertedAt: string;    // ISO 8601 UTC (when recorded)
  supersededAt?: string; // ISO 8601 UTC (when amended)
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

export const ONGOING = '9999-12-31T23:59:59Z';

export class BitemporalMerkleEngine {
  static computeFactHash(factId: string, subject: string, predicate: string, object: string, intervals: BitemporalInterval, parentHash?: string): string {
    const payload = [factId, subject, predicate, object, intervals.validStart, intervals.validEnd, intervals.assertedAt, parentHash || 'GENESIS_ROOT'].join('|');
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  static createMerkleNode(
    factId: string, encounterId: string, patientId: string, subject: string, predicate: string, object: string,
    evidenceScore: number, parentHash?: string, decayType: MerkleFactNode['decayType'] = 'TRANSIENT_DECAYING', at = new Date()
  ): MerkleFactNode {
    const iso = at.toISOString();
    const intervals: BitemporalInterval = { validStart: iso, validEnd: ONGOING, assertedAt: iso };
    return {
      factId, encounterId, patientId, subject, predicate, object, evidenceScore, intervals, parentHash,
      nodeHash: this.computeFactHash(factId, subject, predicate, object, intervals, parentHash),
      decayType
    };
  }

  static isFactActiveAtTime(node: MerkleFactNode, targetTime: Date = new Date()): boolean {
    if (node.decayType === 'IMMUTABLE_LIFETIME') return true;
    const t = targetTime.toISOString();
    return node.intervals.validStart <= t && t <= node.intervals.validEnd;
  }

  /** Close the old fact's assertion interval and append a new node carrying the new value. */
  static supersedeFact(chain: MerkleFactNode[], targetFactId: string, newObjectValue: string, encounterId: string, newValidStart?: string): MerkleFactNode {
    const old = chain.find(n => n.factId === targetFactId);
    if (!old) throw new Error(`Node with factId ${targetFactId} not found in chain`);
    const last = chain[chain.length - 1];
    const now = new Date().toISOString();
    old.intervals.supersededAt = now;
    const factId = `fact-rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const intervals: BitemporalInterval = { validStart: newValidStart || old.intervals.validStart, validEnd: ONGOING, assertedAt: now };
    const node: MerkleFactNode = {
      factId, encounterId, patientId: old.patientId, subject: old.subject, predicate: old.predicate, object: newObjectValue,
      evidenceScore: old.evidenceScore, intervals, parentHash: last?.nodeHash,
      nodeHash: this.computeFactHash(factId, old.subject, old.predicate, newObjectValue, intervals, last?.nodeHash),
      decayType: old.decayType
    };
    chain.push(node);
    return node;
  }

  static verifyChain(chain: MerkleFactNode[]): { isValid: boolean; brokenAt?: number; error?: string } {
    if (!chain?.length) return { isValid: true };
    for (let i = 0; i < chain.length; i++) {
      const n = chain[i];
      const expected = this.computeFactHash(n.factId, n.subject, n.predicate, n.object, n.intervals, n.parentHash);
      if (expected !== n.nodeHash) return { isValid: false, brokenAt: i, error: `Hash mismatch at node index ${i}` };
      if (i > 0 && n.parentHash !== chain[i - 1].nodeHash) return { isValid: false, brokenAt: i, error: `Chain pointer broken at index ${i}` };
    }
    return { isValid: true };
  }
}

export type IBitemporalMerkleEngine = typeof BitemporalMerkleEngine;
