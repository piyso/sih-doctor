// GENERATED from frontend/src/utils/clinicalLexicon.ts by scripts/sync-clinical-lexicon.mjs — do not edit here.
/**
 * Clinical concept lexicon for Hindi, Hinglish (romanised or in Devanagari) and English complaint text.
 *
 * Words map to concepts — S_ body site, F_ finding, Q_ qualifier, R_ red-flag-only, V_ visit reason —
 * through a coarse phonetic key, so "पेशाब", "peshab" and a speech recogniser's "पेसाब" all land on the
 * same concept. The kiosk symptom catalog is tagged with this same lexicon (symptomMatcher.ts), so a new
 * catalog entry never needs its own list of phrases.
 *
 * Every phrase is checked for negation in its own clause (clinicalText.ts): "बुखार नहीं है", "no chest pain" and
 * "denies cough" drop the concept, while "दर्द कम नहीं हो रहा", "खांसी रुक नहीं रही" and "सांस नहीं ले पा रहा"
 * keep it — only an explicit denial removes anything.
 *
 * `analyseComplaint()` also runs the emergency rules. They stay recall-first: a nurse can downgrade a false
 * alarm, nobody can recover a missed one.
 *
 * Measured on a frozen test set (edge-ai/eval/cases.json): see `npm run eval:matcher` in frontend/.
 *
 * The backend keeps a generated copy (backend/src/services/clinicalLexicon.ts). Edit this file, then run
 * `node scripts/sync-clinical-lexicon.mjs` from the repository root.
 */

import { clauseAt, isHistorical, negationAt, radiationTargetsAt, sentenceAt, verbBetween } from './clinicalText';

// ---------------------------------------------------------------- Phonetic key
const DEV: Record<string, string> = {};
'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह'.split('').forEach((ch, i) => { DEV[ch] = 'kkggnccjjnttddnttddnppbbmyrlvsssh'[i]; });
Object.assign(DEV, {
  // nukta forms (NFC keeps these as consonant + U+093C); ड़/ढ़ sound like r, which is how recognisers write them
  'ड़': 'r', 'ढ़': 'r', 'क़': 'k', 'ख़': 'k', 'ग़': 'g',
  'ज़': 'j', 'फ़': 'p', 'य़': 'y',
  'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'e', 'ो': 'o', 'ौ': 'o', 'ृ': 'ri', 'ॉ': 'o', 'ॅ': 'e',
  'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'e', 'ओ': 'o', 'औ': 'o', 'ऋ': 'ri', 'ऑ': 'o',
  'ं': 'n', 'ँ': 'n', 'अ': '', 'आ': '', 'ा': '', '्': '', 'ः': '', '़': ''
});
// Spelling rules for romanised words only: aspirates and vowel length are dropped, f/z/w folded.
const LAT: Array<[string, string]> = [
  ['chh', 'c'], ['ch', 'c'], ['sh', 's'], ['kh', 'k'], ['gh', 'g'], ['jh', 'j'], ['th', 't'], ['dh', 'd'],
  ['ph', 'p'], ['bh', 'b'], ['ck', 'k'], ['f', 'p'], ['z', 'j'], ['q', 'k'], ['w', 'v'], ['x', 'ks'],
  ['ee', 'i'], ['ii', 'i'], ['oo', 'u'], ['uu', 'u'], ['ai', 'e'], ['ei', 'e'], ['ay', 'e']
];
const isDevanagari = (ch: string) => ch >= 'ऀ' && ch <= 'ॿ';

const keyCache = new Map<string, string>();
export function wordKey(word: string): string {
  let k = keyCache.get(word);
  if (k === undefined) {
    k = wordKeyUncached(word);
    if (keyCache.size > 4096) keyCache.clear();
    keyCache.set(word, k);
  }
  return k;
}
function wordKeyUncached(word: string): string {
  const w = word.toLowerCase().normalize('NFC');
  let out = '';
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (two.length === 2 && DEV[two] !== undefined) { out += DEV[two]; i += 2; continue; }
    const ch = w[i];
    out += isDevanagari(ch) ? (DEV[ch] ?? ch) : ch;
    i += 1;
  }
  if (![...w].some(isDevanagari)) {
    for (const [a, b] of LAT) out = out.split(a).join(b);
    out = out.replace(/y$/, 'i');
  }
  return out.replace(/a/g, '').replace(/(.)\1+/g, '$1');
}

/**
 * A finer key for comparing two words written in the SAME script: aspiration and long vowels are kept, so
 * "खाना" (food) and "कान" (ear), or "khana" and "kan", stay apart even though their coarse keys are equal,
 * while spelling variants such as "पेशाब"/"पेसाब" or "peshab"/"pishab" are one step apart.
 */
const FINE: Record<string, string> = {};
'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह'.split('').forEach((ch, i) => { FINE[ch] = 'kKgGncCjJntTdDntTdDnpPbBmyrlvSSsh'[i]; });
Object.assign(FINE, {
  'ड़': 'r', 'ढ़': 'R', 'क़': 'k', 'ख़': 'K', 'ग़': 'g', 'ज़': 'z', 'फ़': 'f', 'य़': 'y',
  'ा': 'A', 'ि': 'i', 'ी': 'I', 'ु': 'u', 'ू': 'U', 'े': 'e', 'ै': 'E', 'ो': 'o', 'ौ': 'O', 'ृ': 'ri', 'ॉ': 'o', 'ॅ': 'e',
  'अ': 'a', 'आ': 'A', 'इ': 'i', 'ई': 'I', 'उ': 'u', 'ऊ': 'U', 'ए': 'e', 'ऐ': 'E', 'ओ': 'o', 'औ': 'O', 'ऋ': 'ri', 'ऑ': 'o',
  'ं': 'n', 'ँ': 'n', '्': '', 'ः': 'h', '़': ''
});
const fineCache = new Map<string, string>();
function fineKey(word: string): string {
  let k = fineCache.get(word);
  if (k !== undefined) return k;
  const w = word.toLowerCase().normalize('NFC');
  let out = '';
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (two.length === 2 && FINE[two] !== undefined) { out += FINE[two]; i += 2; continue; }
    out += isDevanagari(w[i]) ? (FINE[w[i]] ?? '') : w[i];
    i += 1;
  }
  k = out.replace(/(.)\1+/g, '$1');
  if (fineCache.size > 4096) fineCache.clear();
  fineCache.set(word, k);
  return k;
}
/** Same-script words with equal coarse keys must also be this close on the fine key. */
const fineClose = (a: string, b: string) => a === b || lev(a, b) <= (Math.max(a.length, b.length) >= 6 ? 2 : 1);

/**
 * Cross-script comparison ("खाना" vs the romanised alias "kan", "जॉइंट्स" vs "joints"): the Hindi word is
 * romanised from its fine key, both sides get loose spelling rules (aa/a, ee/i, w/v …) and lose the vowel "a"
 * (Hindi does not write it), then must match exactly — or within one step for words of four or more letters.
 */
