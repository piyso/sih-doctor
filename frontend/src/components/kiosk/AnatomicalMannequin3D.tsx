import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { sovereignSound } from '../../utils/audio';
import { kioskText, regionName } from '../../utils/kioskLocalization';
import {

  RotateCw,
  ZoomIn,
  ZoomOut,
  CornerUpLeft,
  Layers,
  Activity,
  Heart,
  Eye,
  Target,
  Shield,
  Sparkles,
  Flame,
  Stethoscope,
  Bone,
  Zap
} from 'lucide-react';
import {
  AnatomicalSystemLayer,
  AnatomicalMeshRecord,
  getMeshMetadata,
  getMeshesForRegion,
  getMeshesForSystem,
  REGION_CHROMATIC_PALETTE,
  DEFAULT_REGION_COLOR
} from '../../utils/anatomicalModelMapping';

export type MacroZone = 'full' | 'head' | 'chest' | 'abdomen' | 'spine' | 'arms' | 'legs' | 'torso' | 'lower';

export interface AnatomicalLocus3D {
  id: string;
  subKey?: string;
  label: string;
  hindiLabel: string;
  ayushMarma: string;
  category: 'cranial' | 'face' | 'ear' | 'throat' | 'cardiac' | 'pulmonary' | 'arm' | 'epigastrium' | 'abdomen' | 'rlq' | 'llq' | 'pelvis' | 'joint' | 'spine' | 'lumbar' | 'sciatica' | 'lowerLimb';
  macroZone?: MacroZone;
  position: [number, number, number];
  normal?: [number, number, number];
  optimalView?: { yaw: number; pitch?: number };
  isPosterior?: boolean;
}

export interface DisambiguationChoice {
  id: string;
  hindiLabel: string;
  label: string;
  badgeText: string;
  keyDifferentiatingSymptom: string;
  iconType: 'heart' | 'lungs' | 'head' | 'ear' | 'throat' | 'flame' | 'bone' | 'activity' | 'shield';
  isEmergency?: boolean;
}

export const CLUSTER_DISAMBIGUATION: Record<string, {
  clusterTitle: string;
  promptHindi: string;
  promptEn: string;
  options: DisambiguationChoice[];
}> = {
  // Head / Cranial / Cervical Cluster
  'cranial_cluster': {
    clusterTitle: 'Cranial, Facial & Cervical Zone',
    promptHindi: 'सटीक अंग चुनें: क्या तकलीफ़ सिर, चेहरे, कान या गले में है?',
    promptEn: 'Please clarify: Head, Face, Ear, or Throat?',
    options: [
      {
        id: 'Head',
        hindiLabel: 'सिर / माथा',
        label: 'Cranial / Forehead',
        badgeText: 'माइग्रेन / सिरदर्द',
        keyDifferentiatingSymptom: 'आधाशीशी, तनाव सिरदर्द, चक्कर (Migraine / Tension headache)',
        iconType: 'head'
      },
      {
        id: 'Face & Sinus',
        hindiLabel: 'चेहरा व आँखें',
        label: 'Face, Sinuses & Eyes',
        badgeText: 'साइनस / भारीपन',
        keyDifferentiatingSymptom: 'माथे व गालों में दबाव, आँखों में जलन (Sinus pressure, facial pain)',
        iconType: 'head'
      },
      {
        id: 'Ear',
        hindiLabel: 'कान में दर्द',
        label: 'Ear & Hearing',
        badgeText: 'कर्ण शूल / टीस',
        keyDifferentiatingSymptom: 'कान में टीस, मैल या सुनाई कम देना (Otitis, earache, tinnitus)',
        iconType: 'ear'
      },
      {
        id: 'Neck',
        hindiLabel: 'गला व थाइरॉइड',
        label: 'Throat & Larynx',
        badgeText: 'खराश / टॉन्सिल',
        keyDifferentiatingSymptom: 'निगलने में दर्द, आवाज़ बैठना (Sore throat, dysphagia)',
        iconType: 'throat'
      },
      {
        id: 'Cervical Spine',
        hindiLabel: 'गर्दन की नसें',
        label: 'Cervical Spine',
        badgeText: 'गर्दन अकड़न / ग्रीवा',
        keyDifferentiatingSymptom: 'गर्दन घुमाने में दर्द, हाथ में झुनझुनी (Cervical radiculopathy)',
        iconType: 'bone'
      }
    ]
  },

  // Thoracic / Cardiac / Pulmonary Cluster
  'thoracic_cluster': {
    clusterTitle: 'Thorax, Cardiac & Pulmonary Zone',
    promptHindi: 'सीने का हिस्सा स्पष्ट करें: क्या यह दिल, फेफड़े, जलन या पसलियों का दर्द है?',
    promptEn: 'Clarify chest symptoms: Heart, Lungs, Acidity/GERD, or Muscular?',
    options: [
      {
        id: 'Left Chest / Precordium',
        hindiLabel: 'बायां सीना (हृदय)',
        label: 'Left Chest & Precordium',
        badgeText: 'हृदय मर्म · आपातकाल',
        keyDifferentiatingSymptom: 'सीने में भारी दबाव, घबराहट, बायीं बांह में खिंचाव (Angina / Tightness)',
        iconType: 'heart',
        isEmergency: true
      },
      {
        id: 'Right Chest',
        hindiLabel: 'दायां सीना',
        label: 'Right Thorax',
        badgeText: 'दाहिनी छाती का दर्द',
        keyDifferentiatingSymptom: 'सांस लेने या खांसने पर दाहिनी तरफ दर्द (Right pleuritic pain)',
        iconType: 'lungs'
      },
      {
        id: 'Lungs & Respiration',
        hindiLabel: 'फेफड़े व सांस',
        label: 'Bilateral Pulmonary',
        badgeText: 'श्वास कष्ट / दमा / खांसी',
        keyDifferentiatingSymptom: 'सांस फूलना, सीटी जैसी आवाज, लगातार खांसी (Dyspnea, wheezing, cough)',
        iconType: 'lungs'
      },
      {
        id: 'Epigastrium',
        hindiLabel: 'सीने में जलन',
        label: 'Epigastric Acidity',
        badgeText: 'अम्लपित्त / गैस',
        keyDifferentiatingSymptom: 'खट्टी डकारें, सीने के मध्य जलन, खाली पेट दर्द (Heartburn, burning reflux)',
        iconType: 'flame'
      }
    ]
  },

  // Abdominal & Gastrointestinal Cluster
  'abdominal_cluster': {
    clusterTitle: 'Abdominal & Visceral Zone (उदर व पाचन तंत्र)',
    promptHindi: 'पेट का हिस्सा चुनें: क्या दर्द ऊपरी पेट, नाभि, या निचले पेट/पेडू में है?',
    promptEn: 'Specify abdominal region: Upper stomach, Navel, or Lower belly/Pelvis?',
    options: [
      {
        id: 'Epigastrium',
        hindiLabel: 'ऊपरी पेट (आमाशय)',
        label: 'Epigastrium (Upper Stomach)',
        badgeText: 'अम्लपित्त / आमाशय / सीने के नीचे जलन',
        keyDifferentiatingSymptom: 'खाना खाने के बाद जलन, नाभि के ऊपर दर्द (Gastritis, upper abdominal ache)',
        iconType: 'flame'
      },
      {
        id: 'Umbilicus / Mid-Abdomen',
        hindiLabel: 'मध्य पेट (नाभि)',
        label: 'Umbilicus (Navel Zone)',
        badgeText: 'नाभि मरोड़ / वायु विकार / अफारा',
        keyDifferentiatingSymptom: 'पेट फूलना, नाभि के चारों तरफ मरोड़ (Colic, gas distension, cramps)',
        iconType: 'activity'
      },
      {
        id: 'Pelvic / Hypogastrium',
        hindiLabel: 'निचला पेट व पेडू',
        label: 'Pelvis & Hypogastrium',
        badgeText: 'निचला पेट / पेडू दर्द / बस्ति',
        keyDifferentiatingSymptom: 'पेशाब में जलन, निचले पेट में भारीपन (UTI, pelvic discomfort)',
        iconType: 'activity'
      },
      {
        id: 'Right Lower Quadrant (RLQ)',
        hindiLabel: 'दायां निचला पेट (अपेंडिक्स)',
        label: 'Right Lower Quadrant (Appendix)',
        badgeText: 'दायां निचला हिस्सा · अपेंडिक्स स्थान',
        keyDifferentiatingSymptom: 'दाहिने निचले पेट में तीव्र चुभन, चलने पर दर्द (McBurney point tenderness)',
        iconType: 'shield',
        isEmergency: true
      },
      {
        id: 'Left Lower Quadrant (LLQ)',
        hindiLabel: 'बायां निचला पेट (गुर्दा)',
        label: 'Left Lower Quadrant (Kidney/Colon)',
        badgeText: 'बायां निचला हिस्सा · वृक्क / पथरी मरोड़',
        keyDifferentiatingSymptom: 'बायीं तरफ चुभन, पेशाब में जलन या रुकावट (Left renal colic / diverticular ache)',
        iconType: 'activity'
      }
    ]
  },

  // Spinal & Musculoskeletal Axis
  'spinal_cluster': {
    clusterTitle: 'Spinal Axis & Musculoskeletal System',
    promptHindi: 'रीढ़ की हड्डी या पीठ: क्या दर्द गर्दन, ऊपरी पीठ, कमर या पैर में उतर रहा है?',
    promptEn: 'Clarify back symptoms: Neck, Upper Back, Lumbar, or Sciatica?',
    options: [
      {
        id: 'Cervical Spine',
        hindiLabel: 'गर्दन की रीढ़',
        label: 'Cervical Spine (Nape)',
        badgeText: 'मन्यास्तम्भ / ग्रीवा',
        keyDifferentiatingSymptom: 'गर्दन में जकड़न, सिर के पीछे तक भारीपन (Neck stiffness, occipital pain)',
        iconType: 'bone'
      },
      {
        id: 'Upper Back / Thoracic',
        hindiLabel: 'ऊपरी पीठ व रीढ़',
        label: 'Upper Back & Scapular',
        badgeText: 'कंधों के बीच जकड़न',
        keyDifferentiatingSymptom: 'कंधों व पसलियों के पीछे मांसपेशियों में खिंचाव (Interscapular muscle spasm)',
        iconType: 'bone'
      },
      {
        id: 'Lumbar Spine (Kati)',
        hindiLabel: 'निचली कमर (कटि)',
        label: 'Lumbar Spine (Kati Shula)',
        badgeText: 'कटि शूल / कमर दर्द',
        keyDifferentiatingSymptom: 'झुकने या वजन उठाने पर तेज दर्द, अकड़न (Lumbago, disc compression)',
        iconType: 'bone'
      },
      {
        id: 'Sacral / Sciatica Origin',
        hindiLabel: 'त्रिक व नितंब (सायटिका)',
        label: 'Sacrum & Sciatica Root',
        badgeText: 'गृध्रसी / सायटिका मूल',
        keyDifferentiatingSymptom: 'बैठने पर नितंब में तेज दर्द, नस दबना (Piriformis syndrome, sciatica root)',
        iconType: 'activity'
      },
      {
        id: 'Sciatic Pathway / Calves',
        hindiLabel: 'पिंडलियाँ व पैर',
        label: 'Calves & Nerve Path',
        badgeText: 'पैर में उतरता दर्द',
        keyDifferentiatingSymptom: 'कमर से पैर के तलवे तक बिजली जैसी झनझनाहट (Shooting leg pain, calf cramps)',
        iconType: 'activity'
      }
    ]
  },

  // Upper Limb & Extremity Cluster
  'arm_cluster': {
    clusterTitle: 'Upper Limbs & Extremities',
    promptHindi: 'हाथ या कंधे का हिस्सा स्पष्ट करें:',
    promptEn: 'Clarify upper limb location: Shoulder, Arm, Forearm, or Hand?',
    options: [
      {
        id: 'Right Hand',
        hindiLabel: 'दायां हाथ व कलाई',
        label: 'Right Hand & Wrist',
        badgeText: 'कलाई / हथेली / उंगलियां',
        keyDifferentiatingSymptom: 'दाहिने हाथ में झुनझुनी, कलाई या हथेली में दर्द (Right wrist / carpal tunnel)',
        iconType: 'activity'
      },
      {
        id: 'Left Hand',
        hindiLabel: 'बायां हाथ व कलाई',
        label: 'Left Hand & Wrist',
        badgeText: 'कलाई / हथेली / उंगलियां',
        keyDifferentiatingSymptom: 'बाएं हाथ में सुन्नता या दर्द (Left wrist / hand ache)',
        iconType: 'activity'
      },
      {
        id: 'Right Arm',
        hindiLabel: 'दायीं बांह व कोहनी',
        label: 'Right Arm & Elbow',
        badgeText: 'कोहनी / बांह',
        keyDifferentiatingSymptom: 'दाहिनी कोहनी या बांह में खिंचाव (Right tennis elbow / muscle strain)',
        iconType: 'activity'
      },
      {
        id: 'Left Arm',
        hindiLabel: 'बायीं बांह व कोहनी',
        label: 'Left Arm & Elbow',
        badgeText: 'कोहनी / बांह',
        keyDifferentiatingSymptom: 'बायीं बांह में भारीपन या खिंचाव (Left arm pain / strain)',
        iconType: 'activity'
      },
      {
        id: 'Right Shoulder',
        hindiLabel: 'दायां कंधा',
        label: 'Right Shoulder',
        badgeText: 'कंधा संधि',
        keyDifferentiatingSymptom: 'हाथ उठाने में कंधे में दर्द (Right frozen shoulder / rotator cuff)',
        iconType: 'bone'
      },
      {
        id: 'Left Shoulder',
        hindiLabel: 'बायां कंधा',
        label: 'Left Shoulder',
        badgeText: 'कंधा संधि',
        keyDifferentiatingSymptom: 'बाएं कंधे में दर्द या जकड़न (Left shoulder impingement)',
        iconType: 'bone'
      }
    ]
  },

  // Lower Limb Cluster
  'lower_limb_cluster': {
    clusterTitle: 'Lower Limbs & Joints',
    promptHindi: 'पैर या जोड़ का हिस्सा स्पष्ट करें:',
    promptEn: 'Clarify lower limb location: Hip, Knee, Shin, or Foot?',
    options: [
      {
        id: 'Right Knee',
        hindiLabel: 'दायां घुटना',
        label: 'Right Knee Joint',
        badgeText: 'घुटना दर्द / सूजन',
        keyDifferentiatingSymptom: 'दाहिने घुटने में कट-कट आवाज, सीढ़ी चढ़ने पर दर्द (Right knee osteoarthritis)',
        iconType: 'bone'
      },
      {
        id: 'Left Knee',
        hindiLabel: 'बायां घुटना',
        label: 'Left Knee Joint',
        badgeText: 'घुटना दर्द / सूजन',
        keyDifferentiatingSymptom: 'बाएं घुटने में सूजन या मुड़ने में दर्द (Left knee arthritis / sprain)',
        iconType: 'bone'
      },
      {
        id: 'Right Foot',
        hindiLabel: 'दायां पैर व तलवा',
        label: 'Right Foot & Ankle',
        badgeText: 'टखना / एड़ी / तलवा',
        keyDifferentiatingSymptom: 'दाहिनी एड़ी या तलवे में सुबह चुभन (Right plantar fasciitis / sprain)',
        iconType: 'activity'
      },
      {
        id: 'Left Foot',
        hindiLabel: 'बायां पैर व तलवा',
        label: 'Left Foot & Ankle',
        badgeText: 'टखना / एड़ी / तलवा',
        keyDifferentiatingSymptom: 'बाएं तलवे या टखने में दर्द व मोच (Left ankle / heel pain)',
        iconType: 'activity'
      },
      {
        id: 'Right Hip',
        hindiLabel: 'दायां कूल्हा व जांघ',
        label: 'Right Hip & Thigh',
        badgeText: 'कूल्हा संधि / जांघ',
        keyDifferentiatingSymptom: 'दाहिने कूल्हे में जकड़न या चलने में लंगड़ाहट (Right hip joint stiffness)',
        iconType: 'bone'
      },
      {
        id: 'Left Hip',
        hindiLabel: 'बायां कूल्हा व जांघ',
        label: 'Left Hip & Thigh',
        badgeText: 'कूल्हा संधि / जांघ',
        keyDifferentiatingSymptom: 'बाएं कूल्हे में खिंचाव (Left hip ache)',
        iconType: 'bone'
      }
    ]
  }
};

