/**
 * Universal Sovereign Healthcare Interfaces (Frontend Standalone)
 * Fully compatible with shared/types.ts & ABDM FHIR R4
 */

export type TriagePriority = 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
export type ConsultationStatus = 'WAITING' | 'PENDING_DOCTOR' | 'IN_CONSULTATION' | 'COMPLETED' | 'DIVERTED_EMERGENCY' | 'PHARMACY_REFERRED';
export type AgniType = 'SAMAGNI' | 'VISHAMAGNI' | 'TIKSHNAGNI' | 'MANDAGNI';

export interface SocratesSymptom {
  name?: string;
  symptom_name?: string;
  site: string;
  onset: string;
  character: string;
  radiation: string;
  associations: string[];
  timing: string;
  exacerbatingFactors: string[];
  relievingFactors: string[];
  /** How it started, when the patient said so ("अचानक", "धीरे धीरे"). */
  onsetType?: 'Sudden' | 'Gradual';
  severityScore: number; // 1 - 10
  intensity?: number;
  location?: string;
  duration?: string;
  durationDays?: number;
  isNegated?: boolean;
  /** Stable key for kiosk-structured entries (chip / voice / area) so they can be toggled and deduped. */
  key?: string;
  /** Patient-language label shown back on the kiosk; `name` stays the English clinical label. */
  labelLocal?: string;
  source?: 'area' | 'chip' | 'voice' | 'parser' | 'ai';
  isEmergency?: boolean;
}

/** Which kind of doctor the patient is routed to / the logged-in doctor practises. */
export type CareStream = 'AYURVEDA' | 'ALLOPATHY' | 'UNDECIDED';

export interface PatientHistory {
  conditions: string[];
  allergies: string;
  currentMedicines: string;
  /** 'none' = patient said no; 'unknown' = asked, not sure; 'listed' = named in `allergies` / `currentMedicines`.
   *  Missing means not asked — never read as "no allergy". */
  allergyStatus?: 'none' | 'unknown' | 'listed';
  medicineStatus?: 'none' | 'unknown' | 'listed';
  /** What the patient mentioned while describing the complaint (speech or typing), for the doctor. */
  mentionedInSpeech?: { conditions: string[]; medicines: string[] };
  /** Structured v2 fields (present when the server has normalised the history). */
  version?: 2;
  chiefComplaint?: string;
  pastMedical?: Array<{ name: string; since?: string; status?: string; notes?: string }>;
  pastSurgical?: Array<{ name: string; since?: string }>;
  drugHistory?: Array<{ name: string; dose?: string; frequency?: string; adherence?: string }>;
  allergyList?: Array<{ agent: string; reaction?: string; severity?: string; type?: string }>;
  familyHistory?: Array<{ condition: string; relation?: string }>;
  personal?: Record<string, string | undefined>;
  reviewOfSystems?: Record<string, 'present' | 'denied' | 'not_asked'>;
  obstetric?: { isPregnant?: boolean; gestationalWeeks?: number; isLactating?: boolean; lmp?: string };
  completeness?: HistoryCompleteness;
}

export interface HistoryCompleteness {
  asked: number;
  answered: number;
  skipped: number;
  score: number;
  sections: Record<string, 'complete' | 'partial' | 'not_asked'>;
}

export interface HistorySummarySection {
  id: string;
  title: string;
  titleHi: string;
  text: string;
  textHi: string;
  status: 'complete' | 'partial' | 'not_asked';
}

export interface HistorySummary {
  generatedAt: string;
  method: 'deterministic-template';
  sections: HistorySummarySection[];
  text: string;
  textHi: string;
  completeness: HistoryCompleteness;
}

export interface VitalsAssessment {
  applicable: boolean;
  reason?: string;
  news2: number;
  band: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';
  anySingleThree: boolean;
  parameters: Array<{ parameter: string; value: number | string; score: number }>;
  missing: string[];
  complete: boolean;
  selfReported: boolean;
  suggestedPriority: TriagePriority;
  clinicalResponse: string;
  reference: string;
}

