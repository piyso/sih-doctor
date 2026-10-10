/**
 * Hindi wording and source tracing for the physician-ready history summary (clinicalHistory.service.ts).
 *
 * No model translates anything here. Every Hindi phrase is a lookup in a fixed table:
 *   1. the kiosk's own Hindi labels (data/kiosk_labels_hi.json, generated from the kiosk catalog by
 *      scripts/sync-kiosk-labels.ts), so a tapped complaint is summarised in the words the patient saw;
 *   2. the tables below, for the names the speech parser emits, body areas, durations and qualifiers.
 *
 * A term with no entry is kept exactly as it was recorded — never guessed — and listed in `untranslated`,
 * so a missing label is visible. tests/no_llm_guarantee.test.ts requires an entry for everything the parser
 * and the kiosk can produce. Medicine names and allergy agents are never translated: the prescriber must
 * see what was written.
 */

import kioskLabels from '../data/kiosk_labels_hi.json';
import { SummarySource } from '../shared/types';
import { clauseAt, findPhrase, negationAt, sentenceAt, tokens } from './clinicalText';
import { ConceptMention, conceptMentions, extractConcepts } from './clinicalLexicon';

const KIOSK = kioskLabels as { symptoms: Record<string, string>; regions: Record<string, string>; characters: Record<string, string>; durations: Record<string, string> };

