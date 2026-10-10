/**
 * Sends one SMS reminder the day before a follow-up visit is due (patients who consented to SMS).
 */

import { db } from '../db/database';
import { SmsService } from './sms.service';
import { localDate } from './hospitalRouting.service';
import { realOnly } from './sampleData';

db.exec(`CREATE TABLE IF NOT EXISTS follow_up_reminders (encounter_id TEXT PRIMARY KEY, sent_at TEXT NOT NULL, result TEXT)`);

async function runOnce(): Promise<void> {
  if (!SmsService.isConfigured) return;
  const rows = db.prepare(`
    SELECT e.id, e.patient_id, e.created_at, json_extract(e.case_sheet_json, '$.followUpDays') AS days
    FROM encounters e LEFT JOIN follow_up_reminders r ON r.encounter_id = e.id
    WHERE r.encounter_id IS NULL AND json_extract(e.case_sheet_json, '$.followUpDays') > 0
      AND e.created_at > datetime('now', '-400 days') AND ${realOnly('e.patient_id')}
  `).all() as any[];
  const tomorrow = localDate(new Date(Date.now() + 86400000));
  for (const r of rows) {
    const due = localDate(new Date(new Date(r.created_at).getTime() + Number(r.days) * 86400000));
    if (due !== tomorrow) continue;
    const result = await SmsService.notifyFollowUp(r.patient_id, due).catch(() => ({ sent: false, reason: 'error' }));
    db.prepare('INSERT OR IGNORE INTO follow_up_reminders (encounter_id, sent_at, result) VALUES (?, ?, ?)').run(r.id, new Date().toISOString(), JSON.stringify(result));
  }
}

export function startFollowUpReminders(): void {
  setInterval(() => { runOnce().catch(e => console.error('[FollowUp] reminder run failed', e)); }, 3600_000).unref();
  setTimeout(() => { runOnce().catch(() => {}); }, 60_000).unref();
}
