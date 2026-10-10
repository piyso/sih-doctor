/**
 * Patient SMS notifications (token issued, prescription ready, follow-up reminder).
 *
 * Providers (SMS_PROVIDER):
 *   - "msg91": MSG91 Flow API (India, DLT-registered templates). Needs MSG91_AUTH_KEY and one
 *     MSG91_TEMPLATE_* id per message type, approved on the operator's DLT portal.
 *   - "webhook": POST JSON {to, template, variables, text} to SMS_WEBHOOK_URL (any in-house gateway).
 *   - "log" (default): nothing is sent; the message is written to the SMS log for testing.
 *
 * A message is sent only when the patient gave SMS consent at the kiosk and a full mobile number
 * is on file (stored encrypted).
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { decryptField } from '../security/fieldCrypto';
import { effectiveConsent } from '../security/privacy.service';
import { realOnly } from './sampleData';

db.exec(`
  CREATE TABLE IF NOT EXISTS sms_log (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    to_masked TEXT,
    template TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_ref TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  );
`);

type Template = 'TOKEN_ISSUED' | 'RX_READY' | 'FOLLOW_UP';

const PROVIDER = (process.env.SMS_PROVIDER || 'log').toLowerCase();
const HOSPITAL = process.env.HOSPITAL_SHORT_NAME || 'Hospital';

/** Short English/Hindi texts; with DLT the operator-approved template text is what is delivered. */
function render(t: Template, v: Record<string, string>): string {
  switch (t) {
    case 'TOKEN_ISSUED':
      return `${HOSPITAL}: Your token ${v.token} for Room ${v.room}. Please wait near the room. / आपका टोकन ${v.token}, कक्ष ${v.room}.`;
    case 'RX_READY':
      return `${HOSPITAL}: Your prescription is ready. Please collect medicines at the pharmacy with token ${v.token}. / दवा फार्मेसी से लें, टोकन ${v.token}.`;
    case 'FOLLOW_UP':
      return `${HOSPITAL}: Reminder - your follow-up visit is due on ${v.date}. / फॉलो-अप ${v.date} को है।`;
  }
}

async function deliver(to: string, template: Template, variables: Record<string, string>): Promise<{ ref?: string }> {
  if (PROVIDER === 'msg91') {
    const templateId = process.env[`MSG91_TEMPLATE_${template}`];
    if (!process.env.MSG91_AUTH_KEY || !templateId) throw new Error(`MSG91 is not configured for ${template}`);
    const r = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: `91${to}`, ...variables }] }),
      signal: AbortSignal.timeout(8000)
    });
    const body: any = await r.json().catch(() => ({}));
    if (!r.ok || body.type === 'error') throw new Error(body.message || `MSG91 HTTP ${r.status}`);
    return { ref: body.message || body.request_id };
  }
  if (PROVIDER === 'webhook') {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url) throw new Error('SMS_WEBHOOK_URL is not set');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ to: `+91${to}`, template, variables, text: render(template, variables) }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error(`Webhook HTTP ${r.status}`);
    return { ref: r.headers.get('x-message-id') || undefined };
  }
  return {};
}

async function send(patientId: string, template: Template, variables: Record<string, string>): Promise<{ sent: boolean; reason?: string }> {
  const p: any = db.prepare('SELECT phone_enc, phone_masked FROM patients WHERE id = ?').get(patientId);
  if (!p) return { sent: false, reason: 'no_patient' };
  if (!effectiveConsent(patientId).sms) return { sent: false, reason: 'no_consent' };
  const to = decryptField(p.phone_enc);
  if (!to) return { sent: false, reason: 'no_phone' };

  const id = crypto.randomUUID();
  const log = db.prepare('INSERT INTO sms_log (id, patient_id, to_masked, template, provider, status, provider_ref, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  try {
    const { ref } = await deliver(to, template, variables);
    const status = PROVIDER === 'log' ? 'LOGGED_NOT_SENT' : 'SENT';
    log.run(id, patientId, p.phone_masked, template, PROVIDER, status, ref || null, null, new Date().toISOString());
    return { sent: PROVIDER !== 'log', reason: PROVIDER === 'log' ? 'sms_not_configured' : undefined };
  } catch (err: any) {
    log.run(id, patientId, p.phone_masked, template, PROVIDER, 'FAILED', null, String(err?.message || err).slice(0, 200), new Date().toISOString());
    return { sent: false, reason: 'gateway_error' };
  }
}

export const SmsService = {
  provider: PROVIDER,
  isConfigured: PROVIDER !== 'log',

  notifyTokenIssued(patientId: string, token: string, room: string) {
    return send(patientId, 'TOKEN_ISSUED', { token, room });
  },

  async notifyPrescriptionReady(patientId: string, sessionId: string) {
    const s: any = db.prepare('SELECT token_no FROM sessions WHERE id = ?').get(sessionId);
    return send(patientId, 'RX_READY', { token: s?.token_no || '' });
  },

  notifyFollowUp(patientId: string, date: string) {
    return send(patientId, 'FOLLOW_UP', { date });
  },

  recent(limit = 50) {
    return db.prepare(`SELECT * FROM sms_log WHERE ${realOnly('patient_id')} ORDER BY created_at DESC LIMIT ?`).all(limit);
  }
};