// ---------------------------------------------------------------- Symptom names the speech parser emits
const SYMPTOM_HI: Record<string, string> = {
  'Abdominal Colic / Shoola': 'पेट में मरोड़ (उदरशूल)',
  'Abdominal Discomfort': 'पेट में तकलीफ़',
  'Abdominal Distension / Aanaha': 'पेट फूलना (आनाह)',
  'Abdominal Flatulence / Aanaha': 'पेट में गैस (आनाह)',
  'Abdominal Pain': 'पेट में दर्द',
  'Acid Eructation / Amlodgara': 'खट्टी डकार (अम्लोद्गार)',
  'Anorexia / Loss of Appetite': 'भूख न लगना',
  'Anxiety / Ghabrahat': 'घबराहट',
  'Arm / Hand Pain': 'हाथ या बाँह में दर्द',
  'Arm Pain': 'बाँह में दर्द',
  'Bleeding Per Vagina / Rectum': 'योनि या मलद्वार से खून आना',
  'Burning Feet / Pada Daha': 'पैरों में जलन (पाद दाह)',
  'Calf Muscle Cramps / Pindikodveshtana': 'पिंडली में ऐंठन (पिंडिकोद्वेष्टन)',
  'Chest Discomfort': 'सीने में तकलीफ़',
  'Chest Pain': 'सीने में दर्द',
  'Chills / Rigors': 'ठंड लगना / कंपकंपी',
  'Cold Diaphoresis': 'ठंडा पसीना',
  'Common Cold / Coryza (Pratishyaya)': 'सर्दी-ज़ुकाम (प्रतिश्याय)',
  'Constipation': 'कब्ज़',
  'Cough': 'खाँसी',
  'Cough / Kasa': 'खाँसी (कास)',
  'Dermatitis / Rash': 'त्वचा पर चकत्ते',
  'Diaphoresis': 'पसीना आना',
  'Diarrhea': 'दस्त',
  'Difficulty Passing Urine / Mutrakrichra': 'पेशाब करने में कठिनाई (मूत्रकृच्छ्र)',
  'Drowsiness / Lethargy (Tandra)': 'सुस्ती / नींद-सी रहना (तंद्रा)',
  'Dry Cough': 'सूखी खाँसी',
  'Dyspnea': 'साँस फूलना',
  'Dyspnea / Shortness of Breath': 'साँस फूलना',
  'Dyspnea / Shwasa': 'साँस फूलना (श्वास)',
  'Dysuria / Burning Micturition': 'पेशाब में जलन',
  'Ear Pain / Discharge': 'कान में दर्द या बहना',
  'Epistaxis': 'नाक से खून आना (नकसीर)',
  'Eye Pain / Redness': 'आँख में दर्द या लाली',
  'Fever': 'बुखार',
  'Fever / Jwara': 'बुखार (ज्वर)',
  'Fever with Chills': 'ठंड लगकर बुखार',
  'Fistula-in-Ano / Bhagandara': 'भगंदर',
  'Flatulence / Aanaha': 'पेट में गैस (आनाह)',
  'Foot / Leg Wound or Ulcer (Vrana)': 'पैर में घाव या छाला (व्रण)',
  'Gastrointestinal Disturbance': 'पेट की गड़बड़ी',
  'General Weakness / Asthenia': 'कमज़ोरी',
  'Generalized Bodyache / Angamarda': 'बदन दर्द (अंगमर्द)',
  'Headache': 'सिर दर्द',
  'Hearing Loss': 'कम सुनाई देना',
  'Heartburn / Acidity / Dyspepsia': 'सीने में जलन / एसिडिटी',
  'Heartburn / Acidity / GERD': 'सीने में जलन / एसिडिटी',
  'Hematemesis': 'उल्टी में खून',
  'Hematochezia / Rectal Bleeding': 'मल में खून',
  'Hematuria': 'पेशाब में खून',
  'Hemoptysis': 'खाँसी में खून',
  'Hemorrhoids / Arsha': 'बवासीर (अर्श)',
  'Hoarseness of Voice': 'आवाज़ बैठना',
  'Insomnia / Anidra': 'नींद न आना (अनिद्रा)',
  'Janu Sandhi Crepitus': 'घुटने में कट-कट की आवाज़',
  'Joint Inflammation / Sandhishotha': 'जोड़ों में सूजन (संधिशोथ)',
  'Joint Pain / Arthralgia': 'जोड़ों में दर्द',
  'Joint Pain / Sandhivata': 'जोड़ों में दर्द (संधिवात)',
  'Joint Stiffness / Stambha': 'जोड़ों में जकड़न (स्तंभ)',
  'Knee Joint Pain': 'घुटने में दर्द',
  'Left Lower Quadrant Renal Pain': 'पेट के निचले बाएँ हिस्से में दर्द (गुर्दे की ओर)',
  'Leg / Foot Pain': 'पैर में दर्द',
  'Leg / Foot Swelling': 'पैर में सूजन',
  'Lethargy / Tandra': 'सुस्ती (तंद्रा)',
  'Low Back Pain / Kati Shoola': 'कमर दर्द (कटिशूल)',
  'Low Mood': 'मन उदास रहना',
  'Lower Abdominal / Pelvic Pain': 'पेट के निचले हिस्से (पेडू) में दर्द',
  'Lower Back Pain': 'कमर दर्द',
  'Marked Diaphoresis': 'बहुत पसीना आना',
  'Migraine / Ardhavabhedaka': 'माइग्रेन (अर्धावभेदक)',
  'Morning Stiffness / Stambha': 'सुबह की जकड़न (स्तंभ)',
  'Muscle Cramps / Pindikodveshtana': 'मांसपेशियों में ऐंठन (पिंडिकोद्वेष्टन)',
  'Nausea / Hrillasa': 'जी मिचलाना (हृल्लास)',
  'Neck Pain': 'गर्दन में दर्द',
  'Numbness / Tingling': 'सुन्नपन / झुनझुनी',
  'Palpitations': 'धड़कन तेज़ होना',
  'Palpitations / Anxiety': 'धड़कन तेज़ होना / घबराहट',
  'Pelvic / Hypogastric Pain': 'पेडू में दर्द',
  'Pharyngeal Irritation / Kantharoga': 'गले में खराश (कंठरोग)',
  'Pharyngitis': 'गले में सूजन व दर्द',
  'Polydipsia / Pipasa': 'बहुत प्यास लगना (पिपासा)',
  'Polyuria / Prabhutamutrata': 'बार-बार पेशाब आना (प्रभूतमूत्रता)',
  'Productive Cough': 'बलगम वाली खाँसी',
  'Pruritus / Itching': 'खुजली',
  'Renal Calculi Colic / Ashmari': 'पथरी का दर्द (अश्मरी)',
  'Right Lower Quadrant Appendicitis Pain': 'पेट के निचले दाएँ हिस्से में दर्द (अपेंडिक्स की ओर)',
  'Sciatica / Gridhrasi': 'सायटिका (गृध्रसी)',
  'Sciatica / Neuralgia': 'सायटिका / नस का दर्द',
  'Severe Arm / Hand Pain': 'हाथ या बाँह में तेज़ दर्द',
  'Shoulder Pain': 'कंधे में दर्द',
  'Skin Eruptions': 'त्वचा पर दाने',
  'Skin Eruptions / Rash': 'त्वचा पर दाने या चकत्ते',
  'Sore Throat': 'गले में खराश',
  'Substernal Crushing Pressure': 'सीने में भारीपन / दबाव',
  'Swelling': 'सूजन',
  'Tinnitus': 'कान में आवाज़ आना',
  'Toothache': 'दाँत में दर्द',
  'Tremor': 'कंपन / हाथ काँपना',
  'Umbilical Colic / Nabhi Shula': 'नाभि के पास मरोड़ (नाभिशूल)',
  'Upper Abdominal Pain / Gastric Dyspepsia': 'पेट के ऊपरी हिस्से में दर्द',
  'Urinary Retention / Mutrakrichra': 'पेशाब रुकना (मूत्रकृच्छ्र)',
  'Vertigo / Giddiness': 'चक्कर आना',
  'Vomiting': 'उल्टी',
  'Wheezing / Stridor': 'साँस में सीटी की आवाज़',
  'Wound / Ulcer (Vrana)': 'घाव या छाला (व्रण)',
  'Wrist Pain': 'कलाई में दर्द'
};

