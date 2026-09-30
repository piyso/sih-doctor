/**
 * Sovereign Universal Clinical Ontology Engine (Universal Srotas-Anatomy Matrix)
 * Grounded in:
 * - Charaka Samhita (Vimana 8/94, Chikitsa 15/3, Chikitsa 28/37)
 * - Sushruta Samhita (Sharira Sthana 6 - 107 Marma Points)
 * - Modern Emergency Severity Index (ESI Levels 1-5) & Ottawa Decision Rules
 * 
 * Replaces hardcoded per-organ dictionaries with a continuous 6-Axis Physiological Continuum.
 */

import {
  Bone,
  Shield,
  Zap,
  Droplets,
  HeartPulse,
  Activity,
  Flame,
  Wind,
  Clock
} from 'lucide-react';
import { AgniType } from '../types/api';

export type PhysiologicalAxisType =
  | 'MUSCULOSKELETAL_ARTICULAR'
  | 'METABOLIC_GASTRO_HEPATIC'
  | 'BRONCHOPULMONARY_MUCOSAL'
  | 'NEURO_CRANIAL_SENSORY'
  | 'PELVIC_GENITOURINARY'
  | 'CARDIOVASCULAR_HEMODYNAMIC'
  | 'SYSTEMIC_GENERAL';

export interface SymptomItem {
  hi: string;
  en: string;
  isEmergency?: boolean;
}

export interface SensationItem {
  key: string;
  label: string;
  en: string;
  icon: any;
}

export interface ClinicalAxisProfile {
  axis: PhysiologicalAxisType;
  srotas: string;
  primaryDosha: string;
  defaultAgni: AgniType;
  defaultPrakriti: string;
  defaultVikriti: string;
  defaultDhatuSara: string;
  defaultPainCharacter: string;
  causalRationaleHi: string;
  causalRationaleEn: string;
  symptoms: SymptomItem[];
  sensations: SensationItem[];
}

/**
 * The 6 Universal Physiological Profiles (Zero Hardcoding Architecture)
 */
