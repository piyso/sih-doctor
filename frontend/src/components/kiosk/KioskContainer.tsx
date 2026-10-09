import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck, AlertOctagon, HeartPulse, Printer, Loader2 } from 'lucide-react';
import { Step1Language } from './Step1Language';
import { Step2AbhaAuth, KioskPatient } from './Step2AbhaAuth';
import { Step3VoiceBodyIntake } from './Step3VoiceBodyIntake';
import { Step4Socrates } from './Step4Socrates';
import { StepInterview } from './StepInterview';
import { Step5Pariksha } from './Step5Pariksha';
import { Step6DocumentScanner } from './Step6DocumentScanner';
import { Step7TokenSummary } from './Step7TokenSummary';
import { SocratesSymptom, VitalsData, DashavidhaPariksha, PatientHistory } from '../../types/api';
import { api, IntakeResult, KioskConsent } from '../../services/api';
import { emptyConsent } from './ConsentCard';
import { sovereignSound } from '../../utils/audio';
import { kioskText, KioskTextKey } from '../../utils/kioskLocalization';
import { printElement } from '../../utils/printDocument';
import { StepNavConfig } from './kioskNav';

const DRAFT_KEY = 'kiosk_draft_active';

const emptyPatient = (): KioskPatient => ({
  name: '',
  age: undefined,
  gender: 'MALE',
  phone: '',
  aadhaar: '',
  abhaId: '',
  isPregnant: false,
  isLactating: false,
  careStream: 'UNDECIDED'
});

const emptyPariksha = (): DashavidhaPariksha => ({});
const emptyHistory = (): PatientHistory => ({ conditions: [], allergies: '', currentMedicines: '' });

const STEP_TITLE_KEYS: KioskTextKey[] = ['stepTitle1', 'stepTitle2', 'stepTitle3', 'stepTitle4', 'stepTitleInterview', 'stepTitle5', 'stepTitle6'];
const LAST_FORM_STEP = 7;
const SUMMARY_STEP = 8;
const DRAFT_MAX_AGE_MS = 3 * 60 * 1000; // a draft shown to the next person at the kiosk is a privacy leak, so only very recent ones are offered
const stripIdentifiers = (p: KioskPatient) => ({ ...p, aadhaar: '', abhaId: '' });

type SosState =
  | { phase: 'confirm' }
  | { phase: 'sending' }
  | { phase: 'sent'; token: string; alertId: string | null; acknowledged: boolean }
  | { phase: 'offline' };

interface KioskContainerProps {
  onGoToDoctorDesk?: () => void;
}