// ---------------------------------------------------------------- Body areas
/** '' = a whole-body or bookkeeping label that adds nothing to the sentence, so it is left out. */
const SITE_HI: Record<string, string> = {
  'General': '', 'Systemic': '', 'Unspecified': '', 'Bleeding': '', 'GI': '', 'CNS': '', 'Psychoneurological': '',
  'Abdomen': 'पेट', 'Anorectal': 'गुदा', 'Arm': 'बाँह', 'Arm & Hand': 'हाथ व बाँह', 'Calf / Lower Extremity': 'पिंडली / पैर',
  'Chest': 'सीना', 'Chest / Bronchi': 'सीना / श्वास नली', 'Chest / Lungs': 'सीना / फेफड़े', 'Ear': 'कान', 'Epigastrium': 'ऊपरी पेट',
  'Eye': 'आँख', 'Flank': 'कमर का बगल', 'Head': 'सिर', 'Head / Forehead': 'सिर / माथा', 'Head / Unilateral': 'आधा सिर',
  'Joints': 'जोड़', 'Knee': 'घुटना', 'Knees': 'घुटने', 'Left Lower Quadrant (LLQ)': 'पेट का बायाँ निचला भाग', 'Leg': 'पैर',
  'Leg & Foot': 'पैर व पंजा', 'Lower Extremity': 'पैर', 'Lower GI': 'निचली आँत', 'Lumbar': 'कमर', 'Lumbar Spine': 'कमर',
  'Lumbar Spine to Leg': 'कमर से पैर तक', 'Lumbosacral / Lower Limb': 'कमर / पैर', 'Neck': 'गर्दन', 'Nose': 'नाक',
  'Pelvic / Hypogastrium': 'पेडू', 'Pelvis': 'पेडू', 'Perianal': 'गुदा के आसपास', 'Peripheral': 'हाथ-पैर', 'Pharynx': 'गला',
  'Precordium': 'हृदय के ऊपर', 'Respiratory': 'श्वसन तंत्र', 'Respiratory tract': 'श्वसन तंत्र',
  'Retrosternal / Epigastrium': 'सीने के बीच / ऊपरी पेट', 'Right Lower Quadrant (RLQ)': 'पेट का दायाँ निचला भाग',
  'Shoulder': 'कंधा', 'Skin': 'त्वचा', 'Substernal': 'सीने के बीच', 'Teeth': 'दाँत', 'Throat': 'गला', 'Throat / Bronchi': 'गला / श्वास नली',
  'Umbilicus / Mid-Abdomen': 'नाभि के पास', 'Urethra': 'मूत्र मार्ग', 'Urinary tract': 'मूत्र मार्ग', 'Wrist': 'कलाई'
};

