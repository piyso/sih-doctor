/**
 * Kiosk speech post-processing:
 *  1. `mergeSpeechPieces`  – joins Web Speech API result pieces without the cumulative duplicates
 *                            some engines emit (Android Chrome repeats the whole phrase per result).
 *  2. `sanitizeVernacularTranscript` – removes English filler words that the recogniser writes in the
 *                            patient's script ("आई एम वेरी मच"), words in a foreign script, truncated
 *                            first syllables ("रे हाथ" → "मेरे हाथ") and repeated phrases.
 *  3. `extractSymptomsFromSpeech` – deterministic, offline symptom spotting in all 11 kiosk languages
 *                            (plus romanised Hinglish), so voice works without the server. A symptom the
 *                            patient denies ("बुखार नहीं है", "no fever") is left out, pain is tied to the body
 *                            part named in the same clause, and severity is only set when the patient said it.
 */
import { SocratesSymptom } from '../types/api';
import { normalizeLang, regionName, SupportedKioskLanguage } from './kioskLocalization';
import { clauseAt, findDurations, isHistorical, negationAt, radiationTargetsAt, sentenceAt, severityIn, verbBetween, windowAt } from './clinicalText';

// ------------------------------------------------------------------------------------------------
// Scripts
// ------------------------------------------------------------------------------------------------
const SCRIPT_RANGES: Record<string, RegExp> = {
  devanagari: /[ऀ-ॿ]/,
  bengali: /[ঀ-৿]/,
  tamil: /[஀-௿]/,
  telugu: /[ఀ-౿]/,
  gujarati: /[઀-૿]/,
  gurmukhi: /[਀-੿]/,
  kannada: /[ಀ-೿]/,
  malayalam: /[ഀ-ൿ]/,
  oriya: /[଀-୿]/,
  latin: /[A-Za-z]/
};

const LANG_SCRIPT: Record<SupportedKioskLanguage, string> = {
  hi: 'devanagari', mr: 'devanagari', bn: 'bengali', ta: 'tamil', te: 'telugu', en: 'latin',
  gu: 'gujarati', kn: 'kannada', ml: 'malayalam', pa: 'gurmukhi', or: 'oriya'
};

const scriptOf = (token: string): string | null => {
  for (const [name, re] of Object.entries(SCRIPT_RANGES)) {
    if (re.test(token)) return name;
  }
  return null; // digits / punctuation only
};

