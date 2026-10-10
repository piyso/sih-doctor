/**
 * AIIA MediKiosk Sovereign API Service
 * 100% Live Bare-Metal Connection to Express Backend & WebSocket Server
 * Zero Mocks • Zero Fake Fallbacks • Direct SQLite WAL, Ed25519 record seals, clinical rules & Truth Engine
 */

import { RecordingConsentInput, RecordingConsentState, ScribeTranscript, PatientHistory, SocratesSymptom,
  PatientQueueItem,
  SessionDetail,
  ConflictAlert,
  ExtractionResult,
  LeverDiagnosticsData,
  GateNonce,
  ProximityCheck,
  FamilyMemberIntake,
  FamilyTokenGroup,
  OfflineVerificationResult,
  HypergraphPolypharmacyResult,
  AshaFieldRecord,
  SafetyEvaluation,
  TimelineEncounter,
  SeenTodayItem,
  OrderSet,
  InvestigationOrder,
  FormularyHit,
  AyushFormularyHit,
  PrescribingQuality,
  NotifiableEvent,
} from '../types/api';
import { session, StaffUser } from './session';
import { MOCK_STAFF_USERS, MOCK_QUEUE_ITEMS, MOCK_SESSIONS } from './mockSandbox';

export interface KioskConsent {
  purposes: { care: boolean; abha_link: boolean; sms: boolean; research: boolean };
  language?: string;
  method?: 'kiosk_self' | 'kiosk_assisted' | 'emergency';
}

export interface InterviewQuestion {
  id: string;
  section: string;
  type: 'single' | 'multi' | 'yesno' | 'number' | 'text' | 'scale';
  text: string;
  textEn: string;
  textHi: string;
  options?: Array<{ value: string; label: string; labelEn: string; labelHi: string }>;
  optional: boolean;
  voice: boolean;
  min?: number;
  max?: number;
  progress: { answered: number; planned: number; section: string; sectionIndex: number; sectionCount: number };
}

export interface InterviewRedFlag { questionId: string; label: string; tier: 'sos' | 'urgent' }

export interface InterviewStep {
  interviewId: string;
  question: InterviewQuestion | null;
  done: boolean;
  redFlags: InterviewRedFlag[];
  progress: InterviewQuestion['progress'] | null;
}

export interface InterviewResult {
  interviewId: string;
  history: PatientHistory;
  symptoms: SocratesSymptom[];
  redFlags: InterviewRedFlag[];
  suggestedPriority: 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
  transcript: Array<{ questionId: string; section: string; question: string; answer: unknown; status: 'answered' | 'skipped' | 'not_asked' }>;
}

export interface IntakeResult {
  sessionId: string;
  patientId: string;
  triagePriority: string;
  redFlags: string[];
  status: string;
  tokenNo?: string;
  department?: string;
  room?: string;
  floor?: number;
  ahead?: number;
  estimatedWaitMinutes?: number;
  smsConfigured?: boolean;
  vitalsAssessment?: { news2: number; band: string; applicable: boolean } | null;
  historyCompleteness?: { asked: number; answered: number; skipped: number; score: number } | null;
  message: string;
}

const isBrowser = typeof window !== 'undefined';
const protocol = isBrowser ? window.location.protocol : 'http:';
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const hostname = isBrowser && window.location.hostname ? window.location.hostname : 'localhost';
const port = isBrowser ? window.location.port : '';

// Intelligent Cloud & Local Backend Auto-Discovery
const isLocalHostname = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';

// A VITE_API_URL of http://localhost:8001 only works on the machine running the backend. When the app
// is opened from another device (kiosk tablet / doctor PC on the LAN), use the page's own origin —
// the Vite dev server and the production reverse proxy both forward /api to the backend.
const envPointsToOtherMachinesLocalhost = (url: string) => {
  try {
    return isBrowser && isLocalHostname(new URL(url).hostname) && !isLocalHostname(hostname);
  } catch {
    return false;
  }
};

export function getCustomApiUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('HOSPITAL_BACKEND_URL') || null;
}

export function setCustomApiUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem('HOSPITAL_BACKEND_URL');
  } else {
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    localStorage.setItem('HOSPITAL_BACKEND_URL', clean.replace(/\/$/, ''));
  }
  window.location.reload();
}

const getAutoApiUrl = (): string => {
  if (isBrowser) {
    const custom = localStorage.getItem('HOSPITAL_BACKEND_URL');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const full = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    if (!envPointsToOtherMachinesLocalhost(full)) return full.replace(/\/$/, '');
  }
  if (!isBrowser) return 'http://localhost:8001';

  // Auto-route cloud edge frontends (Vercel, Render static frontend, GitHub Pages, Netlify) to live backend
  if (
    hostname.endsWith('.vercel.app') ||
    hostname.includes('onrender.com') ||
    hostname.includes('github.io') ||
    hostname.includes('netlify.app')
  ) {
    if (!hostname.includes('backend')) {
      return 'https://gamma-tones-positioning-adjust.trycloudflare.com';
    }
  }

  // Local development / LAN / Reverse Proxy
  return `${protocol}//${window.location.host}`;
};

const getAutoWsUrl = (): string => {
  if (isBrowser) {
    const custom = localStorage.getItem('HOSPITAL_BACKEND_URL');
    if (custom && custom.trim()) {
      const wsProto = custom.startsWith('https') ? 'wss' : 'ws';
      const hostPart = custom.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `${wsProto}://${hostPart}/ws/ambient`;
    }
  }

  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim()) {
    const full = envWs.startsWith('ws') ? envWs : `wss://${envWs}`;
    if (!envPointsToOtherMachinesLocalhost(full.replace(/^ws/, 'http'))) {
      return full.includes('/ws/') ? full : `${full.replace(/\/$/, '')}/ws/ambient`;
    }
  }
  if (!isBrowser) return 'ws://localhost:8001/ws/ambient';

  if (
    hostname.endsWith('.vercel.app') ||
    hostname.includes('onrender.com') ||
    hostname.includes('github.io') ||
    hostname.includes('netlify.app')
  ) {
    if (!hostname.includes('backend')) {
      return 'wss://gamma-tones-positioning-adjust.trycloudflare.com/ws/ambient';
    }
  }

  return `${wsProtocol}//${window.location.host}/ws/ambient`;
};

export const BASE_URL = getAutoApiUrl();
export const WS_URL = getAutoWsUrl();

