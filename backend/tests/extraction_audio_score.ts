/**
 * Scores recogniser transcripts of the extraction sets (written by edge-ai/eval/extraction_audio.py) with the
 * same pipeline the kiosk uses (services/intakeExtraction.service.ts).
 *
 *   npx tsx tests/extraction_audio_score.ts ../edge-ai/eval/results/extraction_hyps.jsonl [--split] [-v cond]
 *
 * --split   report TUNE (gold + blind sentences) and TEST (holdout + final) separately; tune on TUNE only
 * -v cond   print every failed check for one condition (e.g. -v babble10, or TEST:babble10 with --split)
 * Rows carrying `alts` (re-check decodes from the speech service) are scored the way production does it, through
 * analyseTranscript(hyp, …, alts); --no-alts scores the primary decode alone.
 * --merge union|majority|primary  extra transcript files of the same clips (e.g. speed-perturbed re-decodes) after
 *           the main file: findings from all transcripts are combined by the rule before scoring
 */
import { readFileSync } from 'node:fs';
import { analyseTranscript } from '../src/services/intakeExtraction.service';
import { FAMILIES } from './extraction_gold.test';

const HIST: Record<string, RegExp> = { diabetes: /diabetes/i, hypertension: /hypertension/i, asthma: /asthma/i, thyroid: /thyroid/i, tb: /tuberculosis/i, heart: /coronary/i };
const CONDS = ['clean', 'babble20', 'babble10', 'babble5', 'hall'];

const lev = (a: string, b: string) => {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let p = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] !== b[j - 1] ? 1 : 0)); p = t; }
  }
  return d[b.length];
};
export type MergeRule = 'union' | 'majority' | 'primary' | 'hybrid';
const familyOf = (name: string) => Object.keys(FAMILIES).find(f => FAMILIES[f].test(name || '')) || name;

/**
 * Combines analyses of several transcripts of ONE utterance (the first is the primary decode).
 * union: a finding counts if any transcript has it; majority: if more than half do; primary: if the primary has it
 * or every other transcript agrees; hybrid: union for findings, but an emergency needs the primary or two transcripts.
 * Vitals: the primary's reading, else one the others agree on.
 */
