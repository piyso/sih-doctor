/**
 * Universal Sovereign Healthcare Interfaces (Frontend Standalone)
 * Fully compatible with shared/types.ts & ABDM FHIR R4
 */

export type TriagePriority = 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
export type ConsultationStatus = 'WAITING' | 'PENDING_DOCTOR' | 'IN_CONSULTATION' | 'COMPLETED' | 'DIVERTED_EMERGENCY';
export type AgniType = 'SAMAGNI' | 'VISHAMAGNI' | 'TIKSHNAGNI' | 'MANDAGNI';

export interface SocratesSymptom {
  name?: string;
  site: string;
  onset: string;
  character: string;
  radiation: string;
  associations: string[];
  timing: string;
  exacerbatingFactors: string[];
  relievingFactors: string[];
  severityScore: number; // 1 - 10
  durationDays?: number;
  isNegated?: boolean;
}

export interface VitalsData {
  bp?: string;
  pulse?: number;
  spo2?: string;
  temp?: string;
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
  allopathicDrug: string;
  ayushHerb: string;
  severity: 'CRITICAL_LETHAL' | 'MODERATE_MONITOR' | 'BIOAVAILABILITY_ALTERATION' | 'VIRUDDHA_AHARA';
  mechanism: string;
  clinicalConsequence: string;
  recommendedAction: string;
  bayesianConfidence: number;
  statutoryReference?: string;
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
  socratesScore?: number;
  queuePosition?: number;
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
  dispenseStatus: 'PENDING_VERIFICATION' | 'DISPENSED' | 'FLAGGED_ALERT';
}

export interface AshaFieldRecord {
  id: string;
  villageName: string;
  ashaWorkerName: string;
  patientName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  isPregnant: boolean;
  gestationalWeeks?: number;
  hemoglobinGdl?: number;
  bloodPressure?: string;
  traditionalHomeRemedies: string[];
  highRiskPregnancyFlags: string[];
  crdtStateVersion: number;
  merkleNodeHash: string;
  createdAt: string;
  syncedToPhc: boolean;
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