export interface PatientSafetyContext {
  patientId: string;
  age?: number;
  gender?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
  trimester?: number;
  isLactating?: boolean;
  weightKg?: number;
  eGfr?: number;
  eGfrMethod?: 'CKD-EPI-2021' | 'reported';
  latestCreatinine?: { value: number; unit: string; recordedAt: string | null };
  isDiabetic?: boolean;
  knownConditions: string[];
  /** `[]` = asked, none; undefined = not asked. */
  allergies?: Array<{ agent: string; reaction?: string; severity?: string }>;
  conditions?: string[];
  reportedMedicines?: string[];
  sources: string[];
  missing: string[];
}

export interface VitalsData {
  bp?: string;
  bp_sys?: number;
  bp_dia?: number;
  pulse?: number;
  pulse_bpm?: number;
  spo2?: string;
  spo2_pct?: number;
  temp?: string;
  temperature_f?: number;
  respiratoryRate?: number;
  bloodSugar?: number;
  bloodSugarType?: 'fasting' | 'random' | 'post_prandial';
  weightKg?: number;
  heightCm?: number;
  /** AVPU: A (alert), C (new confusion), V, P, U. */
  consciousness?: string;
  onOxygen?: boolean;
  news2?: { score: number; band: string; at: string; missing?: string[] } | null;
  recordedBy?: string;
  recordedAt?: string;
  source?: string;
}

export interface DashavidhaPariksha {
  prakriti?: string;
  vikriti?: string;
  sara?: string;
  samhanana?: string;
  pramana?: string;
  satmya?: string;
  satva?: string;
  aharaShakti?: string;
  vyayamaShakti?: string;
  vaya?: string;
  agni?: AgniType;
  /** Patient's own answers — provisional, never the Vaidya's assessment (prakriti, sara and satva are left to them). */
  prakritiScreen?: { answers: Array<'V' | 'P' | 'K'>; provisional: string };
  energySelfReport?: 'Good all day' | 'Enough for daily work' | 'Tires quickly';
}

export interface AllopathicMedication {
  id?: string;
  name: string;
  genericName?: string;
  dosage: string;
  route: string;
  /** Indian notation "1-0-1" (morning-noon-night) or OD/BD/TDS/SOS, optionally with food timing. */
  frequency: string;
  durationDays: number;
  instructions?: string;
  /** Why it is given (required for antibiotics: MoHFW 2024). */
  indication?: string;
  /** Units to dispense, computed from dose × frequency × days where possible. */
  quantity?: number;
  source?: 'doctor' | 'order_set' | 'favourite' | 'repeat' | 'dictation' | 'scanned_document' | 'reported';
}

export interface AyushFormulation {
  id?: string;
  classicalName: string;
  /** @deprecated formulations have no national code system; never filled with invented codes. */
  namasteCode?: string;
  quantity?: number;
  source?: AllopathicMedication['source'];
  dosageForm: string;
  dose: string;
  anupana: string;
  frequency: string;
  durationDays: number;
  pathya?: string[];
  apathya?: string[];
}

export type SafetyTier = 'STOP' | 'WARN' | 'INFO';

export type ConflictAlertSeverity = 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'INFO' | 'AYUSH_INCOMPATIBILITY' | 'STATUTORY_SCHEDULE_E1' | 'CRITICAL_LETHAL';

