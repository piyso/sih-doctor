/**
 * Reading clinical facts out of free speech: negation, numbers, vitals, duration and severity.
 * Hindi (Devanagari, as the on-prem recogniser writes it), romanised Hinglish and English, with negation
 * words for the other kiosk languages. Deterministic, offline, no model.
 *
 * Negation is decided per mention, inside its clause, the way a clinician reads it:
 *   "बुखार नहीं है" / "no fever" / "denies fever"         → negated
 *   "बुखार है और खांसी नहीं है"                           → fever present, cough negated
 *   "खांसी रुक नहीं रही", "dard kam nahi hua", "won't stop" → present (the problem persists)
 *   "सांस नहीं ले पा रहा", "I can not breathe"             → present (an inability is a symptom)
 *   "सिर में दर्द है ना" (tag question), "pata nahi"       → present
 *   "aisa nahi hai ki dard na ho" (double negation)        → present
 * Words are matched whole ("सीने" never contains "न", "sinus" never contains "no").
 *
 * Numbers: the Hindi recogniser writes "एक सौ पचास बटा पचानवे", so number words are turned into digits
 * ("150 बटा 95") before vitals, durations and severities are read; every reading is range-checked.
 *
 * Canonical copy: frontend/src/utils/clinicalText.ts. The backend keeps a generated copy
 * (backend/src/services/clinicalText.ts) — edit this file, then run `node scripts/sync-clinical-lexicon.mjs`.
 */

