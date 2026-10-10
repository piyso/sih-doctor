/**
 * Shows, step by step, how one spoken or typed sentence becomes a line of the history summary — the same
 * functions the kiosk and the doctor desk use, with every intermediate result kept.
 *
 *   npm run explain -- "मुझे तीन दिन से पेट में दर्द है बुखार नहीं है"
 *
 * It exists to answer "how do you summarise without a language model?" with the machine's own working:
 * each step is a table lookup or a written rule, and the last step names the words every line came from.
 */

import { ClinicalParserService } from './clinicalParser.service';
import { buildHistorySummary, normaliseHistory } from './clinicalHistory.service';
import { conceptMentions, wordKey } from './clinicalLexicon';
import { findDurations, negationAt, numeralize, parseVitals, tokens } from './clinicalText';
import { SummarySource } from '../shared/types';

const CONCEPT_KIND: Record<string, string> = { S: 'body area', F: 'finding', Q: 'qualifier', R: 'emergency sign', V: 'visit reason' };
/** "S_STOMACH" → "body area: stomach" */
export const describeConcept = (c: string): string => `${CONCEPT_KIND[c[0]] || 'concept'}: ${c.slice(2).toLowerCase().replace(/_/g, ' ')}`;

export interface SummaryTrace {
  input: string;
  /** 1. Number words written as digits ("तीन" → 3, "एक सौ पचास बटा पचानवे" → 150 बटा 95). */
  numbers: { text: string; changed: boolean };
  /** 2. Each known word reduced to a sound key and looked up in the clinical dictionary. */
  lookup: Array<{ words: string; soundKey: string; means: string[]; denied: boolean; denialWord?: string }>;
  /** 3. Written rules that read the words around each match. */
  context: { durations: string[]; vitals: Record<string, unknown>; pastHistory: string[]; emergency: boolean; emergencyReasons: string[] };
  /** 4. The structured record: named slots, nothing free-form. */
  record: Array<{ complaint: string; site?: string; since?: string; denied: boolean; spreadsTo?: string; worseWith?: string; betterWith?: string; severity?: number }>;
  /** 5. The slots dropped into fixed sentence frames, with the patient's words each line came from. */
  summary: Array<{ section: string; english: string; hindi: string; sources?: SummarySource[] }>;
  method: string;
  milliseconds: number;
}

export function traceSummary(input: string): SummaryTrace {
  const t0 = performance.now();
  const text = (input || '').trim();
  const digits = numeralize(text);

  const seen = new Set<string>();
  const lookup: SummaryTrace['lookup'] = [];
  for (const m of conceptMentions(text)) {
    const id = `${m.start}:${m.end}:${m.concepts.join(',')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const words = text.slice(m.start, m.end);
    const first = tokens(words).find(t => !t.punct);
    const neg = negationAt(text, m.start, m.end);
    lookup.push({ words, soundKey: first ? wordKey(first.text) : '', means: m.concepts.map(describeConcept), denied: m.negated, ...(m.negated && neg.cue ? { denialWord: neg.cue } : {}) });
  }

  const parsed: any = ClinicalParserService.parse(text);
  const symptoms: any[] = parsed.symptoms || [];
  const vitals = { ...parseVitals(text) };
  const record: SummaryTrace['record'] = symptoms.map(s => ({
    complaint: s.name, denied: !!s.isNegated,
    ...(s.site && !/^(unspecified|general)$/i.test(s.site) ? { site: s.site } : {}),
    ...(s.onset && s.onset !== 'Unspecified' ? { since: s.onset } : {}),
    ...(s.radiation ? { spreadsTo: s.radiation } : {}), ...(s.exacerbating ? { worseWith: s.exacerbating } : {}),
    ...(s.relieving ? { betterWith: s.relieving } : {}), ...(Number(s.severityScore) > 0 ? { severity: Number(s.severityScore) } : {})
  }));

  const s = buildHistorySummary({ patient: {}, symptoms, history: normaliseHistory({}), vitals, rawTranscript: text });
  const shown = s.sections.filter(sec => ['chiefComplaint', 'hpi', 'vitals'].includes(sec.id));

  return {
    input: text,
    numbers: { text: digits, changed: digits !== text },
    lookup,
    context: {
      durations: [...new Set(findDurations(text).map(d => d.value))], vitals, pastHistory: parsed.pastHistory || [],
      emergency: !!parsed.isEmergencyRedFlag, emergencyReasons: parsed.redFlagTriggers || []
    },
    record,
    summary: shown.map(sec => ({ section: sec.title, english: sec.text, hindi: sec.textHi, ...(sec.sources ? { sources: sec.sources } : {}) })),
    method: s.method,
    milliseconds: Math.round((performance.now() - t0) * 100) / 100
  };
}

/** The trace as plain text for a terminal. */
export function formatTrace(t: SummaryTrace): string {
  const out: string[] = [];
  const line = (s = '') => out.push(s);
  line(`INPUT      ${t.input}`);
  line();
  line('1. NUMBERS — number words become digits (a fixed table of Hindi and English number words)');
  line(`           ${t.numbers.changed ? t.numbers.text : '(no number words)'}`);
  line();
  line('2. LOOK UP — each word is reduced to a sound key and looked up in the clinical dictionary');
  if (!t.lookup.length) line('           (no clinical word found)');
  for (const m of t.lookup) line(`           "${m.words}"  →  key "${m.soundKey}"  →  ${m.means.join(' + ')}${m.denied ? `   [DENIED${m.denialWord ? ` by "${m.denialWord}"` : ''}]` : ''}`);
  line();
  line('3. CONTEXT — written rules read the words around each match');
  line(`           duration: ${t.context.durations.join(', ') || '—'}   vitals: ${Object.entries(t.context.vitals).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}   past history: ${t.context.pastHistory.join(', ') || '—'}`);
  line(`           emergency rules: ${t.context.emergency ? `FIRED — ${t.context.emergencyReasons.join('; ')}` : 'none fired'}`);
  line();
  line('4. RECORD  — the findings in named slots');
  if (!t.record.length) line('           (nothing recorded)');
  for (const r of t.record) {
    const slots = [r.site && `site=${r.site}`, r.since && `since=${r.since}`, r.spreadsTo && `spreads to=${r.spreadsTo}`, r.worseWith && `worse with=${r.worseWith}`, r.betterWith && `better with=${r.betterWith}`, r.severity && `severity=${r.severity}/10`].filter(Boolean).join(', ');
    line(`           ${r.denied ? 'DENIED  ' : 'PRESENT '} ${r.complaint}${slots ? `   (${slots})` : ''}`);
  }
  line();
  line(`5. SUMMARY — the slots dropped into fixed sentence frames   [method: ${t.method}]`);
  for (const s of t.summary) {
    line(`           ${s.section}: ${s.english}`);
    line(`           ${' '.repeat(s.section.length)}  ${s.hindi}`);
    for (const src of s.sources || []) if (src.quote) line(`             ↳ ${src.item}  ←  the patient's words: "${src.quote}"`);
  }
  line();
  line(`Took ${t.milliseconds} ms on this machine. No model was called: steps 1–5 are table lookups and written rules.`);
  return out.join('\n');
}