export interface ConflictAlert {
  alertId?: string;
  itemA?: string;
  itemB?: string;
  allopathicDrug: string;
  ayushHerb: string;
  severity: ConflictAlertSeverity;
  /** STOP: needs a typed reason to sign. WARN: shown beside the medicine. INFO: summary only. */
  tier?: SafetyTier;
  family?: string;
  /** Alerts about the same lines and family share a group (one card, one reason). */
  groupKey?: string;
  /** Indexes of the lines involved (allopathic list first, then Ayurvedic list). */
  lineRefs?: number[];
  evidence?: 'established' | 'probable' | 'theoretical' | 'statutory';
  source?: 'rules' | 'registry' | 'ontology' | 'ayush_engine';
  mechanism: string;
  clinicalConsequence: string;
  clinicalAction?: string;
  recommendedAction: string;
  bayesianConfidence?: number;
  statutoryReference?: string;
  evidenceScore?: number;
  citation?: string;
  counterfactualSubstitution?: any;
}

export interface PatientRecord {
  id: string;
  abhaId?: string;
  abhaAddress?: string;
  aadhaarMasked?: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phoneMasked?: string;
  language: string;
  prakriti?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
  isLactating?: boolean;
  weightKg?: number;
}

export interface PatientQueueItem {
  sessionId: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  language?: string;
  prakriti?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
  isLactating?: boolean;
  weightKg?: number;
  abhaId?: string;
  triagePriority: TriagePriority;
  status: ConsultationStatus;
  redFlags?: string[];
  vitals: VitalsData;
  registeredAt: string;
  primaryComplaint?: string;
  careStream?: CareStream;
  socratesScore?: number;
  queuePosition?: number;
  /** Server-issued token, e.g. GENMED-014, and the room it is called to. */
  tokenNo?: string;
  department?: string;
  room?: string;
  calledAt?: string;
  callCount?: number;
  /** Clinician who has taken the patient (set when the token is called). */
  claimedBy?: { id: string; name: string; at: string };
  visitType?: 'NEW' | 'REVISIT' | 'FOLLOW_UP' | 'PHARMACY_REFERRED';
  pharmacyReferral?: { encounterId: string; note: string; pharmacist: string; at: string; prescriber: string; prescriberId: string };
  normalizedLabMarkers?: Array<{
    marker: string;
    originalValue?: string;
    normalizedValue: string;
    isAbnormal: boolean;
  }>;
}

export interface SessionDetail {
  sessionId: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  language: string;
  symptoms: SocratesSymptom[];
  pariksha: DashavidhaPariksha;
  vitals: VitalsData;
  triagePriority: TriagePriority;
  redFlags: string[];
  status: ConsultationStatus;
  createdAt: string;
  primaryComplaint?: string;
  rawTranscript?: string;
  /** Complaints the patient explicitly denied at the kiosk (pertinent negatives). */
  deniedSymptoms?: string[];
  scannedDocs?: any[];
  isPregnant?: boolean | null; // null = not answered / not sure
  gestationalWeeks?: number;
  isLactating?: boolean | null;
  weightKg?: number;
  abhaId?: string;
  existingEncounter?: any;
  careStream?: CareStream;
  history?: PatientHistory;
  historySummary?: HistorySummary;
  vitalsAssessment?: VitalsAssessment;
  patientContext?: PatientSafetyContext;
  parikshaAdvisory?: any;
  provisionalDiagnoses?: any[];
  claimedBy?: { id: string; name: string; at: string } | null;
  sinceLastVisit?: { firstVisit: boolean; previousVisit?: string; changes: string[] };
  previousEncounters?: TimelineEncounter[];
  savedDraft?: { draft: any; updatedAt: string } | null;
  recordingConsent?: RecordingConsentState | null;
  legalSignature?: { configured: boolean; method: string; seal: string; note: string };
  dispense?: { status: string; note?: string; pharmacist?: string; at?: string } | null;
  concordance?: {
    status: 'CONCORDANT' | 'MALINGERING_SUSPECTED' | 'SILENT_ISCHEMIA_RISK' | 'CONCORDANT_PAIN_VITALS';
    rationale?: string;
    clinicalRationale?: string;
    esiLevel: number;
  };
  normalizedLabMarkers?: Array<{
    marker: string;
    originalValue?: string;
    normalizedValue: string;
    isAbnormal: boolean;
  }>;
  orphanPageAlert?: {
    isOrphan: boolean;
    missingPrecedingPage: number;
    detectedHeader: string;
  };
}

