/**
 * Gold-set evaluation of transcript → structured intake (services/intakeExtraction.service.ts).
 * Cases: edge-ai/eval/extraction_cases.json — Hindi as the on-prem recogniser writes it, Hinglish, English.
 *   npm run test:extraction           report + gates
 *   npm run test:extraction -- -v     also list every failed check
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyseTranscript } from '../src/services/intakeExtraction.service';

/** Symptom families: a parser symptom name belongs to the family whose pattern it matches. */
export const FAMILIES: Record<string, RegExp> = {
  fever: /fever|jwara/i,
  cough: /cough|kasa/i,
  chest_pain: /chest|substernal|angina|precordial/i,
  headache: /headache|migraine|ardhavabhedaka/i,
  abdominal_pain: /abdominal pain|abdominal colic|stomach|udara|umbilical|nabhi|pelvic|hypogastric|appendic|upper abdominal|epigastric pain/i,
  acidity: /acidity|heartburn|amlapitta|pyrosis|gerd|dyspepsia|eructation/i,
  gas: /flatulence|aanaha|distension|bloating/i,
  vomiting: /vomit/i,
  nausea: /nausea|hrillasa/i,
  diarrhoea: /diarrh|loose|atisara/i,
  breathless: /dyspn|breath|shwasa/i,
  dizziness: /vertigo|giddi|dizz|bhrama/i,
  weakness: /weakness|asthenia|fatigue|lethargy|tandra/i,
  back_pain: /back pain|kati/i,
  knee_pain: /knee|janu/i,
  joint_pain: /joint|arthral|sandhi/i,
  dysuria: /dysuria|micturition/i,
  constipation: /constipation|vibandha/i,
  sore_throat: /sore throat|pharyn|kantharoga/i,
  bodyache: /bodyache|body ache|angamarda/i,
  appetite_loss: /appetite|anorexia|aruchi/i,
  insomnia: /insomnia|anidra|sleep/i,
  itching: /itch|prurit|kandu/i,
  rash: /rash|eruption|dermat/i,
  palpitations: /palpitation|tachycardia/i,
  arm_pain: /arm|hand|wrist/i
};
const HISTORY: Record<string, RegExp> = {
  diabetes: /diabetes/i,
  hypertension: /hypertension/i,
  asthma: /asthma/i,
  thyroid: /thyroid/i,
  tb: /tuberculosis/i,
  heart: /coronary/i
};

interface Case {
  t: string; p?: string[]; n?: string[]; v?: Record<string, string | number>; nv?: string[];
  d?: Record<string, string>; sev?: Record<string, number>; h?: string[]; nh?: string[]; rf?: boolean;
}

export function runExtractionGold(verbose = false) {
  const file = resolve(__dirname, '../../edge-ai/eval/extraction_cases.json');
  const cases: Case[] = JSON.parse(readFileSync(file, 'utf8')).cases;
  const score: Record<string, [number, number]> = {};
  const fails: string[] = [];
  const check = (cat: string, ok: boolean, what: string) => {
    score[cat] ||= [0, 0];
    score[cat][1]++;
    if (ok) score[cat][0]++;
    else fails.push(`[${cat}] ${what}`);
  };

  const t0 = performance.now();
  for (const c of cases) {
    const r = analyseTranscript(c.t);
    const present = (fam: string) => r.symptoms.filter(s => !s.isNegated && FAMILIES[fam].test(s.name || ''));
    const got = r.symptoms.map(s => `${s.name}${s.isNegated ? ' (no)' : ''}${s.onset && s.onset !== 'Unspecified' ? ` [${s.onset}]` : ''}`).join('; ') || 'nothing';
    for (const f of c.p || []) check('symptom found', present(f).length > 0, `"${c.t}" should find ${f} — got ${got}`);
    for (const f of c.n || []) check('negation / no false symptom', present(f).length === 0, `"${c.t}" must not report ${f} — got ${got}`);
    for (const [k, want] of Object.entries(c.v || {})) {
      const val = (r.vitals as any)[k];
      check('vital read exactly', String(val) === String(want), `"${c.t}" ${k} should be ${want} — got ${val ?? 'nothing'}`);
    }
    for (const k of c.nv || []) check('no false vital', (r.vitals as any)[k] === undefined, `"${c.t}" must not read ${k} — got ${(r.vitals as any)[k]}`);
    for (const [f, want] of Object.entries(c.d || {})) {
      const s = present(f)[0];
      const dur = (s as any)?.duration || s?.onset;
      check('duration', dur === want, `"${c.t}" ${f} duration should be ${want} — got ${dur ?? 'nothing'}`);
    }
    for (const [f, min] of Object.entries(c.sev || {})) {
      const s = present(f)[0];
      check('severity', !!s && (s.severityScore ?? s.severity) >= min, `"${c.t}" ${f} severity should be ≥ ${min} — got ${s ? s.severityScore ?? s.severity : 'no symptom'}`);
    }
    for (const h of c.h || []) check('history', r.pastHistory.some(x => HISTORY[h].test(x)), `"${c.t}" history should include ${h} — got ${r.pastHistory.join(', ') || 'nothing'}`);
    for (const h of c.nh || []) check('no false history', !r.pastHistory.some(x => HISTORY[h].test(x)), `"${c.t}" history must not include ${h} — got ${r.pastHistory.join(', ')}`);
    if (c.rf !== undefined) {
      check(c.rf ? 'red flag raised' : 'no false alarm', r.isEmergencyRedFlag === c.rf,
        `"${c.t}" red flag should be ${c.rf} — got ${r.isEmergencyRedFlag}${r.redFlagTriggers.length ? ` (${r.redFlagTriggers.join(' / ')})` : ''}`);
    }
  }
  const ms = (performance.now() - t0) / cases.length;

  let total = 0, passed = 0;
  console.log(`\nTranscript extraction — ${cases.length} gold cases (${ms.toFixed(2)} ms per transcript)`);
  for (const [cat, [ok, n]] of Object.entries(score)) {
    total += n; passed += ok;
    console.log(`  ${cat.padEnd(30)} ${String(ok).padStart(3)}/${String(n).padEnd(3)} ${((100 * ok) / n).toFixed(1).padStart(5)}%`);
  }
  console.log(`  ${'ALL CHECKS'.padEnd(30)} ${String(passed).padStart(3)}/${String(total).padEnd(3)} ${((100 * passed) / total).toFixed(1).padStart(5)}%`);
  if (verbose || fails.length <= 25) fails.forEach(f => console.log(`   FAIL ${f}`));
  else console.log(`   ${fails.length} failed checks (run with -v to list them)`);

  // Gates: every safety-relevant category must be perfect; overall ≥ 97%.
  const perfect = ['red flag raised', 'negation / no false symptom', 'no false alarm', 'vital read exactly', 'no false vital'];
  const gatesOk = perfect.every(c => !score[c] || score[c][0] === score[c][1]) && passed / total >= 0.97;
  console.log(gatesOk ? '  All extraction gates passed.' : '  EXTRACTION GATES FAILED.');
  return { passed, total, gatesOk };
}

if (require.main === module) {
  const { gatesOk } = runExtractionGold(process.argv.includes('-v'));
  process.exit(gatesOk ? 0 : 1);
}
