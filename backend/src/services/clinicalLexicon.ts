// GENERATED from frontend/src/utils/clinicalLexicon.ts by scripts/sync-clinical-lexicon.mjs — do not edit here.
/**
 * Clinical concept lexicon for Hindi, Hinglish (romanised or in Devanagari) and English complaint text.
 *
 * Words map to concepts — S_ body site, F_ finding, Q_ qualifier, R_ red-flag-only, V_ visit reason —
 * through a coarse phonetic key, so "पेशाब", "peshab" and a speech recogniser's "पेसाब" all land on the
 * same concept. The kiosk symptom catalog is tagged with this same lexicon (symptomMatcher.ts), so a new
 * catalog entry never needs its own list of phrases.
 *
 * `analyseComplaint()` also runs the emergency rules. They are deliberately recall-first and do not try
 * to understand negation ("दर्द कम नहीं हो रहा" means the pain is NOT easing): a nurse can downgrade a
 * false alarm, nobody can recover a missed one.
 *
 * Measured on a frozen test set (edge-ai/eval/cases.json): see `npm run eval:matcher` in frontend/.
 *
 * The backend keeps a generated copy (backend/src/services/clinicalLexicon.ts). Edit this file, then run
 * `node scripts/sync-clinical-lexicon.mjs` from the repository root.
 */

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