/** Result of verifying a finalized record's Ed25519 seal (see /api/security/verify-offline-seal). */
export interface RecordSealBadge {
  keyId: string;
  algorithm: string;
  valid: boolean;
  recordSha256: string;
  verifiedAt: string;
  provenanceNodes?: number;
}

export interface CausalDagOverrideInfo {
  triggered: boolean;
  rawComplaintTerm: string;
  inferredPathology: string;
  bayesFactorBF10: number;
  causalNodePath: string[];
  clinicalRationale: string;
  recommendedDepartment: string;
}

export interface MlcCaseInfo {
  isMlc: boolean;
  category: 'ASSAULT' | 'ROAD_TRAFFIC_ACCIDENT' | 'FALL_FROM_HEIGHT' | 'POISONING' | 'BURNS' | 'INDUSTRIAL' | 'NONE';
  tamperProofSha256Affidavit: string;
  hmacDigest: string;
  recordedTimestamp: string;
  statutoryJurisdiction: string;
  policeStationJurisdiction: string;
  mandatoryEvidenceActSection: string;
}

export interface AirborneIsolationInfo {
  isAirborneRisk: boolean;
  pathogenRiskCategory: 'SUPER_SPREADER_DROPLET' | 'TUBERCULOSIS_SUSPECT' | 'ACUTE_RESPIRATORY_DISTRESS' | 'SEASONAL_INFLUENZA' | 'STANDARD_ROUTINE';
  quarantineProtocol: string;
  isolationBayNumber: string;
  requiresN95Dispensation: boolean;
  negativePressureRouteAllocated: boolean;
}

export interface ExtractionResult {
  symptoms: SocratesSymptom[];
  vitals: VitalsData;
  medications: AllopathicMedication[];
  ayushPrescriptions: AyushFormulation[];
  isEmergencyRedFlag: boolean;
  redFlagTriggers: string[];
  dashavidhaPariksha?: DashavidhaPariksha;
  provisionalDiagnoses?: string[];
  causalDagOverride?: CausalDagOverrideInfo;
  mlcCaseInfo?: MlcCaseInfo;
  airborneIsolationInfo?: AirborneIsolationInfo;
  /** Long-standing illnesses the patient mentioned while speaking ("शुगर की बीमारी है"), as standard labels. */
  pastHistory?: string[];
  /** Medicine names the patient mentioned ("metformin खाता हूं"); names only, no dose is inferred. */
  mentionedMedicines?: string[];
}

export interface EnzymeSaturation {
  cyp450Enzyme: string;
  inhibitionPct: number;
  saturationRisk: 'CRITICAL_LETHAL' | 'SEVERE_ACCUMULATION' | 'MODERATE' | 'NEGLIGIBLE';
  substratesBlocked: string[];
}

export interface HypergraphPolypharmacyResult {
  hypergraphConflictDetected: boolean;
  participatingNodes: string[];
  synergisticInteractions: {
    nodeA: string;
    nodeB: string;
    pathway: string;
    interactionType: string;
  }[];
  enzymeSaturations: EnzymeSaturation[];
  cumulativeSaturationIndex: number; // 0.0 - 1.0
  bayesFactorBF10: number;
  overallRiskCategory: 'LETHAL_SYNERGISTIC_COAGULOPATHY' | 'CYP_SUBSTRATE_STORM' | 'ARRHYTHMOGENIC_PROLONGATION' | 'NEPHROTOXIC_CASCADE' | 'NONE';
  substitutions: {
    originalCompound: string;
    safeAyushAlternative: string;
    formulationName: string;
    classicalReference: string;
    mechanismOfSafety: string;
  }[];
}

export interface GateNonce {
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  ttlSeconds: number;
  signature: string;
}

