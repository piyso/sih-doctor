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
  Layers,
  Box,
  Target,
  HeartPulse,
  Maximize2,
  Sliders,
  User,
  Activity,
  Heart,
  Bone,
  Search,
  X,
  ArrowRight
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
import { AnatomicalMannequinModal3D } from './AnatomicalMannequinModal3D';

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
  reasonHindi: string;
  reasonEn: string;
  triggerPhrase: string;
  isEmergency?: boolean;
}

// Patent-Grade Semantic Symptom-Locus Congruence Cross-Validator
const evaluateCongruenceMismatch = (
  selectedRegion: string,
  transcriptText: string
): CongruenceRecommendation | null => {
  if (!selectedRegion || !transcriptText) return null;
  const text = transcriptText.toLowerCase();

  // 1. CARDIAC vs PULMONARY / RESPIRATORY / ACIDITY
  if (selectedRegion === 'Left Chest / Precordium') {
    // Pulmonary keywords
    const pulmonaryKeywords = ['खांसी', 'cough', 'दमा', 'asthma', 'बलगम', 'phlegm', 'सीटी', 'wheezing', 'जुकाम', 'cold', 'सांस फूल'];
    const matchedPulmonary = pulmonaryKeywords.find(k => text.includes(k));
    if (matchedPulmonary) {
      return {
        suggestedLocusId: 'Lungs & Respiration',
        suggestedLocusHindi: 'फेफड़े व सांस (Lungs & Respiration)',
        reasonHindi: `आपके विवरण में '${matchedPulmonary}' का उल्लेख है, जो फेफड़ों से संबंधित प्रतीत होता है।`,
        reasonEn: `Respiratory symptom detected ('${matchedPulmonary}').`,
        triggerPhrase: matchedPulmonary
      };
    }

    // Acidity / GERD keywords
    const acidityKeywords = ['खट्टी डकार', 'acidity', 'एसिडिटी', 'जलन', 'heartburn', 'अम्लपित्त', 'गैस', 'खाना खाने के बाद', 'खाली पेट'];
    const matchedAcidity = acidityKeywords.find(k => text.includes(k));
    if (matchedAcidity) {
      return {
        suggestedLocusId: 'Epigastrium',
        suggestedLocusHindi: 'सीने में जलन / एसिडिटी (Epigastrium)',
        reasonHindi: `विवरण में '${matchedAcidity}' का उल्लेख है — क्या यह एसिडिटी/अम्लपित्त की जलन है?`,
        reasonEn: `Reflux/acidity symptom detected ('${matchedAcidity}').`,
        triggerPhrase: matchedAcidity
      };
    }
  }

  // 2. CRANIAL vs EAR vs THROAT vs SINUS vs CERVICAL
  if (selectedRegion === 'Head') {
    // Ear check
    const earKeywords = ['कान', 'ear', 'कनपटी', 'टीस', 'बहना', 'कम सुनाई', 'tinnitus'];
    const matchedEar = earKeywords.find(k => text.includes(k));
    if (matchedEar) {
      return {
        suggestedLocusId: 'Ear',
        suggestedLocusHindi: 'कान (Ear & Hearing)',
        reasonHindi: `विवरण में '${matchedEar}' का उल्लेख है — क्या मुख्य तकलीफ़ कान में है?`,
        reasonEn: `Ear symptom detected ('${matchedEar}').`,
        triggerPhrase: matchedEar
      };
    }

    // Throat check
    const throatKeywords = ['गला', 'throat', 'खराश', 'निगलने', 'टॉन्सिल', 'आवाज़ बैठना', 'थाइरॉइड'];
    const matchedThroat = throatKeywords.find(k => text.includes(k));
    if (matchedThroat) {
      return {
        suggestedLocusId: 'Neck',
        suggestedLocusHindi: 'गला / गर्दन (Throat & Larynx)',
        reasonHindi: `विवरण में '${matchedThroat}' का उल्लेख है — क्या तकलीफ़ गले में है?`,
        reasonEn: `Throat symptom detected ('${matchedThroat}').`,
        triggerPhrase: matchedThroat
      };
    }

    // Sinus check
    const sinusKeywords = ['साइनस', 'sinus', 'चेहरा', 'गाल', 'आँखों में जलन', 'नाक बंद', 'छींक'];
    const matchedSinus = sinusKeywords.find(k => text.includes(k));
    if (matchedSinus) {
      return {
        suggestedLocusId: 'Face & Sinus',
        suggestedLocusHindi: 'चेहरा व आँखें (Face & Sinuses)',
        reasonHindi: `विवरण में '${matchedSinus}' का उल्लेख है — क्या यह साइनस का भारीपन है?`,
        reasonEn: `Sinus/facial congestion detected ('${matchedSinus}').`,
        triggerPhrase: matchedSinus
      };
    }

    // Cervical check
    const cervicalKeywords = ['गर्दन अकड़', 'गर्दन घुमाने', 'cervical', 'गर्दन में दर्द'];
    const matchedCervical = cervicalKeywords.find(k => text.includes(k));
    if (matchedCervical) {
      return {
        suggestedLocusId: 'Cervical Spine',
        suggestedLocusHindi: 'गर्दन की नसें (Cervical Spine)',
        reasonHindi: `विवरण में गर्दन की जकड़न का उल्लेख है — क्या यह सर्वाइकल है?`,
        reasonEn: `Cervical radiculopathy detected ('${matchedCervical}').`,
        triggerPhrase: matchedCervical
      };
    }
  }

  // 3. ABDOMEN (EPIGASTRIUM / UMBILICUS) vs CARDIAC INFERIOR WALL MI vs RLQ vs LLQ vs PELVIS
  if (selectedRegion === 'Epigastrium' || selectedRegion === 'Umbilicus / Mid-Abdomen') {
    // Atypical Cardiac Angina (Inferior Wall MI Rule)
    const cardiacAnginaKeywords = ['सीना', 'छाती', 'बायां कंधा', 'पसीना', 'घबराहट', 'chest', 'sweat', 'left arm', 'जबड़े', 'jaw', 'दिल डूबना'];
    const matchedCardiac = cardiacAnginaKeywords.find(k => text.includes(k));
    if (matchedCardiac) {
      return {
        suggestedLocusId: 'Left Chest / Precordium',
        suggestedLocusHindi: 'बायां सीना / हृदय (Cardiac Precordium)',
        reasonHindi: `ध्यान दें: पेट के ऊपरी दर्द के साथ '${matchedCardiac}' का होना हृदय शूल (Cardiac Angina / Inferior MI) का संकेत हो सकता है।`,
        reasonEn: `Cardiac radiation warning ('${matchedCardiac}').`,
        triggerPhrase: matchedCardiac,
        isEmergency: true
      };
    }

    // RLQ / Appendix Check
    const rlqKeywords = ['दाहिने तरफ नीचे', 'दायां निचला', 'right lower', 'अपेंडिक्स', 'appendix', 'दाएं पेट', 'mcburney'];
    const matchedRlq = rlqKeywords.find(k => text.includes(k));
    if (matchedRlq) {
      return {
        suggestedLocusId: 'Right Lower Quadrant (RLQ)',
        suggestedLocusHindi: 'दायां निचला पेट (RLQ / Appendix)',
        reasonHindi: `दाहिने निचले पेट का दर्द अपेंडिक्स (Appendix · उण्डुक शूल) से संबंधित हो सकता है।`,
        reasonEn: `Right lower quadrant signs detected ('${matchedRlq}').`,
        triggerPhrase: matchedRlq,
        isEmergency: true
      };
    }

    // LLQ / Left Kidney Stone / Colic Check
    const llqKeywords = ['बाएं पेट', 'बायां निचला', 'left lower', 'पथरी', 'गुर्दा', 'kidney stone', 'कमर से आगे'];
    const matchedLlq = llqKeywords.find(k => text.includes(k));
    if (matchedLlq) {
      return {
        suggestedLocusId: 'Left Lower Quadrant (LLQ)',
        suggestedLocusHindi: 'बायां निचला पेट / गुर्दा (LLQ)',
        reasonHindi: `बाएं तरफ का दर्द वृक्क / गुर्दे की पथरी (Left Renal Colic) से संबंधित प्रतीत होता है।`,
        reasonEn: `Left lower quadrant renal colic detected ('${matchedLlq}').`,
        triggerPhrase: matchedLlq
      };
    }

    // Pelvic / Lower Abdomen / Bladder / UTI Check
    const pelvicKeywords = ['निचला पेट', 'निचले पेट', 'नीचे का पेट', 'पेशाब में जलन', 'पेशाब रुक', 'पेडू', 'मासिक धर्म', 'period', 'bladder', 'uti', 'dysuria', 'lower belly', 'pelvic'];
    const matchedPelvic = pelvicKeywords.find(k => text.includes(k));
    if (matchedPelvic) {
      return {
        suggestedLocusId: 'Pelvic / Hypogastrium',
        suggestedLocusHindi: 'निचला पेट / पेडू (Pelvis & Bladder)',
        reasonHindi: `विवरण में '${matchedPelvic}' का उल्लेख है — क्या तकलीफ़ निचले पेट / पेडू में है?`,
        reasonEn: `Pelvic / Lower abdominal symptoms detected ('${matchedPelvic}').`,
        triggerPhrase: matchedPelvic
      };
    }
  }

  // 3b. LOWER ABDOMEN / PELVIS / RLQ / LLQ vs UPPER ABDOMEN
  if (selectedRegion === 'Pelvic / Hypogastrium' || selectedRegion === 'Right Lower Quadrant (RLQ)' || selectedRegion === 'Left Lower Quadrant (LLQ)') {
    const upperAbdomenKeywords = ['ऊपरी पेट', 'ऊपर का पेट', 'सीने के नीचे', 'अम्लपित्त', 'खट्टी डकार', 'आमाशय', 'epigastrium', 'upper stomach', 'acidity', 'gastritis'];
    const matchedUpper = upperAbdomenKeywords.find(k => text.includes(k));
    if (matchedUpper) {
      return {
        suggestedLocusId: 'Epigastrium',
        suggestedLocusHindi: 'ऊपरी पेट / अम्लपित्त (Epigastrium)',
        reasonHindi: `विवरण में '${matchedUpper}' का उल्लेख है — क्या तकलीफ़ ऊपरी पेट / आमाशय में है?`,
        reasonEn: `Upper abdominal / epigastric symptom detected ('${matchedUpper}').`,
        triggerPhrase: matchedUpper
      };
    }
  }

  // 4. SHOULDER vs CERVICAL SPINE vs CARDIAC
  if (selectedRegion === 'Left Shoulder' || selectedRegion === 'Right Shoulder') {
    const cervicalKeywords = ['गर्दन', 'cervical', 'गर्दन घुमाने', 'सिर के पीछे'];
    const matchedCervical = cervicalKeywords.find(k => text.includes(k));
    if (matchedCervical) {
      return {
        suggestedLocusId: 'Cervical Spine',
        suggestedLocusHindi: 'गर्दन की रीढ़ (Cervical Spine)',
        reasonHindi: `कंधे के साथ '${matchedCervical}' का उल्लेख है — क्या दर्द गर्दन से उतर रहा है (Cervical Radiculopathy)?`,
        reasonEn: `Cervical origin detected ('${matchedCervical}').`,
        triggerPhrase: matchedCervical
      };
    }
  }

  // 5. SPINE vs SCIATICA
  if (selectedRegion === 'Lumbar Spine (Kati)' || selectedRegion === 'Upper Back / Thoracic' || selectedRegion === 'Sacral / Sciatica Origin') {
    const sciaticaKeywords = ['पैर में दर्द', 'पिंडली', 'तलवे', 'नस दब', 'बिजली जैसी', 'sciatica', 'झनझनाहट', 'पैर सुन्न'];
    const matchedSciatica = sciaticaKeywords.find(k => text.includes(k));
    if (matchedSciatica) {
      return {
        suggestedLocusId: 'Sciatic Pathway / Calves',
        suggestedLocusHindi: 'पिंडलियाँ व पैर (Sciatic Pathway)',
        reasonHindi: `कमर से पैर में उतरता दर्द सायटिका (Gridhrasi Marma) की ओर संकेत करता है।`,
        reasonEn: `Sciatic pathway radiculopathy detected ('${matchedSciatica}').`,
        triggerPhrase: matchedSciatica
      };
    }
  }

  return null;
};