export function wordKey(word: string): string {
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

interface Token { key: string; dev: boolean }
const WORD_RE = /[\p{L}\p{M}\p{N}_]+/gu;
function tokenize(text: string): Token[] {
  return (text.match(WORD_RE) || [])
    .map(w => ({ key: wordKey(w), dev: [...w].some(isDevanagari) }))
    .filter(t => t.key);
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
add('S_EAR', 'कान', 'kaan', 'kan', 'ear', 'ears');
add('S_NOSE', 'नाक', 'naak', 'nak', 'nose');
add('S_TOOTH', 'दाँत', 'दांत', 'daant', 'dant', 'tooth', 'teeth', 'जबड़ा', 'जबड़े', 'jaw', 'मसूड़े');
add('S_THROAT', 'गला', 'गले', 'gala', 'gale', 'throat', 'थ्रोट');
add('S_NECK', 'गर्दन', 'gardan', 'neck', 'नेक');
add('S_SHOULDER', 'कंधा', 'कंधे', 'kandha', 'kandhe', 'shoulder', 'shoulders', 'शोल्डर');
add('S_CHEST', 'सीना', 'सीने', 'छाती', 'seena', 'seene', 'sina', 'chhati', 'chati', 'chest', 'चेस्ट', 'कलेजा', 'कलेजे');
add('S_HEART', 'दिल', 'dil', 'heart', 'हार्ट');
add('S_BREATH', 'साँस', 'सांस', 'श्वास', 'saans', 'sans', 'saas', 'breath', 'breathe', 'breathing', 'ब्रीदिंग');
add('S_STOMACH', 'पेट', 'pet', 'stomach', 'स्टमक', 'abdomen', 'belly', 'tummy', 'नाभि', 'navel');
add('S_BACK', 'पीठ', 'peeth', 'pith', 'back', 'बैक');
add('S_LOWBACK', 'कमर', 'kamar', 'waist', 'कटि');
add('S_URINE', 'पेशाब', 'पेसाब', 'मूत्र', 'peshab', 'pishab', 'peshaab', 'urine', 'urination', 'यूरिन', 'यूरीन', 'urinating');
add('S_STOOL', 'शौच', 'पखाना', 'पाखाना', 'टट्टी', 'latrine', 'लैट्रिन', 'stool', 'stools', 'toilet', 'टॉयलेट', 'potty');
add('S_ARM', 'हाथ', 'हाथों', 'haath', 'hath', 'arm', 'arms', 'hand', 'hands', 'बाँह', 'बांह', 'हथेली', 'हथेलियों', 'palm', 'palms');
add('S_FINGER', 'उंगली', 'उंगलियों', 'ungli', 'finger', 'fingers', 'कलाई', 'wrist');
add('S_KNEE', 'घुटना', 'घुटने', 'घुटनों', 'ghutna', 'ghutne', 'ghutno', 'knee', 'knees');
add('S_LEG', 'पैर', 'पैरों', 'पाँव', 'पांव', 'pair', 'pairon', 'pairo', 'paon', 'leg', 'legs', 'लेग', 'टाँग', 'टांग', 'pindli', 'पिंडली', 'calf', 'जाँघ', 'जांघ', 'thigh');
add('S_FOOT', 'foot', 'feet', 'तलवा', 'तलवे', 'तलवों', 'talwe', 'sole', 'soles', 'टखना', 'टखने', 'ankle', 'ankles');
add('S_HEEL', 'एड़ी', 'एड़ियों', 'edi', 'eri', 'adi', 'heel', 'heels');
add('S_HIP', 'कूल्हा', 'कूल्हे', 'kulha', 'kulhe', 'hip', 'hips', 'नितंब', 'buttock');
add('S_JOINT', 'जोड़', 'जोड़ों', 'jod', 'jodo', 'joint', 'joints');
add('S_SKIN', 'त्वचा', 'चमड़ी', 'skin', 'स्किन');
add('S_BODY', 'शरीर', 'बदन', 'sharir', 'sharer', 'badan', 'body', 'बॉडी');
add('S_FACE', 'चेहरा', 'चेहरे', 'मुँह', 'मुंह', 'chehra', 'muh', 'munh', 'face');
add('S_PRIVATE', 'गुप्तांग', 'private', 'vagina', 'yoni', 'योनि');
add('S_ANUS', 'गुदा', 'बवासीर', 'piles', 'bawasir', 'anus');
// findings
add('F_PAIN', 'दर्द', 'dard', 'pain', 'pains', 'paining', 'पेन', 'ache', 'aching', 'hurts', 'hurt', 'दुखना', 'दुखता', 'दुख', 'dukh', 'dukhta', 'वेदना', 'चुभन', 'टीस', 'sore');
add('F_BURN', 'जलन', 'jalan', 'burning', 'बर्निंग', 'जलती', 'जलता', 'jalti', 'jalta', 'जलते');
add('F_SWELL', 'सूजन', 'सूज', 'sujan', 'soojan', 'swelling', 'swollen', 'स्वेलिंग', 'फूल');
add('F_ITCH', 'खुजली', 'khujli', 'itching', 'itch', 'itchy', 'इचिंग');
add('F_STIFF', 'अकड़न', 'जकड़न', 'akdan', 'jakdan', 'stiff', 'stiffness', 'jam', 'jammed');
add('F_NUMB', 'सुन्न', 'सुन्नपन', 'sunn', 'numb', 'numbness', 'झुनझुनी', 'jhunjhuni', 'tingling', 'चींटी');
add('F_CRAMP', 'ऐंठन', 'मरोड़', 'marod', 'maror', 'aithan', 'cramp', 'cramps', 'cramping');
add('F_FEVER', 'बुखार', 'ताप', 'bukhar', 'bukhaar', 'fever', 'फीवर', 'temperature', 'टेम्परेचर', 'ज्वर');
add('F_CHILLS', 'ठंड', 'ठण्ड', 'कंपकंपी', 'कपकपी', 'thand', 'chills', 'shivering', 'kapkapi');
add('F_COUGH', 'खाँसी', 'खांसी', 'खासी', 'khansi', 'khasi', 'khaasi', 'cough', 'coughing', 'कफ़', 'कफ');
add('F_PHLEGM', 'बलगम', 'balgam', 'phlegm', 'sputum', 'cough with mucus');
add('F_DRY', 'सूखी', 'सूखा', 'सूखापन', 'sukhi', 'dry', 'ड्राई');
add('F_BLOOD', 'खून', 'ख़ून', 'khoon', 'khun', 'blood', 'ब्लड', 'bleeding', 'ब्लीडिंग', 'रक्त');
add('F_VOMIT', 'उल्टी', 'उलटी', 'ulti', 'vomit', 'vomiting', 'वोमिटिंग', 'vomitting');
add('F_NAUSEA', 'मिचली', 'मिचलाना', 'मितली', 'nausea', 'जी मिचला', 'जी मिचलाना', 'जी घबरा', 'जी घबराना', 'ji ghabrana', 'ji michlana', 'vomiting sensation', 'vomiting feeling', 'उल्टी जैसा', 'ulti jaisa');
add('F_DIARRHOEA', 'दस्त', 'dast', 'loose motion', 'loose motions', 'लूज़ मोशन', 'लूज मोशन', 'लूज़ मोशंस', 'diarrhoea', 'diarrhea', 'पतला शौच', 'patla');
add('F_CONSTIP', 'कब्ज़', 'कब्ज', 'kabj', 'kabz', 'constipation', 'कॉन्स्टिपेशन', 'पेट साफ नहीं', 'पखाना साफ नहीं', 'pet saaf nahi', 'motion clear nahi');
add('F_GAS', 'गैस', 'gas', 'अफारा', 'afara', 'डकार', 'burping');
add('F_BLOAT', 'फूलना', 'फूला', 'फूल जाता', 'phoolna', 'phula', 'bloating', 'bloated', 'ब्लोटिंग');
add('F_ACID', 'एसिडिटी', 'acidity', 'heartburn', 'खट्टी डकार', 'acid', 'एसिड');
add('S_CHEST F_BURN F_ACID', 'छाती में जलन', 'सीने में जलन', 'कलेजे में जलन', 'chhati me jalan', 'seene me jalan');
add('F_DIZZY', 'चक्कर', 'chakkar', 'chakar', 'dizzy', 'dizziness', 'giddy', 'giddiness', 'vertigo', 'घूमना', 'घूमता');
add('F_BREATHLESS', 'सांस फूल', 'साँस फूल', 'सांस फूलना', 'saans phool', 'saans phoolti', 'breathless', 'breathlessness', 'breathing problem', 'breathing difficulty',
  'difficulty breathing', 'shortness of breath', 'हांफना', 'हाँफ', 'सांस में तकलीफ', 'सांस लेने में तकलीफ', 'दम फूलना', 'दमा', 'asthma', 'अस्थमा');
add('F_BREATHLESS R_CANT_BREATHE', 'सांस नहीं ले', 'साँस नहीं ले', 'सांस नहीं आ', 'not able to breathe', 'cannot breathe', "can't breathe", 'unable to breathe', 'saans nahi');
add('F_WHEEZE', 'सीटी', 'घरघराहट', 'wheezing', 'wheeze', 'whistling');
add('F_SLEEP', 'नींद', 'neend', 'nind', 'sleep', 'insomnia', 'नीद');
add('F_APPETITE', 'भूख', 'bhookh', 'bhukh', 'bhook', 'appetite', 'hunger');
add('F_WEAK', 'कमज़ोरी', 'कमजोरी', 'kamzori', 'kamjori', 'weakness', 'weak', 'थकान', 'thakan', 'tired', 'tiredness', 'fatigue');
add('F_RASH', 'दाने', 'चकत्ते', 'daane', 'dane', 'rash', 'rashes', 'फुंसी', 'छाले', 'blisters');
add('F_PRESSURE', 'दबाव', 'भारीपन', 'भारी', 'dabav', 'bhari', 'pressure', 'heaviness', 'heavy', 'जकड़', 'tightness', 'tight', 'घुटन', 'suffocation', 'suffocated');
add('F_SWEAT', 'पसीना', 'पसीने', 'pasina', 'paseena', 'sweat', 'sweating');
add('F_PALPIT', 'धड़कन', 'dhadkan', 'palpitation', 'palpitations', 'heartbeat', 'heart racing', 'धकधक');
add('F_HOARSE', 'hoarse', 'hoarseness', 'आवाज़ बैठ', 'आवाज बैठ', 'गला बैठ', 'gala baith', 'awaaz baith', 'voice');
add('F_SORE_THROAT', 'खराश', 'kharash', 'sore throat', 'गले में खराश');
add('F_PUS', 'मवाद', 'पस', 'पानी', 'pus', 'discharge', 'स्राव', 'paani', 'pani', 'fluid', 'watering');
add('F_RINGING', 'ringing', 'buzzing', 'भनभनाहट', 'सनसनाहट');
add('F_HEARING', 'सुनाई', 'sunai', 'hearing', 'बहरा', 'behra', 'deaf');
add('F_RED', 'लाल', 'laal', 'lal', 'red', 'redness', 'लालिमा', 'लाली');
add('F_ANXIETY', 'घबराहट', 'ghabrahat', 'chinta', 'चिंता', 'anxiety', 'panic', 'tension', 'टेंशन', 'बेचैनी', 'bechaini', 'restless');
add('F_SAD', 'उदासी', 'उदास', 'udaas', 'sad', 'hopeless', 'depression', 'डिप्रेशन', 'निराशा');
add('F_TREMOR', 'काँपना', 'कांपना', 'काँपते', 'tremor', 'shaking', 'kaanpna');
add('F_CONSTIP', 'motion saaf nahi');
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
add('R_STROKE', 'टेढ़ा', 'tedha', 'drooping', 'droop', 'लकवा', 'lakwa', 'paralysis', 'paralysed', 'slurred', 'stroke');
add('R_UNCONSCIOUS', 'बेहोश', 'behosh', 'बेहोशी', 'unconscious', 'fainted', 'faint', 'fainting', 'collapsed', 'गिर पड़ा');
add('R_SEIZURE', 'झटके', 'jhatke', 'दौरा', 'daura', 'मिर्गी', 'mirgi', 'fits', 'seizure', 'convulsion', 'convulsions');
add('R_BITE', 'काट', 'kaat', 'काटा', 'bitten', 'bite', 'डंक', 'sting');
add('R_SNAKE', 'साँप', 'सांप', 'saanp', 'sanp', 'snake', 'बिच्छू', 'scorpion');
add('R_DOG', 'कुत्ते', 'कुत्ता', 'kutte', 'dog', 'बंदर', 'monkey');
add('R_POISON', 'ज़हर', 'जहर', 'zehar', 'jahar', 'poison', 'poisoning', 'कीटनाशक', 'pesticide', 'सल्फास');
add('R_BURN_INJURY', 'जल गया', 'जल गई', 'जल गए', 'jal gaya', 'burnt', 'burned', 'burn injury', 'झुलस');
add('R_INJURY', 'चोट', 'chot', 'injury', 'accident', 'एक्सीडेंट', 'fracture', 'हड्डी टूट');
add('R_PREGNANT', 'गर्भ', 'garbh', 'pregnant', 'pregnancy', 'प्रेगनेंट', 'गर्भवती');
add('R_CHILD', 'बच्चे', 'बच्चा', 'baccha', 'bacche', 'child', 'baby', 'infant');
add('V_MEDICINE', 'दवा', 'दवाई', 'dawa', 'dawai', 'medicine', 'medicines', 'tablet', 'tablets', 'गोली', 'goli', 'refill');
add('V_REPORT', 'रिपोर्ट', 'report', 'reports', 'जाँच', 'जांच', 'test');
add('V_CHRONIC', 'bp', 'बीपी', 'शुगर', 'sugar', 'diabetes', 'डायबिटीज', 'थायराइड', 'thyroid');
add('V_FOLLOWUP', 'दिखाना', 'दिखानी', 'दिखाने', 'follow', 'checkup', 'चेकअप', 'खत्म');

// Words the lexicon knows exactly are never fuzzy-matched to something else ("swelling" ≠ "sweating").
const VOCAB = new Set<string>();
const ALIASES: Array<{ keys: string[]; concepts: string[]; dev: boolean }> = [];
for (const [form, cs] of L) {
  const keys = tokenize(form).map(t => t.key);
  if (!keys.length) continue;
  if (keys.length === 1) VOCAB.add(keys[0]);
  ALIASES.push({ keys, concepts: [...cs], dev: [...form].some(isDevanagari) });
}
ALIASES.sort((a, b) => b.keys.length - a.keys.length); // stable: multi-word idioms first

function wordMatch(alias: string, aliasDev: boolean, tok: Token): boolean {
  const word = tok.key;
  if (alias === word) return true;
  const n = alias.length;
  // Fuzzy only for words the lexicon does not know (speech-recognition slips), and only when the first sound
  // agrees — recognisers keep it ("बुखार" → "बुहार") while different words differ there ("घुटने" vs "उठाने").
  if (n >= 5 && !VOCAB.has(word) && alias[0] === word[0] && lev(alias, word) <= (n >= 8 ? 2 : 1)) return true;
  // Hindi compounds such as सिरदर्द: a Hindi alias at the edge of a Hindi word ("knee" must not match "दिखानी")
  if (aliasDev && tok.dev && n >= 3 && word.length > n + 1 && (word.startsWith(alias) || word.endsWith(alias))) return true;
  return false;
}

/** Concepts mentioned in the text, e.g. {S_CHEST, F_PAIN, Q_LEFT}. */
export function extractConcepts(text: string): Set<string> {
  const toks = tokenize(text || '');
  const found = new Set<string>();
  const used = new Set<number>();
  for (const { keys, concepts, dev } of ALIASES) {
    const n = keys.length;
    for (let i = 0; i + n <= toks.length; i++) {
      if (n === 1 && used.has(i)) continue;
      if (keys.every((k, j) => wordMatch(k, dev, toks[i + j]))) {
        concepts.forEach(c => found.add(c));
        if (n > 1) for (let j = i; j < i + n; j++) used.add(j);
      }
    }
  }
  // Recognisers often split one word in two ("झटके" → "झट के"): also try each joined pair.
  for (let i = 0; i + 1 < toks.length; i++) {
    const joined = toks[i].key + toks[i + 1].key;
    if (!VOCAB.has(joined)) continue;
    for (const { keys, concepts } of ALIASES) if (keys.length === 1 && keys[0] === joined) concepts.forEach(c => found.add(c));
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
  pregnancy: { tier: 'urgent', label: 'Pain or problem during pregnancy' }
};

export function redFlagsFromConcepts(c: Set<string>): RedFlag[] {
  const has = (...xs: string[]) => xs.some(x => c.has(x));
  const ids = new Set<string>();
  if (has('S_CHEST', 'S_HEART') && has('F_PAIN', 'F_PRESSURE')) ids.add('cardiac');
  if (has('F_PALPIT') && has('F_SWEAT')) ids.add('cardiac');
  if (has('R_CANT_BREATHE') || (has('F_BREATHLESS') && has('Q_SUDDEN', 'Q_SEVERE'))) ids.add('breathing');
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
  return [...ids].sort().map(id => ({ id, ...FLAG_INFO[id] }));
}

export type VisitReason = 'follow-up' | null;
export function visitReasonFromConcepts(c: Set<string>): VisitReason {
  const visit = c.has('V_MEDICINE') || c.has('V_REPORT') || c.has('V_FOLLOWUP');
  return visit && ![...c].some(k => k.startsWith('F_')) ? 'follow-up' : null;
}

export interface ComplaintAnalysis {
  concepts: Set<string>;
  redFlags: RedFlag[];
  /** True when any red flag needs a nurse now. */
  sos: boolean;
  visitReason: VisitReason;
}

export function analyseComplaint(text: string): ComplaintAnalysis {
  const concepts = extractConcepts(text);
  const redFlags = redFlagsFromConcepts(concepts);
  return { concepts, redFlags, sos: redFlags.some(f => f.tier === 'sos'), visitReason: visitReasonFromConcepts(concepts) };
}

/** Ranking weight of a concept type: body sites and findings count fully, qualifiers half, the rest not at all. */
export const conceptTypeWeight = (concept: string): number =>
  concept[0] === 'S' || concept[0] === 'F' ? 1 : concept[0] === 'Q' ? 0.5 : 0;