export interface ProximityCheck {
  authorized: boolean;
  distanceMeters: number;
  rssiDb: number;
  perimeterType: 'GEOFENCE_AND_WIFI_AUTHENTIC' | 'OUTSIDE_CAMPUS_REJECTED';
  campusAnchor: {
    facility: string;
    latitude: number;
    longitude: number;
  };
  reason?: string;
}

export interface FamilyMemberIntake {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  relationship: string;
  chiefComplaint: string;
  department: string;
  isEmergency?: boolean;
}

export interface FamilyTokenGroup {
  groupId: string;
  masterPhone: string;
  familyTokens: {
    tokenNumber: string;
    patientName: string;
    relationship: string;
    department: string;
    roomNumber: string;
    priority: TriagePriority;
    sequenceIndex: number;
  }[];
  timestamp: string;
}

export interface OfflineVerificationResult {
  authentic: boolean;
  proofProtocol: string;
  curve: string;
  pairingLatencyMs: number;
  tamperDetected: boolean;
  prescriptionHash: string;
  pharmacistLockout: boolean;
  details: string;
}

export interface SubsystemDiagnostics {
  connected: boolean;
  path: string;
  subsystems?: string[];
  protocol?: string;
  graph?: { nodeCount: number; edgeCount: number };
  conformal?: { calibrated: boolean; n?: number; alpha?: number; qHat?: number; source?: string };
  signingKeyId?: string;
  auditChain?: { valid: boolean; checked: number; brokenAtId?: number };
  provenanceChain?: { isValid: boolean; totalNodes: number; brokenAt?: number; error?: string };
  device?: string | null;
}
export type LeverDiagnosticInfo = SubsystemDiagnostics;

/** Shape returned by GET /api/security/diagnostics (alias /lever-diagnostics). */
export interface LeverDiagnosticsData {
  cognitiveEngine: SubsystemDiagnostics;
  integrityLedger: SubsystemDiagnostics;
  speechPipeline: SubsystemDiagnostics;
}

export interface LeverDiagnosticsResponse {
  success: boolean;
  diagnostics: LeverDiagnosticsData;
}

export interface PharmacyDispenseItem {
  id: string;
  prescriptionToken: string;
  patientName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  doctorName: string;
  doctorRegistration: string;
  roomNumber: string;
  prescribedAt: string;
  allopathicMeds: AllopathicMedication[];
  ayushFormulations: AyushFormulation[];
  lasaAlerts: {
    drugName: string;
    confusedWith: string;
    category: 'CRITICAL_LASA' | 'PHONETIC_SIMILAR';
    warningMessage: string;
  }[];
  scheduleE1PoisonVerification: {
    containsScheduleE1: boolean;
    poisonName?: string;
    /** Formulations with a Schedule E(1) ingredient, and which ingredients. */
    items?: Array<{ name: string; ingredients: string[] }>;
    doctorSigned: boolean;
    digitalSignatureDigest?: string;
    statutoryRule: string;
  };
  /** Schedule H1 / NDPS medicines on the prescription (register entry needed). */
  scheduleH1?: Array<{ medicine: string; generic: string; schedule: string; ndps: boolean }>;
  diagnoses?: string[];
  /** The doctor's typed reason for each serious alert signed through. */
  acknowledgedAlerts?: Array<{ groupKey: string; summary: string; reason: string }>;
  /** Which safety checks ran when the doctor signed, and why any did not. */
  safetyChecks?: Array<{ check: string; ran: boolean; detail?: string }>;
  /** What the checks knew about the patient at signing. `allergies` absent = never asked; [] = asked, none. */
  patientContext?: {
    allergies?: Array<{ agent: string; reaction?: string }>;
    pregnancy: 'yes' | 'no' | 'unknown' | null;
    gestationalWeeks?: number;
    lactating: boolean;
    weightKg?: number;
  } | null;
  /** Medicines that are not in the safety database, so nothing was checked for them. */
  notChecked?: string[];
  /** Set when this prescription replaces an earlier one for the same visit. */
  amendsEncounterId?: string | null;
  dispenseStatus: 'PENDING_VERIFICATION' | 'DISPENSED' | 'PARTIAL' | 'NOT_DISPENSED' | 'REFERRED_BACK' | 'FLAGGED_ALERT';
  language?: string;
  department?: string;
  careStream?: CareStream;
  ongoingMedicines?: any[];
  advice?: string;
  followUpDays?: number | null;
  conflictAlerts?: ConflictAlert[];
  signature?: { keyId: string; recordSha256: string; signedAt: string } | null;
  dispensedBy?: string | null;
  dispensedAt?: string | null;
  dispenseNote?: string | null;
}