const REGIONAL_COMPLAINTS: Record<string, { symptoms: string[]; ayushContext: string }> = {
  'Head': {
    symptoms: ['सिर में तेज़ दर्द (Severe Headache)', 'आधासीसी दर्द (Migraine)', 'चक्कर व उल्टी (Vertigo & Bhrama)', 'सिर में भारीपन (Tension Headache)'],
    ayushContext: 'Shira Sthana · Adhipati & Sthapani Marma · Vata-Pitta'
  },
  'Face & Sinus': {
    symptoms: ['माथे व आँखों के पीछे भारी दबाव (Sinus Pressure / Shiroroga)', 'नाक बंद व सिर में भारीपन (Nasal Congestion / Pratishyaya)', 'आँखों में जलन व लालिमा (Eye Strain / Netra Roga)', 'चेहरे की नसों में बिजली जैसी टीस (Trigeminal Neuralgia)'],
    ayushContext: 'Netra & Nasa Sthana · Sthapani Marma · Alochaka Pitta'
  },
  'Ear': {
    symptoms: ['कान में असहनीय टीस या दर्द (Severe Earache / Karna Shula)', 'कान से पानी या मवाद आना (Ear Discharge / Karnasrava)', 'कान में सीटी या घंटी बजना (Tinnitus / Karnanada)', 'कम सुनाई देना या भारीपन (Hearing Fullness / Badhirya)'],
    ayushContext: 'Karna Sthana · Vata-Kapha Sthana · Shabdavaha Srotas'
  },
  'Neck': {
    symptoms: ['निगलने में तेज़ दर्द (Dysphagia)', 'गले में खराश व सूजन (Sore Throat)', 'गर्दन में अकड़न (Neck Stiffness / Manya Stambha)', 'थायरॉइड व टॉन्सिल सूजन (Gala Roga)'],
    ayushContext: 'Kantha & Griva Sthana · Udana Vata · Manya Marma'
  },
  'Left Chest / Precordium': {
    symptoms: ['सीने में भारी दबाव व बेचैनी (Crushing Retrosternal Pain)', 'बाएं कंधे व बांह में खिंचाव (Radiating to Left Arm)', 'अत्यधिक पसीना व घबराहट (Diaphoresis)', 'सांस फूलना व दिल डूबना (Dyspnea & Palpitations)'],
    ayushContext: 'Hridaya Sthana · Sadhyo Pranahara Marma · Prana Vata / Avalambaka Kapha'
  },
  'Right Chest': {
    symptoms: ['सांस लेने पर तेज़ चुभन (Pleuritic Stabbing Pain)', 'लगातार तेज़ खांसी व कफ (Persistent Cough / Kasa)', 'खांसी में खून (Hemoptysis - Red Flag)', 'घरघराहट व सांस का कष्ट (Wheezing / Shwasa)'],
    ayushContext: 'Phupphusa Sthana · Stanarohita Marma · Udana Vata / Kledaka Kapha'
  },
  'Lungs & Respiration': {
    symptoms: ['सांस फूलना व सीटी की आवाज़ (Dyspnea & Wheezing / Shwasa)', 'लगातार सूखी या बलगम वाली खांसी (Chronic Cough / Kasa)', 'सीने में जकड़न व घुटन (Chest Tightness / Kaphaja Avarana)', 'गहरी सांस लेने पर दर्द (Deep Inhalation Pain)'],
    ayushContext: 'Pranavaha Srotas · Phupphusa & Uras · Udana & Prana Vata'
  },
  'Left Shoulder': {
    symptoms: ['कंधा उठाने में असहनीय दर्द (Rotator Cuff Impingement)', 'हाथ पीछे न घूमना / जकड़न (Frozen Shoulder / Apabahuka)', 'कंधे में रात को तेज़ टीस (Nocturnal Shoulder Ache)', 'कंधे में सुन्नपन व कमजोरी (Shoulder Weakness)'],
    ayushContext: 'Vama Amsa Sandhi · Amsaphalaka Marma · Vataja Apabahuka'
  },
  'Right Shoulder': {
    symptoms: ['दाहिना कंधा उठाने में दर्द (Right Impingement)', 'कंधे में भारी जकड़न (Frozen Shoulder / Apabahuka)', 'मांसपेशी में खिंचाव व सूजन (Supraspinatus Tendinitis)', 'कंधे की हड्डी में कट-कट (Subacromial Crepitus)'],
    ayushContext: 'Dakshina Amsa Sandhi · Amsaphalaka Marma · Vataja Apabahuka'
  },
  'Left Arm': {
    symptoms: ['सीने से आता हुआ बांह का दर्द (Referred Cardiac Pain)', 'हाथ व उंगलियों में सुन्नपन (Numbness & Tingling)', 'कोहनी में दर्द (Cubital Tunnel / Tennis Elbow)', 'कलाई में कमजोरी (Grip Weakness)'],
    ayushContext: 'Vama Bahu · Amsa & Kakshadhara Marma · Vataja Apabahuka'
  },
  'Right Arm': {
    symptoms: ['कोहनी व कंधे में दर्द (Tennis Elbow / Tendinitis)', 'कलाई व उंगलियों में झुनझुनी (Carpal Tunnel Paresthesia)', 'बांह में सूजन व भारीपन (Arm Swelling)', 'हाथ का कांपना (Rest Tremors / Kampavata)'],
    ayushContext: 'Dakshina Bahu · Kurpara & Indrabasti Marma'
  },
  'Left Hand': {
    symptoms: ['कलाई व उंगलियों में दर्द (Wrist Arthritis)', 'हाथ सुन्न होना व झुनझुनी (Left Hand Numbness)', 'हथेली में जलन (Palmar Burning / Kara Daha)', 'पकड़ में कमजोरी (Weak Grip)'],
    ayushContext: 'Vama Manibandha & Talahridaya Marma · Vata Sthana'
  },
  'Right Hand': {
    symptoms: ['कलाई व उंगलियों में दर्द (Right Wrist Pain)', 'कार्पल टनल सिंड्रोम (Carpal Tunnel Numbness)', 'हाथ का कांपना (Hand Tremors)', 'उंगलियों में सुबह की जकड़न (Finger Stiffness)'],
    ayushContext: 'Dakshina Manibandha & Talahridaya Marma · Vata Sthana'
  },
  'Epigastrium': {
    symptoms: ['खट्टी डकार व सीने में जलन (Severe GERD / Amlapitta)', 'पेट के ऊपरी हिस्से में दर्द (Peptic Ulcer Pain)', 'जी मिचलाना व उल्टी (Nausea & Chhardi)', 'पेट का फूलना व अफारा (Bloating & Anaha)', 'खाली पेट दर्द व खट्टा पानी आना (Hyperacidity)'],
    ayushContext: 'Amashaya & Agni Sthana · Pachaka Pitta / Samana Vata'
  },
  'Umbilicus / Mid-Abdomen': {
    symptoms: ['नाभि के आसपास मरोड़ व गैस (Umbilical Colic / Shula)', 'पेट फूलना व गुड़गुड़ाहट (Bloating / Antrakujana)', 'दस्त या बार-बार शौच जाना (Loose Stools / Grahani)', 'नाभि खिसकना या खिंचाव (Nabhi Spasm / Samana Vata)', 'पेट में भारीपन व अपच (Indigestion / Ajirna)'],
    ayushContext: 'Nabhi Marma (Sira Marma) · Samana Vata & Pachaka Pitta'
  },
  'Right Lower Quadrant (RLQ)': {
    symptoms: ['नाभि से दाएं नीचे तेज़ दर्द (Appendicitis Colic)', 'हल्का छूने पर असहनीय दर्द (McBurney Rebound Tenderness)', 'बुखार व उल्टी के साथ पेट दर्द (Fever with Colic)', 'चलने या खांसने पर दाएं पेट में चुभन (Peritoneal Sign)'],
    ayushContext: 'Unduka Sthana · Pitta-Vata Vidradhi · Acute Surgical Locus'
  },
  'Left Lower Quadrant (LLQ)': {
    symptoms: ['बाएं निचले पेट में तेज़ चुभन (Left Iliac Fossa Pain)', 'गुर्दे की पथरी का दर्द (Left Renal Colic / Vrikka Ashmari)', 'कमर से पेट में उतरता दर्द (Flank Radiation)', 'पेट में सूजन व मरोड़ (Diverticulitis / Spastic Colon)'],
    ayushContext: 'Vama Kukundara & Pakvashaya Sthana · Apana Vata · Vrikka Ashmari'
  },
  'Pelvic / Hypogastrium': {
    symptoms: ['पेशाब में तेज़ जलन (Dysuria / Mutrakrichhra)', 'बार-बार पेशाब आना (Urinary Frequency)', 'पेल्विक में खिंचाव व ऐंठन (Pelvic Spasm)', 'कमर से नीचे तक पथरी का दर्द (Renal Calculi / Ashmari)', 'मासिक धर्म में असहनीय दर्द (Dysmenorrhea / Kashtartava)'],
    ayushContext: 'Basti Sthana · Sadhyo Pranahara Marma · Apana Vata'
  },
  'Left Hip': {
    symptoms: ['बाएं कूल्हे में जकड़न (Left Hip Joint Stiffness)', 'जांघ की मांसपेशी में खिंचाव (Adductor Strain)', 'चलने पर कूल्हे में लंगड़ाहट (Antalgic Gait)', 'कूल्हे की हड्डी में दर्द (Asthi Majja Gata Vata)'],
    ayushContext: 'Vama Nitamba Sandhi · Urvi & Lohitaksha Marma'
  },
  'Right Hip': {
    symptoms: ['दाहिने कूल्हे में दर्द (Right Hip Osteoarthritis)', 'उठने-बैठने में अकड़न (Morning Hip Stiffness)', 'जांघ के आगे तक दर्द (Femoral Radiation)', 'कूल्हे में कट-कट की आवाज़ (Hip Crepitus)'],
    ayushContext: 'Dakshina Nitamba Sandhi · Urvi & Lohitaksha Marma'
  },
  'Left Knee': {
    symptoms: ['बाएं घुटने में कट-कट की आवाज़ (Left Knee Crepitus)', 'घुटने में सूजन व दर्द (Osteoarthritis / Sandhivata)', 'सुबह उठने पर 30 मिनट तक अकड़न (Morning Stambha)', 'सीढ़ियाँ चढ़ने में कठिनाई (Patellofemoral Pain)'],
    ayushContext: 'Vama Janu Sandhi Marma · Shleshaka Kapha Kshaya / Vata Vriddhi'
  },
  'Right Knee': {
    symptoms: ['दाहिने घुटने में कट-कट की आवाज़ (Right Knee Crepitus)', 'घुटने की कटोरी में दर्द (Patellar Tendinitis)', 'चलने पर घुटने का मुड़ना (Joint Instability)', 'घुटने में सूजन व भारीपन (Knee Effusion / Sandhishotha)'],
    ayushContext: 'Dakshina Janu Sandhi Marma · Sandhigata Vata'
  },
  'Left Leg': {
    symptoms: ['बायीं नली की हड्डी में दर्द (Left Shin Pain)', 'पिंडली में सूजन व भारीपन (Leg Edema / Shotha)', 'चलने पर पिंडली में जकड़न (Intermittent Claudication)', 'पैर में रात को दर्द (Restless Leg Syndrome)'],
    ayushContext: 'Vama Jangha Sthana · Gulpha Sannikrishta'
  },
  'Right Leg': {
    symptoms: ['दाहिनी नली की हड्डी में दर्द (Right Shin Pain)', 'पिंडली की नसें फूलना (Varicose Veins / Siraja Granthi)', 'पिंडली में अकड़न (Calf Tightness)', 'पैर में भारीपन व थकान (Heavy Leg Syndrome)'],
    ayushContext: 'Dakshina Jangha Sthana · Siraja Granthi'
  },
  'Left Foot': {
    symptoms: ['बाएं पैर के तलवे में सुबह तेज़ चुभन (Plantar Fasciitis / Vatarakta)', 'टखने में सूजन व मोच (Ankle Sprain / Gulpha Sandhishotha)', 'एड़ी में हड्डी बढ़ना व दर्द (Calcaneal Spur / Vatakantaka)', 'तलवों में तेज़ जलन (Burning Feet / Pada Daha)'],
    ayushContext: 'Vama Gulpha & Talahridaya Marma · Vata-Pitta Sthana · Pada Shula'
  },
  'Right Foot': {
    symptoms: ['दाहिने पैर के तलवे में दर्द (Right Plantar Fasciitis)', 'दाहिने टखने में सूजन व दर्द (Ankle Arthritis / Sandhivata)', 'उंगलियों में सुन्नपन या झुनझुनी (Peripheral Neuropathy)', 'एड़ी में चुभता दर्द (Heel Spur / Vatakantaka)'],
    ayushContext: 'Dakshina Gulpha & Talahridaya Marma · Pada Daha'
  },
  'Cervical Spine': {
    symptoms: ['गर्दन व सिर के पिछले भाग में दर्द (Cervical Spondylosis)', 'गर्दन घुमाने में चक्कर आना (Cervical Vertigo)', 'हाथों तक जाता हुआ दर्द (Cervical Radiculopathy)', 'कंधों व गर्दन में लगातार अकड़न (Manya Stambha)'],
    ayushContext: 'Griva Sthana · Krikanthika Marma · Manya Stambha'
  },
  'Upper Back / Thoracic': {
    symptoms: ['कंधों के बीच में भारी खिंचाव (Interscapular Spasm)', 'पीठ में अकड़न व दर्द (Thoracic Spine Strain / Prishtha Shula)', 'बैठने पर पीठ में थकावट (Postural Fatigue)'],
    ayushContext: 'Prishtha Sthana · Amsaphalaka Marma'
  },
  'Lumbar Spine (Kati)': {
    symptoms: ['कमर से पैर तक तेज़ खिंचाव (Sciatica / Gridhrasi)', 'झुकने या वजन उठाने पर तेज़ दर्द (Acute Disc Prolapse / Katisula)', 'सुबह उठते ही कमर में जकड़न (Ankylosing Stiffness)', 'बैठने या खड़े होने में कमर में सुई जैसी चुभन (Lumbago)'],
    ayushContext: 'Kati Sthana · Katikataruna Marma · Vataja Gridhrasi'
  },
  'Sacral / Sciatica Origin': {
    symptoms: ['नितंब में गहरा चुभता दर्द (Piriformis Spasm)', 'बैठने पर नितंब से पैर में दर्द (Sciatica Nerve Root Compression)', 'नितंब की नस में खिंचाव (Gluteal Trigger Point)'],
    ayushContext: 'Sphik & Nitamba Marma · Gridhrasi Kandara'
  },
  'Sciatic Pathway / Calves': {
    symptoms: ['रात में पिंडलियों में तेज़ ऐंठन (Nocturnal Calf Cramps / Pindikodveshtana)', 'पैरों के तलवों में तेज़ जलन (Burning Feet / Pada Daha)', 'टखनों में सूजन व भारीपन (Ankle Edema)', 'कमर से एड़ी तक करंट जैसा दर्द (Shooting Sciatic Pain)'],
    ayushContext: 'Jangha Sthana · Indrabasti Marma · Pada Daha'
  }
};

