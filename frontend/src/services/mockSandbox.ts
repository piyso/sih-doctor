import { PatientQueueItem, SessionDetail } from '../types/api';
import { StaffUser } from './session';

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
    patientName: 'Shanti Devi (Warfarin Anticoagulation)',
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
    vitals: {
      bloodPressure: '130/84',
      pulseRate: 74,
      spo2: 98,
      temperature: 98.4
    } as any
  },
  {
    sessionId: 'sess-001',
    patientId: 'pat-001',
    patientName: 'Ramesh Kumar (Emergency Chest Pain)',
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
    vitals: {
      bloodPressure: '160/100',
      pulseRate: 112,
      spo2: 93,
      temperature: 98.6
    } as any
  },
  {
    sessionId: 'sess-003',
    patientId: 'pat-003',
    patientName: 'Baby Aarav Patel (Pediatric High Fever)',
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
    vitals: {
      bloodPressure: '95/60',
      pulseRate: 138,
      spo2: 96,
      temperature: 103.2
    } as any
  },
  {
    sessionId: 'sess-004',
    patientId: 'pat-004',
    patientName: 'Anita Sharma (Type 2 Diabetes / Prameha)',
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
    vitals: {
      bloodPressure: '138/88',
      pulseRate: 80,
      spo2: 98,
      temperature: 98.2
    } as any
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
    vitals: {
      bloodPressure: '130/84',
      pulseRate: 74,
      spo2: 98,
      temperature: 98.4
    } as any,
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
    vitals: {
      bloodPressure: '160/100',
      pulseRate: 112,
      spo2: 93,
      temperature: 98.6
    } as any,
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