export function mergeAnalyses(list: any[], rule: MergeRule): any {
  const n = list.length;
  const need = (votes: number, inPrimary: boolean) =>
    rule === 'union' || rule === 'hybrid' ? votes >= 1 : rule === 'majority' ? votes > n / 2 : inPrimary || votes >= n - 1;
  const fam = new Map<string, { votes: number; inPrimary: boolean; sym: any }>();
  list.forEach((a, k) => {
    const seen = new Set<string>();
    for (const sy of a.symptoms.filter((x: any) => !x.isNegated)) {
      const f = familyOf(sy.name);
      if (seen.has(f)) continue;
      seen.add(f);
      const e = fam.get(f) || { votes: 0, inPrimary: false, sym: sy };
      e.votes++;
      if (k === 0) { e.inPrimary = true; e.sym = sy; }
      fam.set(f, e);
    }
  });
  const symptoms = [...fam.values()].filter(e => need(e.votes, e.inPrimary)).map(e => e.sym);
  const vitals: Record<string, unknown> = {};
  for (const key of new Set(list.flatMap(a => Object.keys(a.vitals || {})))) {
    const vals = list.map(a => (a.vitals || {})[key]).filter(v => v !== undefined).map(String);
    const primary = (list[0].vitals || {})[key];
    const agreed = vals.find(v => vals.filter(x => x === v).length >= 2);
    if (primary !== undefined) vitals[key] = primary;
    else if (agreed !== undefined) vitals[key] = isNaN(Number(agreed)) ? agreed : Number(agreed);
    else if ((rule === 'union' || rule === 'hybrid') && vals.length) vitals[key] = isNaN(Number(vals[0])) ? vals[0] : Number(vals[0]);
  }
  const histVotes = new Map<string, number>();
  list.forEach(a => new Set<string>(a.pastHistory).forEach(h => histVotes.set(h, (histVotes.get(h) || 0) + 1)));
  const pastHistory = [...histVotes].filter(([h, v]) => need(v, list[0].pastHistory.includes(h))).map(([h]) => h);
  const flags = list.filter(a => a.isEmergencyRedFlag).length;
  const emergency = rule === 'hybrid' ? !!list[0].isEmergencyRedFlag || flags >= 2 : need(flags, !!list[0].isEmergencyRedFlag);
  return { symptoms, vitals, pastHistory, isEmergencyRedFlag: emergency, redFlagTriggers: list.flatMap(a => a.redFlagTriggers || []) };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

export function scoreTranscripts(file: string, opts: { split?: boolean; show?: string; extra?: string[]; merge?: MergeRule; noAlts?: boolean } = {}) {
  const load = (f: string) => readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const rows = load(file);
  const extraRows = (opts.extra || []).map(f => new Map(load(f).map((r: any) => [`${r.i}|${r.cond}`, r.hyp as string])));
  const acc: Record<string, Record<string, [number, number]>> = {};
  const cer: Record<string, [number, number]> = {};
  for (const r of rows) {
    const split = opts.split ? (r.case.set === 'holdout' || r.case.set === 'final' ? 'TEST' : 'TUNE') : 'ALL';
    const key = `${split}:${r.cond}`;
    const a = (acc[key] ||= {});
    const chk = (cat: string, ok: boolean, msg: string) => {
      (a[cat] ||= [0, 0])[1]++;
      if (ok) a[cat][0]++;
      else if (opts.show && (opts.show === key || opts.show === r.cond)) console.log(`  [${cat}] ${msg}`);
    };
    (cer[r.cond] ||= [0, 0]);
    cer[r.cond][0] += lev(norm(r.case.t), norm(r.hyp));
    cer[r.cond][1] += norm(r.case.t).length;
    const empty = { symptoms: [], vitals: {}, pastHistory: [], isEmergencyRedFlag: false, redFlagTriggers: [] };
    const analyse = (h: string): any => (h ? analyseTranscript(h) : empty);
    const d: any = extraRows.length && opts.merge
      ? mergeAnalyses([analyse(r.hyp), ...extraRows.map(m => analyse(m.get(`${r.i}|${r.cond}`) || ''))], opts.merge)
      : r.hyp && Array.isArray(r.alts) && r.alts.length && !opts.noAlts ? analyseTranscript(r.hyp, undefined, undefined, r.alts) : analyse(r.hyp);
    const pres = (f: string) => d.symptoms.filter((s: any) => !s.isNegated && FAMILIES[f].test(s.name || ''));
    const c = r.case;
    const tag = `(${r.lang}) "${c.t}" → "${r.hyp}"`;
    for (const f of c.p || []) chk('symptom found', pres(f).length > 0, `${tag} want ${f}`);
    for (const f of c.n || []) chk('denied / not said', pres(f).length === 0, `${tag} must not report ${f}`);
    for (const [k, v] of Object.entries(c.v || {})) chk('vital exact', String(d.vitals[k]) === String(v), `${tag} ${k}=${v} got ${d.vitals[k]}`);
    for (const [f, v] of Object.entries(c.d || {})) { const s = pres(f)[0]; chk('duration', !!s && s.onset === v, `${tag} ${f} ${v} got ${s?.onset}`); }
    for (const h of c.h || []) chk('history', d.pastHistory.some((x: string) => HIST[h].test(x)), `${tag} history ${h}`);
    for (const h of c.nh || []) chk('no false history', !d.pastHistory.some((x: string) => HIST[h].test(x)), `${tag} no history ${h}`);
    if (c.rf === true) chk('emergency caught', d.isEmergencyRedFlag, `${tag} emergency missed`);
    if (c.rf === false) chk('no false alarm', !d.isEmergencyRedFlag, `${tag} false alarm ${(d.redFlagTriggers || []).slice(0, 1)}`);
  }
  const conds = CONDS.filter(c => cer[c]);
  console.log(`${rows.length / conds.length} sentences × ${conds.length} conditions. Recogniser character error rate: ` +
    conds.map(c => `${c} ${(100 * cer[c][0] / cer[c][1]).toFixed(1)}%`).join(', '));
  const summary: Record<string, number> = {};
  for (const split of opts.split ? ['TUNE', 'TEST'] : ['ALL']) {
    console.log(`\n${split.padEnd(20)}` + conds.map(c => c.padStart(10)).join(''));
    const cats = [...new Set(conds.flatMap(c => Object.keys(acc[`${split}:${c}`] || {})))];
    for (const cat of [...cats, 'ALL CHECKS']) {
      console.log(`  ${cat.padEnd(18)}` + conds.map(c => {
        const a = acc[`${split}:${c}`] || {};
        const [ok, n] = cat === 'ALL CHECKS' ? Object.values(a).reduce((x, y) => [x[0] + y[0], x[1] + y[1]], [0, 0]) : a[cat] || [0, 0];
        if (cat === 'ALL CHECKS') summary[`${split}:${c}`] = n ? ok / n : 0;
        return (n ? `${(100 * ok / n).toFixed(1)}%` : '-').padStart(10);
      }).join(''));
    }
  }
  return summary;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: npx tsx tests/extraction_audio_score.ts <extraction_hyps.jsonl> [--split] [-v cond]'); process.exit(2); }
  const v = process.argv.indexOf('-v');
  const m = process.argv.indexOf('--merge');
  const extra = process.argv.slice(3).filter((a, k, all) => a.endsWith('.jsonl'));
  scoreTranscripts(file, { split: process.argv.includes('--split'), show: v > 0 ? process.argv[v + 1] : undefined,
    extra, merge: m > 0 ? (process.argv[m + 1] as MergeRule) : undefined, noAlts: process.argv.includes('--no-alts') });
}
