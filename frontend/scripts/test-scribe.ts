/**
 * Scribe honesty checks (run: npm run test:scribe).
 *  - Room lines never claim a speaker: chips say "Mentioned" / "Asked about", never "patient".
 *  - A finding inside a question is not a finding ("kya seene me dard hai" is the doctor asking).
 *  - A reply after an unpunctuated question is read as a statement again.
 *  - Words the server's re-decodes disagree on are marked uncertain; spelling variants are not.
 */
import { scribeChips, clausesOf } from '../src/utils/scribeEntities';
import { markUncertainWords, isUnclearClip } from '../src/utils/asrUncertainty';

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '  [OK]  ' : '  [FAIL]'} ${label}${ok || !detail ? '' : `  → ${detail}`}`);
};
const room = (t: string) => scribeChips(t, { conversational: true });
const labels = (t: string) => room(t).map(c => `${c.kind}:${c.label}`).join(' | ');

console.log('Room lines: questions are not findings');
{
  const t = 'kya aapko seene me dard hai haan teen din se';
  const c = room(t);
  check(c.some(x => x.kind === 'asked' && /chest pain/i.test(x.label)) && !c.some(x => (x.kind === 'emergency' || x.kind === 'symptom') && /chest/i.test(x.label)), 'romanised Hindi question: chest pain is "asked", not a finding', labels(t));
  check(c.some(x => x.kind === 'duration'), 'the reply’s duration is still read', labels(t));
}
{
  const t = 'क्या आपको बुखार है हाँ तीन दिन से है और खांसी भी';
  const c = room(t);
  check(c.some(x => x.kind === 'asked' && /fever/i.test(x.label)), 'Devanagari question: fever is "asked"', labels(t));
  check(c.some(x => x.kind === 'symptom' && /Mentioned: Cough/i.test(x.label)), 'after the reply "हाँ", cough is a mention', labels(t));
}
{
  const t = 'Do you have chest pain? No. I have had fever for three days.';
  const c = room(t);
  check(c.some(x => x.kind === 'asked' && /chest/i.test(x.label)) && c.some(x => /Mentioned: Fever/.test(x.label)), 'English: punctuated question vs statement', labels(t));
}
{
  const t = 'BP 150 by 90 hai, paracetamol le rahe hain';
  check(room(t).some(x => x.kind === 'vital' && /said, not measured/.test(x.label)), 'a spoken BP is "said, not measured"', labels(t));
}
{
  const all = ['मुझे दो दिन से बुखार है, सीने में दर्द नहीं है', 'kya ulti hui', 'pet me dard hai teen din se', 'Any breathlessness? Yes, when climbing stairs.']
    .flatMap(t => room(t));
  check(all.length > 0 && all.every(x => !/patient/i.test(x.label)), 'no room chip names a speaker', all.map(x => x.label).join(' | '));
}
{
  const d = scribeChips('Patient has fever for 3 days, no chest pain');
  check(d.some(x => x.kind === 'symptom' && x.label === 'Fever') && d.some(x => x.kind === 'denied'), 'dictation (the clinician’s own words) keeps plain findings and denials', d.map(x => x.label).join(' | '));
}
{
  const q = clausesOf('क्या आपको बुखार है हाँ तीन दिन से');
  check(q.length === 2 && q[0].question && !q[1].question, 'clauses: question then reply', JSON.stringify(q));
}

console.log('Uncertain words from re-decodes');
{
  const w = markUncertainWords('मरीज़ को तीन दिन से बुखार है', ['मरीज को तीन दिन से बुखार है', 'मरीज़ को दिन से बुखार है']);
  check(w.find(x => x.text === 'तीन')?.uncertain === true, 'a word one re-decode dropped is uncertain');
  check(w.find(x => x.text === 'मरीज़')?.uncertain === false, 'nukta spelling variants are not uncertain');
  check(markUncertainWords('fever for three days', []).every(x => !x.uncertain), 'no re-decodes → nothing marked (not checked, not "certain")');
  check(markUncertainWords('बुखार है', ['बुखार है', 'बुखार है']).every(x => !x.uncertain), 'agreeing re-decodes → nothing marked');
}

console.log('Noise is held back, speech is not (outputs measured on the hospital speech server, 2026-10-10)');
{
  const clip = (t: string, alts: string[]) => isUnclearClip(t, markUncertainWords(t, alts), alts);
  check(clip('हम पी पी पी', ['ह', 'ह ह ह']), 'a 220 Hz tone transcribed as "हम पी पी पी" is unclear');
  check(clip('म', ['म', '']), 'mains hum transcribed as "म" is unclear');
  check(!clip('क्या आपको बुखार है हां तीन दिन से बुखार है और खलासी भी है', ['क्या आपको बुखार है हां तीन दिन से बुखार है और ख्लासी भी है', 'क्या आपको बुखार है हा तीन दिन से बुखार है और खांसी भी है']), 'real Hindi speech with two doubtful words is shown');
  check(!clip('Patient has fever for 3 days with dry cough, no chest pain.', []), 'English dictation (no re-decodes) is shown');
}

console.log(`\nScribe checks: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