// ---------------------------------------------------------------- Qualifiers read from speech (clinicalText.ts labels)
const RADIATION_HI: Record<string, string> = {
  'Left arm': 'बाएँ हाथ', 'Right arm': 'दाएँ हाथ', 'Jaw': 'जबड़े', 'Neck': 'गर्दन', 'Shoulder': 'कंधे', 'Back': 'पीठ', 'Leg': 'पैर',
  'Arm': 'हाथ', 'Lower back': 'कमर', 'Ear': 'कान', 'Head': 'सिर', 'Groin': 'जाँघ के जोड़', 'Abdomen': 'पेट'
};
const WORSE_HI: Record<string, string> = {
  'Exertion': 'चलने या मेहनत करने पर', 'After food': 'खाने के बाद', 'Bending / lifting': 'झुकने या वज़न उठाने पर',
  'Lying down': 'लेटने पर', 'Coughing': 'खाँसने पर', 'Cold': 'ठंड में'
};
const BETTER_HI: Record<string, string> = { 'Rest': 'आराम करने से', 'Medicine': 'दवा से', 'Food': 'खाना खाने से' };
const TIMING_HI: Record<string, string> = {
  'Night': 'रात में', 'Morning': 'सुबह', 'Evening': 'शाम को', 'Intermittent': 'रुक-रुक कर', 'Continuous': 'लगातार',
  'Sudden': 'अचानक शुरू', 'Gradual': 'धीरे-धीरे शुरू'
};

// ---------------------------------------------------------------- Durations
const DURATION_HI: Record<string, string> = {
  'since today': 'आज से', 'since this morning': 'आज सुबह से', 'since last night': 'कल रात से', 'since yesterday': 'कल से',
  'since childhood': 'बचपन से', 'long-standing': 'लंबे समय से',
  '2–3 days': '2–3 दिन से', 'about a week': 'लगभग एक हफ़्ते से', '1 month or more': 'एक महीने या उससे अधिक समय से'
};
// With the postposition "से" Hindi uses the oblique form: "1 हफ़्ते से", "कुछ दिनों से".
const UNIT_HI: Record<string, [counted: string, few: string]> = {
  minute: ['मिनट', 'मिनटों'], hour: ['घंटे', 'घंटों'], day: ['दिन', 'दिनों'], week: ['हफ़्ते', 'हफ़्तों'], month: ['महीने', 'महीनों'], year: ['साल', 'सालों']
};

/** "3 days" → "3 दिन से", "a few weeks" → "कुछ हफ़्तों से", "since last night" → "कल रात से"; null when not a known form. */
export function durationHi(onset: string): string | null {
  const o = (onset || '').trim();
  if (!o) return null;
  const fixed = DURATION_HI[o.toLowerCase()];
  if (fixed) return fixed;
  let m = o.match(/^(\d+(?:\.\d+)?)\s+(minute|hour|day|week|month|year)s?$/i);
  if (m) return `${m[1]} ${UNIT_HI[m[2].toLowerCase()][0]} से`;
  m = o.match(/^a few (minute|hour|day|week|month|year)s$/i);
  if (m) return `कुछ ${UNIT_HI[m[1].toLowerCase()][1]} से`;
  return KIOSK.durations[o] || null;
}

// ---------------------------------------------------------------- Long-standing illnesses, relations, statuses
const CONDITION_HI: Record<string, string> = {
  'Diabetes': 'मधुमेह (शुगर)', 'Type 2 Diabetes Mellitus': 'मधुमेह (शुगर)', 'Hypertension': 'उच्च रक्तचाप (बीपी)', 'Essential Hypertension': 'उच्च रक्तचाप (बीपी)',
  'Heart disease': 'हृदय रोग', 'Coronary Artery Disease': 'हृदय की धमनी का रोग', 'Asthma / COPD': 'दमा / सीओपीडी', 'Bronchial Asthma': 'दमा',
  'Thyroid disorder': 'थायराइड की बीमारी', 'Hypothyroidism': 'थायराइड की कमी', 'Kidney disease': 'गुर्दे की बीमारी', 'Chronic Kidney Disease': 'गुर्दे की पुरानी बीमारी',
  'Liver disease': 'लिवर की बीमारी', 'Tuberculosis': 'टीबी (क्षय रोग)', 'Pulmonary Tuberculosis': 'फेफड़ों की टीबी', 'Epilepsy': 'मिर्गी', 'Stroke': 'लकवा (स्ट्रोक)', 'Cancer': 'कैंसर'
};
const RELATION_HI: Record<string, string> = {
  'father': 'पिता', 'mother': 'माता', 'brother': 'भाई', 'sister': 'बहन', 'son': 'बेटा', 'daughter': 'बेटी', 'grandfather': 'दादा / नाना',
  'grandmother': 'दादी / नानी', 'parent': 'माता-पिता', 'sibling': 'भाई-बहन', 'first-degree relative': 'निकट संबंधी'
};
const STATUS_HI: Record<string, string> = {
  active: 'जारी', resolved: 'ठीक हो चुका', controlled: 'नियंत्रित', uncontrolled: 'अनियंत्रित',
  regular: 'नियमित', irregular: 'अनियमित', stopped: 'बंद कर दी', mild: 'हल्की', moderate: 'मध्यम', severe: 'गंभीर'
};