const PAIN_SENSATIONS = [
  { key: 'crushing', label: 'भारी दबाव / घुटन', en: 'Crushing', color: '#f43f5e' },
  { key: 'sharp', label: 'तीव्र चुभन', en: 'Sharp / Stabbing', color: '#0284c7' },
  { key: 'burning', label: 'तेज़ जलन / दाह', en: 'Burning', color: '#ea580c' },
  { key: 'throbbing', label: 'धड़कता दर्द', en: 'Throbbing', color: '#8b5cf6' },
  { key: 'stiffness', label: 'अकड़न / जकड़न', en: 'Stiffness', color: '#10b981' },
  { key: 'numbness', label: 'सुन्नपन / झुनझुनी', en: 'Numbness', color: '#06b6d4' }
];

const PRIVATE_SANCTUARIES = [
  {
    id: 'urology_repro',
    title: 'मूत्र एवं प्रजनन स्वास्थ्य',
    enTitle: 'Urology & Reproductive Health',
    symptoms: ['पेशाब में तेज़ जलन या रुकावट (Dysuria)', 'बार-बार पेशाब आना (Urinary Frequency)', 'असामान्य स्राव या खुजली (Intimate Discharge / Pradara)', 'मासिक धर्म में असहनीय दर्द (Dysmenorrhea)']
  },
  {
    id: 'anorectal',
    title: 'गुदा एवं आंत्र विकार (अर्श / भगंदर)',
    enTitle: 'Anorectal / Piles / Fissures',
    symptoms: ['शौच के समय रक्तस्राव (Painless/Painful Bleeding)', 'बवासीर / मस्से या सूजन (Piles / Hemorrhoidal Masses)', 'गुदा में असहनीय जलन या दरार (Anal Fissure / Parikartika)']
  },
  {
    id: 'mental_health',
    title: 'मानसिक स्वास्थ्य, तनाव व अनिद्रा',
    enTitle: 'Mental Well-being & Anxiety',
    symptoms: ['अत्यधिक घबराहट, चिंता व पैनिक (Severe Anxiety / Chittodvega)', 'गहरी उदासी व अकेलापन (Clinical Depression / Vishada)', 'लगातार अनिद्रा व बेचैनी (Severe Insomnia / Anidra)']
  },
  {
    id: 'intimate_skin',
    title: 'संवेदनशील त्वचा व व्यक्तिगत विकार',
    enTitle: 'Intimate Dermatology',
    symptoms: ['संवेदनशील अंगों पर चकत्ते या छाले (Intimate Rashes)', 'पुरानी खुजली व संक्रमण (Fungal Dermatophytosis / Dadru)']
  }
];

