// Safety benchmark against /api/contraindications/evaluate (read-only).
// Usage (backend running on :8001):
//   node docs/evidence/doctor_desk_safety_bench.mjs "$PWD" /tmp/bench.json <sessionId of a penicillin-allergic patient>
// See docs/DOCTOR_DESK_DEEP_REVIEW.md, Appendix A.
// MUST = a clinically established problem the desk should at least warn about.
// BENIGN = common, accepted practice that must not raise a CRITICAL (interruptive) alert.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.argv[2];
const OUT = process.argv[3];
const BASE = 'http://127.0.0.1:8001';
const seed = readFileSync(`${ROOT}/backend/src/db/demoStaff.ts`, 'utf8');
const pin = (seed.match(/username: 'dr\.sharma'[^}]*?pin: '([^']+)'/) || [])[1];
const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'dr.sharma', pin }) })).json();
const token = login.token || login.data?.token;

const m = (name, dosage = '') => ({ name, dosage, frequency: 'BD', route: 'ORAL', durationDays: 5 });
const a = (classicalName, anupana = '') => ({ classicalName, anupana, dose: '', frequency: 'BD', durationDays: 15 });

const CASES = [
  // --- drug–drug (common Indian OPD majors) ---
  ['MUST', 'DDI', 'Warfarin + ibuprofen (bleeding)', { allopathic: [m('Warfarin'), m('Ibuprofen')] }],
  ['MUST', 'DDI', 'Warfarin + diclofenac (bleeding)', { allopathic: [m('Warfarin'), m('Diclofenac')] }],
  ['MUST', 'DDI', 'Warfarin + metronidazole (INR rise)', { allopathic: [m('Warfarin'), m('Metronidazole')] }],
  ['MUST', 'DDI', 'Warfarin + fluconazole (INR rise)', { allopathic: [m('Warfarin'), m('Fluconazole')] }],
  ['MUST', 'DDI', 'Simvastatin + clarithromycin (rhabdomyolysis)', { allopathic: [m('Simvastatin'), m('Clarithromycin')] }],
  ['MUST', 'DDI', 'Sildenafil + isosorbide mononitrate (hypotension)', { allopathic: [m('Sildenafil'), m('Isosorbide mononitrate')] }],
  ['MUST', 'DDI', 'Tizanidine + ciprofloxacin (contraindicated)', { allopathic: [m('Tizanidine'), m('Ciprofloxacin')] }],
  ['MUST', 'DDI', 'Methotrexate + cotrimoxazole (marrow toxicity)', { allopathic: [m('Methotrexate'), m('Cotrimoxazole')] }],
  ['MUST', 'DDI', 'Tramadol + sertraline (serotonin toxicity)', { allopathic: [m('Tramadol'), m('Sertraline')] }],
  ['MUST', 'DDI', 'Spironolactone + enalapril (hyperkalaemia)', { allopathic: [m('Spironolactone'), m('Enalapril')] }],
  ['MUST', 'DDI', 'Lithium + ibuprofen (lithium toxicity)', { allopathic: [m('Lithium carbonate'), m('Ibuprofen')] }],
  ['MUST', 'DDI', 'Azathioprine + allopurinol (marrow toxicity)', { allopathic: [m('Azathioprine'), m('Allopurinol')] }],
  ['MUST', 'DDI', 'Theophylline + ciprofloxacin (theophylline toxicity)', { allopathic: [m('Theophylline'), m('Ciprofloxacin')] }],
  ['MUST', 'DDI', 'Rifampicin + oral contraceptive (failure)', { allopathic: [m('Rifampicin'), m('Ethinylestradiol + Levonorgestrel')] }],
  ['MUST', 'DUP', 'Ibuprofen + diclofenac (duplicate NSAID)', { allopathic: [m('Ibuprofen'), m('Diclofenac')] }],
  ['MUST', 'DUP', 'Pantoprazole + omeprazole (duplicate PPI)', { allopathic: [m('Pantoprazole'), m('Omeprazole')] }],
  // --- patient context ---
  ['MUST', 'ALLERGY', 'Penicillin allergy + amoxicillin', { sessionId: 'SESSION', allopathic: [m('Amoxicillin')] }],
  ['MUST', 'PREG', 'Pregnancy + enalapril', { patientContext: { isPregnant: true, age: 28 }, allopathic: [m('Enalapril')] }],
  ['MUST', 'PREG', 'Pregnancy + atorvastatin', { patientContext: { isPregnant: true, age: 28 }, allopathic: [m('Atorvastatin')] }],
  ['MUST', 'PREG', 'Pregnancy + doxycycline', { patientContext: { isPregnant: true, age: 28 }, allopathic: [m('Doxycycline')] }],
  ['MUST', 'PREG', 'Pregnancy + sodium valproate', { patientContext: { isPregnant: true, age: 28 }, allopathic: [m('Sodium valproate')] }],
  ['MUST', 'PREG', 'Pregnancy + misoprostol', { patientContext: { isPregnant: true, age: 28 }, allopathic: [m('Misoprostol')] }],
  ['MUST', 'RENAL', 'eGFR 20 + metformin', { patientContext: { eGfr: 20, age: 70 }, allopathic: [m('Metformin')] }],
  ['MUST', 'RENAL', 'eGFR 20 + nitrofurantoin', { patientContext: { eGfr: 20, age: 70 }, allopathic: [m('Nitrofurantoin')] }],
  ['MUST', 'RENAL', 'eGFR 25 + diclofenac', { patientContext: { eGfr: 25, age: 70 }, allopathic: [m('Diclofenac')] }],
  ['MUST', 'PAED', 'Age 6 + aspirin (Reye syndrome)', { patientContext: { age: 6 }, allopathic: [m('Aspirin')] }],
  ['MUST', 'PAED', 'Age 8 + codeine', { patientContext: { age: 8 }, allopathic: [m('Codeine')] }],
  ['MUST', 'PAED', 'Age 3, 13 kg + paracetamol 650 mg TDS (overdose)', { patientContext: { age: 3, weightKg: 13 }, allopathic: [m('Paracetamol', '650 mg')] }],
  ['MUST', 'ELDER', 'Age 78 + glibenclamide (Beers)', { patientContext: { age: 78 }, allopathic: [m('Glibenclamide')] }],
  ['MUST', 'FDC', 'Banned FDC aceclofenac + paracetamol', { allopathic: [m('Aceclofenac + Paracetamol')] }],
  ['MUST', 'FDC', 'Banned FDC cetirizine + paracetamol + phenylephrine', { allopathic: [m('Cetirizine + Paracetamol + Phenylephrine')] }],
  // --- herb–drug the registry claims to cover ---
  ['MUST', 'HDI', 'Digoxin + Yashtimadhu', { allopathic: [m('Digoxin')], ayush: [a('Yashtimadhu Churna')] }],
  ['MUST', 'HDI', 'Metronidazole + Draksharishta (alcohol in arishta)', { allopathic: [m('Metronidazole')], ayush: [a('Draksharishta')] }],
  ['MUST', 'SCHED', 'Sutshekhar Ras (contains mercury compounds) flagged as Schedule E(1)', { ayush: [a('Sutshekhar Ras')] }],
  // --- benign: must NOT be CRITICAL ---
  ['BENIGN', 'HDI', 'Aspirin + ginger juice (Adrak swarasa)', { allopathic: [m('Aspirin')], ayush: [a('Ginger Swarasa')] }],
  ['BENIGN', 'HDI', 'Metformin + Nisha Amalaki (registry itself says SAFE)', { allopathic: [m('Metformin')], ayush: [a('Nisha Amalaki')] }],
  ['BENIGN', 'VIRUDDHA', 'Sitopaladi with honey + ghee (classical anupana)', { ayush: [a('Sitopaladi Churna', 'Madhu (Honey) + Ghrita (Ghee)')] }],
  ['BENIGN', 'HDI', 'Fluoxetine + Jatamansi (not St John\'s wort)', { allopathic: [m('Fluoxetine')], ayush: [a('Jatamansi Churna')] }],
  ['BENIGN', 'HDI', 'Ciprofloxacin + Praval Pishti (spacing issue, not contraindication)', { allopathic: [m('Ciprofloxacin')], ayush: [a('Praval Pishti')] }],
  ['BENIGN', 'DDI', 'Telmisartan + amlodipine (standard IHCI step)', { allopathic: [m('Telmisartan'), m('Amlodipine')] }],
  ['BENIGN', 'DDI', 'Metoprolol + digoxin (common in AF; monitor)', { allopathic: [m('Metoprolol'), m('Digoxin')] }],
  ['BENIGN', 'DDI', 'Telmisartan + ibuprofen 3 days (monitor, not contraindicated)', { allopathic: [m('Telmisartan'), m('Ibuprofen')] }],
  ['BENIGN', 'SCHED', 'Ashwagandha Rasayana must not be called Schedule E(1)', { ayush: [a('Ashwagandha Rasayana')] }]
];