// English words that recognisers transliterate into the patient's script when people code-switch.
// Only pure filler / function words are listed — never words that may carry clinical meaning.
const FILLER_PHRASES: RegExp[] = [
  // Devanagari transliterations
  /आई\s*(?:एम|ऍम|अम)(?:\s*(?:वेरी|सो))?(?:\s*मच)?/g,
  /(?:वेरी\s*)+मच/g,
  /\bवेरी\b/g,
  /यू\s*नो/g,
  /आई\s*मीन/g,
  /एक्चुअली|ऐक्चुअली|बेसिकली|ऑब्वियसली|लाइक\s*दैट/g,
  /(?:^|\s)(?:ओके|ओक़े|हेलो|हैलो|हाय|प्लीज़?|सॉरी|थैंक\s*यू|उम्म+|अम्म+|हम्म+)(?=\s|$)/g,
  // Bengali transliterations
  /আই\s*অ্যাম(?:\s*ভেরি)?(?:\s*মাচ)?/g,
  /ভেরি\s*মাচ|অ্যাকচুয়ালি/g,
  // Tamil transliterations
  /ஐ\s*ஆம்(?:\s*வெரி)?(?:\s*மச்)?/g,
  /வெரி\s*மச்|ஆக்சுவலி/g,
  // Telugu transliterations
  /ఐ\s*ఆమ్(?:\s*వెరీ)?(?:\s*మచ్)?/g,
  /వెరీ\s*మచ్|యాక్చువల్లీ/g,
  // Latin (when the recogniser keeps English as English inside an Indic transcript)
  /\b(?:i\s*am|i'm)\s*(?:very\s*)*(?:much|so)?\b/gi,
  /\b(?:very\s*)+much\b/gi,
  /\b(?:you\s*know|i\s*mean|actually|basically|like\s*that|umm*|uhh*|hmm+)\b/gi
];

// Body-part words that a truncated "मेरे" ("my") can precede.
const BODY_WORDS_HI = 'हाथ|हाथों|बांह|बाँह|पेट|सिर|सर|कमर|पैर|पैरों|छाती|सीने|सीना|घुटने|घुटना|गले|गला|पीठ|आँख|आंख|कान|दाँत|दांत|हात|पोट|डोके|पाय|गुडघा|पाठ|कंबर';

/** Joins speech recogniser pieces, dropping cumulative repeats emitted by some engines. */
export const mergeSpeechPieces = (pieces: string[]): string => {
  let acc = '';
  for (const raw of pieces) {
    const piece = (raw || '').trim();
    if (!piece) continue;
    if (!acc) { acc = piece; continue; }
    if (piece.startsWith(acc)) { acc = piece; continue; } // cumulative re-emission
    if (acc.endsWith(piece) || acc.includes(piece)) continue; // already captured
    acc = `${acc} ${piece}`;
  }
  return acc;
};

const dedupeRepeatedPhrases = (words: string[]): string[] => {
  const out = [...words];
  const norm = (w: string) => w.replace(/[।.,!?]/g, '').toLowerCase();
  let changed = true;
  while (changed) {
    changed = false;
    for (let len = Math.floor(out.length / 2); len >= 2 && !changed; len--) {
      for (let i = 0; i + 2 * len <= out.length; i++) {
        const a = out.slice(i, i + len).map(norm).join(' ');
        const b = out.slice(i + len, i + 2 * len).map(norm).join(' ');
        if (a && a === b) {
          out.splice(i + len, len);
          changed = true;
          break;
        }
      }
    }
  }
  // Non-adjacent repeats of a long phrase (≥4 words) — keep the first occurrence.
  for (let len = Math.min(12, Math.floor(out.length / 2)); len >= 4; len--) {
    for (let i = 0; i + len <= out.length; i++) {
      const phrase = out.slice(i, i + len).map(norm).join(' ');
      for (let j = i + len; j + len <= out.length; j++) {
        if (out.slice(j, j + len).map(norm).join(' ') === phrase) {
          out.splice(j, len);
          j--;
        }
      }
    }
  }
  return out;
};

/**
 * Cleans a raw speech transcript for display and parsing.
 * `lang` is the kiosk language; words written in an unrelated script are dropped.
 */
export const sanitizeVernacularTranscript = (raw: string, lang?: string): string => {
  if (!raw) return '';
  const code = normalizeLang(lang);
  let text = raw.normalize('NFC');

  // 1. Split words fused across scripts ("हैआई", "दर्दpain") and before common fillers.
  text = text.replace(/([ऀ-ॿ])([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])([ऀ-ॿ])/g, '$1 $2');
  text = text.replace(/(है|हैं|था|थी|थे|हूँ|हूं|हो|रहा|रही|गया|गई|आहे|होते|ছে|হচ্ছে|ছিল|இருக்கு|இருக்கிறது|ఉంది)(आई|वेरी|एक्चुअली|ओके|यू|আই|ஐ|ఐ)/g, '$1 $2');

  // 2. Remove transliterated English fillers.
  for (const re of FILLER_PHRASES) text = text.replace(re, ' ');

  // 3. Repair a clipped first syllable: "रे हाथ में…" → "मेरे हाथ में…".
  text = text.replace(new RegExp(`(^|[\\s।])(?:रे|े)\\s+(${BODY_WORDS_HI})`, 'g'), '$1मेरे $2');

  // 4. Drop tokens written in a script that does not belong to the chosen language.
  //    English mode keeps Latin only; Indic modes keep their own script plus Latin (BP, MRI, etc.).
  const ownScript = LANG_SCRIPT[code];
  const tokens = text.split(/\s+/).filter(Boolean).filter(tok => {
    const sc = scriptOf(tok);
    if (!sc) return true;
    if (sc === ownScript) return true;
    if (sc === 'latin' && code !== 'en') return tok.length > 1; // keep abbreviations like BP, ECG
    // Marathi and Hindi share Devanagari; nothing else is accepted.
    return false;
  });

  // 5. Remove repeated phrases (stutters and engine duplicates).
  const deduped = dedupeRepeatedPhrases(tokens);
  return deduped.join(' ').replace(/\s+([।.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
};

// ------------------------------------------------------------------------------------------------
// Offline symptom spotting
// ------------------------------------------------------------------------------------------------
interface SymptomRule {
  key: string;
  en: string;
  labels: Record<SupportedKioskLanguage, string>;
  patterns: RegExp;
  character?: string;
  isEmergency?: boolean;
}

const RULES: SymptomRule[] = [
  {
    key: 'chest_pain', en: 'Chest pain / pressure', isEmergency: true, character: 'Crushing heaviness',
    labels: { en: 'Chest pain', hi: 'सीने में दर्द', mr: 'छातीत दुखणे', bn: 'বুকে ব্যথা', ta: 'நெஞ்சு வலி', te: 'ఛాతీ నొప్పి', gu: 'છાતીમાં દુખાવો', kn: 'ಎದೆ ನೋವು', ml: 'നെഞ്ചുവേദന', pa: 'ਛਾਤੀ ਵਿੱਚ ਦਰਦ', or: 'ଛାତି ଯନ୍ତ୍ରଣା' },
    patterns: /chest\s*(?:pain|pressure|tight)|सीने\s*(?:में|का|की)?\s*(?:दर्द|भारीपन|दबाव|जकड़न)|छाती\s*(?:में|का|की)?\s*(?:दर्द|भारीपन)|seene\s*me\s*dard|chhati\s*me\s*dard|छातीत\s*(?:दुख|कळ|वेदना)|বুকে\s*(?:ব্যথা|চাপ)|நெஞ்சு\s*வலி|மார்பு\s*வலி|ఛాతీ\s*నొప్పి|గుండె\s*నొప్పి|છાતી(?:માં)?\s*(?:દુખ|દર્દ|ભાર|દબાણ)|ಎದೆ\s*(?:ನೋವು|ಭಾರ|ಒತ್ತಡ)|ಎದೆನೋವು|നെഞ്ചു?\s*വേദന|നെഞ്ചിൽ\s*(?:വേദന|ഭാരം)|ਛਾਤੀ\s*(?:ਵਿੱਚ|ਚ)?\s*(?:ਦਰਦ|ਭਾਰ|ਦਬਾਅ)|ଛାତି\s*(?:ରେ)?\s*(?:ଯନ୍ତ୍ରଣା|ବିନ୍ଧା|ଦରଜ|ଭାରି|ଚାପ)/i
  },
  {
    key: 'breathless', en: 'Breathlessness', isEmergency: true,
    labels: { en: 'Breathlessness', hi: 'साँस फूलना', mr: 'धाप लागणे', bn: 'শ্বাসকষ্ট', ta: 'மூச்சுத்திணறல்', te: 'ఆయాసం', gu: 'શ્વાસ ચડવો', kn: 'ಉಸಿರಾಟದ ತೊಂದರೆ', ml: 'ശ്വാസംമുട്ടൽ', pa: 'ਸਾਹ ਚੜ੍ਹਨਾ', or: 'ଶ୍ୱାସକଷ୍ଟ' },
    patterns: /breathless|short(?:ness)?\s*of\s*breath|can'?t\s*breathe|सा(?:ं|ँ)स\s*(?:फूल|लेने\s*में|बंद|रुक)|दम\s*(?:फूल|घुट)|saans\s*(?:phool|band|ruk)|धाप\s*लाग|श्वास\s*(?:घेण्यास|कोंड)|শ্বাসকষ্ট|দম\s*বন্ধ|மூச்சுத்\s*திணறல்|மூச்சு\s*(?:வாங்க|விட)|ఆయాసం|ఊపిరి\s*(?:ఆడ|అంద)|శ్వాస|શ્વાસ\s*(?:ચડ|લેવામાં)|હાંફ|ಉಸಿರಾಟ\S*\s*ತೊಂದರೆ|ಉಸಿರು\s*(?:ಕಟ್ಟ|ಗಟ್ಟ)|ಉಸಿರುಗಟ್ಟ|ದಮ್ಮು|ശ്വാസം\s*മുട്ട|ശ്വാസംമുട്ട|കിതപ്പ്|ਸਾਹ\s*(?:ਚੜ੍ਹ|ਲੈਣ\s*ਵਿੱਚ|ਫੁੱਲ)|ਦਮ\s*ਘੁ|ଶ୍ୱାସ\s*କଷ୍ଟ|ଶ୍ୱାସକଷ୍ଟ/i
  },
  {
    key: 'headache', en: 'Headache',
    labels: { en: 'Headache', hi: 'सिरदर्द', mr: 'डोकेदुखी', bn: 'মাথাব্যথা', ta: 'தலைவலி', te: 'తలనొప్పి', gu: 'માથાનો દુખાવો', kn: 'ತಲೆನೋವು', ml: 'തലവേദന', pa: 'ਸਿਰਦਰਦ', or: 'ମୁଣ୍ଡବିନ୍ଧା' },
    patterns: /headache|सिर\s*(?:में\s*)?दर्द|सिरदर्द|s[ai]r\s*(?:me|mein|main|m)?\s*dard|डोके\s*दुख|डोकेदुखी|মাথা\s*ব্যথা|মাথাব্যথা|தலைவலி|தலை\s*வலி|తలనొప్పి|తల\s*నొప్పి|માથ(?:ું|ામાં|ાનો)\s*(?:દુખ|દર્દ)|ತಲೆ\s*ನೋವು|ತಲೆನೋವು|തല\s*വേദന|തലവേദന|ਸਿਰ\s*(?:ਵਿੱਚ\s*|ਚ\s*)?(?:ਦਰਦ|ਪੀੜ)|ਸਿਰਦਰਦ|ମୁଣ୍ଡ\s*(?:ବିନ୍ଧା|ଯନ୍ତ୍ରଣା|ଦରଜ)|ମୁଣ୍ଡବିନ୍ଧା/i
  },
  {
    key: 'fever', en: 'Fever',
    labels: { en: 'Fever', hi: 'बुखार', mr: 'ताप', bn: 'জ্বর', ta: 'காய்ச்சல்', te: 'జ్వరం', gu: 'તાવ', kn: 'ಜ್ವರ', ml: 'പനി', pa: 'ਬੁਖ਼ਾਰ', or: 'ଜ୍ୱର' },
    patterns: /fever|बुखार|bukhar|ताप\s*(?:आला|आहे|येतो)|(?:^|\s)ताप(?:\s|$)|জ্বর|காய்ச்சல்|జ్వరం|તાવ|ಜ್ವರ|പനി|ਬੁਖ਼?ਾਰ|ଜ୍ୱର/i
  },
  {
    key: 'cough', en: 'Cough',
    labels: { en: 'Cough', hi: 'खाँसी', mr: 'खोकला', bn: 'কাশি', ta: 'இருமல்', te: 'దగ్గు', gu: 'ઉધરસ', kn: 'ಕೆಮ್ಮು', ml: 'ചുമ', pa: 'ਖੰਘ', or: 'କାଶ' },
    patterns: /cough|खा(?:ं|ँ)सी|khansi|खोकला|কাশি|இருமல்|దగ్గు|ઉધરસ|ખાંસી|ಕೆಮ್ಮ|ചുമ|ਖੰਘ|କାଶ/i
  },
  {
    key: 'vomiting', en: 'Vomiting',
    labels: { en: 'Vomiting', hi: 'उल्टी', mr: 'उलटी', bn: 'বমি', ta: 'வாந்தி', te: 'వాంతులు', gu: 'ઉલટી', kn: 'ವಾಂತಿ', ml: 'ഛർദ്ദി', pa: 'ਉਲਟੀ', or: 'ବାନ୍ତି' },
    patterns: /vomit|उल्टी|ulti|उलटी|বমি(?!\s*ভাব)|வாந்தி|వాంతి|ઉલટી|ઊલટી|ವಾಂತಿ|ഛർദ്ദി|ശർദ്ദി|ਉਲਟੀ|ବାନ୍ତି(?!\s*ଭାବ)/i
  },
  {
    key: 'nausea', en: 'Nausea',
    labels: { en: 'Nausea', hi: 'जी मिचलाना', mr: 'मळमळ', bn: 'বমি ভাব', ta: 'குமட்டல்', te: 'వికారం', gu: 'ઉબકા', kn: 'ವಾಕರಿಕೆ', ml: 'ഓക്കാനം', pa: 'ਜੀ ਕੱਚਾ ਹੋਣਾ', or: 'ବାନ୍ତି ଭାବ' },
    patterns: /nause|जी\s*मि?चला|जी\s*मचल|ji\s*m[ia]chla|ji\s*machal|मळमळ|বমি\s*ভাব|குமட்டல்|వికారం|ઉબકા|ವಾಕರಿಕೆ|ഓക്കാന|ਜੀ\s*ਕੱਚਾ|ਮਤਲੀ|ବାନ୍ତି\s*ଭାବ/i
  },
  {
    key: 'diarrhoea', en: 'Loose motions / diarrhoea',
    labels: { en: 'Loose motions', hi: 'दस्त', mr: 'जुलाब', bn: 'পাতলা পায়খানা', ta: 'வயிற்றுப்போக்கு', te: 'విరేచనాలు', gu: 'ઝાડા', kn: 'ಭೇದಿ', ml: 'വയറിളക്കം', pa: 'ਦਸਤ', or: 'ତରଳ ଝାଡା' },
    patterns: /diarrh|loose\s*motion|दस्त|dast|जुलाब|পাতলা\s*পায়খানা|ডায়রিয়া|வயிற்றுப்போக்கு|విరేచనాలు|ઝાડા|ಭೇದಿ|ಅತಿಸಾರ|വയറിളക്ക|ਦਸਤ|ଝାଡା/i
  },
  {
    key: 'urine_burning', en: 'Burning while passing urine',
    labels: { en: 'Burning urine', hi: 'पेशाब में जलन', mr: 'लघवीला जळजळ', bn: 'প্রস্রাবে জ্বালা', ta: 'சிறுநீர் எரிச்சல்', te: 'మూత్రంలో మంట', gu: 'પેશાબમાં બળતરા', kn: 'ಮೂತ್ರದಲ್ಲಿ ಉರಿ', ml: 'മൂത്രത്തിൽ എരിച്ചിൽ', pa: 'ਪਿਸ਼ਾਬ ਵਿੱਚ ਜਲਣ', or: 'ପରିସ୍ରାରେ ଜଳନ' },
    patterns: /burning\s*(?:sensation\s*)?(?:while\s*|when\s*|during\s*|on\s*)?(?:passing\s*)?(?:urin\w*|peeing)|peshab\s*(?:me|mein)\s*jalan|पेशाब\s*में\s*जलन|peshab\s*me\s*jalan|लघवीला\s*जळजळ|প্রস্রাবে\s*জ্বালা|சிறுநீர்\s*எரிச்சல்|మూత్రంలో\s*మంట|પેશાબ(?:માં)?\s*બળતર|ಮೂತ್ರ(?:ದಲ್ಲಿ)?\s*ಉರಿ|മൂത്ര\S*\s*(?:എരിച്ചിൽ|ചുട്ടു)|ਪਿਸ਼ਾਬ\s*(?:ਵਿੱਚ|ਚ)?\s*ਜਲਣ|ପରିସ୍ରା\S*\s*ଜଳ/i
  },
  {
    key: 'dizziness', en: 'Dizziness',
    labels: { en: 'Dizziness', hi: 'चक्कर आना', mr: 'चक्कर येणे', bn: 'মাথা ঘোরা', ta: 'தலைசுற்றல்', te: 'తల తిరగడం', gu: 'ચક્કર', kn: 'ತಲೆತಿರುಗುವಿಕೆ', ml: 'തലകറക്കം', pa: 'ਚੱਕਰ', or: 'ମୁଣ୍ଡ ବୁଲାଇବା' },
    patterns: /dizz|vertigo|चक्कर|chakkar|মাথা\s*ঘোরা|தலைசுற்றல்|தலை\s*சுற்ற|తల\s*తిరగ|ચક્કર|ತಲೆ\s*ತಿರುಗ|ತಲೆತಿರುಗ|തല\s*കറ|തലകറക്ക|ਚੱਕਰ|ମୁଣ୍ଡ\s*ବୁଲ/i
  },
  {
    key: 'swelling', en: 'Swelling',
    labels: { en: 'Swelling', hi: 'सूजन', mr: 'सूज', bn: 'ফোলা', ta: 'வீக்கம்', te: 'వాపు', gu: 'સોજો', kn: 'ಊತ', ml: 'നീര്', pa: 'ਸੋਜ', or: 'ଫୁଲା' },
    patterns: /swell|सूजन|soojan|(?:^|\s)सूज(?:\s|$)|ফোলা|ফুলে|வீக்கம்|వాపు|સોજ|ಊತ|ಬಾವು|നീര്|വീക്കം|ਸੋਜ|ଫୁଲା|ଫୁଲି/i
  },
  {
    key: 'itching', en: 'Itching',
    labels: { en: 'Itching', hi: 'खुजली', mr: 'खाज', bn: 'চুলকানি', ta: 'அரிப்பு', te: 'దురద', gu: 'ખંજવાળ', kn: 'ತುರಿಕೆ', ml: 'ചൊറിച്ചിൽ', pa: 'ਖੁਜਲੀ', or: 'କୁଣ୍ଡାଇ' },
    patterns: /itch|खुजली|khujli|(?:^|\s)खाज|চুলকানি|அரிப்பு|దురద|ખંજવાળ|ತುರಿಕೆ|ನವೆ|ചൊറിച്ചിൽ|ਖੁਜਲੀ|ਖਾਰਸ਼|କୁଣ୍ଡାଇ/i
  },
  {
    key: 'weakness', en: 'Weakness / tiredness',
    labels: { en: 'Weakness', hi: 'कमज़ोरी', mr: 'अशक्तपणा', bn: 'দুর্বলতা', ta: 'பலவீனம்', te: 'బలహీనత', gu: 'નબળાઈ', kn: 'ದೌರ್ಬಲ್ಯ', ml: 'ക്ഷീണം', pa: 'ਕਮਜ਼ੋਰੀ', or: 'ଦୁର୍ବଳତା' },
    patterns: /weak|tired|fatigue|कमज़ोरी|कमजोरी|kamzori|थकान|अशक्तपणा|थकवा|দুর্বল|ক্লান্ত|பலவீனம்|சோர்வு|బలహీనత|అలసట|નબળાઈ|થાક|ದೌರ್ಬಲ್ಯ|ಸುಸ್ತು|ಆಯಾಸ|ക്ഷീണ|ബലഹീനത|ਕਮਜ਼?ੋਰੀ|ਥਕਾਵਟ|ଦୁର୍ବଳ|କ୍ଲାନ୍ତ/i
  },
  {
    key: 'numbness', en: 'Numbness / tingling',
    labels: { en: 'Numbness', hi: 'सुन्नपन / झुनझुनी', mr: 'बधिरता / मुंग्या', bn: 'অসাড়তা / ঝিনঝিন', ta: 'மரத்துப்போதல்', te: 'తిమ్మిరి', gu: 'ખાલી ચડવી / ઝણઝણાટી', kn: 'ಜೋಮು', ml: 'മരവിപ്പ്', pa: 'ਸੁੰਨ / ਝਰਨਾਹਟ', or: 'ଶୂନ୍ୟତା / ଝିମଝିମ' },
    patterns: /numb|tingl|सुन्न|झुनझुनी|बधिर|मुंग्या|অসাড়|ঝিনঝিন|மரத்து|கூச்சம்|తిమ్మిర|ખાલી\s*ચડ|ઝણઝણ|ಜೋಮು|ಜುಮ್ಮ|മരവിപ്പ്|തരിപ്പ്|ਸੁੰਨ|ਝਰਨਾਹਟ|ଝିମଝିମ|ଶୂନ୍ୟ/i
  },
  {
    key: 'bleeding', en: 'Bleeding', isEmergency: true,
    labels: { en: 'Bleeding', hi: 'खून आना', mr: 'रक्तस्राव', bn: 'রক্তপাত', ta: 'இரத்தப்போக்கு', te: 'రక్తస్రావం', gu: 'લોહી પડવું', kn: 'ರಕ್ತಸ್ರಾವ', ml: 'രക്തസ്രാവം', pa: 'ਖ਼ੂਨ ਵਗਣਾ', or: 'ରକ୍ତସ୍ରାବ' },
    patterns: /bleed|blood|खून|khoon|रक्तस्राव|रक्त\s*(?:येत|पड)|রক্ত|இரத்த|రక్తం|రక్తస్రావం|લોહી|ರಕ್ತ|രക്ത|ചോര|ਖ਼?ੂਨ|ਲਹੂ|ରକ୍ତ/i
  }
];

// Body parts → canonical region ids (laterality applied separately).
const BODY_PARTS: Array<{ region: string; lateral?: boolean; patterns: RegExp }> = [
  { region: 'Head', patterns: /\bhead\b|सिर|(?:^|\s)सर\s*(?:में|दर्द)|डोके|ডোকে|মাথা|தலை|తల(?!\s*తిరగ)|માથ|ತಲೆ(?!\s*ತಿರುಗ)|തല(?!\s*കറ)|ਸਿਰ|ମୁଣ୍ଡ(?!\s*ବୁଲ)/i },
  { region: 'Ear', patterns: /\bear\b|कान|কান|காது|చెవి|કાન|ಕಿವಿ|ചെവി|ਕੰਨ|କାନ/i },
  { region: 'Face & Sinus', patterns: /\beye|face|nose|tooth|teeth|आँख|आंख|चेहरा|नाक|दाँत|दांत|डोळ|दात|চোখ|মুখ|নাক|দাঁত|கண்|முகம்|மூக்கு|பல்|కన్ను|కళ్ళు|ముఖం|ముక్కు|పన్ను|આંખ|ચહેર|નાક|દાંત|ಕಣ್ಣು|ಮುಖ|ಮೂಗು|ಹಲ್ಲು|കണ്ണ്|മുഖ|മൂക്ക്|പല്ല്|ਅੱਖ|ਚਿਹਰ|ਨੱਕ|ਦੰਦ|ଆଖି|ମୁହଁ|ନାକ|ଦାନ୍ତ/i },
  { region: 'Neck', patterns: /throat|neck|गला|गले|घसा|मान|গলা|ঘাড়|தொண்டை|கழுத்து|గొంతు|మెడ|ગળ|ડોક|ಗಂಟಲು|ಕುತ್ತಿಗೆ|തൊണ്ട|കഴുത്ത്|ਗਲ|ਗਰਦਨ|ଗଳା|ବେକ/i },
  { region: 'Left Chest / Precordium', patterns: /chest|heart|सीने|सीना|छाती|दिल|हृदय|छातीत|বুক|হৃদ|நெஞ்சு|மார்பு|இதய|ఛాతీ|గుండె|છાતી|હૃદય|ಎದೆ|ಹೃದಯ|നെഞ്ച|ഹൃദയ|ਛਾਤੀ|ਦਿਲ|ଛାତି|ହୃଦୟ/i },
  { region: 'Epigastrium', patterns: /stomach|belly|abdom|tummy|पेट|pet\b|पोट|পেট|வயிறு|வயிற்று|కడుపు|પેટ|ಹೊಟ್ಟೆ|വയറ|ਪੇਟ|ପେଟ/i },
  { region: 'Lumbar Spine (Kati)', patterns: /back\s*(?:pain|ache|hurts?)|backache|lower\s*back|upper\s*back|\bmy\s+back\b|कमर|पीठ|kamar|कंबर|पाठ|কোমর|পিঠ|முதுகு|இடுப்பு|నడుము|వీపు|કમર|પીઠ|ಬೆನ್ನು|ಸೊಂಟ|മുതുക|നടു|ਕਮਰ|ਪਿੱਠ|ପିଠି|ଅଣ୍ଟା/i },
  { region: 'Left Shoulder', lateral: true, patterns: /shoulder|कंधे|कंधा|खांदा|কাঁধ|தோள்|భుజం|ખભ|ಭುಜ|തോൾ|ਮੋਢ|କାନ୍ଧ/i },
  { region: 'Left Hand', lateral: true, patterns: /\bhand|wrist|हाथ|हात|कलाई|मनगट|হাত|কব্জি|கை|மணிக்கட்டு|చేయి|చేతి|మణికట్టు|હાથ|કાંડ|ಕೈ|ಮಣಿಕಟ್ಟು|കൈ|മണിബന്ധ|ਹੱਥ|ਬਾਂਹ|ਗੁੱਟ|ହାତ|ବାହୁ|ମଣିବନ୍ଧ/i },
  { region: 'Left Knee', lateral: true, patterns: /knee|घुटने|घुटना|घुटनों|ghutn[aeo]|गुडघ|হাঁটু|முழங்கால்|మోకాలు|మోకాలి|ઘૂંટણ|ಮೊಣಕಾಲು|കാൽമുട്ട്|ਗੋਡ|ଆଣ୍ଠୁ/i },
  { region: 'Left Foot', lateral: true, patterns: /\bfoot|feet|ankle|heel|पंजा|टखने|एड़ी|तलवे|पाऊल|घोटा|टाच|পায়ের\s*পাতা|গোড়ালি|பாதம்|குதிகால்|கணுக்கால்|పాదం|మడమ|చీలమండ|પંજો|એડી|ઘૂંટી|ಪಾದ|ಹಿಮ್ಮಡಿ|പാദ|ഉപ്പൂറ്റി|കണങ്കാൽ|ਪੈਰ|ਅੱਡੀ|ਗਿੱਟ|ପାଦ|ଗୋଇଠି/i },
  { region: 'Left Leg', lateral: true, patterns: /\bleg|calf|पैर|पिंडली|(?:^|\s)पाय|पोटरी|(?:^|\s)পা(?:\s|$|য়ে)|கால்(?!\s*விரல்)|కాలు|కాలి|పిక్క|પગ|ಕಾಲು|ಕಾಲಿ|കാൽ|കാല്|ਲੱਤ|ਪਿੰਨੀ|ଗୋଡ|ପିଣ୍ଡୁଳା/i }
];

const PAIN_LABEL: Record<SupportedKioskLanguage, string> = {
  en: 'pain', hi: 'दर्द', mr: 'वेदना', bn: 'ব্যথা', ta: 'வலி', te: 'నొప్పి',
  gu: 'દુખાવો', kn: 'ನೋವು', ml: 'വേദന', pa: 'ਦਰਦ', or: 'ଯନ୍ତ୍ରଣା'
};

// Names for limbs when the patient did not say left or right.
const GENERIC_PART: Record<string, Record<SupportedKioskLanguage, string>> = {
  'Shoulder': { en: 'Shoulder', hi: 'कंधा', mr: 'खांदा', bn: 'কাঁধ', ta: 'தோள்', te: 'భుజం', gu: 'ખભો', kn: 'ಭುಜ', ml: 'തോൾ', pa: 'ਮੋਢਾ', or: 'କାନ୍ଧ' },
  'Hand': { en: 'Hand / arm', hi: 'हाथ', mr: 'हात', bn: 'হাত', ta: 'கை', te: 'చేయి', gu: 'હાથ', kn: 'ಕೈ', ml: 'കൈ', pa: 'ਹੱਥ', or: 'ହାତ' },
  'Knee': { en: 'Knee', hi: 'घुटना', mr: 'गुडघा', bn: 'হাঁটু', ta: 'முழங்கால்', te: 'మోకాలు', gu: 'ઘૂંટણ', kn: 'ಮೊಣಕಾಲು', ml: 'കാൽമുട്ട്', pa: 'ਗੋਡਾ', or: 'ଆଣ୍ଠୁ' },
  'Foot': { en: 'Foot / ankle', hi: 'पैर का पंजा', mr: 'पाऊल', bn: 'পায়ের পাতা', ta: 'பாதம்', te: 'పాదం', gu: 'પગનો પંજો', kn: 'ಪಾದ', ml: 'പാദം', pa: 'ਪੈਰ', or: 'ପାଦ' },
  'Leg': { en: 'Leg', hi: 'पैर', mr: 'पाय', bn: 'পা', ta: 'கால்', te: 'కాలు', gu: 'પગ', kn: 'ಕಾಲು', ml: 'കാൽ', pa: 'ਲੱਤ', or: 'ଗୋଡ' }
};

const RIGHT_WORDS = /\bright\b|दाय|दाहिन|दाएं|उजव|ডান|வலது|కుడి|જમણ|ಬಲ(?:ಗೈ|ಗಾಲ|ಭಾಗ|ದ|\s)|വലത്|ਸੱਜ|ଡାହାଣ/i;
const LEFT_WORDS = /\bleft\b|बाय|बाएं|बाँय|डाव|বাঁ|বাম|இடது|ఎడమ|ડાબ|ಎಡ|ഇടത്|ਖੱਬ|ବାମ/i;
const PAIN_WORDS = /pain|ache|hurt|cramp|दर्द|dard|मरोड़|मरोड|marod|ऐंठन|ainthan|दुख|वेदना|कळ|ব্যথা|ব্যাথা|வலி|வலிக்க|నొప్పి|દુખ|દર્દ|ನೋವು|ನೋಯ|വേദന|ਦਰਦ|ਪੀੜ|ଯନ୍ତ୍ରଣା|ବିନ୍ଧା|ଦରଜ/i;
const SEVERE_WORDS = /severe|very\s*bad|unbearable|a\s*lot|बहुत|तेज़|तेज|ज़्यादा|ज्यादा|असहनीय|खूप|तीव्र|असह्य|খুব|তীব্র|অসহ্য|மிக|கடுமை|தாங்க\s*முடிய|చాలా|తీవ్ర|భరించలేని|ખૂબ|બહુ|તીવ્ર|અસહ્ય|ತುಂಬಾ|ತೀವ್ರ|ಅಸಹನೀಯ|വളരെ|കഠിന|ਬਹੁਤ|ਤੇਜ਼|ਅਸਹਿ|ବହୁତ|ତୀବ୍ର|ଅସହ୍ୟ/i;
const MILD_WORDS = /mild|little|slight|थोड़ा|थोडा|हल्का|थोडे|सौम्य|একটু|হালকা|கொஞ்சம்|லேசா|కొంచెం|తేలిక|થોડ|હળવ|ಸ್ವಲ್ಪ|അൽപ്പം|ചെറിയ|ਥੋੜ੍ਹ|ਹਲਕ|ଟିକେ|ହାଲୁକା/i;

const NUMBER_WORDS: Record<string, number> = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'दस': 10,
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'दोन': 2, 'पाच': 5,
  'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5,
  'ஒரு': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
  'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'એક': 1, 'બે': 2, 'ત્રણ': 3, 'ચાર': 4, 'પાંચ': 5,
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5,
  'ഒരു': 1, 'ഒന്ന്': 1, 'രണ്ട്': 2, 'മൂന്ന്': 3, 'നാല്': 4, 'അഞ്ച്': 5,
  'ਇੱਕ': 1, 'ਦੋ': 2, 'ਤਿੰਨ': 3, 'ਪੰਜ': 5,
  'ଏକ': 1, 'ଦୁଇ': 2, 'ତିନି': 3, 'ଚାରି': 4, 'ପାଞ୍ଚ': 5,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'a': 1
};

/** Zero digit of each Indic script (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam). */
const INDIC_ZEROS = [0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66];
const toArabicDigits = (s: string) =>
  s.replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F]/g, d => {
    const c = d.charCodeAt(0);
    const zero = INDIC_ZEROS.find(z => c >= z && c <= z + 9)!;
    return String(c - zero);
  });

/** Returns an English duration such as "3 days" if the patient said one. */
export const detectDuration = (text: string): string | null => {
  const t = toArabicDigits(text.toLowerCase());
  if (/\btoday\b|आज\s*(?:से|सुबह)|आजपासून|আজ\s*থেকে|இன்று|ఈ\s*రోజు|આજ(?:થી|\s*સવાર)|ಇಂದು|ಇವತ್ತು|ഇന്ന്|ਅੱਜ|ଆଜି/.test(t)) return 'Since today';
  // Single-word "one week / one month" forms (Malayalam "ഒരാഴ്ച", "ഒരു മാസം", Kannada "ಒಂದು ವಾರ").
  if (/ഒരാഴ്ച|ഒരു\s*ആഴ്ച/.test(t)) return '1 week';
  if (/ഒരു\s*മാസ/.test(t)) return '1 month';
  if (/yesterday|कल\s*से|कालपासून|গতকাল|நேற்று|నిన్న|ગઈકાલ|ನಿನ್ನೆ|ഇന്നലെ|ਕੱਲ੍ਹ|ଗତକାଲି/.test(t)) return '1 day';
  const unit = (u: string) =>
    /day|din|दिन|दिवस|দিন|நாள|రోజ|દિવસ|ದಿನ|ദിവസ|ਦਿਨ|ଦିନ/.test(u) ? 'days' :
    /week|hafta|हफ्त|हफ़्त|सप्ताह|आठवड|সপ্তাহ|வார|వార|અઠવાડ|ವಾರ|ആഴ്ച|ਹਫ਼?ਤ|ସପ୍ତାହ/.test(u) ? 'weeks' :
    /month|mahin|महीन|महिन|মাস|மாத|నెల|મહિન|ತಿಂಗಳ|മാസ|ਮਹੀਨ|ମାସ/.test(u) ? 'months' :
    /year|saal|साल|वर्ष|বছর|வருட|సంవత్సర|વર્ષ|ವರ್ಷ|വർഷ|ਸਾਲ|ବର୍ଷ/.test(u) ? 'years' : null;
  const m = t.match(/(\d+|[a-zऀ-ൿ]+)\s*(days?|din|दिन\S*|दिवस\S*|দিন\S*|நாள\S*|రోజ\S*|દિવસ\S*|ದಿನ\S*|ദിവസ\S*|ਦਿਨ\S*|ଦିନ\S*|weeks?|hafte?|हफ़?्त\S*|सप्ताह\S*|आठवड\S*|সপ্তাহ\S*|வார\S*|వార\S*|અઠવાડ\S*|ವಾರ\S*|ആഴ്ച\S*|ਹਫ਼?ਤ\S*|ସପ୍ତାହ\S*|months?|mahine?|महीन\S*|महिन\S*|মাস\S*|மாத\S*|నెల\S*|મહિન\S*|ತಿಂಗಳ\S*|മാസ\S*|ਮਹੀਨ\S*|ମାସ\S*|years?|saal|साल\S*|वर्ष\S*|বছর\S*|வருட\S*|సంవత్సర\S*|વર્ષ\S*|ವರ್ಷ\S*|വർഷ\S*|ਸਾਲ\S*|ବର୍ଷ\S*)/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]];
    const u = unit(m[2]);
    if (n && u) return `${n} ${n === 1 ? u.replace(/s$/, '') : u}`;
  }
  return null;
};

