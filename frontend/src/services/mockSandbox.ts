import { PatientQueueItem, SessionDetail, ConflictAlert, HypergraphPolypharmacyResult } from '../types/api';
import { StaffUser } from './session';

/**
 * Offline sandbox: stand-in data kept in this browser, used ONLY in Mock mode while the hospital
 * server cannot be reached (services/runtimeMode.ts decides; api.ts checks session.isSandbox).
 * It lets the doctor desk be shown with sample patients. It is not the product's clinical engine:
 * the interaction rules below are four illustrative pairs, and nothing here is ever saved or sent.
 * Real mode never uses this file.
 */

export const MOCK_STAFF_USERS: StaffUser[] = [
  {
    id: 'user-dr-sharma',
    username: 'dr.sharma',
    displayName: 'Dr. Ananya Sharma',
    role: 'doctor',
    department: 'GENMED',
    qualification: 'MBBS, MD (General Medicine)',
    registrationNo: 'DMC Reg. 98421',
    hprId: 'dr.ananya.sharma@hpr.abdm',
    mustChangePin: false,
    isDemo: true
  },
  {
    id: 'user-vaidya-sharma',
    username: 'vaidya.sharma',
    displayName: 'Vaidya V. K. Sharma',
    role: 'vaidya',
    department: 'KAYA',
    qualification: 'BAMS, MD (Ayu)',
    registrationNo: 'NCISM Reg. AYU/84920',
    hprId: 'vaidya.vk.sharma@hpr.abdm',
    mustChangePin: false,
    isDemo: true
  },
  {
    id: 'user-admin',
    username: 'admin',
    displayName: 'Hospital Administrator',
    role: 'admin',
    department: 'ADMINISTRATION',
    qualification: 'Hospital Administrator',
    registrationNo: 'ADMIN-001',
    mustChangePin: false,
    isDemo: true
  },
  {
    id: 'user-pharma',
    username: 'pharma.ravi',
    displayName: 'Ravi Kumar (Pharmacist)',
    role: 'pharmacist',
    department: 'PHARMACY',
    qualification: null,
    registrationNo: 'Pharmacy Council Reg. 22841',
    mustChangePin: false,
    isDemo: true
  },
  {
    id: 'user-asha',
    username: 'asha.sunita',
    displayName: 'Sunita Devi (ASHA)',
    role: 'asha',
    department: 'COMMUNITY',
    qualification: null,
    registrationNo: null,
    mustChangePin: false,
    isDemo: true
  },
  {
    id: 'user-nurse',
    username: 'nurse.priya',
    displayName: 'Sr. Nurse Priya Nair',
    role: 'nurse',
    department: 'OPD',
    qualification: 'B.Sc Nursing',
    registrationNo: 'NC-44120',
    mustChangePin: false,
    isDemo: true
  }
];

