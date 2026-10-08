/**
 * Server-side emergency rules (services/clinicalLexicon.ts): the generated copy must match the frontend
 * original, and every red-flag sentence in the frozen test set must be flagged.
 *   npm run test:lexicon
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyseComplaint } from '../src/services/clinicalLexicon';

const root = resolve(__dirname, '../..');
let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };

if (existsSync(resolve(root, 'frontend/src/utils/clinicalLexicon.ts'))) {
  let inSync = true;
  try { execFileSync('node', [resolve(root, 'scripts/sync-clinical-lexicon.mjs'), '--check'], { stdio: 'pipe' }); } catch { inSync = false; }
  check(inSync, 'backend copy of clinicalLexicon.ts matches the frontend original');
}

const casesFile = resolve(root, 'edge-ai/eval/cases.json');
if (existsSync(casesFile)) {
  const C = JSON.parse(readFileSync(casesFile, 'utf8'));
  const rf = [...C.hi, ...C.en].filter((c: any[]) => c[2]);
  const missed = rf.filter((c: any[]) => !analyseComplaint(c[0]).redFlags.length).map((c: any[]) => c[0]);
  check(missed.length === 0, `red-flag sentences caught by the rules (${rf.length - missed.length}/${rf.length}; missed: ${missed.join(' | ') || 'none'})`);
  const ooc = C.ooc.map((c: any[]) => c[0]).filter((t: string) => !analyseComplaint(t).redFlags.length);
  check(ooc.length === 0, `emergencies with no catalog card flagged (missed: ${ooc.join(' | ') || 'none'})`);
  const visits = C.visit.filter((t: string) => analyseComplaint(t).visitReason !== 'follow-up');
  check(visits.length === 0, `follow-up visits recognised (missed: ${visits.join(' | ') || 'none'})`);
}

const tiers: Array<[string, string]> = [
  ['सीने में दर्द बाएँ हाथ तक', 'sos'], ['saans nahi aa rahi', 'sos'], ['बेहोश हो गए', 'sos'], ['snake bite', 'sos'],
  ['कुत्ते ने काट लिया', 'urgent'], ['hath jal gaya', 'urgent'], ['घुटने में दर्द है', 'none']
];
for (const [text, want] of tiers) {
  const a = analyseComplaint(text);
  const got = a.sos ? 'sos' : a.redFlags.length ? 'urgent' : 'none';
  check(got === want, `"${text}" → ${got} (want ${want})`);
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('clinical lexicon: all checks passed');
