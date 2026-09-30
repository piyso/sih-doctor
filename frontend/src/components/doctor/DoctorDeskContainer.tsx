import React, { useState, useEffect } from 'react';
import { PatientQueueList } from './PatientQueueList';
import { PreIntakePanel } from './PreIntakePanel';
import { AmbientScribePanel } from './AmbientScribePanel';
import { DualPharmacologyPrescriber } from './DualPharmacologyPrescriber';
import { OfficialAiiaRxModal } from './OfficialAiiaRxModal';
import { EmergencyBanner } from '../common/EmergencyBanner';
import { PatientQueueItem, SessionDetail, AllopathicMedication, AyushFormulation } from '../../types/api';
import { api } from '../../services/api';
import { Users, Stethoscope, AlertOctagon, Printer, FileText, Sparkles, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { cn } from '@/lib/utils';

export const DoctorDeskContainer: React.FC = () => {
  const [queue, setQueue] = useState<PatientQueueItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'queue' | 'intake' | 'workspace'>('workspace');

  const [allopathicMeds, setAllopathicMeds] = useState<AllopathicMedication[]>([]);
  const [ayushFormulations, setAyushFormulations] = useState<AyushFormulation[]>([]);

  const loadQueue = async () => {
    const q = await api.getQueue();
    setQueue(q);
    if (q.length > 0) {
      const handoffSessionId = sessionStorage.getItem('selected_doctor_session');
      if (handoffSessionId) {
        const target = q.find(item => item.sessionId === handoffSessionId);
        if (target) {
          sessionStorage.removeItem('selected_doctor_session');
          handleSelectPatient(target);
          return;
        }
      }
      if (!selectedSessionId || !q.some(item => item.sessionId === selectedSessionId)) {
        handleSelectPatient(q[0]);
      }
    } else {
      setSelectedSessionId(null);
      setCurrentSession(null);
      setAllopathicMeds([]);
      setAyushFormulations([]);
    }
  };

  const handleSelectPatient = async (item: PatientQueueItem) => {
    setSelectedSessionId(item.sessionId);
    const detail = await api.getSessionDetail(item.sessionId);
    setCurrentSession(detail);
    setMobileTab('intake'); // Auto-switch to intake & vitals on mobile screens

    // Load real prescriptions: from existing finalized SQLite encounter or scanned prior documents
    if (detail?.existingEncounter) {
      setAllopathicMeds(detail.existingEncounter.allopathicPrescription || []);
      setAyushFormulations(detail.existingEncounter.ayushPrescription || []);
    } else {
      const docs = detail?.scannedDocs || [];
      const extractedMedsFromDocs: any[] = [];
      for (const d of docs) {
        if (Array.isArray(d.extractedMedications)) {
          extractedMedsFromDocs.push(...d.extractedMedications);
        }
      }
      if (extractedMedsFromDocs.length > 0) {
        setAllopathicMeds(extractedMedsFromDocs.map(m => ({
          name: typeof m === 'string' ? m : (m.name || m.genericName || 'Prescribed Med'),
          dosage: m.dosage || 'Standard',
          route: 'ORAL',
          frequency: m.frequency || 'OD',
          durationDays: m.durationDays || 30
        })));
        setAyushFormulations([]);
      } else {
        setAllopathicMeds([]);
        setAyushFormulations([]);
      }
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleNextPatient = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(q => q.sessionId === selectedSessionId);
    const nextIndex = (currentIndex + 1) % queue.length;
    handleSelectPatient(queue[nextIndex]);
    sovereignSound.playDialNotch();
  };

  const handlePrevPatient = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(q => q.sessionId === selectedSessionId);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    handleSelectPatient(queue[prevIndex]);
    sovereignSound.playDialNotch();
  };

  const handleAutoExtractFromScribe = async (transcriptText?: string) => {
    try {
      sovereignSound.playCrystalChime();
      const textToParse = transcriptText && transcriptText.trim().length > 0 ? transcriptText : 'Patient reported clinical symptoms';
      const parsed = await api.parseAudioTranscript(textToParse, selectedSessionId || undefined);
      if (parsed) {
        if (parsed.medications && parsed.medications.length > 0) {
          setAllopathicMeds((prev) => {
            const next = [...prev];
            for (const item of parsed.medications) {
              const m = item as any;
              const medObj: AllopathicMedication = {
                name: typeof m === 'string' ? m : (m.drugName || m.name || m.genericName || 'Prescribed Med'),
                dosage: typeof m === 'object' && m.dosage ? m.dosage : 'Standard',
                route: typeof m === 'object' && m.route ? m.route : 'ORAL',
                frequency: typeof m === 'object' && m.frequency ? m.frequency : 'OD',
                durationDays: typeof m === 'object' && m.durationDays ? m.durationDays : (typeof m === 'object' && m.duration ? parseInt(m.duration) || 30 : 30)
              };
              if (!next.some(existing => existing.name.toLowerCase() === medObj.name.toLowerCase())) {
                next.push(medObj);
              }
            }
            return next;
          });
        }
        if (parsed.ayushPrescriptions && parsed.ayushPrescriptions.length > 0) {
          setAyushFormulations((prev) => {
            const next = [...prev];
            for (const item of parsed.ayushPrescriptions) {
              const a = item as any;
              const ayushObj: AyushFormulation = {
                classicalName: typeof a === 'string' ? a : (a.formulationName || a.classicalName || a.name || 'Ayurvedic Compound'),
                dosageForm: typeof a === 'object' && (a.dosageForm || a.category) ? (a.dosageForm || a.category) : 'Vati',
                dose: typeof a === 'object' && (a.dose || a.dosage) ? (a.dose || a.dosage) : '1 Tab',
                anupana: typeof a === 'object' && a.anupana ? a.anupana : 'Warm Water',
                frequency: typeof a === 'object' && a.frequency ? a.frequency : 'OD',
                durationDays: typeof a === 'object' && a.durationDays ? a.durationDays : (typeof a === 'object' && a.duration ? parseInt(a.duration) || 30 : 30)
              };
              if (!next.some(existing => existing.classicalName.toLowerCase() === ayushObj.classicalName.toLowerCase())) {
                next.push(ayushObj);
              }
            }
            return next;
          });
        }
      }
    } catch (e) {
      console.warn('Auto-extract transcript error:', e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      // Space = Finalize Rx
      if (e.code === 'Space' && !isRxModalOpen) {
        e.preventDefault();
        sovereignSound.playMechanicalSnap();
        setIsRxModalOpen(true);
      } else if (e.key === '[') {
        e.preventDefault();
        handlePrevPatient();
      } else if (e.key === ']') {
        e.preventDefault();
        handleNextPatient();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRxModalOpen, queue, selectedSessionId]);

  return (
    <div className={`main-wrapper doctor-desk-container show-${mobileTab}`}>
      {currentSession && currentSession.triagePriority === 'EMERGENCY_RED_FLAG' && (
        <EmergencyBanner
          redFlags={currentSession.redFlags}
          patientName={currentSession.patientName}
        />
      )}

      {/* Dedicated Doctor Chamber Bar - Sovereign Clean */}
      <div 
        className="no-print glass rounded-2xl border border-border/70 p-3.5 sm:px-5 mb-5 shadow-xs flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand border border-brand/20 flex items-center justify-center shrink-0">
            <Stethoscope size={18} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-bold text-sm tracking-tight text-foreground">
              Dr. Ananya Sharma, MD
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-sans">
              Room 14 (General Medicine)
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-muted border border-border/60 text-muted-foreground">
              DMC-98421
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span><strong className="text-foreground">{queue.length}</strong> in queue</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <button
              onClick={handlePrevPatient}
              title="Previous Patient (Shortcut: [ )"
              className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 border border-border/60 text-xs font-medium text-foreground transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              <span>[</span>
            </button>
            <button
              onClick={handleNextPatient}
              title="Next Patient (Shortcut: ] )"
              className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 border border-border/60 text-xs font-medium text-foreground transition-colors flex items-center gap-1"
            >
              <span>]</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Adaptive View Switcher (<=1024px) */}
      <div className="mobile-desk-toggle">
        <button
          type="button"
          className={mobileTab === 'queue' ? 'active' : ''}
          onClick={() => {
            sovereignSound.playDialNotch();
            setMobileTab('queue');
          }}
        >
          <Users size={13} />
          <span>Queue ({queue.length})</span>
        </button>
        <button
          type="button"
          className={mobileTab === 'intake' ? 'active' : ''}
          onClick={() => {
            sovereignSound.playDialNotch();
            setMobileTab('intake');
          }}
        >
          <Activity size={13} />
          <span>Intake & Vitals</span>
        </button>
        <button
          type="button"
          className={mobileTab === 'workspace' ? 'active' : ''}
          onClick={() => {
            sovereignSound.playDialNotch();
            setMobileTab('workspace');
          }}
        >
          <Stethoscope size={13} />
          <span>Prescribe & Notes</span>
        </button>
      </div>

      {/* Main Responsive 3-Column Grid Layout */}
      <div className="doctor-desk-grid">
        {/* Column 1: Left Sidebar Queue */}
        <div className="doctor-desk-sidebar">
          <PatientQueueList
            queue={queue}
            selectedSessionId={selectedSessionId}
            onSelectPatient={handleSelectPatient}
            onRefresh={loadQueue}
          />
        </div>

        {/* Column 2: Pre-Intake Anamnesis & Vitals */}
        <div className="doctor-desk-preintake">
          <PreIntakePanel session={currentSession} />
        </div>

        {/* Column 3: Live Clinical Studio (Scribe + Dual-Pharmacology Rx) */}
        <div className="doctor-desk-workspace">
          {/* Ambient Audio Scribe */}
          <AmbientScribePanel onAutoExtract={handleAutoExtractFromScribe} />

          {/* Dual-Pharmacology Rx Prescriber */}
          <DualPharmacologyPrescriber
            allopathicMeds={allopathicMeds}
            setAllopathicMeds={setAllopathicMeds}
            ayushFormulations={ayushFormulations}
            setAyushFormulations={setAyushFormulations}
            sessionId={selectedSessionId || ''}
            session={currentSession}
            onOpenRxModal={() => setIsRxModalOpen(true)}
          />
        </div>
      </div>

      {/* Persistent Bottom Action Dock (1-Click Space Execution) */}
      <aside 
        aria-label="Clinical Action Dock" 
        className="doctor-persistent-dock no-print fixed bottom-5 right-6 z-40 glass border border-border/80 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-3 animate-fade-in"
      >
        <div className="flex items-center gap-2.5">
          <Activity size={14} className={currentSession?.triagePriority === 'EMERGENCY_RED_FLAG' ? "text-rose-500 shrink-0" : "text-primary shrink-0"} />
          <span className="text-sm font-bold font-sans text-foreground">
            {currentSession ? currentSession.patientName : 'No Patient Selected'}
          </span>
          {currentSession && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted border border-border/60 text-muted-foreground">
              Token #{(currentSession as any).queuePosition || currentSession.sessionId}
            </span>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <div className="w-px h-5 bg-border/80" />

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px] text-foreground font-semibold">
              Space
            </kbd>
            <span>Finalize Rx</span>
          </div>
        </div>

        {/* Mobile-Adaptive or Desktop Primary Action Button */}
        {mobileTab === 'intake' ? (
          <button
            onClick={() => {
              sovereignSound.playDialNotch();
              setMobileTab('workspace');
            }}
            className="btn btn-primary"
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              gap: 5
            }}
          >
            <span>Proceed to Prescribe</span>
            <ChevronRight size={13} />
          </button>
        ) : mobileTab === 'queue' ? (
          <button
            onClick={() => {
              sovereignSound.playDialNotch();
              setMobileTab('intake');
            }}
            className="btn btn-primary"
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              gap: 5
            }}
          >
            <span>View Intake</span>
            <ChevronRight size={13} />
          </button>
        ) : (
          <button
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setIsRxModalOpen(true);
            }}
            className="btn btn-primary"
            style={{
              padding: '7px 18px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              gap: 6
            }}
          >
            <Printer size={13} />
            <span>Finalize & Print Rx</span>
          </button>
        )}
      </aside>

      {/* Official Government of India & AIIA Prescription Modal */}
      <OfficialAiiaRxModal
        isOpen={isRxModalOpen}
        onClose={() => setIsRxModalOpen(false)}
        session={currentSession}
        allopathicMeds={allopathicMeds}
        ayushFormulations={ayushFormulations}
        onFinalize={() => {
          setIsRxModalOpen(false);
          loadQueue();
        }}
      />
    </div>
  );
};
