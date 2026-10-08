/**
 * Tamper-evident audit log.
 *
 * Every row stores the SHA-256 of (previous row hash + its own canonical content), so editing or
 * deleting any past row breaks the chain from that point on. `verifyAuditChain()` re-walks it.
 */

import crypto from 'crypto';
import type { Request } from 'express';
import { db } from '../db/database';

for (const col of ['actor_role TEXT', 'ip TEXT', 'outcome TEXT', 'prev_hash TEXT', 'hash TEXT']) {
  try { db.exec(`ALTER TABLE audit_logs ADD COLUMN ${col};`); } catch {}
}
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);');

const GENESIS = '0'.repeat(64);

function rowDigest(prev: string, r: {
  action: string; entity_id: string | null; actor: string | null; actor_role: string | null;
  ip: string | null; outcome: string | null; metadata_json: string | null; created_at: string;
}): string {
  const canonical = JSON.stringify([
    r.action, r.entity_id ?? '', r.actor ?? '', r.actor_role ?? '', r.ip ?? '', r.outcome ?? '', r.metadata_json ?? '', r.created_at
  ]);
  return crypto.createHash('sha256').update(prev).update('|').update(canonical).digest('hex');
}

const lastHashStmt = db.prepare('SELECT hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1');
const insertStmt = db.prepare(`
  INSERT INTO audit_logs (action, entity_id, actor, actor_role, ip, outcome, metadata_json, created_at, prev_hash, hash)
  VALUES (@action, @entity_id, @actor, @actor_role, @ip, @outcome, @metadata_json, @created_at, @prev_hash, @hash)
`);

export interface AuditEntry {
  action: string;
  entityId?: string | null;
  actor?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  outcome?: 'success' | 'denied' | 'failure';
  metadata?: Record<string, unknown>;
}

const appendTx = db.transaction((e: AuditEntry) => {
  const prev = (lastHashStmt.get() as { hash: string } | undefined)?.hash || GENESIS;
  const row = {
    action: e.action,
    entity_id: e.entityId ?? null,
    actor: e.actor ?? null,
    actor_role: e.actorRole ?? null,
    ip: e.ip ?? null,
    outcome: e.outcome ?? 'success',
    metadata_json: e.metadata ? JSON.stringify(e.metadata) : null,
    created_at: new Date().toISOString()
  };
  insertStmt.run({ ...row, prev_hash: prev, hash: rowDigest(prev, row) });
});

export function appendAudit(entry: AuditEntry): void {
  try {
    appendTx(entry);
  } catch (err) {
    // Auditing must never take a clinical action down, but it must be visible in the server log.
    console.error('[Audit] Failed to write audit entry', entry.action, err);
  }
}

/** Audit an action performed during an HTTP request, picking the actor from the request. */
export function audit(req: Request, action: string, entityId?: string | null, metadata?: Record<string, unknown>, outcome: AuditEntry['outcome'] = 'success'): void {
  const staff = (req as any).staff as { id: string; role: string } | undefined;
  const kiosk = (req as any).kioskDevice as { id: string } | undefined;
  appendAudit({
    action,
    entityId: entityId ?? null,
    actor: staff?.id || (kiosk ? `kiosk:${kiosk.id}` : 'anonymous'),
    actorRole: staff?.role || (kiosk ? 'kiosk' : null),
    ip: req.ip || null,
    outcome,
    metadata
  });
}

export function verifyAuditChain(): { valid: boolean; checked: number; brokenAtId?: number } {
  const rows = db.prepare(`
    SELECT id, action, entity_id, actor, actor_role, ip, outcome, metadata_json, created_at, prev_hash, hash
    FROM audit_logs WHERE hash IS NOT NULL ORDER BY id ASC
  `).iterate() as Iterable<any>;
  let prev = GENESIS;
  let checked = 0;
  for (const r of rows) {
    if (r.prev_hash !== prev || rowDigest(prev, r) !== r.hash) return { valid: false, checked, brokenAtId: r.id };
    prev = r.hash;
    checked++;
  }
  return { valid: true, checked };
}