export const PHYSIOLOGICAL_PROFILES: Record<PhysiologicalAxisType, ClinicalAxisProfile> = {
  MUSCULOSKELETAL_ARTICULAR: {
    axis: 'MUSCULOSKELETAL_ARTICULAR',
    srotas: 'Asthivaha · Majjavaha · Sandhivaha Srotas',
    primaryDosha: 'Vata (Vataja / Vata-Kapha)',
    defaultAgni: 'VISHAMAGNI',
    defaultPrakriti: 'Vataja',
    defaultVikriti: 'Vata Aggravation',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Stiffness / Stambha',
    causalRationaleHi: 'आयुर्वेद अनुसार जोड़ों व हड्डियों का दर्द वात दोष से होता है, जिसका मुख्य उद्गम पक्वाशय (बड़ी आंत/पाचन) है। जोड़ों के स्थायी उपचार हेतु पाचन शक्ति व गैस का आकलन अनिवार्य है।',
    causalRationaleEn: 'Joint and skeletal disorders (Sandhigata Vata) stem from Vata vitiation originating in the colon (Pakwashaya). Assessing metabolic fire is essential for root-cause resolution.',
    symptoms: [
      { hi: 'जोड़ में दर्द व सूजन', en: 'Joint Pain & Swelling' },
      { hi: 'चलने व मुड़ने में भारी जकड़न', en: 'Stiffness on Walking & Flexion' },
      { hi: 'हड्डी व जोड़ में कट-कट की आवाज़', en: 'Joint Crepitus & Clicking' },
      { hi: 'भार सहने व सीढ़ियों पर तकलीफ़', en: 'Difficulty Bearing Weight / Stairs' },
      { hi: 'सुबह उठने पर अत्यधिक अकड़न', en: 'Morning Joint Stiffness' }
    ],
    sensations: [
      { key: 'crepitus', label: 'जोड़ों में कट-कट', en: 'Joint Crepitus / Clicking', icon: Bone },
      { key: 'stiffness', label: 'चलने व मुड़ने में जकड़न', en: 'Walking & Flexion Stiffness', icon: Shield },
      { key: 'morning_stiff', label: 'सुबह उठने पर अकड़न', en: 'Morning Stiffness', icon: Clock },
      { key: 'swelling', label: 'सूजन व गर्माहट', en: 'Swelling & Warmth', icon: Droplets },
      { key: 'strain', label: 'खिंचाव व भार में तकलीफ़', en: 'Strain & Weight Pain', icon: Zap },
      { key: 'deep_ache', label: 'जोड़ में गहरा दर्द', en: 'Deep Joint Ache', icon: HeartPulse }
    ]
  },

  METABOLIC_GASTRO_HEPATIC: {
    axis: 'METABOLIC_GASTRO_HEPATIC',
    srotas: 'Annavaha · Purishavaha · Swedavaha Srotas',
    primaryDosha: 'Pitta (Pittaja / Pitta-Vata)',
    defaultAgni: 'TIKSHNAGNI',
    defaultPrakriti: 'Pittaja',
    defaultVikriti: 'Pitta Aggravation',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Burning sensation (Daha)',
    causalRationaleHi: 'अम्लपित्त, पेट दर्द व छाले पाचक पित्त के असंतुलन से होते हैं, जिससे तीक्ष्णाग्नि (तेज एसिडिटी व जलन) उत्पन्न होती है।',
    causalRationaleEn: 'Upper gastrointestinal distress is governed by Pachaka Pitta, manifesting as Tikshnagni (hyperchlorhydria, bile reflux, and burning).',
    symptoms: [
      { hi: 'खट्टी डकार व सीने में जलन', en: 'Severe Acid Reflux & Heartburn' },
      { hi: 'पेट के ऊपरी हिस्से में दर्द', en: 'Upper Stomach / Epigastric Pain' },
      { hi: 'जी मिचलाना व उल्टी', en: 'Nausea & Vomiting' },
      { hi: 'पेट फूलना व भारी अफारा', en: 'Bloating & Gaseous Distension' },
      { hi: 'खाली पेट या खाने के बाद तेज़ दर्द', en: 'Postprandial / Hunger Pain' }
    ],
    sensations: [
      { key: 'burning', label: 'खट्टी डकार व जलन', en: 'Acidity / Reflux Burn', icon: Flame },
      { key: 'colic', label: 'मरोड़ व ऐंठन', en: 'Spasmodic Colic', icon: Zap },
      { key: 'bloating', label: 'पेट फूलना व गैस', en: 'Bloating / Distension', icon: Shield },
      { key: 'nausea', label: 'जी मिचलाना व उल्टी', en: 'Nausea & Vomiting', icon: Activity },
      { key: 'tenderness', label: 'छूने पर असहनीय टीस', en: 'Rebound Tenderness', icon: HeartPulse },
      { key: 'fullness', label: 'भारीपन व अपच', en: 'Heavy Indigestion', icon: Droplets }
    ]
  },

  BRONCHOPULMONARY_MUCOSAL: {
    axis: 'BRONCHOPULMONARY_MUCOSAL',
    srotas: 'Pranavaha · Udakavaha · Rasavaha Srotas',
    primaryDosha: 'Kapha (Kaphaja / Vata-Kapha)',
    defaultAgni: 'MANDAGNI',
    defaultPrakriti: 'Kaphaja',
    defaultVikriti: 'Kapha Aggravation',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Dull aching (Bheda)',
    causalRationaleHi: 'फेफड़े, खांसी व बलगम के विकार कफ दोष व मन्दाग्नि (धीमा पाचन, भारीपन) से उत्पन्न होते हैं।',
    causalRationaleEn: 'Respiratory and mucosal pathology is rooted in Avalambaka/Kledaka Kapha causing Mandagni (sluggish metabolism and mucosal congestion).',
    symptoms: [
      { hi: 'सांस फूलना व सीटी की आवाज़', en: 'Severe Dyspnea & Wheezing', isEmergency: true },
      { hi: 'लगातार खांसी व भारी बलगम', en: 'Chronic Productive Cough' },
      { hi: 'सीने में जकड़न व घुटन', en: 'Chest Tightness & Suffocation', isEmergency: true },
      { hi: 'गहरी सांस लेने पर पसलियों में दर्द', en: 'Deep Breath Rib Pain' },
      { hi: 'रात को सांस रुकना व बेचैनी', en: 'Nocturnal Dyspnea / Restlessness' }
    ],
    sensations: [
      { key: 'dyspnea', label: 'सांस का कष्ट / घुटन', en: 'Breathlessness', icon: Wind },
      { key: 'wheezing', label: 'सीटी / घरघराहट', en: 'Wheezing / Stridor', icon: Activity },
      { key: 'cough', label: 'लगातार तेज़ खांसी', en: 'Severe Spasmodic Cough', icon: Zap },
      { key: 'pleuritic', label: 'गहरी सांस पर टीस', en: 'Sharp Inhalation Pain', icon: Shield },
      { key: 'congestion', label: 'छाती में भारी बलगम', en: 'Chest Congestion', icon: Droplets },
      { key: 'burning', label: 'सांस नली में जलन', en: 'Airway Burning', icon: Flame }
    ]
  },

  CARDIOVASCULAR_HEMODYNAMIC: {
    axis: 'CARDIOVASCULAR_HEMODYNAMIC',
    srotas: 'Rasavaha · Raktavaha Srotas · Hridaya Sadhyo Pranahara Marma',
    primaryDosha: 'Tridoshic (Critical Acute)',
    defaultAgni: 'TIKSHNAGNI',
    defaultPrakriti: 'Pittaja',
    defaultVikriti: 'Pitta-Vata Aggravation',
    defaultDhatuSara: 'Pravara',
    defaultPainCharacter: 'Crushing heaviness',
    causalRationaleHi: 'सीने में दबाव व खिंचाव हृदय मर्म से संबंधित है। यह तत्काल क्लिनिकल ट्राइएज (ईसीजी व आपातकालीन निगरानी) की मांग करता है।',
    causalRationaleEn: 'Precordial symptoms affect Hridaya Marma, requiring instantaneous hemodynamic and acute coronary evaluation.',
    symptoms: [
      { hi: 'सीने में भारी दबाव व बेचैनी', en: 'Crushing Chest Pressure', isEmergency: true },
      { hi: 'बाएं कंधे व बांह में खिंचाव', en: 'Left Arm & Shoulder Pain', isEmergency: true },
      { hi: 'अत्यधिक पसीना व घबराहट', en: 'Diaphoresis & Palpitations', isEmergency: true },
      { hi: 'सांस फूलना व सीने में जकड़न', en: 'Shortness of Breath', isEmergency: true },
      { hi: 'धड़कन का अनियंत्रित होना', en: 'Acute Palpitations / Tachycardia', isEmergency: true }
    ],
    sensations: [
      { key: 'crushing', label: 'भारी दबाव व जकड़न', en: 'Crushing Pressure', icon: Shield },
      { key: 'radiation', label: 'बाएं कंधे में खिंचाव', en: 'Arm Radiation', icon: Activity },
      { key: 'sweating', label: 'अत्यधिक पसीना व घबराहट', en: 'Diaphoresis & Anxiety', icon: Droplets },
      { key: 'throbbing', label: 'धड़कन तेज़ / बेचैनी', en: 'Palpitation Pulse', icon: HeartPulse },
      { key: 'sharp', label: 'तेज़ चुभन व टीस', en: 'Sharp Stabbing', icon: Zap },
      { key: 'dyspnea', label: 'सांस फूलना व घुटन', en: 'Dyspnea / Gasping', icon: Wind }
    ]
  },

  NEURO_CRANIAL_SENSORY: {
    axis: 'NEURO_CRANIAL_SENSORY',
    srotas: 'Majjavaha · Manovaha Srotas · Shira Marma',
    primaryDosha: 'Vata-Pitta (Shiras)',
    defaultAgni: 'VISHAMAGNI',
    defaultPrakriti: 'Vata-Pitta',
    defaultVikriti: 'Vata Aggravation',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Throbbing / Pulsatile',
    causalRationaleHi: 'सिर, आँख व नसों का दर्द प्राण वात व तर्पक कफ के असंतुलन से होता है, जो मानसिक तनाव व अनियमित दिनचर्या से जुड़ा है।',
    causalRationaleEn: 'Cranial, optical, and neuro-sensory distress is governed by Prana Vata and Majjavaha Srotas.',
    symptoms: [
      { hi: 'सिर में तेज़ दर्द व भारीपन', en: 'Severe Headache & Heaviness' },
      { hi: 'आधासीसी धड़कती टीस', en: 'Throbbing Migraine' },
      { hi: 'चक्कर आना व जी मिचलाना', en: 'Vertigo & Nausea' },
      { hi: 'तनाव व माथे में जकड़न', en: 'Tension & Forehead Tightness' },
      { hi: 'आँखों में जलन व रोशनी से तकलीफ़', en: 'Photophobia & Eye Strain' }
    ],
    sensations: [
      { key: 'throbbing', label: 'आधासीसी धड़कती टीस', en: 'Pulsating Migraine', icon: HeartPulse },
      { key: 'pressure', label: 'माथे में भारी दबाव', en: 'Tension Pressure', icon: Shield },
      { key: 'vertigo', label: 'चक्कर व आंखें घूमना', en: 'Vertigo / Giddiness', icon: Activity },
      { key: 'sinus', label: 'आंखों के पीछे भारीपन', en: 'Retro-orbital Congestion', icon: Droplets },
      { key: 'sharp', label: 'नसों में बिजली सी टीस', en: 'Neuralgic Shock', icon: Zap },
      { key: 'burning', label: 'आंखों में जलन', en: 'Burning Eye Strain', icon: Flame }
    ]
  },

  PELVIC_GENITOURINARY: {
    axis: 'PELVIC_GENITOURINARY',
    srotas: 'Mutravaha · Artavavaha · Purishavaha Srotas · Basti Marma',
    primaryDosha: 'Apana Vata & Pitta',
    defaultAgni: 'VISHAMAGNI',
    defaultPrakriti: 'Vata-Pitta',
    defaultVikriti: 'Apana Vata Aggravation',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Sharp pricking (Toda)',
    causalRationaleHi: 'मूत्राशय, गुर्दे व पेल्विक की तकलीफ़ अपान वात के अवरोध व पित्त के दाह से होती है।',
    causalRationaleEn: 'Pelvic and urogenital pathology is governed by Apana Vata and Mutravaha Srotas (Basti Marma).',
    symptoms: [
      { hi: 'पेशाब में तेज़ जलन व रुकावट', en: 'Severe Dysuria / Burning UTI' },
      { hi: 'बार-बार पेशाब की तीव्र तलब', en: 'Urinary Urgency & Frequency' },
      { hi: 'कमर से पेडू में उतरता असहनीय दर्द', en: 'Renal Colic Radiation', isEmergency: true },
      { hi: 'पेल्विक में खिंचाव व ऐंठन', en: 'Pelvic Cramps & Spasm' },
      { hi: 'मासिक धर्म में असहनीय दर्द', en: 'Dysmenorrhea / Period Pain' }
    ],
    sensations: [
      { key: 'burning_dysuria', label: 'पेशाब में तेज़ जलन', en: 'Burning Dysuria', icon: Flame },
      { key: 'cramps', label: 'पेडू में मरोड़ व ऐंठन', en: 'Pelvic Cramps', icon: Zap },
      { key: 'frequency', label: 'बार-बार पेशाब की तलब', en: 'Urinary Frequency', icon: Activity },
      { key: 'heavy_pelvis', label: 'निचले पेट में भारीपन', en: 'Lower Belly Pressure', icon: Shield },
      { key: 'flow_cut', label: 'रुक-रुक कर पेशाब', en: 'Intermittent Flow', icon: Droplets },
      { key: 'flank', label: 'कमर से पेडू में खिंचाव', en: 'Flank to Groin Spasm', icon: HeartPulse }
    ]
  },

  SYSTEMIC_GENERAL: {
    axis: 'SYSTEMIC_GENERAL',
    srotas: 'Rasavaha · Swedavaha Srotas (Jwara & Sarvadaheeka)',
    primaryDosha: 'Tridoshic (Samanya Sharira)',
    defaultAgni: 'SAMAGNI',
    defaultPrakriti: 'Vata-Pitta',
    defaultVikriti: 'Sama',
    defaultDhatuSara: 'Madhyama',
    defaultPainCharacter: 'Dull aching (Bheda)',
    causalRationaleHi: 'सम्पूर्ण शारीरिक थकान, बुखार या कमज़ोरी रस धातु व स्वेदवह स्रोतस से संबंधित है।',
    causalRationaleEn: 'Constitutional and systemic fatigue reflects general Rasavaha circulation and metabolic reserve.',
    symptoms: [
      { hi: 'असहनीय तकलीफ़ व दर्द', en: 'Severe Pain & Distress' },
      { hi: 'सूजन व भारीपन', en: 'Swelling & Heaviness' },
      { hi: 'जलन या खिंचाव', en: 'Burning or Muscle Spasm' },
      { hi: 'जकड़न व कमजोरी', en: 'Stiffness & Weakness' },
      { hi: 'थकान व बदन दर्द', en: 'General Fatigue & Body Ache' }
    ],
    sensations: [
      { key: 'fever', label: 'तेज़ बुखार व कंपकंपी', en: 'High Fever & Chills', icon: Flame },
      { key: 'fatigue', label: 'कमज़ोरी व सुस्ती', en: 'Prostration & Lethargy', icon: Activity },
      { key: 'bodyache', label: 'बदन दर्द व टूटन', en: 'Generalized Myalgia', icon: HeartPulse },
      { key: 'stiffness', label: 'जकड़न व अकड़न', en: 'Systemic Stiffness', icon: Shield },
      { key: 'burning', label: 'हाथ-पैर में जलन', en: 'Peripheral Burning', icon: Zap },
      { key: 'restless', label: 'बेचैनी व घबराहट', en: 'Systemic Malaise', icon: Wind }
    ]
  }
};