export interface AshaRiskFlag {
  level: 'URGENT' | 'REFER' | 'WATCH';
  code: string;
  text: string;
}

/** One ASHA/ANM field visit. `synced` is false until the server has accepted this version. */
export interface AshaFieldRecord {
  id: string;
  version: number;
  ashaName?: string;
  village: string;
  household?: string | null;
  patientName: string;
  age: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  isPregnant: boolean;
  gestationalWeeks?: number | null;
  hemoglobinGdl?: number | null;
  bloodPressure?: string | null;
  weightKg?: number | null;
  dangerSigns: string[];
  homeRemedies: string[];
  notes?: string | null;
  riskFlags: AshaRiskFlag[];
  referral: 'NONE' | 'ADVISED' | 'REFERRED' | 'ACCOMPANIED';
  visitAt: string;
  clientUpdatedAt: string;
  receivedAt?: string;
  synced: boolean;
  syncError?: string;
}

export interface NocOpdRoomTelemetry {
  roomNumber: string;
  doctorName: string;
  department: string;
  queuedPatientsCount: number;
  averageConsultationSeconds: number;
  pacingStatus: 'OPTIMAL' | 'RUSHED' | 'BOTTLE_NECK';
  emergencyDivertedCount: number;
}

export interface IdspSyndromicCluster {
  id: string;
  syndromeName: string;
  suspectedPathogen: string;
  pincodeRegion: string;
  patientCount: number;
  kulldorffLogLikelihood: number;
  pValue: number;
  alertLevel: 'EPIDEMIC_EARLY_WARNING' | 'CLUSTER_MONITOR' | 'NORMAL';
  suggestedIntervention: string;
}

export interface PvpiAdverseReactionAnomaly {
  id: string;
  suspectedCommercialBatch: string;
  formulationName: string;
  manufacturer: string;
  clinicalAdverseReaction: string;
  reportedCases: number;
  bayesFactorBF10: number;
  regulatoryActionRequired: boolean;
  statutoryNotice: string;
}



// ── Doctor desk ────────────────────────────────────────────────────────────

export interface StopGroup { groupKey: string; alertIds: string[]; summary: string }

export interface SafetyCoverage {
  linesChecked: number;
  unresolved: Array<{ line: number; name: string }>;
  contextUsed: string[];
  contextMissing: string[];
  reviewStatus: string;
}

export interface ResolvedLineInfo {
  index: number; raw: string; kind: string; role: string; generics: string[]; unresolved: string[];
  schedule?: string[]; aware?: string[]; scheduleE1?: string[];
}

export interface SafetyEvaluation {
  alerts: ConflictAlert[];
  stopGroups: StopGroup[];
  coverage: SafetyCoverage | null;
  resolvedLines: ResolvedLineInfo[];
  checks: Array<{ check: string; ran: boolean; detail?: string }>;
  /** false when the hospital server could not be reached: nothing was checked. */
  checked: boolean;
}

