/**
 * In-process event bus plus Server-Sent Events fan-out.
 *
 * Two audiences:
 *  - staff streams (nurse station, doctor desk): full events incl. SOS alerts;
 *  - public display boards (waiting-room TV): only token numbers and rooms, never names.
 */

import { EventEmitter } from 'events';
import type { Response } from 'express';

export type HospitalEvent =
  | { type: 'queue.changed'; reason: string; sessionId?: string }
  | { type: 'token.called'; tokenNo: string; room: string; department: string; callCount: number; sessionId: string }
  | { type: 'sos.raised'; alertId: string; tokenNo?: string | null; location?: string | null; message: string; createdAt: string }
  | { type: 'sos.updated'; alertId: string; status: 'ACKNOWLEDGED' | 'RESOLVED'; by: string; at: string };

const bus = new EventEmitter();
bus.setMaxListeners(500);

export function publish(event: HospitalEvent): void {
  bus.emit('event', event);
}

const PUBLIC_TYPES = new Set(['queue.changed', 'token.called']);

function publicView(e: HospitalEvent): Record<string, unknown> | null {
  if (!PUBLIC_TYPES.has(e.type)) return null;
  if (e.type === 'token.called') return { type: e.type, tokenNo: e.tokenNo, room: e.room, department: e.department, callCount: e.callCount };
  return { type: e.type };
}

/** Attach an SSE connection. `audience` decides which events (and which fields) it receives. */
export function attachStream(res: Response, audience: 'staff' | 'public'): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`retry: 3000\n\n`);
  const send = (e: HospitalEvent) => {
    const payload = audience === 'staff' ? e : publicView(e);
    if (payload) res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const ping = setInterval(() => res.write(`: ping\n\n`), 20000);
  bus.on('event', send);
  res.on('close', () => {
    clearInterval(ping);
    bus.off('event', send);
  });
}