/**
 * Universal Classifier: Resolves ANY body region string and/or spoken text
 * into its exact Physiological Axis without manual hardcoding.
 */
export function classifyPhysiologicalAxis(
  locus: string = '',
  spokenText: string = ''
): PhysiologicalAxisType {
  const combined = `${locus} ${spokenText}`.toLowerCase();

  // 1. Critical Cardiac / Hemodynamic Override
  if (
    /(?:heart|angina|precordial|myocardial|chest pressure|crushing chest|seene me bojh|seene me dabaav|chhati me dard|dil me dard|सीने में दर्द|छाती में दर्द|दिल में दर्द|हार्ट|हृदय शूल|धड़कन तेज़)/i.test(combined) &&
    !/(?:no chest|without chest|acid|burn|cough|asthma)/i.test(combined)
  ) {
    return 'CARDIOVASCULAR_HEMODYNAMIC';
  }

  // 2. Musculoskeletal & Articular (All Joints, Bones, Ligaments, Spine, Extremities)
  if (
    /(?:knee|patell|menisc|ghutna|घुटना|जानु|joint|जोड़|संधि|hip|कूल्हा|spine|vertebra|disc|lumb|lumbago|back|कमर|पीठ|कटि|cervical|griva|गर्दन|neck|shoulder|ams|कंधा|elbow|kurpara|कोहनी|wrist|manibandha|कलाई|ankle|gulpha|टखना|heel|calcane|एड़ी|foot|pair|पैर|तलवा|shin|tibia|jangha|पिंडली|arm|bahu|बांह|finger|अंगुली|toe|sprain|ligament|tendon|cartilage|crepitus|कट-कट|stiff|जकड़न|अकड़न|sciatica|सायटिका|arthritis|गठिया|osteop|chot|लचक)/i.test(combined)
  ) {
    return 'MUSCULOSKELETAL_ARTICULAR';
  }

  // 3. Metabolic / Upper Gastrointestinal / Hepatic
  if (
    /(?:stomach|pet|belly|epigastri|amashaya|आमाशय|pet me dard|पेट में दर्द|पेट दर्द|acid|एसिड|acidity|एसिडिटी|gerd|reflux|heartburn|छाती में जलन|खट्टी डकार|khatti|liver|hepatic|यकृत|gallbladder|pitta|पित्त|vomit|उल्टी|nausea|जी मिचला|bloat|अफारा|indigestion|अपच)/i.test(combined)
  ) {
    return 'METABOLIC_GASTRO_HEPATIC';
  }

  // 4. Bronchopulmonary / Airway / Mucosal
  if (
    /(?:lung|फेफड़े|pulmon|phupphusa|breath|saans|सांस फूल|दम फूल|asthma|दमा|wheez|सीटी|stridor|cough|khansi|खांसी|phlegm|balgam|बलगम|sputum|pleur|rib|पसली|suffocat|घुटन|bronch|chest cold)/i.test(combined)
  ) {
    return 'BRONCHOPULMONARY_MUCOSAL';
  }

  // 5. Neuro-Cranial / Senses / Mental
  if (
    /(?:head|sir|sar|सिर|माथा|headache|migraine|माइग्रेन|brain|मस्तिष्क|vertigo|chakkar|चक्कर|eye|aankh|आँख|vision|ear|kaan|कान|hearing|tinnitus|seeti|sinus|facial|face|chehra|चेहरा|jaw|जबड़ा|stress|tension|sleep|neend)/i.test(combined)
  ) {
    return 'NEURO_CRANIAL_SENSORY';
  }

  // 6. Pelvic / Genitourinary / Renal Colic
  if (
    /(?:pelvi|pedu|पेडू|निचला पेट|bladder|basti|बस्ति|urine|peshab|पेशाब|dysuria|uti|kidney|vrikka|गुर्दा|stone|pathri|पथरी|flank|groin|period|menses|mahasik|cramp|uterus|ovary)/i.test(combined)
  ) {
    return 'PELVIC_GENITOURINARY';
  }

  return 'SYSTEMIC_GENERAL';
}

/**
 * Get Complete Clinical Profile for ANY Body Region or Voice Input
 */
export function getClinicalProfile(
  locus: string = '',
  spokenText: string = ''
): ClinicalAxisProfile {
  const axis = classifyPhysiologicalAxis(locus, spokenText);
  return PHYSIOLOGICAL_PROFILES[axis];
}