const ROMAN: Record<string, string> = { K: 'kh', G: 'gh', C: 'chh', J: 'jh', T: 'th', D: 'dh', P: 'ph', B: 'bh', S: 'sh', R: 'rh', A: 'a', I: 'i', U: 'u', E: 'ai', O: 'au' };
function romanKey(word: string, dev: boolean): string {
  let w = dev ? [...fineKey(word)].map(ch => ROMAN[ch] ?? ch).join('') : word.toLowerCase();
  w = w.replace(/f/g, 'ph').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/ck/g, 'k')
    .replace(/c(?!h)/g, 'k').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/y$/, 'i');
  return w.replace(/(.)\1+/g, '$1').replace(/a/g, '');
}
const romanClose = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && lev(a, b) <= 1);

// ---------------------------------------------------------------- Recogniser slips
// Measured on our noisy test audio: the recogniser mostly swaps a sound for a near one ("बुखार" → "बुखाल", r/l;
// "वीकनेस" → "बिकनेस", v/b) or drops a soft sound ("खांसी" → "कसी"). One such slip is accepted for Hindi words.
const SOUND_CLASS: Record<string, string> = { k: 'K', g: 'K', c: 'C', j: 'C', s: 'C', t: 'T', d: 'T', p: 'P', b: 'P', v: 'P', m: 'N', n: 'N', r: 'R', l: 'R', y: 'Y', h: 'H', i: 'I', e: 'I', u: 'U', o: 'U' };
const SOFT = new Set(['n', 'h', 'y', 'i', 'e', 'u', 'o']);
/** Exactly one plausible slip between two coarse keys: a swap inside a sound class, or a dropped / added soft sound. */
function plausibleSlip(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = -1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (diff >= 0) return false; diff = i; }
    return SOUND_CLASS[a[diff]] !== undefined && SOUND_CLASS[a[diff]] === SOUND_CLASS[b[diff]];
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) if (SOFT.has(long[i]) && long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}
const soundClassOf = (key: string) => SOUND_CLASS[key[0]] || key[0];

interface Token { key: string; fk: string; rk: string; dev: boolean; start: number; end: number }
const WORD_RE = /[\p{L}\p{M}\p{N}_]+/gu;
function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const key = wordKey(m[0]);
    const dev = [...m[0]].some(isDevanagari);
    if (key) out.push({ key, fk: fineKey(m[0]), rk: romanKey(m[0], dev), dev, start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const p = d; d = [i];
    for (let j = 1; j <= b.length; j++) d[j] = Math.min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  }
  return d[b.length];
}

// ---------------------------------------------------------------- Lexicon
const L = new Map<string, Set<string>>();
const add = (concepts: string, ...forms: string[]) => {
  for (const f of forms) {
    if (!L.has(f)) L.set(f, new Set());
    concepts.split(' ').forEach(c => L.get(f)!.add(c));
  }
};

