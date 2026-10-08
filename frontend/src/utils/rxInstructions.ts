/**
 * How to take each medicine, written in the patient's own language for the printed prescription.
 *
 * Built from fixed, reviewed phrase tables (not machine translation): dose timing is safety
 * critical, so only patterns we can render exactly are translated. Anything else stays in English.
 */

export type RxLang = 'en' | 'hi' | 'mr' | 'bn' | 'ta' | 'te' | 'gu' | 'kn' | 'ml' | 'pa' | 'or';
type Table = Record<RxLang, string>;

export const LANGUAGE_NATIVE_NAME: Table = {
  en: 'English', hi: 'हिन्दी', mr: 'मराठी', bn: 'বাংলা', ta: 'தமிழ்', te: 'తెలుగు',
  gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ'
};

const TIMES_A_DAY: Table = {
  en: '{n} times a day', hi: 'दिन में {n} बार', mr: 'दिवसातून {n} वेळा', bn: 'দিনে {n} বার', ta: 'நாளுக்கு {n} முறை',
  te: 'రోజుకు {n} సార్లు', gu: 'દિવસમાં {n} વાર', kn: 'ದಿನಕ್ಕೆ {n} ಬಾರಿ', ml: 'ദിവസം {n} തവണ', pa: 'ਦਿਨ ਵਿੱਚ {n} ਵਾਰ', or: 'ଦିନକୁ {n} ଥର'
};
const ONCE_A_DAY: Table = {
  en: 'once a day', hi: 'दिन में 1 बार', mr: 'दिवसातून 1 वेळा', bn: 'দিনে 1 বার', ta: 'நாளுக்கு 1 முறை',
  te: 'రోజుకు ఒకసారి', gu: 'દિવસમાં 1 વાર', kn: 'ದಿನಕ್ಕೆ 1 ಬಾರಿ', ml: 'ദിവസം 1 തവണ', pa: 'ਦਿਨ ਵਿੱਚ 1 ਵਾਰ', or: 'ଦିନକୁ 1 ଥର'
};
const BEDTIME: Table = {
  en: 'at bedtime', hi: 'रात को सोते समय', mr: 'रात्री झोपताना', bn: 'রাতে শোয়ার আগে', ta: 'இரவு தூங்கும் முன்',
  te: 'రాత్రి పడుకునే ముందు', gu: 'રાત્રે સૂતી વખતે', kn: 'ರಾತ್ರಿ ಮಲಗುವ ಮುನ್ನ', ml: 'രാത്രി ഉറങ്ങുന്നതിനു മുമ്പ്', pa: 'ਰਾਤ ਨੂੰ ਸੌਣ ਵੇਲੇ', or: 'ରାତିରେ ଶୋଇବା ପୂର୍ବରୁ'
};
const WHEN_NEEDED: Table = {
  en: 'only when needed', hi: 'ज़रूरत होने पर ही', mr: 'गरज असेल तेव्हाच', bn: 'প্রয়োজন হলে তবেই', ta: 'தேவைப்படும்போது மட்டும்',
  te: 'అవసరమైనప్పుడు మాత్రమే', gu: 'જરૂર હોય ત્યારે જ', kn: 'ಅಗತ್ಯವಿದ್ದಾಗ ಮಾತ್ರ', ml: 'ആവശ്യമുള്ളപ്പോൾ മാത്രം', pa: 'ਲੋੜ ਪੈਣ ਤੇ ਹੀ', or: 'ଆବଶ୍ୟକ ହେଲେ ହିଁ'
};
const BEFORE_FOOD: Table = {
  en: 'before food', hi: 'खाने से पहले', mr: 'जेवणापूर्वी', bn: 'খাবারের আগে', ta: 'உணவுக்கு முன்',
  te: 'భోజనానికి ముందు', gu: 'જમ્યા પહેલાં', kn: 'ಊಟದ ಮೊದಲು', ml: 'ഭക്ഷണത്തിന് മുമ്പ്', pa: 'ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ', or: 'ଖାଇବା ପୂର୍ବରୁ'
};
const AFTER_FOOD: Table = {
  en: 'after food', hi: 'खाने के बाद', mr: 'जेवणानंतर', bn: 'খাবারের পরে', ta: 'உணவுக்குப் பின்',
  te: 'భోజనం తర్వాత', gu: 'જમ્યા પછી', kn: 'ಊಟದ ನಂತರ', ml: 'ഭക്ഷണത്തിന് ശേഷം', pa: 'ਖਾਣੇ ਤੋਂ ਬਾਅਦ', or: 'ଖାଇବା ପରେ'
};
const FOR_DAYS: Table = {
  en: 'for {n} days', hi: '{n} दिन तक', mr: '{n} दिवस', bn: '{n} দিন ধরে', ta: '{n} நாட்கள்',
  te: '{n} రోజులు', gu: '{n} દિવસ સુધી', kn: '{n} ದಿನಗಳವರೆಗೆ', ml: '{n} ദിവസം', pa: '{n} ਦਿਨ ਤੱਕ', or: '{n} ଦିନ ପର୍ଯ୍ୟନ୍ତ'
};
const WITH: Table = {
  en: 'with {x}', hi: '{x} के साथ', mr: '{x} सोबत', bn: '{x} দিয়ে', ta: '{x} உடன்',
  te: '{x} తో', gu: '{x} સાથે', kn: '{x} ಜೊತೆ', ml: '{x} കൂടെ', pa: '{x} ਨਾਲ', or: '{x} ସହିତ'
};
const DOSE: Table = {
  en: 'Dose', hi: 'मात्रा', mr: 'मात्रा', bn: 'মাত্রা', ta: 'அளவு', te: 'మోతాదు', gu: 'માત્રા', kn: 'ಪ್ರಮಾಣ', ml: 'അളവ്', pa: 'ਖੁਰਾਕ', or: 'ମାତ୍ରା'
};

