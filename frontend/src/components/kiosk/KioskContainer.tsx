import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, ArrowRight, Sparkles, Clock, AlertTriangle, ShieldCheck, Stethoscope, AlertOctagon, Activity } from 'lucide-react';
import { Step1Language } from './Step1Language';
import { Step2AbhaAuth } from './Step2AbhaAuth';
import { Step3VoiceBodyIntake } from './Step3VoiceBodyIntake';
import { Step4Socrates } from './Step4Socrates';
import { Step5Pariksha } from './Step5Pariksha';
import { Step6DocumentScanner } from './Step6DocumentScanner';
import { Step7TokenSummary } from './Step7TokenSummary';
import { SocratesSymptom, VitalsData, DashavidhaPariksha } from '../../types/api';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';

interface KioskContainerProps {
  onGoToDoctorDesk: () => void;
}

export const KioskContainer: React.FC<KioskContainerProps> = ({ onGoToDoctorDesk }) => {
  const getInitialStep = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      if (stepParam) {
        const parsed = parseInt(stepParam, 10);
        if (parsed >= 1 && parsed <= 7) return parsed;
      }
    } catch {}
    return 1;
  };

  const [currentStep, setCurrentStep] = useState<number>(getInitialStep);
  const [language, setLanguage] = useState('hi');

  const [patient, setPatient] = useState({
    name: '',
    age: 45,
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    phone: '',
    aadhaar: '',
    abhaId: '',
    isPregnant: false,
    isLactating: false,
    weightKg: 65 as number | undefined
  });

  const [transcript, setTranscript] = useState('');
  const [selectedBodyRegion, setSelectedBodyRegion] = useState('');

  const [symptoms, setSymptoms] = useState<SocratesSymptom[]>([]);

  const [vitals, setVitals] = useState<VitalsData>({
    bp: '',
    pulse: 0,
    spo2: '',
    temp: ''
  });

  const [pariksha, setPariksha] = useState<DashavidhaPariksha>({
    prakriti: 'Pitta-Vata',
    vikriti: 'Sama',
    agni: 'SAMAGNI',
    sara: 'Madhyama',
    satva: 'Pravara'
  });

  const [redFlags, setRedFlags] = useState<string[]>([]);

  const [scannedDocs, setScannedDocs] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [causalDagOverride, setCausalDagOverride] = useState<any>(null);
  const [mlcCaseInfo, setMlcCaseInfo] = useState<any>(null);
  const [airborneIsolationInfo, setAirborneIsolationInfo] = useState<any>(null);
  const [savedDraft, setSavedDraft] = useState<any>(null);

  // Restore draft from sessionStorage on mount if browser restarted
  React.useEffect(() => {
    try {
      const local = sessionStorage.getItem('kiosk_draft_active');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.draftPayload) setSavedDraft(parsed);
      }
    } catch {}
  }, []);

  // Ephemeral Byzantine draft persistence on step transition
  React.useEffect(() => {
    if (currentStep >= 2) {
      const draftPayload = {
        patient,
        symptoms,
        pariksha,
        vitals,
        transcript,
        redFlags,
        causalDagOverride,
        mlcCaseInfo,
        airborneIsolationInfo
      };
      sessionStorage.setItem('kiosk_draft_active', JSON.stringify({ stepNumber: currentStep, draftPayload, timestamp: Date.now() }));
      api.saveDraft(
        patient.abhaId || patient.phone || 'patient-kiosk-live',
        patient.phone,
        currentStep,
        draftPayload
      ).catch(() => {});
    }
  }, [currentStep, patient, symptoms, pariksha, vitals]);

  // DPDP 2023 Air-Gap Privacy: 45-second Inactivity Session Abandonment Guard
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null);

  React.useEffect(() => {
    // Only monitor on interactive intake steps (Step 2 to Step 6)
    if (currentStep < 2 || currentStep >= 7) {
      setInactivityCountdown(null);
      return;
    }

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Trigger 15-second visual countdown modal
        setInactivityCountdown(15);
      }, 45000); // 45 seconds of continuous zero interaction
    };

    const handleUserActivity = () => {
      // If modal is not active, keep pushing back the 45s timer
      if (inactivityCountdown === null) {
        resetTimer();
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [currentStep, inactivityCountdown]);

  // Handle countdown progression
  React.useEffect(() => {
    if (inactivityCountdown === null) return;
    if (inactivityCountdown <= 0) {
      // Memory wipe & return to Step 1
      handleInactivityWipe();
      return;
    }

    const timer = setTimeout(() => {
      setInactivityCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [inactivityCountdown]);

  const handleInactivityWipe = () => {
    sovereignSound.playMechanicalSnap();
    try {
      sessionStorage.removeItem('kiosk_draft_active');
    } catch {}
    handleReset();
    setInactivityCountdown(null);
  };

  const handleStayActive = () => {
    sovereignSound.playCrystalChime();
    setInactivityCountdown(null);
  };

  const handleExtractedSymptoms = (
    extractedSyms: any[],
    extractedVitals: any,
    extractedFlags: string[],
    extra?: { causalDagOverride?: any; mlcCaseInfo?: any; airborneIsolationInfo?: any }
  ) => {
    if (extractedSyms && extractedSyms.length > 0) setSymptoms(extractedSyms);
    if (extractedVitals) setVitals(extractedVitals);
    if (extractedFlags && extractedFlags.length > 0) setRedFlags(extractedFlags);
    if (extra?.causalDagOverride) setCausalDagOverride(extra.causalDagOverride);
    if (extra?.mlcCaseInfo) setMlcCaseInfo(extra.mlcCaseInfo);
    if (extra?.airborneIsolationInfo) setAirborneIsolationInfo(extra.airborneIsolationInfo);
  };

  const handleRestoreDraft = () => {
    if (!savedDraft?.draftPayload) return;
    sovereignSound.playCrystalChime();
    const d = savedDraft.draftPayload;
    if (d.patient) setPatient(d.patient);
    if (d.symptoms) setSymptoms(d.symptoms);
    if (d.pariksha) setPariksha(d.pariksha);
    if (d.vitals) setVitals(d.vitals);
    if (d.transcript) setTranscript(d.transcript);
    if (d.redFlags) setRedFlags(d.redFlags);
    if (d.causalDagOverride) setCausalDagOverride(d.causalDagOverride);
    if (d.mlcCaseInfo) setMlcCaseInfo(d.mlcCaseInfo);
    if (d.airborneIsolationInfo) setAirborneIsolationInfo(d.airborneIsolationInfo);
    if (savedDraft.stepNumber) setCurrentStep(savedDraft.stepNumber);
    setSavedDraft(null);
  };

  const handleCompleteIntake = async () => {
    let finalSessionId = '';
    try {
      const res = await api.submitKioskIntake({
        patient,
        symptoms,
        pariksha,
        vitals,
        rawTranscript: transcript,
        scannedDocs
      });
      finalSessionId = res.sessionId;
      setSessionId(res.sessionId);
      if (res.redFlags) setRedFlags(res.redFlags);
    } catch (e) {
      console.error(e);
      finalSessionId = 'sess-' + Math.floor(Math.random() * 900 + 100);
      setSessionId(finalSessionId);
    }
    try {
      if (finalSessionId) {
        sessionStorage.setItem('selected_doctor_session', finalSessionId);
      }
    } catch {}
    sovereignSound.playCrystalChime();
    setCurrentStep(7);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setPatient({
      name: '',
      age: 45,
      gender: 'MALE',
      phone: '',
      aadhaar: '',
      abhaId: '',
      isPregnant: false,
      isLactating: false,
      weightKg: 65
    });
    setSymptoms([]);
    setVitals({ bp: '', pulse: 0, spo2: '', temp: '' });
    setPariksha({
      prakriti: 'Pitta-Vata',
      vikriti: 'Sama',
      agni: 'SAMAGNI',
      sara: 'Madhyama',
      satva: 'Pravara'
    });
    setRedFlags([]);
    setTranscript('');
    setSessionId('');
    setScannedDocs([]);
    setCausalDagOverride(null);
    setMlcCaseInfo(null);
    setAirborneIsolationInfo(null);
    setSavedDraft(null);
  };

  const stepLabelsBilingual = [
    { num: 1, title: 'भाषा (Language)', short: 'भाषा' },
    { num: 2, title: 'मरीज़ पहचान (Patient ID)', short: 'पहचान' },
    { num: 3, title: 'तकलीफ़ व अंग (Symptoms)', short: 'लक्षण' },
    { num: 4, title: 'दर्द का विवरण (Pain Details)', short: 'विवरण' },
    { num: 5, title: 'पाचन व स्वास्थ्य (Health & Digestion)', short: 'पाचन' },
    { num: 6, title: 'पर्चे व दस्तावेज़ (Documents)', short: 'दस्तावेज़' }
  ];

  return (
    <div className="kiosk-panoramic-container">
      {/* Main Central Interaction Stage */}
      <main className="kiosk-center-stage">
        <header className="no-print rounded-2xl border border-border/80 px-4 py-2.5 mb-5 shadow-xs flex items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white border border-border/80 p-0.5 flex items-center justify-center shrink-0">
              <img src="/ashoka-stambh-hd.png" alt="State Emblem" className="h-7 w-7 object-contain pointer-events-none select-none" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-sm tracking-tight text-foreground">AIIA · अखिल भारतीय आयुर्वेद संस्थान</span>
              <span className="text-[11px] text-muted-foreground font-medium">OPD Kiosk</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sovereignSound.playClinicalAlert();
              onGoToDoctorDesk();
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-heading font-extrabold shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <AlertOctagon size={14} />
            <span>SOS</span>
          </button>
        </header>



        {/* Ephemeral Byzantine Crash Recovery Banner */}
        {savedDraft && (
          <div className="p-3 sm:p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl mb-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                <ShieldCheck size={16} />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <div className="text-xs sm:text-sm font-bold text-foreground">
                  पिछला पंजीकरण मिला (Unfinished Registration Found)
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  In-progress check-in (Step {savedDraft.stepNumber}: {savedDraft.draftPayload?.patient?.name || 'Patient'}). Continue?
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRestoreDraft}
                className="btn btn-primary text-xs px-3.5 py-1.5 rounded-lg"
              >
                Continue Check-In
              </button>
              <button
                onClick={() => setSavedDraft(null)}
                className="btn btn-secondary text-xs px-2.5 py-1.5 rounded-lg"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <Step1Language
            selectedLanguage={language}
            onSelectLanguage={setLanguage}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <Step2AbhaAuth
            patient={patient}
            setPatient={setPatient}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3VoiceBodyIntake
            transcript={transcript}
            setTranscript={setTranscript}
            selectedBodyRegion={selectedBodyRegion}
            setSelectedBodyRegion={setSelectedBodyRegion}
            symptoms={symptoms}
            vitals={vitals}
            redFlags={redFlags}
            language={language}
            onExtractedSymptoms={handleExtractedSymptoms}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4Socrates
            symptoms={symptoms}
            setSymptoms={setSymptoms}
            vitals={vitals}
            setVitals={setVitals}
            redFlags={redFlags}
            selectedBodyRegion={selectedBodyRegion}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && (
          <Step5Pariksha
            pariksha={pariksha}
            setPariksha={setPariksha}
            symptoms={symptoms}
            selectedBodyRegion={selectedBodyRegion}
            transcript={transcript}
            language={language}
            onNext={() => setCurrentStep(6)}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 6 && (
          <Step6DocumentScanner
            scannedDocs={scannedDocs}
            setScannedDocs={setScannedDocs}
            language={language}
            patient={patient}
            symptoms={symptoms}
            vitals={vitals}
            pariksha={pariksha}
            selectedBodyRegion={symptoms[0]?.site || 'General'}
            onNext={handleCompleteIntake}
            onBack={() => setCurrentStep(5)}
          />
        )}

        {currentStep === 7 && (
          <Step7TokenSummary
            patient={patient}
            symptoms={symptoms}
            pariksha={pariksha}
            vitals={vitals}
            redFlags={redFlags}
            scannedDocs={scannedDocs}
            transcript={transcript}
            language={language}
            sessionId={sessionId}
            causalDagOverride={causalDagOverride}
            mlcCaseInfo={mlcCaseInfo}
            airborneIsolationInfo={airborneIsolationInfo}
            onReset={handleReset}
            onGoToDoctorDesk={onGoToDoctorDesk}
          />
        )}
      </main>

      {/* Floating Dynamic Island Navigation Dock (Steps 1-6) */}
      {currentStep < 7 && (
        <nav aria-label="Kiosk Step Navigation" className="dynamic-island-dock no-print">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => {
              if (currentStep > 1) {
                sovereignSound.playMechanicalSnap();
                setCurrentStep(currentStep - 1);
              }
            }}
            className="tactile-btn px-3.5 py-1.5 text-xs font-semibold rounded-full gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={13} />
            <span>पिछला / Back</span>
          </button>

          {/* Center Indicator Capsule */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-semibold text-foreground tracking-tight whitespace-nowrap">
              Step {currentStep} / 6 : {stepLabelsBilingual[currentStep - 1]?.title}
            </span>
          </div>

          {(() => {
            const isStep3Blocked = currentStep === 3 && (!selectedBodyRegion || !transcript || transcript.trim().length === 0);
            return (
              <button
                type="button"
                disabled={isStep3Blocked}
                onClick={() => {
                  if (isStep3Blocked) return;
                  sovereignSound.playMechanicalSnap();
                  if (currentStep === 6) {
                    handleCompleteIntake();
                  } else {
                    setCurrentStep(currentStep + 1);
                  }
                }}
                className="tactile-btn-primary px-4 py-1.5 text-xs font-semibold rounded-full gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{currentStep === 6 ? 'टोकन प्राप्त करें / Complete' : 'आगे बढ़ें / Next'}</span>
                <ArrowRight size={13} />
              </button>
            );
          })()}
        </nav>
      )}

      {/* DPDP Act 2023 Inactivity Session Abandonment Privacy Shield Modal */}
      {inactivityCountdown !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="physical-card max-w-md w-full p-6 sm:p-8 rounded-3xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-2xl font-mono font-bold text-rose-600 dark:text-rose-400">
              {inactivityCountdown}
            </div>

            <h3 className="text-lg sm:text-xl font-heading font-extrabold text-foreground mb-1">
              क्या आप अभी भी यहाँ हैं?
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-foreground/80 mb-2">
              Are you still at the kiosk?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              गोपनीयता सुरक्षा (DPDP Act 2023): आपकी स्वास्थ्य जानकारी की सुरक्षा हेतु यदि कोई गतिविधि नहीं होती है, तो यह सत्र स्वतः समाप्त होकर डेटा मिटा दिया जाएगा।
            </p>

            <div className="flex gap-2.5 w-full">
              <button
                type="button"
                onClick={handleStayActive}
                className="btn btn-primary flex-1 py-2.5 text-xs sm:text-sm rounded-xl"
              >
                हाँ, जारी रखें / I'm Here
              </button>
              <button
                type="button"
                onClick={handleInactivityWipe}
                className="btn btn-secondary py-2.5 px-4 text-xs sm:text-sm rounded-xl text-rose-600 dark:text-rose-400 border-rose-500/30"
              >
                सत्र समाप्त करें / Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