// body sites
add('S_HEAD', 'सिर', 'सर', 'sir', 'sar', 'head', 'हेड', 'सिरदर्द', 'mathe', 'माथा', 'माथे', 'forehead');
add('S_HEAD F_PAIN', 'headache', 'हेडेक', 'हेडएक', 'sirdard', 'migraine', 'माइग्रेन');
add('S_EYE', 'आँख', 'आंख', 'आँखें', 'आंखें', 'आँखों', 'aankh', 'ankh', 'aankhen', 'eye', 'eyes');
add('S_EAR', 'कान', 'kaan', 'kan', 'ear', 'ears', 'इयर');
add('S_NOSE', 'नाक', 'naak', 'nak', 'nose');
add('S_TOOTH', 'दाँत', 'दांत', 'daant', 'dant', 'tooth', 'teeth', 'जबड़ा', 'जबड़े', 'jaw', 'मसूड़े');
add('S_THROAT', 'गला', 'गले', 'gala', 'gale', 'throat', 'थ्रोट');
add('S_THROAT F_SORE_THROAT', 'गला खराब', 'गले खराब', 'gala kharab', 'throat infection', 'थ्रोट इन्फेक्शन', 'थ्रोट में इन्फेक्शन', 'गले में इन्फेक्शन', 'gale me infection');
add('S_NECK', 'गर्दन', 'gardan', 'neck', 'नेक');
add('S_SHOULDER', 'कंधा', 'कंधे', 'kandha', 'kandhe', 'shoulder', 'shoulders', 'शोल्डर');
add('S_CHEST', 'सीना', 'सीने', 'छाती', 'seena', 'seene', 'chhati', 'chati', 'chest', 'चेस्ट', 'कलेजा', 'कलेजे');
add('S_HEART', 'दिल', 'dil', 'heart', 'हार्ट');
add('S_BREATH', 'साँस', 'सांस', 'श्वास', 'saans', 'sans', 'breath', 'breathe', 'breathing', 'ब्रीदिंग');
add('S_STOMACH', 'पेट', 'pet', 'stomach', 'स्टमक', 'abdomen', 'abdominal', 'belly', 'tummy', 'स्टोमक', 'टमी', 'नाभि', 'navel', 'उदर', 'udar');
add('S_STOMACH F_PAIN', 'stomachache', 'bellyache', 'tummyache', 'पेटदर्द', 'petdard');
add('S_BACK F_PAIN', 'backache');
add('S_TOOTH F_PAIN', 'toothache');
add('S_EAR F_PAIN', 'earache');
add('S_BACK', 'पीठ', 'peeth', 'pith', 'back', 'बैक');
add('S_LOWBACK', 'कमर', 'kamar', 'waist', 'कटि');
add('S_URINE', 'पेशाब', 'पेसाब', 'मूत्र', 'peshab', 'pishab', 'peshaab', 'urine', 'urination', 'यूरिन', 'यूरीन', 'urinating');
add('S_STOOL', 'शौच', 'पखाना', 'पाखाना', 'latrine', 'लैट्रिन', 'stool', 'stools', 'toilet', 'टॉयलेट', 'potty', 'पॉटी', 'पोटी');
add('S_ARM', 'हाथ', 'हाथों', 'haath', 'hath', 'arm', 'arms', 'hand', 'hands', 'बाँह', 'बांह', 'हथेली', 'हथेलियों', 'palm', 'palms');
add('S_FINGER', 'उंगली', 'उंगलियों', 'ungli', 'finger', 'fingers', 'कलाई', 'wrist');
add('S_ARM', 'कोहनी', 'kohni', 'elbow', 'elbows', 'forearm');
add('S_KNEE', 'घुटना', 'घुटने', 'घुटनों', 'ghutna', 'ghutne', 'ghutno', 'knee', 'knees');
add('S_LEG', 'पैर', 'पैरों', 'पाँव', 'पांव', 'pair', 'pairon', 'pairo', 'paon', 'leg', 'legs', 'लेग', 'टाँग', 'टांग', 'pindli', 'पिंडली', 'calf', 'जाँघ', 'जांघ', 'thigh');
add('S_FOOT', 'foot', 'feet', 'तलवा', 'तलवे', 'तलवों', 'talwe', 'sole', 'soles', 'टखना', 'टखने', 'ankle', 'ankles');
add('S_HEEL', 'एड़ी', 'एड़ियों', 'edi', 'eri', 'adi', 'heel', 'heels');
add('S_HIP', 'कूल्हा', 'कूल्हे', 'kulha', 'kulhe', 'hip', 'hips', 'नितंब', 'buttock');
add('S_JOINT', 'जोड़', 'जोड़ों', 'jod', 'jodo', 'joint', 'joints', 'जॉइंट', 'जॉइंट्स', 'ज्वाइंट', 'ज्वाइंट्स');
add('S_KNEE F_PAIN', 'नी पेन');
add('S_SKIN', 'त्वचा', 'चमड़ी', 'skin', 'स्किन');
add('S_BODY', 'शरीर', 'बदन', 'sharir', 'sharer', 'badan', 'body', 'बॉडी');
add('S_FACE', 'चेहरा', 'चेहरे', 'मुँह', 'मुंह', 'chehra', 'muh', 'munh', 'face');
add('S_PRIVATE', 'गुप्तांग', 'private', 'vagina', 'yoni', 'योनि');
// "नीचे से खून आ रहा है" is how many patients say bleeding from the vagina (or back passage)
add('S_PRIVATE F_BLOOD', 'नीचे से खून', 'niche se khoon', 'neeche se khoon', 'niche se khun', 'खून आ रहा है नीचे से', 'खून जा रहा है नीचे से', 'bleeding per vagina', 'vaginal bleeding', 'bleeding from vagina');
add('F_WOUND', 'घाव', 'ghaav', 'ghav', 'घाउ', 'जख्म', 'ज़ख्म', 'zakhm', 'zakham', 'नासूर', 'wound', 'wounds', 'ulcer', 'ulcers');
add('Q_NOT_HEALING', 'भर नहीं रहा', 'भर नहीं रही', 'भरता नहीं', 'भर नहीं रहे', 'सूख नहीं रहा', 'bhar nahi raha', 'bhar nahi rahi', 'sukh nahi raha', 'not healing', 'won\'t heal', 'does not heal', 'not getting better');
add('S_ANUS', 'गुदा', 'बवासीर', 'piles', 'bawasir', 'anus');
// findings (a few spellings are recogniser slips heard in testing: दर्व = दर्द, ख्यासी = खांसी)
add('F_PAIN', 'दर्द', 'दर्व', 'dard', 'pain', 'pains', 'paining', 'पेन', 'ache', 'aching', 'hurts', 'hurt', 'hurting', 'painful', 'aches', 'टूट रहा', 'टूट रही', 'toot raha', 'toot rahi', 'tut raha', 'दुखना', 'दुखता', 'दुख', 'dukh', 'dukhta', 'वेदना', 'चुभन', 'sore');
add('F_BURN', 'जलन', 'jalan', 'burning', 'बर्निंग', 'जलती', 'जलता', 'jalti', 'jalta', 'जलते');
add('F_SWELL', 'सूजन', 'सूज', 'sujan', 'soojan', 'swelling', 'swollen', 'स्वेलिंग', 'फूल');
// "problem / तकलीफ / दिक्कत" next to a body site ("ब्रीदिंग में प्रॉब्लम", "pet me dikkat", "chest discomfort")
add('F_TROUBLE', 'तकलीफ', 'तकलीफ़', 'तकलीफें', 'दिक्कत', 'प्रॉब्लम', 'प्रोब्लम', 'परेशानी', 'takleef', 'taklif', 'dikkat', 'problem', 'problems', 'difficulty', 'trouble', 'pareshani', 'discomfort');
add('F_ITCH', 'खुजली', 'khujli', 'itching', 'itch', 'itchy', 'इचिंग');
add('F_STIFF', 'अकड़न', 'जकड़न', 'akdan', 'jakdan', 'stiff', 'stiffness', 'jam', 'jammed');
add('F_NUMB', 'सुन्न', 'सुन्नपन', 'sunn', 'numb', 'numbness', 'झुनझुनी', 'jhunjhuni', 'tingling', 'चींटी', 'झनझनाहट', 'नंबनेस');
add('F_CRAMP', 'ऐंठन', 'मरोड़', 'marod', 'maror', 'aithan', 'cramp', 'cramps', 'cramping');
add('F_FEVER', 'बुखार', 'ताप', 'bukhar', 'bukhaar', 'fever', 'फीवर', 'temperature', 'टेम्परेचर', 'टेंपरेचर', 'टेम्प्रेचर', 'ज्वर');
add('F_CHILLS', 'ठंड', 'ठण्ड', 'कंपकंपी', 'कपकपी', 'thand', 'chills', 'shivering', 'kapkapi');
add('F_COUGH', 'खाँसी', 'खांसी', 'खासी', 'ख्यासी', 'khansi', 'khasi', 'khaasi', 'cough', 'coughing', 'कफ़', 'कफ');
add('F_PHLEGM', 'बलगम', 'balgam', 'phlegm', 'sputum', 'cough with mucus');
add('F_DRY', 'सूखी', 'सूखा', 'सूखापन', 'sukhi', 'dry', 'ड्राई');
add('F_BLOOD', 'खून', 'ख़ून', 'khoon', 'khun', 'blood', 'ब्लड', 'bleeding', 'ब्लीडिंग', 'रक्त');
add('F_VOMIT', 'उल्टी', 'उलटी', 'उल्टियां', 'ulti', 'vomit', 'vomiting', 'vomited', 'vomits', 'वोमिटिंग', 'vomitting', 'throwing up', 'threw up');
add('F_NAUSEA', 'मिचली', 'मिचलाना', 'मितली', 'nausea', 'जी मिचला', 'जी मिचलाना', 'जी मिचलाता', 'जी मिचलाती', 'जी मचला', 'जी मचलाना', 'जी मचलाता', 'जी मचलाती', 'जी मचल', 'ji machla', 'ji machlana', 'ji michla', 'ji machal', 'ji michlata', 'ji machlata', 'जी घबरा', 'जी घबराना', 'ji ghabrana', 'ji michlana', 'vomiting sensation', 'vomiting feeling', 'उल्टी जैसा', 'ulti jaisa', 'nauseous', 'nauseated', 'queasy', 'नॉज़िया', 'नॉसिया');
add('F_DIARRHOEA', 'दस्त', 'डायरिया', 'dast', 'loose motion', 'loose motions', 'loose stool', 'loose stools', 'watery stool', 'watery stools', 'पतले दस्त', 'लूज़ मोशन', 'लूज मोशन', 'लूज़ मोशंस', 'diarrhoea', 'diarrhea', 'पतला शौच', 'patla');
add('F_CONSTIP', 'कब्ज़', 'कब्ज', 'kabj', 'kabz', 'constipation', 'कॉन्स्टिपेशन', 'पेट साफ नहीं', 'पखाना साफ नहीं', 'pet saaf nahi', 'motion clear nahi');
add('F_GAS', 'गैस', 'gas', 'डकार', 'burping');
add('F_BLOAT', 'फूलना', 'फूला', 'फूल जाता', 'phoolna', 'phula', 'bloating', 'bloated', 'ब्लोटिंग');
add('F_ACID', 'एसिडिटी', 'acidity', 'heartburn', 'खट्टी डकार', 'acid', 'एसिड');
add('S_CHEST F_BURN F_ACID', 'छाती में जलन', 'सीने में जलन', 'कलेजे में जलन', 'chhati me jalan', 'seene me jalan');
add('F_DIZZY', 'चक्कर', 'chakkar', 'chakar', 'dizzy', 'dizziness', 'giddy', 'giddiness', 'vertigo', 'घूमना', 'घूमता', 'घूम', 'ghoom', 'ghum', 'sir ghoom', 'चकरा', 'lightheaded', 'light headed', 'डिज़ीनेस', 'डिजीनेस');
add('F_COLD', 'सर्दी', 'कोल्ड', 'जुकाम', 'जुखाम', 'zukam', 'jukam', 'sardi', 'cold', 'runny nose', 'blocked nose', 'नाक बंद', 'naak band', 'naak beh', 'नाक बह',
  'छींक', 'छींकें', 'chheenk', 'sneezing', 'sneeze');