// ---------------------------------------------------------------- Normalisation and tokens
/** Lower-case, NFC, nukta dropped, chandrabindu → anusvara, doubled vowel signs collapsed ("बताा" → "बता"). */
export function normWord(w: string): string {
  return w.toLowerCase().normalize('NFC')
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[‌‍]/g, '')
    .replace(/([ा-ौ])\1+/g, '$1')
    .replace(/[’‘`]/g, "'");
}

export interface Tok { text: string; norm: string; start: number; end: number; punct: boolean }

const TOKEN_RE = /[\p{L}\p{M}\p{N}_']+|[.?!;:,\n।॥|]/gu;

let lastText: string | null = null;
let lastToks: Tok[] = [];
/** Words and clause punctuation with their character offsets (memoised for the last text). */
export function tokens(text: string): Tok[] {
  if (text === lastText) return lastToks;
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0];
    const punct = !/[\p{L}\p{M}\p{N}]/u.test(t);
    out.push({ text: t, norm: punct ? t : normWord(t.replace(/^'+|'+$/g, '')), start: m.index!, end: m.index! + t.length, punct });
  }
  lastText = text;
  lastToks = out;
  return out;
}

const set = (...words: string[]) => new Set(words.map(normWord));

/** Whole-word, case-insensitive search for a phrase; returns [start, end) of every match. */
export function findPhrase(text: string, phrase: string, opts: { suffix?: number } = {}): Array<[number, number]> {
  const esc = normWord(phrase).trim().split(/\s+/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-]*');
  if (!esc) return [];
  const suffix = opts.suffix ? `[\\p{L}\\p{M}]{0,${opts.suffix}}` : '';
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${esc}${suffix}(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
  const hay = normForSearch(text);
  return [...hay.text.matchAll(re)].map(m => [hay.map[m.index!], hay.map[m.index! + m[0].length]] as [number, number]);
}

/** normWord over a whole text, with a map from normalised offsets back to original offsets. */
export function normForSearch(text: string): { text: string; map: number[] } {
  let out = '';
  const map: number[] = [];
  const src = text.normalize('NFC');
  // NFC can shorten the string; offsets are only exact when it does not (always true for recogniser output).
  for (let i = 0; i < src.length; i++) {
    const n = normWord(src[i]);
    // collapse a vowel sign repeated right after itself ("ाा")
    if (/[ा-ौ]/.test(src[i]) && src[i - 1] === src[i]) continue;
    for (const ch of n) { out += ch; map.push(i); }
  }
  map.push(src.length);
  return { text: out, map };
}

// ---------------------------------------------------------------- Negation
// Denial cues that come BEFORE what they deny ("no fever", "denies cough", "न बुखार न खांसी", "बिना दर्द के").
const PRE_STRONG = set('no', 'not', 'never', 'without', 'denies', 'deny', 'denied', 'denying', 'nil', 'none', 'neither', 'nor',
  "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "haven't", 'havent', "hasn't", 'hasnt', "hadn't", "isn't", 'isnt',
  "aren't", "wasn't", "weren't", 'absence', 'free', 'बिना', 'bina', 'बगैर', 'bagair', 'bagair', 'bager');
const PRE_WEAK = set('na', 'न', 'ना');
// Denial cues that come AFTER (Hindi and the other Indian languages are verb-final: "बुखार नहीं है").
const POST_STRONG = set('nahi', 'nahin', 'nahee', 'naheen', 'nhi', 'nahi̇', 'naahi', 'naahin', 'nai', 'nahiṃ', 'नहीं', 'नही', 'नहिं', 'नाहीं',
  'नाही', 'नाहीत', 'naikhe', 'naikhi', 'nathi', 'નથી', 'ਨਹੀਂ', 'ਨਹੀ', 'নেই', 'নাই', 'nei', 'illa', 'illai', 'இல்லை', 'இல்ல', 'ledu', 'లేదు',
  'ಇಲ್ಲ', 'ഇല്ല', 'ନାହିଁ', 'ନାହି', 'absent', 'nil', 'negative', 'gone', 'resolved');
const POST_WEAK = set('na', 'ना', 'न', 'ni', 'না');
// Verbs and copulas that close a negation's reach backwards: in "बुखार है और खांसी नहीं है" the first है
// keeps the fever out of the scope of नहीं.
const AFFIRM = set('hai', 'he', 'h', 'hain', 'hai̇n', 'hun', 'hu', 'hoon', 'ho', 'hota', 'hoti', 'hote', 'hua', 'hui', 'hue', 'tha', 'thi',
  'raha', 'rahi', 'rahe', 'rha', 'rhi', 'rhe', 'ba', 'ahe', 'aahe', 'ache', 'lag', 'laga', 'lagi', 'lage', 'lagta', 'lagti', 'aa', 'aaya', 'aayi', 'aata', 'aati',
  'है', 'हैं', 'हूं', 'हूँ', 'हो', 'होता', 'होती', 'होते', 'हुआ', 'हुई', 'हुए', 'था', 'थी', 'थे', 'रहा', 'रही', 'रहे', 'लगा', 'लगी', 'लगे', 'लगता', 'लगती',
  'आ', 'आया', 'आई', 'आता', 'आती', 'आते', 'आहे', 'आहेत', 'আছে', 'হচ্ছে', 'இருக்கு', 'இருக்கிறது', 'உள்ளது', 'ఉంది', 'છે', 'ಇದೆ', 'ഉണ്ട്', 'ਹੈ', 'ଅଛି', 'ହେଉଛି',
  'have', 'has', 'had', 'having', 'is', 'am', 'are', 'was', 'were', 'feel', 'feels', 'feeling', 'got', 'getting', 'complains', 'complaining', 'reports');
// "रुक नहीं रही", "कम नहीं हुआ", "उतर नहीं रहा", "नहीं जा रहा", "ले नहीं पा रहा", "no relief": the complaint persists.
const PERSIST = set('ruk', 'ruka', 'ruki', 'rukta', 'rukti', 'rukte', 'rukk', 'rok', 'utar', 'utarta', 'utarti', 'utra', 'kam', 'theek', 'thik', 'band', 'bandh',
  'ja', 'jaa', 'jata', 'jati', 'jaata', 'jaati', 'ghat', 'ghatta', 'aaram', 'araam', 'aram', 'farak', 'fark', 'farq', 'asar', 'pa', 'paa', 'paata', 'paati', 'paate',
  'pata', 'sak', 'sakta', 'sakti', 'sakte', 'chal', 'bol', 'uth', 'khul', 'hil', 'sun', 'nigal', 'kha', 'pi',
  'रुक', 'रुका', 'रुकी', 'रुकता', 'रुकती', 'रुकते', 'रोक', 'उतर', 'उतरता', 'उतरती', 'उतरा', 'कम', 'ठीक', 'बंद', 'जा', 'जाता', 'जाती', 'जाते', 'घट', 'घटता',
  'आराम', 'फर्क', 'असर', 'पा', 'पाता', 'पाती', 'पाते', 'पता', 'सक', 'सकता', 'सकती', 'सकते', 'चल', 'बोल', 'उठ', 'खुल', 'हिल', 'सो', 'सुन', 'सुनाई',
  'दिखाई', 'निगल', 'खा', 'पी', 'ले',
  'stop', 'stops', 'stopping', 'stopped', 'improve', 'improving', 'improved', 'better', 'relief', 'relieved', 'reduce', 'reducing', 'reduced', 'subside', 'subsiding',
  'settle', 'settling', 'away', 'down', 'change', 'help', 'helping', 'helped', 'responding', 'able', 'sure', 'know', 'certain', 'difference');
const INABILITY = set('can', 'could', 'cannot', 'unable');
// Clause breakers: a negation never reaches across these.
const BREAK = set('but', 'however', 'though', 'although', 'except', 'only', 'just', 'whereas', 'par', 'pr', 'lekin', 'magar', 'kintu', 'parantu', 'balki',
  'bas', 'sirf', 'keval', 'kewal', 'पर', 'लेकिन', 'मगर', 'किंतु', 'परंतु', 'बल्कि', 'बस', 'सिर्फ', 'सिर्फ़', 'केवल', 'फिर', 'phir');
const AND = set('and', 'aur', 'or', 'और', 'evam', 'तथा');
const PRONOUN = set('i', 'my', 'me', 'mujhe', 'mujhko', 'mera', 'meri', 'mere', 'main', 'mai', 'he', 'she', 'his', 'her', 'it', 'its', 'there', 'uska', 'uski', 'uske',
  'use', 'usko', 'मैं', 'मुझे', 'मुझको', 'मेरा', 'मेरी', 'मेरे', 'उसका', 'उसकी', 'उसके', 'उसे', 'उसको', 'यह', 'वह', 'ye', 'wo', 'vo');
const DOUBLE_NEG_HEAD = set('aisa', 'aesa', 'aise', 'ऐसा', 'ऐसी', 'ऐसे');
const KI = set('ki', 'ke', 'kee', 'कि', 'की', 'के', 'that');

function clauseBounds(toks: Tok[], i: number): [number, number] {
  let a = i;
  while (a > 0 && !toks[a - 1].punct && !BREAK.has(toks[a - 1].norm)) a--;
  let b = i;
  while (b < toks.length - 1 && !toks[b + 1].punct && !BREAK.has(toks[b + 1].norm)) b++;
  return [a, b];
}

/** Token index range [first, last] covered by the character span [start, end). */
function tokenRange(toks: Tok[], start: number, end: number): [number, number] | null {
  let first = -1, last = -1;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].punct) continue;
    if (toks[i].end > start && toks[i].start < end) { if (first < 0) first = i; last = i; }
  }
  return first < 0 ? null : [first, last];
}

export interface NegationResult { negated: boolean; cue?: string }

/**
 * Is the mention at [start, end) negated? Words inside the mention itself never count as a cue (so a
 * phrase such as "नींद नहीं आती" can be matched as a whole and stays a complaint).
 */
export function negationAt(text: string, start: number, end: number): NegationResult {
  const toks = tokens(text);
  const r = tokenRange(toks, start, end);
  if (!r) return { negated: false };
  const [first, last] = r;
  const [ca, cb] = clauseBounds(toks, first);
  let negated = false;
  let cue: string | undefined;

  // 1. A cue after the mention, reaching back to it (Hindi word order).
  for (let j = last + 1; j <= cb && j <= last + 6; j++) {
    const w = toks[j].norm;
    const strong = POST_STRONG.has(w);
    const weak = !strong && POST_WEAK.has(w);
    if (strong || weak) {
      const prev = toks[j - 1].norm;
      if (weak && j - 1 > last && AFFIRM.has(prev)) break;          // "दर्द है ना" — a tag question
      if (weak && toks[j + 1] && toks[j + 1].norm === '?') break;
      // a copula between the mention and the cue ends the reach, unless it sits right before the cue ("hai nahi")
      let blocked = false;
      for (let k = last + 1; k < j - 1; k++) if (AFFIRM.has(toks[k].norm) || POST_STRONG.has(toks[k].norm)) blocked = true;
      if (blocked) break;
      // "रुक नहीं रही", "nahi jaata", "पता नहीं": the complaint persists or is merely uncertain
      let persists = false;
      for (let k = last + 1; k <= Math.min(cb, j + 2); k++) if (k !== j && PERSIST.has(toks[k].norm)) persists = true;
      if (w === 'ya' || toks[j - 1].norm === 'ya' || toks[j - 1].norm === 'या') persists = true; // "hai ya nahi"
      if (!persists) { negated = true; cue = toks[j].text; }
      break;
    }
    if (AFFIRM.has(w) && !(toks[j + 1] && (POST_STRONG.has(toks[j + 1].norm) || POST_WEAK.has(toks[j + 1].norm)))) {
      // "बुखार है ..." — an affirming verb after the mention closes it, unless the very next word negates it
      break;
    }
  }

  // 2. A cue before the mention ("no fever", "denies chest pain", "न बुखार न खांसी", "I don't have fever").
  if (!negated) {
    for (let j = first - 1; j >= ca && j >= first - 7; j--) {
      const w = toks[j].norm;
      const strong = PRE_STRONG.has(w);
      const weak = !strong && PRE_WEAK.has(w);
      if (strong || weak) {
        if (weak && first - j > 3) break;
        if (w === 'not' && j > 0 && INABILITY.has(toks[j - 1].norm)) break;   // "can not breathe"
        let persists = false;
        for (let k = j + 1; k < first; k++) if (PERSIST.has(toks[k].norm)) persists = true;  // "no relief from pain"
        if (!persists) { negated = true; cue = toks[j].text; }
        break;
      }
      if (AND.has(w) && toks[j + 1] && (PRONOUN.has(toks[j + 1].norm) || AFFIRM.has(toks[j + 1].norm))) break; // "no fever and my stomach hurts"
      if (POST_STRONG.has(w)) break;
      if (AFFIRM.has(w) && !['have', 'has', 'had', 'having', 'is', 'are', 'was', 'were', 'feel', 'feeling'].includes(w)) break;
    }
  }
  // English "pain is not there", "fever isn't present"
  if (!negated) {
    const after = toks.slice(last + 1, Math.min(cb, last + 4) + 1).map(t => t.norm).join(' ');
    if (/^(?:is |are |was )?(?:not|isn't|isnt) (?:there|present)\b/.test(after)) { negated = true; cue = 'not there'; }
  }

  // 3. Double negation: "aisa nahi hai ki dard na ho" → the complaint is present.
  for (let j = ca; j < first - 1; j++) {
    if (DOUBLE_NEG_HEAD.has(toks[j].norm) && POST_STRONG.has(toks[j + 1].norm)) {
      const k = toks[j + 2] && AFFIRM.has(toks[j + 2].norm) ? j + 3 : j + 2;
      if (toks[k] && KI.has(toks[k].norm)) { negated = !negated; cue = negated ? 'aisa nahi ki' : undefined; break; }
    }
  }
  return { negated, cue };
}

/** Character span of the clause around a position (for pairing a body site with a finding). */
export function clauseAt(text: string, pos: number): [number, number] {
  const toks = tokens(text);
  let i = toks.findIndex(t => t.end > pos);
  if (i < 0) i = toks.length - 1;
  if (i < 0) return [0, text.length];
  if (toks[i].punct && i > 0) i--;
  const [a, b] = clauseBounds(toks, i);
  return [toks[a].start, toks[b].end];
}

/** Character span of the sentence around a position (clauses joined by commas and conjunctions). */
export function sentenceAt(text: string, pos: number): [number, number] {
  let a = pos;
  while (a > 0 && !/[.?!।॥\n]/.test(text[a - 1])) a--;
  let b = pos;
  while (b < text.length && !/[.?!।॥\n]/.test(text[b])) b++;
  return [a, b];
}

// ---------------------------------------------------------------- Number words → digits
const UNITS: Record<string, number> = {};
const addNums = (words: string, base = 0) => words.split(' ').forEach((w, i) => w.split('/').forEach(v => { UNITS[normWord(v)] = base + i; }));
addNums('शून्य एक दो तीन चार पांच/पाँच/पाच छह/छः/छै/छे सात आठ नौ/नव दस ग्यारह बारह तेरह चौदह पंद्रह/पन्द्रह सोलह सत्रह अठारह/अट्ठारह उन्नीस/उनीस बीस');
addNums('इक्कीस बाईस तेईस चौबीस पच्चीस/पचीस छब्बीस सत्ताईस अट्ठाईस/अठाईस उनतीस/उन्तीस तीस इकतीस/इकत्तीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस/उनचालीस चालीस', 21);
addNums('इकतालीस बयालीस तैंतालीस चौवालीस/चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन/इक्कावन बावन तिरपन/तिरेपन चौवन/चौव्वन पचपन छप्पन सत्तावन अट्ठावन/अठावन उनसठ साठ', 41);
addNums('इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ/सरसठ अड़सठ/अरसठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी/उनासी अस्सी', 61);
addNums('इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी/अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे/पचानवे छियानवे सत्तानवे अट्ठानवे/अठानवे निन्यानवे', 81);
addNums('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen');
Object.assign(UNITS, { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, oh: 0 });
// Romanised Hindi: only words that are not also everyday Hinglish ("saath" = with, "do" = give are left out on purpose
// except where a time unit follows, see DURATION_RE).
Object.assign(UNITS, { ek: 1, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, saat: 7, aath: 8, nau: 9, das: 10,
  gyarah: 11, barah: 12, pandrah: 15, bees: 20, pachees: 25, tees: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, sattar: 70,
  assi: 80, nabbe: 90 });
const HUNDRED = set('सौ', 'sau', 'hundred');
const THOUSAND = set('हजार', 'हज़ार', 'hazaar', 'hajar', 'hazar', 'thousand');
const FRACTION: Record<string, number> = { [normWord('डेढ़')]: 1.5, [normWord('डेढ')]: 1.5, dedh: 1.5, dhai: 2.5, [normWord('ढाई')]: 2.5, [normWord('आधा')]: 0.5, [normWord('आधे')]: 0.5, aadha: 0.5, aadhe: 0.5, half: 0.5 };
const PLUS_HALF = set('साढ़े', 'साढे', 'sadhe', 'saadhe');
const PLUS_QUARTER = set('सवा', 'sawa', 'sava');
const MINUS_QUARTER = set('पौने', 'paune');

/**
 * Turns spelled-out numbers into digits: "एक सौ पचास बटा पचानवे" → "150 बटा 95", "डेढ़ सौ" → "150",
 * "साढ़े तीन" → "3.5", "two hundred and forty" → "240", "one fifty" → "150". Indic digits become ASCII.
 */
export function numeralize(text: string): string {
  return numeralizeWithMap(text).text;
}

/** numeralize() plus, for every character of the result, its offset in the original text. */
export function numeralizeWithMap(text: string): { text: string; map: number[] } {
  const src = toAsciiDigits(text);
  const toks = tokens(src);
  let out = '';
  const map: number[] = [];
  const copy = (a: number, b: number) => { for (let k = a; k < b; k++) { out += src[k]; map.push(k); } };
  let pos = 0;
  for (let i = 0; i < toks.length;) {
    const r = toks[i].punct ? null : readNumber(toks, i);
    if (!r) { i++; continue; }
    copy(pos, toks[i].start);
    const digits = String(r.value);
    for (let k = 0; k < digits.length; k++) { out += digits[k]; map.push(toks[i].start); }
    pos = toks[r.next - 1].end;
    i = r.next;
  }
  copy(pos, src.length);
  map.push(src.length);
  return { text: out, map };
}

function readNumber(toks: Tok[], i: number): { value: number; next: number } | null {
  const w = (k: number) => (toks[k] ? toks[k].norm : '');
  const unit = (k: number): number | undefined => (/^\d+(?:\.\d+)?$/.test(w(k)) ? parseFloat(w(k)) : UNITS[w(k)]);
  let j = i;
  let total = 0;
  let cur: number | undefined;
  let frac = 0;
  if (PLUS_HALF.has(w(j))) { frac = 0.5; j++; } else if (PLUS_QUARTER.has(w(j))) { frac = 0.25; j++; } else if (MINUS_QUARTER.has(w(j))) { frac = -0.25; j++; }
  if (FRACTION[w(j)] !== undefined) { cur = FRACTION[w(j)]; j++; }
  else if (unit(j) !== undefined) { cur = unit(j)! + frac; j++; }
  else return null;
  if (frac && cur === undefined) return null;
  for (;;) {
    if (HUNDRED.has(w(j)) && cur !== undefined && cur < 100) { cur = cur * 100; j++; continue; }
    if (THOUSAND.has(w(j)) && cur !== undefined) { total += cur * 1000; cur = undefined; j++; continue; }
    if (w(j) === 'and' && cur !== undefined && cur >= 100 && unit(j + 1) !== undefined) { j++; continue; }
    const u = unit(j);
    if (u !== undefined && cur !== undefined && cur >= 100 && cur % 100 === 0 && u < 100 && !/^\d/.test(w(j))) { cur += u; j++; continue; }
    // English tens + units ("forty five"), and "one fifty" / "one oh two" spoken readings
    if (u !== undefined && cur !== undefined && cur >= 20 && cur < 100 && cur % 10 === 0 && u > 0 && u < 10 && !/^\d/.test(w(j)) && /^[a-z]+$/.test(w(j))) { cur += u; j++; continue; }
    if (u !== undefined && cur !== undefined && cur > 0 && cur < 10 && /^[a-z]+$/.test(w(j - 1)) && /^[a-z]+$/.test(w(j)) && (u >= 10 || w(j) === 'oh')) {
      if (w(j) === 'oh') { const v = unit(j + 1); if (v !== undefined && v < 10) { cur = cur * 100 + v; j += 2; continue; } break; }
      cur = cur * 100 + u; j++; continue;
    }
    break;
  }
  const value = total + (cur ?? 0);
  // a lone romanised "so"/"sau"/English "a" is not a number
  if (j === i) return null;
  return { value: Math.round(value * 100) / 100, next: j };
}

const INDIC_ZEROS = [0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66];
export const toAsciiDigits = (s: string) =>
  s.replace(/[०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/g, d => {
    const c = d.charCodeAt(0);
    return String(c - INDIC_ZEROS.find(z => c >= z && c <= z + 9)!);
  });

// ---------------------------------------------------------------- Duration
const B = '(?<![\\p{L}\\p{M}\\p{N}])';
const E = '(?![\\p{L}\\p{M}\\p{N}])';
const UNIT_DAY = 'days?|din|dino|dinon|दिन|दिनों|रोज़?|दिवस|দিন|நாள்?|రోజు?|દિવસ|ದಿನ|ദിവസം?|ਦਿਨ|ଦିନ';
const UNIT_WEEK = 'weeks?|hafte?|hafton|haftey|हफ्ते|हफ्ता|हफ्तों|सप्ताह|आठवडे?|সপ্তাহ|வாரம்?|వారం|અઠવાડિય[ાું]|ವಾರ|ആഴ്ച|ਹਫ਼?ਤੇ|ସପ୍ତାହ';
const UNIT_MONTH = 'months?|mahine?|mahina|mahino|mahinon|महीने|महीना|महीनों|महिने|महिना|মাস|மாதம்?|నెల(?:లు)?|મહિન[ાો]|ತಿಂಗಳ|മാസം?|ਮਹੀਨ[ੇਾ]|ମାସ';
const UNIT_YEAR = 'years?|yrs?|saal|sal|baras|साल|वर्ष|बरस|সাল|বছর|வருடம்?|సంవత్సర(?:ం|ాలు)?|વર્ષ|ವರ್ಷ|വർഷം?|ਸਾਲ|ବର୍ଷ';
const UNIT_HOUR = 'hours?|hrs?|ghante?|ghanta|ghanton|घंटे|घंटा|घंटों|घण्टे|ঘণ্টা|மணி\\s*நேரம்|గంట(?:లు)?|કલાક|ಗಂಟೆ|മണിക്കൂർ|ਘੰਟ[ੇਾ]|ଘଣ୍ଟା';
const UNIT_MIN = 'minutes?|mins?|मिनट';
const UNIT_ANY = `${UNIT_DAY}|${UNIT_WEEK}|${UNIT_MONTH}|${UNIT_YEAR}|${UNIT_HOUR}|${UNIT_MIN}`;
const DURATION_RE = new RegExp(`${B}(\\d+(?:\\.\\d+)?|an?|one|ek|do|एक|दो|few|couple(?:\\s+of)?|kuch|कुछ|कई|kai|several)\\s*(?:se|से|say|tak|तक|of|from)?\\s*(${UNIT_ANY})${E}`, 'giu');
const SINCE_RE: Array<[RegExp, string]> = [
  [new RegExp(`${B}(?:since\\s+yesterday|yesterday|kal\\s+se|कल\\s+से|कल\\s+रात\\s+से|कालपासून|গতকাল|நேற்று|నిన్న|ગઈકાલ|ನಿನ್ನೆ|ഇന്നലെ|ਕੱਲ੍ਹ|ଗତକାଲି)${E}`, 'iu'), '1 day'],
  [new RegExp(`${B}(?:parso\\s+se|परसों\\s+से|day\\s+before\\s+yesterday)${E}`, 'iu'), '2 days'],
  [new RegExp(`${B}(?:since\\s+last\\s+night|last\\s+night|raat\\s+se|रात\\s+से)${E}`, 'iu'), 'since last night'],
  [new RegExp(`${B}(?:since\\s+(?:this\\s+)?morning|this\\s+morning|subah\\s+se|सुबह\\s+से|aaj\\s+subah|आज\\s+सुबह)${E}`, 'iu'), 'since this morning'],
  [new RegExp(`${B}(?:since\\s+today|today|aaj\\s+se|आज\\s+से|आजपासून|আজ\\s+থেকে|இன்று|ఈ\\s*రోజు|આજથી|ಇಂದು|ഇന്ന്|ਅੱਜ|ଆଜି)${E}`, 'iu'), 'since today'],
  [new RegExp(`${B}(?:last\\s+week|pichhle\\s+hafte|pichle\\s+hafte|पिछले\\s+हफ्ते(?!\\s*\\d))${E}`, 'iu'), '1 week'],
  [new RegExp(`${B}(?:last\\s+month|pichhle\\s+mahine|pichle\\s+mahine|पिछले\\s+महीने(?!\\s*\\d))${E}`, 'iu'), '1 month'],
  [new RegExp(`${B}(?:for\\s+a\\s+long\\s+time|long\\s+time|since\\s+long|bahut\\s+(?:dino|samay)\\s+se|बहुत\\s+(?:दिनों|समय)\\s+से|kaafi\\s+(?:dino|samay)\\s+se|काफी\\s+(?:दिनों|समय)\\s+से|सालों\\s+से|saalon\\s+se|years)${E}`, 'iu'), 'long-standing'],
  [new RegExp(`${B}(?:since\\s+childhood|bachpan\\s+se|बचपन\\s+से)${E}`, 'iu'), 'since childhood']
];

function unitName(u: string): 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute' {
  const n = normWord(u);
  if (new RegExp(`^(?:${UNIT_DAY})$`, 'iu').test(n)) return 'day';
  if (new RegExp(`^(?:${UNIT_WEEK})$`, 'iu').test(n)) return 'week';
  if (new RegExp(`^(?:${UNIT_MONTH})$`, 'iu').test(n)) return 'month';
  if (new RegExp(`^(?:${UNIT_YEAR})$`, 'iu').test(n)) return 'year';
  if (new RegExp(`^(?:${UNIT_HOUR})$`, 'iu').test(n)) return 'hour';
  return 'minute';
}

export interface Found<T> { value: T; start: number; end: number }

/** Every duration in the text, e.g. "3 days", "1.5 months", "1 day" (yesterday), "since this morning". */
export function findDurations(text: string): Array<Found<string>> {
  const { text: t, map } = numeralizeWithMap(text);
  const out: Array<Found<string>> = [];
  const at = (a: number, b: number, value: string) => out.push({ value, start: map[a], end: map[b] });
  for (const m of t.matchAll(DURATION_RE)) {
    // "twice a day", "2 baar din mein", "once a week" are frequencies, not durations
    if (/(?:times|once|twice|thrice|per|every|baar|बार|प्रति|har|हर)\s*$/iu.test(t.slice(Math.max(0, m.index! - 12), m.index!))) continue;
    const q = normWord(m[1]).replace(/\s+/g, ' ');
    const n = /^\d/.test(q) ? parseFloat(q) : ['a', 'an', 'one', 'ek', 'एक'].includes(q) ? 1 : ['do', 'दो', 'couple', 'couple of'].includes(q) ? 2 : 0;
    const u = unitName(m[2]);
    if (n > 120) continue;
    at(m.index!, m.index! + m[0].length, n ? `${n} ${u}${n === 1 ? '' : 's'}` : `a few ${u}s`);
  }
  for (const [re, value] of SINCE_RE) {
    const m = re.exec(t);
    if (m && !out.some(o => map[m.index!] < o.end && o.start < map[m.index! + m[0].length])) at(m.index!, m.index! + m[0].length, value);
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- Severity
const SEVERE_9 = new RegExp(`${B}(?:unbearable|worst|excruciating|bardasht\\s+nahi|बर्दाश्त\\s+नहीं|असहनीय|asahniya|असह्य|सहन\\s+नहीं|bhayankar|भयंकर|भयानक|terrible)${E}`, 'iu');
const SEVERE_8 = new RegExp(`${B}(?:severe|severely|very\\s+bad|very\\s+much|intense|extreme|a\\s+lot|bahut|bahot|bohot|tez|tej|zyada|jyada|ज़्यादा|ज्यादा|बहुत|तेज|तेज़|तीव्र|खूप|খুব|তীব্র|மிக|கடுமை|చాలా|తీవ్ర|ખૂબ|બહુ|ತುಂಬಾ|ತೀವ್ರ|വളരെ|കഠിന|ਬਹੁਤ|ਤੇਜ਼|ବହୁତ|ତୀବ୍ର)${E}`, 'iu');
const MILD = new RegExp(`${B}(?:mild|slight|slightly|little|a\\s+bit|thoda|thodi|thode|halka|halki|हल्का|हल्की|थोड़ा|थोड़ी|थोड़े|थोडा|थोडी|सौम्य|একটু|হালকা|கொஞ்சம்|కొంచెం|થોડ[ુંો]|ಸ್ವಲ್ಪ|അൽപ്പം|ਥੋੜ੍ਹ[ਾੀ]|ଟିକେ)${E}`, 'iu');
const MODERATE = new RegExp(`${B}(?:moderate|medium|theek\\s+thaak|मध्यम)${E}`, 'iu');

/** Severity 1–10 stated in a stretch of text ("8 out of 10", "दस में से आठ", "बहुत तेज़", "mild"); 0 if not stated. */
export function severityIn(text: string): number {
  const t = numeralize(normForSearch(text).text);
  const num = t.match(/(?<![\d.])(\d{1,2})\s*(?:out\s*of|outta|\/|by|में\s*से|me\s*se|mein\s*se)\s*10(?!\d)/iu) ||
    t.match(/(?<![\d.])10\s*(?:में\s*से|me\s*se|mein\s*se|में|me|mein|out\s*of\s*which)\s*(\d{1,2})(?!\d)/iu) ||
    t.match(/(?:pain|dard|दर्द)\s*(?:score|level|is|hai|है)?\s*(\d{1,2})\s*(?:out|\/|hai|है|$)/iu);
  if (num) {
    const v = parseInt(num[1], 10);
    if (v >= 0 && v <= 10) return v;
  }
  if (SEVERE_9.test(t)) return 9;
  if (SEVERE_8.test(t)) return 8;
  if (MODERATE.test(t)) return 5;
  if (MILD.test(t)) return 3;
  return 0;
}

// ---------------------------------------------------------------- Vitals
export interface Vitals { bp?: string; pulse?: number; spo2?: string; temp?: string; bloodSugar?: number; respiratoryRate?: number }

const L_BP = `${B}(?:b\\.?\\s?p\\.?|blood\\s*pressure|pressure|bp|बी\\.?\\s?पी|बीपी|ब्लड\\s*प्रेशर|प्रेशर|रक्तचाप|रक्त\\s*चाप)${E}`;
const L_PULSE = `${B}(?:pulse(?:\\s*rate)?|heart\\s*rate|heart\\s*beat|heartbeat|hr|nabz|nabj|nadi|naadi|पल्स|नब्ज|नाड़ी|नाडी|धड़कन|धडकन|हार्ट\\s*रेट)${E}`;
const L_SPO2 = `(?:${B}(?:sp\\s*o\\s*2|spo2|saturation|sats?|oxygen(?:\\s*(?:level|saturation))?|o2)${E}|(?:ऑक्सीजन|आक्सीजन|ओक्सीजन|ऑक्सिजन|सैचुरेशन|सेचुरेशन))`;
const L_TEMP = `${B}(?:temp(?:erature)?|fever|bukhar|bukhaar|taap|tapman|बुखार|ताप|तापमान|टेम्परेचर|टेंपरेचर|टेम्प्रेचर)${E}`;
const L_SUGAR = `${B}(?:(?:blood\\s*)?sugar(?:\\s*level)?|glucose|rbs|fbs|ppbs|grbs|शुगर|शूगर|ग्लूकोज|ब्लड\\s*शुगर)${E}`;
const L_RR = `${B}(?:respiratory\\s*rate|resp(?:iration)?\\s*rate|breathing\\s*rate|rr|सांस\\s*की\\s*(?:दर|गति))${E}`;
const ANY_LABEL = new RegExp(`${L_BP}|${L_PULSE}|${L_SPO2}|${L_TEMP}|${L_SUGAR}|${L_RR}`, 'iu');
const GAP = `([^\\d\\n.!?।,;]{0,28}?)`;
const NUM = '(\\d{1,3}(?:\\.\\d)?)';
const BP_SEP = `\\s*(?:\\/|by|over|upon|on|बटा|बट्टा|बता|बाई|बाय|ओवर|अपॉन|x)\\s*`;
const TIME_AFTER = new RegExp(`^\\s*(?:se\\s+|से\\s+)?(?:${UNIT_ANY}|baar|times|बार|tablet|tablets|goli|गोली|mg(?!\\s*\\/\\s*dl))${E}`, 'iu');
const MED_WORDS = /dawai|dawa|dava|medicine|tablet|goli|दवा|दवाई|गोली|insulin|इंसुलिन/iu;

function labelledValues(t: string, label: string): Array<{ n: string; gap: string; after: string; index: number; second?: string }> {
  const out: Array<{ n: string; gap: string; after: string; index: number }> = [];
  const re = new RegExp(`(?:${label})${GAP}${NUM}`, 'giu');
  for (const m of t.matchAll(re)) {
    // the stretch between label and number must not name another vital ("sugar normal, pulse 90")
    if (ANY_LABEL.test(m[1])) continue;
    out.push({ n: m[2], gap: m[1], after: t.slice(m.index! + m[0].length), index: m.index! });
  }
  return out;
}

/** Vital signs spoken or typed in the text. Every value is range-checked; anything implausible is dropped. */
export function parseVitals(text: string): Vitals {
  const t = numeralize(normForSearch(text).text);
  const v: Vitals = {};

  // Blood pressure: "BP 150/95", "150 by 95", "एक सौ पचास बटा पचानवे", "upar 150 neeche 95", or a bare "150/95".
  const bpOk = (s: number, d: number) => s >= 60 && s <= 300 && d >= 30 && d <= 200 && s > d + 5;
  const bpLabelled = new RegExp(`(?:${L_BP})${GAP}(\\d{2,3})${BP_SEP}(\\d{2,3})(?!\\d)`, 'giu');
  for (const m of t.matchAll(bpLabelled)) {
    if (ANY_LABEL.test(m[1])) continue;
    const s = +m[2], d = +m[3];
    if (bpOk(s, d)) { v.bp = `${s}/${d}`; break; }
  }
  if (!v.bp) {
    const ud = t.match(/(?:upar|upper|ऊपर|ऊपरी|systolic)[^\d\n]{0,18}(\d{2,3})[^\d\n]{0,24}(?:neeche|nichla|niche|lower|नीचे|निचला|diastolic)[^\d\n]{0,18}(\d{2,3})/iu);
    if (ud && bpOk(+ud[1], +ud[2])) v.bp = `${+ud[1]}/${+ud[2]}`;
  }
  if (!v.bp) {
    for (const m of t.matchAll(/(?<![\d.\/])(\d{2,3})\s*\/\s*(\d{2,3})(?![\d\/])/g)) {
      if (bpOk(+m[1], +m[2]) && +m[1] >= 70 && +m[2] >= 40) { v.bp = `${+m[1]}/${+m[2]}`; break; }
    }
  }

  for (const c of labelledValues(t, L_PULSE)) {
    const n = parseFloat(c.n);
    if (Number.isInteger(n) && n >= 25 && n <= 250 && !TIME_AFTER.test(c.after)) { v.pulse = n; break; }
  }
  for (const c of labelledValues(t, L_SPO2)) {
    const n = parseFloat(c.n);
    if (n >= 50 && n <= 100 && !TIME_AFTER.test(c.after)) { v.spo2 = `${n}%`; break; }
  }
  const tempOf = (raw: string, unitText: string): string | undefined => {
    const n = parseFloat(raw);
    const saysC = /^\s*(?:°\s*c|degrees?\s*c(?:elsius)?|celsius|centigrade|सेल्सियस)/iu.test(unitText);
    if (!saysC && n >= 93 && n <= 110) return `${raw}°F`;
    if (n >= 34 && n <= 43.5) return `${raw}°C`;
    return undefined;
  };
  for (const c of labelledValues(t, L_TEMP)) {
    if (TIME_AFTER.test(c.after)) continue;
    const tv = tempOf(c.n, c.after);
    if (tv) { v.temp = tv; break; }
  }
  if (!v.temp) {
    const m = t.match(/(?<![\d.])(\d{2,3}(?:\.\d)?)\s*(°\s*[fc]?|degrees?(?:\s*[fc])?|डिग्री|fahrenheit|फ़?ारेनहाइट|celsius|सेल्सियस)/iu);
    if (m) { const tv = tempOf(m[1], m[2]); if (tv) v.temp = tv; }
  }
  for (const c of labelledValues(t, L_SUGAR)) {
    const n = parseFloat(c.n);
    if (Number.isInteger(n) && n >= 20 && n <= 900 && !TIME_AFTER.test(c.after) && !MED_WORDS.test(c.gap)) { v.bloodSugar = n; break; }
  }
  for (const c of labelledValues(t, L_RR)) {
    const n = parseFloat(c.n);
    if (Number.isInteger(n) && n >= 5 && n <= 80 && !TIME_AFTER.test(c.after)) { v.respiratoryRate = n; break; }
  }
  return v;
}