export interface SpeechFindings {
  symptoms: SocratesSymptom[];
  hasEmergency: boolean;
  duration: string | null;
}

/**
 * Spots symptoms in free speech. Returns English clinical names plus labels in the kiosk language.
 * Generic pain is attached to the body part that was mentioned (with left/right if said).
 */
export const extractSymptomsFromSpeech = (text: string, lang?: string): SpeechFindings => {
  const code = normalizeLang(lang);
  const duration = findDurations(text)[0]?.value || detectDuration(text);
  const out: SocratesSymptom[] = [];
  const seen = new Set<string>();

  const push = (s: SocratesSymptom) => {
    if (!s.key || seen.has(s.key)) return;
    seen.add(s.key);
    out.push(s);
  };
  const global = (re: RegExp) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  /** The first mention the patient neither denied nor placed in the past ("दो साल पहले …"), or null. */
  const affirmedIn = (re: RegExp, within = text, offset = 0, emergency = false, accept?: (a: number, b: number) => boolean) => {
    for (const m of within.matchAll(global(re))) {
      const a = offset + m.index!;
      const b = a + m[0].length;
      if (accept && !accept(a, b)) continue;
      const neg = negationAt(text, a, b);
      // an emergency-type complaint that has just stopped ("सीने का दर्द ठीक हो गया") is still shown
      if ((!neg.negated || (emergency && neg.cue === 'resolved')) && !isHistorical(text, a, b, emergency)) return a;
    }
    return null;
  };
  /** Severity said next to a mention ("बहुत तेज़", "8 out of 10"); 0 when not said. */
  const severityAt = (pos: number) => {
    const near = windowAt(text, pos, pos + 1);
    return severityIn(near) || (SEVERE_WORDS.test(near) ? 8 : MILD_WORDS.test(near) ? 3 : 0);
  };

  for (const rule of RULES) {
    const at = affirmedIn(rule.patterns, text, 0, !!rule.isEmergency);
    if (at === null) continue;
    push({
      key: `voice:${rule.key}`,
      name: rule.en,
      symptom_name: rule.en,
      labelLocal: rule.labels[code],
      site: rule.key === 'chest_pain' ? 'Left Chest / Precordium' : rule.key === 'headache' ? 'Head' : 'General',
      onset: duration || '',
      character: rule.character || '',
      radiation: '',
      associations: [],
      timing: '',
      exacerbatingFactors: [],
      relievingFactors: [],
      severityScore: severityAt(at),
      source: 'voice',
      isEmergency: rule.isEmergency
    });
  }

  // Pain attached to a body part ("मेरे हाथ में बहुत दर्द"): the pain word must be in the same clause as the
  // part and not denied ("सिर में दर्द नहीं, पेट में है" → stomach only). Matched words are blanked out (same
  // length, so positions stay valid) so that "முழங்கால்" (knee) is not matched again by the shorter "கால்" (leg).
  // A part named only as where the pain goes ("पेट में दर्द है जो पीठ तक जाता है") is not a second complaint when
  // another part of the same sentence has the pain.
  const anyPart = new RegExp(BODY_PARTS.map(p => p.patterns.source).join('|'), 'gi');
  const onlySpreadsHere = (at: number, len: number) => {
    const targets = radiationTargetsAt(text, at);
    const inside = (x: number, l: number) => targets.some(([a, b]) => x < b && x + l > a); // "my back" overlaps "back
    if (!inside(at, len)) return false;
    const [sa, sb] = sentenceAt(text, at);
    for (const m of text.slice(sa, sb).matchAll(anyPart)) if (!inside(sa + m.index!, m[0].length)) return true;
    return false;
  };
  // The pain word is this part's when no other pain word comes between them ("सिर में दर्द नहीं है सीने में दर्द है"),
  // nor another part with its own predicate ("छाती ठीक है पेट में दर्द है"); "pain in my hand and leg" shares one pain.
  const painBelongs = (partA: number, partB: number, painA: number, painB: number) => {
    const [x, y] = painA >= partB ? [partB, painA] : [painB, partA];
    if (x >= y) return true;
    const between = text.slice(x, y);
    if (new RegExp(PAIN_WORDS.source, 'i').test(between)) return false;
    return !(new RegExp(anyPart.source, 'i').test(between) && verbBetween(text, x, y));
  };
  if (PAIN_WORDS.test(text)) {
    let rest = text;
    const hasRight = RIGHT_WORDS.test(text) && !LEFT_WORDS.test(text);
    const hasLeft = LEFT_WORDS.test(text) && !RIGHT_WORDS.test(text);
    for (const part of BODY_PARTS) {
      const re = global(new RegExp(part.patterns.source, 'i'));
      let painAt: number | null = null;
      for (const m of rest.matchAll(re)) {
        if (onlySpreadsHere(m.index!, m[0].length)) continue;
        const [a, b] = clauseAt(text, m.index!);
        painAt = affirmedIn(PAIN_WORDS, text.slice(a, b), a, false, (pa, pb) => painBelongs(m.index!, m.index! + m[0].length, pa, pb));
        if (painAt !== null) break;
      }
      rest = rest.replace(re, w => ' '.repeat(w.length));
      if (painAt === null) continue;
      let region = part.region;
      let sideKnown = true;
      if (part.lateral) {
        if (hasRight) region = region.replace('Left', 'Right');
        else if (!hasLeft) sideKnown = false;
      }
      // Chest and head pain are already covered by dedicated rules above.
      if ((region === 'Left Chest / Precordium' && seen.has('voice:chest_pain')) || (region === 'Head' && seen.has('voice:headache'))) continue;
      const genericKey = region.replace(/^(Left|Right) /, '');
      const placeEn = sideKnown ? regionName(region, 'en') : GENERIC_PART[genericKey]?.en || regionName(region, 'en');
      const placeLocal = sideKnown ? regionName(region, code) : GENERIC_PART[genericKey]?.[code] || regionName(region, code);
      push({
        key: `voice:pain:${sideKnown ? region : genericKey}`,
        name: `Pain — ${placeEn}`,
        symptom_name: `Pain — ${placeEn}`,
        labelLocal: `${placeLocal} · ${PAIN_LABEL[code]}`,
        site: sideKnown ? region : `${placeEn} (side not stated)`,
        onset: duration || '',
        character: '',
        radiation: '',
        associations: [],
        timing: '',
        exacerbatingFactors: [],
        relievingFactors: [],
        severityScore: severityAt(painAt),
        source: 'voice'
      });
    }
  }

  return { symptoms: out, hasEmergency: out.some(s => s.isEmergency), duration };
};

