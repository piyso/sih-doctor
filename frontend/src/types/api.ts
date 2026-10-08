/**
 * Universal Sovereign Healthcare Interfaces (Frontend Standalone)
 * Fully compatible with shared/types.ts & ABDM FHIR R4
 */

export type TriagePriority = 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
export type ConsultationStatus = 'WAITING' | 'PENDING_DOCTOR' | 'IN_CONSULTATION' | 'COMPLETED' | 'DIVERTED_EMERGENCY';
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
}

export interface AllopathicMedication {
  id?: string;
  name: string;
  genericName?: string;
  dosage: string;
  route: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface AyushFormulation {
  id?: string;
  classicalName: string;
  namasteCode?: string;
  dosageForm: string;
  dose: string;
  anupana: string;
  frequency: string;
  durationDays: number;
  pathya?: string[];
  apathya?: string[];
}

export interface ConflictAlert {
  alertId?: string;
  itemA?: string;
  itemB?: string;
  allopathicDrug: string;
  ayushHerb: string;
  severity: 'CRITICAL_LETHAL' | 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'MODERATE_MONITOR' | 'BIOAVAILABILITY_ALTERATION' | 'VIRUDDHA_AHARA';
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
  scannedDocs?: any[];
  isPregnant?: boolean;
  gestationalWeeks?: number;
  isLactating?: boolean;
  weightKg?: number;
  abhaId?: string;
  existingEncounter?: any;
  careStream?: CareStream;
  history?: PatientHistory;
  parikshaAdvisory?: any;
  provisionalDiagnoses?: any[];
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

export interface ZkSnarkProofBadge {
  circuit: string;
  protocol: string;
  curve: string;
  soundnessProven: boolean;
  tamperResistant: boolean;
  publicSignalsCount: number;
  verifiedAt: string;
  claimsCovered: string[];
  hashVerification?: string;
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

export interface LeverDiagnosticInfo {
  connected: boolean;
  path: string;
  subsystems?: string[];
  protocol?: string;
}

export interface LeverDiagnosticsData {
  piyApiProjectCloud: LeverDiagnosticInfo;
  piyNotesAudio: LeverDiagnosticInfo;
  patentZkpArbiter: LeverDiagnosticInfo;
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
    doctorSigned: boolean;
    digitalSignatureDigest?: string;
    statutoryRule: string;
  };
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

