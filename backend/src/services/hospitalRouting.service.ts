/**
 * Department routing and token numbers.
 *
 * Token numbers are issued by the server as a daily sequence per department (GENMED-001,
 * GENMED-002, ...), so two patients can never get the same token on the same day. The department
 * list mirrors frontend/src/utils/hospitalDirectory.ts (which holds the translated names).
 */

import { db } from '../db/database';

export type DepartmentCode =
  | 'ER' | 'ISO' | 'MLC'
  | 'KAYA' | 'PKRM' | 'SHLK' | 'PRAS' | 'BALA' | 'SHAL'
  | 'GENMED' | 'PAED' | 'OBGY' | 'ORTH' | 'ENT';

export const DEPARTMENT_ROOMS: Record<DepartmentCode, { room: string; floor: number; name: string; stream: 'AYURVEDA' | 'ALLOPATHY' | 'EMERGENCY' }> = {
  ER: { room: 'ER-1', floor: 0, name: 'Emergency Room', stream: 'EMERGENCY' },
  ISO: { room: '109', floor: 0, name: 'Fever & cough isolation clinic', stream: 'EMERGENCY' },
  MLC: { room: 'ER-2', floor: 0, name: 'Casualty (medico-legal)', stream: 'EMERGENCY' },
  KAYA: { room: '204', floor: 2, name: 'Ayurveda General Medicine (Kayachikitsa)', stream: 'AYURVEDA' },
  PKRM: { room: '105', floor: 1, name: 'Panchakarma', stream: 'AYURVEDA' },
  SHLK: { room: '215', floor: 2, name: 'Eye & ENT (Shalakya)', stream: 'AYURVEDA' },
  PRAS: { room: '206', floor: 2, name: "Women's health (Prasuti Tantra)", stream: 'AYURVEDA' },
  BALA: { room: '108', floor: 1, name: 'Child health (Kaumarbhritya)', stream: 'AYURVEDA' },
  SHAL: { room: '112', floor: 1, name: 'Surgery, piles & wounds (Shalya Tantra)', stream: 'AYURVEDA' },
  GENMED: { room: '14', floor: 0, name: 'General Medicine OPD', stream: 'ALLOPATHY' },
  PAED: { room: '18', floor: 0, name: "Children's OPD", stream: 'ALLOPATHY' },
  OBGY: { room: '22', floor: 0, name: "Women's OPD (Obstetrics & Gynaecology)", stream: 'ALLOPATHY' },
  ORTH: { room: '16', floor: 0, name: 'Bones & joints OPD', stream: 'ALLOPATHY' },
  ENT: { room: '20', floor: 0, name: 'Eye & ENT OPD', stream: 'ALLOPATHY' }
};

for (const col of [
  'department TEXT', 'token_no TEXT', 'token_date TEXT', 'called_at TEXT', 'call_count INTEGER DEFAULT 0',
  'consult_started_at TEXT', 'completed_at TEXT', 'kiosk_device_id TEXT'
]) {
  try { db.exec(`ALTER TABLE sessions ADD COLUMN ${col};`); } catch {}
}
db.exec(`
  CREATE TABLE IF NOT EXISTS token_counters (
    token_date TEXT NOT NULL,
    department TEXT NOT NULL,
    last_no INTEGER NOT NULL,
    PRIMARY KEY (token_date, department)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_date, department);
`);

export interface RoutingInput {
  careStream: string;
  age?: number;
  gender?: string;
  isPregnant?: boolean;
  isEmergency: boolean;
  isAirborne?: boolean;
  isMlc?: boolean;
  complaintText: string;
}

export function routeCheckIn(i: RoutingInput): DepartmentCode {
  if (i.isEmergency) return 'ER';
  if (i.isAirborne) return 'ISO';
  if (i.isMlc) return 'MLC';
  const text = (i.complaintText || '').toLowerCase();
  const allopathy = i.careStream === 'ALLOPATHY';
  if (i.age !== undefined && i.age > 0 && i.age < 14) return allopathy ? 'PAED' : 'BALA';
  if (i.gender === 'FEMALE' && (i.isPregnant || /menstrual|period|pregnan|pelvic|discharge|मासिक|गर्भ/.test(text))) return allopathy ? 'OBGY' : 'PRAS';
  if (/eye|ear|nose|throat|tooth|face|sinus|neck/.test(text)) return allopathy ? 'ENT' : 'SHLK';
  if (/piles|fistula|wound|bleeding while passing stool|anus/.test(text)) return allopathy ? 'GENMED' : 'SHAL';
  if (/knee|joint|back|spine|hip|shoulder|sciatica|lumbar|cervical|stiff/.test(text)) return allopathy ? 'ORTH' : 'PKRM';
  return allopathy ? 'GENMED' : 'KAYA';
}