add('F_THIRST', 'प्यास', 'pyaas', 'pyas', 'thirst', 'thirsty');
add('F_BREATHLESS', 'सांस फूल', 'साँस फूल', 'सांस फूलना', 'saans phool', 'saans phoolti', 'breathless', 'breathlessness', 'breathing problem', 'breathing difficulty',
  'difficulty breathing', 'shortness of breath', 'short of breath', 'out of breath', 'ब्रेथलेसनेस', 'ब्रीदिंग प्रॉब्लम', 'हांफना', 'हाँफ', 'सांस में तकलीफ', 'सांस लेने में तकलीफ', 'दम फूलना', 'दमा', 'asthma', 'अस्थमा');
add('F_BREATHLESS R_CANT_BREATHE', 'सांस नहीं ले', 'साँस नहीं ले', 'सांस नहीं आ रही', 'सांस नहीं आती', 'सांस नहीं आता', 'not able to breathe', 'cannot breathe', "can't breathe", 'unable to breathe', 'saans nahi aa rahi', 'saans nahi aati', 'saans nahi le', 'sans nahi aa rahi', 'सांस नहीं ली जा', 'साँस नहीं आ रही', 'साँस नहीं आती', 'साँस नहीं ले',
  'सांस बंद', 'साँस बंद', 'सांस रुक', 'साँस रुक', 'दम घुट', 'saans band', 'sans band', 'saans ruk', 'dam ghut', 'dum ghut', 'breath is stopping', 'choking');
add('F_WHEEZE', 'सीटी', 'घरघराहट', 'wheezing', 'wheeze', 'whistling');
add('F_SLEEP', 'नींद', 'neend', 'nind', 'sleep', 'insomnia', 'नीद');
add('F_APPETITE', 'भूख', 'bhookh', 'bhukh', 'bhook', 'appetite', 'hunger', 'eating', 'खा नहीं रहा', 'खा नहीं रही', 'kha nahi raha', 'kha nahi rahi', 'kuch kha nahi');
add('F_WEAK', 'कमज़ोरी', 'कमजोरी', 'kamzori', 'kamjori', 'weakness', 'weak', 'थकान', 'thakan', 'tired', 'tiredness', 'fatigue', 'वीकनेस', 'थकावट', 'thakawat');
add('F_RASH', 'दाने', 'चकत्ते', 'daane', 'dane', 'rash', 'rashes', 'फुंसी', 'छाले', 'blisters', 'रैश', 'रैशेज़', 'रैशेस', 'patch', 'patches', 'red patches', 'लाल चकत्ते');
add('F_PRESSURE', 'दबाव', 'भारीपन', 'भारी', 'dabav', 'bhari', 'pressure', 'heaviness', 'heavy', 'जकड़', 'tightness', 'tight', 'घुटन', 'suffocation', 'suffocated');
add('F_SWEAT', 'पसीना', 'पसीने', 'pasina', 'paseena', 'sweat', 'sweating');
add('F_PALPIT', 'धड़कन', 'dhadkan', 'palpitation', 'palpitations', 'heartbeat', 'heart racing', 'धकधक', 'racing', 'pounding', 'fluttering', 'पैल्पिटेशन');
// drowsy / not responding: an IMNCI danger sign in a child
add('F_DROWSY', 'drowsy', 'drowsiness', 'lethargic', 'सुस्त', 'सुस्ती', 'susti');
add('F_HOARSE', 'hoarse', 'hoarseness', 'आवाज़ बैठ', 'आवाज बैठ', 'गला बैठ', 'gala baith', 'awaaz baith', 'voice');
add('F_SORE_THROAT', 'खराश', 'kharash', 'sore throat', 'गले में खराश');
add('F_PUS', 'मवाद', 'पस', 'पानी', 'pus', 'discharge', 'स्राव', 'paani', 'pani', 'fluid', 'watering');
add('F_RINGING', 'ringing', 'buzzing', 'भनभनाहट', 'सनसनाहट');
add('F_HEARING', 'सुनाई', 'sunai', 'hearing', 'बहरा', 'behra', 'deaf');
add('F_RED', 'लाल', 'laal', 'lal', 'red', 'redness', 'लालिमा', 'लाली');
add('F_ANXIETY', 'घबराहट', 'ghabrahat', 'chinta', 'चिंता', 'anxiety', 'panic', 'tension', 'टेंशन', 'बेचैनी', 'bechaini', 'restless');
add('F_SAD', 'उदासी', 'उदास', 'udaas', 'sad', 'hopeless', 'depression', 'डिप्रेशन', 'निराशा');
add('F_TREMOR', 'काँपना', 'कांपना', 'काँपते', 'tremor', 'shaking', 'kaanpna');
add('F_CONSTIP', 'motion saaf nahi', 'पॉटी बंद', 'पोटी बंद', 'शौच बंद', 'पखाना बंद', 'लैट्रिन बंद', 'potty band', 'latrine band', 'motion band', 'toilet band');
add('F_BODYACHE S_BODY F_PAIN', 'बदन टूट', 'बदन दर्द', 'badan toot', 'badan dard', 'body pain', 'बॉडी पेन', 'body ache', 'bodyache');
add('S_HEAD F_PAIN Q_SEVERE', 'सिर फट', 'sir phat', 'सर फट');
add('F_PERIOD', 'मासिक', 'माहवारी', 'पीरियड', 'पीरियड्स', 'period', 'periods', 'mc', 'menses', 'mahwari');
add('F_STONE', 'पथरी', 'pathri', 'stone', 'kidney stone');
// qualifiers
add('Q_SEVERE', 'बहुत तेज़', 'तेज़', 'तेज', 'tez', 'tej', 'severe', 'severely', 'badly', 'असहनीय', 'unbearable', 'ज़्यादा', 'jyada', 'zyada', 'intense');
add('Q_SUDDEN', 'अचानक', 'achanak', 'suddenly', 'sudden', 'एकदम');
add('Q_LEFT', 'बाएँ', 'बाएं', 'बायाँ', 'बाया', 'बायें', 'baayen', 'baen', 'left', 'लेफ्ट');
add('Q_RIGHT', 'दाएँ', 'दाएं', 'दायाँ', 'दाहिने', 'दाहिना', 'daayen', 'dahine', 'right', 'राइट');
add('Q_LOWER', 'नीचे', 'निचले', 'निचला', 'neeche', 'niche', 'lower', 'bottom');
add('Q_UPPER', 'ऊपर', 'ऊपरी', 'upar', 'upper');
add('Q_MORNING', 'सुबह', 'subah', 'morning');
add('Q_NIGHT', 'रात', 'raat', 'rat', 'night');
add('Q_WALK', 'चलने', 'चलना', 'chalne', 'walk', 'walking', 'सीढ़ियाँ', 'stairs');
add('Q_SPREAD', 'फैलता', 'फैल', 'जाता', 'जा रहा', 'तक', 'spreading', 'going to', 'radiating', 'goes to', 'उतरता');
add('Q_FREQ', 'बार बार', 'baar baar', 'frequent', 'frequently', 'often', 'again and again');
add('Q_NOT_DOWN', 'उतर नहीं', 'उतरता नहीं', 'नहीं उतर', 'not coming down', 'not going down', 'does not come down', 'utar nahi');
add('Q_LONG', 'लंबे समय', 'महीने', 'months', 'long time', 'since long');
add('Q_SWALLOW', 'निगलने', 'निगल', 'swallow', 'swallowing', 'nigalne');
add('Q_BEND', 'झुक', 'झुकने', 'jhuk', 'bend', 'bending', 'lifting', 'वज़न');
add('Q_SIT', 'बैठने', 'बैठे', 'sitting', 'baithne', 'खड़े', 'standing');
add('Q_ONESIDE', 'एक तरफ', 'ek taraf', 'one side', 'आधे', 'aadhe');
// red-flag-only and visit-reason concepts (not used to rank catalog symptoms)
add('R_STROKE', 'टेढ़ा', 'tedha', 'drooping', 'droop', 'लकवा', 'lakwa', 'paralysis', 'paralysed', 'slurred', 'stroke',
  'बोल नहीं पा', 'bol nahi pa', 'जुबान लड़खड़ा', 'zubaan ladkhada', 'ladkhada', 'लड़खड़ा');