export const LOCUS_TO_CLUSTER: Record<string, string> = {
  'Head': 'cranial_cluster',
  'Face & Sinus': 'cranial_cluster',
  'Ear': 'cranial_cluster',
  'Neck': 'cranial_cluster',
  'Cervical Spine': 'cranial_cluster',

  'Left Chest / Precordium': 'thoracic_cluster',
  'Right Chest': 'thoracic_cluster',
  'Lungs & Respiration': 'thoracic_cluster',
  'Epigastrium': 'abdominal_cluster',

  'Umbilicus / Mid-Abdomen': 'abdominal_cluster',
  'Right Lower Quadrant (RLQ)': 'abdominal_cluster',
  'Left Lower Quadrant (LLQ)': 'abdominal_cluster',
  'Pelvic / Hypogastrium': 'abdominal_cluster',

  'Upper Back / Thoracic': 'spinal_cluster',
  'Lumbar Spine (Kati)': 'spinal_cluster',
  'Sacral / Sciatica Origin': 'spinal_cluster',
  'Sciatic Pathway / Calves': 'spinal_cluster',

  'Left Shoulder': 'arm_cluster',
  'Right Shoulder': 'arm_cluster',
  'Left Arm': 'arm_cluster',
  'Right Arm': 'arm_cluster',
  'Left Hand': 'arm_cluster',
  'Right Hand': 'arm_cluster',

  'Left Hip': 'lower_limb_cluster',
  'Right Hip': 'lower_limb_cluster',
  'Left Knee': 'lower_limb_cluster',
  'Right Knee': 'lower_limb_cluster',
  'Left Leg': 'lower_limb_cluster',
  'Right Leg': 'lower_limb_cluster',
  'Left Foot': 'lower_limb_cluster',
  'Right Foot': 'lower_limb_cluster'
};

export const MACRO_ZONE_DATA: Record<MacroZone, {
  id: MacroZone;
  label: string;
  hindiLabel: string;
  enLabel: string;
  centroid: [number, number, number];
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  defaultYaw?: number;
}> = {
  'full': {
    id: 'full',
    label: 'Full Body',
    hindiLabel: 'संपूर्ण शरीर',
    enLabel: 'Full Body',
    centroid: [0, 0.05, 0],
    cameraPos: [0, 0.05, 4.3],
    lookAt: [0, 0.05, 0],
    fov: 38,
    defaultYaw: 0
  },
  'head': {
    id: 'head',
    label: 'Head & Face',
    hindiLabel: 'सिर व चेहरा',
    enLabel: 'Head, Face & Neck',
    centroid: [0, 1.02, 0.04],
    cameraPos: [0, 1.02, 1.6],
    lookAt: [0, 1.02, 0.04],
    fov: 32,
    defaultYaw: 0
  },
  'chest': {
    id: 'chest',
    label: 'Chest & Lungs',
    hindiLabel: 'सीना व हृदय',
    enLabel: 'Thorax & Lungs',
    centroid: [0, 0.66, 0.04],
    cameraPos: [0, 0.66, 2.0],
    lookAt: [0, 0.66, 0.04],
    fov: 34,
    defaultYaw: 0
  },
  'abdomen': {
    id: 'abdomen',
    label: 'Abdomen & Pelvis',
    hindiLabel: 'पेट व पेडू',
    enLabel: 'Abdomen & Viscera',
    centroid: [0, 0.18, 0.04],
    cameraPos: [0, 0.18, 2.1],
    lookAt: [0, 0.18, 0.04],
    fov: 34,
    defaultYaw: 0
  },
  'spine': {
    id: 'spine',
    label: 'Spine & Back',
    hindiLabel: 'रीढ़ व पीठ',
    enLabel: 'Spine & Back',
    centroid: [0, 0.45, -0.06],
    cameraPos: [0, 0.45, 2.7],
    lookAt: [0, 0.45, 0],
    fov: 34,
    defaultYaw: Math.PI
  },
  'arms': {
    id: 'arms',
    label: 'Arms & Hands',
    hindiLabel: 'हाथ व बांह',
    enLabel: 'Arms & Hands',
    centroid: [0, 0.36, 0.04],
    cameraPos: [0, 0.36, 2.7],
    lookAt: [0, 0.36, 0.04],
    fov: 36,
    defaultYaw: 0
  },
  'legs': {
    id: 'legs',
    label: 'Legs & Feet',
    hindiLabel: 'पैर व जोड़',
    enLabel: 'Legs & Feet',
    centroid: [0, -0.62, 0.04],
    cameraPos: [0, -0.62, 2.6],
    lookAt: [0, -0.62, 0.04],
    fov: 36,
    defaultYaw: 0
  },
  // Backwards compatibility aliases
  'torso': {
    id: 'torso',
    label: 'Torso & Viscera',
    hindiLabel: 'धड़ व उदर',
    enLabel: 'Thorax & Abdomen',
    centroid: [0, 0.35, 0.04],
    cameraPos: [0, 0.35, 2.2],
    lookAt: [0, 0.35, 0.04],
    fov: 34,
    defaultYaw: 0
  },
  'lower': {
    id: 'lower',
    label: 'Lower Body & Joints',
    hindiLabel: 'निचला शरीर व जोड़',
    enLabel: 'Pelvis & Lower Limbs',
    centroid: [-0.45, -0.70, 0.04],
    cameraPos: [0, -0.70, 2.4],
    lookAt: [0, -0.70, 0.04],
    fov: 36,
    defaultYaw: 0
  }
};

export const ANGLE_PRESETS = [
  { id: 'front', label: 'सामने (0°)', en: 'Front', yaw: 0, pitch: 0 },
  { id: 'left', label: 'बायां (90°)', en: 'Left View', yaw: -Math.PI / 2, pitch: 0 },
  { id: 'right', label: 'दायां (270°)', en: 'Right View', yaw: Math.PI / 2, pitch: 0 },
  { id: 'back', label: 'पीछे (180°)', en: 'Back', yaw: Math.PI, pitch: 0 }
];

export const LOCUS_TO_MACRO_ZONE: Record<string, MacroZone> = {
  'Head': 'head',
  'Face & Sinus': 'head',
  'Ear': 'head',
  'Neck': 'head',
  'Cervical Spine': 'head',

  'Left Chest / Precordium': 'chest',
  'Right Chest': 'chest',
  'Lungs & Respiration': 'chest',

  'Epigastrium': 'abdomen',
  'Umbilicus / Mid-Abdomen': 'abdomen',
  'Right Lower Quadrant (RLQ)': 'abdomen',
  'Left Lower Quadrant (LLQ)': 'abdomen',
  'Pelvic / Hypogastrium': 'abdomen',

  'Upper Back / Thoracic': 'spine',
  'Lumbar Spine (Kati)': 'spine',
  'Sacral / Sciatica Origin': 'spine',
  'Sciatic Pathway / Calves': 'legs',

  'Left Shoulder': 'arms',
  'Right Shoulder': 'arms',
  'Left Arm': 'arms',
  'Right Arm': 'arms',
  'Left Hand': 'arms',
  'Right Hand': 'arms',

  'Left Hip': 'legs',
  'Right Hip': 'legs',
  'Left Knee': 'legs',
  'Right Knee': 'legs',
  'Left Leg': 'legs',
  'Right Leg': 'legs',
  'Left Foot': 'legs',
  'Right Foot': 'legs'
};

export interface MicroLocusItem {
  id: string;
  subKey: string;
  hindiLabel: string;
  label: string;
  badgeText: string;
  ayushMarma: string;
  macroZone: MacroZone;
  position: [number, number, number];
  normal: [number, number, number];
  optimalView: { yaw: number; pitch?: number };
  isPosterior?: boolean;
  isEmergency?: boolean;
  symptoms: string[];
}

