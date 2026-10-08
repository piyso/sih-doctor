/**
 * Waiting-room display board and calling patients in.
 *
 * The public board shows only token numbers and rooms — never names — so it is safe on a TV in
 * the waiting hall.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireStaff, requireKioskOrStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { AuthService, redeemStreamTicket } from '../security/auth.service';
import { audit } from '../security/audit';
import { attachStream, publish } from '../services/eventBus.service';
import { DEPARTMENT_ROOMS, DepartmentCode, ensureSessionToken, averageConsultMinutes } from '../services/hospitalRouting.service';

export const queueRouter = Router();

function boardData() {
  const rows = db.prepare(`
    SELECT department, token_no, status, triage_priority, called_at, created_at FROM sessions
    WHERE status IN ('PENDING_DOCTOR', 'IN_CONSULTATION') AND token_no IS NOT NULL
      AND created_at > datetime('now', '-1 day')
    ORDER BY CASE triage_priority WHEN 'EMERGENCY_RED_FLAG' THEN 1 WHEN 'HIGH_PRIORITY' THEN 2 ELSE 3 END, created_at
  `).all() as any[];
  const avg = averageConsultMinutes();
  const departments = (Object.keys(DEPARTMENT_ROOMS) as DepartmentCode[])
    .filter(code => code !== 'ER' && code !== 'MLC')
    .map(code => {
      const inDept = rows.filter(r => r.department === code);
      const nowServing = inDept.filter(r => r.status === 'IN_CONSULTATION').sort((a, b) => String(b.called_at).localeCompare(String(a.called_at)))[0];
      const waiting = inDept.filter(r => r.status === 'PENDING_DOCTOR');
      return {
        code,
        room: DEPARTMENT_ROOMS[code].room,
        floor: DEPARTMENT_ROOMS[code].floor,
        name: DEPARTMENT_ROOMS[code].name,
        nowServing: nowServing?.token_no || null,
        next: waiting.slice(0, 4).map(w => w.token_no),
        waitingCount: waiting.length,
        estimatedWaitMinutes: waiting.length * avg
      };
    })
    .filter(d => d.nowServing || d.waitingCount > 0);
  const recentCalls = db.prepare(`
    SELECT token_no, department, called_at, call_count FROM sessions
    WHERE called_at IS NOT NULL AND called_at > datetime('now', '-30 minutes') ORDER BY called_at DESC LIMIT 6
  `).all() as any[];
  return {
    generatedAt: new Date().toISOString(),
    departments,
    recentCalls: recentCalls.map(c => ({
      tokenNo: c.token_no,
      room: DEPARTMENT_ROOMS[c.department as DepartmentCode]?.room || '',
      department: c.department,
      calledAt: c.called_at,
      callCount: c.call_count
    }))
  };
}

/** Display boards: an enrolled device, a signed-in staff member, or open (dev) mode. */
const displayAccess = (req: Request, res: Response, next: () => void) => {
  const deviceToken = typeof req.query.device === 'string' ? req.query.device : '';
  if (deviceToken && AuthService.resolveDevice(deviceToken)) return next();
  return requireKioskOrStaff(req, res, next);
};

queueRouter.get('/board', displayAccess, (_req: Request, res: Response): void => {
  res.json({ success: true, data: boardData() });
});

queueRouter.get('/board/stream', displayAccess, (_req: Request, res: Response): void => {
  attachStream(res, 'public');
});

/** Staff event stream (SOS alerts, queue changes). EventSource cannot send headers, so it uses a one-time ticket. */
queueRouter.get('/events', (req: Request, res: Response): void => {
  const user = typeof req.query.ticket === 'string' ? redeemStreamTicket(req.query.ticket) : null;
  if (!user) {
    res.status(401).json({ error: 'Stream ticket missing or expired.', code: 'AUTH_REQUIRED' });
    return;
  }
  attachStream(res, 'staff');
});

/**
 * POST /api/queue/call/:sessionId
 * Call a patient into the room: shows on the display board and is announced there.
 * Calling again (re-announce) increments the call count.
 */
queueRouter.post('/call/:sessionId', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  const t = ensureSessionToken(String(req.params.sessionId));
  if (!t) {
    res.status(404).json({ error: 'Visit not found' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sessions SET called_at = ?, call_count = COALESCE(call_count, 0) + 1,
      status = CASE WHEN status = 'PENDING_DOCTOR' THEN 'IN_CONSULTATION' ELSE status END,
      consult_started_at = COALESCE(consult_started_at, ?)
    WHERE id = ?
  `).run(now, now, String(req.params.sessionId));
  const row: any = db.prepare('SELECT call_count FROM sessions WHERE id = ?').get(String(req.params.sessionId));
  const room = DEPARTMENT_ROOMS[t.department]?.room || '';
  publish({ type: 'token.called', tokenNo: t.tokenNo, room, department: t.department, callCount: row.call_count, sessionId: String(req.params.sessionId) });
  publish({ type: 'queue.changed', reason: 'called', sessionId: String(req.params.sessionId) });
  audit(req, 'queue.patient_called', String(req.params.sessionId), { tokenNo: t.tokenNo, callCount: row.call_count });
  res.json({ success: true, tokenNo: t.tokenNo, room, callCount: row.call_count });
});

/** Mark a called patient as not present (moves them out of the active queue). */
queueRouter.post('/no-show/:sessionId', requireStaff(...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  const r = db.prepare(`UPDATE sessions SET status = 'NOT_SEEN' WHERE id = ? AND status IN ('PENDING_DOCTOR', 'IN_CONSULTATION')`).run(String(req.params.sessionId));
  if (!r.changes) {
    res.status(404).json({ error: 'Visit not found or already closed' });
    return;
  }
  audit(req, 'queue.no_show', String(req.params.sessionId));
  publish({ type: 'queue.changed', reason: 'no_show', sessionId: String(req.params.sessionId) });
  res.json({ success: true });
});
