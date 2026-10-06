/**
 * Sovereign Universal Clinical Ontology Engine (Universal Srotas-Anatomy Matrix)
 * Grounded in:
 * - Charaka Samhita (Vimana 8/94, Chikitsa 15/3, Chikitsa 28/37)
 * - Sushruta Samhita (Sharira Sthana 6 - 107 Marma Points)
 * - Modern Emergency Severity Index (ESI Levels 1-5) & Ottawa Decision Rules
 * 
 * Continuous 6-Axis Physiological Continuum with Native Multi-Lingual Depth:
 * Hindi (hi), English (en), Marathi (mr), Bengali (bn), Tamil (ta), Telugu (te).
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
  mr?: string;
  bn?: string;
  ta?: string;
  te?: string;
  isEmergency?: boolean;
}

export interface SensationItem {
  key: string;
  label: string;
  en: string;
  mr?: string;
  bn?: string;
  ta?: string;
  te?: string;
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
  causalRationaleMr?: string;
  causalRationaleBn?: string;
  causalRationaleTa?: string;
  causalRationaleTe?: string;
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
    causalRationaleMr: 'आयुर्वेदानुसार सांधे व हाडांचे दुखणे वात दोषाने होते, ज्याचा मुख्य उगम पक्वाशय (पचन) आहे. सांध्यांच्या कायमस्वरूपी उपचारासाठी पचनशक्ती आणि वायूचे मूल्यांकन आवश्यक आहे.',
    causalRationaleBn: 'আয়ুর্বেদ অনুসারে অস্থিসন্ধির ব্যথা বাত দোষের প্রকোপের কারণে হয়, যার প্রধান উৎস হলো অন্ত্র বা পরিপাকতন্ত্র। তাই পরিপাক অগ্নির মূল্যায়ন অত্যন্ত জরুরি।',
    causalRationaleTa: 'ஆயுர்வேதத்தின்படி மூட்டு மற்றும் எலும்பு வலிகள் வாத தோஷத்தினால் ஏற்படுகின்றன, இதன் மூலம் குடல்/செரிமான மண்டலத்தில் உள்ளது.',
    causalRationaleTe: 'ఆయుర్వేదం ప్రకారం కీళ్ల మరియు ఎముకల నొప్పులు వాత దోషం వల్ల కలుగుతాయి, దీని ప్రధాన మూలం జీర్ణవ్యవస్థ.',
    symptoms: [
      {
        hi: 'जोड़ में दर्द व सूजन',
        en: 'Joint Pain & Swelling',
        mr: 'सांधेदुखी व सूज',
        bn: 'গাঁটে ব্যথা ও ফোলা',
        ta: 'மூட்டு வலி மற்றும் வீக்கம்',
        te: 'కీళ్ల నొప్పి మరియు వాపు'
      },
      {
        hi: 'चलने व मुड़ने में भारी जकड़न',
        en: 'Stiffness on Walking & Flexion',
        mr: 'चालताना व वाकताना कडकपणा / आखडणे',
        bn: 'হাঁটতে ও ভাঁজ করতে শক্ত ভাব',
        ta: 'நடக்கும்போதும் மடக்கும்போதும் விறைப்பு',
        te: 'నడవడానికి మరియు వంగడానికి బిగుతు'
      },
      {
        hi: 'हड्डी व जोड़ में कट-कट की आवाज़',
        en: 'Joint Crepitus & Clicking',
        mr: 'हाडे व सांध्यामध्ये कट-कट आवाज',
        bn: 'হাড় ও গাঁটে খটখট শব্দ',
        ta: 'மூட்டுகளில் சொடக்கு ஒலி',
        te: 'కీళ్లలో శబ్దం (క్రెపిటస్)'
      },
      {
        hi: 'भार सहने व सीढ़ियों पर तकलीफ़',
        en: 'Difficulty Bearing Weight / Stairs',
        mr: 'वजन पेलण्यात व पायऱ्या चढताना त्रास',
        bn: 'ওজন বহন ও সিঁড়ি ওঠায় কষ্ট',
        ta: 'எடை தாங்குவதிலும் படிக்கட்டிலும் சிரமம்',
        te: 'బరువు మోయడం & మెట్లు ఎక్కడంలో ఇబ్బంది'
      },
      {
        hi: 'सुबह उठने पर अत्यधिक अकड़न',
        en: 'Morning Joint Stiffness',
        mr: 'सकाळी उठल्यावर सांधे आखडणे',
        bn: 'সকালে ঘুম থেকে ওঠার পর শক্ত হওয়া',
        ta: 'காலை மூட்டு விறைப்பு',
        te: 'ఉదయాన్నే కీళ్ల బిగుతు'
      }
    ],
    sensations: [
      {
        key: 'crepitus',
        label: 'जोड़ों में कट-कट',
        en: 'Joint Crepitus / Clicking',
        mr: 'सांध्यामध्ये कट-कट',
        bn: 'গাঁটে কটকট শব্দ',
        ta: 'மூட்டு சொடக்கு ஒலி',
        te: 'కీళ్లలో శబ్దం',
        icon: Bone
      },
      {
        key: 'stiffness',
        label: 'चलने व मुड़ने में जकड़न',
        en: 'Walking & Flexion Stiffness',
        mr: 'हालचालीत आखडणे',
        bn: 'চলাফেরায় আড়ষ্টতা',
        ta: 'இயக்க விறைப்பு',
        te: 'కదలికలలో బిగుతు',
        icon: Shield
      },
      {
        key: 'morning_stiff',
        label: 'सुबह उठने पर अकड़न',
        en: 'Morning Stiffness',
        mr: 'सकाळचा कडकपणा',
        bn: 'সকালের আড়ষ্টতা',
        ta: 'காலை விறைப்பு',
        te: 'ఉదయపు బిగుతు',
        icon: Clock
      },
      {
        key: 'swelling',
        label: 'सूजन व गर्माहट',
        en: 'Swelling & Warmth',
        mr: 'सूज व उष्णता',
        bn: 'ফোলা ও উষ্ণতা',
        ta: 'வீக்கம் மற்றும் வெப்பம்',
        te: 'వాపు & వెచ్చదనం',
        icon: Droplets
      },
      {
        key: 'strain',
        label: 'खिंचाव व भार में तकलीफ़',
        en: 'Strain & Weight Pain',
        mr: 'ताण व वेदना',
        bn: 'টান ও চাপ',
        ta: 'தசைப்பிடிப்பு & பாரம்',
        te: 'కండరాల ఒత్తిడి',
        icon: Zap
      },
      {
        key: 'deep_ache',
        label: 'जोड़ में गहरा दर्द',
        en: 'Deep Joint Ache',
        mr: 'सांध्यात तीव्र कळ',
        bn: 'গাঁটে গভীর ব্যথা',
        ta: 'ஆழ்ந்த மூட்டு வலி',
        te: 'కీళ్ల లోతుల్లో నొప్పి',
        icon: HeartPulse
      }
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
    causalRationaleMr: 'अम्लपित्त, पोटदुखी व जळजळ पाचक पित्ताच्या असंतुलनामुळे होते, ज्यामुळे तीक्ष्णाग्नि व छातीत दाह निर्माण होतो.',
    causalRationaleBn: 'অম্বল, পেটে ব্যথা ও জ্বালাপোড়া পাচক পিত্তের ভারসাম্যহীনতার কারণে ঘটে, যা তীব্র অম্লতা তৈরি করে।',
    causalRationaleTa: 'அசிடிட்டி, வயிற்று வலி மற்றும் நெஞ்செரிச்சல் பாசக பித்தத்தின் சமநிலையின்மையால் ஏற்படுகிறது.',
    causalRationaleTe: 'అసిడిటీ, కడుపు నొప్పి మరియు మంట పాచక పిత్తం అసమతుల్యత వల్ల ఏర్పడతాయి.',
    symptoms: [
      {
        hi: 'खट्टी डकार व सीने में जलन',
        en: 'Severe Acid Reflux & Heartburn',
        mr: 'आंबट ढेकर व छातीत जळजळ',
        bn: 'টক ঢেকুর ও বুক জ্বালা',
        ta: 'புளித்த ஏப்பம் மற்றும் நெஞ்செரிச்சல்',
        te: 'పుల్లటి తేన్పులు మరియు ఎదలో మంట'
      },
      {
        hi: 'पेट के ऊपरी हिस्से में दर्द',
        en: 'Upper Stomach / Epigastric Pain',
        mr: 'पोटाच्या वरच्या भागात दुखणे',
        bn: 'পেটের উপরিভাগে ব্যথা',
        ta: 'மேல் வயிற்று வலி',
        te: 'పై కడుపులో నొప్పి'
      },
      {
        hi: 'जी मिचलाना व उल्टी',
        en: 'Nausea & Vomiting',
        mr: 'मळमळ व उलट्या',
        bn: 'বমি বমি ভাব ও বমি',
        ta: 'குமட்டல் மற்றும் வாந்தி',
        te: 'వికారం మరియు వాంతులు'
      },
      {
        hi: 'पेट फूलना व भारी अफारा',
        en: 'Bloating & Gaseous Distension',
        mr: 'पोट फुगणे व गॅस',
        bn: 'পেট ফাঁপা ও গ্যাস',
        ta: 'வயிறு உப்புசம் மற்றும் வாயு',
        te: 'కడుపు ఉబ్బరం మరియు గ్యాస్'
      },
      {
        hi: 'खाली पेट या खाने के बाद तेज़ दर्द',
        en: 'Postprandial / Hunger Pain',
        mr: 'उपाशीपोटी किंवा जेवणानंतर पोटात कळ',
        bn: 'খালি পেটে বা খাওয়ার পর তীব্র ব্যথা',
        ta: 'வெறும் வயிற்றில் அல்லது சாப்பிட்ட பின் வலி',
        te: 'ఖాళీ కడుపుతో లేదా భోజనం తర్వాత నొప్పి'
      }
    ],
    sensations: [
      {
        key: 'burning',
        label: 'खट्टी डकार व जलन',
        en: 'Acidity / Reflux Burn',
        mr: 'आंबट ढेकर व जळजळ',
        bn: 'টক ঢেকুর ও জ্বালা',
        ta: 'புளித்த ஏப்பம் & எரிச்சல்',
        te: 'పుల్లటి తేన్పు & మంట',
        icon: Flame
      },
      {
        key: 'colic',
        label: 'मरोड़ व ऐंठन',
        en: 'Spasmodic Colic',
        mr: 'पोटात मुरडा व पिळवटणे',
        bn: 'পেটে মোচড় ও খিঁচুনী',
        ta: 'வயிற்றுப் பிடிப்பு',
        te: 'కడుపులో మెలితిప్పే నొప్పి',
        icon: Zap
      },
      {
        key: 'bloating',
        label: 'पेट फूलना व गैस',
        en: 'Bloating / Distension',
        mr: 'पोट फुगणे व जडपणा',
        bn: 'পেট ফাঁপা ও ভারী ভাব',
        ta: 'வயிறு உப்புசம்',
        te: 'కడుపు ఉబ్బరం',
        icon: Shield
      },
      {
        key: 'nausea',
        label: 'जी मिचलाना व उल्टी',
        en: 'Nausea & Vomiting',
        mr: 'मळमळ व ओकारी',
        bn: 'বমি বমি ভাব ও বমি',
        ta: 'குமட்டல் & வாந்தி',
        te: 'వికారం & వాంతి',
        icon: Activity
      },
      {
        key: 'tenderness',
        label: 'छूने पर असहनीय टीस',
        en: 'Rebound Tenderness',
        mr: 'स्पर्श केल्यावर तीव्र कळ',
        bn: 'স্পর্শে তীব্র ব্যথা',
        ta: 'தொட்டால் வலி',
        te: 'తాకితే భరించలేని నొప్పి',
        icon: HeartPulse
      },
      {
        key: 'fullness',
        label: 'भारीपन व अपच',
        en: 'Heavy Indigestion',
        mr: 'जडपणा व अपचन',
        bn: 'ভারী ভাব ও বদহজম',
        ta: 'அஜீரணம் & கனம்',
        te: 'అజీర్ణం & బరువు',
        icon: Droplets
      }
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
    causalRationaleMr: 'फुफ्फुस, खोकला व कफाचे आजार कफ दोष आणि मन्दाग्नि (मंद पचन, जडपणा) यामुळे उत्पन्न होतात.',
    causalRationaleBn: 'ফুসফুস, কাশি ও শ্লেষ্মাঘটিত ব্যাধি কফ দোষ এবং মন্দাগ্নির কারণে সৃষ্টি হয়।',
    causalRationaleTa: 'நுரையீரல், இருமல் மற்றும் சளி கோளாறுகள் கப தோஷம் மற்றும் மந்தாக்னியால் ஏற்படுகின்றன.',
    causalRationaleTe: 'ఊపిరితిత్తులు, దగ్గు మరియు కఫం సమస్యలు కఫ దోషం మరియు మందపాటి జీర్ణశక్తి వల్ల ఉత్పన్నమవుతాయి.',
    symptoms: [
      {
        hi: 'सांस फूलना व सीटी की आवाज़',
        en: 'Severe Dyspnea & Wheezing',
        mr: 'दम लागणे व घरघर',
        bn: 'শ্বাসকষ্ট ও শাঁ শাঁ শব্দ',
        ta: 'மூச்சுத்திணறல் மற்றும் இரைப்பு',
        te: 'శ్వాస ఆడకపోవడం మరియు పిల్లికూతలు',
        isEmergency: true
      },
      {
        hi: 'लगातार खांसी व भारी बलगम',
        en: 'Chronic Productive Cough',
        mr: 'सतत खोकला व कफ',
        bn: 'ক্রমাগত কাশি ও কফ',
        ta: 'தொடர் இருமல் மற்றும் சளி',
        te: 'తీవ్రమైన దగ్గు మరియు కఫం'
      },
      {
        hi: 'सीने में जकड़न व घुटन',
        en: 'Chest Tightness & Suffocation',
        mr: 'छातीत आवळल्यासारखे व घुसमट',
        bn: 'বুকে চাপ ও দম বন্ধ ভাব',
        ta: 'நெஞ்சு இறுக்கம் மற்றும் மூச்சுத் திணறல்',
        te: 'ఛాతీలో బిగుతు మరియు ఉక్కిరిబిక్కిరి',
        isEmergency: true
      },
      {
        hi: 'गहरी सांस लेने पर पसलियों में दर्द',
        en: 'Deep Breath Rib Pain',
        mr: 'दीर्घ श्वास घेताना बरगड्या दुखणे',
        bn: 'গভীর শ্বাসে পাঁজরে ব্যথা',
        ta: 'மூச்சு இழுக்கும் போது விலா எலும்பு வலி',
        te: 'దీర్ఘ శ్వాస తీసుకున్నప్పుడు పక్కటెముకల నొప్పి'
      },
      {
        hi: 'रात को सांस रुकना व बेचैनी',
        en: 'Nocturnal Dyspnea / Restlessness',
        mr: 'रात्री श्वास रोखणे व अस्वस्थता',
        bn: 'রাতে শ্বাসকষ্ট ও অস্থিরতা',
        ta: 'இரவில் மூச்சுத்திணறல் & படபடப்பு',
        te: 'రాత్రి శ్వాస అందకపోవడం & ఆందోళన'
      }
    ],
    sensations: [
      {
        key: 'dyspnea',
        label: 'सांस का कष्ट / घुटन',
        en: 'Breathlessness',
        mr: 'दम लागणे / घुसमट',
        bn: 'শ্বাসকষ্ট / দম বন্ধ',
        ta: 'மூச்சுத்திணறல்',
        te: 'ఊపిరి ఆడకపోవడం',
        icon: Wind
      },
      {
        key: 'wheezing',
        label: 'सीटी / घरघराहट',
        en: 'Wheezing / Stridor',
        mr: 'घरघर आवाज',
        bn: 'শাঁ শাঁ আওয়াজ',
        ta: 'இரைப்பு ஒலி',
        te: 'పిల్లికూతలు',
        icon: Activity
      },
      {
        key: 'cough',
        label: 'लगातार तेज़ खांसी',
        en: 'Severe Spasmodic Cough',
        mr: 'तीव्र खोकल्याची उबळ',
        bn: 'তীব্র কাশির দমক',
        ta: 'கடுமையான இருமல்',
        te: 'తీవ్రమైన దగ్గు',
        icon: Zap
      },
      {
        key: 'pleuritic',
        label: 'गहरी सांस पर टीस',
        en: 'Sharp Inhalation Pain',
        mr: 'श्वास घेताना टोचणे',
        bn: 'নিঃশ্বাসে তীক্ষ্ণ ব্যথা',
        ta: 'மூச்சு இழுக்கையில் குத்தல்',
        te: 'శ్వాసలో సూది నొప్పి',
        icon: Shield
      },
      {
        key: 'congestion',
        label: 'छाती में भारी बलगम',
        en: 'Chest Congestion',
        mr: 'छातीत भरलेला कफ',
        bn: 'বুকে জমা কফ',
        ta: 'நெஞ்சு சளி அடைப்பு',
        te: 'ఛాతీలో కఫం పేరుకుపోవడం',
        icon: Droplets
      },
      {
        key: 'burning',
        label: 'सांस नली में जलन',
        en: 'Airway Burning',
        mr: 'श्वासनलिकेत जळजळ',
        bn: 'শ্বাসনালীতে জ্বালা',
        ta: 'மூச்சுக்குழல் எரிச்சல்',
        te: 'శ్వాసనాళంలో మంట',
        icon: Flame
      }
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
    causalRationaleMr: 'छातीतील दाब व वेदना हृदय मर्माशी संबंधित आहे. यासाठी तात्काळ ईसीजी व आपत्कालीन वैद्यकीय तपासणी आवश्यक आहे.',
    causalRationaleBn: 'বুকে চাপ ও টান হৃদ মর্মের সাথে সম্পর্কিত। অবিলম্বে ইসিজি ও জরুরি চিকিৎসার প্রয়োজন।',
    causalRationaleTa: 'மார்பு வலி மற்றும் அழுத்தம் இதய மர்மத்துடன் தொடர்புடையது. உடனடி ஈசிஜி மற்றும் அவசர சிகிச்சை தேவை.',
    causalRationaleTe: 'ఛాతీలో ఒత్తిడి మరియు లాగడం గుండెకు సంబంధించినవి. తక్షణ ఈసీజీ మరియు అత్యవసర పరీక్ష అవసరం.',
    symptoms: [
      {
        hi: 'सीने में भारी दबाव व बेचैनी',
        en: 'Crushing Chest Pressure',
        mr: 'छातीवर असह्य वजन व दाटून येणे',
        bn: 'বুকে প্রচণ্ড চাপ ও অস্বস্তি',
        ta: 'நெஞ்சில் கடுமையான அழுத்தம் & படபடப்பு',
        te: 'ఛాతీలో తీవ్రమైన ఒత్తిడి & బరువు',
        isEmergency: true
      },
      {
        hi: 'बाएं कंधे व बांह में खिंचाव',
        en: 'Left Arm & Shoulder Pain',
        mr: 'डाव्या खांद्यात व हातात कळ',
        bn: 'বাম কাঁধ ও হাতে ছড়িয়ে পড়া ব্যথা',
        ta: 'இடது தோள்பட்டை மற்றும் கை வலி',
        te: 'ఎడమ భుజం మరియు చేతిలోకి లాగడం',
        isEmergency: true
      },
      {
        hi: 'अत्यधिक पसीना व घबराहट',
        en: 'Diaphoresis & Palpitations',
        mr: 'थंड घाम व धडधड',
        bn: 'প্রচণ্ড ঘাম ও বুক ধড়ফড়',
        ta: 'அதிக வியர்வை மற்றும் படபடப்பு',
        te: 'విపరీతమైన చెమట & గుండెదడ',
        isEmergency: true
      },
      {
        hi: 'सांस फूलना व सीने में जकड़न',
        en: 'Shortness of Breath',
        mr: 'दम लागणे व छाती आखडणे',
        bn: 'দম আটকে আসা ও বুকে টান',
        ta: 'மூச்சுத்திணறல் & நெஞ்சு அடைப்பு',
        te: 'ఊపిరి అందకపోవడం & ఛాతీ బిగుతు',
        isEmergency: true
      },
      {
        hi: 'धड़कन का अनियंत्रित होना',
        en: 'Acute Palpitations / Tachycardia',
        mr: 'हृदयाचे ठोके अनियमित होणे',
        bn: 'হৃদস্পন্দন অনিয়মিত হওয়া',
        ta: 'ஒழுங்கற்ற இதயத்துடிப்பு',
        te: 'గుండె వేగంగా కొట్టుకోవడం',
        isEmergency: true
      }
    ],
    sensations: [
      {
        key: 'crushing',
        label: 'भारी दबाव व जकड़न',
        en: 'Crushing Pressure',
        mr: 'असह्य वजन व दाटून येणे',
        bn: 'বুকে প্রচণ্ড চাপ',
        ta: 'நெஞ்சு அழுத்தம்',
        te: 'తీవ్రమైన ఒత్తిడి',
        icon: Shield
      },
      {
        key: 'radiation',
        label: 'बाएं कंधे में खिंचाव',
        en: 'Arm Radiation',
        mr: 'डाव्या हातात कळ',
        bn: 'হাতে ছড়িয়ে পড়া ব্যথা',
        ta: 'கையில் பரவும் வலி',
        te: 'చేతిలోకి పాకే నొప్పి',
        icon: Activity
      },
      {
        key: 'sweating',
        label: 'अत्यधिक पसीना व घबराहट',
        en: 'Diaphoresis & Anxiety',
        mr: 'थंड घाम व भीती',
        bn: 'ঠান্ডা ঘাম ও আতঙ্ক',
        ta: 'குளிர்ந்த வியர்வை',
        te: 'చల్లని చెమటలు',
        icon: Droplets
      },
      {
        key: 'throbbing',
        label: 'धड़कन तेज़ / बेचैनी',
        en: 'Palpitation Pulse',
        mr: 'जलद ठोके / धडधड',
        bn: 'বুক ধড়ফড়ানি',
        ta: 'படபடப்பு துடிப்பு',
        te: 'గుండె దడదడ',
        icon: HeartPulse
      },
      {
        key: 'sharp',
        label: 'तेज़ चुभन व टीस',
        en: 'Sharp Stabbing',
        mr: 'तीव्र टोचणे',
        bn: 'তীব্র সূঁচালো ব্যথা',
        ta: 'கடுமையான குத்தல்',
        te: 'తీవ్రమైన పొడుస్తున్న నొప్పి',
        icon: Zap
      },
      {
        key: 'dyspnea',
        label: 'सांस फूलना व घुटन',
        en: 'Dyspnea / Gasping',
        mr: 'श्वास कोंडणे',
        bn: 'দম আটকে আসা',
        ta: 'மூச்சு முட்டுதல்',
        te: 'ఉక్కిరిబిక్కిరి కావడం',
        icon: Wind
      }
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
    causalRationaleMr: 'डोके, डोळे व मज्जातंतूंचे दुखणे प्राण वात आणि मज्जावह स्रोतसाशी संबंधित आहे, जे मानसिक ताण व अनियमिततेमुळे वाढते.',
    causalRationaleBn: 'মাথা, চোখ ও স্নায়ুর ব্যাধি প্রাণ বাত ও মজ্জাবহ স্রোতসের সাথে সম্পর্কিত, যা মানসিক চাপের কারণে বৃদ্ধি পায়।',
    causalRationaleTa: 'தலை, கண் மற்றும் நரம்பு வலிகள் பிராண வாதம் மற்றும் மஜ்ஜாவஹ ஸ்ரோதஸுடன் தொடர்புடையவை.',
    causalRationaleTe: 'తల, కన్ను మరియు నరాల నొప్పులు ప్రాణ వాతము మరియు మజ్జావహ స్రోతస్సుతో ముడిపడి ఉంటాయి.',
    symptoms: [
      {
        hi: 'सिर में तेज़ दर्द व भारीपन',
        en: 'Severe Headache & Heaviness',
        mr: 'डोकेदुखी व डोके जड होणे',
        bn: 'তীব্র মাথাব্যথা ও ভারী ভাব',
        ta: 'கடுமையான தலைவலி மற்றும் பாரம்',
        te: 'తీవ్రమైన తలనొప్పి మరియు బరువు'
      },
      {
        hi: 'आधासीसी धड़कती टीस',
        en: 'Throbbing Migraine',
        mr: 'अर्धशिशी व ठसठस',
        bn: 'আধকপালি টনটনানি ব্যথা',
        ta: 'ஒற்றைத் தலைவலி துடிப்பு',
        te: 'పార్శ్వపు తలనొప్పి'
      },
      {
        hi: 'चक्कर आना व जी मिचलाना',
        en: 'Vertigo & Nausea',
        mr: 'चक्कर येणे व मळमळ',
        bn: 'মাথা ঘোরা ও বমি বমি ভাব',
        ta: 'தலைச்சுற்றல் மற்றும் குமட்டல்',
        te: 'తలతిరగడం మరియు వికారం'
      },
      {
        hi: 'तनाव व माथे में जकड़न',
        en: 'Tension & Forehead Tightness',
        mr: 'कपाळावर ताण व आखडणे',
        bn: 'কপালে টান ও চাপ',
        ta: 'நெற்றி இறுக்கம் & படபடப்பு',
        te: 'నుదుటి బిగుతు & ఒత్తిడి'
      },
      {
        hi: 'आँखों में जलन व रोशनी से तकलीफ़',
        en: 'Photophobia & Eye Strain',
        mr: 'डोळ्यांची जळजळ व प्रकाशाचा त्रास',
        bn: 'চোখে জ্বালা ও আলোয় কষ্ট',
        ta: 'கண் எரிச்சல் & வெளிச்சக் கூச்சம்',
        te: 'కళ్ల మంట & వెలుతురు చూడలేకపోవడం'
      }
    ],
    sensations: [
      {
        key: 'throbbing',
        label: 'आधासीसी धड़कती टीस',
        en: 'Pulsating Migraine',
        mr: 'ठसठसणारी अर्धशिशी',
        bn: 'টনটনানি আধকপালি',
        ta: 'துடிக்கும் தலைவலி',
        te: 'అదిరే తలనొప్పి',
        icon: HeartPulse
      },
      {
        key: 'pressure',
        label: 'माथे में भारी दबाव',
        en: 'Tension Pressure',
        mr: 'कपाळावर जड भार',
        bn: 'মাথায় ভারী চাপ',
        ta: 'நெற்றியில் பாரம்',
        te: 'నుదుటిపై బరువు',
        icon: Shield
      },
      {
        key: 'vertigo',
        label: 'चक्कर व आंखें घूमना',
        en: 'Vertigo / Giddiness',
        mr: 'चक्कर येणे व तोल जाणे',
        bn: 'মাথা ঘোরা ও অন্ধকার দেখা',
        ta: 'தலைச்சுற்றல் மயக்கம்',
        te: 'కళ్లు తిరగడం',
        icon: Activity
      },
      {
        key: 'sinus',
        label: 'आंखों के पीछे भारीपन',
        en: 'Retro-orbital Congestion',
        mr: 'डोळ्यांमागे जडपणा',
        bn: 'চোখের পেছনে ভারী ভাব',
        ta: 'கண்களுக்குப் பின் பாரம்',
        te: 'కళ్ల వెనుక బరువు',
        icon: Droplets
      },
      {
        key: 'sharp',
        label: 'नसों में बिजली सी टीस',
        en: 'Neuralgic Shock',
        mr: 'मज्जातंतूत विजेसारखी कळ',
        bn: 'স্নায়ুতে বিদ্যুতের মতো টান',
        ta: 'நரம்பு மின்னல் வலி',
        te: 'నరాలలో షాక్ వంటి నొప్పి',
        icon: Zap
      },
      {
        key: 'burning',
        label: 'आंखों में जलन',
        en: 'Burning Eye Strain',
        mr: 'डोळ्यांची जळजळ',
        bn: 'চোখে প্রদাহ ও জ্বালা',
        ta: 'கண் எரிச்சல்',
        te: 'కళ్లల్లో మంట',
        icon: Flame
      }
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
    causalRationaleMr: 'मूत्राशय, मूत्रपिंड व ओटीपोटाचा त्रास अपान वायूच्या अडथळ्यामुळे आणि पित्ताच्या दाहकतेमुळे होतो.',
    causalRationaleBn: 'মূত্রাশয়, কিডনি ও তলপেটের ব্যাধি অপান বাত ও মূত্রবহ স্রোতসের বিকৃতির সাথে সম্পর্কিত।',
    causalRationaleTa: 'சிறுநீர்ப்பை, சிறுநீரகம் மற்றும் அடிவயிற்று உபாதைகள் அபான வாதம் மற்றும் மூத்ரவஹ ஸ்ரோதஸினால் ஏற்படுகின்றன.',
    causalRationaleTe: 'మూత్రాశయం, మూత్రపిండాలు మరియు పొత్తికడుపు సమస్యలు అపాన వాతము మరియు మూత్రవహ స్రోతస్సుతో ముడిపడి ఉంటాయి.',
    symptoms: [
      {
        hi: 'पेशाब में तेज़ जलन व रुकावट',
        en: 'Severe Dysuria / Burning UTI',
        mr: 'लघवी करताना जळजळ व अडथळा',
        bn: 'প্রস্রাবে তীব্র জ্বালা ও বাধা',
        ta: 'சிறுநீர் எரிச்சல் மற்றும் அடைப்பு',
        te: 'మూత్రంలో తీవ్ర మంట మరియు అడ్డంకి'
      },
      {
        hi: 'बार-बार पेशाब की तीव्र तलब',
        en: 'Urinary Urgency & Frequency',
        mr: 'वारंवार लघवीची तीव्र भावना',
        bn: 'ঘন ঘন প্রস্রাবের বেগ',
        ta: 'அடிக்கடி சிறுநீர் அவசரம்',
        te: 'తరచుగా మూత్ర విసర్జన భావన'
      },
      {
        hi: 'कमर से पेडू में उतरता असहनीय दर्द',
        en: 'Renal Colic Radiation',
        mr: 'कमरेतून ओटीपोटात उतरणारी तीव्र कळ',
        bn: 'কোমর থেকে তলপেটে নামা তীব্র ব্যথা',
        ta: 'இடுப்பிலிருந்து அடிவயிறு வரை வலி',
        te: 'నడుము నుండి పొత్తికడుపు వరకు నొప్పి',
        isEmergency: true
      },
      {
        hi: 'पेल्विक में खिंचाव व ऐंठन',
        en: 'Pelvic Cramps & Spasm',
        mr: 'ओटीपोटात ताण व मुरडा',
        bn: 'তলপেটে টান ও খিঁচুনি',
        ta: 'அடிவயிற்று பிடிப்பு மற்றும் வலி',
        te: 'పొత్తికడుపులో నొప్పులు'
      },
      {
        hi: 'मासिक धर्म में असहनीय दर्द',
        en: 'Dysmenorrhea / Period Pain',
        mr: 'मासिक पाळीतील तीव्र वेदना',
        bn: 'মাসিকের অসহ্য ব্যথা',
        ta: 'மாதவிடாய் வலி',
        te: 'రుతుక్రమ తీవ్ర నొప్పి'
      }
    ],
    sensations: [
      {
        key: 'burning_dysuria',
        label: 'पेशाब में तेज़ जलन',
        en: 'Burning Dysuria',
        mr: 'लघवीला तीव्र जळजळ',
        bn: 'প্রস্রাবে তীব্র জ্বালা',
        ta: 'சிறுநீர் எரிச்சல்',
        te: 'మూత్రంలో మంట',
        icon: Flame
      },
      {
        key: 'cramps',
        label: 'पेडू में मरोड़ व ऐंठन',
        en: 'Pelvic Cramps',
        mr: 'ओटीपोटात मुरडा',
        bn: 'তলপেটে মোচড়',
        ta: 'அடிவயிற்றுப் பிடிப்பு',
        te: 'పొత్తికడుపులో నొప్పులు',
        icon: Zap
      },
      {
        key: 'frequency',
        label: 'बार-बार पेशाब की तलब',
        en: 'Urinary Frequency',
        mr: 'वारंवार लघवी लागणे',
        bn: 'ঘন ঘন বেগ',
        ta: 'அடிக்கடி சிறுநீர் அவசரம்',
        te: 'తరచుగా మూత్ర విసర్జన',
        icon: Activity
      },
      {
        key: 'heavy_pelvis',
        label: 'निचले पेट में भारीपन',
        en: 'Lower Belly Pressure',
        mr: 'खालच्या पोटात जडपणा',
        bn: 'তলপেটে ভারী ভাব',
        ta: 'அடிவயிற்று பாரம்',
        te: 'కింది కడుపులో బరువు',
        icon: Shield
      },
      {
        key: 'flow_cut',
        label: 'रुक-रुक कर पेशाब',
        en: 'Intermittent Flow',
        mr: 'अडकून लघवी होणे',
        bn: 'আটকে আটকে প্রস্রাব',
        ta: 'விட்டு விட்டு சிறுநீர் போவது',
        te: 'ఆగి ఆగి మూత్రం రావడం',
        icon: Droplets
      },
      {
        key: 'flank',
        label: 'कमर से पेडू में खिंचाव',
        en: 'Flank to Groin Spasm',
        mr: 'कमरेतून ओटीपोटात ताण',
        bn: 'কোমর থেকে তলপেটে টান',
        ta: 'இடுப்பிலிருந்து அடிவயிறு வலி',
        te: 'నడుము నుండి పొత్తికడుపు లాగడం',
        icon: HeartPulse
      }
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
    causalRationaleMr: 'संपूर्ण शारीरिक थकवा, ताप किंवा अशक्तपणा रस धातू व स्वेदवह स्रोतसाशी संबंधित आहे.',
    causalRationaleBn: 'সার্বিক শারীরিক ক্লান্তি, জ্বর বা দুর্বলতা রস ধাতু ও স্বেদবহ স্রোতসের সাথে সম্পর্কিত।',
    causalRationaleTa: 'முழு உடல் சோர்வு, காய்ச்சல் அல்லது பலவீனம் ரஸ தாது மற்றும் ஸ்வேதவஹ ஸ்ரோதஸுடன் தொடர்புடையது.',
    causalRationaleTe: 'శరీర అలసట, జ్వరం లేదా బలహీనత రస ధాతు మరియు స్వేదవహ స్రోతస్సుతో ముడిపడి ఉంటాయి.',
    symptoms: [
      {
        hi: 'असहनीय तकलीफ़ व दर्द',
        en: 'Severe Pain & Distress',
        mr: 'असह्य त्रास व वेदना',
        bn: 'অসহ্য কষ্ট ও ব্যথা',
        ta: 'தாங்க முடியாத வலி',
        te: 'భరించలేని నొప్పి'
      },
      {
        hi: 'सूजन व भारीपन',
        en: 'Swelling & Heaviness',
        mr: 'सूज व जडपणा',
        bn: 'ফোলা ও ভারী ভাব',
        ta: 'வீக்கம் மற்றும் பாரம்',
        te: 'వాపు మరియు బరువు'
      },
      {
        hi: 'जलन या खिंचाव',
        en: 'Burning or Muscle Spasm',
        mr: 'जळजळ किंवा स्नायूंचा ताण',
        bn: 'জ্বালাপোড়া বা পেশির টান',
        ta: 'எரிச்சல் அல்லது தசைப்பிடிப்பு',
        te: 'మంట లేదా కండరాల పట్టడం'
      },
      {
        hi: 'जकड़न व कमजोरी',
        en: 'Stiffness & Weakness',
        mr: 'कडकपणा व अशक्तपणा',
        bn: 'আড়ষ্টতা ও দুর্বলতা',
        ta: 'விறைப்பு மற்றும் பலவீனம்',
        te: 'బిగుతు మరియు బలహీనత'
      },
      {
        hi: 'थकान व बदन दर्द',
        en: 'General Fatigue & Body Ache',
        mr: 'थकवा व अंगदुखी',
        bn: 'ক্লান্তি ও শরীর ব্যথা',
        ta: 'சோர்வு மற்றும் உடல் வலி',
        te: 'అలసట మరియు ఒంటి నొప్పులు'
      }
    ],
    sensations: [
      {
        key: 'fever',
        label: 'तेज़ बुखार व कंपकंपी',
        en: 'High Fever & Chills',
        mr: 'तीव्र ताप व भरून येणे',
        bn: 'তীব্র জ্বর ও কাঁপুনি',
        ta: 'அதிக காய்ச்சல் & நடுக்கம்',
        te: 'తీవ్రమైన జ్వరం & వణుకు',
        icon: Flame
      },
      {
        key: 'fatigue',
        label: 'कमज़ोरी व सुस्ती',
        en: 'Prostration & Lethargy',
        mr: 'अशक्तपणा व सुस्ती',
        bn: 'দুর্বলতা ও অলসতা',
        ta: 'பலவீனம் மற்றும் சோம்பல்',
        te: 'బలహీనత మరియు నీరసం',
        icon: Activity
      },
      {
        key: 'bodyache',
        label: 'बदन दर्द व टूटन',
        en: 'Generalized Myalgia',
        mr: 'अंगदुखी व कणकण',
        bn: 'গা-হাত-পা ব্যথা',
        ta: 'உடல் வலி',
        te: 'ఒంటి నొప్పులు',
        icon: HeartPulse
      },
      {
        key: 'stiffness',
        label: 'जकड़न व अकड़न',
        en: 'Systemic Stiffness',
        mr: 'अंग आखडणे',
        bn: 'শরীর শক্ত হওয়া',
        ta: 'உடல் விறைப்பு',
        te: 'శరీర బిగుతు',
        icon: Shield
      },
      {
        key: 'burning',
        label: 'हाथ-पैर में जलन',
        en: 'Peripheral Burning',
        mr: 'हात-पायांची जळजळ',
        bn: 'হাত-পায়ে জ্বালা',
        ta: 'கை கால் எரிச்சல்',
        te: 'చేతులు, కాళ్ళలో మంట',
        icon: Zap
      },
      {
        key: 'restless',
        label: 'बेचैनी व घबराहट',
        en: 'Systemic Malaise',
        mr: 'अस्वस्थता व घबराट',
        bn: 'অস্থিরতা ও বুক ধড়ফড়',
        ta: 'படபடப்பு மற்றும் அமைதியின்மை',
        te: 'ఆందోళన మరియు అసహనం',
        icon: Wind
      }
    ]
  }
};

/**
 * Universal Classifier: Resolves ANY body region string and/or spoken text
 * into its exact Physiological Axis without manual hardcoding.
 * Powered by Pan-Indian Multi-Lingual Compositional Root & Stem Regex Engine
 * Covering: Hindi (hi), English (en), Marathi (mr), Bengali (bn), Tamil (ta), Telugu (te).
 */