// Clinically Verified Micro Loci (+X: Patient Left, -X: Patient Right)
export const MICRO_LOCI_CATALOG: MicroLocusItem[] = [
  // 1. HEAD & FACE ZONE
  {
    id: 'Head',
    subKey: 'forehead',
    hindiLabel: 'माथा / ललाट',
    label: 'Forehead / Cranial',
    badgeText: 'माइग्रेन / तनाव सिरदर्द',
    ayushMarma: 'स्थपनी मर्म (Sthapani Marma)',
    macroZone: 'head',
    position: [0, 1.12, 0.10],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['माथे में भारी दबाव व तनाव', 'आधाशीशी / माइग्रेन', 'ललाट में धड़कता दर्द']
  },
  {
    id: 'Face & Sinus',
    subKey: 'face',
    hindiLabel: 'चेहरा व आँखें',
    label: 'Face, Sinuses & Eyes',
    badgeText: 'साइनस / आँखों में जलन',
    ayushMarma: 'फण व आवर्त मर्म',
    macroZone: 'head',
    position: [0, 0.98, 0.12],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['नाक बंद व सांस लेने में रुकावट', 'साइनस का भारी दबाव', 'आँखों में जलन व चुभन']
  },
  {
    id: 'Ear',
    subKey: 'ear_l',
    hindiLabel: 'बायां कान',
    label: 'Left Ear & Hearing',
    badgeText: 'कर्ण शूल / टीस',
    ayushMarma: 'विदुर मर्म (Vidhura Marma)',
    macroZone: 'head',
    position: [0.18, 1.02, 0.02],
    normal: [1, 0, 0],
    optimalView: { yaw: -Math.PI / 2, pitch: 0 },
    symptoms: ['बाएं कान में टीस या दर्द', 'कान में सीटी या घंटी बजना (Tinnitus)', 'सुनाई कम देना']
  },
  {
    id: 'Ear',
    subKey: 'ear_r',
    hindiLabel: 'दायां कान',
    label: 'Right Ear & Hearing',
    badgeText: 'कर्ण शूल / टीस',
    ayushMarma: 'विदुर मर्म (दक्षिण)',
    macroZone: 'head',
    position: [-0.18, 1.02, 0.02],
    normal: [-1, 0, 0],
    optimalView: { yaw: Math.PI / 2, pitch: 0 },
    symptoms: ['दाहिने कान में टीस या दर्द', 'कान में भारीपन', 'सुनाई कम देना']
  },
  {
    id: 'Neck',
    subKey: 'throat',
    hindiLabel: 'गला व थाइरॉइड',
    label: 'Throat & Larynx',
    badgeText: 'खराश / टॉन्सिल',
    ayushMarma: 'मन्या व नीला मर्म',
    macroZone: 'head',
    position: [0, 0.82, 0.08],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['गले में कांटे जैसी खराश', 'निगलने में तेज दर्द', 'आवाज़ बैठना या भारी होना']
  },
  {
    id: 'Cervical Spine',
    subKey: 'cervical',
    hindiLabel: 'गर्दन की रीढ़',
    label: 'Cervical Spine (Posterior)',
    badgeText: 'सर्वाइकल / गर्दन जकड़न',
    ayushMarma: 'ग्रीवा संधि · कृकाटिका',
    macroZone: 'head',
    position: [0, 0.82, -0.09],
    normal: [0, 0, -1],
    optimalView: { yaw: Math.PI, pitch: 0 },
    isPosterior: true,
    symptoms: ['गर्दन घुमाने में तेज दर्द', 'हाथ व उंगलियों में झुनझुनी', 'कंधे से गर्दन में अकड़न']
  },

  // 2. CHEST & THORACIC ZONE
  {
    id: 'Left Chest / Precordium',
    subKey: 'heart',
    hindiLabel: 'बायां सीना (हृदय)',
    label: 'Left Chest (Precordium)',
    badgeText: 'हृदय मर्म · आपातकाल',
    ayushMarma: 'हृदय मर्म (सद्यः प्राणहर)',
    macroZone: 'chest',
    position: [0.12, 0.55, 0.12],
    normal: [0.3, 0, 0.9],
    optimalView: { yaw: 0, pitch: 0 },
    isEmergency: true,
    symptoms: ['सीने में भारी दबाव व घबराहट', 'बाएं कंधे या बांह में खिंचाव', 'पसीना व सांस लेने में तकलीफ']
  },
  {
    id: 'Right Chest',
    subKey: 'right_chest',
    hindiLabel: 'दायां सीना',
    label: 'Right Thorax',
    badgeText: 'दाहिनी छाती का दर्द',
    ayushMarma: 'स्तनरोहित मर्म',
    macroZone: 'chest',
    position: [-0.12, 0.55, 0.12],
    normal: [-0.3, 0, 0.9],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['खांसने पर दाहिनी तरफ दर्द', 'पसलियों में खिंचाव', 'गहरी सांस पर चुभन']
  },
  {
    id: 'Lungs & Respiration',
    subKey: 'lungs',
    hindiLabel: 'फेफड़े व सांस',
    label: 'Lungs & Respiration',
    badgeText: 'दमा / खांसी / सांस फूलना',
    ayushMarma: 'प्राणवह स्रोतस् · फुप्फुस',
    macroZone: 'chest',
    position: [0, 0.55, 0.12],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['सांस फूलना व चलने में हांफ', 'सीटी जैसी आवाज (Wheezing)', 'लगातार सूखी या बलगम वाली खांसी']
  },

  // 3. ABDOMEN & VISCERA ZONE
  {
    id: 'Epigastrium',
    subKey: 'stomach',
    hindiLabel: 'ऊपरी पेट (आमाशय)',
    label: 'Epigastrium (Upper Stomach)',
    badgeText: 'ऊपरी पेट / अम्लपित्त / गैस',
    ayushMarma: 'आमाशय · समान वात / पाचक अग्नि',
    macroZone: 'abdomen',
    position: [0, 0.28, 0.12],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['सीने व पेट के मध्य जलन', 'खट्टी डकारें व मितली', 'खाली पेट दर्द या भारीपन']
  },
  {
    id: 'Umbilicus / Mid-Abdomen',
    subKey: 'navel',
    hindiLabel: 'मध्य पेट (नाभि)',
    label: 'Navel & Mid-Abdomen',
    badgeText: 'नाभि मर्म / मरोड़ / अफारा',
    ayushMarma: 'नाभि मर्म (सिरा मर्म)',
    macroZone: 'abdomen',
    position: [0, 0.02, 0.12],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['नाभि के आसपास मरोड़', 'पेट फूलना व गैस न निकलना', 'दस्त या बदहजमी']
  },
  {
    id: 'Pelvic / Hypogastrium',
    subKey: 'pelvis',
    hindiLabel: 'निचला पेट व पेडू',
    label: 'Lower Abdomen & Pelvis',
    badgeText: 'निचला पेट / पेडू / बस्ति',
    ayushMarma: 'बस्ति मर्म (सद्यः प्राणहर महामर्म)',
    macroZone: 'abdomen',
    position: [0, -0.18, 0.11],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['पेशाब में तीव्र जलन या दर्द', 'बार-बार पेशाब की हाजत', 'निचले पेट व पेडू में भारीपन व मरोड़']
  },
  {
    id: 'Right Lower Quadrant (RLQ)',
    subKey: 'appendix',
    hindiLabel: 'दायां निचला पेट (अपेंडिक्स)',
    label: 'Right Lower Quadrant',
    badgeText: 'दायां निचला पेट · अपेंडिक्स',
    ayushMarma: 'उण्डुक स्थान (Unduka)',
    macroZone: 'abdomen',
    position: [-0.14, -0.15, 0.11],
    normal: [-0.3, 0, 0.9],
    optimalView: { yaw: 0, pitch: 0 },
    isEmergency: true,
    symptoms: ['दाहिने निचले पेट में तीव्र चुभन', 'दबाने पर असहनीय दर्द (McBurney)', 'हल्का बुखार व उल्टी']
  },
  {
    id: 'Left Lower Quadrant (LLQ)',
    subKey: 'llq_kidney',
    hindiLabel: 'बायां निचला पेट (गुर्दा)',
    label: 'Left Lower Quadrant',
    badgeText: 'बायां निचला पेट · वृक्क / पथरी',
    ayushMarma: 'गुद सन्निकृष्ट मर्म',
    macroZone: 'abdomen',
    position: [0.14, -0.15, 0.11],
    normal: [0.3, 0, 0.9],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बायीं तरफ चुभन व मरोड़', 'पेशाब में जलन या रुकावट', 'कमर से पेट की तरफ आता दर्द']
  },

  // 4. SPINAL & POSTERIOR BACK AXIS
  {
    id: 'Upper Back / Thoracic',
    subKey: 'upper_back',
    hindiLabel: 'ऊपरी पीठ व रीढ़',
    label: 'Upper Back & Scapulae',
    badgeText: 'पीठ की अकड़न / कंधे',
    ayushMarma: 'अंसफलक मर्म',
    macroZone: 'spine',
    position: [0, 0.55, -0.11],
    normal: [0, 0, -1],
    optimalView: { yaw: Math.PI, pitch: 0 },
    isPosterior: true,
    symptoms: ['कंधों के बीच लगातार जकड़न', 'बैठने पर पीठ में थकावट', 'मांसपेशियों में गांठ जैसा दर्द']
  },
  {
    id: 'Lumbar Spine (Kati)',
    subKey: 'lumbar',
    hindiLabel: 'निचली कमर (कटि)',
    label: 'Lumbar Spine (Kati)',
    badgeText: 'कमर दर्द / स्लिप डिस्क',
    ayushMarma: 'कटिकतरुण मर्म (कटि शूल)',
    macroZone: 'spine',
    position: [0, 0.10, -0.11],
    normal: [0, 0, -1],
    optimalView: { yaw: Math.PI, pitch: 0 },
    isPosterior: true,
    symptoms: ['झुकने या वजन उठाने पर तेज दर्द', 'कमर में सुई जैसी चुभन', 'खड़े होने या चलने में तकलीफ']
  },
  {
    id: 'Sacral / Sciatica Origin',
    subKey: 'sacrum',
    hindiLabel: 'त्रिक व नितंब (सायटिका)',
    label: 'Sacrum & Sciatica Origin',
    badgeText: 'गृध्रसी / नितंब शूल',
    ayushMarma: 'नितम्ब व कुकुन्दर मर्म',
    macroZone: 'spine',
    position: [0, -0.18, -0.11],
    normal: [0, 0, -1],
    optimalView: { yaw: Math.PI, pitch: 0 },
    isPosterior: true,
    symptoms: ['बैठने पर नितंब में तेज दर्द', 'कमर के पीछे से उतरता दर्द', 'सायटिका नस में खिंचाव']
  },

  // 5. UPPER EXTREMITIES (ARMS & HANDS)
  {
    id: 'Right Shoulder',
    subKey: 'shoulder_r',
    hindiLabel: 'दायां कंधा',
    label: 'Right Shoulder Joint',
    badgeText: 'कंधा संधि / जकड़न',
    ayushMarma: 'अंस मर्म (दायां)',
    macroZone: 'arms',
    position: [-0.32, 0.68, 0.02],
    normal: [-0.9, 0.2, 0.3],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['कंधा उठाने में दर्द', 'रात में कंधे में टीस', 'कंधे में जकड़न (Frozen Shoulder)']
  },
  {
    id: 'Left Shoulder',
    subKey: 'shoulder_l',
    hindiLabel: 'बायां कंधा',
    label: 'Left Shoulder Joint',
    badgeText: 'कंधा संधि / जकड़न',
    ayushMarma: 'अंस मर्म (बायां)',
    macroZone: 'arms',
    position: [0.32, 0.68, 0.02],
    normal: [0.9, 0.2, 0.3],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बाएं कंधे में दर्द', 'हाथ ऊपर न उठना', 'कंधे की मांसपेशियों में खिंचाव']
  },
  {
    id: 'Right Arm',
    subKey: 'arm_r',
    hindiLabel: 'दायीं बांह व कोहनी',
    label: 'Right Arm & Elbow',
    badgeText: 'कोहनी / बांह दर्द',
    ayushMarma: 'कूर्पर मर्म (दायां)',
    macroZone: 'arms',
    position: [-0.44, 0.22, 0.04],
    normal: [-1, 0, 0],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['कोहनी मोड़ने पर दर्द', 'बांह में भारीपन व थकान', 'हाथ से वजन न उठना']
  },
  {
    id: 'Left Arm',
    subKey: 'arm_l',
    hindiLabel: 'बायीं बांह व कोहनी',
    label: 'Left Arm & Elbow',
    badgeText: 'कोहनी / बांह दर्द',
    ayushMarma: 'कूर्पर मर्म (बायां)',
    macroZone: 'arms',
    position: [0.44, 0.22, 0.04],
    normal: [1, 0, 0],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बायीं बांह में खिंचाव', 'कोहनी में दर्द', 'हाथ में झनझनाहट']
  },
  {
    id: 'Right Hand',
    subKey: 'hand_r',
    hindiLabel: 'दायां हाथ व कलाई',
    label: 'Right Hand & Wrist',
    badgeText: 'मणिबन्ध / हथेली / उंगलियां',
    ayushMarma: 'मणिबन्ध व तलहृदय (दायां)',
    macroZone: 'arms',
    position: [-0.52, -0.12, 0.04],
    normal: [-1, 0, 0],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['कलाई में दर्द व कमजोरी', 'उंगलियों में झुनझुनी व सुन्नता', 'पकड़ कमजोर होना']
  },
  {
    id: 'Left Hand',
    subKey: 'hand_l',
    hindiLabel: 'बायां हाथ व कलाई',
    label: 'Left Hand & Wrist',
    badgeText: 'मणिबन्ध / हथेली / उंगलियां',
    ayushMarma: 'मणिबन्ध व तलहृदय (बायां)',
    macroZone: 'arms',
    position: [0.52, -0.12, 0.04],
    normal: [1, 0, 0],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बाएं हाथ में सुन्नता', 'कलाई में दर्द', 'उंगलियों में अकड़न']
  },

  // 6. LOWER EXTREMITIES (LEGS, JOINTS & FEET)
  {
    id: 'Right Hip',
    subKey: 'hip_r',
    hindiLabel: 'दायां कूल्हा व जांघ',
    label: 'Right Hip & Thigh',
    badgeText: 'कूल्हा संधि / जांघ',
    ayushMarma: 'ऊर्वी मर्म (दायां)',
    macroZone: 'legs',
    position: [-0.20, -0.22, 0.04],
    normal: [-0.5, 0, 0.8],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['कूल्हे में अकड़न', 'जांघ की मांसपेशी में खिंचाव', 'चलने में लंगड़ाहट']
  },
  {
    id: 'Left Hip',
    subKey: 'hip_l',
    hindiLabel: 'बायां कूल्हा व जांघ',
    label: 'Left Hip & Thigh',
    badgeText: 'कूल्हा संधि / जांघ',
    ayushMarma: 'ऊर्वी मर्म (बायां)',
    macroZone: 'legs',
    position: [0.20, -0.22, 0.04],
    normal: [0.5, 0, 0.8],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बाएं कूल्हे में दर्द', 'जांघ में भारीपन', 'उठने-बैठने में कष्ट']
  },
  {
    id: 'Left Knee',
    subKey: 'knee_l',
    hindiLabel: 'बायां घुटना',
    label: 'Left Knee Joint',
    badgeText: 'जानु संधि / घुटने का दर्द',
    ayushMarma: 'जानु मर्म (बायां)',
    macroZone: 'legs',
    position: [0.16, -0.70, 0.06],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['चलने या सीढ़ियां चढ़ने पर घुटने में दर्द', 'घुटने में सूजन व कट-कट आवाज', 'मोड़ने में अकड़न']
  },
  {
    id: 'Right Knee',
    subKey: 'knee_r',
    hindiLabel: 'दायां घुटना',
    label: 'Right Knee Joint',
    badgeText: 'जानु संधि / घुटने का दर्द',
    ayushMarma: 'जानु मर्म (दायां)',
    macroZone: 'legs',
    position: [-0.16, -0.70, 0.06],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['दाहिने घुटने में तेज दर्द', 'सूजन व चलने में परेशानी', 'घुटने की कटोरी में दर्द']
  },
  {
    id: 'Sciatic Pathway / Calves',
    subKey: 'sciatica_path',
    hindiLabel: 'पिंडलियाँ व पैर',
    label: 'Calves & Sciatic Nerve',
    badgeText: 'गृध्रसी / पैर में उतरता दर्द',
    ayushMarma: 'इन्द्रबस्ति मर्म (मांस मर्म)',
    macroZone: 'legs',
    position: [0, -0.92, -0.08],
    normal: [0, 0, -1],
    optimalView: { yaw: Math.PI, pitch: 0 },
    isPosterior: true,
    symptoms: ['कमर से पैर के तलवे तक बिजली सा दर्द', 'पिंडलियों में रात को तीव्र ऐंठन', 'पैर में भारीपन व सुन्नता']
  },
  {
    id: 'Left Leg',
    subKey: 'leg_l',
    hindiLabel: 'बायीं पिंडली',
    label: 'Left Shin & Leg',
    badgeText: 'नली की हड्डी / पिंडली',
    ayushMarma: 'गुल्फ सन्निकृष्ट (बायां)',
    macroZone: 'legs',
    position: [0.16, -0.92, 0.06],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['बायीं नली की हड्डी में दर्द', 'पैर में सूजन व भारीपन', 'चलने पर खिंचाव']
  },
  {
    id: 'Right Leg',
    subKey: 'leg_r',
    hindiLabel: 'दायीं पिंडली',
    label: 'Right Shin & Leg',
    badgeText: 'नली की हड्डी / पिंडली',
    ayushMarma: 'गुल्फ सन्निकृष्ट (दायां)',
    macroZone: 'legs',
    position: [-0.16, -0.92, 0.06],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['दाहिनी पिंडली में दर्द', 'नली की हड्डी में चुभन', 'पैर में भारीपन']
  },
  {
    id: 'Left Foot',
    subKey: 'foot_l',
    hindiLabel: 'बायां पैर व तलवा',
    label: 'Left Foot & Ankle',
    badgeText: 'गुल्फ / तलहृदय मर्म',
    ayushMarma: 'गुल्फ मर्म (बायां)',
    macroZone: 'legs',
    position: [0.16, -1.15, 0.08],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['चलने पर पैर के तलवे में दर्द', 'टखने में सूजन व मोच', 'एड़ी का दर्द']
  },
  {
    id: 'Right Foot',
    subKey: 'foot_r',
    hindiLabel: 'दायां पैर व तलवा',
    label: 'Right Foot & Ankle',
    badgeText: 'गुल्फ / तलहृदय मर्म',
    ayushMarma: 'गुल्फ मर्म (दायां)',
    macroZone: 'legs',
    position: [-0.16, -1.15, 0.08],
    normal: [0, 0, 1],
    optimalView: { yaw: 0, pitch: 0 },
    symptoms: ['दाहिने पैर में दर्द', 'टखने में सूजन', 'तलवे में जलन']
  }
];