const GENDER_HI: Record<string, string> = { male: 'पुरुष', female: 'महिला', other: 'अन्य' };
const DOC_TYPE_HI: Record<string, string> = {
  OLD_PRESCRIPTION: 'पुराना पर्चा', LAB_REPORT: 'जाँच रिपोर्ट', DISCHARGE_SUMMARY: 'डिस्चार्ज सारांश', OTHER: 'दस्तावेज़', UNKNOWN: 'दस्तावेज़'
};
const FLAG_HI: Record<string, string> = { HIGH: 'अधिक', LOW: 'कम', abnormal: 'असामान्य' };
// Dashavidha Pariksha answers are Sanskrit terms stored in Roman letters; each word is written back in Devanagari.
const AYUSH_WORD_HI: Record<string, string> = {
  vata: 'वात', pitta: 'पित्त', kapha: 'कफ', tridosha: 'त्रिदोष', sama: 'सम',
  mandagni: 'मंदाग्नि', tikshnagni: 'तीक्ष्णाग्नि', vishamagni: 'विषमाग्नि', samagni: 'समाग्नि',
  krura: 'क्रूर', mridu: 'मृदु', madhya: 'मध्य', madhyama: 'मध्यम', pravara: 'प्रवर', avara: 'अवर',
  high: 'अधिक', medium: 'मध्यम', low: 'कम', provisional: 'प्रारंभिक', screen: 'जाँच', present: 'उपस्थित', absent: 'अनुपस्थित'
};

// ---------------------------------------------------------------- Lookups
/** Records every term that had no Hindi entry, so callers and tests can see exactly what was left as recorded. */
export class HindiTerms {
  readonly untranslated = new Set<string>();
  gender(g: string): string { return this.term(GENDER_HI, (g || '').toLowerCase()); }
  docType(t: string): string { return DOC_TYPE_HI[(t || '').toUpperCase()] || DOC_TYPE_HI.OTHER; }
  flag(f: string): string { return FLAG_HI[f] || FLAG_HI[(f || '').toUpperCase()] || FLAG_HI.abnormal; }
  /** "Vata-Pitta" → "वात-पित्त", "Mandagni" → "मंदाग्नि"; a word with no entry stays as written. */
  ayush(value: string): string {
    return String(value ?? '').replace(/[A-Za-z]+/g, w => {
      const hit = AYUSH_WORD_HI[w.toLowerCase()];
      if (!hit) this.untranslated.add(w);
      return hit || w;
    });
  }
  /** A known complaint or condition name in Hindi; free text (a typed chief complaint) is returned untouched. */
  known(text: string): string {
    const v = (text || '').trim();
    return KIOSK.symptoms[v] ?? SYMPTOM_HI[v] ?? CONDITION_HI[v] ?? v;
  }
  /** "5 years" → "5 साल से", "2015" → "2015 से". */
  since(v: string): string { return durationHi(v) || `${v} से`; }
  private term(table: Record<string, string>, value: string, alt?: Record<string, string>): string {
    const v = (value || '').trim();
    const hit = table[v] ?? alt?.[v];
    if (hit !== undefined) return hit;
    // already written in an Indian script (a patient's or clinician's own words): nothing to translate
    if (v && !/[A-Za-z]/.test(v)) return v;
    if (v) this.untranslated.add(v);
    return v;
  }
  /** A comma-separated list of labels ("Night, Intermittent"). */
  private list(table: Record<string, string>, value: string): string {
    return (value || '').split(/,\s*/).filter(Boolean).map(x => this.term(table, x)).join(', ');
  }
  /** A complaint name; a tapped body area with no named complaint is stored under the area's own name. */
  symptom(name: string): string { return KIOSK.regions[(name || '').trim()] || this.term(KIOSK.symptoms, name, SYMPTOM_HI); }
  condition(name: string): string { return this.term(CONDITION_HI, name); }
  relation(name: string): string { return this.term(RELATION_HI, (name || '').toLowerCase()); }
  status(name: string): string { return this.term(STATUS_HI, name); }
  character(name: string): string { return this.term(KIOSK.characters, name); }
  /** A body area; "Left Knee" style kiosk areas come from the kiosk's own names. '' when it adds nothing. */
  site(name: string): string { return this.term(KIOSK.regions, name, SITE_HI); }
  radiation(v: string): string { return this.list(RADIATION_HI, v); }
  worse(v: string): string { return this.list(WORSE_HI, v); }
  better(v: string): string { return this.list(BETTER_HI, v); }
  timing(v: string): string { return this.list(TIMING_HI, v); }

