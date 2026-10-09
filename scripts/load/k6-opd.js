/**
 * OPD load profile for a live demo or a capacity check.
 *
 *   k6 run scripts/load/k6-opd.js
 *   k6 run -e BASE=http://127.0.0.1:8001 -e KIOSKS=10 -e DOCTOR_USER=dr.sharma -e DOCTOR_PIN=... scripts/load/k6-opd.js
 *
 * Scenarios (run together):
 *   kiosks   – KIOSKS virtual kiosks, each: parse a transcript, then check in with consent, every ~30 s
 *   doctors  – DOCTORS virtual doctor desks polling the queue every 5 s (needs DOCTOR_USER/DOCTOR_PIN)
 *   board    – one waiting-room display refreshing the board every 10 s
 * Thresholds mirror what a 10,000 OPD/day hospital needs: p95 under 300 ms for check-in, under 150 ms
 * for the queue. Check-ins are tagged "K6-" so they can be purged afterwards.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:8001';
const KIOSKS = Number(__ENV.KIOSKS || 10);
const DOCTORS = Number(__ENV.DOCTORS || 5);
const DURATION = __ENV.DURATION || '2m';

export const options = {
  scenarios: {
    kiosks: { executor: 'constant-vus', vus: KIOSKS, duration: DURATION, exec: 'kiosk' },
    doctors: { executor: 'constant-vus', vus: DOCTORS, duration: DURATION, exec: 'doctor', startTime: '5s' },
    board: { executor: 'constant-vus', vus: 1, duration: DURATION, exec: 'board' }
  },
  thresholds: {
    'http_req_duration{name:intake}': ['p(95)<300'],
    'http_req_duration{name:parse}': ['p(95)<150'],
    'http_req_duration{name:queue}': ['p(95)<150'],
    'http_req_failed': ['rate<0.01']
  }
};

const TRANSCRIPTS = [
  'मुझे तीन दिन से बुखार है और खांसी है',
  'ghutne me dard hai aur subah akdan rehti hai',
  'pet me jalan aur khatti dakar aati hai',
  'I have a headache since yesterday and feel dizzy',
  'peshab me jalan hai do din se',
  'सीने में दर्द है और पसीना आ रहा है'
];
const consent = { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };
const json = { headers: { 'Content-Type': 'application/json' } };

export function kiosk() {
  const t = TRANSCRIPTS[Math.floor(Math.random() * TRANSCRIPTS.length)];
  const parse = http.post(`${BASE}/api/kiosk/parse-audio`, JSON.stringify({ transcript: t }), { ...json, tags: { name: 'parse' } });
  check(parse, { 'parse 200': r => r.status === 200 });
  const body = {
    patient: { name: `K6-${__VU}-${Date.now()}`, age: 20 + (__VU % 50), gender: __VU % 2 ? 'FEMALE' : 'MALE' },
    careStream: __VU % 3 ? 'ALLOPATHY' : 'AYURVEDA',
    language: 'hi',
    rawTranscript: t,
    symptoms: (parse.json('data.symptoms') || []).slice(0, 5).map(s => ({ name: s.name, site: s.site, severityScore: s.severityScore })),
    vitals: { bp: `${110 + (__VU % 40)}/${70 + (__VU % 20)}`, pulse: 70 + (__VU % 30), spo2: 95 + (__VU % 4), temp: `${98 + (__VU % 3)} F` },
    history: { conditions: __VU % 4 ? [] : ['Diabetes'], allergies: '', currentMedicines: '' },
    consent
  };
  const r = http.post(`${BASE}/api/kiosk/intake`, JSON.stringify(body), { ...json, tags: { name: 'intake' } });
  check(r, { 'intake 200': res => res.status === 200, 'token issued': res => /^[A-Z]+-\d{3}$/.test(res.json('tokenNo') || '') });
  sleep(20 + Math.random() * 20);
}

let token = null;
export function doctor() {
  if (!token && __ENV.DOCTOR_USER && __ENV.DOCTOR_PIN) {
    const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ username: __ENV.DOCTOR_USER, pin: __ENV.DOCTOR_PIN }), json);
    token = login.json('token');
  }
  if (!token) { sleep(5); return; }
  const r = http.get(`${BASE}/api/doctor/queue`, { headers: { Authorization: `Bearer ${token}` }, tags: { name: 'queue' } });
  check(r, { 'queue 200': res => res.status === 200 });
  sleep(5);
}

export function board() {
  const r = http.get(`${BASE}/api/queue/board`, { tags: { name: 'board' } });
  check(r, { 'board 200': res => res.status === 200 });
  sleep(10);
}