export interface DiagnosisEntry {
  display: string;
  system: 'NAMASTE' | 'ICD-11-MMS' | 'ICD-11-TM2' | 'ICD-10' | 'FREE_TEXT';
  code?: string;
  codeVerified?: boolean;
  icd10?: string;
  snomed?: string;
  english?: string;
  status: 'provisional' | 'final';
  source: 'doctor' | 'accepted_suggestion';
}

export interface InvestigationOrder { id?: string; display: string; loinc?: string; urgency?: 'routine' | 'urgent'; note?: string }

export interface OrderSet {
  id: string; careStream: 'ALLOPATHY' | 'AYURVEDA'; name: string; condition?: string; source?: string; mine?: boolean;
  medicines: any[]; investigations?: string[]; advice?: string; pathya?: string[]; apathya?: string[]; followUpDays?: number;
  steps?: Array<{ step: number; label: string; medicines: any[] }>;
}

export interface FormularyHit {
  id: string; generic: string; isCombination: boolean; matchedBrand?: string; brands: string[];
  aware?: 'ACCESS' | 'WATCH' | 'RESERVE'; schedule?: string; ndps: boolean; nlem: boolean; highAlert: boolean;
  defaults?: { dosage: string; frequency: string; durationDays: number; food?: string };
}

export interface AyushFormularyHit {
  id: string; name: string; form: string; external: boolean; keyConstituents: string[]; scheduleE1: string[]; heavyMetal: boolean; alcohol: boolean;
  defaults?: { dose: string; frequency: string; anupana: string; durationDays: number };
}

export interface TimelineEncounter {
  encounterId: string; sessionId: string; date: string; doctorName: string; department?: string; careStream?: string;
  diagnoses: string[]; medicines: Array<{ name: string; dosage?: string; frequency?: string; durationDays?: number; anupana?: string; stream: string }>;
  advice?: string; followUpDays?: number | null; investigations: string[]; dispensed: string; dispensedAt?: string | null; dispenseNote?: string | null;
  acknowledgedAlerts?: Array<{ summary: string; reason: string }>;
}

export interface SeenTodayItem {
  encounterId: string; sessionId: string; at: string; patientName: string; age?: number; gender?: string; tokenNo?: string;
  items: number; diagnosis: string | null; dispenseStatus: string; dispenseNote: string | null; amended: boolean;
}

export interface QualityIndicator { id: string; label: string; value: number | null; target: string; unit: string }
export interface PrescribingQuality { windowDays: number; encounters: number; indicators: QualityIndicator[]; aware: { access: number; watch: number; reserve: number }; coverage: { medicines: number; recognised: number }; source: string }

export interface NotifiableEvent { id: string; type: string; status: string; patientId: string; patientName: string; age?: number; gender?: string; abhaId?: string; sessionId?: string; encounterId?: string; details: any; referenceNo?: string; createdAt: string }


// ── Scribe: room-recording consent and transcription ────────────────────────
export type ConsentEvent = 'given' | 'declined' | 'withdrawn';
export interface RecordingConsentState {
  given: boolean;
  event: ConsentEvent;
  at: string;
  /** Clinician who recorded the event. */
  by: string;
  consenter?: 'patient' | 'guardian' | 'representative' | string;
  consenterName?: string;
  relationship?: string;
  noticeVersion?: string;
  noticeLanguage?: string;
  othersInformed?: boolean;
}
export interface RecordingConsentInput {
  event: ConsentEvent;
  consenter?: 'patient' | 'guardian' | 'representative';
  consenterName?: string;
  relationship?: string;
  noticeLanguage?: string;
  othersInformed?: boolean;
  method?: string;
}
export interface ScribeTranscript {
  text: string;
  /** Re-decodes of the same audio at other speeds (Hindi): where they disagree, the words are uncertain. */
  alternatives: string[];
  durationSec: number;
  engine?: string;
  language: string;
  mode: 'dictation' | 'room';
  /** false when the speech server judged the clip to be noise, not speech (text is then empty). */
  speech?: boolean;
  rejected?: string;
}
