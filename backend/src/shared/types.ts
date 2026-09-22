/**
 * Master Clinical, AYUSH, Interoperability & Cryptographic Type Definitions
 * PS ID 26047 — AIIA MediKiosk & Ambient Scribe
 * Ministry of Ayush & MoHFW, Government of India
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. PATIENT & DEMOGRAPHICS
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientDemographics {
  id: string;
  abhaId?: string;           // 14-digit ABHA Number: 12-3456-7890-1234
  abhaAddress?: string;      // e.g. ramkumar@abdm
  aadhaarMasked?: string;    // e.g. XXXXXXXX1234
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phoneMasked?: string;      // e.g. XXXXXX3210
  language: 'hi' | 'en' | 'mr' | 'ta' | 'te' | 'bn' | 'gu';
  prakritiBaseline?: string; // Vata, Pitta, Kapha, Vata-Pitta, etc.
  isPregnant?: boolean;      // Critical flag to contraindicate emmenagogue Ayush herbs (Garbhini)
  gestationalWeeks?: number;
  isLactating?: boolean;     // Sthanya Pravritti safety gating
  weightKg?: number;         // Pediatric / Geriatric posology scaling
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAGE 1: MEDIKIOSK INTAKE & SOCRATES SYMPTOM LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export interface SocratesSymptom {
  name: string;              // Standardized symptom name (e.g. "Chest Pain")
  rawVernacular?: string;    // Spoken input (e.g. "chhati me dard aur jalan")
  site?: string;             // Anatomical site (e.g. "Substernal", "Epigastrium")
  onset?: string;            // Temporal onset (e.g. "since 3 days", "sudden 2h ago")
  character?: string;        // Dull, Sharp, Burning, Throbbing, Constricting
  radiation?: string;        // Radiation to left arm, back, jaw, none
  associated?: string[];     // Associated symptoms (Nausea, Vomiting, Diaphoresis)
  timing?: string;           // Continuous, Intermittent, Morning, Post-Prandial
  exacerbating?: string;     // Exertion, Spicy food, Walking, Cold weather
  relieving?: string;        // Rest, Antacids, Warm water, Sleep
  severity: number;          // 1-10 VAS scale
  isNegated: boolean;        // true if "dard nahi hai"
}

export type AgniType = 'Mandagni' | 'Tikshnagni' | 'Vishamagni' | 'Samagni';

export interface DashavidhaPariksha {
  prakriti: string;          // Constitutional type (Vata-Pitta, etc.)
  vikriti: string;           // Morbid dosha deviation
  sara: string;              // Tissue excellence: Pravara, Madhyama, Avara
  samhanana: string;         // Body compactness: Compact, Moderate, Loose
  pramana: string;           // Anthropometry: Height, Weight, BMI
  satmya: string;            // Homologation / Adaptability
  sattva: 'Pravara' | 'Madhyama' | 'Avara'; // Mental resilience
  aharaShakti: 'Abhyavaharana' | 'Jarana';  // Ingestion vs Digestion capability
  vyayamaShakti: 'High' | 'Medium' | 'Low'; // Exercise tolerance
  vaya: 'Balya' | 'Madhyama' | 'Jirna';    // Age stage: Childhood, Adult, Elderly
  agni: AgniType;            // Digestive fire status
  amaPresent: boolean;       // Presence of endotoxins (Tongue coating, heaviness)
  koshtha?: 'Krura' | 'Mridu' | 'Madhyama'; // Bowel habit
}

export type TriagePriority = 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';

export interface TriageAssessment {
  priority: TriagePriority;
  redFlagsDetected: string[];
  reason: string;
  recommendedAction: string;
  timestamp: string;
}

export interface MediKioskIntakeSession {
  sessionId: string;
  patientId: string;
  demographics: PatientDemographics;
  symptoms: SocratesSymptom[];
  pariksha: DashavidhaPariksha;
  vitals?: {
    bp?: string;
    pulse?: number;
    spo2?: string;
    temp?: string;
    bloodSugar?: number;
  };
  triage: TriageAssessment;
  scannedDocuments: DigitizedDocument[];
  rawAudioTranscript?: string;
  status: 'PENDING_DOCTOR' | 'IN_CONSULTATION' | 'COMPLETED' | 'DIVERTED_EMERGENCY';
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAGE 2: DIGITIZED RECORDS & OCR INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

export interface LabMarker {
  testName: string;
  value: number;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  flag?: 'HIGH' | 'LOW' | 'CRITICAL';
  plausibilityWarning?: string;
  originalRawValue?: number;
}

export interface DigitizedDocument {
  documentId: string;
  patientId: string;
  documentType: 'OLD_PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'OTHER';
  extractedText: string;
  extractedMedications: string[];
  extractedLabMarkers: LabMarker[];
  extractedDiagnoses: string[];
  recordedDate?: string;
  confidenceScore: number;
  isOrphanPage?: boolean;
  missingPages?: string[];
  unitConversionsApplied?: string[];
  plausibilityWarnings?: string[];
  fuzzyCorrections?: Array<{ original: string; corrected: string; confidence: number; category: string }>;
  vernacularPosologyDetected?: Array<{ phrase: string; meaning: string }>;
  stoichiometricValidations?: string[];
  biochemicalRatios?: Array<{ name: string; ratio: number; interpretation: string; isConcordant: boolean }>;
  humanReviewRequired?: boolean;
  reviewReason?: string;
  engineUsed?: 'NATIVE_EDGE_TESSERACT' | 'SOVEREIGN_WASM' | 'TEXT_STREAM';
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STAGE 3: DOCTOR CONSULTATION, DUAL-PHARMACOLOGY & TRUTH ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface AllopathicMedication {
  drugName: string;
  dosage: string;            // e.g. 650mg, 40mg
  route: 'Oral' | 'Topical' | 'Inhalation' | 'IV' | 'IM';
  frequency: 'OD' | 'BD' | 'TDS' | 'QID' | 'SOS' | 'HS';
  timing: 'Before Food (AC)' | 'After Food (PC)' | 'With Food' | 'Anytime' | 'Bedtime (HS)' | 'Morning' | 'Night' | 'After Food' | 'Before Food';
  duration: string;           // e.g. 5 days, 1 month
  instructions?: string;
}

export interface AyushFormulation {
  formulationName: string;
  classicalName?: string;
  category: 'Churna' | 'Vati/Gutika' | 'Asava/Arishta' | 'Guggulu' | 'Bhasma/Pishti' | 'Taila/Ghrita' | 'Taila' | 'Ghrita' | 'Rasayana' | 'Kwath' | 'Kashaya/Kwath' | 'Vati' | 'Arishta' | 'Bhasma' | 'Avaleha';
  dosage: string;            // e.g. 3g, 2 tablets, 15ml
  frequency: 'OD' | 'BD' | 'TDS' | 'QID' | 'SOS' | 'HS' | string;
  anupana: string;           // Statutory vehicle: Honey, Warm Water, Milk, Maharasnadi Kwath
  timing: 'Prathakaal (Morning)' | 'Adhobhakta (Post-Lunch)' | 'Nishi (Bedtime)' | 'Morning' | 'Night' | 'Anytime' | 'After Food' | 'Before Food';
  duration: string;
}

export type ContraindicationSeverity = 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'AYUSH_INCOMPATIBILITY' | 'INFO';

export interface ConflictAlert {
  alertId: string;
  severity: ContraindicationSeverity;
  itemA: string;             // e.g. "Warfarin"
  itemB: string;             // e.g. "Guggulu"
  mechanism: string;         // Pharmacological/Pharmacokinetic mechanism
  evidenceScore: number;     // 0.0 to 1.0 (Beta-Binomial Bayesian confidence)
  clinicalAction: string;    // What the doctor must do
  citation?: string;         // Pharmacopoeia / BMJ / ICMR reference
}

export interface NamasteTriCodedDiagnosis {
  aCode: string;             // e.g. "AYU-JWA-001"
  sanskritTerm: string;      // e.g. "Vataja Jwara"
  englishEquivalent: string; // e.g. "Acute Pyrexia / Viral Fever"
  icd10DualCode: string;     // e.g. "R50.9"
  snomedConceptId: string;   // e.g. "386661006"
  icmrStandardWorkflowId: string; // e.g. "ICMR-STW-INF-001"
}

export interface ConsultationRecord {
  encounterId: string;
  sessionId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  department: string;        // "Kaya Chikitsa", "Shalya Tantra", "Prasuti Tantra", "General Medicine"
  symptoms: SocratesSymptom[];
  pariksha: DashavidhaPariksha;
  vitals: Record<string, string | number>;
  diagnoses: NamasteTriCodedDiagnosis[];
  allopathicPrescription: AllopathicMedication[];
  ayushPrescription: AyushFormulation[];
  investigationsOrdered: string[];
  conflictAlerts: ConflictAlert[];
  doctorNotes?: string;
  ambientTranscriptSummary?: string;
  zkpProofBadge?: ZkSnarkProofBadge;
  fhirBundleId?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STAGE 4: CRYPTOGRAPHIC INTEGRITY & ZERO-KNOWLEDGE SNARK
// ─────────────────────────────────────────────────────────────────────────────

export interface ZkSnarkProofBadge {
  proofProtocol: string;
  verificationStatus: 'VERIFIED_VALID' | 'VERIFIED_INVALID';
  recordSha256Hash: string;
  publicSignalHash: string;
  verificationLatencyMs: number;
  circuitId: string;
  patentReference: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ABDM / FHIR R4 INTEROPERABILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FhirBundleEntry {
  fullUrl: string;
  resource: Record<string, any>;
}

export interface AbdmFhirBundle {
  resourceType: 'Bundle';
  id: string;
  meta: {
    versionId: string;
    lastUpdated: string;
    profile: string[];
  };
  identifier: {
    system: string;
    value: string;
  };
  type: 'document';
  timestamp: string;
  entry: FhirBundleEntry[];
}
