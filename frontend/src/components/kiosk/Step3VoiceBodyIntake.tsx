import React, { useState, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Check,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Shield,
  HeartPulse,
  ArrowRight,
  ArrowLeft,
  Edit3,
  Flame,
  Zap,
  Activity,
  Heart,
  Radio,
  CornerUpLeft,
  Trash2,
  Undo2,
  Wind
} from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import {
  AnatomicalMannequin3D,
  CLUSTER_DISAMBIGUATION,
  LOCUS_TO_CLUSTER,
  LOCUS_TO_MACRO_ZONE,
  MacroZone
} from './AnatomicalMannequin3D';
import { getClinicalProfile } from '../../utils/clinicalOntology';

interface Step3VoiceBodyIntakeProps {
  transcript: string;
  setTranscript: (text: string) => void;
  selectedBodyRegion: string;
  setSelectedBodyRegion: (region: string) => void;
  onExtractedSymptoms: (symptoms: any[], vitals: any, redFlags: string[], extra?: any) => void;
  onNext: () => void;
  onBack: () => void;
}

interface CongruenceRecommendation {
  suggestedLocusId: string;
  suggestedLocusHindi: string;
  suggestedLocusEn: string;
  reasonHindi: string;
  reasonEn: string;
  triggerPhrase: string;
  isEmergency?: boolean;
  priorityLevel: 'CRITICAL_CARDIAC' | 'RESPIRATORY_EMERGENCY' | 'ACUTE_SURGICAL' | 'NEURO_CRITICAL' | 'ORGAN_REDIRECT';
  ayushMarmaAlert?: string;
}