add('R_UNCONSCIOUS', 'बेहोश', 'behosh', 'बेहोशी', 'unconscious', 'fainted', 'faint', 'fainting', 'collapsed', 'गिर पड़ा', 'होश नहीं', 'hosh nahi', 'unresponsive', 'not responding', 'no response');
add('R_SEIZURE', 'झटके', 'jhatke', 'दौरा', 'daura', 'मिर्गी', 'mirgi', 'fits', 'seizure', 'convulsion', 'convulsions', 'had a fit', 'having a fit', 'fit aaya', 'fit aa gaya', 'फिट आया', 'फिट आ गया');
add('R_BITE', 'काट', 'kaat', 'काटा', 'bitten', 'bite', 'डंक', 'sting');
add('R_SNAKE', 'साँप', 'सांप', 'saanp', 'sanp', 'snake', 'बिच्छू', 'scorpion');
add('R_DOG', 'कुत्ते', 'कुत्ता', 'kutte', 'dog', 'बंदर', 'monkey');
add('R_POISON', 'ज़हर', 'जहर', 'zehar', 'jahar', 'poison', 'poisoning', 'कीटनाशक', 'pesticide', 'सल्फास', 'जहरीला', 'जहरीली', 'zehreela',
  'kerosene', 'मिट्टी का तेल', 'mitti ka tel', 'phenyl', 'फिनाइल', 'तेजाब', 'tezab', 'acid pi', 'bleach', 'harpic', 'हार्पिक', 'rat poison', 'चूहे मारने', 'chuhe marne');
add('R_BURN_INJURY', 'जल गया', 'जल गई', 'जल गए', 'jal gaya', 'burnt', 'burned', 'burn injury', 'झुलस');
add('R_INJURY', 'चोट', 'chot', 'injury', 'accident', 'एक्सीडेंट', 'fracture', 'हड्डी टूट');
add('R_PREGNANT', 'गर्भ', 'garbh', 'pregnant', 'pregnancy', 'प्रेगनेंट', 'गर्भवती');
add('R_CHILD', 'बच्चे', 'बच्चा', 'बच्ची', 'baccha', 'bacche', 'child', 'infant', 'kid', 'बेटा', 'बेटे', 'बेटी', 'son', 'daughter');
add('V_MEDICINE', 'दवा', 'दवाई', 'dawa', 'dawai', 'medicine', 'medicines', 'tablet', 'tablets', 'गोली', 'goli', 'refill');
add('V_REPORT', 'रिपोर्ट', 'report', 'reports', 'जाँच', 'जांच', 'test');
add('V_CHRONIC', 'bp', 'बीपी', 'शुगर', 'sugar', 'diabetes', 'डायबिटीज', 'थायराइड', 'thyroid');
add('V_FOLLOWUP', 'दिखाना', 'दिखानी', 'दिखाने', 'follow', 'checkup', 'चेकअप', 'खत्म');

// The phonetic key drops vowels and aspiration, so a lexicon word must never share its key with an everyday
// function word ("अफारा" and "पर" are both "pr"; "टीस" and "this" are both "tis"). Such forms are skipped.
const FUNCTION_WORDS = ('पर और में मैं है हैं का की के से को भी तो ना न नहीं हो था थी थे जो कि ये वो यह वह मुझे मेरा मेरी मेरे हम आप तुम कुछ अब जब तब फिर बस ' +
  'par aur me mein main hai hain ka ki ke se ko bhi to na nahi ho tha thi the jo ye vo wo mujhe mera meri mere hum aap kuch ab jab tab phir bas ' +
  'and the to of in on is it at for with but or not no my me i a an am are was be have has had do did this that there from by as so if very also just only').split(' ');