/** Hospital-local calendar date (IST by default) so tokens restart at local midnight. */
export function localDate(d = new Date()): string {
  const tz = process.env.HOSPITAL_TIMEZONE || 'Asia/Kolkata';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const nextNo = db.transaction((date: string, dept: string): number => {
  db.prepare(`
    INSERT INTO token_counters (token_date, department, last_no) VALUES (?, ?, 1)
    ON CONFLICT(token_date, department) DO UPDATE SET last_no = last_no + 1
  `).run(date, dept);
  return (db.prepare('SELECT last_no FROM token_counters WHERE token_date = ? AND department = ?').get(date, dept) as { last_no: number }).last_no;
});

export function issueToken(dept: DepartmentCode): { tokenNo: string; tokenDate: string } {
  const date = localDate();
  const n = nextNo(date, dept);
  return { tokenNo: `${dept}-${String(n).padStart(3, '0')}`, tokenDate: date };
}

/** Make sure an older session (e.g. demo data) has a department and token. */
export function ensureSessionToken(sessionId: string): { department: DepartmentCode; tokenNo: string } | null {
  const s: any = db.prepare(`
    SELECT s.id, s.department, s.token_no, s.care_stream, s.triage_priority, s.symptoms_json, p.age, p.gender, p.is_pregnant
    FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) return null;
  if (s.department && s.token_no) return { department: s.department, tokenNo: s.token_no };
  let complaint = '';
  try { complaint = (JSON.parse(s.symptoms_json || '[]') as any[]).map(x => `${x.site || ''} ${x.name || ''}`).join(' '); } catch {}
  const department = routeCheckIn({
    careStream: s.care_stream || 'UNDECIDED',
    age: s.age, gender: s.gender, isPregnant: !!s.is_pregnant,
    isEmergency: s.triage_priority === 'EMERGENCY_RED_FLAG',
    complaintText: complaint
  });
  const { tokenNo, tokenDate } = issueToken(department);
  db.prepare('UPDATE sessions SET department = ?, token_no = ?, token_date = ? WHERE id = ?').run(department, tokenNo, tokenDate, sessionId);
  return { department, tokenNo };
}

/** Average minutes per consultation over the last 7 days (falls back to 8 when there is no data). */
export function averageConsultMinutes(): number {
  const r: any = db.prepare(`
    SELECT AVG((julianday(completed_at) - julianday(consult_started_at)) * 1440) AS m
    FROM sessions WHERE completed_at IS NOT NULL AND consult_started_at IS NOT NULL
      AND completed_at > datetime('now', '-7 days') AND status != 'DEMO_PARKED'
  `).get();
  const m = Number(r?.m);
  return Number.isFinite(m) && m > 1 && m < 60 ? Math.round(m) : 8;
}

const PRIORITY_RANK = `CASE triage_priority WHEN 'EMERGENCY_RED_FLAG' THEN 1 WHEN 'HIGH_PRIORITY' THEN 2 ELSE 3 END`;

/** Where a visit stands in its department's queue (no other patient's details are returned). */
export function queuePosition(sessionId: string) {
  const s: any = db.prepare(`SELECT id, department, token_no, status, triage_priority, created_at, called_at FROM sessions WHERE id = ?`).get(sessionId);
  if (!s) return null;
  if (!s.department) ensureSessionToken(sessionId);
  const row: any = db.prepare(`SELECT id, department, token_no, status, triage_priority, created_at, called_at FROM sessions WHERE id = ?`).get(sessionId);
  const ahead = row.status === 'PENDING_DOCTOR'
    ? (db.prepare(`
        SELECT COUNT(*) AS n FROM sessions
        WHERE department = ? AND status = 'PENDING_DOCTOR' AND id != ?
          AND (${PRIORITY_RANK} < (SELECT ${PRIORITY_RANK} FROM sessions WHERE id = ?)
               OR (${PRIORITY_RANK} = (SELECT ${PRIORITY_RANK} FROM sessions WHERE id = ?) AND created_at < ?))
      `).get(row.department, row.id, row.id, row.id, row.created_at) as { n: number }).n
    : 0;
  const room = DEPARTMENT_ROOMS[row.department as DepartmentCode];
  return {
    tokenNo: row.token_no as string,
    department: row.department as DepartmentCode,
    room: room?.room || '',
    floor: room?.floor ?? 0,
    status: row.status as string,
    ahead,
    estimatedWaitMinutes: row.status === 'PENDING_DOCTOR' ? ahead * averageConsultMinutes() : 0,
    calledAt: row.called_at as string | null
  };
}