// Infallible Multi-Tiered Semantic Symptom-Locus Congruence Cross-Validator
const evaluateCongruenceMismatch = (
  selectedRegion: string,
  transcriptText: string
): CongruenceRecommendation | null => {
  if (!transcriptText) return null;
  const text = transcriptText.toLowerCase();

  // Regional Negation Check (e.g. "no chest pain", "seene me koi dard nahi")
  const hasChestNegation = (
    /(?:no|denies|without|zero|negative\s*for)\s*(?:chest|precordial|retrosternal)\s*(?:pain|pressure|discomfort|heaviness)/i.test(text) ||
    /(?:chest|precordial|retrosternal)\s*(?:pain|pressure|discomfort|tightness)\s*(?:absent|negative|none|nil|not\s*present|nahi)/i.test(text) ||
    /(?:seena|seenas|chhati|seene|chaati)[^.!?:\n,]*(?:kono|koi|kisi|kah)?\s*(?:dard|bojh|peeda|soor|dikkat|takleef|pareshaani)[^.!?:\n,]*(?:naikhe|nahi|naahi|nhi|nai|nathi|ledu|illa|illai|nei)/i.test(text) ||
    /(?:nenjil|gunde|ede)[^.!?:\n,]*(?:vali|noppi|novu)[^.!?:\n,]*(?:illai|ledu|illa)/i.test(text)
  );

  // =========================================================================
  // PRIORITY 0: UNIVERSAL CARDIAC / ANGINA / MYOCARDIAL ISCHEMIA OVERRIDE
  // (Zero tolerance for missed cardiac events regardless of somatic locus)
  // =========================================================================
  if (selectedRegion !== 'Left Chest / Precordium' && selectedRegion !== 'Right Chest' && !hasChestNegation) {
    const universalCardiacKeywords = [
      'chest pain', 'pain in chest', 'chest heaviness', 'chest pressure', 'chest burning', 'chest tightness',
      'heart attack', 'heart pain', 'heart me dard', 'angina', 'precordial', 'crushing chest', 'palpitations',
      'seene me dard', 'chhati me dard', 'chaati me dard', 'dil me dard', 'seene me bojh', 'seene me jalan',
      'seene me dabaav', 'seene me dabav', 'chhati me jalan', 'chhati me bojh', 'sine me dard', 'chati me dard',
      'dil doob', 'dil ghabra', 'सीने में दर्द', 'छाती में दर्द', 'सीने में भारीपन', 'छाती में भारीपन',
      'दिल में दर्द', 'हार्ट में दर्द', 'सीने में जलन', 'सीने में जकड़न', 'हृदय शूल', 'धड़कन तेज़',
      'घबराहट के साथ सीना', 'सीने में दबाव', 'पसीने के साथ सीने में', 'हार्ट अटैक'
    ];
    const matchedCardiac = universalCardiacKeywords.find(k => text.includes(k));
    if (matchedCardiac) {
      const selectedHindi = REGIONAL_COMPLAINTS[selectedRegion]?.hindiName || selectedRegion || 'चुना हुआ अंग';
      const selectedEn = REGIONAL_COMPLAINTS[selectedRegion]?.enName || selectedRegion || 'Selected Organ';
      return {
        suggestedLocusId: 'Left Chest / Precordium',
        suggestedLocusHindi: 'बायां सीना / हृदय (Heart & Precordium)',
        suggestedLocusEn: 'Left Chest & Heart',
        reasonHindi: `आपातकालीन चेतावनी: आपने 3D मॉडल पर '${selectedHindi}' चुना है, लेकिन आवाज़ में सीने/हृदय के दर्द ('${matchedCardiac}') का उल्लेख है!`,
        reasonEn: `Cardiac Emergency Alert: 3D model locus is '${selectedEn}', but spoken voice indicates acute chest/cardiac pain ('${matchedCardiac}').`,
        triggerPhrase: matchedCardiac,
        isEmergency: true,
        priorityLevel: 'CRITICAL_CARDIAC',
        ayushMarmaAlert: 'Hridaya Marma · Sadhyo Pranahara Sthana'
      };
    }
  }

  // =========================================================================
  // PRIORITY 1: UNIVERSAL RESPIRATORY DISTRESS / STRIDOR / HEMOPTYSIS
  // =========================================================================
  if (selectedRegion !== 'Lungs & Respiration' && selectedRegion !== 'Left Chest / Precordium') {
    const universalRespiratoryKeywords = [
      'shortness of breath', 'breathlessness', 'cannot breathe', 'asthma', 'wheezing',
      'coughing blood', 'hemoptysis', 'stridor', 'saans phool', 'dam phool', 'dam ghut',
      'seeti jaisi awaz', 'balgam me khoon', 'saans lene me takleef', 'सांस फूलना',
      'दम फूलना', 'दम घुटना', 'दमा', 'खांसी में खून', 'सीटी जैसी आवाज़', 'घरघराहट',
      'सांस लेने में भारी कष्ट'
    ];
    const matchedResp = universalRespiratoryKeywords.find(k => text.includes(k));
    if (matchedResp) {
      return {
        suggestedLocusId: 'Lungs & Respiration',
        suggestedLocusHindi: 'फेफड़े व सांस (Lungs & Respiration)',
        suggestedLocusEn: 'Lungs & Respiration',
        reasonHindi: `श्वसन चेतावनी: विवरण में सांस फूलने/फेफड़ों के कष्ट ('${matchedResp}') का उल्लेख है। क्या आप फेफड़े व श्वसन विभाग चुनना चाहते हैं?`,
        reasonEn: `Respiratory Distress Alert: Dyspnea/respiratory signs detected ('${matchedResp}').`,
        triggerPhrase: matchedResp,
        isEmergency: true,
        priorityLevel: 'RESPIRATORY_EMERGENCY',
        ayushMarmaAlert: 'Pranavaha Srotas · Phupphusa Shula'
      };
    }
  }

  // =========================================================================
  // PRIORITY 2: CONTEXTUAL CHEST SUB-DIFFERENTIATION (When Left Chest Selected)
  // =========================================================================
  if (selectedRegion === 'Left Chest / Precordium') {
    const pulmonaryKeywords = ['खांसी', 'cough', 'दमा', 'asthma', 'बलगम', 'phlegm', 'सीटी', 'wheezing', 'जुकाम', 'cold', 'सांस फूल'];
    const matchedPulmonary = pulmonaryKeywords.find(k => text.includes(k));
    if (matchedPulmonary) {
      return {
        suggestedLocusId: 'Lungs & Respiration',
        suggestedLocusHindi: 'फेफड़े व सांस (Lungs & Respiration)',
        suggestedLocusEn: 'Lungs & Respiration',
        reasonHindi: `विवरण में '${matchedPulmonary}' का उल्लेख है — क्या तकलीफ़ फेफड़ों से संबंधित है?`,
        reasonEn: `Respiratory symptom detected ('${matchedPulmonary}').`,
        triggerPhrase: matchedPulmonary,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    const acidityKeywords = ['खट्टी डकार', 'acidity', 'एसिडिटी', 'heartburn', 'अम्लपित्त', 'गैस', 'खाना खाने के बाद', 'खाली पेट'];
    const matchedAcidity = acidityKeywords.find(k => text.includes(k));
    if (matchedAcidity) {
      return {
        suggestedLocusId: 'Epigastrium',
        suggestedLocusHindi: 'ऊपरी पेट / अम्लपित्त (Epigastrium)',
        suggestedLocusEn: 'Upper Stomach & Epigastrium',
        reasonHindi: `विवरण में '${matchedAcidity}' का उल्लेख है — क्या यह एसिडिटी/अम्लपित्त की जलन है?`,
        reasonEn: `Reflux/acidity symptom detected ('${matchedAcidity}').`,
        triggerPhrase: matchedAcidity,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }
  }

  // =========================================================================
  // PRIORITY 3: UNIVERSAL ACUTE ABDOMEN / APPENDICITIS / RENAL COLIC / PELVIC
  // =========================================================================
  const isAbdominalRegion = [
    'Epigastrium', 'Umbilicus / Mid-Abdomen', 'Right Lower Quadrant (RLQ)',
    'Left Lower Quadrant (LLQ)', 'Pelvic / Hypogastrium'
  ].includes(selectedRegion);

  if (!isAbdominalRegion) {
    // 3A. Appendicitis / Right Lower Quadrant
    const rlqKeywords = ['दाहिने तरफ नीचे', 'दायां निचला', 'right lower', 'अपेंडिक्स', 'appendix', 'दाएं पेट', 'mcburney', 'daye pet'];
    const matchedRlq = rlqKeywords.find(k => text.includes(k));
    if (matchedRlq) {
      return {
        suggestedLocusId: 'Right Lower Quadrant (RLQ)',
        suggestedLocusHindi: 'दायां निचला पेट (Appendix)',
        suggestedLocusEn: 'Right Lower Abdomen (Appendix)',
        reasonHindi: `दाहिने निचले पेट का दर्द अपेंडिक्स का संकेत हो सकता है ('${matchedRlq}')।`,
        reasonEn: `Right lower quadrant appendicitis signs detected ('${matchedRlq}').`,
        triggerPhrase: matchedRlq,
        isEmergency: true,
        priorityLevel: 'ACUTE_SURGICAL',
        ayushMarmaAlert: 'Unduka Sthana · Acute Surgical Locus'
      };
    }

    // 3B. Kidney Stone / Left Lower Quadrant
    const llqKeywords = ['बाएं पेट', 'बायां निचला', 'left lower', 'पथरी', 'गुर्दा', 'kidney stone', 'कमर से आगे', 'baye pet'];
    const matchedLlq = llqKeywords.find(k => text.includes(k));
    if (matchedLlq) {
      return {
        suggestedLocusId: 'Left Lower Quadrant (LLQ)',
        suggestedLocusHindi: 'बायां निचला पेट / गुर्दा (LLQ)',
        suggestedLocusEn: 'Left Lower Abdomen (Kidney)',
        reasonHindi: `बाएं तरफ का दर्द गुर्दे की पथरी ('${matchedLlq}') की ओर संकेत करता है।`,
        reasonEn: `Left lower quadrant renal colic detected ('${matchedLlq}').`,
        triggerPhrase: matchedLlq,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    // 3C. Pelvic / UTI
    const pelvicKeywords = ['निचला पेट', 'निचले पेट', 'नीचे का पेट', 'पेशाब में जलन', 'पेशाब रुक', 'पेडू', 'मासिक धर्म', 'period', 'bladder', 'uti', 'dysuria', 'lower belly', 'pelvic'];
    const matchedPelvic = pelvicKeywords.find(k => text.includes(k));
    if (matchedPelvic) {
      return {
        suggestedLocusId: 'Pelvic / Hypogastrium',
        suggestedLocusHindi: 'निचला पेट / पेडू (Pelvis)',
        suggestedLocusEn: 'Lower Belly & Pelvis',
        reasonHindi: `विवरण में '${matchedPelvic}' का उल्लेख है — क्या तकलीफ़ निचले पेट / पेडू में है?`,
        reasonEn: `Pelvic / Lower abdominal symptoms detected ('${matchedPelvic}').`,
        triggerPhrase: matchedPelvic,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    // 3D. General Abdominal / Epigastric Colic
    const generalAbdomenKeywords = [
      'pet me dard', 'stomach pain', 'belly ache', 'paat dard', 'pet dard', 'pait me dard',
      'pet kharab', 'pet me marod', 'khatti dakar', 'पेट में दर्द', 'पेट दर्द', 'ऊपरी पेट',
      'खट्टी डकार', 'अम्लपित्त', 'आमाशय'
    ];
    const matchedAbdomen = generalAbdomenKeywords.find(k => text.includes(k));
    if (matchedAbdomen) {
      return {
        suggestedLocusId: 'Epigastrium',
        suggestedLocusHindi: 'ऊपरी पेट (आमाशय)',
        suggestedLocusEn: 'Upper Stomach & Epigastrium',
        reasonHindi: `विवरण में पेट दर्द ('${matchedAbdomen}') का उल्लेख है। क्या आप पेट/आमाशय चुनना चाहते हैं?`,
        reasonEn: `Abdominal pain detected ('${matchedAbdomen}').`,
        triggerPhrase: matchedAbdomen,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }
  }

  // =========================================================================
  // PRIORITY 4: CRANIAL / ENT / CERVICAL DIVERGENCE
  // =========================================================================
  if (selectedRegion !== 'Head' && selectedRegion !== 'Face & Sinus' && selectedRegion !== 'Ear' && selectedRegion !== 'Neck' && selectedRegion !== 'Cervical Spine') {
    const headKeywords = ['सिर में दर्द', 'headache', 'माइग्रेन', 'migraine', 'चक्कर', 'vertigo', 'sir dard', 'sar dard', 'matha ghum'];
    const matchedHead = headKeywords.find(k => text.includes(k));
    if (matchedHead) {
      return {
        suggestedLocusId: 'Head',
        suggestedLocusHindi: 'सिर व माथा (Head & Cranium)',
        suggestedLocusEn: 'Head & Cranium',
        reasonHindi: `विवरण में सिर दर्द/चक्कर ('${matchedHead}') का उल्लेख है। क्या मुख्य तकलीफ़ सिर में है?`,
        reasonEn: `Cranial / headache symptoms detected ('${matchedHead}').`,
        triggerPhrase: matchedHead,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    const earKeywords = ['कान में दर्द', 'ear pain', 'earache', 'कम सुनाई', 'tinnitus', 'कान बह'];
    const matchedEar = earKeywords.find(k => text.includes(k));
    if (matchedEar) {
      return {
        suggestedLocusId: 'Ear',
        suggestedLocusHindi: 'कान (Ear & Hearing)',
        suggestedLocusEn: 'Ear & Hearing',
        reasonHindi: `विवरण में कान के दर्द ('${matchedEar}') का उल्लेख है।`,
        reasonEn: `Ear symptom detected ('${matchedEar}').`,
        triggerPhrase: matchedEar,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    const throatKeywords = ['गले में दर्द', 'गले में खराश', 'throat pain', 'sore throat', 'निगलने में दर्द', 'टॉन्सिल'];
    const matchedThroat = throatKeywords.find(k => text.includes(k));
    if (matchedThroat) {
      return {
        suggestedLocusId: 'Neck',
        suggestedLocusHindi: 'गला व गर्दन (Throat & Neck)',
        suggestedLocusEn: 'Throat & Neck',
        reasonHindi: `विवरण में गले की खराश/दर्द ('${matchedThroat}') का उल्लेख है।`,
        reasonEn: `Throat symptom detected ('${matchedThroat}').`,
        triggerPhrase: matchedThroat,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }
  }

  // =========================================================================
  // PRIORITY 5: SPINE & SCIATICA DIVERGENCE
  // =========================================================================
  const isSpineRegion = ['Lumbar Spine (Kati)', 'Upper Back / Thoracic', 'Cervical Spine', 'Sacral / Sciatica Origin', 'Sciatic Pathway / Calves'].includes(selectedRegion);
  if (!isSpineRegion) {
    const sciaticaKeywords = ['सायटिका', 'sciatica', 'कमर से पैर तक', 'नस दब', 'बिजली जैसी टीस', 'kamar se pair tak'];
    const matchedSciatica = sciaticaKeywords.find(k => text.includes(k));
    if (matchedSciatica) {
      return {
        suggestedLocusId: 'Sciatic Pathway / Calves',
        suggestedLocusHindi: 'पिंडलियाँ व पैर (Sciatica)',
        suggestedLocusEn: 'Calves & Sciatica Pathway',
        reasonHindi: `कमर से पैर में उतरता दर्द सायटिका ('${matchedSciatica}') का संकेत है।`,
        reasonEn: `Sciatic pathway radiculopathy detected ('${matchedSciatica}').`,
        triggerPhrase: matchedSciatica,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }

    const backKeywords = ['कमर में दर्द', 'कमर दर्द', 'back pain', 'lumbago', 'स्लिप डिस्क', 'kamar me dard', 'kamar dard'];
    const matchedBack = backKeywords.find(k => text.includes(k));
    if (matchedBack) {
      return {
        suggestedLocusId: 'Lumbar Spine (Kati)',
        suggestedLocusHindi: 'निचली कमर (कटि)',
        suggestedLocusEn: 'Lower Back & Lumbar',
        reasonHindi: `विवरण में कमर दर्द ('${matchedBack}') का उल्लेख है। क्या मुख्य तकलीफ़ कमर में है?`,
        reasonEn: `Lower back pain detected ('${matchedBack}').`,
        triggerPhrase: matchedBack,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }
  }

  // =========================================================================
  // PRIORITY 6: KNEE & EXTREMITY JOINTS DIVERGENCE
  // =========================================================================
  const isJointRegion = ['Left Knee', 'Right Knee', 'Left Foot', 'Right Foot', 'Left Shoulder', 'Right Shoulder', 'Left Arm', 'Right Arm', 'Left Hand', 'Right Hand'].includes(selectedRegion);
  if (!isJointRegion) {
    const kneeKeywords = ['घुटने में दर्द', 'घुटने की कटोरी', 'knee pain', 'ghutne me dard', 'ghutna dard', 'कट-कट'];
    const matchedKnee = kneeKeywords.find(k => text.includes(k));
    if (matchedKnee) {
      return {
        suggestedLocusId: 'Left Knee',
        suggestedLocusHindi: 'बायां घुटना (Knee Joint)',
        suggestedLocusEn: 'Left Knee Joint',
        reasonHindi: `विवरण में घुटने के दर्द ('${matchedKnee}') का उल्लेख है। क्या मुख्य तकलीफ़ घुटने में है?`,
        reasonEn: `Knee arthralgia detected ('${matchedKnee}').`,
        triggerPhrase: matchedKnee,
        priorityLevel: 'ORGAN_REDIRECT'
      };
    }
  }

  return null;
};

interface SymptomItem {
  hi: string;
  en: string;
  isEmergency?: boolean;
}

interface SensationItem {
  key: string;
  label: string;
  en: string;
  icon: any;
}

const REGIONAL_COMPLAINTS: Record<string, { symptoms: SymptomItem[]; ayushContext: string; hindiName: string; enName: string }> = {
  'Head': {
    hindiName: 'सिर व माथा',
    enName: 'Head & Cranium',
    symptoms: [
      { hi: 'सिर में तेज़ दर्द व भारीपन', en: 'Severe Headache & Heaviness' },
      { hi: 'आधासीसी धड़कती टीस', en: 'Throbbing Migraine' },
      { hi: 'चक्कर आना व जी मिचलाना', en: 'Vertigo & Nausea' },
      { hi: 'तनाव व माथे में जकड़न', en: 'Tension & Forehead Tightness' }
    ],
    ayushContext: 'Shira Sthana · Adhipati & Sthapani Marma'
  },
  'Face & Sinus': {
    hindiName: 'चेहरा व आँखें',
    enName: 'Face & Sinus',
    symptoms: [
      { hi: 'माथे व आँखों के पीछे दबाव', en: 'Sinus Congestion & Pressure' },
      { hi: 'नाक बंद व भारीपन', en: 'Nasal Blockage & Heavy Head' },
      { hi: 'आँखों में जलन व लालिमा', en: 'Eye Strain & Redness' },
      { hi: 'चेहरे की नसों में तीखी टीस', en: 'Facial Neuralgia Pain' }
    ],
    ayushContext: 'Netra & Nasa Sthana · Sthapani Marma'
  },
  'Ear': {
    hindiName: 'कान',
    enName: 'Ear & Hearing',
    symptoms: [
      { hi: 'कान में तेज़ तीखी टीस', en: 'Severe Sharp Earache' },
      { hi: 'कान से पानी या मवाद बहना', en: 'Ear Discharge / Fluid' },
      { hi: 'कान में सीटी बजना व शोर', en: 'Tinnitus / Ringing' },
      { hi: 'कम सुनाई देना व भारीपन', en: 'Hearing Fullness / Loss' }
    ],
    ayushContext: 'Karna Sthana · Shabdavaha Srotas'
  },
  'Neck': {
    hindiName: 'गला व गर्दन',
    enName: 'Throat & Neck',
    symptoms: [
      { hi: 'निगलने में तेज़ दर्द व रुकावट', en: 'Pain on Swallowing' },
      { hi: 'गले में खराश व सूखापन', en: 'Sore Throat & Rawness' },
      { hi: 'गर्दन घुमाने में भारी अकड़न', en: 'Neck Stiffness / Spasm' },
      { hi: 'थायरॉइड व टॉन्सिल सूजन', en: 'Tonsil / Thyroid Swelling' }
    ],
    ayushContext: 'Kantha & Griva Sthana · Manya Marma'
  },
  'Left Chest / Precordium': {
    hindiName: 'बायां सीना (हृदय)',
    enName: 'Left Chest & Heart',
    symptoms: [
      { hi: 'सीने में भारी दबाव व बेचैनी', en: 'Crushing Chest Pressure', isEmergency: true },
      { hi: 'बाएं कंधे व बांह में खिंचाव', en: 'Left Arm & Shoulder Pain', isEmergency: true },
      { hi: 'अत्यधिक पसीना व घबराहट', en: 'Diaphoresis & Palpitations', isEmergency: true },
      { hi: 'सांस फूलना व सीने में जकड़न', en: 'Shortness of Breath', isEmergency: true }
    ],
    ayushContext: 'Hridaya Sthana · Sadhyo Pranahara Marma'
  },
  'Right Chest': {
    hindiName: 'दायां सीना',
    enName: 'Right Thorax',
    symptoms: [
      { hi: 'सांस लेने पर तेज़ चुभन', en: 'Sharp Inhalation Catch' },
      { hi: 'लगातार तेज़ सूखी खांसी', en: 'Persistent Spasmodic Cough' },
      { hi: 'खांसी में खून आना', en: 'Hemoptysis (Alert)', isEmergency: true },
      { hi: 'घरघराहट व सांस का कष्ट', en: 'Wheezing & Respiratory Distress' }
    ],
    ayushContext: 'Phupphusa Sthana · Stanarohita Marma'
  },
  'Lungs & Respiration': {
    hindiName: 'फेफड़े व सांस',
    enName: 'Lungs & Respiration',
    symptoms: [
      { hi: 'सांस फूलना व सीटी की आवाज़', en: 'Severe Dyspnea & Wheezing', isEmergency: true },
      { hi: 'लगातार खांसी व भारी बलगम', en: 'Chronic Productive Cough' },
      { hi: 'सीने में जकड़न व घुटन', en: 'Chest Tightness & Suffocation', isEmergency: true },
      { hi: 'गहरी सांस लेने पर पसलियों में दर्द', en: 'Deep Breath Rib Pain' }
    ],
    ayushContext: 'Pranavaha Srotas · Phupphusa & Uras'
  },
  'Left Shoulder': {
    hindiName: 'बायां कंधा',
    enName: 'Left Shoulder',
    symptoms: [
      { hi: 'कंधा उठाने में असहनीय दर्द', en: 'Shoulder Elevation Pain' },
      { hi: 'हाथ पीछे न घूमना व भारी जकड़न', en: 'Frozen Shoulder Stiffness' },
      { hi: 'रात में कंधे में तेज़ टीस', en: 'Night Shoulder Ache' },
      { hi: 'कंधे की मांसपेशी में कमजोरी', en: 'Shoulder Muscle Weakness' }
    ],
    ayushContext: 'Vama Amsa Sandhi · Amsaphalaka Marma'
  },
  'Right Shoulder': {
    hindiName: 'दायां कंधा',
    enName: 'Right Shoulder',
    symptoms: [
      { hi: 'दाहिना कंधा उठाने में दर्द', en: 'Right Shoulder Pain' },
      { hi: 'कंधे में भारी जकड़न', en: 'Frozen Shoulder Stiffness' },
      { hi: 'मांसपेशी में तेज़ खिंचाव', en: 'Deltoid Muscle Strain' },
      { hi: 'कंधे के जोड़ में कट-कट', en: 'Joint Crepitus / Clicking' }
    ],
    ayushContext: 'Dakshina Amsa Sandhi · Amsaphalaka Marma'
  },
  'Left Arm': {
    hindiName: 'बायीं बांह व कोहनी',
    enName: 'Left Arm & Elbow',
    symptoms: [
      { hi: 'सीने से आता हुआ बांह का दर्द', en: 'Referred Radicular Arm Pain' },
      { hi: 'हाथ व उंगलियों में सुन्नपन', en: 'Numbness & Tingling' },
      { hi: 'कोहनी में तेज़ दर्द', en: 'Tennis / Golfer Elbow Pain' },
      { hi: 'कलाई की पकड़ में कमजोरी', en: 'Weak Hand Grip' }
    ],
    ayushContext: 'Vama Bahu · Kurpara Marma'
  },
  'Right Arm': {
    hindiName: 'दायीं बांह व कोहनी',
    enName: 'Right Arm & Elbow',
    symptoms: [
      { hi: 'कोहनी व बांह में दर्द', en: 'Right Elbow & Arm Pain' },
      { hi: 'कलाई व उंगलियों में झुनझुनी', en: 'Hand & Finger Tingling' },
      { hi: 'बांह में सूजन व भारीपन', en: 'Arm Swelling & Heaviness' },
      { hi: 'हाथ का कांपना व कंपन', en: 'Hand Tremors' }
    ],
    ayushContext: 'Dakshina Bahu · Kurpara Marma'
  },
  'Left Hand': {
    hindiName: 'बायां हाथ व कलाई',
    enName: 'Left Hand & Wrist',
    symptoms: [
      { hi: 'कलाई व उंगलियों के जोड़ों में दर्द', en: 'Wrist & Finger Arthritis' },
      { hi: 'हाथ सुन्न होना व झुनझुनी', en: 'Palmar Numbness / CTS' },
      { hi: 'हथेली में तेज़ जलन व दाह', en: 'Burning Soles & Palms' },
      { hi: 'उंगलियों में सुबह की अकड़न', en: 'Morning Finger Stiffness' }
    ],
    ayushContext: 'Vama Manibandha & Talahridaya'
  },
  'Right Hand': {
    hindiName: 'दायां हाथ व कलाई',
    enName: 'Right Hand & Wrist',
    symptoms: [
      { hi: 'कलाई व उंगलियों में दर्द', en: 'Right Wrist Pain' },
      { hi: 'हाथ में सुन्नपन व चींटी चलना', en: 'Hand Paresthesia' },
      { hi: 'हाथ का अनियंत्रित कांपना', en: 'Resting Hand Tremors' },
      { hi: 'उंगलियों के पोरों में सूजन', en: 'Finger Joint Swelling' }
    ],
    ayushContext: 'Dakshina Manibandha & Talahridaya'
  },
  'Epigastrium': {
    hindiName: 'ऊपरी पेट (आमाशय)',
    enName: 'Upper Stomach & Epigastrium',
    symptoms: [
      { hi: 'खट्टी डकार व सीने में जलन', en: 'Severe Acid Reflux / GERD' },
      { hi: 'पेट के ऊपरी हिस्से में दर्द', en: 'Upper Stomach / Epigastric Pain' },
      { hi: 'जी मिचलाना व उल्टी', en: 'Nausea & Vomiting' },
      { hi: 'पेट का फूलना व भारी अफारा', en: 'Bloating & Gaseous Distension' }
    ],
    ayushContext: 'Amashaya & Agni Sthana · Pachaka Pitta'
  },
  'Umbilicus / Mid-Abdomen': {
    hindiName: 'मध्य पेट (नाभि)',
    enName: 'Mid-Abdomen & Navel',
    symptoms: [
      { hi: 'नाभि के आसपास मरोड़ व गैस', en: 'Umbilical Colic & Cramps' },
      { hi: 'पेट फूलना व गुड़गुड़ाहट', en: 'Borborygmi & Bloating' },
      { hi: 'दस्त या बार-बार पतला शौच', en: 'Loose Motions / Diarrhea' },
      { hi: 'पेट में भारीपन व अपच', en: 'Indigestion & Heaviness' }
    ],
    ayushContext: 'Nabhi Marma · Samana Vata'
  },
  'Right Lower Quadrant (RLQ)': {
    hindiName: 'दायां निचला पेट (अपेंडिक्स)',
    enName: 'Right Lower Abdomen (Appendix)',
    symptoms: [
      { hi: 'नाभि से दाएं नीचे असहनीय दर्द', en: 'Acute Appendicitis Pain', isEmergency: true },
      { hi: 'दाएं पेट को छूने पर तेज़ टीस', en: 'Rebound Tenderness', isEmergency: true },
      { hi: 'बुखार व उल्टी के साथ पेट दर्द', en: 'Fever & Colic', isEmergency: true },
      { hi: 'चलने व पैर उठाने पर दाएं पेट में दर्द', en: 'Psoas Sign Walking Pain' }
    ],
    ayushContext: 'Unduka Sthana · Acute Surgical Locus'
  },
  'Left Lower Quadrant (LLQ)': {
    hindiName: 'बायां निचला पेट (गुर्दा)',
    enName: 'Left Lower Abdomen (Kidney)',
    symptoms: [
      { hi: 'बाएं निचले पेट में तेज़ चुभन', en: 'Left Lower Abdominal Pain' },
      { hi: 'गुर्दे की पथरी का असहनीय दर्द', en: 'Renal Calculi Colic Pain' },
      { hi: 'कमर से पेट में उतरता दर्द', en: 'Flank to Groin Radiation' },
      { hi: 'पेट में मरोड़ व कब्ज़', en: 'Colonic Spasm & Constipation' }
    ],
    ayushContext: 'Vama Kukundara · Vrikka Ashmari'
  },
  'Pelvic / Hypogastrium': {
    hindiName: 'निचला पेट व पेडू',
    enName: 'Lower Belly & Pelvis',
    symptoms: [
      { hi: 'पेशाब में तेज़ जलन व रुकावट', en: 'Severe Dysuria / Burning UTI' },
      { hi: 'बार-बार पेशाब की तीव्र तलब', en: 'Urinary Urgency & Frequency' },
      { hi: 'पेल्विक में खिंचाव व ऐंठन', en: 'Pelvic Cramps & Spasm' },
      { hi: 'मासिक धर्म में असहनीय दर्द', en: 'Dysmenorrhea / Period Pain' }
    ],
    ayushContext: 'Basti Sthana · Sadhyo Pranahara Marma'
  },
  'Left Hip': {
    hindiName: 'बायां कूल्हा व जांघ',
    enName: 'Left Hip & Thigh',
    symptoms: [
      { hi: 'बाएं कूल्हे में जकड़न व दर्द', en: 'Hip Joint Stiffness & Pain' },
      { hi: 'जांघ की मांसपेशी में खिंचाव', en: 'Groin & Thigh Muscle Strain' },
      { hi: 'चलने पर लंगड़ाहट व दर्द', en: 'Antalgic Limp on Walking' },
      { hi: 'कूल्हे के जोड़ में कट-कट', en: 'Hip Joint Crepitus' }
    ],
    ayushContext: 'Vama Nitamba Sandhi · Urvi Marma'
  },
  'Right Hip': {
    hindiName: 'दायां कूल्हा व जांघ',
    enName: 'Right Hip & Thigh',
    symptoms: [
      { hi: 'दाहिने कूल्हे में दर्द व जकड़न', en: 'Right Hip Pain & Stiffness' },
      { hi: 'उठने-बैठने में कूल्हे में अकड़न', en: 'Morning Hip Stiffness' },
      { hi: 'जांघ के आगे तक उतरता दर्द', en: 'Anterior Thigh Radiation' },
      { hi: 'कूल्हे में भारीपन', en: 'Hip Joint Heaviness' }
    ],
    ayushContext: 'Dakshina Nitamba Sandhi · Urvi Marma'
  },
  'Left Knee': {
    hindiName: 'बायां घुटना',
    enName: 'Left Knee Joint',
    symptoms: [
      { hi: 'घुटने में दर्द व सूजन', en: 'Knee Pain & Swelling' },
      { hi: 'चलने व मुड़ने में जकड़न', en: 'Stiffness on Walking & Flexion' },
      { hi: 'घुटने में कट-कट की आवाज़', en: 'Knee Crepitus / Clicking' },
      { hi: 'सीढ़ियाँ चढ़ने व भार सहने में तकलीफ़', en: 'Difficulty Bearing Weight / Stairs' },
      { hi: 'सुबह उठने पर भारी अकड़न', en: 'Morning Joint Stiffness' }
    ],
    ayushContext: 'Vama Janu Sandhi Marma · Sandhivata'
  },
  'Right Knee': {
    hindiName: 'दायां घुटना',
    enName: 'Right Knee Joint',
    symptoms: [
      { hi: 'दाहिने घुटने में दर्द व सूजन', en: 'Right Knee Pain & Swelling' },
      { hi: 'चलने व मुड़ने में जकड़न', en: 'Stiffness on Walking & Flexion' },
      { hi: 'दाहिने घुटने में कट-कट की आवाज़', en: 'Knee Crepitus / Clicking' },
      { hi: 'सीढ़ियाँ चढ़ने व भार सहने में तकलीफ़', en: 'Difficulty Bearing Weight / Stairs' },
      { hi: 'सुबह उठने पर भारी अकड़न', en: 'Morning Joint Stiffness' }
    ],
    ayushContext: 'Dakshina Janu Sandhi Marma · Sandhivata'
  },
  'Left Leg': {
    hindiName: 'बायीं पिंडली',
    enName: 'Left Shin & Calf',
    symptoms: [
      { hi: 'नली की हड्डी में दर्द', en: 'Shin Bone / Tibial Pain' },
      { hi: 'पिंडली में सूजन व भारीपन', en: 'Calf Swelling & Heaviness' },
      { hi: 'चलने पर पिंडली में जकड़न', en: 'Intermittent Claudication' },
      { hi: 'पैर में रात को तेज़ ऐंठन', en: 'Nocturnal Calf Cramps' }
    ],
    ayushContext: 'Vama Jangha Sthana'
  },
  'Right Leg': {
    hindiName: 'दायीं पिंडली',
    enName: 'Right Shin & Calf',
    symptoms: [
      { hi: 'दाहिनी नली की हड्डी में दर्द', en: 'Right Shin Bone Pain' },
      { hi: 'पिंडली की नसें फूलना', en: 'Varicose Vein Engorgement' },
      { hi: 'पिंडली में बांटे व अकड़न', en: 'Calf Muscle Cramps' },
      { hi: 'पैर में भारीपन व थकान', en: 'Heavy Leg Fatigue' }
    ],
    ayushContext: 'Dakshina Jangha Sthana'
  },
  'Left Foot': {
    hindiName: 'बायां पैर व तलवा',
    enName: 'Left Foot & Ankle',
    symptoms: [
      { hi: 'सुबह पैर रखते ही एड़ी में चुभन', en: 'Plantar Fasciitis Heel Pain' },
      { hi: 'टखने में सूजन व मोच', en: 'Ankle Sprain & Edema' },
      { hi: 'एड़ी की हड्डी में चुभता दर्द', en: 'Calcaneal Spur Ache' },
      { hi: 'तलवों में तेज़ जलन व दाह', en: 'Burning Feet Syndrome' }
    ],
    ayushContext: 'Vama Gulpha & Talahridaya'
  },
  'Right Foot': {
    hindiName: 'दायां पैर व तलवा',
    enName: 'Right Foot & Ankle',
    symptoms: [
      { hi: 'दाहिने पैर के तलवे में दर्द', en: 'Foot Sole Pain' },
      { hi: 'टखने में सूजन व चलने में दर्द', en: 'Ankle Swelling & Pain' },
      { hi: 'उंगलियों में सुन्नपन या झुनझुनी', en: 'Toes Numbness & Tingling' },
      { hi: 'एड़ी व पंजे में दर्द', en: 'Heel & Forefoot Ache' }
    ],
    ayushContext: 'Dakshina Gulpha & Talahridaya'
  },
  'Cervical Spine': {
    hindiName: 'गर्दन की रीढ़ (सर्वाइकल)',
    enName: 'Cervical Spine',
    symptoms: [
      { hi: 'गर्दन व सिर के पीछे तेज़ दर्द', en: 'Cervical Neck & Occipital Pain' },
      { hi: 'गर्दन घुमाने में चक्कर आना', en: 'Cervicogenic Vertigo' },
      { hi: 'हाथों तक उतरता करंट जैसा दर्द', en: 'Cervical Radiculopathy' },
      { hi: 'गर्दन व कंधों में भारी जकड़न', en: 'Trapezius Muscle Spasm' }
    ],
    ayushContext: 'Griva Sthana · Manya Stambha'
  },
  'Upper Back / Thoracic': {
    hindiName: 'ऊपरी पीठ व रीढ़',
    enName: 'Upper Back & Thoracic',
    symptoms: [
      { hi: 'कंधों के बीच में भारी खिंचाव', en: 'Interscapular Strain' },
      { hi: 'पीठ में अकड़न व रीढ़ में दर्द', en: 'Thoracic Spine Ache' },
      { hi: 'बैठने पर पीठ में थकावट', en: 'Postural Back Fatigue' },
      { hi: 'सांस लेने पर पीठ में खिंचाव', en: 'Thoracic Breathing Catch' }
    ],
    ayushContext: 'Prishtha Sthana · Amsaphalaka'
  },
  'Lumbar Spine (Kati)': {
    hindiName: 'निचली कमर (कटि)',
    enName: 'Lower Back & Lumbar',
    symptoms: [
      { hi: 'कमर से पैर तक तेज़ खिंचाव', en: 'Sciatica / Lumbar Radiculopathy' },
      { hi: 'झुकने या उठने पर असहनीय दर्द', en: 'Disc Herniation / Lumbago' },
      { hi: 'सुबह उठते ही कमर में जकड़न', en: 'Morning Lumbar Stiffness' },
      { hi: 'बैठने या खड़े होने में चुभन', en: 'Low Back Postural Pain' }
    ],
    ayushContext: 'Kati Sthana · Katikataruna Marma'
  },
  'Sacral / Sciatica Origin': {
    hindiName: 'त्रिक व नितंब (सायटिका)',
    enName: 'Sacral & Sciatica',
    symptoms: [
      { hi: 'नितंब में गहरा चुभता दर्द', en: 'Piriformis / Gluteal Pain' },
      { hi: 'बैठने पर पैर में करंट जैसा दर्द', en: 'Sciatic Nerve Shock' },
      { hi: 'त्रिक भाग में भारी जकड़न', en: 'Sacroiliac Joint Stiffness' },
      { hi: 'नितंब की नस में खिंचाव', en: 'Sciatica Origin Spasm' }
    ],
    ayushContext: 'Sphik & Nitamba Marma'
  },
  'Sciatic Pathway / Calves': {
    hindiName: 'पिंडलियाँ व पैर',
    enName: 'Calves & Sciatica Pathway',
    symptoms: [
      { hi: 'रात में पिंडलियों में तेज़ ऐंठन', en: 'Night Calf Cramps' },
      { hi: 'पैरों के तलवों में तेज़ जलन', en: 'Burning Soles & Paresthesia' },
      { hi: 'टखनों में सूजन व भारीपन', en: 'Ankle Edema & Heaviness' },
      { hi: 'कमर से एड़ी तक खिंचाव', en: 'Shooting Leg Pain' }
    ],
    ayushContext: 'Jangha Sthana · Indrabasti'
  }
};

const SYSTEMIC_COMPLAINT_CATEGORIES: Record<string, { titleHi: string; titleEn: string; symptoms: SymptomItem[] }> = {
  general: {
    titleHi: 'प्रमुख व सामान्य लक्षण',
    titleEn: 'Primary & General Symptoms',
    symptoms: [
      { hi: 'तेज़ बुखार व ठंड लगना', en: 'High Grade Fever & Chills / Jwara' },
      { hi: 'कमजोरी, चक्कर व थकान', en: 'Severe Malaise & Fatigue / Daurbalya' },
      { hi: 'भूख न लगना व अपच', en: 'Loss of Appetite & Indigestion / Aruchi' },
      { hi: 'अनिद्रा, घबराहट व बेचैनी', en: 'Insomnia & Restlessness / Anidra' },
      { hi: 'पूरे बदन में भारी दर्द', en: 'Generalized Bodyache / Angamarda' },
      { hi: 'जी मिचलाना व उल्टी', en: 'Nausea & Emesis / Chhardi' }
    ]
  },
  fever: {
    titleHi: 'बुखार व संक्रमण',
    titleEn: 'Fever & Infection',
    symptoms: [
      { hi: 'ठंड लगकर कंपकंपी व बुखार', en: 'Fever with Rigors & Chills' },
      { hi: 'शरीर में तीव्र टूटन व सिरदर्द', en: 'Severe Bodyache & Headache' },
      { hi: 'गले में खराश व सूखी खांसी', en: 'Sore Throat & Dry Cough' },
      { hi: 'पसीना आने पर भी तपिश', en: 'Persistent High Pyrexia' }
    ]
  },
  cardiorespiratory: {
    titleHi: 'सीना व सांस',
    titleEn: 'Chest & Respiration',
    symptoms: [
      { hi: 'सीने में भारी दबाव व घुटन', en: 'Crushing Chest Angina', isEmergency: true },
      { hi: 'सांस फूलना व घरघराहट', en: 'Acute Dyspnea & Wheezing', isEmergency: true },
      { hi: 'धड़कन तेज़ व पसीना आना', en: 'Palpitations & Cold Sweat', isEmergency: true },
      { hi: 'लगातार खांसी व बलगम', en: 'Chronic Productive Cough' }
    ]
  },
  gastro: {
    titleHi: 'पेट व पाचन',
    titleEn: 'GI & Digestion',
    symptoms: [
      { hi: 'खट्टी डकार व सीने-पेट में जलन', en: 'Acid Reflux & Heartburn / Amlapitta' },
      { hi: 'पेट में मरोड़, शूल व गैस', en: 'Colicky Abdominal Pain & Gas' },
      { hi: 'दस्त, पतले दस्त व ऐंठन', en: 'Acute Diarrhea & Cramping' },
      { hi: 'कब्ज व शौच में कठिनाई', en: 'Severe Constipation / Vibandha' }
    ]
  },
  ortho: {
    titleHi: 'जोड़ व कमर',
    titleEn: 'Joints & Spine',
    symptoms: [
      { hi: 'घुटनों व जोड़ों में दर्द व कट-कट', en: 'Joint Pain & Crepitus / Sandhivata' },
      { hi: 'कमर से पैर तक सायटिका दर्द', en: 'Sciatica Nerve Pain / Gridhrasi' },
      { hi: 'सुबह उठते ही जोड़ों में जकड़न', en: 'Morning Joint Stiffness / Amavata' },
      { hi: 'मांसपेशियों में ऐंठन व खिंचाव', en: 'Muscle Spasms & Cramps' }
    ]
  },
  neuro: {
    titleHi: 'सिरदर्द व तंत्रिका',
    titleEn: 'Neuro & Cranial',
    symptoms: [
      { hi: 'आधासीसी धड़कता सिरदर्द', en: 'Throbbing Migraine / Ardhavabhedaka' },
      { hi: 'सिर घूमना व चक्कर आना', en: 'Severe Vertigo / Bhrama' },
      { hi: 'हाथ-पैरों में सुन्नपन व झुनझुनी', en: 'Peripheral Neuropathy / Suptata' },
      { hi: 'चेहरे या अंग में अचानक कमजोरी', en: 'Sudden Weakness / Paresthesia', isEmergency: true }
    ]
  },
  dermatology: {
    titleHi: 'त्वचा व एलर्जी',
    titleEn: 'Skin & Allergy',
    symptoms: [
      { hi: 'असहनीय खुजली व लाल चकत्ते', en: 'Severe Urticaria / Sheetapitta' },
      { hi: 'त्वचा पर छाले या जलन', en: 'Eczema & Vesicular Lesions' },
      { hi: 'त्वचा का रूखापन व पपड़ी', en: 'Dry Scaling & Psoriasis / Kushtha' },
      { hi: 'संवेदनशील अंगों पर संक्रमण', en: 'Intimate Fungal Infection' }
    ]
  }
};

const UNIVERSAL_SENSATIONS: SensationItem[] = [
  { key: 'heavy', label: 'भारी दबाव', en: 'Heavy / Dull', icon: Shield },
  { key: 'sharp', label: 'तेज़ चुभन', en: 'Sharp / Stabbing', icon: Zap },
  { key: 'burning', label: 'जलन / दाह', en: 'Burning', icon: Flame },
  { key: 'throbbing', label: 'धड़कता दर्द', en: 'Throbbing', icon: HeartPulse },
  { key: 'cramping', label: 'मरोड़ / ऐंठन', en: 'Cramping', icon: Activity },
  { key: 'numbness', label: 'सुन्नपन / झुनझुनी', en: 'Numbness / Tingling', icon: Wind }
];

const PRIVATE_SANCTUARIES = [
  {
    id: 'urology_repro',
    title: 'मूत्र एवं प्रजनन स्वास्थ्य',
    symptoms: ['पेशाब में तेज़ जलन या रुकावट', 'बार-बार पेशाब आना', 'असामान्य स्राव या खुजली', 'मासिक धर्म में असहनीय दर्द']
  },
  {
    id: 'anorectal',
    title: 'गुदा एवं आंत्र विकार (अर्श / बवासीर)',
    symptoms: ['शौच के समय रक्तस्राव', 'बवासीर / मस्से या सूजन', 'गुदा में असहनीय जलन या चीरा']
  },
  {
    id: 'mental_health',
    title: 'मानसिक स्वास्थ्य व अनिद्रा',
    symptoms: ['अत्यधिक घबराहट व चिंता', 'गहरी उदासी व अकेलापन', 'लगातार अनिद्रा व बेचैनी']
  },
  {
    id: 'intimate_skin',
    title: 'त्वचा व गुप्त विकार',
    symptoms: ['संवेदनशील अंगों पर चकत्ते या छाले', 'पुरानी खुजली व संक्रमण']
  }
];

export const Step3VoiceBodyIntake: React.FC<Step3VoiceBodyIntakeProps> = ({
  transcript,
  setTranscript,
  selectedBodyRegion,
  setSelectedBodyRegion,
  onExtractedSymptoms,
  onNext,
  onBack
}) => {
  // Pure 2-Phase Flow: 'body' (Phase 3.0: 100% Fullscreen 3D Mannequin) -> 'symptoms' (Phase 3.1: Sovereign Voice & Symptoms Studio)
  const [subPhase, setSubPhase] = useState<'body' | 'symptoms'>('body');

  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  type SupportedSpeechLang = 'hi-IN' | 'en-IN' | 'mr-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' | 'gu-IN' | 'kn-IN' | 'pa-IN' | 'ml-IN';
  const [mannequinView, setMannequinView] = useState<'front' | 'back'>('front');
  const [activeMacroZone, setActiveMacroZone] = useState<MacroZone>('full');
  const [micLanguage, setMicLanguage] = useState<SupportedSpeechLang>('hi-IN');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [isPeekActive, setIsPeekActive] = useState(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [duration, setDuration] = useState<'today' | '2-3days' | '1week' | 'chronic'>('2-3days');
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualTextDraft, setManualTextDraft] = useState('');
  const [systemicCategory, setSystemicCategory] = useState<string>('general');

  const handleClearTranscript = () => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setTranscript('');
    setParseSuccess(false);
    onExtractedSymptoms([], {}, []);
  };

  const handleUndoLastClause = () => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    if (!transcript) return;
    const parts = transcript.split(/।|\.|\n/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      const updated = parts.join('। ');
      setTranscript(updated);
      triggerClinicalParse(updated);
    } else {
      handleClearTranscript();
    }
  };

  const handleSaveManualEdit = () => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setTranscript(manualTextDraft);
    setIsManualEditing(false);
    triggerClinicalParse(manualTextDraft);
  };

  const SEVERITY_LEVELS = [
    { key: 'mild', label: 'हल्की तकलीफ़', en: 'Mild' },
    { key: 'moderate', label: 'मध्यम तकलीफ़', en: 'Moderate' },
    { key: 'severe', label: 'तीव्र / असहनीय', en: 'Severe' }
  ];

  const DURATION_CHOICES = [
    { key: 'today', label: 'आज से', en: 'Today' },
    { key: '2-3days', label: '2-3 दिन', en: '2-3 Days' },
    { key: '1week', label: '1 हफ्ता', en: '1 Week' },
    { key: 'chronic', label: '1 महीना+', en: 'Chronic' }
  ];

  const recognitionRef = useRef<any>(null);

  const handleRegionClick = (regionId: string) => {
    try { sovereignSound.playHotspotPulse(); } catch {}
    if (selectedBodyRegion === regionId || regionId === '') {
      setSelectedBodyRegion('');
      setActiveMacroZone('full');
    } else {
      setSelectedBodyRegion(regionId);
      if (LOCUS_TO_MACRO_ZONE[regionId]) {
        setActiveMacroZone(LOCUS_TO_MACRO_ZONE[regionId]);
      }
    }
  };

  const handleSwitchWithComorbidity = (newLocusId: string) => {
    try {
      if (congruenceMismatch?.isEmergency) {
        sovereignSound.playClinicalAlert();
      } else {
        sovereignSound.playMechanicalSnap();
      }
    } catch {}

    // If patient had previously chosen another organ (e.g., Left Knee / Epigastrium), retain it as a secondary complaint note
    if (selectedBodyRegion && selectedBodyRegion !== newLocusId) {
      const priorHindi = REGIONAL_COMPLAINTS[selectedBodyRegion]?.hindiName || selectedBodyRegion;
      const priorEn = REGIONAL_COMPLAINTS[selectedBodyRegion]?.enName || selectedBodyRegion;
      const addition = `[सह-लक्षण / 3D स्पर्श: ${priorHindi} (${priorEn})]`;
      if (!transcript.includes(addition)) {
        const updated = transcript ? `${transcript} ${addition}` : addition;
        setTranscript(updated);
        triggerClinicalParse(updated);
      }
    }

    handleRegionClick(newLocusId);
  };

  const handleAddSymptom = (sym: SymptomItem | string) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    const symHi = typeof sym === 'string' ? sym : sym.hi;
    const symEn = typeof sym === 'string' ? '' : sym.en;
    const sevObj = SEVERITY_LEVELS.find(s => s.key === severity);
    const durObj = DURATION_CHOICES.find(d => d.key === duration);
    const organName = currentRegionalData.hindiName.split('(')[0].trim();
    const formatted = `${organName}: ${symHi}${symEn ? ` [${symEn}]` : ''} (${sevObj?.label || ''}, ${durObj?.label || ''})`;
    const newTranscript = transcript ? `${transcript}। ${formatted}` : formatted;
    setTranscript(newTranscript);
    triggerClinicalParse(newTranscript);
  };

  const handleAddSensation = (sensation: { key: string; label: string; en: string; icon: any }) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    const sevObj = SEVERITY_LEVELS.find(s => s.key === severity);
    const durObj = DURATION_CHOICES.find(d => d.key === duration);
    const organName = currentRegionalData.hindiName.split('(')[0].trim();
    const textToAdd = `${organName} में ${sensation.label} [${sensation.en}] (${sevObj?.label || ''}, ${durObj?.label || ''})`;
    const newTranscript = transcript ? `${transcript}। ${textToAdd}` : textToAdd;
    setTranscript(newTranscript);
    triggerClinicalParse(newTranscript);
  };

  const toggleRecording = () => {
    setMicErrorMessage(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicErrorMessage('Speech API not supported in this browser. Please type symptoms directly.');
      return;
    }

    if (isRecording) {
      try { sovereignSound.playMechanicalSnap(); } catch {}
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      if (transcript.trim()) {
        triggerClinicalParse(transcript);
      }
    } else {
      try { sovereignSound.playMechanicalSnap(); } catch {}
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = micLanguage;

        recognition.onstart = () => {
          setIsRecording(true);
          setParseSuccess(false);
        };

        recognition.onresult = (event: any) => {
          let fullStr = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullStr += event.results[i][0].transcript;
          }
          if (fullStr) {
            setTranscript(fullStr);
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('[Kiosk Voice Intake] Speech Error:', err);
          if (err.error === 'not-allowed') {
            setMicErrorMessage('Microphone access denied. Please allow microphone permission.');
          } else if (err.error === 'no-speech') {
            setMicErrorMessage('No speech detected. Please speak closer to microphone.');
          }
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (e: any) {
        console.error('Speech recognition failed to start:', e);
        setMicErrorMessage(e.message || 'Microphone initialization failed.');
        setIsRecording(false);
      }
    }
  };

  const triggerClinicalParse = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setIsParsing(true);
    setParseSuccess(false);
    try {
      const extracted = await api.parseAudioTranscript(textToParse);
      onExtractedSymptoms(
        extracted.symptoms,
        extracted.vitals,
        extracted.redFlagTriggers || [],
        {
          causalDagOverride: extracted.causalDagOverride,
          mlcCaseInfo: extracted.mlcCaseInfo,
          airborneIsolationInfo: extracted.airborneIsolationInfo
        }
      );
      setParseSuccess(true);
      try { sovereignSound.playCrystalChime(); } catch {}
    } catch (e) {
      console.error('Clinical parse error:', e);
    } finally {
      setIsParsing(false);
    }
  };

  // Adaptive Multi-Modal Symptom & Locus Synthesizer:
  // Combines 3D touched locus + Spoken acoustic transcript + Systemic clinical category
  const dynamicSymptomData = useMemo(() => {
    // 1. If user selected a specific 3D body organ, use that organ's specific clinical profile or universal ontology
    if (selectedBodyRegion) {
      if (REGIONAL_COMPLAINTS[selectedBodyRegion]) {
        return REGIONAL_COMPLAINTS[selectedBodyRegion];
      }
      const profile = getClinicalProfile(selectedBodyRegion, transcript);
      return {
        hindiName: selectedBodyRegion,
        enName: selectedBodyRegion,
        symptoms: profile.symptoms,
        ayushContext: profile.srotas
      };
    }

    // 2. If user spoke in the mic, detect voice intent to automatically match the best category
    const text = (transcript || '').toLowerCase();
    let effectiveCategory = systemicCategory;

    if (text.includes('बुखार') || text.includes('fever') || text.includes('ठंड') || text.includes('ताप') || text.includes('chills') || text.includes('कंपकंपी')) {
      effectiveCategory = 'fever';
    } else if (text.includes('सीना') || text.includes('छाती') || text.includes('chest') || text.includes('heart') || text.includes('धड़कन') || text.includes('palpitation') || text.includes('सांस') || text.includes('दमा') || text.includes('खांसी') || text.includes('cough') || text.includes('breath') || text.includes('बलगम')) {
      effectiveCategory = 'cardiorespiratory';
    } else if (text.includes('पेट') || text.includes('acid') || text.includes('जलन') || text.includes('gas') || text.includes('vomit') || text.includes('दस्त') || text.includes('कब्ज') || text.includes('stomach') || text.includes('उल्टी') || text.includes('मरोड़')) {
      effectiveCategory = 'gastro';
    } else if (text.includes('घुटना') || text.includes('कमर') || text.includes('पीठ') || text.includes('जोड़') || text.includes('हड्डी') || text.includes('knee') || text.includes('back') || text.includes('joint') || text.includes('spine') || text.includes('कट-कट')) {
      effectiveCategory = 'ortho';
    } else if (text.includes('सिर') || text.includes('चक्कर') || text.includes('माइग्रेन') || text.includes('headache') || text.includes('vertigo') || text.includes('migraine')) {
      effectiveCategory = 'neuro';
    } else if (text.includes('खुजली') || text.includes('दाने') || text.includes('चकत्ते') || text.includes('त्वचा') || text.includes('skin') || text.includes('rash') || text.includes('itch')) {
      effectiveCategory = 'dermatology';
    }

    const cat = SYSTEMIC_COMPLAINT_CATEGORIES[effectiveCategory] || SYSTEMIC_COMPLAINT_CATEGORIES.general;

    return {
      hindiName: cat.titleHi,
      enName: cat.titleEn,
      symptoms: cat.symptoms,
      ayushContext: 'Samanya Sharira · Tri-Dosha & Srotas Evaluation'
    };
  }, [selectedBodyRegion, transcript, systemicCategory]);

  const currentRegionalData = dynamicSymptomData;
  const clusterKey = LOCUS_TO_CLUSTER[selectedBodyRegion];
  const currentCluster = clusterKey ? CLUSTER_DISAMBIGUATION[clusterKey] : null;
  const congruenceMismatch = useMemo(() => evaluateCongruenceMismatch(selectedBodyRegion, transcript), [selectedBodyRegion, transcript]);
  const activeSensations = UNIVERSAL_SENSATIONS;

  const handleAudioGuidance = () => {
    try {
      sovereignSound.playMechanicalSnap();
      const guidanceTexts: Record<string, string> = {
        'hi-IN': subPhase === 'body'
          ? 'कृपया 3D शरीर मॉडल पर अपनी तकलीफ़ का अंग छूकर बताएं, फिर आगे बढ़ें बटन दबाएं।'
          : 'कृपया माइक दबाकर अपनी तकलीफ़ बोलें या नीचे दिए गए लक्षणों को चुनें।',
        'en-IN': subPhase === 'body'
          ? 'Please touch your painful organ on the 3D model, then tap continue.'
          : 'Please tap the microphone button to speak your symptoms or tap choices below.'
      };
      sovereignSound.speakGuidance(guidanceTexts[micLanguage] || guidanceTexts['hi-IN']);
    } catch {}
  };

  return (
    <div className="w-full mx-auto selection:bg-foreground selection:text-background animate-in fade-in duration-300">
      
      {/* =========================================================================
          PHASE 3.0: 100% PURE FULLSCREEN 3D ANATOMICAL BODY STAGE
          ========================================================================= */}
      {subPhase === 'body' && (
        <div className="relative w-full h-[calc(100vh-210px)] min-h-[640px] rounded-3xl overflow-hidden border border-border/80 shadow-md bg-card animate-in fade-in zoom-in-95 duration-300">
          
          {/* The Pristine 3D Mannequin Viewport (Full Cinematic Canvas) */}
          <AnatomicalMannequin3D
            selectedRegion={selectedBodyRegion}
            onSelectRegion={handleRegionClick}
            viewMode={mannequinView}
            onViewModeChange={setMannequinView}
            isPrivateMode={isPrivateMode}
            activeMacroZone={activeMacroZone}
            onMacroZoneChange={setActiveMacroZone}
            className="w-full h-full rounded-3xl border-0"
            showAngleControls={true}
            hideHeaderControls={true}
          />

          {/* Top Diagnostic HUD Bar - Unified, Never Overlapping */}
          <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-auto flex-wrap">
            {/* Left: Selected Organ Status / Instruction */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-md">
                <HeartPulse size={18} className={`shrink-0 ${selectedBodyRegion ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold">
                    {selectedBodyRegion ? 'चयनित अंग' : 'शरीर पर छुएं'}
                  </span>
                  <span className="font-heading font-extrabold text-sm sm:text-base text-foreground">
                    {selectedBodyRegion ? (
                      <span className="text-primary">{currentRegionalData.hindiName}</span>
                    ) : (
                      <span className="text-muted-foreground font-medium text-xs sm:text-sm">तकलीफ़ का स्थान छुएं</span>
                    )}
                  </span>
                </div>
                {selectedBodyRegion && (
                  <button
                    type="button"
                    onClick={() => handleRegionClick(selectedBodyRegion)}
                    className="ml-2 px-2 py-1 rounded-xl bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Full Body View / संपूर्ण शरीर देखें"
                  >
                    <CornerUpLeft size={12} />
                    <span className="text-[11px]">हटाएं</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: Orientation Tag + Audio Guidance + Private Mode */}
            <div className="flex items-center gap-2">
              {/* Orientation Tag */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-card/95 backdrop-blur-md rounded-xl border border-border/80 text-xs font-mono text-foreground shadow-xs">
                <span className="text-muted-foreground">दायां (R)</span>
                <span className="text-border">|</span>
                <span className="font-semibold text-foreground">बायां (L)</span>
              </div>

              {/* Audio Guidance */}
              <button
                type="button"
                onClick={handleAudioGuidance}
                className="tactile-btn h-9 px-3.5 rounded-xl bg-card/95 backdrop-blur-md text-primary border border-border/80 text-xs font-bold gap-1.5 shadow-sm cursor-pointer hover:bg-muted flex items-center"
                title="Audio Guidance / निर्देश सुनें"
              >
                <Volume2 size={15} />
                <span>सुनें</span>
              </button>

              {/* Private Mode */}
              <button
                type="button"
                onClick={() => {
                  try { sovereignSound.playMechanicalSnap(); } catch {}
                  setIsPrivateMode(!isPrivateMode);
                }}
                className={`tactile-btn h-9 px-3.5 rounded-xl backdrop-blur-md text-xs font-bold gap-1.5 shadow-sm cursor-pointer transition-all border flex items-center ${
                  isPrivateMode
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                    : 'bg-card/95 text-muted-foreground hover:text-foreground border-border/80'
                }`}
                title="Sensitive Mode"
              >
                {isPrivateMode ? <EyeOff size={15} /> : <Shield size={15} />}
                <span>{isPrivateMode ? 'निजी' : 'निजी'}</span>
              </button>
            </div>
          </div>

          {/* Floating Emergency / Congruence Alert Overlay in Phase 3.0 (When Voice detected Divergence) */}
          {congruenceMismatch && (
            <div className="absolute top-20 left-4 right-4 z-30 pointer-events-auto">
              <div className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-3 duration-300 ${
                congruenceMismatch.isEmergency
                  ? 'bg-rose-500/90 text-white border-rose-400/80 shadow-rose-950/30 ring-2 ring-rose-300/40'
                  : 'bg-card/95 text-foreground border-amber-500/60 shadow-md'
              }`}>
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    congruenceMismatch.isEmergency ? 'bg-white text-rose-600' : 'bg-amber-500/20 text-amber-600'
                  }`}>
                    <HeartPulse size={22} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider opacity-90">
                      {congruenceMismatch.isEmergency ? 'तत्काल ध्यान दें (Emergency Attention)' : 'सुझाव (Recommendation)'}
                    </span>
                    <span className="font-heading font-extrabold text-xs sm:text-sm truncate">
                      {congruenceMismatch.reasonHindi}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchWithComorbidity(congruenceMismatch.suggestedLocusId)}
                  className={`px-4 py-2 text-xs font-heading font-extrabold rounded-xl cursor-pointer shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1.5 ${
                    congruenceMismatch.isEmergency
                      ? 'bg-white text-rose-700 hover:bg-white/90 ring-1 ring-white/50'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  <span>{congruenceMismatch.suggestedLocusHindi.split('(')[0].trim()} चुनें</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Floating Bottom Navigation Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
            {/* Left: Back to Step 2 */}
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto tactile-btn px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-md text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground border border-border/80 shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft size={16} />
              <span>पिछला (Back)</span>
            </button>

            {/* Right: Continue to Step 3.1 Symptoms & Voice Studio (Compulsory Gated) */}
            <button
              type="button"
              disabled={!selectedBodyRegion}
              onClick={() => {
                if (!selectedBodyRegion) return;
                try { sovereignSound.playMechanicalSnap(); } catch {}
                setSubPhase('symptoms');
              }}
              className={`pointer-events-auto btn px-7 py-3.5 rounded-2xl text-sm font-heading font-extrabold flex items-center gap-2.5 shadow-xl transition-all active:scale-95 ${
                selectedBodyRegion
                  ? 'btn-primary hover:shadow-2xl cursor-pointer ring-2 ring-primary/40'
                  : 'bg-muted text-muted-foreground/60 cursor-not-allowed border border-border/40 opacity-70'
              }`}
            >
              <span>
                {selectedBodyRegion
                  ? `आगे बढ़ें: ${currentRegionalData.hindiName.split('(')[0].trim()}`
                  : 'शरीर पर तकलीफ़ का अंग चुनें (Select Body Part)'}
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PHASE 3.1: SOVEREIGN HAUTE LUXURY VOICE & CLINICAL SYMPTOMS STUDIO
          ========================================================================= */}
      {subPhase === 'symptoms' && (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300 py-2">
          
          {/* 1. Flagship AIIA Clinical Header Banner */}
          <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <HeartPulse size={24} />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                  चयनित अंग (Selected Area)
                </span>
                <span className="font-heading font-extrabold text-lg sm:text-xl text-foreground truncate">
                  {currentRegionalData.hindiName}
                </span>
                {currentRegionalData.enName && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentRegionalData.enName}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                try { sovereignSound.playMechanicalSnap(); } catch {}
                setSubPhase('body');
              }}
              className="tactile-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-primary border-primary/30 hover:bg-primary/10 flex items-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95"
            >
              <Edit3 size={14} />
              <span>अंग बदलें (Change Organ)</span>
            </button>
          </div>

          {/* 2. Semantic Congruence Alert (Only when mismatch detected) */}
          {congruenceMismatch && (
            <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
              congruenceMismatch.isEmergency
                ? 'bg-rose-500/10 border-rose-500/50 text-foreground ring-2 ring-rose-500/20'
                : 'bg-amber-500/10 border-amber-500/50 text-foreground ring-1 ring-amber-500/20'
            }`}>
              <div className="flex items-start gap-3.5 min-w-0 text-left">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  congruenceMismatch.isEmergency
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                }`}>
                  {congruenceMismatch.isEmergency ? <HeartPulse size={22} /> : <AlertTriangle size={20} />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10.5px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      congruenceMismatch.isEmergency
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    }`}>
                      {congruenceMismatch.isEmergency ? 'तत्काल ध्यान दें (Important)' : 'सुझाव (Recommendation)'}
                    </span>
                  </div>
                  <span className="font-heading font-bold text-sm sm:text-base text-foreground leading-snug">
                    {congruenceMismatch.reasonHindi}
                  </span>
                  <span className="text-xs text-muted-foreground font-sans mt-0.5">
                    {congruenceMismatch.reasonEn}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleSwitchWithComorbidity(congruenceMismatch.suggestedLocusId)}
                  className={`w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-heading font-extrabold rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    congruenceMismatch.isEmergency
                      ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/40'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <span>{congruenceMismatch.suggestedLocusHindi.split('(')[0].trim()} चुनें</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* 3. Clinical Disambiguation (Clean Aesthetic Grid) */}
          {currentCluster && (
            <div className="p-4 rounded-2xl bg-card border border-border/80 flex flex-col gap-3 shadow-xs">
              <span className="text-xs sm:text-sm font-heading font-bold text-foreground flex items-center gap-2">
                <Activity size={16} className="text-primary shrink-0" />
                <span>{currentCluster.promptHindi}</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {currentCluster.options.map((opt) => {
                  const isOptSelected = selectedBodyRegion === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleRegionClick(opt.id)}
                      className={`p-3 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                        isOptSelected
                          ? opt.isEmergency
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                            : 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                          : 'bg-muted/40 hover:bg-muted text-foreground border-border/70 font-semibold'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold">{opt.hindiLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Luxury Ambient Speech Studio */}
          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-4 shadow-xs">
            
            {/* Studio Header with Clean Language Selector */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/70 flex-wrap">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-primary" />
                <span className="font-heading font-extrabold text-sm sm:text-base text-foreground">
                  बोलकर बताएं (Speak Symptoms)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">भाषा:</span>
                <select
                  value={micLanguage}
                  onChange={(e) => setMicLanguage(e.target.value as any)}
                  className="text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-xl border border-border bg-background text-foreground cursor-pointer shadow-2xs"
                >
                  <option value="hi-IN">Hindi (हिंदी)</option>
                  <option value="en-IN">English (Indian)</option>
                  <option value="mr-IN">Marathi (मराठी)</option>
                  <option value="bn-IN">Bengali (বাংলা)</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="gu-IN">Gujarati (ગુજરાતી)</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                  <option value="pa-IN">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="ml-IN">Malayalam (മലയാളം)</option>
                </select>

                {parseSuccess && (
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 size={13} />
                    <span>सत्यापित (Saved)</span>
                  </div>
                )}
              </div>
            </div>

            {micErrorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {micErrorMessage}
              </div>
            )}

            {/* Live Transcription Box with Error Recovery & Edit Controls */}
            <div className="relative min-h-[105px] p-4 rounded-2xl bg-muted/30 border border-border/70 text-left flex flex-col justify-between gap-3">
              {isPrivateMode && !isPeekActive ? (
                <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/80 rounded-2xl flex items-center justify-center p-3 text-center border border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-heading font-bold text-xs">
                    <Lock size={14} />
                    <span>गोपनीय दृष्टि कवच सक्रिय (Private Mode)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPeekActive(true)}
                    className="tactile-btn ml-3 px-3 py-1 text-xs text-foreground font-bold rounded-lg cursor-pointer"
                  >
                    देखें (Peek)
                  </button>
                </div>
              ) : null}

              {/* Main Transcript Content / Textarea Edit Mode */}
              {isManualEditing ? (
                <div className="flex flex-col gap-2 w-full">
                  <textarea
                    value={manualTextDraft}
                    onChange={(e) => setManualTextDraft(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 rounded-xl border border-primary/50 bg-background text-foreground text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="लक्षण टाइप करें या सुधारें..."
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManualEditing(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                    >
                      रद्द करें (Cancel)
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveManualEdit}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                    >
                      सहेजें (Save)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {transcript ? (
                    <p className="font-sans text-sm sm:text-base font-medium text-foreground leading-relaxed pr-2">
                      "{transcript}"
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground font-sans">
                      माइक दबाकर बोलें: अपनी तकलीफ़ बताएं, जैसे "सीने में दर्द है" या "बुखार है"...
                    </p>
                  )}

                  {/* Correction & Action Bar */}
                  {transcript && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                        गलत लिखा है? (Correction):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleUndoLastClause}
                          className="px-2.5 py-1 rounded-lg bg-muted/80 hover:bg-muted text-foreground text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all border border-border/70"
                          title="Undo"
                        >
                          <Undo2 size={12} className="text-primary" />
                          <span>हटाएं (Undo)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try { sovereignSound.playMechanicalSnap(); } catch {}
                            setManualTextDraft(transcript);
                            setIsManualEditing(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-muted/80 hover:bg-muted text-foreground text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all border border-border/70"
                          title="Edit Transcript Manually / सुधारें"
                        >
                          <Edit3 size={12} className="text-primary" />
                          <span>सुधारें (Edit)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearTranscript}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all border border-rose-500/30"
                          title="Clear Everything / सब साफ करें"
                        >
                          <Trash2 size={12} />
                          <span>साफ करें (Clear)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Live Audio Waveform */}
            <div>
              <AudioVisualizer isRecording={isRecording} color="#0284c7" height={28} />
            </div>

            {/* Tactile Voice Hero Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-full sm:w-auto min-w-[220px] py-3.5 px-8 text-sm sm:text-base font-heading font-bold rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-md active:scale-95 ${
                  isRecording
                    ? 'bg-rose-600 text-white ring-4 ring-rose-400/30 shadow-lg'
                    : 'bg-primary text-primary-foreground hover:bg-primary/95'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff size={20} />
                    <span>बोलना रोकें (Stop Recording)</span>
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    <span>बोलें (Tap to Speak)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 5. Precision Triage Matrix: Symptoms, Severity, Duration, Sensation */}
          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-5 shadow-xs">
            
            {/* Quick 1-Tap Symptom Chips */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground text-left">
                    1. सामान्य लक्षण (Symptoms)
                  </span>
                </div>
                <span className="text-xs font-heading font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
                  {currentRegionalData.hindiName.split('(')[0].trim()}
                </span>
              </div>

              {/* Systemic Category Filter Strip (When on Full Body / General or Exploring) */}
              {!selectedBodyRegion && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-1">
                  {[
                    { id: 'general', label: 'प्रमुख लक्षण' },
                    { id: 'fever', label: 'बुखार व संक्रमण' },
                    { id: 'cardiorespiratory', label: 'सीना व सांस' },
                    { id: 'gastro', label: 'पेट व पाचन' },
                    { id: 'ortho', label: 'जोड़ व कमर' },
                    { id: 'neuro', label: 'सिरदर्द व चक्कर' },
                    { id: 'dermatology', label: 'त्वचा व एलर्जी' }
                  ].map((cat) => {
                    const isCatActive = systemicCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          try { sovereignSound.playMechanicalSnap(); } catch {}
                          setSystemicCategory(cat.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold shrink-0 transition-all cursor-pointer border ${
                          isCatActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border/70'
                        }`}
                      >
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentRegionalData.symptoms.map((sym, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSymptom(sym)}
                    className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs active:scale-98 group ${
                      sym.isEmergency
                        ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-muted/40 hover:bg-primary/10 border-border/70 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                          {sym.hi}
                        </span>
                        {sym.isEmergency && (
                          <span className="text-[9.5px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase shrink-0">
                            आपातकाल
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] font-mono text-muted-foreground truncate mt-0.5">
                        {sym.en}
                      </span>
                    </div>
                    <div className="h-7 w-7 rounded-xl bg-background/80 border border-border/80 flex items-center justify-center shrink-0 text-primary font-bold text-base group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shadow-2xs">
                      +
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity & Duration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              
              {/* Severity Segmented Toggle */}
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground mb-2.5 block text-left">
                  2. दर्द की तीव्रता (Severity)
                </span>
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border/70">
                  {SEVERITY_LEVELS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        try { sovereignSound.playMechanicalSnap(); } catch {}
                        setSeverity(s.key as any);
                      }}
                      className={`py-2 px-2 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${
                        severity === s.key
                          ? 'bg-card text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      <span className="text-xs font-heading font-bold">{s.label}</span>
                      <span className="text-[9.5px] font-mono opacity-80">{s.en}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Capsule Tabs */}
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground mb-2.5 block text-left">
                  3. कब से है? (Duration)
                </span>
                <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-muted/40 border border-border/70">
                  {DURATION_CHOICES.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        try { sovereignSound.playMechanicalSnap(); } catch {}
                        setDuration(d.key as any);
                      }}
                      className={`py-2 px-1 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${
                        duration === d.key
                          ? 'bg-card text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      <span className="text-xs font-heading font-bold truncate">{d.label}</span>
                      <span className="text-[9.5px] font-mono opacity-80 truncate">{d.en}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Organ-Adaptive Symptom Character & Sensation */}
            <div className="pt-4 border-t border-border/60">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block text-left">
                  4. कैसा दर्द या तकलीफ़ है? (Sensation)
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {currentRegionalData.enName}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {activeSensations.map((sens) => {
                  const Icon = sens.icon;
                  return (
                    <button
                      key={sens.key}
                      type="button"
                      onClick={() => handleAddSensation(sens)}
                      className="p-3 rounded-2xl border border-border/70 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-center cursor-pointer transition-all active:scale-95 shadow-2xs flex flex-col items-center justify-center gap-1 group"
                    >
                      <Icon size={18} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-heading font-bold text-foreground truncate w-full text-center group-hover:text-primary transition-colors">
                        {sens.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate w-full text-center">
                        {sens.en}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Confidential Private Sanctuaries (When Private Mode Active) */}
          {isPrivateMode && (
            <div className="p-5 rounded-3xl border border-amber-500/40 bg-amber-500/5 flex flex-col gap-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-amber-500" />
                  <span className="font-heading font-bold text-sm text-foreground">
                    निजी मोड : गोपनीय स्वास्थ्य श्रेणियाँ
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  <VolumeX size={12} />
                  <span>Acoustic Mute Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRIVATE_SANCTUARIES.map((sanct) => (
                  <div key={sanct.id} className="p-3.5 rounded-2xl flex flex-col gap-1.5 bg-background/90 border border-amber-500/20">
                    <span className="font-heading font-bold text-xs text-foreground">
                      {sanct.title}
                    </span>
                    <div className="flex flex-col gap-1">
                      {sanct.symptoms.map((psym, pidx) => (
                        <button
                          key={pidx}
                          type="button"
                          onClick={() => handleAddSymptom(psym)}
                          className="text-left text-xs text-foreground/80 hover:text-primary hover:underline py-0.5 cursor-pointer truncate font-medium"
                        >
                          + {psym}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Step 3.1 Action Navigation */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/70">
            <button
              type="button"
              onClick={() => {
                try { sovereignSound.playMechanicalSnap(); } catch {}
                setSubPhase('body');
              }}
              className="tactile-btn px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground border border-border/80 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft size={16} />
              <span>3D मॉडल पर वापस जाएं (Back to 3D)</span>
            </button>

            {/* Right: Continue to Step 4 Details (Compulsory Gated: requires symptom or voice transcript) */}
            <button
              type="button"
              disabled={!transcript || transcript.trim().length === 0}
              onClick={() => {
                if (!transcript || transcript.trim().length === 0) return;
                try { sovereignSound.playMechanicalSnap(); } catch {}
                onNext();
              }}
              className={`btn px-7 py-3.5 rounded-2xl text-sm font-heading font-extrabold flex items-center gap-2.5 shadow-xl transition-all active:scale-95 ${
                transcript && transcript.trim().length > 0
                  ? 'btn-primary hover:shadow-2xl cursor-pointer'
                  : 'bg-muted text-muted-foreground/60 cursor-not-allowed border border-border/40 opacity-70'
              }`}
            >
              <span>
                {transcript && transcript.trim().length > 0
                  ? 'आगे बढ़ें: दर्द विवरण (Next: Details)'
                  : 'लक्षण चुनें या बोलें (Select or Speak Symptoms)'}
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