export const ANATOMICAL_LOCI_3D: AnatomicalLocus3D[] = MICRO_LOCI_CATALOG.map(m => ({
  id: m.id,
  subKey: m.subKey,
  label: m.label,
  hindiLabel: m.hindiLabel,
  ayushMarma: m.ayushMarma,
  category: (
    m.id.includes('Head') ? 'cranial' :
    m.id.includes('Face') ? 'face' :
    m.id.includes('Ear') ? 'ear' :
    m.id.includes('Neck') ? 'throat' :
    m.id.includes('Heart') || m.id.includes('Precordium') ? 'cardiac' :
    m.id.includes('Lungs') ? 'pulmonary' :
    m.id.includes('Arm') || m.id.includes('Hand') || m.id.includes('Shoulder') ? 'arm' :
    m.id.includes('Epigastrium') ? 'epigastrium' :
    m.id.includes('Umbilicus') ? 'abdomen' :
    m.id.includes('RLQ') ? 'rlq' :
    m.id.includes('LLQ') ? 'llq' :
    m.id.includes('Pelvic') ? 'pelvis' :
    m.id.includes('Knee') ? 'joint' :
    m.id.includes('Cervical') ? 'spine' :
    m.id.includes('Lumbar') ? 'lumbar' :
    m.id.includes('Sciatic') || m.id.includes('Calves') ? 'sciatica' :
    'lowerLimb'
  ),
  macroZone: m.macroZone,
  position: m.position,
  normal: m.normal,
  optimalView: m.optimalView,
  isPosterior: m.isPosterior
}));

// ------------------------------------------------------------------------------------------------
// Calibrated body-region classifier
//
// The GLB is scaled so the source model (0 cm at the soles → 170.4 cm at the crown) spans local
// y ∈ [-1.205, +1.245]. Landmarks from the mesh database (centres in cm): patella 44, femur head 88,
// iliac crest ~101, xiphoid ~124, heart 129, clavicle 141, thyroid cartilage 148, mandible 154,
// frontal bone 165; shoulders at x ≈ ±17, elbows ±21, wrists ±25. +X is the patient's LEFT.
// ------------------------------------------------------------------------------------------------
const MODEL_HEIGHT_CM = 170.4;
const LOCAL_FEET_Y = -1.205;
const LOCAL_HEIGHT = 2.45;
const CM_PER_UNIT = MODEL_HEIGHT_CM / LOCAL_HEIGHT;

/** Converts a model-local point to centimetres above the soles / from the midline. */
export const localToBodyCm = (p: { x: number; y: number; z: number }) => ({
  h: (p.y - LOCAL_FEET_Y) * CM_PER_UNIT,
  x: p.x * CM_PER_UNIT,
  z: p.z * CM_PER_UNIT
});

/** Inverse of `localToBodyCm` for placing markers and camera targets. */
export const bodyCmToLocal = (h: number, x = 0, z = 0): [number, number, number] => [
  x / CM_PER_UNIT,
  LOCAL_FEET_Y + h / CM_PER_UNIT,
  z / CM_PER_UNIT
];

/**
 * Maps a point on (or inside) the body to a clinical region.
 * `posterior` should come from the surface normal for taps, or from depth for mesh centres.
 */
export const classifyBodyPoint = (h: number, x: number, posterior: boolean): string => {
  const ax = Math.abs(x);
  const side = x >= 0 ? 'Left' : 'Right';

  if (h >= 150) {
    if (ax >= 6.8 && h <= 163) return 'Ear';
    if (posterior) return h >= 156 ? 'Head' : 'Cervical Spine';
    return h >= 159 ? 'Head' : 'Face & Sinus';
  }
  if (h >= 141) {
    if (ax >= 9.5) return `${side} Shoulder`;
    return posterior ? 'Cervical Spine' : 'Neck';
  }

  // Upper limbs hang outside the torso outline.
  const torsoHalfWidth = h >= 118 ? 14.5 : h >= 95 ? 13 : 15.5;
  const inArmColumn = (h >= 80 && ax >= torsoHalfWidth + 1.5) || (h >= 60 && h < 80 && ax >= 20);
  if (inArmColumn || (h >= 128 && ax >= 12.5)) {
    if (h >= 126) return `${side} Shoulder`;
    if (h >= 88) return `${side} Arm`;
    return `${side} Hand`;
  }

  if (h >= 118) return posterior ? 'Upper Back / Thoracic' : x >= -1 ? 'Left Chest / Precordium' : 'Right Chest';
  if (h >= 107) return posterior ? 'Upper Back / Thoracic' : 'Epigastrium';
  if (h >= 96) return posterior ? 'Lumbar Spine (Kati)' : 'Umbilicus / Mid-Abdomen';
  if (h >= 80) {
    if (posterior) return h >= 92 ? 'Lumbar Spine (Kati)' : 'Sacral / Sciatica Origin';
    if (ax >= 11) return `${side} Hip`;
    if (ax >= 3.5 && h >= 84) return x >= 0 ? 'Left Lower Quadrant (LLQ)' : 'Right Lower Quadrant (RLQ)';
    return 'Pelvic / Hypogastrium';
  }
  if (h >= 72 && posterior) return 'Sacral / Sciatica Origin';
  if (h >= 52) return `${side} Hip`;
  if (h >= 37) return `${side} Knee`;
  if (h >= 9) return `${side} Leg`;
  return `${side} Foot`;
};

/** Backwards-compatible wrapper used by older call sites (assumes a front-facing point). */
export const classifyHitToRegion = (localHit: THREE.Vector3 | { x: number; y: number; z: number }): string => {
  const cm = localToBodyCm(localHit);
  return classifyBodyPoint(cm.h, cm.x, cm.z < -3.5);
};

const _tmpQuat = new THREE.Quaternion();
const _tmpNormal = new THREE.Vector3();

/**
 * Region for a raycast hit. Uses the exact tap point plus the surface normal (front vs back), so the
 * same spot always gives the same region regardless of which anatomical mesh happened to be on top.
 */
export const resolveRegionFromHit = (
  topHit: THREE.Intersection,
  _allIntersects: THREE.Intersection[],
  humanGroup: THREE.Group
): string => {
  const localHit = humanGroup.worldToLocal(topHit.point.clone());
  const cm = localToBodyCm(localHit);
  let posterior = cm.z < -3;
  if (topHit.face) {
    _tmpNormal.copy(topHit.face.normal).transformDirection(topHit.object.matrixWorld);
    humanGroup.getWorldQuaternion(_tmpQuat).invert();
    _tmpNormal.applyQuaternion(_tmpQuat);
    if (Math.abs(_tmpNormal.z) > 0.3) posterior = _tmpNormal.z < 0;
  }
  return classifyBodyPoint(cm.h, cm.x, posterior);
};

// Marker positions calibrated to the model's anatomy (see `bodyCmToLocal`).
const CALIBRATED_LOCI_CM: Record<string, [h: number, x: number, z: number]> = {
  forehead: [163, 0, 7], face: [154, 0, 8], ear_l: [157, 7.5, 0], ear_r: [157, -7.5, 0], throat: [146, 0, 5],
  cervical: [148, 0, -6], heart: [129, 4, 8], right_chest: [129, -7, 8], lungs: [132, 0, 8],
  stomach: [115, 0, 8], navel: [102, 0, 8], pelvis: [86, 0, 7], appendix: [91, -6, 7], llq_kidney: [91, 6, 7],
  upper_back: [128, 0, -8], lumbar: [101, 0, -7], sacrum: [86, 0, -8], sciatica_path: [28, 0, -5],
  shoulder_r: [138, -17, 0], shoulder_l: [138, 17, 0], arm_r: [108, -21, 0], arm_l: [108, 21, 0],
  hand_r: [78, -25, 1], hand_l: [78, 25, 1], hip_r: [70, -10, 3], hip_l: [70, 10, 3],
  knee_l: [44, 8.5, 3], knee_r: [44, -8.5, 3], leg_l: [24, 8, 3], leg_r: [24, -8, 3], foot_l: [4, 8, 5], foot_r: [4, -8, 5]
};
MICRO_LOCI_CATALOG.forEach(locus => {
  const cm = CALIBRATED_LOCI_CM[locus.subKey];
  if (cm) locus.position = bodyCmToLocal(cm[0], cm[1], cm[2]);
});
// Calves / sciatic pathway are viewed from the back but belong to the leg zone.
MICRO_LOCI_CATALOG.forEach(locus => {
  if (locus.subKey === 'sciatica_path') locus.macroZone = 'legs';
});

/** Camera distance used when focusing on a single region, by zone (keeps zoom consistent). */
const ZONE_FOCUS_DISTANCE: Record<MacroZone, number> = {
  full: 4.3, head: 1.45, chest: 1.8, abdomen: 1.8, spine: 2.1, arms: 2.0, legs: 1.9, torso: 2.2, lower: 2.2
};