const FUNCTION_KEYS = new Set(FUNCTION_WORDS.map(w => wordKey(w)));
// Fuzzy matching is for recogniser slips in Hindi ("बुखार" → "बुहार"); everyday words must never be "corrected" into
// a clinical one ("while" is one letter from "wheeze").
const COMMON_KEYS = new Set([...FUNCTION_WORDS, ...('while where there these those which would could should about after before again other their every ' +
  'under never always still often since until being having doing going coming taking getting feeling sleeping walking working little really ' +
  'today night morning evening water years months weeks hours times small large right above below between during without through around ' +
  'because people thing things think know want need take make come give tell said says also just very much many more most some such than ' +
  'then them they what when with from into over your will shall started start since week month year hour minute side whole ' +
  'raha rahi rahe kuch bahut thoda abhi pehle baad saath liye wala wali kyunki lekin matlab accha theek haan nahi hota hoti karta karti ' +
  // everyday Hindi the recogniser may produce in place of a clinical word — never "corrected" into one
  'इधर उधर किधर काश फांसी दुकान नमक सेहत जिले जिला दर्ज गाना गाने दाग घर काम बात बातें लोग समय टाइम रोज़ रोज पानी खाना चाय दूध रोटी दाल चावल ' +
  'सब कुछ बहुत थोड़ा अभी पहले बाद साथ लिए वाला वाली क्योंकि लेकिन मतलब अच्छा ठीक हां हाँ नहीं होता होती करता करती करना कहना कहा बोला सुना देखा ' +
  'गया गई गए आया आई आए लिया दिया किया रखा चला चली जाता जाती आता आती रहा रही रहे सकता सकती चाहिए अपना अपनी उनको इनको हमको तुमको आपको ' +
  'साहब जी भाई बहन बेटा बेटी पापा मम्मी माँ मां पिताजी माताजी डॉक्टर अस्पताल दवाखाना गांव गाँव शहर सड़क बस गाड़ी पैसा पैसे फोन नंबर नाम उम्र साल महीना हफ्ता दिन रात सुबह शाम').split(' ')]
  .map(w => wordKey(w)));

// Words the lexicon knows exactly are never fuzzy-matched to something else ("swelling" ≠ "sweating").
const VOCAB = new Set<string>();
const ALIASES: Array<{ keys: string[]; fks: string[]; rks: string[]; concepts: string[]; dev: boolean }> = [];
for (const [form, cs] of L) {
  const toks = tokenize(form);
  const keys = toks.map(t => t.key);
  if (!keys.length) continue;
  if (keys.length === 1 && FUNCTION_KEYS.has(keys[0])) continue;
  if (keys.length === 1) VOCAB.add(keys[0]);
  ALIASES.push({ keys, fks: toks.map(t => t.fk), rks: toks.map(t => t.rk), concepts: [...cs], dev: [...form].some(isDevanagari) });
}
ALIASES.sort((a, b) => b.keys.length - a.keys.length); // stable: multi-word idioms first

// Index by first word so a text is not compared with every alias at every position. wordMatch() decides; the
// index only has to include every alias it could accept: exact key, fuzzy (same first sound, ≥ 5 letters),
// or a Hindi compound (Hindi alias of ≥ 3 letters at the edge of a longer Hindi word).
type Alias = (typeof ALIASES)[number];
/** Hindi aliases allowed inside compound words: body sites and the pain word ("सिरदर्द", "पेटदर्द"). */
const COMPOUND_KEYS = new Set(ALIASES.filter(a => a.dev && a.keys.length === 1 && a.concepts.every(c => c.startsWith('S_') || c === 'F_PAIN')).map(a => a.keys[0]));
const BY_FIRST = new Map<string, Alias[]>();
const FUZZY_BY_SOUND = new Map<string, Alias[]>();
const DEV_COMPOUND: Alias[] = [];
const SLIP_BY_CLASS = new Map<string, Alias[]>(); // Hindi aliases by the sound class of their first word's first sound
for (const a of ALIASES) {
  const k = a.keys[0];
  BY_FIRST.set(k, [...(BY_FIRST.get(k) || []), a]);
  if (k.length >= 5) FUZZY_BY_SOUND.set(k[0], [...(FUZZY_BY_SOUND.get(k[0]) || []), a]);
  if (a.dev && k.length >= 3) DEV_COMPOUND.push(a);
  if (a.dev && k.length >= 3) SLIP_BY_CLASS.set(soundClassOf(k), [...(SLIP_BY_CLASS.get(soundClassOf(k)) || []), a]);
}
const candidateCache = new Map<string, Alias[]>();
/** Aliases whose FIRST word matches this token (cached per distinct word). */
function candidates(tok: Token): Alias[] {
  const id = `${tok.dev ? 1 : 0}${tok.fk}|${tok.key}`;
  let list = candidateCache.get(id);
  if (!list) {
    const c = new Set<Alias>(BY_FIRST.get(tok.key) || []);
    if (!VOCAB.has(tok.key)) for (const a of FUZZY_BY_SOUND.get(tok.key[0]) || []) c.add(a);
    if (tok.dev && tok.key.length > 4) for (const a of DEV_COMPOUND) c.add(a);
    const slip = tok.dev && !VOCAB.has(tok.key) && !COMMON_KEYS.has(tok.key);
    if (slip) for (const a of SLIP_BY_CLASS.get(soundClassOf(tok.key)) || []) c.add(a);
    // single-word aliases must match; a multi-word alias may start with the one slipped word (checked in conceptMentions)
    list = [...c].filter(a => wordMatch(a.keys[0], a.fks[0], a.rks[0], a.dev, tok) || (a.keys.length > 1 && slip && slipMatch(a.keys[0], tok)));
    if (candidateCache.size > 4096) candidateCache.clear();
    candidateCache.set(id, list);
  }
  return list;
}

function wordMatch(alias: string, aliasFk: string, aliasRk: string, aliasDev: boolean, tok: Token): boolean {
  const word = tok.key;
  // Equal coarse keys are only a candidate: the words must also be close on the fine key (same script) or the
  // romanised key (across scripts), so "खाना" (food) never becomes "कान" / "kan" (ear).
  if (alias === word) return aliasDev === tok.dev ? fineClose(aliasFk, tok.fk) : romanClose(aliasRk, tok.rk);
  const n = alias.length;
  // Fuzzy only for words the lexicon does not know (speech-recognition slips), and only when the first sound
  // agrees — recognisers keep it ("बुखार" → "बुहार") while different words differ there ("घुटने" vs "उठाने").
  if (n >= 5 && !VOCAB.has(word) && !COMMON_KEYS.has(word) && alias[0] === word[0] && lev(alias, word) <= (n >= 8 ? 2 : 1)) return true;
  // A recogniser slip in a Hindi word of four or more sounds ("बुखाल", "बिकनेस", "कसी" for "खांसी")
  if (n >= 4 && aliasDev && tok.dev && !VOCAB.has(word) && !COMMON_KEYS.has(word) && plausibleSlip(alias, word)) return true;
  // Hindi compounds such as सिरदर्द: a Hindi alias at the edge of a Hindi word ("knee" must not match "दिखानी")
  // (only body sites and pain words form such compounds: "छाले" must not match the end of "निचले")
  if (aliasDev && tok.dev && n >= 3 && word.length > n + 1 && COMPOUND_KEYS.has(alias) && (word.startsWith(alias) || word.endsWith(alias))) return true;
  return false;
}

/** A slip allowed for one word inside a multi-word phrase (the phrase's other words confirm it): three or more sounds. */
const slipMatch = (alias: string, tok: Token) => tok.dev && alias.length >= 3 && !VOCAB.has(tok.key) && !COMMON_KEYS.has(tok.key) && plausibleSlip(alias, tok.key);

/** `resolved`: denied only because it has stopped ("बुखार उतर गया") — still counted by the emergency rules. */
export interface ConceptMention { concepts: string[]; start: number; end: number; negated: boolean; historical: boolean; resolved?: boolean }