export const MOCK_QUEUE_ITEMS: PatientQueueItem[] = [
  {
    sessionId: 'sess-002',
    patientId: 'pat-002',
    patientName: 'Shanti Devi',
    age: 64,
    gender: 'FEMALE',
    language: 'hi',
    triagePriority: 'ROUTINE',
    redFlags: [],
    primaryComplaint: 'Bilateral Knee Joint Pain (Sandhivata) on Warfarin 5mg',
    status: 'PENDING_DOCTOR',
    careStream: 'AYURVEDA',
    tokenNo: 'KAYA-002',
    department: 'KAYA',
    registeredAt: new Date(Date.now() - 15 * 60000).toISOString(),
    vitals: { bp: '130/84', pulse: 74, spo2: '98%', temp: '98.4°F', source: 'kiosk' }
  },
  {
    sessionId: 'sess-001',
    patientId: 'pat-001',
    patientName: 'Ramesh Kumar',
    age: 58,
    gender: 'MALE',
    language: 'hi',
    triagePriority: 'EMERGENCY_RED_FLAG',
    redFlags: ['Acute Substernal Chest Pain radiating to Left Arm', 'Diaphoresis', 'Hypertensive Urgency'],
    primaryComplaint: 'Severe retrosternal crushing chest pain radiating to left jaw',
    status: 'PENDING_DOCTOR',
    careStream: 'ALLOPATHY',
    tokenNo: 'EMERG-001',
    department: 'GENMED',
    registeredAt: new Date(Date.now() - 5 * 60000).toISOString(),
    vitals: { bp: '160/100', pulse: 112, spo2: '93%', temp: '98.6°F', source: 'kiosk' }
  },
  {
    sessionId: 'sess-003',
    patientId: 'pat-003',
    patientName: 'Aarav Patel',
    age: 4,
    gender: 'MALE',
    language: 'hi',
    triagePriority: 'HIGH_PRIORITY',
    redFlags: ['Pediatric High Pyrexia (103.2°F)', 'Tachypnea'],
    primaryComplaint: 'High grade fever with persistent cough and vomiting',
    status: 'PENDING_DOCTOR',
    careStream: 'ALLOPATHY',
    tokenNo: 'PED-003',
    department: 'PEDIATRICS',
    registeredAt: new Date(Date.now() - 25 * 60000).toISOString(),
    vitals: { bp: '95/60', pulse: 138, spo2: '96%', temp: '103.2°F', source: 'kiosk' }
  },
  {
    sessionId: 'sess-004',
    patientId: 'pat-004',
    patientName: 'Anita Sharma',
    age: 52,
    gender: 'FEMALE',
    language: 'hi',
    triagePriority: 'ROUTINE',
    redFlags: [],
    primaryComplaint: 'Polyuria, polydipsia, burning sensations in soles (Kaphaja Prameha)',
    status: 'PENDING_DOCTOR',
    careStream: 'AYURVEDA',
    tokenNo: 'INT-004',
    department: 'ENDOCRINE',
    registeredAt: new Date(Date.now() - 35 * 60000).toISOString(),
    vitals: { bp: '138/88', pulse: 80, spo2: '98%', temp: '98.2°F', source: 'kiosk' }
  }
];

export const MOCK_SESSIONS: Record<string, SessionDetail> = {
  'sess-002': {
    sessionId: 'sess-002',
    patientId: 'pat-002',
    patientName: 'Shanti Devi',
    age: 64,
    gender: 'FEMALE',
    language: 'hi',
    triagePriority: 'ROUTINE',
    redFlags: [],
    status: 'PENDING_DOCTOR',
    createdAt: new Date().toISOString(),
    primaryComplaint: 'Bilateral Knee Joint Pain (Sandhivata) on Warfarin 5mg',
    rawTranscript: 'Doctor sahab pichle 6 mahine se dono ghutno me bahut dard hai, chalne me kat-kat ki aawaz aati hai. Mai heart ke liye Warfarin 5mg le rahi hoon.',
    symptoms: [
      {
        name: 'Knee Joint Pain',
        site: 'Bilateral Knees',
        onset: '6 months',
        character: 'Aching with crepitus',
        radiation: 'None',
        associations: [],
        timing: 'Morning',
        exacerbatingFactors: ['Walking'],
        relievingFactors: ['Rest'],
        severityScore: 7,
        isNegated: false
      }
    ],
    vitals: { bp: '130/84', pulse: 74, spo2: '98%', temp: '98.4°F', source: 'kiosk' },
    pariksha: {
      prakriti: 'Vataja',
      vikriti: 'Vata Prakopa',
      sara: 'Avara',
      samhanana: 'Heena',
      pramana: 'Atikrsha',
      satmya: 'Oka Satmya',
      satva: 'Madhyama',
      aharaShakti: 'Heena',
      vyayamaShakti: 'Low',
      vaya: 'Jirna'
    } as any,
    history: {
      conditions: ['Deep Vein Thrombosis', 'Hypertension'],
      allergies: 'Sulfa drugs',
      currentMedicines: 'Warfarin 5mg OD, Amlodipine 5mg OD',
      familyHistory: [{ condition: 'Osteoarthritis', relation: 'Maternal' }]
    }
  },
  'sess-001': {
    sessionId: 'sess-001',
    patientId: 'pat-001',
    patientName: 'Ramesh Kumar',
    age: 58,
    gender: 'MALE',
    language: 'hi',
    triagePriority: 'EMERGENCY_RED_FLAG',
    redFlags: ['Acute Substernal Chest Pain radiating to Left Arm', 'Diaphoresis', 'Hypertensive Urgency'],
    status: 'PENDING_DOCTOR',
    createdAt: new Date().toISOString(),
    primaryComplaint: 'Severe retrosternal crushing chest pain radiating to left jaw',
    rawTranscript: 'Doctor mujhe 2 ghante se chhati me bhari dard aur ghabrahat ho rahi hai, dard baaye haath me ja raha hai aur bahut pasina aa raha hai...',
    symptoms: [
      {
        name: 'Chest Pain',
        site: 'Substernal',
        onset: '2 hours ago',
        character: 'Crushing / Constricting',
        radiation: 'Left Arm & Jaw',
        associations: ['Sweating'],
        timing: 'Continuous',
        exacerbatingFactors: ['Exertion'],
        relievingFactors: ['None'],
        severityScore: 9,
        isNegated: false
      }
    ],
    vitals: { bp: '160/100', pulse: 112, spo2: '93%', temp: '98.6°F', source: 'kiosk' },
    pariksha: {
      prakriti: 'Pitta-Vata',
      vikriti: 'Pitta Vriddhi',
      sara: 'Madhyama',
      samhanana: 'Moderate',
      pramana: 'Ideal',
      satmya: 'Ritu Satmya',
      satva: 'Avara',
      aharaShakti: 'Heena',
      vyayamaShakti: 'Low',
      vaya: 'Madhyama'
    } as any,
    history: {
      conditions: ['Hypertension', 'Hyperlipidemia'],
      allergies: 'none',
      currentMedicines: 'Atorvastatin 20mg',
      familyHistory: [{ condition: 'Coronary Artery Disease', relation: 'Paternal' }]
    }
  }
};