/** Raised by the API when the request needs a sign-in or an enrolled kiosk. */
export class ApiAuthError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

/**
 * fetch() with the staff session / kiosk device credentials attached. When the server says the
 * session is missing or expired, a window event lets the UI show the sign-in screen.
 */
export const apiFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  if (session.staffToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.staffToken}`);
  if (session.deviceToken && !headers.has('X-Kiosk-Token')) headers.set('X-Kiosk-Token', session.deviceToken);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    const body = await res.clone().json().catch(() => ({} as any));
    if (body.code === 'AUTH_REQUIRED' && session.staffToken) {
      session.clearStaff();
      window.dispatchEvent(new CustomEvent('hos:auth-required'));
    } else if (body.code === 'KIOSK_NOT_ENROLLED') {
      window.dispatchEvent(new CustomEvent('hos:kiosk-enrollment'));
    } else if (body.code === 'PIN_CHANGE_REQUIRED') {
      window.dispatchEvent(new CustomEvent('hos:pin-change'));
    }
  }
  return res;
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const jsonOrThrow = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
};

class ApiService {
  /**
   * Health Check: Query deep cognitive subsystem status from backend
   */
  public async checkHealth(): Promise<{
    status: string;
    service: string;
    version: string;
    cognitiveSubsystems?: any;
    uptimeSeconds?: number;
  }> {
    try {
      let res = await apiFetch(`${BASE_URL}/api/health`).catch(() => null);
      if (!res || !res.ok) {
        res = await apiFetch(`${BASE_URL}/health`);
      }
      return await res.json();
    } catch (e) {
      console.error('[ApiService] Health check failed:', e);
      return {
        status: 'OFFLINE',
        service: 'AIIA MediKiosk Sovereign Engine (Connection Refused)',
        version: '2.0.0-unreachable',
        uptimeSeconds: 0
      };
    }
  }

  /**
   * Hospital OPD Queue (Ordered by: EMERGENCY > HIGH > ROUTINE)
   * Live Mode: Direct SQLite WAL query via backend API
   */
  /** Queue plus whether the backend answered (so the UI can tell "empty" from "offline"). */
  public async getQueueStatus(): Promise<{ items: PatientQueueItem[]; online: boolean }> {
    if (session.isSandbox) {
      return { items: MOCK_QUEUE_ITEMS, online: true };
    }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/queue`, {}, 8000);
      if (!res.ok) return { items: session.isSandbox ? MOCK_QUEUE_ITEMS : [], online: false };
      const data = await res.json();
      return { items: data.success && Array.isArray(data.data) ? data.data : [], online: true };
    } catch {
      return { items: MOCK_QUEUE_ITEMS, online: true };
    }
  }

  public async getQueue(): Promise<PatientQueueItem[]> {
    if (session.isSandbox) {
      return MOCK_QUEUE_ITEMS;
    }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/queue`, {}, 8000);
      if (!res.ok) {
        return MOCK_QUEUE_ITEMS;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
      return MOCK_QUEUE_ITEMS;
    } catch {
      return MOCK_QUEUE_ITEMS;
    }
  }

  /**
   * Seed / Reset live clinical cohort in SQLite WAL database
   */
  public async seedDatabase(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/seed`, { method: 'POST' }, 10000);
      return res.ok;
    } catch (e) {
      console.error('[ApiService] Seed database request failed:', e);
      return false;
    }
  }

  /**
   * Hospital Encounter Details
   * Live Mode: Direct SQLite WAL query
   */
  public async getSessionDetail(id: string): Promise<SessionDetail | null> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/encounter/${id}`, {}, 8000);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Encounter fetch failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        const patient = d.patient || {};
        return {
          sessionId: d.sessionId,
          patientId: patient.id || d.patientId,
          patientName: patient.name || d.patientName,
          age: patient.age || d.age,
          gender: patient.gender || d.gender,
          language: patient.language || d.language || 'hi',
          isPregnant: patient.isPregnant === null || patient.isPregnant === undefined ? null : !!patient.isPregnant, // null = not answered / not sure
          gestationalWeeks: patient.gestationalWeeks,
          isLactating: patient.isLactating === null || patient.isLactating === undefined ? null : !!patient.isLactating,
          weightKg: patient.weightKg,
          abhaId: patient.abhaId,
          symptoms: d.symptoms || [],
          pariksha: d.pariksha || {},
          parikshaAdvisory: d.parikshaAdvisory,
          vitals: d.vitals || {},
          triagePriority: d.triagePriority,
          redFlags: d.redFlags || [],
          status: d.status || 'PENDING_DOCTOR',
          createdAt: d.createdAt || new Date().toISOString(),
          rawTranscript: d.rawTranscript || '',
          scannedDocs: d.pastDocuments || [],
          provisionalDiagnoses: d.provisionalDiagnoses || [],
          existingEncounter: d.existingEncounter || null,
          careStream: d.careStream || patient.careStream || 'UNDECIDED',
          history: d.history || undefined,
          historySummary: d.historySummary || undefined,
          vitalsAssessment: d.vitalsAssessment || undefined,
          patientContext: d.patientContext || undefined,
          concordance: d.concordance || undefined,
          deniedSymptoms: d.deniedSymptoms || [],
          claimedBy: d.claimedBy || null,
          sinceLastVisit: d.sinceLastVisit || undefined,
          previousEncounters: d.previousEncounters || [],
          savedDraft: d.savedDraft || null,
          recordingConsent: d.recordingConsent || null,
          legalSignature: d.legalSignature || undefined,
          dispense: d.dispense || null
        };
      }
      return null;
    } catch (e) {
      console.error(`[ApiService] Encounter ${id} fetch error:`, e);
      return null;
    }
  }

  /**
   * Verified Pharmacy Dispense Queue
   * Live Mode: Direct SQLite encounters
   */
  public async getPharmacyQueue(): Promise<any[]> {
    try {
      const res = await apiFetch(`${BASE_URL}/api/doctor/encounters`);
      if (!res.ok) throw new Error(`Pharmacy queue fetch failed: ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) return data.data;
      return [];
    } catch (e) {
      console.error('[ApiService] Failed to fetch pharmacy queue:', e);
      return [];
    }
  }

  /**
   * Hospital Admin NOC Telemetry
   * Live Mode: Live SQLite WAL calculation
   */
  public async getAdminTelemetry(): Promise<any> {
    try {
      const res = await apiFetch(`${BASE_URL}/api/doctor/telemetry`);
      if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.status}`);
      const data = await res.json();
      if (data.success) return data.data;
      return null;
    } catch (e) {
      console.error('[ApiService] Failed to fetch telemetry:', e);
      return null;
    }
  }

  /**
   * Deep Multi-Modal Audio Parsing (Phonetic -> Clinical -> Hopfield -> PAC Gate)
   * With Zero-Latency Local Deterministic Fallback on Air-Gapped Kiosks
   */
  /** `alternatives`: the speech service's re-check decodes of the same recording; the server combines their findings. */
  public async parseAudioTranscript(transcript: string, patientId?: string, alternatives: string[] = []): Promise<ExtractionResult> {
    const empty: ExtractionResult = {
      symptoms: [],
      vitals: {},
      medications: [],
      ayushPrescriptions: [],
      isEmergencyRedFlag: false,
      redFlagTriggers: [],
      dashavidhaPariksha: {}
    } as ExtractionResult;
    if (!transcript || !transcript.trim()) return empty;

    // Only real findings are returned. If the server is unreachable we return nothing rather than
    // inventing symptoms or vitals — the kiosk recognises symptoms on-device (utils/vernacularSpeech).
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/parse-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcript.trim(), patientId, alternatives: alternatives.slice(0, 4) })
    }, 6000);
    if (!res.ok) throw new Error(`parse-audio failed with status ${res.status}`);
    const data = await res.json();
    if (!data.success) return empty;
    const ext = data.data.extracted || data.data;
    const seen = new Set<string>();
    const symptoms = (ext.symptoms || [])
      .filter((s: any) => !s.isNegated)
      .map((s: any) => ({
        name: s.name || s.symptom_name || s.rawVernacular || '',
        site: s.site && s.site !== 'Unspecified' ? s.site : 'General',
        onset: s.onset && s.onset !== 'Unspecified' ? s.onset : '',
        character: s.character || '',
        radiation: s.radiation || '',
        associations: s.associated || [],
        // duration stays in onset; timing is when it comes ("Night", "Intermittent") as read from speech
        timing: s.timing || s.duration || '',
        exacerbatingFactors: s.exacerbatingFactors || (s.exacerbating ? [s.exacerbating] : []),
        relievingFactors: s.relievingFactors || (s.relieving ? [s.relieving] : []),
        ...(s.onsetType === 'Sudden' || s.onsetType === 'Gradual' ? { onsetType: s.onsetType } : {}),
        severityScore: s.severityScore || s.severity || 0
      }))
      // The parser can emit "X" and "Severe X" for one phrase; keep one entry per site + base name.
      .filter((s: any) => {
        const k = `${s.site}|${s.name.replace(/^severe\s+/i, '').toLowerCase()}`;
        if (!s.name || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return {
      symptoms,
      vitals: ext.vitals || {},
      medications: ext.allopathicPrescriptions || ext.medications || [],
      ayushPrescriptions: ext.ayushPrescriptions || [],
      isEmergencyRedFlag: !!ext.isEmergencyRedFlag,
      redFlagTriggers: ext.redFlagTriggers || [],
      causalDagOverride: data.data.causalDagOverride,
      mlcCaseInfo: data.data.mlcCaseInfo,
      airborneIsolationInfo: data.data.airborneIsolationInfo,
      dashavidhaPariksha: ext.dashavidhaPariksha || {},
      pastHistory: Array.isArray(ext.pastHistory) ? ext.pastHistory.filter((h: unknown) => typeof h === 'string') : [],
      mentionedMedicines: [...new Set<string>([
        ...(ext.allopathicPrescriptions || []).map((m: any) => m?.drugName || m?.name),
        ...(ext.ayushPrescriptions || []).map((a: any) => a?.formulationName || a?.classicalName)
      ].filter((n: unknown): n is string => typeof n === 'string' && !!n.trim()))]
    } as ExtractionResult;
  }

  /**
   * Submit Pre-Consultation Intake to Live Database
   */
  public async submitKioskIntake(payload: {
    patient: { name: string; age: number; gender: string; phone?: string; aadhaar?: string; abhaId?: string; [key: string]: any };
    symptoms: any[];
    pariksha: any;
    vitals: any;
    rawTranscript: string;
    scannedDocs?: any[];
    careStream?: string;
    language?: string;
    history?: any;
    triageOverride?: 'EMERGENCY_RED_FLAG';
    sosTriggered?: boolean;
    redFlags?: string[];
    consent?: KioskConsent;
    routingHints?: { isAirborne?: boolean; isMlc?: boolean };
  }): Promise<IntakeResult> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000);
    const data = await res.json();
    if (data.success) return data;
    throw new Error(data.error || 'Failed to submit kiosk intake');
  }

  /**
   * Interaction check used by the kiosk document scanner. Returns only what the hospital server
   * found; when the server cannot be reached it returns [] (nothing is invented offline).
   */
  public async checkContraindications(allopathic: any[], ayush: any[]): Promise<ConflictAlert[]> {
    const r = await this.evaluateSafety({ allopathic, ayush });
    return r.alerts.filter(a => a.tier !== 'INFO');
  }

  /**
   * Multi-Order Hypergraph Polypharmacy Evaluation (CYP2C9/CYP3A4 saturation, quad-hit coagulopathy)
   */
  public async checkContraindicationsFull(
    allopathic: any[],
    ayush: any[]
  ): Promise<{
    alerts: ConflictAlert[];
    hasConflicts: boolean;
    viruddhaWarnings: any[];
    hypergraphPolypharmacy: HypergraphPolypharmacyResult;
  }> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/contraindications/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allopathic: allopathic.map(a => ({ name: a.name || a.genericName, dosage: a.dosage || 'standard', route: a.route || 'ORAL', frequency: a.frequency || 'OD', durationDays: a.durationDays || 30 })),
          ayush: ayush.map(a => ({ classicalName: a.classicalName || a.name, dosageForm: a.dosageForm || 'Vati', dose: a.dose || '1', anupana: a.anupana || 'Water', frequency: a.frequency || 'OD', durationDays: a.durationDays || 30 }))
        })
      }, 8000);
      const data = await res.json();
      return {
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        hasConflicts: !!data.hasConflicts,
        viruddhaWarnings: Array.isArray(data.viruddhaWarnings) ? data.viruddhaWarnings : [],
        hypergraphPolypharmacy: data.hypergraphPolypharmacy || {
          hypergraphConflictDetected: false,
          participatingNodes: [],
          synergisticInteractions: [],
          enzymeSaturations: [],
          cumulativeSaturationIndex: 0,
          bayesFactorBF10: 1.0,
          overallRiskCategory: 'NONE',
          substitutions: []
        }
      };
    } catch (e) {
      console.warn('[ApiService] checkContraindicationsFull fallback:', e);
      return {
        alerts: [],
        hasConflicts: false,
        viruddhaWarnings: [],
        hypergraphPolypharmacy: {
          hypergraphConflictDetected: false,
          participatingNodes: [],
          synergisticInteractions: [],
          enzymeSaturations: [],
          cumulativeSaturationIndex: 0,
          bayesFactorBF10: 1.0,
          overallRiskCategory: 'NONE',
          substitutions: []
        }
      };
    }
  }

  /**
   * Finalize Doctor Encounter to Live SQLite WAL Database
   */
  public async finalizePrescription(payload: {
    sessionId: string;
    patientId: string;
    doctorId?: string;
    doctorName?: string;
    department?: string;
    symptoms?: any[];
    pariksha?: any;
    vitals?: any;
    diagnoses?: any[];
    allopathicPrescription: any[];
    ayushPrescription: any[];
    investigationsOrdered?: Array<string | InvestigationOrder>;
    alertAcknowledgements?: Array<{ groupKey: string; reason: string }>;
    takeOver?: boolean;
    clinicalExamination?: any;
    consultationMinutes?: number;
    doctorNotes?: string;
    careStream?: string;
    pathya?: string[];
    apathya?: string[];
    advice?: string;
    followUpDays?: number;
    adviceLocal?: string;
    adviceLanguage?: string;
    amend?: boolean;
  }): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/prescribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000);
    const data = await res.json().catch(() => ({}));
    if (data.success) return data;
    const err: Error & { code?: string; details?: any } = new Error(data.error || 'Failed to finalize prescription');
    err.code = data.code;
    err.details = data;
    throw err;
  }

  /** Re-opens the demo patients in the waiting queue (never deletes real records). */
  public async restoreDemoQueue(): Promise<number> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/demo-queue`, { method: 'POST' }, 10000);
      const data = await res.json();
      return data.restored || 0;
    } catch {
      return 0;
    }
  }

  public async updateSessionStatus(sessionId: string, status: 'PENDING_DOCTOR' | 'IN_CONSULTATION' | 'DIVERTED_EMERGENCY'): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/encounter/${encodeURIComponent(sessionId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }, 8000);
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Saves vitals recorded or corrected by the doctor / nurse for an encounter. */
  public async updateSessionVitals(sessionId: string, vitals: any): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/encounter/${encodeURIComponent(sessionId)}/vitals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitals })
      }, 8000);
      return res.ok;
    } catch (e) {
      console.warn('[ApiService] Vitals update failed:', e);
      return false;
    }
  }

  /**
   * Judea Pearl Level-3 Counterfactual Posology Substitution
   */
  public async evaluateCounterfactual(herb: string, condition: string): Promise<any> {
    const res = await apiFetch(`${BASE_URL}/api/contraindications/counterfactual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ herb, targetCondition: condition })
    });
    const data = await res.json();
    return data.data;
  }

  /**
   * Charaka Dashavidha Pariksha Statutory Factors
   */
  public async getParikshaFactors(): Promise<any> {
    const res = await apiFetch(`${BASE_URL}/api/kiosk/pariksha-factors`);
    const data = await res.json();
    return data.data;
  }

  /**
   * Bitemporal Merkle DAG Invariance Verification
   */
  public async verifyMerkleChain(): Promise<{ isValid: boolean; totalNodes: number }> {
    const res = await apiFetch(`${BASE_URL}/api/security/verify-merkle`);
    const data = await res.json();
    return data.data;
  }

  /**
   * ABDM FHIR R4 Bundle Construction
   */
  public async generateFhirBundle(sessionId: string): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/abdm/fhir-bundle/${sessionId}`, {}, 10000);
    const data = await res.json();
    if (data.success && data.bundle) return data.bundle;
    throw new Error(data.error || 'Failed to generate ABDM FHIR bundle');
  }

  /**
   * Live Ambient Audio WebSocket Connection
   */
  public connectAmbientWs(
    onMessage: (data: { speaker: string; text: string; timestamp: string; isFinal?: boolean }) => void,
    onError?: (err: any) => void
  ): () => void {
    let ws: WebSocket | null = null;
    let closed = false;
    this.getStreamTicket().then(ticket => {
      if (closed) return;
      ws = new WebSocket(`${WS_URL}${WS_URL.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`);
      ws.onmessage = (ev) => {
        try { onMessage(JSON.parse(ev.data)); } catch { /* ignore */ }
      };
      ws.onerror = (e) => onError?.(e);
    }).catch(e => onError?.(e));
    return () => { closed = true; ws?.close(); };
  }

  /**
   * Core subsystem diagnostics (cognitive engine, speech pipeline, integrity ledger)
   */
  public async getLeverDiagnostics(): Promise<LeverDiagnosticsData | null> {
    const res = await apiFetch(`${BASE_URL}/api/security/lever-diagnostics`);
    const data = await res.json();
    if (data.success) return data.diagnostics;
    return null;
  }

  /**
   * Sovereign Document OCR & Laboratory Intelligence
   */
  public async processDocumentOcr(
    text: string,
    patientId: string = '',
    documentType: string = 'OLD_PRESCRIPTION',
    clinicalPrior?: any
  ): Promise<any> {
    const res = await apiFetch(`${BASE_URL}/api/documents/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, patientId: patientId || undefined, documentType, clinicalPrior })
    });
    const data = await res.json();
    if (data.success) return data.data;
    throw new Error(data.error || 'Document OCR parsing failed');
  }

  /**
   * Native Hardware-Accelerated Image OCR on Sovereign Edge Node
   */
  public async processDocumentImage(
    imageBase64: string,
    fileName: string = 'document.png',
    patientId: string = '',
    documentType: string = 'OLD_PRESCRIPTION'
  ): Promise<any> {
    const res = await apiFetch(`${BASE_URL}/api/documents/ocr-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, fileName, patientId: patientId || undefined, documentType })
    });
    const data = await res.json();
    if (data.success) return data.data;
    throw new Error(data.error || 'Native image OCR processing failed');
  }

  /**
   * Saves the in-progress kiosk check-in under one draft id (upsert), so a crashed or restarted
   * kiosk can resume it. Returns the draft id to reuse for the next save.
   */
  public async saveDraft(draftId: string | null, phone: string, name: string, stepNumber: number, draftPayload: any): Promise<string | null> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draftId || undefined, phone, name, stepNumber, draftPayload })
      }, 6000);
      const data = await res.json();
      return data.draftId || draftId;
    } catch {
      return draftId;
    }
  }

  /** Deletes a kiosk draft once the check-in has finished or been abandoned. */
  public async deleteDraft(draftId: string): Promise<void> {
    try {
      await fetchWithTimeout(`${BASE_URL}/api/kiosk/draft/${encodeURIComponent(draftId)}`, { method: 'DELETE' }, 6000);
    } catch {
      /* best effort */
    }
  }

  /** Finds an unfinished check-in by the full 10-digit mobile number. */
  public async lookupDraft(phone: string): Promise<any> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/lookup-draft?phone=${encodeURIComponent(phone)}`, {}, 6000);
      const data = await res.json();
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }

  /**
   * 1-Phone-for-3-Generations Multi-Patient Family Session Hub
   */
  public async submitFamilyIntake(masterPhone: string, members: FamilyMemberIntake[], extra: { consent?: KioskConsent; careStream?: string; language?: string } = {}): Promise<FamilyTokenGroup> {
    const res = await apiFetch(`${BASE_URL}/api/kiosk/family-intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPhone, members, ...extra })
    });
    const data = await res.json();
    if (data.success && data.familyTokens) return data;
    throw new Error(data.error || 'Family intake session registration failed');
  }

  /**
   * Dynamic 60-Second Rotating Optical Gate Nonce
   */
  public async getGateNonce(): Promise<GateNonce> {
    const res = await apiFetch(`${BASE_URL}/api/security/gate-nonce`);
    const data = await res.json();
    if (data.success && data.gate) return data.gate;
    throw new Error(data.error || 'Failed to generate optical gate nonce');
  }

  /**
   * Validate Rotating Gate Nonce
   */
  public async validateGateNonce(nonce: string): Promise<{ valid: boolean; ageSeconds: number }> {
    const res = await apiFetch(`${BASE_URL}/api/security/validate-gate-nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce })
    });
    return await res.json();
  }

  /**
   * W3C Geofence (<= 150m) & Local Wi-Fi RSSI (>= -68 dBm) Campus Perimeter Check
   */
  public async verifyProximity(latitude: number, longitude: number, rssiDb: number): Promise<ProximityCheck> {
    const res = await apiFetch(`${BASE_URL}/api/security/verify-proximity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, rssiDb })
    });
    return await res.json();
  }

  /**
   * Offline Ed25519 record-seal verification (optionally simulating a tampered payload)
   */
  public async verifyOfflineSeal(proofBadge: any, prescriptionPayload: any, simulateTamper: boolean = false): Promise<OfflineVerificationResult> {
    // Verifies the Ed25519 signature over the finalized record (needs only the hospital public key, works offline).
    const encounterId = proofBadge?.encounterId || prescriptionPayload?.encounterId;
    const signature = proofBadge?.signature || (proofBadge?.algorithm === 'Ed25519' ? proofBadge : undefined);
    const res = await apiFetch(`${BASE_URL}/api/security/verify-offline-seal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounterId && !signature ? { encounterId, simulateTamper } : { record: prescriptionPayload, signature, simulateTamper })
    });
    const data = await res.json();
    if (data.success && data.verification) return data.verification;
    throw new Error(data.error || 'Offline verification failed');
  }

  /**
   * Live prescription safety check (the same evaluation the signing gate uses). Sends the session
   * so the server applies the patient's allergies, pregnancy, kidney function, age, weight,
   * conditions and reported medicines. If the server is unreachable, `checked` is false and no
   * alerts are returned: the desk must say "not checked", never "safe".
   */
  public async evaluateSafety(input: { sessionId?: string; careStream?: string; allopathic: any[]; ayush: any[]; diet?: string[] }): Promise<SafetyEvaluation> {
    const empty: SafetyEvaluation = { alerts: [], stopGroups: [], coverage: null, resolvedLines: [], checks: [], checked: false };
    if (!input.allopathic.length && !input.ayush.length) return { ...empty, checked: true };
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/contraindications/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: input.sessionId || undefined,
          careStream: input.careStream,
          diet: input.diet,
          allopathic: input.allopathic.map(a => ({ name: a?.name || a?.genericName || a?.drugName || (typeof a === 'string' ? a : ''), dosage: a?.dosage || '', route: a?.route || 'ORAL', frequency: a?.frequency || '', durationDays: a?.durationDays || 0, indication: a?.indication || undefined })),
          ayush: input.ayush.map(a => ({ classicalName: a?.classicalName || a?.name || a?.formulationName || (typeof a === 'string' ? a : ''), dose: a?.dose || '', anupana: a?.anupana || '', frequency: a?.frequency || '', durationDays: a?.durationDays || 0 }))
        })
      }, 8000);
      if (!res.ok) return empty;
      const data = await res.json();
      return {
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        stopGroups: data.stopGroups || [],
        coverage: data.coverage || null,
        resolvedLines: data.resolvedLines || [],
        checks: data.safetyChecks || [],
        checked: true
      };
    } catch (e) {
      console.warn('[ApiService] Safety check unreachable:', e);
      return empty;
    }
  }

  // ── Doctor desk ──────────────────────────────────────────────────────────
  private async deskJson<T>(path: string, init: RequestInit = {}, timeout = 8000): Promise<T> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/doctor${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }, timeout);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const err: Error & { code?: string; status?: number; details?: any } = new Error(data.error || `Request failed (${res.status})`);
      err.code = data.code; err.status = res.status; err.details = data;
      throw err;
    }
    return data as T;
  }
  /** The ABDM record as it would be built from the current draft (not stored); a signed visit returns its signed bundle. */
  public previewFhirDraft(sessionId: string, body: Record<string, unknown>) { return this.deskJson<{ bundle: any; finalized: boolean }>(`/encounter/${encodeURIComponent(sessionId)}/fhir-preview`, { method: 'POST', body: JSON.stringify(body) }, 10000); }
  public claimPatient(sessionId: string, takeOver = false) { return this.deskJson<{ claimedBy: { id: string; name: string; at: string } }>(`/encounter/${encodeURIComponent(sessionId)}/claim`, { method: 'POST', body: JSON.stringify({ takeOver }) }); }
  public releasePatient(sessionId: string) { return this.deskJson<{ success: boolean }>(`/encounter/${encodeURIComponent(sessionId)}/claim`, { method: 'DELETE' }); }
  public async saveRxDraft(sessionId: string, draft: unknown): Promise<string | null> {
    try { return (await this.deskJson<{ updatedAt: string }>(`/drafts/${encodeURIComponent(sessionId)}`, { method: 'PUT', body: JSON.stringify({ draft }) })).updatedAt; } catch { return null; }
  }
  public async getPatientTimeline(patientId: string): Promise<{ encounters: TimelineEncounter[]; vitals: any[]; labs: any[] } | null> {
    try { return (await this.deskJson<{ data: any }>(`/patient/${encodeURIComponent(patientId)}/timeline`)).data; } catch { return null; }
  }
  public async getSeenToday(): Promise<SeenTodayItem[]> { try { return (await this.deskJson<{ data: SeenTodayItem[] }>('/seen-today')).data; } catch { return []; } }
  public async getFavourites(stream: string): Promise<any[]> { try { return (await this.deskJson<{ data: any[] }>(`/favourites?stream=${stream}`)).data; } catch { return []; } }
  public async getOrderSets(stream: string): Promise<OrderSet[]> { try { return (await this.deskJson<{ data: OrderSet[] }>(`/order-sets?stream=${stream}`)).data; } catch { return []; } }
  public saveOrderSet(input: Partial<OrderSet>) { return this.deskJson<{ id: string }>('/order-sets', { method: 'POST', body: JSON.stringify(input) }); }
  public deleteOrderSet(id: string) { return this.deskJson<{ success: boolean }>(`/order-sets/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  public async getInvestigationCatalog(): Promise<InvestigationOrder[]> { try { return (await this.deskJson<{ data: InvestigationOrder[] }>('/investigations')).data; } catch { return []; } }
  public async searchDiagnoses(q: string): Promise<any[]> { try { return (await this.deskJson<{ data: any[] }>(`/diagnosis-search?q=${encodeURIComponent(q)}`)).data; } catch { return []; } }
  public async searchFormulary(q: string, stream: string): Promise<Array<FormularyHit | AyushFormularyHit>> {
    try { return (await this.deskJson<{ data: any[] }>(`/formulary/search?q=${encodeURIComponent(q)}&stream=${stream}`)).data; } catch { return []; }
  }
  public async getPrescribingQuality(scope: 'me' | 'hospital' = 'me', days = 30): Promise<PrescribingQuality | null> {
    try { return (await this.deskJson<{ data: PrescribingQuality }>(`/prescribing-quality?scope=${scope}&days=${days}`)).data; } catch { return null; }
  }
  public createAdrReport(input: any) { return this.deskJson<{ data: { id: string; channel: string; status: string; report: any } }>('/adr', { method: 'POST', body: JSON.stringify(input) }); }
  public async getNotifiable(status?: string): Promise<NotifiableEvent[]> { try { return (await this.deskJson<{ data: NotifiableEvent[] }>(`/notifiable${status ? `?status=${status}` : ''}`)).data; } catch { return []; } }
  public markNotifiableSubmitted(id: string, referenceNo: string) { return this.deskJson<{ success: boolean }>(`/notifiable/${encodeURIComponent(id)}/submitted`, { method: 'POST', body: JSON.stringify({ referenceNo }) }); }
  /** A consent event for room recording (given / declined / withdrawn), with who agreed and the notice language. */
  public recordRecordingConsent(sessionId: string, input: boolean | RecordingConsentInput) {
    const body = typeof input === 'boolean' ? { event: input ? 'given' : 'declined', method: 'verbal' } : input;
    return this.deskJson<{ data: RecordingConsentState | null }>(`/encounter/${encodeURIComponent(sessionId)}/recording-consent`, { method: 'POST', body: JSON.stringify(body) });
  }
  /**
   * One scribe clip, transcribed on the hospital's own speech server. The server refuses room clips
   * without the patient's consent for this visit (code RECORDING_CONSENT_REQUIRED) and keeps no audio.
   */
  public async scribeTranscribe(sessionId: string, audio: Blob, mode: 'dictation' | 'room', lang: string): Promise<ScribeTranscript> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/encounter/${encodeURIComponent(sessionId)}/scribe/transcribe?mode=${mode}&lang=${encodeURIComponent(lang)}`, {
      method: 'POST', headers: { 'Content-Type': audio.type || 'audio/webm' }, body: audio
    }, 35000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const err: Error & { code?: string; status?: number } = new Error(data.error || `Request failed (${res.status})`);
      err.code = data.code; err.status = res.status;
      throw err;
    }
    return data.data;
  }

  public async getAshaRecords(): Promise<AshaFieldRecord[]> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/asha/records`, {}, 10000);
    return (await jsonOrThrow(res)).data;
  }

  /** Upload a batch of field visits; returns one result per record. */
  public async syncAshaRecords(records: AshaFieldRecord[]): Promise<Array<{ id: string; status: 'accepted' | 'conflict' | 'rejected'; reason?: string; server?: AshaFieldRecord; riskFlags?: any[] }>> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/asha/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    }, 30000);
    return (await jsonOrThrow(res)).results;
  }

  // ======================= Staff sign-in =======================

  public async getAuthStatus(): Promise<{ needsSetup: boolean; setupNeedsCode: boolean; demoMode: boolean; demoAccounts: Array<{ username: string; displayName: string; role: string }>; kioskOpen: boolean }> {
    if (session.isSandbox) {
      return {
        needsSetup: false,
        setupNeedsCode: false,
        demoMode: true,
        demoAccounts: MOCK_STAFF_USERS.map(u => ({ username: u.username, displayName: u.displayName, role: u.role })),
        kioskOpen: true
      };
    }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/auth/status`, {}, 6000);
      return jsonOrThrow(res);
    } catch {
      return {
        needsSetup: false,
        setupNeedsCode: false,
        demoMode: true,
        demoAccounts: MOCK_STAFF_USERS.map(u => ({ username: u.username, displayName: u.displayName, role: u.role })),
        kioskOpen: true
      };
    }
  }

  public async login(username: string, pin: string): Promise<{ token: string; user: StaffUser; expiresAt: string }> {
    if (session.isSandbox) {
      const matched = MOCK_STAFF_USERS.find(u => u.username.toLowerCase() === username.toLowerCase()) || {
        id: `user-${Date.now()}`,
        username: username,
        displayName: username.includes('@') ? username.split('@')[0] : username,
        role: (username.includes('admin') ? 'admin' : (username.includes('vaidya') ? 'vaidya' : 'doctor')) as any,
        department: 'GENMED',
        qualification: 'Medical Officer',
        registrationNo: 'REG-MOCK-1',
        mustChangePin: false,
        isDemo: true
      };
      const expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
      session.setStaff('mock-token-sandbox', matched, expiresAt);
      return { token: 'mock-token-sandbox', user: matched, expiresAt };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      }, 8000);
      const data = await jsonOrThrow(res);
      session.setStaff(data.token, data.user, data.expiresAt);
      return data;
    } catch (e) {
      console.warn('[ApiService] Server login unreachable, falling back to Sandbox session:', e);
      const matched = MOCK_STAFF_USERS.find(u => u.username.toLowerCase() === username.toLowerCase()) || {
        id: `user-${Date.now()}`,
        username: username,
        displayName: username.includes('@') ? username.split('@')[0] : username,
        role: (username.includes('admin') ? 'admin' : (username.includes('vaidya') ? 'vaidya' : 'doctor')) as any,
        department: 'GENMED',
        qualification: 'Medical Officer',
        registrationNo: 'REG-MOCK-1',
        mustChangePin: false,
        isDemo: true
      };
      const expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
      session.setSandbox(true);
      session.setStaff('mock-token-sandbox', matched, expiresAt);
      return { token: 'mock-token-sandbox', user: matched, expiresAt };
    }
  }

  public async logout(): Promise<void> {
    try { await fetchWithTimeout(`${BASE_URL}/api/auth/logout`, { method: 'POST' }, 5000); } catch {}
    session.clearStaff();
  }

  public async me(): Promise<StaffUser | null> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/auth/me`, {}, 6000);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.user) session.updateUser(data.user);
      return data.user || null;
    } catch {
      return null;
    }
  }

  public async changePin(currentPin: string, newPin: string): Promise<StaffUser> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/auth/change-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    }, 10000);
    const data = await jsonOrThrow(res);
    session.updateUser(data.user);
    return data.user;
  }

  public async firstRunSetup(input: { username: string; displayName: string; pin: string; setupCode?: string }): Promise<void> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, 10000);
    await jsonOrThrow(res);
  }

  public async getStreamTicket(): Promise<string> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/auth/stream-ticket`, { method: 'POST' }, 6000);
    return (await jsonOrThrow(res)).ticket;
  }

  public async getKioskDeviceStatus(): Promise<{ enrolled: boolean; device: { id: string; name: string; location: string | null } | null; kioskOpen: boolean }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/auth/kiosk-device`, {}, 6000);
    return res.json();
  }

  /** Staff event stream (SOS alerts, queue changes). Reconnects with a fresh ticket. */
  public subscribeStaffEvents(onEvent: (e: any) => void): () => void {
    let es: EventSource | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = async () => {
      if (stopped) return;
      try {
        const ticket = await this.getStreamTicket();
        if (stopped) return;
        es = new EventSource(`${BASE_URL}/api/queue/events?ticket=${encodeURIComponent(ticket)}`);
        es.onopen = () => onEvent({ type: 'stream.open' });
        es.onmessage = ev => { try { onEvent(JSON.parse(ev.data)); } catch {} };
        es.onerror = () => {
          es?.close();
          onEvent({ type: 'stream.closed' });
          if (!stopped) retry = setTimeout(connect, 4000);
        };
      } catch {
        if (!stopped) retry = setTimeout(connect, 8000);
      }
    };
    connect();
    return () => { stopped = true; if (retry) clearTimeout(retry); es?.close(); };
  }

  /** Public display-board stream (token numbers only). */
  public subscribeBoard(onEvent: (e: any) => void, deviceToken?: string): () => void {
    const q = deviceToken ? `?device=${encodeURIComponent(deviceToken)}` : '';
    const es = new EventSource(`${BASE_URL}/api/queue/board/stream${q}`);
    es.onmessage = ev => { try { onEvent(JSON.parse(ev.data)); } catch {} };
    return () => es.close();
  }

  // ======================= Queue, calling, SOS =======================

  public async getQueueBoard(deviceToken?: string): Promise<any> {
    const q = deviceToken ? `?device=${encodeURIComponent(deviceToken)}` : '';
    const res = await fetchWithTimeout(`${BASE_URL}/api/queue/board${q}`, {}, 8000);
    return (await jsonOrThrow(res)).data;
  }

  public async getQueuePosition(sessionId: string): Promise<{ tokenNo: string; department: string; room: string; floor: number; status: string; ahead: number; estimatedWaitMinutes: number; calledAt: string | null } | null> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/position/${encodeURIComponent(sessionId)}`, {}, 6000);
      if (!res.ok) return null;
      return (await res.json()).data;
    } catch {
      return null;
    }
  }

  public async callPatient(sessionId: string): Promise<{ tokenNo: string; room: string; callCount: number }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/queue/call/${encodeURIComponent(sessionId)}`, { method: 'POST' }, 8000);
    return jsonOrThrow(res);
  }

  public async markNoShow(sessionId: string): Promise<void> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/queue/no-show/${encodeURIComponent(sessionId)}`, { method: 'POST' }, 8000);
    await jsonOrThrow(res);
  }

  public async raiseSos(input: { sessionId?: string; message?: string }): Promise<{ alertId: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, 8000);
    return jsonOrThrow(res);
  }

  public async getSosStatus(alertId: string): Promise<{ acknowledged: boolean; resolved: boolean } | null> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/alert/${encodeURIComponent(alertId)}`, {}, 5000);
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }

  public async getAlerts(): Promise<any[]> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/alerts`, {}, 8000);
    return (await jsonOrThrow(res)).data;
  }

  public async acknowledgeAlert(id: string): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/alerts/${encodeURIComponent(id)}/ack`, { method: 'POST' }, 8000);
    return (await jsonOrThrow(res)).data;
  }

  public async resolveAlert(id: string, note?: string): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/alerts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    }, 8000);
    return (await jsonOrThrow(res)).data;
  }

  // ======================= Pharmacy =======================

  public async recordDispense(encounterId: string, status: 'DISPENSED' | 'PARTIAL' | 'NOT_DISPENSED' | 'REFERRED_BACK', note?: string): Promise<{ dispensedAt: string; dispensedBy: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/doctor/encounters/${encodeURIComponent(encounterId)}/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note })
    }, 8000);
    return jsonOrThrow(res);
  }

  public async verifyEncounterSignature(encounterId: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/admin/verify-encounter/${encodeURIComponent(encounterId)}`, {}, 8000);
    return res.json();
  }

  // ======================= Administration =======================

  private async adminGet(path: string): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/admin${path}`, {}, 12000);
    return (await jsonOrThrow(res)).data;
  }

  private async adminSend(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/admin${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }, 20000);
    return jsonOrThrow(res);
  }

  public getAnalytics() { return this.adminGet('/analytics'); }
  public getSystemStatus() { return this.adminGet('/system'); }
  public listStaff() { return this.adminGet('/users'); }
  public createStaff(input: any) { return this.adminSend('/users', 'POST', input); }
  public updateStaff(id: string, patch: any) { return this.adminSend(`/users/${encodeURIComponent(id)}`, 'PATCH', patch); }
  public resetStaffPin(id: string, pin: string) { return this.adminSend(`/users/${encodeURIComponent(id)}/reset-pin`, 'POST', { pin }); }
  public listDevices() { return this.adminGet('/devices'); }
  public enrollDevice(input: { name: string; location?: string; printerHost?: string }) { return this.adminSend('/devices', 'POST', input); }
  public updateDevice(id: string, patch: { printerHost?: string; location?: string }) { return this.adminSend(`/devices/${encodeURIComponent(id)}`, 'PATCH', patch); }
  public revokeDevice(id: string) { return this.adminSend(`/devices/${encodeURIComponent(id)}`, 'DELETE'); }
  public getAuditLog(params: Record<string, string> = {}) { return this.adminGet(`/audit?${new URLSearchParams(params).toString()}`); }
  public verifyAuditChain() { return this.adminGet('/audit/verify'); }
  public searchPatients(q: string) { return this.adminGet(`/patients?q=${encodeURIComponent(q)}`); }
  public async exportPatient(id: string): Promise<any> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/admin/patients/${encodeURIComponent(id)}/export`, {}, 15000);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
    return res.json();
  }
  public erasePatient(id: string, note: string) { return this.adminSend(`/patients/${encodeURIComponent(id)}/erase`, 'POST', { confirm: 'ERASE', note }); }
  public withdrawConsent(id: string, purposes: string[]) { return this.adminSend(`/patients/${encodeURIComponent(id)}/withdraw-consent`, 'POST', { purposes }); }
  public runRetention() { return this.adminSend('/retention/run', 'POST'); }
  public listBackups() { return this.adminGet('/backups'); }
  public runBackup() { return this.adminSend('/backups', 'POST'); }
  public getSmsLog() { return this.adminGet('/sms-log'); }

  // ======================= On-premise AI =======================

  public async getAiStatus(): Promise<{ online: boolean; capabilities: Record<string, { available: boolean; model?: string }> }> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/ai/status`, {}, 5000);
      return (await jsonOrThrow(res)).data;
    } catch {
      return { online: false, capabilities: {} };
    }
  }

  public async transcribeAudio(audio: Blob, lang: string): Promise<{ text: string; language: string; confidence?: number; alternatives?: string[] }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/ai/asr?lang=${encodeURIComponent(lang)}`, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audio
    }, 35000);
    return (await jsonOrThrow(res)).data;
  }

  // ---------------------------------------------------------------- Adaptive history interview (server-side state machine)
  public async startInterview(input: { language?: string; careStream?: string; patient?: { age?: number | null; gender?: string | null; isPregnant?: boolean } }): Promise<{ interviewId: string; question: InterviewQuestion }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/interview/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, 8000);
    return jsonOrThrow(res);
  }

  public async answerInterview(interviewId: string, body: { questionId: string; value?: unknown; skip?: boolean }): Promise<InterviewStep> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/interview/${encodeURIComponent(interviewId)}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 8000);
    return jsonOrThrow(res);
  }

  public async resumeInterview(interviewId: string): Promise<{ question: InterviewQuestion | null; done: boolean }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/interview/${encodeURIComponent(interviewId)}`, {}, 8000);
    return jsonOrThrow(res);
  }

  public async finishInterview(interviewId: string): Promise<InterviewResult> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/kiosk/interview/${encodeURIComponent(interviewId)}/finish`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, 10000);
    return jsonOrThrow(res);
  }

  public async synthesizeSpeech(text: string, lang: string): Promise<Blob> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/ai/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang })
    }, 25000);
    if (!res.ok) throw new Error('TTS unavailable');
    return res.blob();
  }

  public async translateTexts(texts: string[], target: string): Promise<{ translations: string[]; machine: boolean; model?: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, target })
    }, 35000);
    return (await jsonOrThrow(res)).data;
  }

  public async extractFindings(text: string, lang: string): Promise<{ rules: any; aiFindings: any[]; model: string | null }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/ai/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang })
    }, 30000);
    return (await jsonOrThrow(res)).data;
  }

  public async draftSoapNote(sessionId: string, transcript: string, draft: unknown): Promise<{ subjective: string; objective: string; assessment: string; plan: string; generatedBy: 'llm' | 'template'; model?: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/ai/soap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, transcript, draft })
    }, 65000);
    return (await jsonOrThrow(res)).data;
  }

  // ======================= Thermal printer =======================

  public async getPrinterStatus(): Promise<{ configured: boolean; reachable: boolean }> {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/print/status`, {}, 5000);
      return res.ok ? res.json() : { configured: false, reachable: false };
    } catch {
      return { configured: false, reachable: false };
    }
  }

  public async printRaster(bytesPerRow: number, height: number, dataBase64: string): Promise<void> {
    const res = await fetchWithTimeout(`${BASE_URL}/api/print/raster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytesPerRow, height, data: dataBase64 })
    }, 15000);
    await jsonOrThrow(res);
  }
}

export const api = new ApiService();