  /**
   * One complaint as a Hindi line, in the same order as the English one:
   * name → where → since when → character → where it spreads → severity → timing → worse / better → with.
   */
  symptomLine(s: any): string {
    const rawName = s.name || s.symptom_name || '';
    const name = rawName ? this.symptom(rawName) : 'शिकायत';
    const parts = [name];
    if (s.site && !/^(general|unspecified)$/i.test(s.site)) {
      const site = this.site(s.site);
      // "पेट में दर्द (पेट)" says the place twice: skip the area when the complaint's own name already names it
      const head = site.split(/[\s/,]+/).find(w => w.length > 1) || '';
      if (site && !(head && name.includes(head.replace(/[ाेीोंँ]+$/u, '')))) parts.push(`(${site})`);
    }
    if (s.onset && !/unspecified/i.test(s.onset)) {
      const d = durationHi(s.onset);
      if (d) parts.push(d); else { parts.push(`शुरुआत: ${s.onset}`); if (/[A-Za-z]/.test(s.onset)) this.untranslated.add(s.onset); }
    }
    if (s.character) parts.push(`(${this.character(s.character)})`);
    if (s.radiation) parts.push(`${this.radiation(s.radiation)} तक फैलता है`);
    const sev = Number(s.severityScore ?? s.severity);
    if ((s.severityScore !== undefined || s.severity !== undefined) && Number.isFinite(sev) && sev > 0) parts.push(`तीव्रता ${sev}/10`);
    if (s.timing) parts.push(`समय: ${this.timing(s.timing)}`);
    if (s.exacerbating) parts.push(`${this.worse(s.exacerbating)} बढ़ता है`);
    if (s.relieving) parts.push(`${this.better(s.relieving)} आराम`);
    if (Array.isArray(s.associated) && s.associated.length) parts.push(`साथ में: ${s.associated.map((a: string) => this.symptom(a)).join(', ')}`);
    return parts.join(', ').replace(/, \(/g, ' (');
  }
}

// ---------------------------------------------------------------- Where each line came from
const HISTORY_FROM: Record<string, SummarySource['from']> = { patient: 'kiosk', document: 'document', clinician: 'staff', asha: 'asha' };
export const historySource = (item: string, source?: string): SummarySource => ({ item, from: (source && HISTORY_FROM[source]) || 'record' });

/** At most this many words on each side of the complaint's own words are quoted. */
const QUOTE_REACH = 6;
// Hindi is verb-final and a recogniser writes no punctuation, so "… है" is where one statement ends and the next begins.
const STATEMENT_END = new Set(['है', 'हैं', 'हूँ', 'हूं', 'था', 'थी', 'थे', 'hai', 'hain', 'hoon', 'hun', 'tha', 'thi', 'the']);
const JOINER = new Set(['और', 'aur', 'and', 'या', 'ya', 'or', 'तथा']);

/** The complaint's words with a few neighbours, never reaching into the statement before or after it. */
function quoteAround(text: string, from: number, to: number): string {
  const [ca, cb] = clauseAt(text, from);
  const toks = tokens(text).filter(t => !t.punct && t.start >= ca && t.end <= Math.max(cb, to));
  let a = toks.findIndex(t => t.end > from);
  if (a < 0) return text.slice(from, to);
  let b = a;
  while (b < toks.length - 1 && toks[b + 1].start < to) b++;
  for (let n = 0; n < QUOTE_REACH && a > 0 && !STATEMENT_END.has(toks[a - 1].norm) && !JOINER.has(toks[a - 1].norm); n++) a--;
  for (let n = 0; n < QUOTE_REACH && b < toks.length - 1 && !JOINER.has(toks[b + 1].norm); n++) { b++; if (STATEMENT_END.has(toks[b].norm)) break; }
  return text.slice(toks[a].start, toks[b].end);
}

/**
 * The words to quote for a finding at [from, to). For a denial the quote must show the denying word itself
 * ("उल्टी और दस्त नहीं हैं", "denies chest pain and shortness of breath"), so it widens to the clause and then the
 * sentence until it does; if even the sentence does not hold it, nothing is quoted.
 */
function evidence(text: string, from: number, to: number, denied: boolean): string | undefined {
  const tight = quoteAround(text, from, to).trim();
  const cue = denied ? negationAt(text, from, to).cue : undefined;
  if (!cue || cue === 'resolved') return tight ? tight.slice(0, 160) : undefined;
  const shows = (q: string) => q.toLowerCase().includes(cue.toLowerCase());
  if (shows(tight)) return tight.slice(0, 160);
  for (const [a, b] of [clauseAt(text, from), sentenceAt(text, from)]) {
    const wider = text.slice(a, b).trim();
    if (wider.length <= 160 && shows(wider)) return wider;
  }
  return undefined;
}

/**
 * The patient's own words for a complaint, cut from the transcript — or undefined when they cannot be located
 * with certainty (a quote is evidence, so nothing is quoted on a guess).
 *   1. the recorded words, when they are in the transcript letter for letter;
 *   2. otherwise the words that carry the same concept in the clinical lexicon (the lexicon matches by sound, so
 *      "बुखार", "bukhar" and a recogniser's "बुखाल" all count), with the same yes/no sense, and — when the
 *      complaint names a body area — that area said in the same clause.
 */
function quoteFor(symptom: any, transcript: string, mentions: ConceptMention[]): string | undefined {
  if (!transcript) return undefined;
  const words = typeof symptom.rawVernacular === 'string' ? symptom.rawVernacular.trim() : '';
  const verbatim = words ? findPhrase(transcript, words, { suffix: 3 })[0] : undefined;
  const denied = !!symptom.isNegated;
  if (verbatim) return evidence(transcript, verbatim[0], verbatim[1], denied);

  const wanted = extractConcepts(`${words} ${symptom.name || symptom.symptom_name || ''}`, { ignoreNegation: true, keepResolved: true });
  const findings = [...wanted].filter(c => c.startsWith('F_'));
  const sites = [...wanted].filter(c => c.startsWith('S_'));
  if (!findings.length && !sites.length) return undefined;
  for (const m of mentions) {
    if (m.historical || !!m.negated !== denied) continue;
    if (!m.concepts.some(c => (findings.length ? findings : sites).includes(c))) continue;
    let from = m.start, to = m.end;
    if (findings.length && sites.length && !m.concepts.some(c => sites.includes(c))) {
      const [ca, cb] = clauseAt(transcript, m.start);
      const site = mentions.find(x => x.start >= ca && x.start < cb && x.concepts.some(c => sites.includes(c)));
      if (!site) continue; // the same finding somewhere else in the body is a different complaint
      from = Math.min(from, site.start); to = Math.max(to, site.end);
    }
    const quote = evidence(transcript, from, to, denied);
    if (quote) return quote;
  }
  return undefined;
}

/** One source per complaint: the patient's words when it was spoken, otherwise how it reached the record. */
export function symptomSources(symptoms: any[], rawTranscript?: string | null): SummarySource[] {
  const transcript = typeof rawTranscript === 'string' ? rawTranscript : '';
  const mentions = transcript ? conceptMentions(transcript) : [];
  return (symptoms || []).filter(Boolean).map(s => {
    const name = s.name || s.symptom_name || 'Complaint';
    const item = s.isNegated ? `Denies: ${name}` : name;
    const quote = quoteFor(s, transcript, mentions);
    if (quote) return { item, from: 'speech' as const, quote };
    if (s.source === 'voice' || s.source === 'parser') return { item, from: 'speech' as const };
    if (s.source === 'chip' || s.source === 'area') return { item, from: 'kiosk' as const };
    return { item, from: 'record' as const };
  });
}
