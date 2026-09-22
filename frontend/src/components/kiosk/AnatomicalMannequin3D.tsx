import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sovereignSound } from '../../utils/audio';
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
  CAMERA_REGION_PRESETS,
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
    centroid: [0, 1.05, 0.04],
    cameraPos: [0, 1.05, 1.6],
    lookAt: [0, 1.05, 0.04],
    fov: 32,
    defaultYaw: 0
  },
  'chest': {
    id: 'chest',
    label: 'Chest & Lungs',
    hindiLabel: 'सीना व हृदय',
    enLabel: 'Thorax & Lungs',
    centroid: [0, 0.55, 0.04],
    cameraPos: [0, 0.55, 1.8],
    lookAt: [0, 0.55, 0.04],
    fov: 34,
    defaultYaw: 0
  },
  'abdomen': {
    id: 'abdomen',
    label: 'Abdomen & Pelvis',
    hindiLabel: 'पेट व पेडू',
    enLabel: 'Abdomen & Viscera',
    centroid: [0, 0.05, 0.04],
    cameraPos: [0, 0.05, 1.9],
    lookAt: [0, 0.05, 0.04],
    fov: 34,
    defaultYaw: 0
  },
  'spine': {
    id: 'spine',
    label: 'Spine & Back',
    hindiLabel: 'रीढ़ व पीठ',
    enLabel: 'Spine & Back',
    centroid: [0, 0.20, -0.06],
    cameraPos: [0, 0.20, -2.4],
    lookAt: [0, 0.20, -0.06],
    fov: 34,
    defaultYaw: Math.PI
  },
  'arms': {
    id: 'arms',
    label: 'Arms & Hands',
    hindiLabel: 'हाथ व बांह',
    enLabel: 'Arms & Hands',
    centroid: [0, 0.35, 0.04],
    cameraPos: [0, 0.35, 2.3],
    lookAt: [0, 0.35, 0.04],
    fov: 36,
    defaultYaw: 0
  },
  'legs': {
    id: 'legs',
    label: 'Legs & Feet',
    hindiLabel: 'पैर व जोड़',
    enLabel: 'Legs & Feet',
    centroid: [0, -0.70, 0.04],
    cameraPos: [0, -0.70, 2.2],
    lookAt: [0, -0.70, 0.04],
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
  'Sciatic Pathway / Calves': 'spine',

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

// Canonical Vitruvian Raycasting Spatial Classifier (Normalized model coordinates)
export const classifyHitToRegion = (localHit: THREE.Vector3 | { x: number; y: number; z: number }): string => {
  const x = localHit.x;
  const y = localHit.y;
  const z = localHit.z;

  // Canonical Normalized Height: [0.0 = Feet Soles (-1.205), 1.0 = Crown Vertex (+1.245)]
  const yNorm = Math.max(0, Math.min(1, (y + 1.205) / 2.450));
  
  // Depth / Anterior-Posterior Determination
  const isPosterior = z < -0.035;
  
  // Lateral Symmetry (+X is Patient Left, -X is Patient Right)
  const isLeft = x > 0.025;
  const isRight = x < -0.025;
  const absX = Math.abs(x);

  // Anatomical Spatial Classification
  if (yNorm > 0.93) {
    // Cranial / Forehead / Vertex / Occiput
    if (isPosterior) return 'Head';
    if (absX > 0.14) return 'Ear';
    return 'Head';
  }
  
  if (yNorm > 0.86) {
    // Facial Profile / Sinuses / Eyes / Ears / Nape
    if (isPosterior) return 'Cervical Spine';
    if (absX > 0.13) return 'Ear';
    return 'Face & Sinus';
  }
  
  if (yNorm > 0.78) {
    // Cervical Neck / Larynx / Cervical Spine
    if (isPosterior) return 'Cervical Spine';
    return 'Neck';
  }
  
  if (yNorm > 0.63) {
    // Thoracic / Chest / Shoulders / Scapular Upper Back
    if (absX > 0.28) {
      return isLeft ? 'Left Shoulder' : 'Right Shoulder';
    }
    if (isPosterior) {
      return 'Upper Back / Thoracic';
    }
    return isLeft ? 'Left Chest / Precordium' : 'Right Chest';
  }
  
  if (yNorm > 0.54) {
    // Epigastrium / Upper Abdomen / Arms / Mid-Back
    if (absX > 0.30) {
      return isLeft ? 'Left Arm' : 'Right Arm';
    }
    if (isPosterior) {
      return 'Upper Back / Thoracic';
    }
    return 'Epigastrium';
  }
  
  if (yNorm > 0.45) {
    // Umbilicus / Mid-Abdomen / Lumbar Spine (Kati) / Forearms
    if (absX > 0.32) {
      return isLeft ? 'Left Arm' : 'Right Arm';
    }
    if (isPosterior) {
      return 'Lumbar Spine (Kati)';
    }
    return 'Umbilicus / Mid-Abdomen';
  }
  
  if (yNorm > 0.37) {
    // Lower Abdomen / Pelvis / RLQ / LLQ / Sacrum / Hands / Hips
    if (absX > 0.34) {
      return isLeft ? 'Left Hand' : 'Right Hand';
    }
    if (isPosterior) {
      return 'Sacral / Sciatica Origin';
    }
    if (absX > 0.16) {
      return isLeft ? 'Left Hip' : 'Right Hip';
    }
    if (absX > 0.04) {
      return isLeft ? 'Left Lower Quadrant (LLQ)' : 'Right Lower Quadrant (RLQ)';
    }
    return 'Pelvic / Hypogastrium';
  }
  
  if (yNorm > 0.30) {
    // Hips / Pelvic Articulation
    if (isPosterior) {
      return 'Sacral / Sciatica Origin';
    }
    if (absX > 0.10) {
      return isLeft ? 'Left Hip' : 'Right Hip';
    }
    return 'Pelvic / Hypogastrium';
  }
  
  if (yNorm > 0.23) {
    // Thighs / Femoral Segment
    return isLeft ? 'Left Leg' : 'Right Leg';
  }
  
  if (yNorm > 0.17) {
    // Knees / Patellar Joint
    return isLeft ? 'Left Knee' : 'Right Knee';
  }
  
  if (yNorm > 0.05) {
    // Calves / Shins / Sciatic Pathway
    if (isPosterior) {
      return 'Sciatic Pathway / Calves';
    }
    return isLeft ? 'Left Leg' : 'Right Leg';
  }
  
  // Feet & Ankles
  return isLeft ? 'Left Foot' : 'Right Foot';
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
  isFocusMode = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [internalSystemLayer, setInternalSystemLayer] = useState<AnatomicalSystemLayer>('all');
  const [hoveredMeshInfo, setHoveredMeshInfo] = useState<AnatomicalMeshRecord | null>(null);
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
      emissiveIntensity: colorDef.emissiveIntensity,
      roughness: 0.28,
      metalness: 0.08,
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
    // 1. If explicit selectedRegion has a defined camera preset and not in full body overview
    if (activeMacroZone !== 'full' && selectedRegion && CAMERA_REGION_PRESETS[selectedRegion]) {
      const preset = CAMERA_REGION_PRESETS[selectedRegion];
      targetCameraPosRef.current.set(...preset.pos);
      targetCameraLookAtRef.current.set(...preset.lookAt);
      if (cameraRef.current) {
        cameraRef.current.fov = preset.fov;
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
      targetCameraPosRef.current.set(0, 0.15, 4.3);
      targetCameraLookAtRef.current.set(0, 0.15, 0);
      if (cameraRef.current) {
        cameraRef.current.fov = 40;
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

    // Highlight matching meshes directly on the 3D model using Multi-Strategy Matcher
    const activeHighlightMaterial = selectedRegion ? getRegionHighlightMaterial(selectedRegion) : null;

    meshesRef.current.forEach(({ mesh, origMaterial, record }) => {
      const isSelected = selectedRegion && activeHighlightMaterial
        ? isMeshMatchingSelectedRegion(mesh.name, record, mesh.userData, selectedRegion)
        : false;

      if (isSelected && activeHighlightMaterial) {
        mesh.material = activeHighlightMaterial;
      } else {
        mesh.material = origMaterial;
      }
    });

  }, [selectedRegion, activeMacroZone, getRegionHighlightMaterial]);

  // Handle Layer Shading, Ghosting (Solid Matte Context - ZERO GLASS EFFECT)
  useEffect(() => {
    const activeHighlightMaterial = selectedRegion ? getRegionHighlightMaterial(selectedRegion) : null;

    meshesRef.current.forEach(({ mesh, origMaterial, record }) => {
      const isSelected = selectedRegion && activeHighlightMaterial
        ? isMeshMatchingSelectedRegion(mesh.name, record, mesh.userData, selectedRegion)
        : false;

      if (isSelected && activeHighlightMaterial) {
        mesh.material = activeHighlightMaterial;
        mesh.visible = true;
        return;
      }

      if (activeSystemLayer === 'all') {
        mesh.material = origMaterial;
        mesh.visible = true;
      } else if (activeSystemLayer === 'muscular') {
        const isTarget = record?.system === 'muscular' || record?.system === 'ligament' || /muscle|deltoid|biceps|gluteus|gastrocnemius|rectus|oblique|trapezius|latissimus|pectoral/i.test(mesh.name);
        mesh.material = isTarget ? origMaterial : ghostMaterialRef.current;
        mesh.visible = true;
      } else if (activeSystemLayer === 'skeletal') {
        const isTarget = record?.system === 'skeletal' || record?.system === 'cartilage' || /bone|vertebra|rib|skull|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|pelvis|patell/i.test(mesh.name);
        mesh.material = isTarget ? origMaterial : ghostMaterialRef.current;
        mesh.visible = true;
      } else if (activeSystemLayer === 'vascular') {
        const isTarget = record?.system === 'vascular' || /artery|vein|cava|aort|carotid|jugular|sinus/i.test(mesh.name);
        mesh.material = isTarget ? origMaterial : ghostMaterialRef.current;
        mesh.visible = true;
      } else if (activeSystemLayer === 'visceral') {
        const isTarget = record?.system === 'visceral' || /heart|stomach|liver|kidney|bladder|lung|aort|cava|splen|ren|gastric|pancrea|duoden|ileum|colon/i.test(mesh.name);
        mesh.material = isTarget ? origMaterial : ghostMaterialRef.current;
        mesh.visible = true;
      }
    });
  }, [activeSystemLayer, selectedRegion, getRegionHighlightMaterial]);

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

          // Ensure smooth vertex normals on every mesh geometry
          if (child.geometry) {
            child.geometry.computeVertexNormals();
            child.geometry.computeBoundingBox();
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
          const spatialRegionId = classifyHitToRegion(centerLocal);

          child.userData = {
            record,
            regionId: record?.regionId,
            spatialRegionId,
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

    // 8. Instant-Load High-Fidelity Anatomical Pipeline (1.7MB Fast Mesh + Zero-Freeze Progressive Fallbacks)
    const gltfLoader = new GLTFLoader();

    const handleProgress = (xhr: ProgressEvent) => {
      if (xhr.total > 0) {
        setLoadingProgress(Math.min(99, Math.round((xhr.loaded / xhr.total) * 100)));
      } else if (xhr.loaded > 0) {
        // Estimate progress for chunked HTTP/2 transfer encoding
        const estTotal = 1.8 * 1024 * 1024;
        setLoadingProgress(Math.min(95, Math.round((xhr.loaded / estTotal) * 100)));
      }
    };

    gltfLoader.load(
      '/models/human_body.glb',
      (gltf) => {
        setupLoadedInternalModel(gltf.scene);
      },
      handleProgress,
      (err) => {
        console.warn('1.7MB GLB failed, trying instant 75MB fallback:', err);
        gltfLoader.load(
          '/models/3d_mannequin_instant.glb',
          (gltfInstant) => {
            setupLoadedInternalModel(gltfInstant.scene);
          },
          handleProgress,
          (errInstant) => {
            console.warn('Instant GLB failed, trying fast 226MB fallback:', errInstant);
            gltfLoader.load(
              '/models/3d_mannequin_fast.glb',
              (gltfFast) => {
                setupLoadedInternalModel(gltfFast.scene);
              },
              handleProgress,
              (errOpt) => {
                console.error('All GLB anatomical loads failed:', errOpt);
              }
            );
          }
        );
      }
    );

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

      if (dist < 12) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(humanGroup.children, true);
        const topHit = getTargetHit(intersects);

        let localHit: THREE.Vector3 | null = null;
        if (topHit) {
          localHit = humanGroup.worldToLocal(topHit.point.clone());
        } else {
          // Robust Silhouette Fallback: Intersect coronal plane (Z = 0) in model space for edge touches
          const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
          const ray = raycasterRef.current.ray.clone();
          const invMatrix = humanGroup.matrixWorld.clone().invert();
          ray.applyMatrix4(invMatrix);
          const hit = new THREE.Vector3();
          if (ray.intersectPlane(plane, hit)) {
            if (hit.y >= -1.25 && hit.y <= 1.30 && Math.abs(hit.x) <= 0.70) {
              localHit = hit;
            }
          }
        }

        if (localHit) {
          const hitRegion = classifyHitToRegion(localHit);

          // 1. Toggle Off / Full Body Reset if clicking the SAME part that is already selected
          if (selectedRegionRef.current === hitRegion) {
            try { sovereignSound.playMechanicalSnap(); } catch {}
            if (onMacroZoneChangeRef.current) {
              onMacroZoneChangeRef.current('full');
            } else {
              setInternalMacroZone('full');
            }
            targetCameraPosRef.current.set(0, 0.15, 4.3);
            targetCameraLookAtRef.current.set(0, 0.15, 0);
            if (cameraRef.current) {
              cameraRef.current.fov = 40;
              cameraRef.current.updateProjectionMatrix();
            }
            onSelectRegionRef.current('');
            return;
          }

          // 2. Select new part & drill-down into macro zone
          const targetZone = LOCUS_TO_MACRO_ZONE[hitRegion] || 'full';
          if (targetZone !== 'full') {
            if (onMacroZoneChangeRef.current) onMacroZoneChangeRef.current(targetZone);
            else setInternalMacroZone(targetZone);
          }

          try { sovereignSound.playMechanicalSnap(); } catch {}
          onSelectRegionRef.current(hitRegion);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // 10. Render Loop with Smooth Camera Transitions & Anatomical Pulsing
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

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
          const localHit = humanGroup.worldToLocal(topHit.point.clone());
          const hoverRegion = classifyHitToRegion(localHit);

          if (hoverRegion !== lastHoveredRegionIdRef.current) {
            lastHoveredRegionIdRef.current = hoverRegion;
            const matchedLocus = MICRO_LOCI_CATALOG.find(l => l.id === hoverRegion);

            setHoveredMeshInfo({
              name: topHit.object.name || hoverRegion,
              regionId: hoverRegion,
              hindiName: matchedLocus ? matchedLocus.hindiLabel : hoverRegion,
              system: 'muscular',
              marma: matchedLocus?.ayushMarma || '',
              isLeft: localHit.x > 0.025,
              isRight: localHit.x < -0.025,
              center: [localHit.x, localHit.y, localHit.z],
              size: [0.1, 0.1, 0.1],
              vertexCount: 0
            });
          }
        } else if (lastHoveredRegionIdRef.current !== null) {
          lastHoveredRegionIdRef.current = null;
          setHoveredMeshInfo(null);
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
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
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
                <span>Full Body (संपूर्ण शरीर)</span>
              </button>
            ) : null}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 text-xs font-semibold text-foreground shadow-xs">
              <span>{currentMacroData.hindiLabel}</span>
              <span className="text-[10.5px] text-muted-foreground font-mono hidden sm:inline">({currentMacroData.enLabel})</span>
            </div>
          </div>

          {/* Right: Hospital Lateral Clarifier */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 text-xs font-mono text-foreground shadow-xs">
            <span className="text-muted-foreground font-medium">Right (दायां)</span>
            <span className="text-border">|</span>
            <span className="font-semibold text-foreground">Left / Heart (बायां)</span>
          </div>
        </div>
      )}

      {/* Floating 3D Hover Inspection Tooltip HUD */}
      {hoveredMeshInfo && (
        <div className="absolute top-4 right-4 z-30 max-w-xs p-3 rounded-2xl bg-card/95 dark:bg-card/95 backdrop-blur-md border border-border/90 shadow-xl pointer-events-none transition-all text-card-foreground">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
              <Target size={12} />
              <span>{hoveredMeshInfo.system} System</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold bg-muted text-foreground border border-border/70">
              {hoveredMeshInfo.isRight ? 'Right (दायां)' : hoveredMeshInfo.isLeft ? 'Left (बायां)' : 'Midline (मध्य)'}
            </span>
          </div>
          <div className="text-foreground text-xs font-heading font-bold mt-1">{hoveredMeshInfo.hindiName}</div>
          <div className="text-muted-foreground text-[10px] font-mono">{hoveredMeshInfo.regionId}</div>
          {hoveredMeshInfo.marma && (
            <div className="mt-1 text-[10px] text-foreground bg-muted/80 px-2 py-0.5 rounded-lg border border-border/80 flex items-center gap-1.5">
              <Zap size={10} className="text-primary shrink-0" />
              <span>{hoveredMeshInfo.marma}</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Camera & Angle Controls (Bottom-Left) */}
      {showAngleControls && (
        <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 z-20 pointer-events-auto">
          {/* Angle Presets */}
          <div className="flex items-center gap-1 p-1 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-sm">
            <button
              type="button"
              onClick={() => applyAnglePreset(0, 0)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'front' ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              Front (सामने)
            </button>
            <button
              type="button"
              onClick={() => applyAnglePreset(Math.PI, 0)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'back' ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              Back (पीछे)
            </button>
            <button
              type="button"
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                isAutoRotating ? 'bg-primary text-primary-foreground border border-primary shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              title="Toggle Auto-Orbit Scan"
            >
              <RotateCw size={12} className={isAutoRotating ? 'animate-spin' : ''} />
              <span>3D Scan</span>
            </button>
          </div>

          {/* Anatomical System Layer Filter Tabs */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-card/90 dark:bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-sm">
            {[
              { id: 'all' as const, label: 'All', icon: Layers },
              { id: 'muscular' as const, label: 'Muscles', icon: Activity },
              { id: 'skeletal' as const, label: 'Skeleton', icon: Bone },
              { id: 'vascular' as const, label: 'Vessels', icon: Zap },
              { id: 'visceral' as const, label: 'Organs', icon: Heart }
            ].map(layer => {
              const Icon = layer.icon;
              const isActive = activeSystemLayer === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => {
                    try { sovereignSound.playMechanicalSnap(); } catch {}
                    if (onSystemLayerChange) onSystemLayerChange(layer.id);
                    else setInternalSystemLayer(layer.id);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon size={12} />
                  <span>{layer.label}</span>
                </button>
              );
            })}
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
                3D Mannequin Calibration
              </div>
              <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
                {loadingProgress < 100 ? `Loading Anatomy (${loadingProgress}%)` : 'Rendering Diagnostic Stage...'}
              </div>
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