export const KioskContainer: React.FC<KioskContainerProps> = () => {
  const getInitialStep = () => {
    try {
      const parsed = parseInt(new URLSearchParams(window.location.search).get('step') || '', 10);
      if (parsed >= 1 && parsed <= SUMMARY_STEP) return parsed;
    } catch {}
    return 1;
  };

  const [currentStep, setCurrentStep] = useState<number>(getInitialStep);
  const [language, setLanguage] = useState('hi');
  const [patient, setPatient] = useState<KioskPatient>(emptyPatient);
  const [transcript, setTranscript] = useState('');
  const [selectedBodyRegion, setSelectedBodyRegion] = useState('');
  const [symptoms, setSymptoms] = useState<SocratesSymptom[]>([]);
  const [vitals, setVitals] = useState<VitalsData>({});
  const [pariksha, setPariksha] = useState<DashavidhaPariksha>(emptyPariksha);
  const [history, setHistory] = useState<PatientHistory>(emptyHistory);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [scannedDocs, setScannedDocs] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [submitOffline, setSubmitOffline] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [causalDagOverride, setCausalDagOverride] = useState<any>(null);
  const [mlcCaseInfo, setMlcCaseInfo] = useState<any>(null);
  const [airborneIsolationInfo, setAirborneIsolationInfo] = useState<any>(null);
  const [savedDraft, setSavedDraft] = useState<any>(null);
  const [sos, setSos] = useState<SosState | null>(null);
  const [consent, setConsent] = useState<KioskConsent>(() => emptyConsent('hi'));
  const [ticket, setTicket] = useState<IntakeResult | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [showBlockedHint, setShowBlockedHint] = useState(false);
  const sosSlipRef = useRef<HTMLDivElement>(null);
  const serverDraftIdRef = useRef<string | null>(null);

  const tx = kioskText(language);

  // ---------------------------------------------------------------- Step navigation registry
  const navRef = useRef<StepNavConfig>({});
  const [navView, setNavView] = useState({ canNext: true, nextLabel: '', blockedHint: '', busy: false });

  const registerNav = useCallback((config: StepNavConfig) => {
    navRef.current = config;
    const next = {
      canNext: config.canNext ?? true,
      nextLabel: config.nextLabel || '',
      blockedHint: config.blockedHint || '',
      busy: !!config.busy
    };
    setNavView(prev =>
      prev.canNext === next.canNext && prev.nextLabel === next.nextLabel && prev.blockedHint === next.blockedHint && prev.busy === next.busy
        ? prev
        : next
    );
  }, []);

  const goToStep = useCallback((step: number) => {
    navRef.current = {};
    setNavView({ canNext: true, nextLabel: '', blockedHint: '', busy: false });
    setShowBlockedHint(false);
    setCurrentStep(step);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  useEffect(() => {
    if (navView.canNext) setShowBlockedHint(false);
  }, [navView.canNext]);

  // ---------------------------------------------------------------- Draft persistence
  useEffect(() => {
    try {
      const local = sessionStorage.getItem(DRAFT_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.draftPayload && parsed.stepNumber >= 2 && Date.now() - Number(parsed.timestamp || 0) < DRAFT_MAX_AGE_MS) setSavedDraft(parsed);
        else sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (currentStep < 2 || currentStep >= SUMMARY_STEP) return;
    // Identifiers (Aadhaar, ABHA) never go into a draft; they are re-entered if the check-in is resumed.
    const draftPayload = { patient: stripIdentifiers(patient), symptoms, pariksha, history, vitals, transcript, selectedBodyRegion, redFlags, language, consent, interviewId };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ stepNumber: currentStep, draftPayload, serverDraftId: serverDraftIdRef.current, timestamp: Date.now() }));
    } catch {}
    // Server copy only once the patient is identifiable, debounced so typing does not flood the server.
    if (!patient.name.trim() && !patient.phone) return;
    const timer = setTimeout(() => {
      api.saveDraft(serverDraftIdRef.current, patient.phone || '', patient.name.trim(), currentStep, draftPayload)
        .then(id => { if (id) serverDraftIdRef.current = id; });
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentStep, patient, symptoms, pariksha, history, vitals, consent]);

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    setSavedDraft(null);
    if (serverDraftIdRef.current) {
      api.deleteDraft(serverDraftIdRef.current);
      serverDraftIdRef.current = null;
    }
  };

  const handleRestoreDraft = () => {
    const d = savedDraft?.draftPayload;
    if (!d) return;
    sovereignSound.playCrystalChime();
    if (d.language) setLanguage(d.language);
    if (d.patient) setPatient({ ...emptyPatient(), ...d.patient });
    if (d.symptoms) setSymptoms(d.symptoms);
    if (d.pariksha) setPariksha(d.pariksha);
    if (d.history) setHistory(d.history);
    if (d.vitals) setVitals(d.vitals);
    if (d.transcript) setTranscript(d.transcript);
    if (d.selectedBodyRegion) setSelectedBodyRegion(d.selectedBodyRegion);
    if (d.redFlags) setRedFlags(d.redFlags);
    if (d.consent) setConsent(d.consent);
    if (d.interviewId) setInterviewId(d.interviewId);
    if (savedDraft.serverDraftId) serverDraftIdRef.current = savedDraft.serverDraftId;
    // Registration details are needed before anything else: go back to them if incomplete.
    const registrationComplete = !!d.patient?.name?.trim() && Number(d.patient?.age) > 0;
    setSavedDraft(null);
    goToStep(registrationComplete ? Math.min(Math.max(savedDraft.stepNumber || 2, 2), LAST_FORM_STEP) : 2);
  };

  // ---------------------------------------------------------------- Inactivity privacy guard
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null);
  const idleActiveRef = useRef(false);
  idleActiveRef.current = inactivityCountdown !== null;

  useEffect(() => {
    if (currentStep < 2 || currentStep >= SUMMARY_STEP || sos) {
      setInactivityCountdown(null);
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setInactivityCountdown(15), 90000);
    };
    const onActivity = () => { if (!idleActiveRef.current) resetTimer(); };
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'pointerdown'];
    events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, onActivity));
    };
  }, [currentStep, sos]);

  useEffect(() => {
    if (inactivityCountdown === null) return;
    if (inactivityCountdown <= 0) {
      handleReset();
      return;
    }
    const timer = setTimeout(() => setInactivityCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [inactivityCountdown]);

  // ---------------------------------------------------------------- Data callbacks
  const handleExtractedExtras = useCallback((extra: { redFlags?: string[]; causalDagOverride?: any; mlcCaseInfo?: any; airborneIsolationInfo?: any }) => {
    if (extra.redFlags) setRedFlags(extra.redFlags);
    if (extra.causalDagOverride !== undefined) setCausalDagOverride(extra.causalDagOverride);
    if (extra.mlcCaseInfo !== undefined) setMlcCaseInfo(extra.mlcCaseInfo);
    if (extra.airborneIsolationInfo !== undefined) setAirborneIsolationInfo(extra.airborneIsolationInfo);
  }, []);

  const buildIntakePayload = (overrides: Record<string, any> = {}) => ({
    patient: {
      ...patient,
      name: patient.name.trim(),
      age: Number(patient.age) || 0,
      language
    },
    careStream: patient.careStream,
    language,
    symptoms,
    pariksha: patient.careStream === 'ALLOPATHY' ? {} : pariksha,
    history,
    vitals,
    rawTranscript: transcript,
    scannedDocs,
    consent: { ...consent, language },
    interviewId,
    routingHints: { isAirborne: !!airborneIsolationInfo?.isAirborneRisk, isMlc: !!mlcCaseInfo?.isMlc },
    ...overrides
  });

  const handleCompleteIntake = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.submitKioskIntake(buildIntakePayload());
      setSessionId(res.sessionId);
      setTicket(res);
      setSubmitOffline(false);
      if (res.redFlags?.length) setRedFlags(res.redFlags);
      try { window.dispatchEvent(new CustomEvent('kiosk_patient_registered')); } catch {}
    } catch (e) {
      console.error('[Kiosk] Intake submission failed:', e);
      setSessionId(`OFFLINE-${Date.now().toString(36).toUpperCase()}`);
      setSubmitOffline(true);
    } finally {
      setIsSubmitting(false);
    }
    clearDraft();
    sovereignSound.playCrystalChime();
    goToStep(SUMMARY_STEP);
  };

  const handleReset = () => {
    clearDraft();
    setInactivityCountdown(null);
    setPatient(emptyPatient());
    setSymptoms([]);
    setVitals({});
    setPariksha(emptyPariksha());
    setHistory(emptyHistory());
    setRedFlags([]);
    setTranscript('');
    setSelectedBodyRegion('');
    setSessionId('');
    setTicket(null);
    setConsent(emptyConsent(language));
    setSubmitOffline(false);
    setScannedDocs([]);
    setCausalDagOverride(null);
    setMlcCaseInfo(null);
    setAirborneIsolationInfo(null);
    setInterviewId(null);
    setSos(null);
    goToStep(1);
  };

  // ---------------------------------------------------------------- SOS
  const triggerSos = async () => {
    setSos({ phase: 'sending' });
    try { sovereignSound.playEmergencyCodeRed(); } catch {}
    try {
      const res = await api.submitKioskIntake(buildIntakePayload({
        patient: { ...patient, name: patient.name.trim() || 'Emergency walk-in (SOS)', age: Number(patient.age) || 0, language },
        triageOverride: 'EMERGENCY_RED_FLAG',
        sosTriggered: true,
        consent: { ...consent, purposes: { ...consent.purposes, care: true }, method: 'emergency', language },
        redFlags: ['Patient pressed the emergency (SOS) button at the kiosk', ...redFlags]
      }));
      setSessionId(res.sessionId);
      setTicket(res);
      setSos({ phase: 'sent', token: res.tokenNo || `ER-${res.sessionId.slice(0, 4).toUpperCase()}`, alertId: (res as any).alertId || null, acknowledged: false });
      try { window.dispatchEvent(new CustomEvent('kiosk_patient_registered')); } catch {}
    } catch (e) {
      console.error('[Kiosk] SOS alert failed:', e);
      setSos({ phase: 'offline' });
    }
  };

  // Show the patient when a nurse has acknowledged the SOS.
  const sosAlertId = sos?.phase === 'sent' && !sos.acknowledged ? sos.alertId : null;
  useEffect(() => {
    if (!sosAlertId) return;
    const t = setInterval(async () => {
      const st = await api.getSosStatus(sosAlertId);
      if (st?.acknowledged) {
        setSos(prev => (prev?.phase === 'sent' ? { ...prev, acknowledged: true } : prev));
        try { sovereignSound.playCrystalChime(); } catch {}
      }
    }, 3000);
    return () => clearInterval(t);
  }, [sosAlertId]);

  // ---------------------------------------------------------------- Dock actions
  const handleDockBack = () => {
    if (currentStep <= 1) return;
    sovereignSound.playMechanicalSnap();
    if (navRef.current.onBack) navRef.current.onBack();
    else goToStep(currentStep - 1);
  };

  const handleDockNext = () => {
    if (navView.busy || isSubmitting) return;
    if (!navView.canNext) {
      setShowBlockedHint(true);
      navRef.current.onBlockedNext?.();
      try { sovereignSound.playClinicalAlert(); } catch {}
      return;
    }
    sovereignSound.playMechanicalSnap();
    if (navRef.current.onNext) navRef.current.onNext();
    else if (currentStep === LAST_FORM_STEP) handleCompleteIntake();
    else goToStep(currentStep + 1);
  };

  const nextLabel = isSubmitting ? tx('submitting') : navView.nextLabel || (currentStep === LAST_FORM_STEP ? tx('finishBtn') : tx('nextBtn'));

  return (
    <div className="kiosk-panoramic-container">
      <main className="kiosk-center-stage">
        <header className="no-print rounded-2xl border border-border/80 px-4 py-2.5 mb-5 shadow-xs flex items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-white border border-border/80 p-0.5 flex items-center justify-center shrink-0">
              <img src="/ashoka-stambh-hd.png" alt="" className="h-7 w-7 object-contain pointer-events-none select-none" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading font-extrabold text-sm tracking-tight text-foreground truncate">{tx('hospitalName')}</span>
              <span className="text-[11px] text-muted-foreground font-medium">{tx('kioskBadge')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sovereignSound.playClinicalAlert();
              setSos({ phase: 'confirm' });
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-heading font-extrabold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
          >
            <AlertOctagon size={14} />
            <span>{tx('sosBtn')}</span>
          </button>
        </header>

        {savedDraft && currentStep === 1 && (
          <div className="p-3 sm:p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl mb-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0 text-sky-700 dark:text-sky-300">
                <ShieldCheck size={16} />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <div className="text-sm font-bold text-foreground">{tx('draftTitle')}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {tx('draftSub', { name: savedDraft.draftPayload?.patient?.name || tx('patientFallback'), n: savedDraft.stepNumber })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleRestoreDraft} className="btn btn-primary text-xs px-3.5 py-1.5 rounded-lg">
                {tx('draftContinue')}
              </button>
              <button onClick={clearDraft} className="btn btn-secondary text-xs px-2.5 py-1.5 rounded-lg">
                {tx('draftDiscard')}
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <Step1Language selectedLanguage={language} onSelectLanguage={l => { setLanguage(l); setConsent(c => ({ ...c, language: l })); }} registerNav={registerNav} />
        )}

        {currentStep === 2 && (
          <Step2AbhaAuth patient={patient} setPatient={setPatient} language={language} registerNav={registerNav} consent={consent} setConsent={setConsent} />
        )}

        {currentStep === 3 && (
          <Step3VoiceBodyIntake
            transcript={transcript}
            setTranscript={setTranscript}
            selectedBodyRegion={selectedBodyRegion}
            setSelectedBodyRegion={setSelectedBodyRegion}
            symptoms={symptoms}
            setSymptoms={setSymptoms}
            vitals={vitals}
            setVitals={setVitals}
            redFlags={redFlags}
            language={language}
            onExtras={handleExtractedExtras}
            onRequestSos={() => setSos({ phase: 'confirm' })}
            registerNav={registerNav}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4Socrates
            symptoms={symptoms}
            setSymptoms={setSymptoms}
            vitals={vitals}
            setVitals={setVitals}
            selectedBodyRegion={selectedBodyRegion}
            language={language}
            registerNav={registerNav}
            onEmergency={() => setSos({ phase: 'confirm' })}
          />
        )}

        {currentStep === 5 && (
          <StepInterview
            patient={patient}
            language={language}
            symptoms={symptoms}
            transcript={transcript}
            interviewId={interviewId}
            setInterviewId={setInterviewId}
            setHistory={setHistory}
            setSymptoms={setSymptoms}
            setRedFlags={setRedFlags}
            onRequestSos={() => setSos({ phase: 'confirm' })}
            onNext={() => goToStep(6)}
            onBack={() => goToStep(4)}
            registerNav={registerNav}
          />
        )}

        {currentStep === 6 && (
          <Step5Pariksha
            pariksha={pariksha}
            setPariksha={setPariksha}
            history={history}
            setHistory={setHistory}
            careStream={patient.careStream}
            symptoms={symptoms}
            selectedBodyRegion={selectedBodyRegion}
            transcript={transcript}
            language={language}
            registerNav={registerNav}
          />
        )}

        {currentStep === 7 && (
          <Step6DocumentScanner
            scannedDocs={scannedDocs}
            setScannedDocs={setScannedDocs}
            language={language}
            patient={patient}
            symptoms={symptoms}
            vitals={vitals}
            pariksha={pariksha}
            selectedBodyRegion={selectedBodyRegion || symptoms[0]?.site || 'General'}
            registerNav={registerNav}
          />
        )}

        {currentStep === SUMMARY_STEP && (
          <Step7TokenSummary
            patient={patient}
            symptoms={symptoms}
            pariksha={pariksha}
            history={history}
            vitals={vitals}
            redFlags={redFlags}
            scannedDocs={scannedDocs}
            transcript={transcript}
            language={language}
            sessionId={sessionId}
            ticket={ticket}
            consent={consent}
            isOffline={submitOffline}
            causalDagOverride={causalDagOverride}
            mlcCaseInfo={mlcCaseInfo}
            airborneIsolationInfo={airborneIsolationInfo}
            onReset={handleReset}
          />
        )}
      </main>

      {/* The single Back / Next control for steps 1–6 */}
      {currentStep < SUMMARY_STEP && (
        <>
          {showBlockedHint && !navView.canNext && navView.blockedHint && (
            <div className="no-print fixed bottom-[86px] left-1/2 -translate-x-1/2 z-[1001] max-w-[min(92vw,520px)] px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-400/70 text-amber-900 dark:text-amber-100 text-xs sm:text-sm font-semibold shadow-lg text-center" role="alert">
              {navView.blockedHint}
            </div>
          )}
          <nav aria-label="Kiosk step navigation" className="dynamic-island-dock no-print">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handleDockBack}
              className="tactile-btn px-4 py-2 text-sm font-semibold rounded-full gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={15} />
              <span>{tx('backBtn')}</span>
            </button>

            <div className="flex flex-col items-center px-1 min-w-0">
              <span className="text-[10.5px] font-semibold text-muted-foreground">{tx('stepOf', { n: currentStep })}</span>
              <span className="text-xs font-bold text-foreground truncate max-w-[40vw]">{tx(STEP_TITLE_KEYS[currentStep - 1])}</span>
            </div>

            <button
              type="button"
              onClick={handleDockNext}
              aria-disabled={!navView.canNext}
              className={`tactile-btn-primary px-5 py-2 text-sm font-semibold rounded-full gap-1.5 shadow-sm ${!navView.canNext ? 'opacity-50' : ''}`}
            >
              {isSubmitting || navView.busy ? <Loader2 size={15} className="animate-spin" /> : null}
              <span className="truncate max-w-[38vw]">{nextLabel}</span>
              <ArrowRight size={15} />
            </button>
          </nav>
        </>
      )}

      {/* Inactivity privacy guard */}
      {inactivityCountdown !== null && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="physical-card max-w-md w-full p-6 sm:p-8 rounded-3xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-2xl font-mono font-bold text-rose-600 dark:text-rose-400">
              {inactivityCountdown}
            </div>
            <h3 className="text-lg sm:text-xl font-heading font-extrabold text-foreground mb-2">{tx('idleTitle')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{tx('idleBody')}</p>
            <div className="flex gap-2.5 w-full">
              <button type="button" onClick={() => { sovereignSound.playCrystalChime(); setInactivityCountdown(null); }} className="btn btn-primary flex-1 py-2.5 text-sm rounded-xl">
                {tx('idleStay')}
              </button>
              <button type="button" onClick={handleReset} className="btn btn-secondary py-2.5 px-4 text-sm rounded-xl text-rose-600 dark:text-rose-400 border-rose-500/30">
                {tx('idleExit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS: alerts the emergency desk (registers a STAT case) — never opens the doctor screen */}
      {sos && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" role="dialog" aria-modal="true">
          <div className="max-w-md w-full bg-card border-2 border-rose-500 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <HeartPulse size={34} />
            </div>

            {sos.phase === 'confirm' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-heading font-extrabold text-foreground">{tx('sosConfirmTitle')}</h3>
                  <p className="text-sm text-muted-foreground">{tx('sosConfirmBody')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={triggerSos} className="w-full sm:flex-1 py-3 px-4 rounded-xl text-sm font-heading font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md">
                    {tx('sosConfirmYes')}
                  </button>
                  <button type="button" onClick={() => setSos(null)} className="w-full sm:flex-1 py-3 px-4 rounded-xl text-sm font-heading font-bold border border-border hover:bg-muted text-foreground">
                    {tx('cancel')}
                  </button>
                </div>
              </>
            )}

            {sos.phase === 'sending' && (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 size={24} className="animate-spin text-rose-600" />
                <p className="text-sm font-semibold text-foreground">{tx('sosSending')}</p>
              </div>
            )}

            {(sos.phase === 'sent' || sos.phase === 'offline') && (
              <>
                <div ref={sosSlipRef} className="flex flex-col gap-2 text-left">
                  <h3 className="text-xl font-heading font-extrabold text-foreground text-center">{tx('sosTitle')}</h3>
                  <p className="text-sm text-foreground/90 leading-relaxed">{tx('sosBody')}</p>
                  {sos.phase === 'sent' ? (
                    <>
                      <p className="text-sm font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 text-center">
                        {tx('sosAlertSent', { token: sos.token })}
                      </p>
                      <p className={`text-sm font-bold rounded-xl px-3 py-2 text-center flex items-center justify-center gap-2 ${sos.acknowledged ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40' : 'bg-muted text-muted-foreground'}`} role="status" aria-live="polite">
                        {!sos.acknowledged && <Loader2 size={14} className="animate-spin" />}
                        {sos.acknowledged ? tx('sosAcked') : tx('sosWaiting')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2">
                      {tx('sosOffline')}
                    </p>
                  )}
                  {patient.name && <p className="text-xs text-muted-foreground text-center">{patient.name}{patient.age ? ` · ${patient.age}` : ''}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => printElement(sosSlipRef.current, tx('sosTitle'))}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-sm font-heading font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2"
                  >
                    <Printer size={15} />
                    <span>{tx('sosPrint')}</span>
                  </button>
                  <button type="button" onClick={() => setSos(null)} className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-sm font-heading font-bold border border-border hover:bg-muted text-foreground">
                    {tx('sosClose')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