/** Every lexicon phrase in the text with its position and whether the speaker denied it. */
export function conceptMentions(text: string): ConceptMention[] {
  const src = text || '';
  const toks = tokenize(src);
  const out: ConceptMention[] = [];
  const used = new Set<number>();
  const push = (concepts: string[], a: number, b: number) => {
    // Emergencies (R_) count as past history only with an explicit distant past ("पिछले साल बेहोश हुआ था"), never
    // for "एक घंटे पहले बेहोश हो गई थी".
    const distantOnly = concepts.some(c => c.startsWith('R_'));
    const neg = negationAt(src, toks[a].start, toks[b].end);
    out.push({ concepts, start: toks[a].start, end: toks[b].end, negated: neg.negated, historical: isHistorical(src, toks[a].start, toks[b].end, distantOnly), ...(neg.cue === 'resolved' ? { resolved: true } : {}) });
  };
  // Multi-word idioms first (they claim their words), then single words not inside an idiom.
  for (const multi of [true, false]) {
    for (let i = 0; i < toks.length; i++) {
      if (!multi && used.has(i)) continue;
      for (const { keys, fks, rks, concepts, dev } of candidates(toks[i])) {
        const n = keys.length;
        if ((n > 1) !== multi || i + n > toks.length) continue;
        let slips = 0;
        const ok = keys.every((k, j) => {
          if (wordMatch(k, fks[j], rks[j], dev, toks[i + j])) return true;
          if (n > 1 && dev && slipMatch(k, toks[i + j])) { slips++; return true; }
          return false;
        });
        if (ok && slips <= 1 && slips < n) {
          push(concepts, i, i + n - 1);
          if (n > 1) for (let j = i; j < i + n; j++) used.add(j);
        }
      }
    }
  }
  // Recognisers often split one word in two ("झटके" → "झट के"): also try each joined pair.
  for (let i = 0; i + 1 < toks.length; i++) {
    const joined = (toks[i].key + toks[i + 1].key).replace(/(.)\1+/g, '$1');
    if (!VOCAB.has(joined)) continue;
    for (const { keys, concepts } of BY_FIRST.get(joined) || []) if (keys.length === 1) push(concepts, i, i + 1);
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Concepts a denial never removes: qualifiers and visit reasons, and complaints that are usually stated as a
 * negative ("भूख नहीं लगती", "नींद नहीं आती", "सुनाई नहीं देता", "पेशाब नहीं आ रहा", "सांस नहीं आ रही").
 */
export const NEVER_NEGATED = (concept: string) =>
  /^[QV]_/.test(concept) || ['F_APPETITE', 'F_SLEEP', 'F_HEARING', 'S_URINE', 'S_STOOL', 'S_BREATH'].includes(concept);

/**
 * Concepts the speaker affirmed, e.g. {S_CHEST, F_PAIN, Q_LEFT}; denied and past-history ones are left out. `ignoreNegation`
 * reads a label rather than a complaint (catalog card names such as "Fever that does not come down").
 */
export function extractConcepts(text: string, opts: { ignoreNegation?: boolean; keepResolved?: boolean } = {}): Set<string> {
  const found = new Set<string>();
  for (const m of conceptMentions(text)) {
    if (m.historical && !opts.ignoreNegation) continue; // "दो साल पहले हार्ट अटैक हुआ था" is history, not today's complaint
    for (const c of m.concepts) if (opts.ignoreNegation || !m.negated || (opts.keepResolved && m.resolved) || NEVER_NEGATED(c)) found.add(c);
  }
  return found;
}

// ---------------------------------------------------------------- Emergency rules
export type RedFlagTier = 'sos' | 'urgent';
export interface RedFlag { id: string; tier: RedFlagTier; label: string }

/** English labels — these go on the record and the staff screens. */
const FLAG_INFO: Record<string, { tier: RedFlagTier; label: string }> = {
  cardiac: { tier: 'sos', label: 'Chest pain or pressure — possible heart attack' },
  breathing: { tier: 'sos', label: 'Severe or sudden difficulty breathing' },
  bleeding: { tier: 'sos', label: 'Bleeding: coughing or vomiting blood, in stool, in pregnancy or after injury' },
  stroke: { tier: 'sos', label: 'Possible stroke — face droop or one-sided weakness' },
  unconscious: { tier: 'sos', label: 'Fainted or lost consciousness' },
  seizure: { tier: 'sos', label: 'Fits / seizure' },
  bite: { tier: 'sos', label: 'Bite by a snake, scorpion or unknown animal' },
  poison: { tier: 'sos', label: 'Poisoning or swallowed a harmful substance' },
  headache: { tier: 'sos', label: 'Sudden severe headache' },
  'animal-bite': { tier: 'urgent', label: 'Dog or animal bite — needs same-day rabies care' },
  burn: { tier: 'urgent', label: 'Burn injury' },
  fever: { tier: 'urgent', label: 'High fever that is not coming down' },
  abdomen: { tier: 'urgent', label: 'Severe pain in the lower right abdomen' },
  injury: { tier: 'urgent', label: 'Injury or accident — check whether this is a medico-legal case' },
  pregnancy: { tier: 'urgent', label: 'Pain or problem during pregnancy' },
  'breath-check': { tier: 'urgent', label: 'Breathlessness — oxygen saturation to be checked' },
  'gyn-bleeding': { tier: 'urgent', label: 'Bleeding from below (vagina / back passage) — check pregnancy and blood loss' },
  wound: { tier: 'urgent', label: 'Wound or ulcer that is not healing — check for diabetes and infection (same day)' },
  'child-danger': { tier: 'sos', label: 'Child very drowsy or not responding (danger sign)' }
};

export function redFlagsFromConcepts(c: Set<string>): RedFlag[] {
  const has = (...xs: string[]) => xs.some(x => c.has(x));
  const ids = new Set<string>();
  // X_CHEST_PAIN is set by analyseComplaint() when a pain / pressure / discomfort is attached to the chest in its
  // own phrase ("सीने में जलन है और घुटनों में दर्द" is not chest pain).
  if (has('X_CHEST_PAIN')) ids.add('cardiac');
  if (has('F_PALPIT') && has('F_SWEAT')) ids.add('cardiac');
  if (has('R_CANT_BREATHE') || (has('F_BREATHLESS') && has('Q_SUDDEN', 'Q_SEVERE'))) ids.add('breathing');
  else if (has('F_BREATHLESS')) ids.add('breath-check'); // on exertion or not graded: urgent, not an emergency
  if (has('F_BLOOD') && has('F_COUGH', 'F_VOMIT', 'S_STOOL', 'R_PREGNANT', 'R_INJURY')) ids.add('bleeding');
  if (has('R_STROKE') || (has('Q_SUDDEN') && has('F_WEAK', 'F_NUMB') && has('S_FACE', 'S_ARM', 'S_LEG', 'Q_ONESIDE'))) ids.add('stroke');
  if (has('Q_ONESIDE') && has('S_FACE', 'S_ARM') && has('F_WEAK')) ids.add('stroke');
  if (has('R_UNCONSCIOUS')) ids.add('unconscious');
  if (has('R_SEIZURE')) ids.add('seizure');
  // An unknown biter is treated as a snake: "साँप" is easily misheard ("सात ने काट लिया").
  if (has('R_SNAKE') || (has('R_BITE') && !has('R_DOG'))) ids.add('bite');
  else if (has('R_BITE') && has('R_DOG')) ids.add('animal-bite');
  if (has('R_POISON')) ids.add('poison');
  if (has('R_BURN_INJURY')) ids.add('burn');
  if (has('F_FEVER') && has('Q_NOT_DOWN')) ids.add('fever');
  if (has('S_HEAD') && has('F_PAIN') && has('Q_SUDDEN')) ids.add('headache');
  if (has('S_STOMACH') && has('Q_RIGHT') && has('Q_LOWER') && has('Q_SEVERE')) ids.add('abdomen');
  if (has('R_INJURY')) ids.add('injury');
  if (has('R_PREGNANT') && has('F_PAIN', 'F_BLOOD')) ids.add('pregnancy');
  if (has('F_BLOOD') && has('S_PRIVATE') && !ids.has('bleeding')) ids.add('gyn-bleeding');
  if (has('F_WOUND') && has('Q_NOT_HEALING')) ids.add('wound');
  if (has('R_CHILD') && has('F_DROWSY')) ids.add('child-danger');
  return [...ids].sort().map(id => ({ id, ...FLAG_INFO[id] }));
}

export type VisitReason = 'follow-up' | null;
export function visitReasonFromConcepts(c: Set<string>): VisitReason {
  const visit = c.has('V_MEDICINE') || c.has('V_REPORT') || c.has('V_FOLLOWUP');
  return visit && ![...c].some(k => k.startsWith('F_') && k !== 'F_TROUBLE') ? 'follow-up' : null;
}

export interface ComplaintAnalysis {
  concepts: Set<string>;
  redFlags: RedFlag[];
  /** True when any red flag needs a nurse now. */
  sos: boolean;
  visitReason: VisitReason;
}

const isSite = (m: ConceptMention) => m.concepts.some(c => c.startsWith('S_'));
const isFinding = (m: ConceptMention) => m.concepts.some(c => c.startsWith('F_'));

/**
 * Body sites a finding belongs to, within its clause: the sites between the previous finding and this one
 * ("सीने में और बाएं हाथ में दर्द" → chest and arm), plus the sites after it when nothing came before or no other
 * finding follows ("pain in my chest and left arm", "दर्द हो रहा है सीने में", "पेट में दर्द है और सिर में भी").
 */
export function attachedSites(ms: ConceptMention[], m: ConceptMention, text: string, opts: { primary?: boolean } = {}): ConceptMention[] {
  if (isSite(m)) return [m];
  if (opts.primary) {
    // Where the complaint is, without the areas it only spreads to ("सीने में दर्द … बाएं हाथ तक जाता है" is chest
    // pain, radiating to the left arm). Safety checks call without `primary` and still see every area.
    const all = attachedSites(ms, m, text);
    const targets = radiationTargetsAt(text, m.start);
    const own = all.filter(x => !targets.some(([a, b]) => x.start >= a && x.end <= b));
    return own.length ? own : all;
  }
  const [ca, cb] = clauseAt(text, m.start);
  const inClause = ms.filter(x => x.start >= ca && x.start < cb && x !== m);
  const prevEnd = Math.max(ca, ...inClause.filter(x => isFinding(x) && x.end <= m.start).map(x => x.end));
  // a site with its own predicate in between ("पेट ठीक है, सिर में दर्द") is not this finding's site
  const before = inClause.filter(x => isSite(x) && !isFinding(x) && x.start >= prevEnd && x.end <= m.start && !verbBetween(text, x.end, m.start));
  const next = inClause.filter(x => isFinding(x) && x.start >= m.end).map(x => x.start);
  // After it: up to the next finding when nothing came before; to the clause end when this is the last finding
  // ("पेट में दर्द है और सिर में भी" — the head belongs to the same pain).
  // A site right in front of the next finding is that finding's ("दर्द है घुटने में और सीने में भारीपन नहीं है":
  // the chest goes with the heaviness, which is denied, not with the knee pain).
  const ownedByNext = (x: ConceptMention) => inClause.some(n => isFinding(n) && !isSite(n) && n.start >= x.end && n.start > m.end &&
    text.slice(x.end, n.start).trim().split(/\s+/).filter(Boolean).length <= 2 && !verbBetween(text, x.end, n.start));
  const after = !before.length || !next.length
    ? inClause.filter(x => isSite(x) && !isFinding(x) && x.start >= m.end && x.start < (next.length ? Math.min(...next) : cb) && !ownedByNext(x))
    : [];
  if (before.length || after.length) return [...before, ...after];
  // "सीने में दर्द तो नहीं है पर भारीपन सा लगता है": the heaviness belongs to the chest named in the previous clause,
  // whose own finding was denied. A site in another clause of the sentence is used if no affirmed finding claims it.
  const [sa, sb] = sentenceAt(text, m.start);
  const claimed = (x: ConceptMention) => { const [a, b] = clauseAt(text, x.start); return ms.some(y => y !== x && y !== m && isFinding(y) && !y.negated && y.start >= a && y.start < b); };
  return ms.filter(x => x.start >= sa && x.start < sb && isSite(x) && !isFinding(x) && !claimed(x));
}

export function analyseComplaint(text: string): ComplaintAnalysis {
  const concepts = extractConcepts(text);
  // Emergency rules stay recall-first: a complaint that "has gone" ("सीने का दर्द ठीक हो गया") is still checked.
  const safety = extractConcepts(text, { keepResolved: true });
  const ms = conceptMentions(text);
  const chestPain = (withResolved: boolean) => ms.some(m => (!m.negated || (withResolved && m.resolved)) && !m.historical &&
    m.concepts.some(c => c === 'F_PAIN' || c === 'F_PRESSURE' || c === 'F_TROUBLE' || c === 'F_STIFF') &&
    attachedSites(ms, m, text).some(s => !s.negated && !s.historical && s.concepts.some(c => c === 'S_CHEST' || c === 'S_HEART')));
  if (chestPain(false)) concepts.add('X_CHEST_PAIN');
  if (chestPain(true)) safety.add('X_CHEST_PAIN');
  const redFlags = redFlagsFromConcepts(safety);
  return { concepts, redFlags, sos: redFlags.some(f => f.tier === 'sos'), visitReason: visitReasonFromConcepts(concepts) };
}

/** Ranking weight of a concept type: body sites and findings count fully, qualifiers half, the rest (and F_TROUBLE) not at all. */
export const conceptTypeWeight = (concept: string): number =>
  concept === 'F_TROUBLE' ? 0 : // "problem / तकलीफ" only ties a body site to a complaint; it does not pick a card
  concept[0] === 'S' || concept[0] === 'F' ? 1 : concept[0] === 'Q' ? 0.5 : 0;