export const Step3VoiceBodyIntake: React.FC<Step3VoiceBodyIntakeProps> = ({
  transcript,
  setTranscript,
  selectedBodyRegion,
  setSelectedBodyRegion,
  onExtractedSymptoms
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  type SupportedSpeechLang = 'hi-IN' | 'en-IN' | 'mr-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' | 'gu-IN' | 'kn-IN' | 'pa-IN' | 'ml-IN';
  const [mannequinView, setMannequinView] = useState<'front' | 'back'>('front');
  const [displayEngine, setDisplayEngine] = useState<'3d' | '2d'>('3d');
  const [layoutMode, setLayoutMode] = useState<'hero' | 'split'>('hero');
  const [activeMacroZone, setActiveMacroZone] = useState<MacroZone>('full');
  const [micLanguage, setMicLanguage] = useState<SupportedSpeechLang>('hi-IN');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [isPeekActive, setIsPeekActive] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [duration, setDuration] = useState<'today' | '2-3days' | '1week' | 'chronic'>('2-3days');

  const SEVERITY_LEVELS = [
    { key: 'mild', label: 'हल्का दर्द', en: 'Mild', color: 'emerald' },
    { key: 'moderate', label: 'मध्यम दर्द', en: 'Moderate', color: 'amber' },
    { key: 'severe', label: 'असहनीय / तीव्र', en: 'Severe', color: 'rose' }
  ];

  const DURATION_CHOICES = [
    { key: 'today', label: 'आज से', en: 'Today' },
    { key: '2-3days', label: '2-3 दिन', en: '2-3 Days' },
    { key: '1week', label: '1 हफ्ता', en: '1 Week' },
    { key: 'chronic', label: '1 महीना+', en: 'Chronic' }
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const MACRO_ZONE_TABS: Array<{ id: MacroZone; label: string; en: string }> = [
    { id: 'full', label: 'संपूर्ण शरीर', en: 'Full Body' },
    { id: 'head', label: 'सिर व चेहरा', en: 'Head & Neck' },
    { id: 'chest', label: 'सीना व हृदय', en: 'Chest & Lungs' },
    { id: 'abdomen', label: 'पेट व पेडू', en: 'Abdomen & Pelvis' },
    { id: 'spine', label: 'रीढ़ व पीठ', en: 'Spine & Back' },
    { id: 'arms', label: 'हाथ व बांह', en: 'Arms & Hands' },
    { id: 'legs', label: 'पैर व जोड़', en: 'Legs & Feet' }
  ];

  const getZoneIcon = (zone: MacroZone) => {
    switch (zone) {
      case 'full': return <User size={13} className="shrink-0 text-primary" />;
      case 'head': return <Activity size={13} className="shrink-0 text-primary" />;
      case 'chest': return <Heart size={13} className="shrink-0 text-rose-500" />;
      case 'abdomen':
      case 'torso': return <Layers size={13} className="shrink-0 text-primary" />;
      case 'spine': return <Bone size={13} className="shrink-0 text-primary" />;
      case 'arms': return <Activity size={13} className="shrink-0 text-primary" />;
      case 'legs':
      case 'lower': return <Activity size={13} className="shrink-0 text-primary" />;
      default: return <User size={13} className="shrink-0 text-muted-foreground" />;
    }
  };

  const recognitionRef = useRef<any>(null);

  const samplePrompts = [
    {
      type: 'emergency',
      title: 'सीने में भारी दबाव व पसीना (हृदय शूल)',
      text: '2 महीने से सीने में बहुत तेज़ गैस चढ़ रही है, जो बाएं कंधे और जबड़े तक जा रही है, बहुत पसीना और भारी दबाव आ रहा है। बीपी 165/102 है।',
      region: 'Left Chest / Precordium',
      borderAccent: '#f43f5e'
    },
    {
      type: 'emergency',
      title: 'सिर पर चोट व रक्तस्राव (मेडिको-लीगल)',
      text: 'सिर में गहरा घाव है और बहुत खून बह रहा है, चक्कर और बेहोशी आ रही है।',
      region: 'Head',
      borderAccent: '#e11d48'
    },
    {
      type: 'emergency',
      title: 'खांसी में खून व तेज़ बुखार (फेफड़े)',
      text: '3 हफ्ते से लगातार तेज़ खांसी के साथ बलगम में खून आ रहा है, रात में तेज़ पसीना और वज़न तेज़ी से घट रहा है।',
      region: 'Neck',
      borderAccent: '#d97706'
    },
    {
      type: 'backpain',
      title: 'कटिशूल / साइटिका (Lumbar Spine)',
      text: 'कमर के निचले हिस्से में तेज़ दर्द है जो सीधे दाहिने पैर की उंगली तक खिंच रहा है, झुकने पर दर्द असहनीय हो जाता है।',
      region: 'Lumbar Spine (Kati)',
      borderAccent: '#8b5cf6'
    },
    {
      type: 'arthritis',
      title: 'संधिवात (Bilateral Knee Joints)',
      text: 'दोनों घुटनों में 6 महीने से दर्द है, कट-कट की आवाज़ आती है, सुबह उठने पर 25 मिनट तक बहुत जकड़न रहती है।',
      region: 'Left Knee',
      borderAccent: '#06b6d4'
    }
  ];

  const handleSelectSample = async (sample: typeof samplePrompts[0]) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setTranscript(sample.text);
    setSelectedBodyRegion(sample.region);
    await triggerClinicalParse(sample.text);
  };

  const handleRegionClick = (regionId: string) => {
    try { sovereignSound.playHotspotPulse(); } catch {}
    setSelectedBodyRegion(regionId);
    if (LOCUS_TO_MACRO_ZONE[regionId]) {
      setActiveMacroZone(LOCUS_TO_MACRO_ZONE[regionId]);
    }
  };

  const handleAddSymptom = (symptomText: string) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    const sevObj = SEVERITY_LEVELS.find(s => s.key === severity);
    const durObj = DURATION_CHOICES.find(d => d.key === duration);
    const formatted = symptomText.includes('(') && symptomText.includes(':')
      ? symptomText
      : `${selectedBodyRegion || 'प्रभावित अंग'}: ${symptomText} (${sevObj?.label || ''}, ${durObj?.label || ''})`;
    const newTranscript = transcript ? `${transcript}। ${formatted}` : formatted;
    setTranscript(newTranscript);
    triggerClinicalParse(newTranscript);
  };

  const handleAddSensation = (sensation: typeof PAIN_SENSATIONS[0]) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    const sevObj = SEVERITY_LEVELS.find(s => s.key === severity);
    const durObj = DURATION_CHOICES.find(d => d.key === duration);
    const regionName = selectedBodyRegion ? selectedBodyRegion.split('/')[0].trim() : 'प्रभावित अंग';
    const textToAdd = `${regionName} में ${sensation.label} (${sevObj?.label || ''}, ${durObj?.label || ''})`;
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

  // Complete Master Categorized Anatomical Loci
  const ALL_ANATOMICAL_LOCI = [
    // 1. HEAD & NECK
    { id: 'Head', zone: 'head', label: 'माथा / ललाट (Forehead)', sub: 'Sthapani Marma, migraine, tension', keywords: ['सिर', 'माथा', 'ललाट', 'head', 'forehead', 'migraine', 'सिरदर्द'] },
    { id: 'Face & Sinus', zone: 'head', label: 'चेहरा व आँखें (Eyes & Sinus)', sub: 'Sinuses, facial pain, eye ache', keywords: ['चेहरा', 'आँख', 'आंख', 'साइनस', 'गाल', 'face', 'eye', 'sinus'] },
    { id: 'Ear', zone: 'head', label: 'कान (Ear Ache & Tinnitus)', sub: 'Vidhura Marma, otitis, hearing', keywords: ['कान', 'ear', 'टीस', 'बहना', 'hearing', 'tinnitus'] },
    { id: 'Neck', zone: 'head', label: 'गला व थाइरॉइड (Throat & Larynx)', sub: 'Manya Marma, sore throat, tonsil', keywords: ['गला', 'कंठ', 'थाइरॉइड', 'टॉन्सिल', 'throat', 'neck', 'खराश'] },
    { id: 'Cervical Spine', zone: 'head', label: 'गर्दन की नसें (Cervical Spine)', sub: 'Krikātika, cervical radiculopathy', keywords: ['गर्दन', 'cervical', 'ग्रीवा', 'सर्वाइकल', 'जकड़न', 'nape'] },

    // 2. CHEST & THORAX
    { id: 'Left Chest / Precordium', zone: 'chest', label: 'बायां सीना / दिल (Heart)', sub: 'Hridaya Marma, cardiac angina', isEmergency: true, keywords: ['दिल', 'हृदय', 'सीना', 'छाती', 'heart', 'chest', 'cardiac', 'बायां सीना', 'घबराहट'] },
    { id: 'Right Chest', zone: 'chest', label: 'दायां सीना (Right Thorax)', sub: 'Stanarohita, right lung pleurisy', keywords: ['दायां सीना', 'दाहिनी छाती', 'right chest', 'thorax'] },
    { id: 'Lungs & Respiration', zone: 'chest', label: 'फेफड़े व सांस (Lungs & Respiration)', sub: 'Pranavaha Srotas, asthma, cough', keywords: ['फेफड़े', 'सांस', 'दमा', 'खांसी', 'lungs', 'cough', 'asthma', 'श्वास'] },

    // 3. ABDOMEN & VISCERA
    { id: 'Epigastrium', zone: 'abdomen', label: 'ऊपरी पेट / आमाशय (Upper Stomach)', sub: 'Amashaya, acid gastritis, GERD', keywords: ['ऊपरी पेट', 'पेट', 'आमाशय', 'एसिडिटी', 'जलन', 'epigastrium', 'stomach', 'acidity', 'gastric'] },
    { id: 'Umbilicus / Mid-Abdomen', zone: 'abdomen', label: 'मध्य पेट / नाभि (Navel / Colic)', sub: 'Nabhi Marma, colic, cramps, gas', keywords: ['नाभि', 'मध्य पेट', 'navel', 'umbilicus', 'मरोड़', 'bloating', 'gas'] },
    { id: 'Pelvic / Hypogastrium', zone: 'abdomen', label: 'निचला पेट / पेडू (Lower Belly)', sub: 'Basti Marma, UTI, pelvic pain', keywords: ['निचला पेट', 'पेडू', 'पेशाब', 'pelvis', 'lower belly', 'bladder', 'uti', 'बस्ति'] },
    { id: 'Right Lower Quadrant (RLQ)', zone: 'abdomen', label: 'दायां निचला पेट (RLQ / Appendix)', sub: 'Unduka, McBurney point tenderness', isEmergency: true, keywords: ['दायां निचला पेट', 'अपेंडिक्स', 'appendix', 'rlq', 'mcburney'] },
    { id: 'Left Lower Quadrant (LLQ)', zone: 'abdomen', label: 'बायां निचला पेट / गुर्दा (LLQ)', sub: 'Left renal colic, flank ache', keywords: ['बायां निचला पेट', 'गुर्दा', 'पथरी', 'llq', 'kidney'] },

    // 4. SPINAL AXIS & POSTERIOR BACK
    { id: 'Upper Back / Thoracic', zone: 'spine', label: 'ऊपरी पीठ (Thoracic Spine)', sub: 'Amsaphalaka, interscapular spasm', keywords: ['ऊपरी पीठ', 'पीठ', 'कंधों के बीच', 'upper back', 'thoracic', 'scapula'] },
    { id: 'Lumbar Spine (Kati)', zone: 'spine', label: 'निचली कमर / कटि (Low Back)', sub: 'Katikataruna, slip disc, lumbago', keywords: ['कमर', 'कटि', 'पीठ', 'लो बैक', 'lumbar', 'lumbago', 'back pain', 'स्लिप डिस्क'] },
    { id: 'Sacral / Sciatica Origin', zone: 'spine', label: 'त्रिक / नितंब व साइटिका मूल (Sacrum)', sub: 'Nitamba Marma, piriformis ache', keywords: ['नितंब', 'सायटिका', 'त्रिक', 'sacrum', 'sciatica', 'buttock'] },
    { id: 'Sciatic Pathway / Calves', zone: 'spine', label: 'पिंडलियाँ व उतरता दर्द (Sciatica Path)', sub: 'Indrabasti, calf cramps, shooting', keywords: ['पिंडली', 'पिंडलियां', 'calves', 'sciatica', 'पैरों में उतरता दर्द'] },

    // 5. UPPER EXTREMITIES (ARMS)
    { id: 'Left Shoulder', zone: 'arms', label: 'बायां कंधा (Left Shoulder)', sub: 'Amsa Marma, rotator cuff', keywords: ['बायां कंधा', 'कंधा', 'left shoulder', 'shoulder'] },
    { id: 'Right Shoulder', zone: 'arms', label: 'दायां कंधा (Right Shoulder)', sub: 'Amsa Marma, frozen shoulder', keywords: ['दायां कंधा', 'कंधा', 'right shoulder'] },
    { id: 'Left Arm', zone: 'arms', label: 'बायीं बांह व कोहनी (Left Arm & Elbow)', sub: 'Kurpara Marma, arm strain', keywords: ['बायीं बांह', 'बांह', 'कोहनी', 'left arm', 'elbow'] },
    { id: 'Right Arm', zone: 'arms', label: 'दायीं बांह व कोहनी (Right Arm & Elbow)', sub: 'Kurpara Marma, tennis elbow', keywords: ['दायीं बांह', 'बांह', 'कोहनी', 'right arm'] },
    { id: 'Left Hand', zone: 'arms', label: 'बायां हाथ व कलाई (Left Hand & Wrist)', sub: 'Manibandha, carpal tunnel', keywords: ['बायां हाथ', 'कलाई', 'हथेली', 'left hand', 'wrist'] },
    { id: 'Right Hand', zone: 'arms', label: 'दायां हाथ व कलाई (Right Hand & Wrist)', sub: 'Manibandha, grip weakness', keywords: ['दायां हाथ', 'कलाई', 'हथेली', 'right hand'] },

    // 6. LOWER EXTREMITIES (LEGS)
    { id: 'Left Hip', zone: 'legs', label: 'बायां कूल्हा व जांघ (Left Hip)', sub: 'Urvi Marma, gait pain', keywords: ['बायां कूल्हा', 'कूल्हा', 'जांघ', 'left hip', 'thigh'] },
    { id: 'Right Hip', zone: 'legs', label: 'दायां कूल्हा व जांघ (Right Hip)', sub: 'Urvi Marma, hip joint', keywords: ['दायां कूल्हा', 'कूल्हा', 'जांघ', 'right hip'] },
    { id: 'Left Knee', zone: 'legs', label: 'बायां घुटना / जानु (Left Knee)', sub: 'Janu Marma, osteoarthritis, crepitus', keywords: ['बायां घुटना', 'घुटना', 'जानु', 'left knee', 'knee'] },
    { id: 'Right Knee', zone: 'legs', label: 'दायां घुटना / जानु (Right Knee)', sub: 'Janu Marma, knee effusion', keywords: ['दायां घुटना', 'घुटना', 'जानु', 'right knee'] },
    { id: 'Left Leg', zone: 'legs', label: 'बायीं पिंडली / नली की हड्डी (Left Shin)', sub: 'Jangha Sthana, shin splints', keywords: ['बायीं नली', 'पिंडली', 'left shin', 'leg'] },
    { id: 'Right Leg', zone: 'legs', label: 'दायीं पिंडली / नली की हड्डी (Right Shin)', sub: 'Jangha Sthana, calf tightness', keywords: ['दायीं नली', 'पिंडली', 'right shin', 'leg'] },
    { id: 'Left Foot', zone: 'legs', label: 'बायां पैर व तलवा (Left Foot & Ankle)', sub: 'Gulpha & Talahridaya, plantar fasciitis', keywords: ['बायां पैर', 'तलवा', 'टखना', 'एड़ी', 'left foot', 'ankle', 'heel'] },
    { id: 'Right Foot', zone: 'legs', label: 'दायां पैर व तलवा (Right Foot & Ankle)', sub: 'Gulpha & Talahridaya, heel spur', keywords: ['दायां पैर', 'तलवा', 'टखना', 'एड़ी', 'right foot', 'ankle', 'heel'] }
  ];

  // Filtered Loci by MacroZone and Search Query
  const filteredLoci = useMemo(() => {
    let list = ALL_ANATOMICAL_LOCI;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(l => 
        l.label.toLowerCase().includes(q) ||
        l.sub.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    if (activeMacroZone === 'full') {
      return showAllRegions ? list : list.filter(l => ['Head', 'Left Chest / Precordium', 'Epigastrium', 'Pelvic / Hypogastrium', 'Lumbar Spine (Kati)', 'Left Knee', 'Left Arm', 'Right Chest'].includes(l.id));
    }
    return list.filter(l => l.zone === activeMacroZone);
  }, [activeMacroZone, searchQuery, showAllRegions]);

  const currentRegionalData = REGIONAL_COMPLAINTS[selectedBodyRegion] || {
    symptoms: ['असहनीय दर्द (Severe Pain)', 'सूजन व भारीपन (Swelling)', 'जलन या खिंचाव (Burning / Spasm)'],
    ayushContext: 'Marma & Srotas Locus · Sthanika Dosha'
  };

  const clusterKey = LOCUS_TO_CLUSTER[selectedBodyRegion];
  const currentCluster = clusterKey ? CLUSTER_DISAMBIGUATION[clusterKey] : null;
  const congruenceMismatch = useMemo(() => evaluateCongruenceMismatch(selectedBodyRegion, transcript), [selectedBodyRegion, transcript]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 flex flex-col gap-3 selection:bg-foreground selection:text-background animate-in fade-in duration-300">
      
      {/* 1. Header & Reassuring Multilingual Voice Guidance */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div className="text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl tracking-tight text-foreground">
              कहाँ और क्या तकलीफ़ है? · Symptom &amp; Voice Intake
            </h2>
          </div>
          <p className="text-xs sm:text-[13px] text-muted-foreground font-sans mt-0.5">
            शरीर मॉडल पर छूकर बताएं या अपनी भाषा में माइक से बोलें (Touch 3D body loci or speak naturally)
          </p>
        </div>

        {/* Top Control Bar: Audio Guidance + 3D/2D Mode + DPDP Private Mode */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                sovereignSound.playMechanicalSnap();
                const guidanceTexts: Record<string, string> = {
                  'hi-IN': 'कृपया 3D शरीर मॉडल में अपने दर्द का अंग चुनें या माइक का बटन दबाकर अपनी तकलीफ़ बोलें।',
                  'en-IN': 'Please select your affected body part on the 3D model or tap the microphone to speak your symptoms.',
                  'mr-IN': 'कृपया 3D शरीरावर तुमचा दुखणारा भाग निवडा किंवा माइक दाबून आपली लक्षणे सांगा.',
                  'bn-IN': 'অনুগ্রহ করে 3D মডেলে ব্যথার স্থানটি নির্বাচন করুন বা মাইক চেপে আপনার समस्या বলুন।',
                  'ta-IN': 'தயவுசெய்து 3D மாதிரியில் வலி உள்ள பகுதியைத் தேர்ந்தெடுக்கவும் அல்லது மைக் அழுத்தி உங்கள் அறிகுறிகளைப் பேசவும்.',
                  'te-IN': 'దయచేసి 3D శరీర నమూనాలో మీ నొప్పి ఉన్న భాగాన్ని ఎంచుకోండి లేదా మైక్ నొక్కి మాట్లాడండి.',
                  'gu-IN': 'કૃપા કરીને 3D મોડેલ પર તમારા દર્દનો ભાગ પસંદ કરો અથવા માઇક દબાવીને તમારી તકલીફ બોલો.',
                  'kn-IN': 'ದಯವಿಟ್ಟು 3D ದೇಹದ ಮಾದರಿಯಲ್ಲಿ ನಿಮ್ಮ ನೋವಿನ ಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ.',
                  'pa-IN': 'ਕਿਰਪਾ ਕਰਕੇ 3D ਸਰੀਰ ਮਾਡਲ ਤੇ ਆਪਣੇ ਦਰਦ ਦਾ ਅੰਗ ਚੁਣੋ ਜਾਂ ਮਾਈਕ ਦਬਾ ਕੇ ਆਪਣੀ ਤਕਲੀਫ ਬੋਲੋ।',
                  'ml-IN': 'ദയവായി 3D മോഡലിൽ നിങ്ങളുടെ വേദനയുള്ള ഭാഗം തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ മൈക്ക് അമർത്തി സംസാരിക്കുക.'
                };
                sovereignSound.speakGuidance(guidanceTexts[micLanguage] || guidanceTexts['hi-IN']);
              } catch {}
            }}
            className="tactile-btn h-8 px-2.5 rounded-lg text-primary border-primary/30 text-[11px] font-semibold gap-1 cursor-pointer shadow-2xs"
            title="Audio Guidance / आवाज़ में निर्देश"
          >
            <Volume2 size={13} />
            <span>सुनें (Listen)</span>
          </button>

          {/* Layout View Switcher (Hero Canvas vs Split Workstation) */}
          <button
            type="button"
            onClick={() => {
              try { sovereignSound.playMechanicalSnap(); } catch {}
              setLayoutMode(layoutMode === 'hero' ? 'split' : 'hero');
            }}
            className="tactile-btn h-8 px-2.5 rounded-lg text-foreground text-[11px] font-semibold gap-1 hidden md:inline-flex cursor-pointer"
            title="Toggle between Full Canvas Hero View and Dual Split Workstation"
          >
            <Sliders size={13} className="text-primary" />
            <span>{layoutMode === 'hero' ? 'विस्तृत दृश्य (Hero)' : 'स्प्लिट दृश्य (Split)'}</span>
          </button>

          {/* 3D WebGL vs 2D Simple Vector Toggle */}
          <button
            type="button"
            onClick={() => {
              try { sovereignSound.playMechanicalSnap(); } catch {}
              setDisplayEngine(displayEngine === '3d' ? '2d' : '3d');
            }}
            className="tactile-btn h-8 px-2.5 rounded-lg text-foreground text-[11px] font-mono font-semibold gap-1 cursor-pointer"
            title="Toggle between 3D WebGL Mannequin and 2D Vector Outline"
          >
            {displayEngine === '3d' ? <Box size={13} className="text-primary" /> : <Layers size={13} />}
            <span>{displayEngine === '3d' ? '3D WebGL' : '2D Vector'}</span>
          </button>

          {/* DPDP Act 2023 Statutory Private Mode */}
          <button
            type="button"
            onClick={() => {
              try { sovereignSound.playMechanicalSnap(); } catch {}
              setIsPrivateMode(!isPrivateMode);
            }}
            className={`tactile-btn h-8 px-2.5 rounded-lg text-[11px] font-semibold gap-1.5 cursor-pointer transition-all ${
              isPrivateMode
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Discreet mode for sensitive clinical history (DPDP Act 2023)"
          >
            {isPrivateMode ? <EyeOff size={13} /> : <Shield size={13} />}
            <span>निजी मोड</span>
          </button>
        </div>
      </div>

      {/* 2. Main Center Stage: Full-Canvas Hero or Dual-Split Interactive Workspace */}
      <div className={`grid gap-4 items-start ${
        layoutMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
      }`}>
        
        {/* Left / Center: The Majestic Human Body Canvas (Preserving 3D Model with Grand Stage) */}
        <div className={layoutMode === 'split' ? 'lg:col-span-7 flex flex-col gap-3' : 'w-full flex flex-col gap-3'}>
          
          <div className="physical-card p-3 sm:p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
            
            {/* Top HUD Floating Control Bar over the Canvas */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/70 flex-wrap z-10">
              
              {/* Active Locus Display */}
              <div className="flex items-center gap-2 min-w-0 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 shadow-2xs">
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
                    चयनित अंग (Active Locus)
                  </span>
                  <span className="font-heading font-extrabold text-xs sm:text-sm text-foreground truncate">
                    {selectedBodyRegion || 'शरीर पर अंग चुनें'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try { sovereignSound.playMechanicalSnap(); } catch {}
                    setIs3DModalOpen(true);
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 cursor-pointer ml-1"
                  title="3D मॉडल में बदलें"
                >
                  बदलें
                </button>
              </div>

              {/* Anterior / Posterior Tactile Flip Toggle */}
              <div className="flex items-center p-1 rounded-xl recessed-bay gap-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => {
                    try { sovereignSound.playMechanicalSnap(); } catch {}
                    setMannequinView('front');
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mannequinView === 'front'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  सामने (Front)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try { sovereignSound.playMechanicalSnap(); } catch {}
                    setMannequinView('back');
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mannequinView === 'back'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  पीछे (Back)
                </button>
              </div>

              {/* Macro Zone Zoom Quick Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {MACRO_ZONE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      try { sovereignSound.playMechanicalSnap(); } catch {}
                      setActiveMacroZone(tab.id);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                      activeMacroZone === tab.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                        : 'bg-card hover:bg-muted text-foreground border-border/80'
                    }`}
                  >
                    {getZoneIcon(tab.id)}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Fullscreen 3D Precision Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  try { sovereignSound.playMechanicalSnap(); } catch {}
                  setIs3DModalOpen(true);
                }}
                className="tactile-btn h-8 px-3 text-[11px] font-heading font-extrabold gap-1.5 rounded-lg text-primary border-primary/40 hover:bg-primary/10 cursor-pointer shadow-xs ml-auto bg-primary/5"
                title="Open 3D Fullscreen Body Inspector"
              >
                <Maximize2 size={13} />
                <span>3D मॉडल बदलें (Fullscreen)</span>
              </button>
            </div>

            {/* The Mannequin Viewport: 3D WebGL Mannequin (Grand Stage) or 2D Vector */}
            <div className="relative w-full rounded-2xl bg-gradient-to-b from-muted/10 via-background to-muted/20 border border-border/60 overflow-hidden">

              {displayEngine === '3d' ? (
                !is3DModalOpen ? (
                  /* Unaltered, pristine 3D Mannequin with full-height grand stage */
                  <AnatomicalMannequin3D
                    selectedRegion={selectedBodyRegion}
                    onSelectRegion={handleRegionClick}
                    viewMode={mannequinView}
                    onViewModeChange={(mode) => setMannequinView(mode)}
                    isPrivateMode={isPrivateMode}
                    activeMacroZone={activeMacroZone}
                    onMacroZoneChange={setActiveMacroZone}
                    className="w-full h-[420px] sm:h-[480px] lg:h-[540px]"
                  />
                ) : (
                  <div className="w-full h-[420px] sm:h-[480px] lg:h-[540px] flex items-center justify-center text-muted-foreground/60 text-xs font-mono">
                    3D Fullscreen Modal Active
                  </div>
                )
              ) : (
                /* 2D Vector Mannequin with Macro Zoom & 100% Hotspot Coverage */
                <div className="relative w-full h-[420px] sm:h-[480px] lg:h-[540px] flex flex-col items-center justify-between p-2 overflow-hidden">
                  <svg
                    viewBox={
                      activeMacroZone === 'head'
                        ? '70 16 100 100'
                        : activeMacroZone === 'chest'
                        ? '50 75 140 110'
                        : activeMacroZone === 'abdomen' || activeMacroZone === 'torso'
                        ? '45 130 150 150'
                        : activeMacroZone === 'spine'
                        ? '50 60 140 180'
                        : activeMacroZone === 'arms'
                        ? '30 80 180 180'
                        : activeMacroZone === 'legs' || activeMacroZone === 'lower'
                        ? '50 240 140 210'
                        : '0 0 240 460'
                    }
                    className="w-full h-full max-h-[500px] select-none transition-all duration-300"
                  >
                    <defs>
                      <linearGradient id="selectedZoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.30" />
                      </linearGradient>
                      <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.6" />
                      </filter>
                    </defs>

                    {/* Anatomical Base Silhouette */}
                    <g strokeWidth="1.4" className="transition-all duration-200">
                      {/* Head */}
                      <path
                        d="M 120,24 C 104,24 94,36 94,52 C 94,68 104,80 120,80 C 136,80 146,68 146,52 C 146,36 136,24 120,24 Z"
                        onClick={() => handleRegionClick('Head')}
                        className="cursor-pointer transition-all duration-200 hover:fill-emerald-500/25"
                        fill={selectedBodyRegion === 'Head' || selectedBodyRegion === 'Face & Sinus' || selectedBodyRegion === 'Ear' ? "url(#selectedZoneGrad)" : "rgba(100, 116, 139, 0.12)"}
                        stroke={selectedBodyRegion === 'Head' || selectedBodyRegion === 'Face & Sinus' || selectedBodyRegion === 'Ear' ? "#10b981" : "rgba(100, 116, 139, 0.4)"}
                        strokeWidth={selectedBodyRegion === 'Head' ? "2" : "1.4"}
                        filter={selectedBodyRegion === 'Head' ? "url(#emeraldGlow)" : undefined}
                      />
                      {/* Neck */}
                      <path
                        d="M 112,80 L 112,94 L 128,94 L 128,80 Z"
                        onClick={() => handleRegionClick(mannequinView === 'front' ? 'Neck' : 'Cervical Spine')}
                        className="cursor-pointer transition-all duration-200 hover:fill-emerald-500/25"
                        fill={selectedBodyRegion === 'Neck' || selectedBodyRegion === 'Cervical Spine' ? "url(#selectedZoneGrad)" : "rgba(100, 116, 139, 0.12)"}
                        stroke={selectedBodyRegion === 'Neck' || selectedBodyRegion === 'Cervical Spine' ? "#10b981" : "rgba(100, 116, 139, 0.4)"}
                        strokeWidth={selectedBodyRegion === 'Neck' || selectedBodyRegion === 'Cervical Spine' ? "2" : "1.4"}
                      />
                      {/* Torso Base Contour */}
                      <path
                        d="M 112,94 C 88,96 70,112 66,138 L 58,210 C 56,224 64,232 76,230 L 84,168 L 88,272 L 102,272 L 104,204 L 136,204 L 138,272 L 152,272 L 156,168 L 164,230 C 176,232 184,224 182,210 L 174,138 C 170,112 152,96 128,94 Z"
                        className="stroke-border/70 fill-muted/20 pointer-events-none"
                      />
                      {/* Pelvis Base Contour */}
                      <path
                        d="M 88,272 C 88,300 102,316 120,316 C 138,316 152,300 152,272 Z"
                        className="stroke-border/70 fill-muted/20 pointer-events-none"
                      />
                      {/* Legs Base Contour */}
                      <path d="M 94,316 L 90,385 L 96,440 L 110,440 L 108,385 L 114,316 Z" className="stroke-border/70 fill-muted/20 pointer-events-none" />
                      <path d="M 126,316 L 132,385 L 130,440 L 144,440 L 150,385 L 146,316 Z" className="stroke-border/70 fill-muted/20 pointer-events-none" />
                    </g>

                    {mannequinView === 'front' ? (
                      <>
                        {/* Left Chest (हृदय / Heart Side - Patient Left, Screen Right) */}
                        <g onClick={() => handleRegionClick('Left Chest / Precordium')} className="cursor-pointer group">
                          <rect
                            x="118"
                            y="96"
                            width="48"
                            height="48"
                            rx="8"
                            fill={selectedBodyRegion === 'Left Chest / Precordium' ? "url(#selectedZoneGrad)" : "transparent"}
                            stroke={selectedBodyRegion === 'Left Chest / Precordium' ? "#10b981" : "transparent"}
                            strokeWidth="1.5"
                            className="group-hover:fill-emerald-500/20 transition-all duration-200"
                            filter={selectedBodyRegion === 'Left Chest / Precordium' ? "url(#emeraldGlow)" : undefined}
                          />
                          <text x="142" y="123" textAnchor="middle" fontSize="8" fill={selectedBodyRegion === 'Left Chest / Precordium' ? "#10b981" : "currentColor"} className="text-foreground" fontWeight="bold">
                            दिल (Heart)
                          </text>
                        </g>

                        {/* Right Chest (दायां सीना / Right Lung) */}
                        <g onClick={() => handleRegionClick('Right Chest')} className="cursor-pointer group">
                          <rect
                            x="74"
                            y="96"
                            width="44"
                            height="48"
                            rx="8"
                            fill={selectedBodyRegion === 'Right Chest' ? "url(#selectedZoneGrad)" : "transparent"}
                            stroke={selectedBodyRegion === 'Right Chest' ? "#10b981" : "transparent"}
                            strokeWidth="1.5"
                            className="group-hover:fill-emerald-500/20 transition-all duration-200"
                            filter={selectedBodyRegion === 'Right Chest' ? "url(#emeraldGlow)" : undefined}
                          />
                          <text x="96" y="123" textAnchor="middle" fontSize="7.5" fill="#64748b">दायां सीना</text>
                        </g>

                        {/* Upper Abdomen / Epigastrium (ऊपरी पेट / आमाशय / Gastric Agni) */}
                        <g onClick={() => handleRegionClick('Epigastrium')} className="cursor-pointer group">
                          <rect
                            x="72"
                            y="144"
                            width="96"
                            height="44"
                            rx="8"
                            fill={selectedBodyRegion === 'Epigastrium' ? "url(#selectedZoneGrad)" : "transparent"}
                            stroke={selectedBodyRegion === 'Epigastrium' ? "#10b981" : "transparent"}
                            strokeWidth="1.5"
                            className="group-hover:fill-emerald-500/20 transition-all duration-200"
                            filter={selectedBodyRegion === 'Epigastrium' ? "url(#emeraldGlow)" : undefined}
                          />
                          <text x="120" y="170" textAnchor="middle" fontSize="7.5" fill={selectedBodyRegion === 'Epigastrium' ? "#10b981" : "#94a3b8"} fontWeight="bold">
                            ऊपरी पेट (Upper)
                          </text>
                        </g>

                        {/* Mid-Abdomen (नाभि) */}
                        <g onClick={() => handleRegionClick('Umbilicus / Mid-Abdomen')} className="cursor-pointer group">
                          <rect
                            x="74"
                            y="188"
                            width="92"
                            height="42"
                            rx="8"
                            fill={selectedBodyRegion === 'Umbilicus / Mid-Abdomen' ? "url(#selectedZoneGrad)" : "transparent"}
                            stroke={selectedBodyRegion === 'Umbilicus / Mid-Abdomen' ? "#10b981" : "transparent"}
                            strokeWidth="1.5"
                            className="group-hover:fill-emerald-500/20 transition-all duration-200"
                            filter={selectedBodyRegion === 'Umbilicus / Mid-Abdomen' ? "url(#emeraldGlow)" : undefined}
                          />
                          <text x="120" y="212" textAnchor="middle" fontSize="7" fill={selectedBodyRegion === 'Umbilicus / Mid-Abdomen' ? "#10b981" : "#94a3b8"}>
                            मध्य पेट / नाभि
                          </text>
                        </g>

                        {/* Lower Abdomen & Pelvis / Hypogastrium */}
                        <g onClick={() => handleRegionClick('Pelvic / Hypogastrium')} className="cursor-pointer group">
                          <rect
                            x="74"
                            y="270"
                            width="92"
                            height="46"
                            rx="8"
                            fill={selectedBodyRegion === 'Pelvic / Hypogastrium' ? "url(#selectedZoneGrad)" : "transparent"}
                            stroke={selectedBodyRegion === 'Pelvic / Hypogastrium' ? "#10b981" : "transparent"}
                            strokeWidth="1.5"
                            className="group-hover:fill-emerald-500/20 transition-all duration-200"
                            filter={selectedBodyRegion === 'Pelvic / Hypogastrium' ? "url(#emeraldGlow)" : undefined}
                          />
                          <text x="120" y="296" textAnchor="middle" fontSize="7" fill={selectedBodyRegion === 'Pelvic / Hypogastrium' ? "#10b981" : "#94a3b8"} fontWeight="bold">
                            निचला पेट / पेडू (Lower)
                          </text>
                        </g>

                        {/* Knees */}
                        <g onClick={() => handleRegionClick('Right Knee')} className="cursor-pointer group">
                          <rect x="84" y="360" width="32" height="36" rx="8" fill={selectedBodyRegion === 'Right Knee' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Right Knee' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                        </g>
                        <g onClick={() => handleRegionClick('Left Knee')} className="cursor-pointer group">
                          <rect x="124" y="360" width="32" height="36" rx="8" fill={selectedBodyRegion === 'Left Knee' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Left Knee' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                        </g>
                      </>
                    ) : (
                      <>
                        {/* Posterior Back View Regional Zones */}
                        <g onClick={() => handleRegionClick('Cervical Spine')} className="cursor-pointer group">
                          <rect x="100" y="70" width="40" height="30" rx="6" fill={selectedBodyRegion === 'Cervical Spine' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Cervical Spine' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                        </g>
                        <g onClick={() => handleRegionClick('Upper Back / Thoracic')} className="cursor-pointer group">
                          <rect x="74" y="102" width="92" height="50" rx="8" fill={selectedBodyRegion === 'Upper Back / Thoracic' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Upper Back / Thoracic' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                        </g>
                        <g onClick={() => handleRegionClick('Lumbar Spine (Kati)')} className="cursor-pointer group">
                          <rect x="76" y="154" width="88" height="48" rx="8" fill={selectedBodyRegion === 'Lumbar Spine (Kati)' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Lumbar Spine (Kati)' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                          <text x="120" y="190" textAnchor="middle" fontSize="7.5" fill={selectedBodyRegion === 'Lumbar Spine (Kati)' ? "#10b981" : "#94a3b8"} fontWeight="bold">
                            कमर (Lower Back)
                          </text>
                        </g>
                        <g onClick={() => handleRegionClick('Sciatic Pathway / Calves')} className="cursor-pointer group">
                          <rect x="84" y="340" width="72" height="95" rx="8" fill={selectedBodyRegion === 'Sciatic Pathway / Calves' ? "url(#selectedZoneGrad)" : "transparent"} stroke={selectedBodyRegion === 'Sciatic Pathway / Calves' ? "#10b981" : "transparent"} strokeWidth="1.5" className="group-hover:fill-emerald-500/20" />
                        </g>
                      </>
                    )}
                  </svg>
                </div>
              )}
            </div>

            {/* Quick Anatomical Selector Dock (Below Mannequin Stage) */}
            <div className="pt-2 flex flex-col gap-2">
              {/* Search Bar & Macro Filter Tabs Header */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground text-xs">
                    <Search size={13} className="text-muted-foreground" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="अंग या लक्षण खोजें (Search: पेट, कान, आंख, रीढ़...)"
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-background/90 border border-border/80 rounded-xl placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Macro Zone Filter Strip */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                  {MACRO_ZONE_TABS.map((tab) => {
                    const isTabActive = activeMacroZone === tab.id && !searchQuery;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          try { sovereignSound.playMechanicalSnap(); } catch {}
                          setSearchQuery('');
                          setActiveMacroZone(tab.id);
                        }}
                        className={`px-3 py-1.5 text-[11.5px] font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                          isTabActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                            : 'bg-muted/50 hover:bg-muted text-foreground border-border/70'
                        }`}
                      >
                        {getZoneIcon(tab.id)}
                        <span>{tab.label.split('(')[0].trim()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Loci Cards */}
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-1.5 max-h-52 overflow-y-auto p-0.5">
                {filteredLoci.map((b) => {
                  const isSelected = selectedBodyRegion === b.id;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleRegionClick(b.id)}
                      className={`p-2.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 border relative group ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground font-bold shadow-xs'
                          : b.isEmergency
                          ? 'bg-rose-500/10 border-rose-500/30 text-foreground hover:bg-rose-500/20'
                          : 'bg-muted/40 border-border/70 text-foreground hover:bg-muted/80'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        {b.isEmergency ? (
                          <AlertTriangle size={12} className={isSelected ? 'text-white' : 'text-rose-500'} />
                        ) : (
                          getZoneIcon(b.zone as MacroZone)
                        )}
                        {b.isEmergency && !isSelected && (
                          <span className="text-[8px] font-mono font-bold text-rose-500 bg-rose-500/10 px-1 rounded-sm border border-rose-500/30">
                            EMERGENCY
                          </span>
                        )}
                        {isSelected && <Check size={12} className="shrink-0 text-primary-foreground" />}
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold truncate block leading-tight">
                          {b.label.split('(')[0].trim()}
                        </span>
                        <span className={`text-[9.5px] truncate block opacity-75 ${isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                          {b.label.includes('(') ? b.label.split('(')[1].replace(')', '') : b.id}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Chest Misdirection Safeguard (Heart Side Redirect) */}
              {selectedBodyRegion === 'Right Chest' && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0 text-left">
                    <Heart size={15} className="text-rose-500 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        क्या आप दिल (Heart) की जांच कर रहे हैं?
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate font-devanagari">
                        मानव शरीर में हृदय बायीं ओर (Left Precordium) स्थित होता है
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegionClick('Left Chest / Precordium')}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Heart size={12} />
                    <span>बायां सीना चुनें</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Contextual Clinical Diagnostic Drawer Panel */}
        <div className={layoutMode === 'split' ? 'lg:col-span-5 flex flex-col gap-3' : 'w-full flex flex-col gap-3'}>
          
          {/* Active Organ Context & Diagnostic Triage Matrix */}
          <div className="physical-card p-3 sm:p-4 rounded-2xl flex flex-col gap-3">
            
            {/* Header: Organ Info & Ayush Marma Context */}
            <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <HeartPulse size={16} className="text-rose-500 shrink-0" />
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-heading font-extrabold text-sm sm:text-base text-foreground truncate">
                    {selectedBodyRegion || 'प्रभावित अंग'}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {currentRegionalData.ayushContext}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/70 font-semibold">
                <span>ACTIVE CLINICAL LOCUS</span>
              </div>
            </div>

            {/* Patent-Grade Semantic Symptom-Locus Congruence Alert */}
            {congruenceMismatch && (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 ${
                congruenceMismatch.isEmergency
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-800 dark:text-rose-200'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={16} className={`shrink-0 ${congruenceMismatch.isEmergency ? 'text-rose-500' : 'text-amber-500'}`} />
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="font-heading font-bold text-xs truncate">
                      सटीक अंग सुधार (Organ Cross-Check):
                    </span>
                    <span className="text-[11px] font-sans opacity-90 truncate">
                      {congruenceMismatch.reasonHindi}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRegionClick(congruenceMismatch.suggestedLocusId)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer shrink-0 shadow-xs transition-all flex items-center gap-1 ${
                    congruenceMismatch.isEmergency
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <span>बदलें</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 1. CLINICAL ANTI-MISCLICK DISAMBIGUATION BAR */}
            {currentCluster && (
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 flex flex-col gap-1.5 shadow-2xs">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-xs font-heading font-extrabold text-foreground flex items-center gap-1.5">
                    <Target size={13} className="text-primary shrink-0" />
                    {currentCluster.promptHindi}
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-primary uppercase bg-primary/15 px-1.5 py-0.2 rounded">
                    Anti-Misclick
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                  {currentCluster.options.map((opt) => {
                    const isOptSelected = selectedBodyRegion === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleRegionClick(opt.id)}
                        className={`p-2 rounded-lg text-left transition-all cursor-pointer flex flex-col gap-0.5 border ${
                          isOptSelected
                            ? opt.isEmergency
                              ? 'bg-rose-500 text-white border-rose-600 shadow-xs font-bold'
                              : 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                            : 'bg-background/90 hover:bg-muted text-foreground border-border/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{opt.hindiLabel}</span>
                          {isOptSelected && <Check size={11} className="shrink-0" />}
                        </div>
                        <span className={`text-[9.5px] truncate font-sans ${isOptSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                          {opt.badgeText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. CARDIAC REFERRED PAIN SPREAD ALERT */}
            {selectedBodyRegion === 'Left Chest / Precordium' && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 font-semibold min-w-0 text-left">
                  <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                  <span className="truncate">
                    क्या यह दर्द बाएं कंधे या बायीं बांह में फैल रहा है? (Referred Pain)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try { sovereignSound.playMechanicalSnap(); } catch {}
                    handleAddSymptom('बायां सीना: दर्द बाएं कंधे व बायीं बांह में फैल रहा है (Radiating to Left Arm - Cardiac Alert)');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer shrink-0 shadow-xs"
                >
                  + हाँ, बांह में फैल रहा है
                </button>
              </div>
            )}

            {/* 3. Clinical Triage: Severity & Duration Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground mb-1 block text-left">
                  1. दर्द की तीव्रता (Severity)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {SEVERITY_LEVELS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        try { sovereignSound.playMechanicalSnap(); } catch {}
                        setSeverity(s.key as any);
                      }}
                      className={`py-1.5 px-1 rounded-lg text-xs font-semibold text-center cursor-pointer transition-all ${
                        severity === s.key
                          ? 'bg-foreground text-background shadow-xs font-bold'
                          : 'bg-background/80 hover:bg-muted text-foreground border border-border/60'
                      }`}
                    >
                      <span className="truncate block text-[11px]">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground mb-1 block text-left">
                  2. कब से है? (Duration)
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {DURATION_CHOICES.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        try { sovereignSound.playMechanicalSnap(); } catch {}
                        setDuration(d.key as any);
                      }}
                      className={`py-1.5 px-0.5 rounded-lg text-xs font-semibold text-center cursor-pointer transition-all ${
                        duration === d.key
                          ? 'bg-foreground text-background shadow-xs font-bold'
                          : 'bg-background/80 hover:bg-muted text-foreground border border-border/60'
                      }`}
                    >
                      <span className="truncate block text-[10px]">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Instant 1-Tap Clinical Complaint Chips */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block text-left">
                3. सामान्य लक्षण चुनें (Tap to Add Symptoms)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentRegionalData.symptoms.map((sym, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSymptom(sym)}
                    className="tactile-btn px-2.5 py-1.5 rounded-xl text-xs font-sans text-foreground/90 border-border/70 hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer text-left"
                  >
                    <span>+ {sym}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. 6-Tier Tactile Pain Sensation Matrix */}
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 text-left">
                4. दर्द की प्रकृति (Pain Character)
              </span>
              <div className="grid grid-cols-3 xs:grid-cols-6 gap-1">
                {PAIN_SENSATIONS.map((sens) => (
                  <button
                    key={sens.key}
                    type="button"
                    onClick={() => handleAddSensation(sens)}
                    className="p-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/70 text-center cursor-pointer transition-all active:scale-95"
                  >
                    <div className="text-[11px] font-semibold text-foreground truncate">{sens.label}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">{sens.en}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* If Private Mode is Active, Show Confidential Sanctuaries */}
          {isPrivateMode && (
            <div className="physical-card p-3 sm:p-4 rounded-2xl border-amber-500/40 bg-amber-500/5 flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-amber-500" />
                  <span className="font-heading font-bold text-sm text-foreground">
                    निजी मोड : गोपनीय स्वास्थ्य श्रेणियाँ
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  <VolumeX size={11} />
                  <span>Acoustic Mute Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRIVATE_SANCTUARIES.map((sanct) => (
                  <div key={sanct.id} className="recessed-bay p-2.5 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-500" />
                      <span className="font-heading font-bold text-xs text-foreground">
                        {sanct.title}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {sanct.symptoms.map((psym, pidx) => (
                        <button
                          key={pidx}
                          type="button"
                          onClick={() => handleAddSymptom(psym)}
                          className="text-left text-[11px] text-foreground/80 hover:text-primary hover:underline py-0.5 cursor-pointer truncate"
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
        </div>
      </div>

      {/* 3. Persistent Smart Voice Scribe & Real-Time Hopfield Studio */}
      <div className="physical-card p-3 sm:p-4 rounded-2xl flex flex-col gap-3">
        {/* Studio Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/70 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-1.5">
              <Mic size={16} className="text-primary" />
              <span>ध्वनि इनपुट (Speech-to-Clinical Studio)</span>
            </span>
            <select
              value={micLanguage}
              onChange={(e) => setMicLanguage(e.target.value as any)}
              className="text-xs px-2.5 py-1 rounded-lg border border-border bg-background text-foreground cursor-pointer font-medium shadow-2xs"
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
          </div>

          <div className="flex items-center gap-2">
            {parseSuccess && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 animate-in fade-in">
                <CheckCircle2 size={13} />
                <span>HOPFIELD PARSED</span>
              </div>
            )}
          </div>
        </div>

        {micErrorMessage && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
            {micErrorMessage}
          </div>
        )}

        {/* Live Scribe Box (With Privacy Veil in Private Mode) */}
        <div className="relative min-h-[90px] p-3 rounded-xl recessed-bay">
          {isPrivateMode && !isPeekActive ? (
            <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-xl flex flex-col items-center justify-center p-3 text-center border border-amber-500/30">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-heading font-bold text-xs mb-1">
                <Lock size={13} />
                <span>गोपनीय दृष्टि कवच सक्रिय (Privacy Veil Active)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-1.5">
                कतार में खड़े अन्य लोग आपकी चिकित्सा जानकारी नहीं देख सकते।
              </p>
              <button
                type="button"
                onClick={() => setIsPeekActive(true)}
                className="tactile-btn px-2.5 py-1 text-xs text-foreground font-medium rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Eye size={12} />
                <span>कुछ देर देखें (Peek)</span>
              </button>
            </div>
          ) : null}

          {isPrivateMode && isPeekActive && (
            <div className="absolute top-2 right-2 z-20">
              <button
                type="button"
                onClick={() => setIsPeekActive(false)}
                className="tactile-btn px-2 py-0.5 text-[10px] text-foreground rounded flex items-center gap-1 cursor-pointer"
              >
                <EyeOff size={11} />
                <span>Hide</span>
              </button>
            </div>
          )}

          {transcript ? (
            <p className="font-sans text-sm text-foreground leading-relaxed">
              {transcript}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground/70 font-sans">
              बोलें या अंग चुनें: अपनी बीमारी, कहाँ दर्द हो रहा है, कब से है (उदा: सीने में भारीपन, घुटने में दर्द)...
            </p>
          )}
        </div>

        {/* Minimal Audio Waveform Visualizer */}
        <div>
          <AudioVisualizer isRecording={isRecording} color="#0284c7" height={28} />
        </div>

        {/* Microphone Action Control Buttons & Clinical Quick Triggers */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/70">
          
          {/* Quick Clinical Emergency Evaluator Presets */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground mr-1 hidden md:inline">
              Quick Test Presets:
            </span>
            {samplePrompts.slice(0, 3).map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(s)}
                className="tactile-btn px-2.5 py-1 text-[11px] font-sans text-foreground rounded-lg cursor-pointer border-border/70"
                style={{ borderLeftColor: s.borderAccent, borderLeftWidth: 3 }}
              >
                <span>{s.title.split('(')[0].trim()}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={toggleRecording}
              className={`tactile-btn flex-1 sm:flex-initial py-2 px-4 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                isRecording
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                  : 'tactile-btn-primary'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff size={16} />
                  <span>रिकॉर्डिंग रोकें (Stop Mic)</span>
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span>बोलें (Push to Talk)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                try { sovereignSound.playMechanicalSnap(); } catch {}
                triggerClinicalParse(transcript);
              }}
              disabled={isParsing || !transcript.trim()}
              className="tactile-btn py-2 px-4 text-xs sm:text-sm font-semibold text-foreground rounded-xl cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isParsing ? 'विश्लेषण...' : 'Parse Clinical'}
            </button>
          </div>
        </div>
      </div>

      {/* 3D Anatomical Modal: Dedicated Fullscreen Experience on Demand */}
      <AnatomicalMannequinModal3D
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        selectedRegion={selectedBodyRegion}
        onSelectRegion={handleRegionClick}
        isPrivateMode={isPrivateMode}
        onTogglePrivateMode={() => setIsPrivateMode(!isPrivateMode)}
        micLanguage={micLanguage}
        onSkipToVoice={() => setIs3DModalOpen(false)}
      />
    </div>
  );
};
