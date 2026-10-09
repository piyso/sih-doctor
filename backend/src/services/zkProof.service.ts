/**
 * Record provenance: hash-chained fact nodes per finalized encounter, plus a strict Groth16
 * verifier for proofs supplied by a caller.
 *
 * Honest scope:
 *  - Each finalized consultation appends a node whose `object` is the SHA-256 of the canonical
 *    record JSON and, when present, the Ed25519 signature digest. Nodes chain by hash in insertion
 *    order (rowid), so any later edit of the table is detectable with `verifyFullMerkleChain()`.
 *  - `verifyProof` verifies a Groth16/BN128 proof against the bundled verification key. It never
 *    falls back to a bundled sample proof; without a proof there is nothing to verify.
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { BitemporalMerkleEngine, MerkleFactNode } from './core/bitemporalMerkle.engine';
import { db } from '../db/database';
import { canonicalJson, RecordSignature } from '../security/recordSigning';

const snarkjs = require('snarkjs');

export class ZkProofService {
  private static circuitDir = [
    path.resolve(__dirname, '../data/zkp_circuit'),
    path.resolve(__dirname, '../../src/data/zkp_circuit'),
    path.resolve(process.cwd(), 'src/data/zkp_circuit')
  ].find(p => fs.existsSync(p)) || path.resolve(__dirname, '../data/zkp_circuit');
  private static vKeyPath = path.join(ZkProofService.circuitDir, 'verification_key.json');
  private static cachedVKey: any = null;

  private static loadVerificationKey(): any {
    if (!this.cachedVKey && fs.existsSync(this.vKeyPath)) this.cachedVKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf8'));
    return this.cachedVKey;
  }

  static computeRecordHash(recordData: any): string {
    const serialized = typeof recordData === 'string' ? recordData : canonicalJson(recordData);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /** Verify a caller-supplied Groth16 proof. Returns isValid=false for anything missing or malformed. */
  static async verifyProof(proofObj: any, publicSignals: any[]): Promise<{ isValid: boolean; latencyMs: number; reason?: string }> {
    const vKey = this.loadVerificationKey();
    if (!vKey) return { isValid: false, latencyMs: 0, reason: 'verification key not available' };
    if (!proofObj || typeof proofObj !== 'object' || !Array.isArray(publicSignals)) return { isValid: false, latencyMs: 0, reason: 'proof and publicSignals are required' };
    const t0 = performance.now();
    try {
      const ok = await snarkjs.groth16.verify(vKey, publicSignals, proofObj);
      return { isValid: Boolean(ok), latencyMs: parseFloat((performance.now() - t0).toFixed(2)) };
    } catch (err: any) {
      return { isValid: false, latencyMs: parseFloat((performance.now() - t0).toFixed(2)), reason: String(err?.message || err).slice(0, 120) };
    }
  }

  /** Append the provenance node for a finalized encounter. Call inside the encounter transaction. */
  static recordEncounterMerkleNode(encounterId: string, patientId: string, caseSheetData: any, signature?: RecordSignature): MerkleFactNode {
    const last: any = db.prepare('SELECT node_hash FROM merkle_fact_nodes ORDER BY rowid DESC LIMIT 1').get();
    const parentHash: string | undefined = last?.node_hash || undefined;
    const recordHash = this.computeRecordHash(caseSheetData);
    const object = signature ? `RecordHash:${recordHash};Sig:${signature.keyId}:${signature.signature.slice(0, 32)}` : `RecordHash:${recordHash}`;
    const node = BitemporalMerkleEngine.createMerkleNode(
      `fact_${encounterId}`, encounterId, patientId, `Patient:${patientId}`, 'HAS_COMPLETED_CONSULTATION', object, 1, parentHash
    );
    db.prepare(`
      INSERT INTO merkle_fact_nodes (id, encounter_id, patient_id, subject, predicate, object, evidence_score, node_hash, parent_hash, intervals_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(node.factId, node.encounterId, node.patientId, node.subject, node.predicate, node.object, node.evidenceScore, node.nodeHash, node.parentHash || null, JSON.stringify(node.intervals), new Date().toISOString());
    return node;
  }

  static verifyFullMerkleChain(): { isValid: boolean; totalNodes: number; error?: string; brokenAt?: number } {
    try {
      const rows: any[] = db.prepare(`
        SELECT id AS factId, encounter_id AS encounterId, patient_id AS patientId, subject, predicate, object, evidence_score AS evidenceScore,
               node_hash AS nodeHash, parent_hash AS parentHash, intervals_json AS intervalsJson
        FROM merkle_fact_nodes ORDER BY rowid ASC
      `).all();
      const nodes: MerkleFactNode[] = rows.map(r => ({ ...r, parentHash: r.parentHash || undefined, intervals: JSON.parse(r.intervalsJson) }));
      const v = BitemporalMerkleEngine.verifyChain(nodes);
      return { isValid: v.isValid, totalNodes: nodes.length, error: v.error, brokenAt: v.brokenAt };
    } catch (err: any) {
      return { isValid: false, totalNodes: 0, error: err.message };
    }
  }

  /** Provenance node(s) for one encounter, so a record can be checked against the chain. */
  static nodesForEncounter(encounterId: string): MerkleFactNode[] {
    const rows: any[] = db.prepare(`
      SELECT id AS factId, encounter_id AS encounterId, patient_id AS patientId, subject, predicate, object, evidence_score AS evidenceScore,
             node_hash AS nodeHash, parent_hash AS parentHash, intervals_json AS intervalsJson
      FROM merkle_fact_nodes WHERE encounter_id = ? ORDER BY rowid ASC
    `).all(encounterId);
    return rows.map(r => ({ ...r, parentHash: r.parentHash || undefined, intervals: JSON.parse(r.intervalsJson) }));
  }
}
