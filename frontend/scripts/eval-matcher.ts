/**
 * Regression gate for the kiosk symptom matcher and emergency rules.
 *
 *   npm run eval:matcher                                    # text-only, frozen set
 *   npm run eval:matcher -- ../edge-ai/eval/results/x.jsonl  # also score speech transcripts
 *
 * Test set: edge-ai/eval/cases.json (Hindi, Indian English, Hinglish, typed romanised Hindi,
 * emergencies with no catalog card, follow-up visits). Exits non-zero if a text-only gate fails.
 * The on-device voice extractor (vernacularSpeech.ts) is also scored on edge-ai/eval/extraction_cases.json:
 * a symptom the patient denied must never appear.
 * Transcript files are JSON lines {key, sent, cond, hyp} written by edge-ai/eval/transcribe.py.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseComplaint } from '../src/utils/clinicalLexicon';
import { kioskCatalog, SymptomMatcher, SUGGEST_MIN_SCORE } from '../src/utils/symptomMatcher';
import { extractSymptomsFromSpeech } from '../src/utils/vernacularSpeech';

type Case = [text: string, expected: string[], redFlag: boolean, kind: string];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const C = JSON.parse(readFileSync(resolve(root, 'edge-ai/eval/cases.json'), 'utf8')) as {
  hi: Case[]; en: Case[]; typed: Array<[string, string[]]>; ooc: Array<[string, boolean]>; visit: string[];
};
const catalog = kioskCatalog();
const matcher = new SymptomMatcher(catalog);
const known = new Set(catalog.map(e => e.symptom.en));
const emergency = new Set(catalog.filter(e => e.symptom.isEmergency).map(e => e.symptom.en));
const regionOf = new Map(catalog.map(e => [e.symptom.en, e.regions]));
const regionCards = new Map<string, Set<string>>();
catalog.forEach(e => e.regions.forEach(r => { if (!regionCards.has(r)) regionCards.set(r, new Set()); regionCards.get(r)!.add(e.symptom.en); }));

for (const [t, exp] of [...C.hi, ...C.en, ...C.typed]) for (const x of exp) if (!known.has(x)) throw new Error(`cases.json expects "${x}" (for "${t}") but the catalog has no such card`);

/** Flagged for staff: an emergency rule fired, or the best card is a confident emergency card. */
function flagged(text: string): boolean {
  const a = analyseComplaint(text);
  const top = matcher.rank(text, { limit: 1 })[0];
  return a.redFlags.length > 0 || (!!top && top.score >= 0.45 && emergency.has(top.symptom.en));
}

interface Score { n: number; top1: number; top3: number; regN: number; reg1: number; rfN: number; rf: number; faN: number; fa: number; misses: string[] }
function score(items: Array<{ text: string; exp: string[] | null; rf: boolean }>): Score {
  const s: Score = { n: 0, top1: 0, top3: 0, regN: 0, reg1: 0, rfN: 0, rf: 0, faN: 0, fa: 0, misses: [] };
  for (const { text, exp, rf } of items) {
    if (exp) {
      const top = matcher.rank(text, { limit: 3 }).map(m => m.symptom.en);
      s.n++; s.top1 += +exp.includes(top[0]);
      const hit = top.some(x => exp.includes(x)); s.top3 += +hit;
      if (!hit) s.misses.push(`${text}  →  ${top.join(' | ')}`);
      const region = exp.map(e => regionOf.get(e)?.[0]).find(Boolean);
      if (region) { s.regN++; s.reg1 += +exp.includes(matcher.rank(text, { onlyEn: regionCards.get(region), limit: 1 })[0]?.symptom.en); }
    }
    if (rf) { s.rfN++; s.rf += +flagged(text); } else if (exp) { s.faN++; s.fa += +flagged(text); }
  }
  return s;
}
const pct = (a: number, b: number) => (b ? `${a}/${b}` : '-');
const line = (label: string, s: Score) =>
  console.log(`${label.padEnd(22)} #1 ${pct(s.top1, s.n).padEnd(7)} top-3 ${pct(s.top3, s.n).padEnd(7)} after body-tap ${pct(s.reg1, s.regN).padEnd(7)} red flags ${pct(s.rf, s.rfN).padEnd(6)} false alarms ${pct(s.fa, s.faN)}`);

console.log('Text only (what the patient meant)');
const hi = score(C.hi.map(([text, exp, rf]) => ({ text, exp, rf })));
const en = score(C.en.map(([text, exp, rf]) => ({ text, exp, rf })));
const typed = score(C.typed.map(([text, exp]) => ({ text, exp, rf: false })));
line('  Hindi / Hinglish', hi); line('  Indian English', en); line('  Typed romanised', typed);
const ooc = C.ooc.map(([t]) => ({ t, flags: analyseComplaint(t).redFlags }));
const oocHit = ooc.filter(o => o.flags.length).length;
console.log(`  Emergencies without a catalog card: ${oocHit}/${ooc.length} flagged (${ooc.map(o => `${o.t} → ${o.flags.map(f => f.id).join(',') || 'MISSED'}`).join('; ')})`);
const visitHit = C.visit.filter(t => analyseComplaint(t).visitReason === 'follow-up').length;
console.log(`  Follow-up visits recognised: ${visitHit}/${C.visit.length}`);
[...hi.misses, ...en.misses, ...typed.misses].forEach(m => console.log(`    miss: ${m}`));