/**
 * On-device findings combined with the speech service's re-check decodes of the same recording (speed-perturbed
 * copies make different mistakes in noise). A symptom heard in a re-check is added unless the main transcript
 * explicitly denies it ("बुखार नहीं है" wins over a re-check that lost the "नहीं"); the patient confirms the list.
 */
export const extractWithRechecks = (text: string, rechecks: string[], lang?: string): SpeechFindings => {
  const main = extractSymptomsFromSpeech(text, lang);
  if (!rechecks.length) return main;
  const denied = new Set(RULES.filter(r => {
    const g = new RegExp(r.patterns.source, r.patterns.flags.includes('g') ? r.patterns.flags : `${r.patterns.flags}g`);
    const ms = [...text.matchAll(g)];
    return ms.length > 0 && ms.every(m => negationAt(text, m.index!, m.index! + m[0].length).negated);
  }).map(r => `voice:${r.key}`));
  const keys = new Set(main.symptoms.map(s => s.key));
  const symptoms = [...main.symptoms];
  let duration = main.duration;
  for (const alt of rechecks) {
    const f = extractSymptomsFromSpeech(alt, lang);
    duration ||= f.duration;
    for (const s of f.symptoms) {
      if (!s.key || keys.has(s.key) || denied.has(s.key)) continue;
      keys.add(s.key);
      symptoms.push({ ...s, onset: s.onset || duration || '' });
    }
  }
  return { symptoms, hasEmergency: symptoms.some(s => s.isEmergency), duration };
};

/**
 * Best guess of the body region the patient talked about (used to suggest an area).
 * `sideKnown` is false for limbs mentioned without "left"/"right"; `genericLabel` then names the limb
 * without a side, e.g. "हाथ".
 */
export const detectRegionFromSpeech = (text: string, lang?: string): { region: string; sideKnown: boolean; genericLabel?: string } | null => {
  const code = normalizeLang(lang);
  for (const part of BODY_PARTS) {
    if (!part.patterns.test(text)) continue;
    if (!part.lateral) return { region: part.region, sideKnown: true };
    const right = RIGHT_WORDS.test(text) && !LEFT_WORDS.test(text);
    const left = LEFT_WORDS.test(text) && !RIGHT_WORDS.test(text);
    const genericKey = part.region.replace(/^(Left|Right) /, '');
    if (right) return { region: part.region.replace('Left', 'Right'), sideKnown: true };
    if (left) return { region: part.region, sideKnown: true };
    return { region: part.region, sideKnown: false, genericLabel: GENERIC_PART[genericKey]?.[code] };
  }
  return null;
};
