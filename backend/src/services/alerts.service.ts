/**
 * Emergency (SOS) alerts raised at a kiosk and handled at the nurse station.
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { publish } from './eventBus.service';
import { appendAudit } from '../security/audit';

db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    session_id TEXT,
    token_no TEXT,
    location TEXT,
    message TEXT NOT NULL,
    raised_by TEXT,
    created_at TEXT NOT NULL,
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(resolved_at, created_at);
`);

export interface AlertRow {
  id: string;
  kind: string;
  sessionId: string | null;
  tokenNo: string | null;
  location: string | null;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  patientName?: string | null;
}

const toRow = (r: any): AlertRow => ({
  id: r.id,
  kind: r.kind,
  sessionId: r.session_id,
  tokenNo: r.token_no,
  location: r.location,
  message: r.message,
  createdAt: r.created_at,
  acknowledgedAt: r.acknowledged_at,
  acknowledgedBy: r.acknowledged_by,
  resolvedAt: r.resolved_at,
  resolvedBy: r.resolved_by,
  patientName: r.patient_name ?? null
});

export const AlertsService = {
  raiseSos(input: { sessionId?: string | null; tokenNo?: string | null; location?: string | null; message?: string; raisedBy: string }): AlertRow {
    // One open SOS per visit: pressing the button twice must not create two alarms.
    if (input.sessionId) {
      const open: any = db.prepare(`SELECT * FROM alerts WHERE session_id = ? AND resolved_at IS NULL`).get(input.sessionId);
      if (open) return toRow(open);
    }
    const id = `sos-${crypto.randomBytes(5).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const message = (input.message || 'Patient pressed the emergency (SOS) button at the kiosk.').slice(0, 300);
    db.prepare(`INSERT INTO alerts (id, kind, session_id, token_no, location, message, raised_by, created_at) VALUES (?, 'SOS', ?, ?, ?, ?, ?, ?)`)
      .run(id, input.sessionId || null, input.tokenNo || null, input.location || null, message, input.raisedBy, createdAt);
    appendAudit({ action: 'sos.raised', entityId: id, actor: input.raisedBy, metadata: { sessionId: input.sessionId, location: input.location } });
    publish({ type: 'sos.raised', alertId: id, tokenNo: input.tokenNo, location: input.location, message, createdAt });
    return this.get(id)!;
  },

  get(id: string): AlertRow | null {
    const r = db.prepare(`
      SELECT a.*, p.name AS patient_name FROM alerts a
      LEFT JOIN sessions s ON s.id = a.session_id LEFT JOIN patients p ON p.id = s.patient_id WHERE a.id = ?
    `).get(id);
    return r ? toRow(r) : null;
  },

  listOpen(): AlertRow[] {
    return (db.prepare(`
      SELECT a.*, p.name AS patient_name FROM alerts a
      LEFT JOIN sessions s ON s.id = a.session_id LEFT JOIN patients p ON p.id = s.patient_id
      WHERE a.resolved_at IS NULL OR a.resolved_at > datetime('now', '-30 minutes')
      ORDER BY a.resolved_at IS NOT NULL, a.created_at DESC LIMIT 50
    `).all() as any[]).map(toRow);
  },

  acknowledge(id: string, by: string): AlertRow | null {
    const at = new Date().toISOString();
    const ok = db.prepare(`UPDATE alerts SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ? AND acknowledged_at IS NULL`).run(at, by, id).changes > 0;
    if (ok) publish({ type: 'sos.updated', alertId: id, status: 'ACKNOWLEDGED', by, at });
    return this.get(id);
  },

  resolve(id: string, by: string, note?: string): AlertRow | null {
    const at = new Date().toISOString();
    const ok = db.prepare(`
      UPDATE alerts SET resolved_at = ?, resolved_by = ?, resolution_note = ?,
        acknowledged_at = COALESCE(acknowledged_at, ?), acknowledged_by = COALESCE(acknowledged_by, ?)
      WHERE id = ? AND resolved_at IS NULL
    `).run(at, by, note?.slice(0, 300) || null, at, by, id).changes > 0;
    if (ok) publish({ type: 'sos.updated', alertId: id, status: 'RESOLVED', by, at });
    return this.get(id);
  }
};