const SESSION = process.argv[4];
const rows = [];
for (const [kind, cat, label, bodyIn] of CASES) {
  const body = { allopathic: [], ayush: [], ...bodyIn };
  if (body.sessionId === 'SESSION') body.sessionId = SESSION;
  const r = await fetch(`${BASE}/api/contraindications/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = await r.json();
  const alerts = (j.alerts || []).map(x => x.severity);
  const critical = alerts.filter(s => /CRITICAL/.test(s)).length;
  const anyClinical = alerts.filter(s => s !== 'SAFE_COMBINATION').length;
  let pass;
  if (cat === 'SCHED' && kind === 'MUST') pass = alerts.includes('STATUTORY_SCHEDULE_E1');
  else if (cat === 'SCHED') pass = !alerts.includes('STATUTORY_SCHEDULE_E1');
  else pass = kind === 'MUST' ? anyClinical > 0 : critical === 0;
  rows.push({ kind, cat, label, pass, alerts });
}
const must = rows.filter(r => r.kind === 'MUST');
const benign = rows.filter(r => r.kind === 'BENIGN');
const lines = [];
lines.push(`Sensitivity (MUST cases that raised any alert): ${must.filter(r => r.pass).length}/${must.length}`);
lines.push(`Specificity (BENIGN cases without a CRITICAL / wrong flag): ${benign.filter(r => r.pass).length}/${benign.length}`);
for (const r of rows) lines.push(`${r.pass ? 'PASS' : 'FAIL'} ${r.kind.padEnd(6)} ${r.cat.padEnd(8)} ${r.label}  -> [${r.alerts.join(', ') || 'no alerts'}]`);
console.log(lines.join('\n'));
writeFileSync(OUT, JSON.stringify(rows, null, 2));