/** The record the doctor desk opens for a sandbox patient (built from the queue row when no fuller one exists). */
export function mockSessionDetail(id: string): SessionDetail | null {
  const full = MOCK_SESSIONS[id];
  const row = MOCK_QUEUE_ITEMS.find(q => q.sessionId === id);
  if (!full && !row) return null;
  const base = full || ({
    sessionId: row!.sessionId,
    patientId: row!.patientId,
    patientName: row!.patientName,
    age: row!.age,
    gender: row!.gender,
    language: row!.language,
    triagePriority: row!.triagePriority,
    redFlags: row!.redFlags || [],
    status: row!.status,
    createdAt: row!.registeredAt,
    primaryComplaint: row!.primaryComplaint,
    rawTranscript: '',
    symptoms: row!.primaryComplaint ? [{ name: row!.primaryComplaint, site: 'General', onset: '', character: '', radiation: '', associations: [], timing: '', exacerbatingFactors: [], relievingFactors: [], severityScore: 0, isNegated: false }] : [],
    vitals: row!.vitals || {},
    pariksha: {}
  } as unknown as SessionDetail);
  return {
    scannedDocs: [], provisionalDiagnoses: [], existingEncounter: null, deniedSymptoms: [], claimedBy: null,
    previousEncounters: [], savedDraft: null, recordingConsent: null, dispense: null,
    ...base,
    patientName: row?.patientName || base.patientName,
    careStream: row?.careStream || (base as any).careStream || 'UNDECIDED',
    vitals: row?.vitals || base.vitals || {}
  } as SessionDetail;
}

