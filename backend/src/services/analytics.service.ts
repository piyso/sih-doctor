/**
 * Operational and outcome analytics computed from the hospital's own records.
 *
 * Everything here is a count or a timing taken directly from the database. Surveillance "signals"
 * use a simple, documented threshold (this week's count vs. the previous four weeks) and are shown
 * as prompts for review, never as diagnoses or outbreak declarations.
 */

import { db } from '../db/database';
import { DEPARTMENT_ROOMS, DepartmentCode, localDate } from './hospitalRouting.service';
import './alerts.service'; // creates the alerts table used below
import { realOnly, samplesHidden } from './sampleData';

const safeParse = <T>(raw: any, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

const median = (xs: number[]): number | null => {
  const v = xs.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const minutesBetween = (a?: string | null, b?: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : NaN;

/** Plain-language syndrome groups with keywords in English and common Indian-language forms. */
const SYNDROMES: Array<{ id: string; name: string; pattern: RegExp }> = [
  { id: 'fever', name: 'Fever', pattern: /fever|bukhar|बुखार|ताप|জ্বর|காய்ச்சல்|జ్వరం|jwara/i },
  { id: 'respiratory', name: 'Cough / breathing difficulty', pattern: /cough|breath|wheez|khansi|खांसी|खाँसी|সাঁস|কাশি|இருமல்|దగ్గు|shwasa|kasa/i },
  { id: 'diarrhoea', name: 'Diarrhoea / vomiting', pattern: /diarrh|loose motion|vomit|दस्त|उल्टी|জুলাপ|বমি|வயிற்றுப்போக்கு|వాంతి|atisara/i },
  { id: 'rash', name: 'Fever with rash', pattern: /rash|चकत्ते|দানা|தடிப்பு|దద్దుర్లు/i },
  { id: 'jaundice', name: 'Jaundice', pattern: /jaundice|पीलिया|কামলা|மஞ்சள் காமாலை|కామెర్లు|kamala/i }
];

export function getOperationalSnapshot() {
  const today = localDate();
  const active = db.prepare(`
    SELECT s.id, s.department, s.token_no, s.token_date, s.triage_priority, s.status, s.created_at, s.called_at, s.consult_started_at
    FROM sessions s WHERE s.status IN ('PENDING_DOCTOR', 'IN_CONSULTATION', 'DIVERTED_EMERGENCY')
  `).all() as any[];

  const todayRows = db.prepare(`
    SELECT s.triage_priority, s.status, s.care_stream, COALESCE(s.language, p.language) AS language, s.department,
           s.created_at, s.consult_started_at, s.completed_at
    FROM sessions s JOIN patients p ON p.id = s.patient_id
    WHERE (s.token_date = ? OR (s.token_date IS NULL AND date(s.created_at) = date('now'))) AND s.status != 'DEMO_PARKED'
  `).all(today) as any[];

  const recent = db.prepare(`
    SELECT department, created_at, consult_started_at, completed_at FROM sessions
    WHERE completed_at IS NOT NULL AND consult_started_at IS NOT NULL AND completed_at > datetime('now', '-7 days') AND status != 'DEMO_PARKED'
  `).all() as any[];

  const rooms = (Object.keys(DEPARTMENT_ROOMS) as DepartmentCode[]).map(code => {
    const d = DEPARTMENT_ROOMS[code];
    const queued = active.filter(a => a.department === code);
    const consultMins = median(recent.filter(r => r.department === code).map(r => minutesBetween(r.consult_started_at, r.completed_at)));
    const waiting = queued.filter(q => q.status !== 'IN_CONSULTATION').length;
    return {
      departmentCode: code,
      roomNumber: d.room,
      department: d.name,
      stream: d.stream,
      queuedPatientsCount: queued.length,
      waitingCount: waiting,
      inConsultation: queued.filter(q => q.status === 'IN_CONSULTATION').length,
      medianConsultMinutes: consultMins === null ? null : Math.round(consultMins * 10) / 10,
      emergencyCount: queued.filter(q => q.triage_priority === 'EMERGENCY_RED_FLAG').length,
      // A room is busy when the expected wait for the last patient exceeds 45 minutes.
      pacingStatus: waiting * (consultMins ?? 8) > 45 ? 'BUSY' : 'OK'
    };
  });

  const count = (pred: (r: any) => boolean) => todayRows.filter(pred).length;
  const waits = todayRows.map(r => minutesBetween(r.created_at, r.consult_started_at));
  const consults = todayRows.map(r => minutesBetween(r.consult_started_at, r.completed_at));
  const groupCount = (key: string) => todayRows.reduce<Record<string, number>>((acc, r) => {
    const k = r[key] || 'UNKNOWN';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const sos = db.prepare(`SELECT created_at, acknowledged_at FROM alerts WHERE kind = 'SOS' AND created_at > datetime('now', '-1 day')${samplesHidden() ? ' AND is_demo = 0' : ''}`).all() as any[];

  // Visits still open from an earlier day: they explain "0 checked in today" beside "10 waiting now".
  const fromEarlierDay = (a: any) => (a.token_date || localDate(new Date(a.created_at))) !== today;
  const openNow = active.filter(a => a.status === 'PENDING_DOCTOR' || a.status === 'IN_CONSULTATION');

  return {
    date: today,
    totals: {
      checkedInToday: todayRows.length,
      waitingNow: active.filter(a => a.status === 'PENDING_DOCTOR').length,
      inConsultationNow: active.filter(a => a.status === 'IN_CONSULTATION').length,
      emergencyNow: active.filter(a => a.triage_priority === 'EMERGENCY_RED_FLAG').length,
      carriedOver: openNow.filter(fromEarlierDay).length,
      emergencyCarriedOver: active.filter(a => a.triage_priority === 'EMERGENCY_RED_FLAG' && fromEarlierDay(a)).length,
      completedToday: count(r => r.status === 'COMPLETED'),
      notSeen: count(r => r.status === 'NOT_SEEN')
    },
    triageToday: {
      emergency: count(r => r.triage_priority === 'EMERGENCY_RED_FLAG'),
      high: count(r => r.triage_priority === 'HIGH_PRIORITY'),
      routine: count(r => r.triage_priority === 'ROUTINE')
    },
    byCareStream: groupCount('care_stream'),
    byLanguage: groupCount('language'),
    byDepartment: groupCount('department'),
    timings: {
      medianWaitMinutes: median(waits),
      medianConsultMinutes: median(consults),
      sosAlerts24h: sos.length,
      medianSosAckSeconds: (() => {
        const m = median(sos.map(a => minutesBetween(a.created_at, a.acknowledged_at) * 60));
        return m === null ? null : Math.round(m);
      })()
    },
    rooms
  };
}

export function getDailyTrend(days = 14) {
  const rows = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS visits,
      SUM(CASE WHEN triage_priority = 'EMERGENCY_RED_FLAG' THEN 1 ELSE 0 END) AS emergencies,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
    FROM sessions WHERE created_at > datetime('now', ?) AND status != 'DEMO_PARKED'
    GROUP BY day ORDER BY day
  `).all(`-${days} days`) as any[];
  return rows;
}

/**
 * Syndromic surveillance prompts. Signal when this week's count is at least 5 and above
 * mean + 2·sqrt(mean) of the previous four weeks (a Poisson-style upper limit).
 */
export function getSyndromicSignals() {
  const rows = db.prepare(`
    SELECT created_at, symptoms_json, raw_transcript FROM sessions WHERE created_at > datetime('now', '-35 days') AND status != 'DEMO_PARKED'
  `).all() as any[];
  const now = Date.now();
  return SYNDROMES.map(s => {
    const weeks = [0, 0, 0, 0, 0];
    for (const r of rows) {
      const symptoms = safeParse<any[]>(r.symptoms_json, []);
      const text = `${symptoms.map(x => `${x.name || ''} ${x.labelLocal || ''}`).join(' ')} ${r.raw_transcript || ''}`;
      if (!s.pattern.test(text)) continue;
      const w = Math.floor((now - new Date(r.created_at).getTime()) / (7 * 86400000));
      if (w >= 0 && w < 5) weeks[w]++;
    }
    const thisWeek = weeks[0];
    const baseline = (weeks[1] + weeks[2] + weeks[3] + weeks[4]) / 4;
    const threshold = baseline + 2 * Math.sqrt(Math.max(baseline, 1));
    return {
      id: s.id,
      syndrome: s.name,
      thisWeek,
      baselineWeeklyMean: Math.round(baseline * 10) / 10,
      threshold: Math.round(threshold * 10) / 10,
      signal: thisWeek >= 5 && thisWeek > threshold,
      weekly: weeks.slice().reverse()
    };
  });
}

/** Medicine-safety outcomes: interaction warnings raised while prescribing. */
export function getPrescribingSafety(days = 30) {
  const enc = db.prepare(`SELECT case_sheet_json FROM encounters WHERE created_at > datetime('now', ?) AND ${realOnly('patient_id')}`).all(`-${days} days`) as any[];
  const bySeverity: Record<string, number> = {};
  const pairs: Record<string, number> = {};
  let prescriptions = 0;
  let withWarning = 0;
  for (const e of enc) {
    const sheet = safeParse<any>(e.case_sheet_json, {});
    prescriptions++;
    const alerts: any[] = sheet.conflictAlerts || [];
    if (alerts.length) withWarning++;
    for (const a of alerts) {
      bySeverity[a.severity || 'UNKNOWN'] = (bySeverity[a.severity || 'UNKNOWN'] || 0) + 1;
      const key = `${a.itemA || '?'} + ${a.itemB || '?'}`;
      pairs[key] = (pairs[key] || 0) + 1;
    }
  }
  return {
    days,
    prescriptions,
    prescriptionsWithWarning: withWarning,
    bySeverity,
    topPairs: Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pair, count]) => ({ pair, count }))
  };
}

/** Did patients who were asked to come back actually return (within ±3 days of the due date)? */
export function getFollowUpAdherence() {
  const enc = db.prepare(`
    SELECT e.patient_id, e.created_at, e.case_sheet_json FROM encounters e WHERE e.created_at > datetime('now', '-90 days') AND ${realOnly('e.patient_id')}
  `).all() as any[];
  let due = 0;
  let returned = 0;
  let upcoming = 0;
  const now = Date.now();
  const visitsStmt = db.prepare('SELECT created_at FROM sessions WHERE patient_id = ? AND created_at > ?');
  for (const e of enc) {
    const days = Number(safeParse<any>(e.case_sheet_json, {}).followUpDays);
    if (!days) continue;
    const dueAt = new Date(e.created_at).getTime() + days * 86400000;
    if (dueAt > now) { upcoming++; continue; }
    if (dueAt + 3 * 86400000 > now) continue; // window still open
    due++;
    const later = (visitsStmt.all(e.patient_id, e.created_at) as any[]).map(v => new Date(v.created_at).getTime());
    if (later.some(t => Math.abs(t - dueAt) <= 3 * 86400000)) returned++;
  }
  return { due, returned, upcoming, adherence: due ? Math.round((returned / due) * 100) : null };
}