// Multi-Strategy Dual Spatial & Semantic Region Matcher
export const isMeshMatchingSelectedRegion = (
  meshName: string,
  record: AnatomicalMeshRecord | undefined,
  userData: any,
  selectedRegion: string
): boolean => {
  if (!selectedRegion) return false;

  // Strategy 1: Direct JSON database record match
  if (record && record.regionId === selectedRegion) return true;

  // Strategy 2: Pre-computed spatial bounding box center match
  if (userData?.spatialRegionId === selectedRegion) return true;

  // Strategy 3: Precision anatomical semantic keyword and geometric zone match
  const name = (meshName || '').toLowerCase();
  const cx = userData?.cx ?? 0;
  const cy = userData?.cy ?? 0;
  const cz = userData?.cz ?? 0;
  const isLeft = userData?.isLeft ?? (cx > 0.025);
  const isRight = userData?.isRight ?? (cx < -0.025);

  switch (selectedRegion) {
    case 'Left Shoulder':
      return (isLeft || cx > 0.08) && (
        /shoulder|deltoid|supraspin|infraspin|subscapular|teres_minor|teres_major|clavicle|acromio|glenohumeral|coraco|pectoralis_minor/i.test(name) ||
        (cy >= 0.45 && cy <= 0.85 && cx >= 0.15 && Math.abs(cz) <= 0.25)
      );

    case 'Right Shoulder':
      return (isRight || cx < -0.08) && (
        /shoulder|deltoid|supraspin|infraspin|subscapular|teres_minor|teres_major|clavicle|acromio|glenohumeral|coraco|pectoralis_minor/i.test(name) ||
        (cy >= 0.45 && cy <= 0.85 && cx <= -0.15 && Math.abs(cz) <= 0.25)
      );

    case 'Left Chest / Precordium':
      return (isLeft || Math.abs(cx) <= 0.15) && (
        /heart|ventricle|atrium|myocardi|aort|coronary|pericard|precord|pulmonary_trunk|internal_thoracic|sternocostal/i.test(name) ||
        (cy >= 0.35 && cy <= 0.75 && cx >= -0.02 && cx <= 0.22 && cz >= 0.0)
      );

    case 'Right Chest':
      return (isRight || cx < 0.0) && (
        /right_chest|pectoral.*r|thorac.*r|rib.*r|intercostal.*r/i.test(name) ||
        (cy >= 0.35 && cy <= 0.75 && cx <= -0.04 && cx >= -0.25 && cz >= 0.0)
      );

    case 'Lungs & Respiration':
      return /lung|pulmon|bronch|trachea|pleura|alveol/i.test(name) ||
        (cy >= 0.35 && cy <= 0.80 && Math.abs(cx) <= 0.22 && Math.abs(cz) <= 0.15);

    case 'Epigastrium':
      return (
        /epigastr|stomach|gastric|celiac|pancrea|duoden|liver|hepatic|gallbladder|biliary|splen|rectus_abdominis/i.test(name) ||
        (cy >= 0.16 && cy <= 0.42 && Math.abs(cx) <= 0.18 && cz >= -0.02)
      );

    case 'Umbilicus / Mid-Abdomen':
      return (
        /umbilic|mesenter|jejun|ileum|colon|peritone|rectus_abdominis|abdominal_oblique|transversus_abdominis/i.test(name) ||
        (cy >= -0.10 && cy <= 0.18 && Math.abs(cx) <= 0.16 && cz >= -0.02)
      );

    case 'Right Lower Quadrant (RLQ)':
      return (isRight || cx < 0) && (
        /appendix|caecum|cecum|unduka|ileocecal|mcburney/i.test(name) ||
        (cy >= -0.28 && cy <= 0.02 && cx <= -0.04 && cx >= -0.22 && cz >= -0.02)
      );

    case 'Left Lower Quadrant (LLQ)':
      return (isLeft || cx > 0) && (
        /sigmoid|descending_colon|renal.*l|vrikka.*l|kidney.*l/i.test(name) ||
        (cy >= -0.28 && cy <= 0.02 && cx >= 0.04 && cx <= 0.22 && cz >= -0.02)
      );

    case 'Pelvic / Hypogastrium':
      return (
        /pelvi|hypogastr|bladder|basti|pubis|pubic|iliac|ilium|sacroiliac|obturator|inguinal/i.test(name) ||
        (cy >= -0.32 && cy <= -0.05 && Math.abs(cx) <= 0.18)
      );

    case 'Upper Back / Thoracic':
      return (cz <= 0.02) && (
        /thorac.*spine|t1|t2|t3|t4|t5|t6|t7|t8|t9|t10|t11|t12|rhomboid|latissimus|trapezius|scapula|interscapular|longissimus_thoracis|iliocostalis_thoracis/i.test(name) ||
        (cy >= 0.35 && cy <= 0.78 && Math.abs(cx) <= 0.25 && cz <= -0.02)
      );

    case 'Lumbar Spine (Kati)':
      return (cz <= 0.02) && (
        /lumbar|l1|l2|l3|l4|l5|quadratus_lumborum|psoas|erector_spinae|multifidus|intertransversarii_lumborum/i.test(name) ||
        (cy >= -0.08 && cy <= 0.25 && Math.abs(cx) <= 0.15 && cz <= -0.02)
      );

    case 'Sacral / Sciatica Origin':
      return (cz <= 0.02) && (
        /sacr|coccyx|piriformis|sciatic.*notch|glute.*origin|sacrotuberous|sacrospinous/i.test(name) ||
        (cy >= -0.32 && cy <= -0.05 && Math.abs(cx) <= 0.20 && cz <= -0.02)
      );

    case 'Left Hip':
      return (isLeft || cx > 0.08) && (
        /hip.*l|femur.*l|femoral.*l|acetabul.*l|gluteus.*l|tensor_fascia.*l|iliopsoas.*l|pectineus.*l|gracilis.*l|adductor.*l/i.test(name) ||
        (cy >= -0.55 && cy <= -0.15 && cx >= 0.08 && cx <= 0.32)
      );

    case 'Right Hip':
      return (isRight || cx < -0.08) && (
        /hip.*r|femur.*r|femoral.*r|acetabul.*r|gluteus.*r|tensor_fascia.*r|iliopsoas.*r|pectineus.*r|gracilis.*r|adductor.*r/i.test(name) ||
        (cy >= -0.55 && cy <= -0.15 && cx <= -0.08 && cx >= -0.32)
      );

    case 'Left Knee':
      return (isLeft || cx > 0.04) && (
        /patell.*l|knee.*l|menisc.*l|cruciate.*l|poplite.*l|tibiofemoral.*l/i.test(name) ||
        (cy >= -0.85 && cy <= -0.55 && cx >= 0.06 && cx <= 0.26)
      );

    case 'Right Knee':
      return (isRight || cx < -0.04) && (
        /patell.*r|knee.*r|menisc.*r|cruciate.*r|poplite.*r|tibiofemoral.*r/i.test(name) ||
        (cy >= -0.85 && cy <= -0.55 && cx <= -0.06 && cx >= -0.26)
      );

    case 'Sciatic Pathway / Calves':
      return (cz <= 0.02) && (
        /gastrocnemius|soleus|achilles|popliteal|tibial_nerve|plantaris/i.test(name) ||
        (cy >= -1.15 && cy <= -0.65 && Math.abs(cx) <= 0.28 && cz <= -0.02)
      );

    case 'Left Leg':
      return (isLeft || cx > 0.04) && (
        /tibia.*l|fibula.*l|tibialis.*l|extensor_digitorum.*l|perone.*l|gastrocnemius.*l|soleus.*l/i.test(name) ||
        (cy >= -1.15 && cy <= -0.60 && cx >= 0.06 && cx <= 0.26)
      );

    case 'Right Leg':
      return (isRight || cx < -0.04) && (
        /tibia.*r|fibula.*r|tibialis.*r|extensor_digitorum.*r|perone.*r|gastrocnemius.*r|soleus.*r/i.test(name) ||
        (cy >= -1.15 && cy <= -0.60 && cx <= -0.06 && cx >= -0.26)
      );

    case 'Left Foot':
      return (isLeft || cx > 0.04) && (
        /foot.*l|tarsal.*l|metatarsal.*l|calcaneus.*l|talus.*l|cuneiform.*l|navicular.*l|plantar.*l|sole.*l/i.test(name) ||
        (cy <= -1.05 && cx >= 0.04)
      );

    case 'Right Foot':
      return (isRight || cx < -0.04) && (
        /foot.*r|tarsal.*r|metatarsal.*r|calcaneus.*r|talus.*r|cuneiform.*r|navicular.*r|plantar.*r|sole.*r/i.test(name) ||
        (cy <= -1.05 && cx <= -0.04)
      );

    case 'Left Arm':
      return (isLeft || cx > 0.15) && (
        /humerus.*l|biceps.*l|triceps.*l|brachia.*l|radius.*l|ulna.*l|pronator.*l|supinator.*l|cubit.*l/i.test(name) ||
        (cy >= 0.05 && cy <= 0.65 && cx >= 0.25)
      );

    case 'Right Arm':
      return (isRight || cx < -0.15) && (
        /humerus.*r|biceps.*r|triceps.*r|brachia.*r|radius.*r|ulna.*r|pronator.*r|supinator.*r|cubit.*r/i.test(name) ||
        (cy >= 0.05 && cy <= 0.65 && cx <= -0.25)
      );

    case 'Left Hand':
      return (isLeft || cx > 0.25) && (
        /hand.*l|carpal.*l|metacarpal.*l|palmar.*l|wrist.*l|thenar.*l|scaphoid.*l|lunate.*l/i.test(name) ||
        (cy <= 0.05 && cy >= -0.35 && cx >= 0.32)
      );

    case 'Right Hand':
      return (isRight || cx < -0.25) && (
        /hand.*r|carpal.*r|metacarpal.*r|palmar.*r|wrist.*r|thenar.*r|scaphoid.*r|lunate.*r/i.test(name) ||
        (cy <= 0.05 && cy >= -0.35 && cx <= -0.32)
      );

    case 'Head':
      return (
        /head|brain|cerebr|cerebell|cranial|skull|frontal|parietal|occipital|temporal.*bone|scalp/i.test(name) ||
        (cy >= 0.95 && Math.abs(cx) <= 0.18)
      );

    case 'Face & Sinus':
      return (
        /face|sinus|nasal|maxill|mandib|orbit|eye|cornea|sclera|zygomat|masseter|temporalis|buccinat|mentalis|frontalis/i.test(name) ||
        (cy >= 0.82 && cy <= 1.05 && Math.abs(cx) <= 0.16 && cz >= 0.0)
      );

    case 'Ear':
      return (
        /ear|auricular|tympan|acoustic|vestibul|pinna|mastoid/i.test(name) ||
        (cy >= 0.88 && cy <= 1.10 && Math.abs(cx) >= 0.12 && Math.abs(cx) <= 0.24)
      );

    case 'Neck':
      return (cz >= -0.02) && (
        /neck|throat|larynx|thyroid|pharynx|hyoid|cricoid|trachea.*neck|carotid|jugular|sternocleidomastoid|platysma|mylohyoid/i.test(name) ||
        (cy >= 0.72 && cy <= 0.92 && Math.abs(cx) <= 0.14 && cz >= -0.02)
      );

    case 'Cervical Spine':
      return (cz <= 0.02) && (
        /cervical|c1|c2|c3|c4|c5|c6|c7|atlas|axis|nuchal|splenius_capitis|semispinalis_capitis|rectus_capitis/i.test(name) ||
        (cy >= 0.72 && cy <= 0.95 && Math.abs(cx) <= 0.14 && cz <= -0.02)
      );

    default:
      return false;
  }
};

// Regions the tap classifier never returns (they are chosen from the list) keep the name-based matcher.
const NAME_MATCHED_REGIONS = new Set(['Lungs & Respiration', 'Sciatic Pathway / Calves']);

/**
 * Whether a mesh should light up for the selected region. Uses the same calibrated classifier as
 * tapping, so the highlighted area always matches what a tap there would select. Very long meshes
 * (e.g. a spinal muscle running from neck to pelvis) are skipped so they do not light up a whole side.
 */
export const meshBelongsToRegion = (
  mesh: THREE.Mesh,
  record: AnatomicalMeshRecord | undefined,
  selectedRegion: string
): boolean => {
  if (!selectedRegion) return false;
  if (NAME_MATCHED_REGIONS.has(selectedRegion)) {
    return isMeshMatchingSelectedRegion(mesh.name, record, mesh.userData, selectedRegion);
  }
  const maxDim = mesh.userData?.maxDimCm ?? 0;
  if (maxDim > 32) return false;
  return mesh.userData?.spatialRegionId === selectedRegion;
};

interface AnatomicalMannequin3DProps {
  selectedRegion?: string;
  onSelectRegion: (regionId: string) => void;
  viewMode?: 'front' | 'back';
  onViewModeChange?: (mode: 'front' | 'back') => void;
  isPrivateMode?: boolean;
  activeMacroZone?: MacroZone;
  onMacroZoneChange?: (zone: MacroZone) => void;
  systemLayer?: AnatomicalSystemLayer;
  onSystemLayerChange?: (layer: AnatomicalSystemLayer) => void;
  externalCameraTarget?: { yaw?: number; pitch?: number; zoom?: number } | null;
  className?: string;
  showAngleControls?: boolean;
  hideHeaderControls?: boolean;
  isFocusMode?: boolean;
  language?: string;
}