export function evaluateMockContraindications(allopathic: any[], ayush: any[]): {
  alerts: ConflictAlert[];
  hasConflicts: boolean;
  viruddhaWarnings: any[];
  hypergraphPolypharmacy: HypergraphPolypharmacyResult;
} {
  const alerts: ConflictAlert[] = [];
  const alloNames = allopathic.map(a => (a.name || a.genericName || '').toLowerCase());
  const ayushNames = ayush.map(a => (a.classicalName || a.name || '').toLowerCase());

  // 1. Warfarin + Guggulu / Garlic
  const hasWarfarin = alloNames.some(n => n.includes('warfarin') || n.includes('coumadin') || n.includes('clopidogrel'));
  const hasGuggulu = ayushNames.some(n => n.includes('guggulu') || n.includes('guggul') || n.includes('garlic') || n.includes('lasuna'));
  if (hasWarfarin && hasGuggulu) {
    alerts.push({
      alertId: 'alert-warfarin-guggulu',
      allopathicDrug: 'Warfarin',
      ayushHerb: 'Yograj Guggulu',
      severity: 'CRITICAL_LETHAL',
      tier: 'STOP',
      evidence: 'established',
      source: 'registry',
      mechanism: 'CYP2C9 competitive inhibition + guggulsterone mediated additive platelet aggregation suppression produces life-threatening spontaneous hemorrhage.',
      clinicalConsequence: 'Severe spontaneous internal hemorrhage & sudden INR elevation > 6.0.',
      recommendedAction: 'WITHDRAW Guggulu immediately. Switch to Rasnasaptaka Kwatha. Recheck INR within 48 hours.'
    });
  }

  // 2. Metformin + Shilajit
  const hasMetformin = alloNames.some(n => n.includes('metformin') || n.includes('glycomet'));
  const hasShilajit = ayushNames.some(n => n.includes('shilajit') || n.includes('shilajeet'));
  if (hasMetformin && hasShilajit) {
    alerts.push({
      alertId: 'alert-metformin-shilajit',
      allopathicDrug: 'Metformin',
      ayushHerb: 'Shuddha Shilajit',
      severity: 'WARNING',
      tier: 'WARN',
      evidence: 'probable',
      source: 'rules',
      mechanism: 'Synergistic AMPK activation & enhanced GLUT4 translocation increases risk of precipitous hypoglycemic collapse.',
      clinicalConsequence: 'Symptomatic neuroglycopenia, diaphoresis and acute hypoglycemic shock.',
      recommendedAction: 'Monitor capillary blood glucose BID. Reduce Metformin dose or switch to Nishamalaki Vati.'
    });
  }

  // 3. Digoxin + Yashtimadhu
  const hasDigoxin = alloNames.some(n => n.includes('digoxin') || n.includes('lanoxin'));
  const hasYashti = ayushNames.some(n => n.includes('yashtimadhu') || n.includes('licorice') || n.includes('mulethi'));
  if (hasDigoxin && hasYashti) {
    alerts.push({
      alertId: 'alert-digoxin-yashti',
      allopathicDrug: 'Digoxin',
      ayushHerb: 'Yashtimadhu (Licorice)',
      severity: 'CRITICAL_CONTRAINDICATION',
      tier: 'STOP',
      evidence: 'established',
      source: 'registry',
      mechanism: 'Glycyrrhizin inhibits 11-beta-HSD2 causing pseudo-hyperaldosteronism & hypokalemia, precipitating lethal digitalis toxicity & ventricular arrhythmias.',
      clinicalConsequence: 'Fatal ventricular tachycardia / ventricular fibrillation secondary to hypokalemic digitalis toxicity.',
      recommendedAction: 'ABSOLUTE CONTRAINDICATION. Cease Yashtimadhu. Serum potassium and ECG monitoring required.'
    });
  }

  // 4. Alprazolam + Ashwagandha
  const hasSedative = alloNames.some(n => n.includes('alprazolam') || n.includes('diazepam') || n.includes('clonazepam') || n.includes('lorazepam'));
  const hasAshwa = ayushNames.some(n => n.includes('ashwagandha') || n.includes('withania'));
  if (hasSedative && hasAshwa) {
    alerts.push({
      alertId: 'alert-sedative-ashwa',
      allopathicDrug: 'Alprazolam',
      ayushHerb: 'Ashwagandha',
      severity: 'WARNING',
      tier: 'WARN',
      evidence: 'probable',
      source: 'rules',
      mechanism: 'Additive GABA-mimetic central nervous system depression with potential for oversedation and respiratory blunting.',
      clinicalConsequence: 'Excessive somnolence, motor ataxia and central respiratory blunting.',
      recommendedAction: 'Dose titrate benzodiazepine downwards. Avoid operating heavy machinery.'
    });
  }

  return {
    alerts,
    hasConflicts: alerts.length > 0,
    viruddhaWarnings: [],
    hypergraphPolypharmacy: {
      hypergraphConflictDetected: alerts.length > 0,
      participatingNodes: alerts.map(a => `${a.allopathicDrug} ↔ ${a.ayushHerb}`),
      synergisticInteractions: [],
      enzymeSaturations: [],
      cumulativeSaturationIndex: alerts.length > 0 ? 0.88 : 0,
      bayesFactorBF10: alerts.length > 0 ? 98.4 : 1.0,
      overallRiskCategory: alerts.length > 0 ? 'LETHAL_SYNERGISTIC_COAGULOPATHY' : 'NONE',
      substitutions: []
    }
  };
}