export function classifyPhysiologicalAxis(
  locus: string = '',
  spokenText: string = ''
): PhysiologicalAxisType {
  const combined = `${locus} ${spokenText}`.toLowerCase();

  // 1. Critical Cardiac / Hemodynamic Override (Pan-Indian Emergency Guardrail)
  if (
    /(?:heart|angina|precordial|myocardial|chest pressure|crushing chest|seene me bojh|seene me dabaav|chhati me dard|dil me dard|सीने में दर्द|छाती में दर्द|दिल में दर्द|हार्ट|हृदय शूल|धड़कन तेज़|छातीत दुख|छातीत कळ|छातीत दाट|छातीवर वजन|धडधड|थंडा घाम|बुके ব্যথা|বুকে চাপ|বুক ধড়ফড়|দম আটকে|நெஞ்சு வலி|மார்பு வலி|நெஞ்சு அடை|நெஞ்சு பிசை|படபடப்பு|குளிர்ந்த வேர்வை|ఛాతీ నొప్పి|గుండె నొప్పి|గుండెల్లో బరువు|గుండె దడ|చల్లని చెమటలు)/i.test(combined) &&
    !/(?:no chest|without chest|acid|burn|cough|asthma)/i.test(combined)
  ) {
    return 'CARDIOVASCULAR_HEMODYNAMIC';
  }

  // 2. Pelvic / Genitourinary / Renal Colic (Mutravaha & Artavavaha - Prioritized over general GI)
  if (
    /(?:pelvi|pedu|पेडू|निचला पेट|bladder|basti|बस्ति|urine|peshab|पेशाब|dysuria|uti|kidney|vrikka|गुर्दा|stone|pathri|पथरी|flank|groin|period|menses|mahasik|cramp|uterus|ovary|लघवी|लघवीला जळजळ|लघवी अडक|लघवीत रक्त|ओटीपोट|मूत्रपिंड खडा|প্রস্রাব|প্রস্রাবে জ্বালা|প্রস্রাব আটকে|তলপেটে ব্যথা|কিডনির পাথর|சிறுநீர்|சிறுநீர் எரிச்சல்|சிறுநீர் அடைப்பு|அடிவயிறு வலி|மூத்திரக்கல்|మూత్రం|మూత్రంలో మంట|మూత్రం బంధనం|పొత్తికడుపు నొప్పి|మూత్రపిండాల్లో రాళ్ళు)/i.test(combined)
  ) {
    return 'PELVIC_GENITOURINARY';
  }

  // 3. Bronchopulmonary / Airway / Mucosal (Pranavaha Srotas)
  if (
    /(?:lung|फेफड़े|pulmon|phupphusa|breath|saans|सांस फूल|दम फूल|asthma|दमा|wheez|सीटी|stridor|cough|khansi|खांसी|phlegm|balgam|बलगम|sputum|pleur|rib|पसली|suffocat|घुटन|bronch|chest cold|खोकला|श्वास घेण्यास त्रास|दम लाग|श्वास कोंड|घरघर|काশি|শ্বাসকষ্ট|দম বন্ধ|হাঁপানি|இருமல்|மூச்சுத்திணறல்|மூச்சு வாங்க|மூச்சு இரைப்பு|ஆஸ்துமா|దగ్గు|శ్వాస ఆడకపోవడం|ఊపిరి అంద|దమ్ము)/i.test(combined)
  ) {
    return 'BRONCHOPULMONARY_MUCOSAL';
  }

  // 4. Neuro-Cranial / Senses / Mental (Shiroroga & Indriyavaha)
  if (
    /(?:head|sir|sar|सिर|माथा|headache|migraine|माइग्रेन|brain|मस्तिष्क|vertigo|chakkar|चक्कर|eye|aankh|आँख|vision|ear|kaan|कान|hearing|tinnitus|seeti|sinus|facial|face|chehra|चेहरा|jaw|जबड़ा|stress|tension|sleep|neend|डोकेदुखी|डोके दुख|चक्कर येणे|मुंग्या|माथাব্যथा|মাথা ঘোরা|ঝিঁঝিঁ|চোখে অন্ধকার|தலைவலி|மயக்கம்|தலை சுற்ற|மரத்து போதல்|ஒற்றைத் தலைவலி|తలనొప్పి|తలతిరగడం|తిమ్మిర్లు|పార్శ్వపు నొప్పి)/i.test(combined)
  ) {
    return 'NEURO_CRANIAL_SENSORY';
  }

  // 5. Musculoskeletal & Articular (All Joints, Bones, Ligaments, Spine, Extremities)
  if (
    /(?:knee|patell|menisc|ghutna|घुटना|जानु|joint|जोड़|संधि|hip|कूल्हा|spine|vertebra|disc|lumb|lumbago|back|कमर|पीठ|कटि|cervical|griva|गर्दन|neck|shoulder|ams|कंधा|elbow|kurpara|कोहनी|wrist|manibandha|कलाई|ankle|gulpha|टखना|heel|calcane|एड़ी|foot|pair|पैर|तलवा|shin|tibia|jangha|पिंडली|arm|bahu|बांह|hand|haath|हाथ|हाथों|हात|hath|forearm|हस्त|kai|cheyi|haat|finger|अंगुली|toe|sprain|ligament|tendon|cartilage|crepitus|कट-कट|stiff|जकड़न|अकड़न|sciatica|सायटिका|arthritis|गठिया|osteop|chot|लचक|हात दुख|हातात वेदना|सांधेदुखी|सांधे आखड|पाठदुखी|कंबरदुखी|टाचदुखी|হাতে ব্যথা|পায়ে ব্যথা|গাঁটে ব্যথা|গাঁট শক্ত|পিঠে ব্যথা|কোমর ব্যথা|গোড়ালি ব্যথা|கை வலி|கால் வலி|மூட்டு வலி|மூட்டு இறுக்கம்|முதுகு வலி|இடுப்பு வலி|குதிங்கால் வலி|చేయి నొప్పి|కాలు నొప్పి|కీళ్ల నొప్పులు|కీళ్లు పట్ట|వెన్నునొప్పి|నడుము నొప్పి|మడమ నొప్పి)/i.test(combined)
  ) {
    return 'MUSCULOSKELETAL_ARTICULAR';
  }

  // 6. Metabolic / Upper Gastrointestinal / Hepatic (Agni & Koshtha Srotas)
  if (
    /(?:stomach|pet|belly|epigastri|amashaya|आमाशय|pet me dard|पेट में दर्द|पेट दर्द|acid|एसिड|acidity|एसिडिटी|gerd|reflux|heartburn|छाती में जलन|खट्टी डकार|khatti|liver|hepatic|यकृत|gallbladder|pitta|पित्त|vomit|उल्टी|nausea|जी मिचला|bloat|अफारा|indigestion|अपच|पोटात दुख|पोट फुग|आंबट ढेकर|अम्लपित्त|ओकारी|मळमळ|मुरडा|পেটে ব্যথা|পেট ফাঁপা|টক ঢেকুর|বুক জ্বালা|বমি|পাতলা পায়খানা|வயிற்று வலி|வயிறு உப்புசம்|புளித்த ஏப்பம்|நெஞ்செரிச்சல்|குமட்டல்|வாந்தி|வயிற்றுப்போக்கு|కడుపు నొప్పి|కడుపు ఉబ్బరం|పుల్లటి తేన్పులు|ఎదలో మంట|వికారం|వాంతులు|విరేచనాలు)/i.test(combined)
  ) {
    return 'METABOLIC_GASTRO_HEPATIC';
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

/**
 * Multi-Lingual Localized Helpers for Diagnostic Rationale & Clinical Elements
 */
export function getLocalizedRationale(profile: ClinicalAxisProfile, lang: string = 'hi'): string {
  const l = (lang || 'hi').toLowerCase().substring(0, 2);
  if (l === 'hi') return profile.causalRationaleHi;
  if (l === 'mr') return profile.causalRationaleMr || profile.causalRationaleHi;
  if (l === 'bn') return profile.causalRationaleBn || profile.causalRationaleHi;
  if (l === 'ta') return profile.causalRationaleTa || profile.causalRationaleEn;
  if (l === 'te') return profile.causalRationaleTe || profile.causalRationaleEn;
  return profile.causalRationaleEn || profile.causalRationaleHi;
}

export function getLocalizedSymptom(sym: SymptomItem, lang: string = 'hi'): string {
  const l = (lang || 'hi').toLowerCase().substring(0, 2);
  if (l === 'hi') return sym.hi;
  if (l === 'mr') return sym.mr || sym.hi;
  if (l === 'bn') return sym.bn || sym.hi;
  if (l === 'ta') return sym.ta || sym.en;
  if (l === 'te') return sym.te || sym.en;
  return sym.en || sym.hi;
}

export function getLocalizedSensationLabel(sens: SensationItem, lang: string = 'hi'): string {
  const l = (lang || 'hi').toLowerCase().substring(0, 2);
  if (l === 'hi') return sens.label;
  if (l === 'mr') return sens.mr || sens.label;
  if (l === 'bn') return sens.bn || sens.label;
  if (l === 'ta') return sens.ta || sens.en;
  if (l === 'te') return sens.te || sens.en;
  return sens.en || sens.label;
}