export const AnatomicalMannequin3D: React.FC<AnatomicalMannequin3DProps> = ({
  selectedRegion,
  onSelectRegion,
  viewMode = 'front',
  onViewModeChange,
  isPrivateMode = false,
  activeMacroZone: externalMacroZone,
  onMacroZoneChange,
  systemLayer: externalSystemLayer,
  onSystemLayerChange,
  externalCameraTarget,
  className,
  showAngleControls = true,
  hideHeaderControls = false,
  isFocusMode = false,
  language = 'hi'
}) => {
  const tx = kioskText(language);
  const mountRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [internalSystemLayer, setInternalSystemLayer] = useState<AnatomicalSystemLayer>('all');
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [internalMacroZone, setInternalMacroZone] = useState<MacroZone>('full');
  const [isAutoRotating, setIsAutoRotating] = useState(false);

  const activeSystemLayer = externalSystemLayer || internalSystemLayer;
  const activeMacroZone = externalMacroZone || internalMacroZone;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const humanGroupRef = useRef<THREE.Group | null>(null);
  const heartMeshRef = useRef<THREE.Mesh | null>(null);
  const selectedAreaLightRef = useRef<THREE.PointLight | null>(null);

  const isDraggingRef = useRef(false);
  const previousPointerPositionRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef(new THREE.Vector2(-999, -999));
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  const targetRotationYRef = useRef(viewMode === 'back' ? Math.PI : 0);
  const currentRotationYRef = useRef(viewMode === 'back' ? Math.PI : 0);
  const targetRotationXRef = useRef(0);
  const currentRotationXRef = useRef(0);
  const isAutoRotatingRef = useRef(isAutoRotating);
  isAutoRotatingRef.current = isAutoRotating;

  const targetCameraPosRef = useRef(new THREE.Vector3(0, 0.15, 4.3));
  const targetCameraLookAtRef = useRef(new THREE.Vector3(0, 0.15, 0));
  const currentCameraLookAtRef = useRef(new THREE.Vector3(0, 0.15, 0));

  const selectedRegionRef = useRef(selectedRegion);
  selectedRegionRef.current = selectedRegion;

  const activeMacroZoneRef = useRef(activeMacroZone);
  activeMacroZoneRef.current = activeMacroZone;

  const onMacroZoneChangeRef = useRef(onMacroZoneChange);
  onMacroZoneChangeRef.current = onMacroZoneChange;

  const onSelectRegionRef = useRef(onSelectRegion);
  onSelectRegionRef.current = onSelectRegion;

  // Stored references for fast O(1) highlighting and layer swapping
  const meshesRef = useRef<Map<string, {
    mesh: THREE.Mesh;
    origMaterial: THREE.Material;
    record: AnatomicalMeshRecord | undefined;
  }>>(new Map());

  // 24-Color Curated Master Highlighting Materials Cache (FrontSide, Solid Opaque & Luminous)
  const regionHighlightMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  const getRegionHighlightMaterial = useCallback((regionId: string): THREE.MeshStandardMaterial => {
    if (regionHighlightMaterialsRef.current.has(regionId)) {
      return regionHighlightMaterialsRef.current.get(regionId)!;
    }

    const colorDef = REGION_CHROMATIC_PALETTE[regionId] || DEFAULT_REGION_COLOR;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorDef.color),
      emissive: new THREE.Color(colorDef.emissive),
      emissiveIntensity: Math.min(1.0, colorDef.emissiveIntensity * 1.8),
      roughness: 0.20,
      metalness: 0.12,
      side: THREE.FrontSide,
      depthWrite: true,
      depthTest: true
    });

    regionHighlightMaterialsRef.current.set(regionId, material);
    return material;
  }, []);

  // Stored reference to outer skin shell
  const skinMeshRef = useRef<THREE.Mesh | null>(null);
  const skinMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const pointerDownPositionRef = useRef({ x: 0, y: 0 });
  const lastHoveredRegionIdRef = useRef<string | null>(null);

  // Translucent Surgical Ghost Material for Non-Active Layers (Solid Matte Silhouette, No Glass Glitches)
  const ghostMaterialRef = useRef(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x334155),
      roughness: 0.85,
      metalness: 0.0,
      transparent: true,
      opacity: 0.45,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide
    })
  );

  // Dynamic Camera Framing & Multi-Strategy Solid Highlight Effect
  useEffect(() => {
    // Focus the camera on the selected spot at a zoom level that is fixed per zone, so every region
    // in a zone is shown at the same scale.
    const focusLocus = selectedRegion ? MICRO_LOCI_CATALOG.find(l => l.id === selectedRegion) : undefined;
    if (activeMacroZone !== 'full' && focusLocus) {
      const dist = ZONE_FOCUS_DISTANCE[activeMacroZone] || 2.0;
      const y = focusLocus.position[1];
      targetCameraPosRef.current.set(0, y, dist);
      targetCameraLookAtRef.current.set(0, y, 0);
      if (cameraRef.current) {
        cameraRef.current.fov = 34;
        cameraRef.current.updateProjectionMatrix();
      }
    } else if (activeMacroZone && MACRO_ZONE_DATA[activeMacroZone]) {
      const zData = MACRO_ZONE_DATA[activeMacroZone];
      targetCameraPosRef.current.set(...zData.cameraPos);
      targetCameraLookAtRef.current.set(...zData.lookAt);
      if (cameraRef.current && zData.fov) {
        cameraRef.current.fov = zData.fov;
        cameraRef.current.updateProjectionMatrix();
      }
      if (typeof zData.defaultYaw === 'number' && activeMacroZone === 'spine') {
        targetRotationYRef.current = zData.defaultYaw;
      }
    } else {
      targetCameraPosRef.current.set(0, 0.05, 4.3);
      targetCameraLookAtRef.current.set(0, 0.05, 0);
      if (cameraRef.current) {
        cameraRef.current.fov = 38;
        cameraRef.current.updateProjectionMatrix();
      }
    }

    // Illuminate active region with matching chromatic spotlight
    const activeLocus = selectedRegion ? MICRO_LOCI_CATALOG.find(l => l.id === selectedRegion) : undefined;
    const colorDef = (selectedRegion && REGION_CHROMATIC_PALETTE[selectedRegion]) || DEFAULT_REGION_COLOR;
    if (activeLocus && selectedAreaLightRef.current) {
      selectedAreaLightRef.current.position.set(...activeLocus.position);
      selectedAreaLightRef.current.color.setHex(colorDef.pointLightColor);
      selectedAreaLightRef.current.intensity = 3.2;
      selectedAreaLightRef.current.distance = 1.6;
    } else if (selectedAreaLightRef.current) {
      selectedAreaLightRef.current.intensity = 0;
    }


  }, [selectedRegion, activeMacroZone, getRegionHighlightMaterial]);

  // Materials: selected region glows, everything else keeps its layer shading and is dimmed while a
  // region is selected so the selection stands out. One effect owns all material changes.
  useEffect(() => {
    const activeHighlightMaterial = selectedRegion ? getRegionHighlightMaterial(selectedRegion) : null;
    const isLayerTarget = (mesh: THREE.Mesh, record: AnatomicalMeshRecord | undefined) => {
      switch (activeSystemLayer) {
        case 'muscular': return record?.system === 'muscular' || record?.system === 'ligament' || /muscle|deltoid|biceps|gluteus|gastrocnemius|rectus|oblique|trapezius|latissimus|pectoral/i.test(mesh.name);
        case 'skeletal': return record?.system === 'skeletal' || record?.system === 'cartilage' || /bone|vertebra|rib|skull|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|pelvis|patell/i.test(mesh.name);
        case 'vascular': return record?.system === 'vascular' || /artery|vein|cava|aort|carotid|jugular|sinus/i.test(mesh.name);
        case 'visceral': return record?.system === 'visceral' || /heart|stomach|liver|kidney|bladder|lung|aort|cava|splen|ren|gastric|pancrea|duoden|ileum|colon/i.test(mesh.name);
        default: return true;
      }
    };

    meshesRef.current.forEach(({ mesh, origMaterial, record }) => {
      mesh.visible = true;
      if (activeHighlightMaterial && meshBelongsToRegion(mesh, record, selectedRegion!)) {
        mesh.material = activeHighlightMaterial;
        mesh.renderOrder = 1;
        return;
      }
      mesh.renderOrder = 0;
      if (!isLayerTarget(mesh, record)) {
        mesh.material = ghostMaterialRef.current;
        return;
      }
      if (selectedRegion) {
        if (!mesh.userData._dimMat) {
          const dim = origMaterial.clone() as THREE.MeshStandardMaterial;
          dim.transparent = true;
          dim.opacity = 0.35;
          if ('emissiveIntensity' in dim) dim.emissiveIntensity = 0;
          mesh.userData._dimMat = dim;
        }
        mesh.material = mesh.userData._dimMat;
      } else {
        mesh.material = origMaterial;
      }
    });
  }, [activeSystemLayer, selectedRegion, getRegionHighlightMaterial, modelLoaded]);

  // Handle external camera targets
  useEffect(() => {
    if (externalCameraTarget) {
      if (typeof externalCameraTarget.yaw === 'number') {
        targetRotationYRef.current = externalCameraTarget.yaw;
      }
      if (typeof externalCameraTarget.pitch === 'number') {
        targetRotationXRef.current = externalCameraTarget.pitch;
      }
    }
  }, [externalCameraTarget]);

  const applyAnglePreset = (yaw: number, pitch = 0) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    targetRotationYRef.current = yaw;
    targetRotationXRef.current = pitch;
    if (yaw === Math.PI) {
      onViewModeChange?.('back');
    } else if (yaw === 0) {
      onViewModeChange?.('front');
    }
  };

  // Synchronize target rotation with viewMode prop
  useEffect(() => {
    if (viewMode === 'front') {
      targetRotationYRef.current = 0;
      targetRotationXRef.current = 0;
    } else {
      targetRotationYRef.current = Math.PI;
      targetRotationXRef.current = 0;
    }
  }, [viewMode]);

  // If selectedRegion is posterior, auto-rotate to back
  useEffect(() => {
    const locus = MICRO_LOCI_CATALOG.find(l => l.id === selectedRegion);
    if (locus) {
      if (locus.isPosterior && targetRotationYRef.current !== Math.PI) {
        targetRotationYRef.current = Math.PI;
        onViewModeChange?.('back');
      } else if (!locus.isPosterior && targetRotationYRef.current === Math.PI) {
        targetRotationYRef.current = 0;
        onViewModeChange?.('front');
      }
    }
  }, [selectedRegion, onViewModeChange]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 4.3);
    cameraRef.current = camera;

    // 3. WebGL Renderer with ACES Tone Mapping & 60fps GPU optimization
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.userSelect = 'none';
    renderer.domElement.style.webkitUserSelect = 'none';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Clinical Medical Studio Lighting Design (Warm, Sculpted, Soft Organic Illumination)
    const ambientLight = new THREE.AmbientLight(0xfffbeb, 0.48);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3.5, 5.0, 4.0);
    scene.add(keyLight);

    const warmFill = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    warmFill.position.set(-3.5, 2.5, 3.5);
    scene.add(warmFill);

    const rimLight = new THREE.DirectionalLight(0xf8fafc, 1.2);
    rimLight.position.set(0, 4.0, -4.5);
    scene.add(rimLight);

    const bottomBounce = new THREE.DirectionalLight(0xfef3c7, 0.30);
    bottomBounce.position.set(0, -3.0, 1.5);
    scene.add(bottomBounce);

    const selectedAreaLight = new THREE.PointLight(0x0d9488, 0, 1.6, 2.0);
    scene.add(selectedAreaLight);
    selectedAreaLightRef.current = selectedAreaLight;

    // 5. Master Human Group (Clean Anatomical Hierarchy)
    const humanGroup = new THREE.Group();
    humanGroupRef.current = humanGroup;
    scene.add(humanGroup);

    // 6. Master Medical Shaders (Solid, Velvet-Smooth Organic Anatomy - ZERO GLASS REFRACTION)
    const boneMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf5eedc), // Warm Natural Osteoid Ivory (Matte Bone)
      roughness: 0.58,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const cartilageMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd1fae5), // Solid Perichondrium Soft Alabaster-Jade (Opaque, Not Glass)
      roughness: 0.45,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const ocularMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf8fafc), // Natural Pure Sclera & Orbits
      roughness: 0.20,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const facialMuscleMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xb55361), // Soft Terracotta Rosewood Muscle
      roughness: 0.50,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const muscleMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xa8283d), // Deep Organic Striated Crimson Muscle
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.FrontSide
    });

    const brainMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf1ece2), // Natural Gyral Ivory
      roughness: 0.48,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const arterialMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdc2626), // Solid Vibrant Arterial Scarlet Red
      roughness: 0.35,
      metalness: 0.02,
      emissive: new THREE.Color(0x991b1b),
      emissiveIntensity: 0.30,
      side: THREE.FrontSide
    });

    const venousMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2563eb), // Solid Royal Azure Blue Venous
      roughness: 0.35,
      metalness: 0.02,
      emissive: new THREE.Color(0x1e40af),
      emissiveIntensity: 0.28,
      side: THREE.FrontSide
    });

    const tendonMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe5e7eb), // Solid Pearlescent Tendon / Ligament (Opaque, Not Glass)
      roughness: 0.46,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const cardiacCoreMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xbe123c), // Solid Cardiac Myocardium
      roughness: 0.42,
      metalness: 0.02,
      emissive: new THREE.Color(0x881337),
      emissiveIntensity: 0.25,
      side: THREE.FrontSide
    });

    // 7. Setup Loaded Full 1,751-Mesh Anatomical Model with Pre-computed Spatial Indexing
    const setupLoadedInternalModel = (model: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetHeight = 2.45;
      const scaleFactor = targetHeight / (size.y || 1);
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      model.position.set(-center.x * scaleFactor, 0.02 - center.y * scaleFactor, -center.z * scaleFactor);
      model.updateMatrixWorld(true);

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const matName = ((Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) || '').toLowerCase();
          const name = child.name.toLowerCase();

          // Explicitly hide and skip any penile / external genital vascular, nerve, or tissue structures
          const isGenitalStructure = /penis|penile|dorsal_vein.*penis|dorsal_artery.*penis|deep_artery.*penis|superficial_dorsal_vein|pudendal|scrotum|testis|testicle|prepuce|glans/i.test(name) || /penis|pudendal|scrotum/i.test(matName);
          if (isGenitalStructure) {
            child.visible = false;
            child.castShadow = false;
            child.receiveShadow = false;
            return;
          }

          // Ensure smooth vertex normals and complete bounding volumes for raycasting on every mesh geometry
          // Critical for Draco-decoded geometry: WASM decoder doesn't pre-compute bounding volumes
          if (child.geometry) {
            child.geometry.computeVertexNormals();
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();
            // Ensure Draco-decoded non-indexed geometry still has proper draw range
            if (!child.geometry.index && child.geometry.attributes.position) {
              child.geometry.setDrawRange(0, child.geometry.attributes.position.count);
            }
          }

          const record = getMeshMetadata(child.name);
          let selectedMat: THREE.Material = boneMaterial;

          const isEyeMesh = /eye|cornea|sclera|orbit|retina|lens|pupil|lacrimal|palpebral/i.test(name) || /eye|sclera|cornea/i.test(matName);
          const isBrainMesh = /brain|cerebr|cerebell|cortex|thalamus|pons|medulla/i.test(name) || /brain/i.test(matName);
          const isFacialMuscle = /frontalis|temporalis|masseter|zygomatic|orbicularis|buccinator|mentalis|nasalis|procerus|pterygoid|capitis|auricular|platysma|mylohyoid|digastric|sternocleidomastoid/i.test(name) ||
            ((record?.regionId === 'Head' || record?.regionId === 'Face & Sinus') && record?.system === 'muscular');
          const isNoseOrCartilage = /cartilage|costal|nasal|alar_cartilage|septal|xiphoid|cricoid|thyroid_cartilage/i.test(name) || /cartilage/i.test(matName) || record?.system === 'cartilage';
          const isLigamentOrTendon = /ligament|tendon|aponeurosis|retinaculum|fascia|membrane|tract/i.test(name) || /ligament|tendon/i.test(matName) || record?.system === 'ligament';
          const isArtery = /artery|aort|arteria|coronary|truncus|branch.*arter/i.test(name) || /artery|aort/i.test(matName) || (record?.system === 'vascular' && !/vein|vena|jugular|cava|sinus/i.test(name));
          const isVein = /vein|vena|jugular|cava|sinus|plexus.*ven/i.test(name) || /vein|sinus/i.test(matName);
          const isHeart = /heart|ventricle|atrium|myocardi/i.test(name) || (record?.system === 'visceral' && /heart/i.test(record?.name || ''));

          if (isEyeMesh) {
            selectedMat = ocularMaterial;
          } else if (isBrainMesh) {
            selectedMat = brainMaterial;
          } else if (isNoseOrCartilage) {
            selectedMat = cartilageMaterial;
          } else if (isFacialMuscle) {
            selectedMat = facialMuscleMaterial;
          } else if (isHeart) {
            selectedMat = cardiacCoreMaterial;
            heartMeshRef.current = child;
          } else if (isArtery) {
            selectedMat = arterialMaterial;
          } else if (isVein) {
            selectedMat = venousMaterial;
          } else if (isLigamentOrTendon) {
            selectedMat = tendonMaterial;
          } else if (record?.system === 'muscular' || /muscle|rectus|oblique|biceps|triceps|deltoid|gluteus|gastrocnemius|pectoral|trapezius|latissimus|adductor|flexor|extensor|soleus|tibialis/i.test(name) || /muscle/i.test(matName)) {
            selectedMat = muscleMaterial;
          } else {
            selectedMat = boneMaterial;
          }

          child.material = selectedMat;

          // Compute model-space center for fast multi-strategy spatial region matching
          const meshBox = new THREE.Box3();
          if (child.geometry && child.geometry.boundingBox) {
            meshBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
          } else {
            meshBox.setFromObject(child);
          }
          const centerWorld = meshBox.getCenter(new THREE.Vector3());
          const centerLocal = humanGroup.worldToLocal(centerWorld.clone());
          const centerCm = localToBodyCm(centerLocal);
          const sizeLocal = meshBox.getSize(new THREE.Vector3());
          const maxDimCm = Math.max(sizeLocal.x, sizeLocal.y, sizeLocal.z) * CM_PER_UNIT;
          const spatialRegionId = classifyBodyPoint(centerCm.h, centerCm.x, centerCm.z < -3.5);

          child.userData = {
            record,
            regionId: record?.regionId,
            spatialRegionId,
            maxDimCm,
            cx: centerLocal.x,
            cy: centerLocal.y,
            cz: centerLocal.z,
            isLeft: centerLocal.x > 0.025,
            isRight: centerLocal.x < -0.025,
            cleanName: name,
            isInternal: true
          };

          meshesRef.current.set(child.name, { mesh: child, origMaterial: selectedMat, record });
        }
      });

      humanGroup.add(model);
      setModelLoaded(true);
      setLoadingProgress(100);
    };

    // 8. Sovereign Zero-Loss High-Fidelity Anatomical Loading Pipeline (1,751 Clean Meshes)
    //    Draco-compressed: 226 MB → 28 MB, pixel-identical (KHR_draco_mesh_compression)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoader.preload();
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    // Helper: IndexedDB Persistent 3D Cache for instant sub-100ms subsequent loads
    // IMPORTANT: Bump version whenever the model loading/validation logic changes
    // to invalidate potentially corrupt cached buffers. v4 = endianness fix (getUint32 LE).
    const IDB_NAME = 'medikiosk_3d_cache_v4';
    const IDB_STORE = 'models';
    const IDB_KEY = 'medikiosk_3d_mannequin';

    const loadFromIndexedDB = (): Promise<ArrayBuffer | null> => {
      return new Promise((resolve) => {
        try {
          if (!window.indexedDB) return resolve(null);
          const request = indexedDB.open(IDB_NAME, 1);
          request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
              db.createObjectStore(IDB_STORE);
            }
          };
          request.onsuccess = (e: any) => {
            const db = e.target.result;
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const getReq = store.get(IDB_KEY);
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => resolve(null);
          };
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    };

    const saveToIndexedDB = (buffer: ArrayBuffer) => {
      try {
        if (!window.indexedDB) return;
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          store.put(buffer, IDB_KEY);
        };
      } catch {}
    };

    const parseAndMount = (buffer: ArrayBuffer | Uint8Array, onError?: () => void) => {
      try {
        const arrayBuffer = buffer instanceof Uint8Array
          ? (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
          : buffer;
        gltfLoader.parse(
          arrayBuffer as ArrayBuffer,
          '',
          (gltf) => {
            setupLoadedInternalModel(gltf.scene);
          },
          (err) => {
            console.warn('[3D Loader] GLTF buffer parse error, cascading:', err);
            if (onError) onError();
            else mountProceduralMannequinFallback();
          }
        );
      } catch (err) {
        console.warn('[3D Loader] Buffer parse exception, cascading:', err);
        if (onError) onError();
        else mountProceduralMannequinFallback();
      }
    };

    const mountProceduralMannequinFallback = () => {
      try {
        const procGroup = new THREE.Group();
        procGroup.name = 'ProceduralSovereignMannequin';

        const defaultMat = boneMaterial;

        const parts: Array<{ name: string; regionId: string; geo: THREE.BufferGeometry; pos: [number, number, number]; scale?: [number, number, number] }> = [
          { name: 'Head', regionId: 'Head', geo: new THREE.SphereGeometry(0.18, 20, 20), pos: [0, 1.82, 0], scale: [1, 1.15, 1] },
          { name: 'Face & Sinus', regionId: 'Face & Sinus', geo: new THREE.BoxGeometry(0.14, 0.12, 0.08), pos: [0, 1.80, 0.10] },
          { name: 'Throat & Neck', regionId: 'Throat & Neck', geo: new THREE.CylinderGeometry(0.065, 0.08, 0.12, 16), pos: [0, 1.63, 0] },
          { name: 'Chest', regionId: 'Chest', geo: new THREE.BoxGeometry(0.38, 0.32, 0.20), pos: [0, 1.40, 0] },
          { name: 'Abdomen', regionId: 'Abdomen', geo: new THREE.CylinderGeometry(0.16, 0.17, 0.26, 16), pos: [0, 1.10, 0] },
          { name: 'Pelvis', regionId: 'Pelvis', geo: new THREE.CylinderGeometry(0.18, 0.16, 0.18, 16), pos: [0, 0.88, 0] },
          { name: 'Upper Spine', regionId: 'Upper Spine', geo: new THREE.CylinderGeometry(0.04, 0.04, 0.30, 12), pos: [0, 1.40, -0.09] },
          { name: 'Lumbar Spine', regionId: 'Lumbar Spine', geo: new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), pos: [0, 1.10, -0.08] },
          { name: 'Right Shoulder', regionId: 'Right Shoulder', geo: new THREE.SphereGeometry(0.075, 14, 14), pos: [-0.25, 1.50, 0] },
          { name: 'Right Arm', regionId: 'Right Arm', geo: new THREE.CylinderGeometry(0.05, 0.045, 0.26, 12), pos: [-0.27, 1.30, 0] },
          { name: 'Right Forearm', regionId: 'Right Forearm', geo: new THREE.CylinderGeometry(0.042, 0.035, 0.24, 12), pos: [-0.29, 0.98, 0] },
          { name: 'Right Hand', regionId: 'Right Hand', geo: new THREE.BoxGeometry(0.06, 0.10, 0.03), pos: [-0.30, 0.78, 0] },
          { name: 'Left Shoulder', regionId: 'Left Shoulder', geo: new THREE.SphereGeometry(0.075, 14, 14), pos: [0.25, 1.50, 0] },
          { name: 'Left Arm', regionId: 'Left Arm', geo: new THREE.CylinderGeometry(0.05, 0.045, 0.26, 12), pos: [0.27, 1.30, 0] },
          { name: 'Left Forearm', regionId: 'Left Forearm', geo: new THREE.CylinderGeometry(0.042, 0.035, 0.24, 12), pos: [0.29, 0.98, 0] },
          { name: 'Left Hand', regionId: 'Left Hand', geo: new THREE.BoxGeometry(0.06, 0.10, 0.03), pos: [0.30, 0.78, 0] },
          { name: 'Right Thigh', regionId: 'Right Thigh', geo: new THREE.CylinderGeometry(0.075, 0.06, 0.38, 16), pos: [-0.11, 0.58, 0] },
          { name: 'Right Knee', regionId: 'Right Knee', geo: new THREE.SphereGeometry(0.055, 12, 12), pos: [-0.11, 0.36, 0.01] },
          { name: 'Right Leg', regionId: 'Right Leg', geo: new THREE.CylinderGeometry(0.055, 0.04, 0.36, 16), pos: [-0.11, 0.15, 0] },
          { name: 'Right Foot', regionId: 'Right Foot', geo: new THREE.BoxGeometry(0.08, 0.05, 0.16), pos: [-0.11, -0.06, 0.04] },
          { name: 'Left Thigh', regionId: 'Left Thigh', geo: new THREE.CylinderGeometry(0.075, 0.06, 0.38, 16), pos: [0.11, 0.58, 0] },
          { name: 'Left Knee', regionId: 'Left Knee', geo: new THREE.SphereGeometry(0.055, 12, 12), pos: [0.11, 0.36, 0.01] },
          { name: 'Left Leg', regionId: 'Left Leg', geo: new THREE.CylinderGeometry(0.055, 0.04, 0.36, 16), pos: [0.11, 0.15, 0] },
          { name: 'Left Foot', regionId: 'Left Foot', geo: new THREE.BoxGeometry(0.08, 0.05, 0.16), pos: [0.11, -0.06, 0.04] },
        ];

        parts.forEach(p => {
          const mesh = new THREE.Mesh(p.geo, defaultMat.clone());
          mesh.name = p.name;
          mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
          if (p.scale) mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          p.geo.computeVertexNormals();
          p.geo.computeBoundingBox();
          p.geo.computeBoundingSphere();
          procGroup.add(mesh);
        });

        setupLoadedInternalModel(procGroup);
      } catch (e) {
        console.warn('Procedural mannequin initialization error:', e);
      } finally {
        setModelLoaded(true);
        setLoadingProgress(100);
      }
    };

    /**
     * Inspect network response to avoid corrupting parser on SPA HTML 200 catch-alls
     */
    const fetchValidModelBuffer = async (url: string): Promise<ArrayBuffer | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || '';
        // If server returned HTML (SPA fallback), reject immediately
        if (contentType.includes('text/html')) {
          console.warn(`[3D Loader] Detected SPA HTML redirect for ${url}, skipping.`);
          return null;
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 1000) return null;
        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        // Binary GLTF magic: 0x46546C67 ('glTF')
        if (magic !== 0x46546C67) {
          const firstChar = String.fromCharCode(view.getUint8(0)).trim();
          if (firstChar !== '{') {
            console.warn(`[3D Loader] Invalid GLTF header for ${url}, skipping.`);
            return null;
          }
        }
        return buffer;
      } catch (e) {
        console.warn(`[3D Loader] Network fetch error for ${url}:`, e);
        return null;
      }
    };

    const loadWithCascade = async () => {
      try {
        // Step 1: Check IndexedDB Cache
        const cached = await loadFromIndexedDB();
        if (cached && cached.byteLength > 1000000) {
          const view = new DataView(cached);
          if (view.getUint32(0, true) === 0x46546C67) {
            parseAndMount(cached, async () => {
              // Cache was corrupt/stale — cascade to network loading
              console.warn('[3D Loader] Cached model parse failed, cascading to network fetch.');
              setLoadingProgress(30);
              const dracoBuf = await fetchValidModelBuffer('/models/3d_mannequin_draco.glb');
              if (dracoBuf) {
                saveToIndexedDB(dracoBuf);
                setLoadingProgress(80);
                parseAndMount(dracoBuf, () => {
                  fetchValidModelBuffer('/models/human_body.glb').then((lightBuf) => {
                    if (lightBuf) parseAndMount(lightBuf);
                    else mountProceduralMannequinFallback();
                  });
                });
              } else {
                const lightBuf = await fetchValidModelBuffer('/models/human_body.glb');
                if (lightBuf) parseAndMount(lightBuf);
                else mountProceduralMannequinFallback();
              }
            });
            return;
          }
        }

        // Step 2: Try High-Fidelity Draco-compressed model (/models/3d_mannequin_draco.glb)
        setLoadingProgress(30);
        const dracoBuf = await fetchValidModelBuffer('/models/3d_mannequin_draco.glb');
        if (dracoBuf) {
          saveToIndexedDB(dracoBuf);
          setLoadingProgress(80);
          parseAndMount(dracoBuf, () => {
            // If Draco parsing failed, cascade to lightweight
            fetchValidModelBuffer('/models/human_body.glb').then((lightBuf) => {
              if (lightBuf) parseAndMount(lightBuf);
              else mountProceduralMannequinFallback();
            });
          });
          return;
        }

        // Step 3: Try Lightweight Model (/models/human_body.glb)
        setLoadingProgress(60);
        const lightBuf = await fetchValidModelBuffer('/models/human_body.glb');
        if (lightBuf) {
          setLoadingProgress(90);
          parseAndMount(lightBuf);
          return;
        }

        // Step 4: Instant Procedural Fail-Safe (Zero network, 100% dependable)
        console.info('[3D Loader] Mounting instantaneous procedural sovereign mannequin.');
        mountProceduralMannequinFallback();
      } catch (err) {
        console.warn('[3D Loader] Cascading loader caught error:', err);
        mountProceduralMannequinFallback();
      }
    };

    // Main loader entrypoint: IndexedDB Cache -> Draco CDN -> Lightweight Body -> Procedural Fail-safe
    loadWithCascade();



    // Depth-Aware Picking Helper (Clean surface-first picking, with visceral priority only when visceral layer active)
    const getTargetHit = (intersects: THREE.Intersection[]) => {
      const visibleIntersects = intersects.filter(h => h.object.visible);
      if (visibleIntersects.length === 0) return null;

      if (activeSystemLayer === 'visceral') {
        const viscHit = visibleIntersects.find(h => {
          const rec = (h.object as any).userData?.record as AnatomicalMeshRecord | undefined;
          return rec && (rec.system === 'visceral' || /heart|stomach|liver|kidney|bladder|lung|aort/i.test(rec.name));
        });
        if (viscHit) return viscHit;
      } else if (activeSystemLayer === 'vascular') {
        const vascHit = visibleIntersects.find(h => {
          const rec = (h.object as any).userData?.record as AnatomicalMeshRecord | undefined;
          return rec && (rec.system === 'vascular' || /artery|vein|cava|aort/i.test(rec.name));
        });
        if (vascHit) return vascHit;
      } else if (activeSystemLayer === 'skeletal') {
        const boneHit = visibleIntersects.find(h => {
          const rec = (h.object as any).userData?.record as AnatomicalMeshRecord | undefined;
          return rec && (rec.system === 'skeletal' || /bone|vertebra|rib|skull|patell/i.test(rec.name));
        });
        if (boneHit) return boneHit;
      }

      return visibleIntersects[0];
    };

    // 9. Precision Pointer Interactions with Instant NDC Calculation
    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      pointerDownPositionRef.current = { x: e.clientX, y: e.clientY };
      previousPointerPositionRef.current = { x: e.clientX, y: e.clientY };

      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousPointerPositionRef.current.x;
        const deltaY = e.clientY - previousPointerPositionRef.current.y;
        targetRotationYRef.current += deltaX * 0.008;
        targetRotationXRef.current = Math.max(-0.6, Math.min(0.6, targetRotationXRef.current + deltaY * 0.005));
        previousPointerPositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const dist = Math.hypot(e.clientX - pointerDownPositionRef.current.x, e.clientY - pointerDownPositionRef.current.y);
      isDraggingRef.current = false;

      // Relaxed tap threshold (18px) to reliably capture trackpad taps and touchscreen fingers
      if (dist < 18) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(humanGroup.children, true);
        const topHit = getTargetHit(intersects);

        let hitRegion: string | null = null;

        if (topHit) {
          // Mesh-first high-precision region resolution (uses 1,744-mesh database identity)
          hitRegion = resolveRegionFromHit(topHit, intersects, humanGroup);
        } else {
          // Robust Silhouette Fallback: Intersect coronal plane (Z = 0) in model space for edge touches
          const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
          const ray = raycasterRef.current.ray.clone();
          const invMatrix = humanGroup.matrixWorld.clone().invert();
          ray.applyMatrix4(invMatrix);
          const hit = new THREE.Vector3();
          if (ray.intersectPlane(plane, hit)) {
            if (hit.y >= -1.25 && hit.y <= 1.30 && Math.abs(hit.x) <= 0.70) {
              hitRegion = classifyHitToRegion(hit);
            }
          }
        }

        if (hitRegion) {
          const isAlreadySelected = selectedRegionRef.current === hitRegion;

          if (isAlreadySelected) {
            // Toggle OFF: same region tapped again → reset to full body view
            if (onMacroZoneChangeRef.current) onMacroZoneChangeRef.current('full');
            else setInternalMacroZone('full');
            try { sovereignSound.playMechanicalSnap(); } catch {}
            // Signal parent to deselect — pass the same region so parent can toggle
            onSelectRegionRef.current(hitRegion);
          } else {
            // Select new region and zoom into its macro zone
            const targetZone = LOCUS_TO_MACRO_ZONE[hitRegion] || 'full';
            if (targetZone !== 'full') {
              if (onMacroZoneChangeRef.current) onMacroZoneChangeRef.current(targetZone);
              else setInternalMacroZone(targetZone);
            }
            try { sovereignSound.playMechanicalSnap(); } catch {}
            onSelectRegionRef.current(hitRegion);
          }
        }
      }
    };

    const handlePointerCancel = () => {
      isDraggingRef.current = false;
    };

    const handlePointerLeave = () => {
      mouseRef.current.set(-999, -999);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domEl.addEventListener('pointercancel', handlePointerCancel);
    domEl.addEventListener('pointerleave', handlePointerLeave);

    // 10. Render Loop with Smooth Camera Transitions & Anatomical Pulsing
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = (performance.now() - startTime) / 1000;

      // Smooth Camera Interpolation
      camera.position.lerp(targetCameraPosRef.current, 0.24);
      currentCameraLookAtRef.current.lerp(targetCameraLookAtRef.current, 0.24);
      camera.lookAt(currentCameraLookAtRef.current);

      // Smooth Model Rotation
      if (isAutoRotatingRef.current) {
        targetRotationYRef.current += 0.003;
      }
      currentRotationYRef.current += (targetRotationYRef.current - currentRotationYRef.current) * 0.22;
      currentRotationXRef.current += (targetRotationXRef.current - currentRotationXRef.current) * 0.22;
      humanGroup.rotation.y = currentRotationYRef.current;
      humanGroup.rotation.x = currentRotationXRef.current;

      // Raycast Hover Inspection (Deduplicated to eliminate 60fps React re-render thrashing)
      if (!isDraggingRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(humanGroup.children, true);
        const topHit = getTargetHit(intersects);

        if (topHit) {
          // Mesh-first region identification for hover tooltip precision
          const hoverRegion = resolveRegionFromHit(topHit, intersects, humanGroup);

          if (hoverRegion !== lastHoveredRegionIdRef.current) {
            lastHoveredRegionIdRef.current = hoverRegion;
            setHoveredRegion(hoverRegion);
          }
        } else if (lastHoveredRegionIdRef.current !== null) {
          lastHoveredRegionIdRef.current = null;
          setHoveredRegion(null);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('pointercancel', handlePointerCancel);
      domEl.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      dracoLoader.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleZoom = (direction: 'in' | 'out') => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    const cam = targetCameraPosRef.current;
    const look = targetCameraLookAtRef.current;
    const dir = new THREE.Vector3().subVectors(cam, look);
    const currentDist = dir.length();
    const step = 0.40;
    const newDist = direction === 'in' 
      ? Math.max(1.1, currentDist - step) 
      : Math.min(5.5, currentDist + step);
    dir.setLength(newDist);
    targetCameraPosRef.current.copy(look).add(dir);
  };

  const handleResetCamera = () => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    if (activeMacroZone && activeMacroZone !== 'full' && MACRO_ZONE_DATA[activeMacroZone]) {
      const zData = MACRO_ZONE_DATA[activeMacroZone];
      targetCameraPosRef.current.set(...zData.cameraPos);
      targetCameraLookAtRef.current.set(...zData.lookAt);
      if (cameraRef.current && zData.fov) {
        cameraRef.current.fov = zData.fov;
        cameraRef.current.updateProjectionMatrix();
      }
      if (typeof zData.defaultYaw === 'number') {
        targetRotationYRef.current = zData.defaultYaw;
      }
    } else {
      targetCameraPosRef.current.set(0, 0.05, 4.3);
      targetCameraLookAtRef.current.set(0, 0.05, 0);
      targetRotationYRef.current = 0;
      targetRotationXRef.current = 0;
      if (cameraRef.current) {
        cameraRef.current.fov = 38;
        cameraRef.current.updateProjectionMatrix();
      }
    }
  };

  const currentMacroData = MACRO_ZONE_DATA[activeMacroZone] || MACRO_ZONE_DATA.full;
  const isZoomedIn = activeMacroZone !== 'full';

  // Granular micro-loci for currently active macro zone
  const activeZoneLoci = MICRO_LOCI_CATALOG.filter(
    m => activeMacroZone === 'full' ? true : m.macroZone === activeMacroZone
  );

  const hasCustomHeight = className && (className.includes('h-') || className.includes('h-['));
  const heightClass = hasCustomHeight ? '' : 'h-[380px] sm:h-[460px] md:h-[520px]';

  return (
    <div className={`relative w-full ${heightClass} ${className?.includes('rounded') ? '' : 'rounded-3xl'} bg-gradient-to-b from-slate-100/70 via-background to-slate-100/50 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-slate-950 ${className?.includes('border') ? '' : 'border border-border/80'} overflow-hidden shadow-sm select-none ${className || ''}`}>
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

      {/* Subtle Diagnostic Drafting Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none hairline-grid opacity-15" />

      {/* Top HUD: Clean Hospital Console Breadcrumb & Orientation Header */}
      {!hideHeaderControls && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20 pointer-events-auto">
          {/* Left: Active Zone Status / Breadcrumb */}
          <div className="flex items-center gap-2">
            {isZoomedIn ? (
              <button
                type="button"
                onClick={() => {
                  try { sovereignSound.playMechanicalSnap(); } catch {}
                  if (onMacroZoneChange) onMacroZoneChange('full');
                  else setInternalMacroZone('full');
                }}
                className="tactile-btn px-3 py-1.5 text-xs font-semibold rounded-xl bg-card/90 dark:bg-card/90 text-foreground border border-border/80 shadow-xs flex items-center gap-1.5 cursor-pointer hover:bg-muted"
              >
                <CornerUpLeft size={13} className="text-muted-foreground" />
                <span>{tx('zoneFull')}</span>
              </button>
            ) : null}

          </div>
        </div>
      )}

      {/* Hover hint: which region a tap here would select */}
      {hoveredRegion && (
        <div className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-xl bg-card/95 backdrop-blur-md border border-border/80 shadow-md pointer-events-none text-xs sm:text-sm font-heading font-bold text-foreground">
          {regionName(hoveredRegion, language)}
        </div>
      )}

      {/* Camera Angle Controls (Front / Back) */}
      {showAngleControls && (
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 z-20 pointer-events-auto">
          <div className="flex items-center gap-1 p-1 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-sm">
            <button
              type="button"
              onClick={() => applyAnglePreset(0, 0)}
              className={`px-3.5 py-1.5 text-xs font-heading font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'front' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tx('bodyFront')}
            </button>
            <button
              type="button"
              onClick={() => applyAnglePreset(Math.PI, 0)}
              className={`px-3.5 py-1.5 text-xs font-heading font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'back' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tx('bodyBack')}
            </button>
          </div>
        </div>
      )}

      {/* Zoom & Reset Controls (Bottom-Right) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-20 pointer-events-auto">
        <div className="flex items-center gap-0.5 p-1 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-sm">
          <button
            type="button"
            onClick={() => handleZoom('in')}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all cursor-pointer"
            title="Reset View"
          >
            <CornerUpLeft size={14} />
          </button>
        </div>
      </div>

      {/* Hospital-Grade Anatomical Loading Indicator */}
      {!modelLoaded && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-40">
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-xs">
              <Activity size={18} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div className="text-center">
              <div className="text-xs font-heading font-bold text-foreground">
                {tx('bodyLoading')}
              </div>
              <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">{loadingProgress}%</div>
            </div>
          </div>
          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden border border-border/60">
            <div
              className="h-full bg-sky-500 transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