// Suggestion threshold sanity: how often the right card clears SUGGEST_MIN_SCORE.
const all = [...C.hi, ...C.en].map(([t, e]) => ({ t, e }));
const shown = all.filter(({ t, e }) => matcher.rank(t, { limit: 3 }).some(m => e.includes(m.symptom.en) && m.score >= SUGGEST_MIN_SCORE)).length;
console.log(`  Right card offered as a suggestion (score ≥ ${SUGGEST_MIN_SCORE}): ${shown}/${all.length}`);

// Optional: speech transcripts
for (const file of process.argv.slice(2)) {
  const rows = readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l) as { key: string; sent: string; cond: string; hyp: string });
  const lookup = new Map<string, { exp: string[] | null; rf: boolean }>();
  C.hi.forEach(([, e, rf], i) => lookup.set(`hi_${i}`, { exp: e, rf }));
  C.en.forEach(([, e, rf], i) => lookup.set(`en_${i}`, { exp: e, rf }));
  C.ooc.forEach((_, i) => lookup.set(`ooc_${i}`, { exp: null, rf: true }));
  console.log(`\nSpeech transcripts: ${file}`);
  for (const cond of [...new Set(rows.map(r => r.cond))]) {
    const items = rows.filter(r => r.cond === cond && lookup.has(r.sent)).map(r => ({ text: r.hyp, ...lookup.get(r.sent)! }));
    line(`  ${cond}`, score(items));
  }
}

// ---------------------------------------------------------------- On-device voice findings
// Families the on-device extractor can name (vernacularSpeech.ts rules and "Pain — <area>").
const VOICE: Record<string, RegExp> = {
  fever: /^Fever/, cough: /^Cough/, chest_pain: /^Chest/, headache: /^Headache|Pain — Head/, abdominal_pain: /Pain — .*stomach/i,
  vomiting: /^Vomiting/, nausea: /^Nausea/, diarrhoea: /diarrh/i, breathless: /Breathless/, dizziness: /^Dizz/, weakness: /^Weak/,
  dysuria: /urine/i, knee_pain: /Knee/, back_pain: /Lumbar|back/i, itching: /^Itch/
};
// gold sentences plus the contrast set (one area normal or denied next to a complaint elsewhere, pain that spreads)
const X = ['extraction_cases', 'extraction_contrast'].flatMap(f =>
  JSON.parse(readFileSync(resolve(root, `edge-ai/eval/${f}.json`), 'utf8')).cases as Array<{ t: string; p?: string[]; n?: string[] }>);
let vFound = 0, vWant = 0, vDenied = 0, vDeniedN = 0;
const vMiss: string[] = [];
for (const c of X) {
  const names = extractSymptomsFromSpeech(c.t, /[ऀ-ॿ]/.test(c.t) ? 'hi' : 'en').symptoms.map(s => s.name);
  for (const f of (c.p || []).filter(f => VOICE[f])) { vWant++; if (names.some(n => VOICE[f].test(n))) vFound++; else vMiss.push(`${c.t} → missing ${f}`); }
  for (const f of (c.n || []).filter(f => VOICE[f])) { vDeniedN++; if (!names.some(n => VOICE[f].test(n))) vDenied++; else vMiss.push(`${c.t} → reported denied ${f}`); }
}
console.log(`\nOn-device voice findings (extraction_cases + contrast): found ${vFound}/${vWant}   denied symptoms left out ${vDenied}/${vDeniedN}`);
vMiss.forEach(m => console.log(`    miss: ${m}`));

const failures: string[] = [];
if (vDenied < vDeniedN) failures.push('the on-device extractor reported a symptom the patient denied');
if (vFound < 0.9 * vWant) failures.push('on-device voice findings fell below 90%');
if (hi.rf < hi.rfN || en.rf < en.rfN) failures.push('a red-flag sentence was not flagged');
if (oocHit < ooc.length) failures.push('an emergency without a catalog card was not flagged');
if (hi.top3 < 0.95 * hi.n || en.top3 < 0.95 * en.n || typed.top3 < 0.9 * typed.n) failures.push('top-3 accuracy fell below the gate');
if (visitHit < C.visit.length) failures.push('a follow-up visit was not recognised');
if (failures.length) { console.error(`\nFAILED: ${failures.join('; ')}`); process.exit(1); }
console.log('\nAll text-only gates passed.');