const ANUPANA: Array<{ pattern: RegExp; words: Table }> = [
  { pattern: /luke ?warm|warm water|ushna jal|गुनगुन/i, words: { en: 'warm water', hi: 'गुनगुना पानी', mr: 'कोमट पाणी', bn: 'গরম জল', ta: 'வெதுவெதுப்பான நீர்', te: 'గోరువెచ్చని నీరు', gu: 'હૂંફાળું પાણી', kn: 'ಉಗುರುಬೆಚ್ಚಗಿನ ನೀರು', ml: 'ചെറുചൂടുവെള്ളം', pa: 'ਕੋਸਾ ਪਾਣੀ', or: 'ଉଷୁମ ପାଣି' } },
  { pattern: /butter ?milk|takra|छाछ/i, words: { en: 'buttermilk', hi: 'छाछ', mr: 'ताक', bn: 'ঘোল', ta: 'மோர்', te: 'మజ్జిగ', gu: 'છાશ', kn: 'ಮಜ್ಜಿಗೆ', ml: 'മോര്', pa: 'ਲੱਸੀ', or: 'ଘୋଳଦହି' } },
  { pattern: /milk|ksheera|दूध/i, words: { en: 'milk', hi: 'दूध', mr: 'दूध', bn: 'দুধ', ta: 'பால்', te: 'పాలు', gu: 'દૂધ', kn: 'ಹಾಲು', ml: 'പാൽ', pa: 'ਦੁੱਧ', or: 'କ୍ଷୀର' } },
  { pattern: /honey|madhu|शहद/i, words: { en: 'honey', hi: 'शहद', mr: 'मध', bn: 'মধু', ta: 'தேன்', te: 'తేనె', gu: 'મધ', kn: 'ಜೇನುತುಪ್ಪ', ml: 'തേൻ', pa: 'ਸ਼ਹਿਦ', or: 'ମହୁ' } },
  { pattern: /ghee|ghrita|घी/i, words: { en: 'ghee', hi: 'घी', mr: 'तूप', bn: 'ঘি', ta: 'நெய்', te: 'నెయ్యి', gu: 'ઘી', kn: 'ತುಪ್ಪ', ml: 'നെയ്യ്', pa: 'ਘਿਓ', or: 'ଘିଅ' } },
  { pattern: /water|jal|पानी/i, words: { en: 'water', hi: 'पानी', mr: 'पाणी', bn: 'জল', ta: 'நீர்', te: 'నీరు', gu: 'પાણી', kn: 'ನೀರು', ml: 'വെള്ളം', pa: 'ਪਾਣੀ', or: 'ପାଣି' } }
];

const fill = (t: string, k: string, v: string | number) => t.replace(`{${k}}`, String(v));

export function isRxLang(l: string | undefined): l is RxLang {
  return !!l && l in LANGUAGE_NATIVE_NAME;
}

/**
 * Patient-language instruction for one medicine, or null when the frequency is not a pattern we can
 * render exactly (then only the English row is printed).
 */
export function buildInstruction(med: { dose?: string; frequency?: string; durationDays?: number; anupana?: string }, lang: RxLang): string | null {
  const f = (med.frequency || '').toLowerCase();
  if (!f) return null;
  const parts: string[] = [];

  let timesPerDay: number | null = null;
  if (/\bsos\b|when needed|as needed|prn/.test(f)) parts.push(WHEN_NEEDED[lang]);
  else if (/\bhs\b|bedtime|night/.test(f) && !/twice|bd|tds|thrice/.test(f)) parts.push(BEDTIME[lang]);
  else if (/\bqid\b|four times/.test(f)) timesPerDay = 4;
  else if (/\btds\b|\btid\b|thrice|three times/.test(f)) timesPerDay = 3;
  else if (/\bbd\b|\bbid\b|twice/.test(f)) timesPerDay = 2;
  else if (/\bod\b|once/.test(f)) timesPerDay = 1;
  else return null;

  if (timesPerDay === 1) parts.push(ONCE_A_DAY[lang]);
  else if (timesPerDay) parts.push(fill(TIMES_A_DAY[lang], 'n', timesPerDay));

  if (/before (food|meal)/.test(f)) parts.push(BEFORE_FOOD[lang]);
  else if (/after (food|meal)/.test(f)) parts.push(AFTER_FOOD[lang]);

  const anupana = med.anupana ? ANUPANA.find(a => a.pattern.test(med.anupana!)) : undefined;
  if (anupana) parts.push(fill(WITH[lang], 'x', anupana.words[lang]));
  if (med.durationDays && med.durationDays > 0) parts.push(fill(FOR_DAYS[lang], 'n', med.durationDays));

  const dose = med.dose?.trim();
  return `${dose ? `${DOSE[lang]}: ${dose} — ` : ''}${parts.join(', ')}`;
}
