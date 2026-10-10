/**
 * Master Clinical, AYUSH, Interoperability & Cryptographic Type Definitions
 * AIIA MediKiosk & Ambient Scribe
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
  symptom_name?: string;     // Interoperability alias with frontend
  rawVernacular?: string;    // Spoken input (e.g. "chhati me dard aur jalan")
  site?: string;             // Anatomical site (e.g. "Substernal", "Epigastrium")
  onset?: string;            // Temporal onset (e.g. "since 3 days", "sudden 2h ago")
  onsetType?: 'Sudden' | 'Gradual'; // how it started, when the patient said so ("अचानक", "धीरे धीरे")
  character?: string;        // Dull, Sharp, Burning, Throbbing, Constricting
  radiation?: string;        // Radiation to left arm, back, jaw, none
  associated?: string[];     // Associated symptoms (Nausea, Vomiting, Diaphoresis)
  timing?: string;           // Continuous, Intermittent, Morning, Post-Prandial
  exacerbating?: string;     // Exertion, Spicy food, Walking, Cold weather
  relieving?: string;        // Rest, Antacids, Warm water, Sleep
  severity: number;          // 1-10 VAS scale
  severityScore?: number;    // Interoperability alias with frontend
  isNegated: boolean;        // true if "dard nahi hai"
  isResolved?: boolean;      // denied only because it has stopped ("बुखार उतर गया", "the cough has gone")
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
  dosage: string;            // e.g. 650mg, 40mg; '' when not stated
  route: 'Oral' | 'Topical' | 'Inhalation' | 'IV' | 'IM';
  frequency: 'OD' | 'BD' | 'TDS' | 'QID' | 'SOS' | 'HS' | '';   // '' = not stated
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

export type ContraindicationSeverity = 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'AYUSH_INCOMPATIBILITY' | 'INFO' | 'STATUTORY_SCHEDULE_E1';

export interface ConflictAlert {
  alertId: string;
  severity: ContraindicationSeverity;
  itemA: string;             // e.g. "Warfarin"
  itemB: string;             // e.g. "Guggulu"
  mechanism: string;         // Pharmacological/Pharmacokinetic mechanism
  evidenceScore: number;     // 0.0 to 1.0, from the stated evidence level
  clinicalAction: string;    // What the doctor must do
  citation?: string;         // Pharmacopoeia / BMJ / ICMR reference
  /** STOP needs a typed reason before signing; WARN is shown inline; INFO is in the summary. */
  tier?: 'STOP' | 'WARN' | 'INFO';
  family?: string;
  /** Alerts about the same lines and family share a key (one card, one acknowledgement). */
  groupKey?: string;
  lineRefs?: number[];
  evidence?: 'established' | 'probable' | 'theoretical' | 'statutory';
  source?: 'rules' | 'registry' | 'ontology' | 'ayush_engine';
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. STRUCTURED CLINICAL HISTORY (physician-ready, PS Module C)
// ─────────────────────────────────────────────────────────────────────────────

export type HistorySource = 'patient' | 'document' | 'clinician' | 'asha';

export interface HistoryItem {
  name: string;
  since?: string;            // free text or ISO date ("2019", "3 years")
  status?: 'active' | 'resolved' | 'controlled' | 'uncontrolled' | 'unknown';
  notes?: string;
  source?: HistorySource;
}

export interface DrugHistoryItem {
  name: string;
  dose?: string;
  frequency?: string;
  since?: string;
  adherence?: 'regular' | 'irregular' | 'stopped' | 'unknown';
  prescribedBy?: string;
  source?: HistorySource;
}

export interface AllergyItem {
  agent: string;
  type?: 'drug' | 'food' | 'environment' | 'other';
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'unknown';
  source?: HistorySource;
}

export interface FamilyHistoryItem {
  condition: string;
  relation?: string;         // mother, father, sibling, ...
}

export interface PersonalHistory {
  tobacco?: 'never' | 'current' | 'former' | 'unknown';
  tobaccoDetail?: string;    // bidi, gutkha, khaini...
  alcohol?: 'never' | 'occasional' | 'regular' | 'former' | 'unknown';
  diet?: 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan' | 'unknown';
  appetite?: 'normal' | 'reduced' | 'increased' | 'unknown';
  bowel?: 'regular' | 'constipation' | 'loose' | 'irregular' | 'unknown';
  sleep?: 'normal' | 'disturbed' | 'reduced' | 'unknown';
  physicalActivity?: 'sedentary' | 'moderate' | 'active' | 'unknown';
  occupation?: string;
  waterSource?: string;
}

export type RosAnswer = 'present' | 'denied' | 'not_asked';
export const ROS_SYSTEMS = [
  'constitutional', 'cardiovascular', 'respiratory', 'gastrointestinal', 'genitourinary',
  'musculoskeletal', 'neurological', 'dermatological', 'psychiatric', 'endocrine'
] as const;
export type RosSystem = typeof ROS_SYSTEMS[number];
export type ReviewOfSystems = Partial<Record<RosSystem, RosAnswer>>;

export interface ObstetricHistory {
  isPregnant?: boolean;
  gestationalWeeks?: number;
  gravida?: number;
  para?: number;
  lmp?: string;
  isLactating?: boolean;
}

export type SectionStatus = 'complete' | 'partial' | 'not_asked';

export interface HistoryCompleteness {
  asked: number;
  answered: number;
  skipped: number;
  score: number;             // answered / asked, 0..1
  sections: Record<string, SectionStatus>;
}

export interface ClinicalHistory {
  version: 2;
  /** Kiosk status fields: 'none' is an explicit denial, 'unknown' means asked but not answered. */
  allergyStatus?: 'none' | 'unknown' | 'listed';
  medicineStatus?: 'none' | 'unknown' | 'listed';
  /** Conditions and medicines the patient mentioned while describing the complaint (speech). */
  mentionedInSpeech?: { conditions: string[]; medicines: string[] };
  chiefComplaint?: string;
  // Legacy keys kept so older screens keep working.
  conditions: string[];
  allergies: string;
  currentMedicines: string;
  // Structured sections.
  pastMedical: HistoryItem[];
  pastSurgical: HistoryItem[];
  drugHistory: DrugHistoryItem[];
  allergyList: AllergyItem[];
  familyHistory: FamilyHistoryItem[];
  personal: PersonalHistory;
  reviewOfSystems: ReviewOfSystems;
  obstetric?: ObstetricHistory;
  immunisation?: string[];
  ayush?: { pariksha?: Partial<DashavidhaPariksha>; aharaVihara?: Record<string, string> };
  completeness: HistoryCompleteness;
  interviewId?: string;
}

export interface HistorySummarySection {
  id: string;
  title: string;
  titleHi: string;
  text: string;
  textHi: string;
  status: SectionStatus;
}

export interface HistorySummary {
  generatedAt: string;
  method: 'deterministic-template';
  language: string[];
  sections: HistorySummarySection[];
  text: string;
  textHi: string;
  completeness: HistoryCompleteness;
}
