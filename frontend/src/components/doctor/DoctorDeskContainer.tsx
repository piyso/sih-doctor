import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PatientQueueList } from './PatientQueueList';
import { PreIntakePanel } from './PreIntakePanel';
import { AmbientScribePanel } from './AmbientScribePanel';
import { DualPharmacologyPrescriber } from './DualPharmacologyPrescriber';
import { OfficialAiiaRxModal } from './OfficialAiiaRxModal';
import { EmergencyBanner } from '../common/EmergencyBanner';
import { PatientQueueItem, SessionDetail, AllopathicMedication, AyushFormulation, VitalsData } from '../../types/api';
import { api } from '../../services/api';
import { Users, Stethoscope, Printer, CheckCircle2, ChevronLeft, ChevronRight, Activity, Leaf, Pill, X, Megaphone, UserX, Siren, FileText } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { DOCTOR_PROFILES, departmentName, roomLabel, DepartmentCode, DEPARTMENTS } from '../../utils/hospitalDirectory';
import { DoctorRole, RxDraft, emptyRxDraft, loadDoctorRole, saveDoctorRole } from './doctorRole';
import { useStaffUser } from '../auth/StaffGate';
import { SoapNoteModal } from './SoapNoteModal';

/** Patients a doctor of this role should see (their stream, undecided, and every emergency). */
export const isPatientForRole = (item: Pick<PatientQueueItem, 'careStream' | 'triagePriority'>, role: DoctorRole) =>
  item.triagePriority === 'EMERGENCY_RED_FLAG' || !item.careStream || item.careStream === 'UNDECIDED' || item.careStream === role;

export const DoctorDeskContainer: React.FC = () => {
  const user = useStaffUser();
  // A doctor always works as modern medicine and a vaidya as Ayurveda; nurses and admins may view either.
  const fixedRole: DoctorRole | null = user?.role === 'vaidya' ? 'AYURVEDA' : user?.role === 'doctor' ? 'ALLOPATHY' : null;
  const canPrescribe = user?.role === 'doctor' || user?.role === 'vaidya';
  const [chosenRole, setRole] = useState<DoctorRole>(loadDoctorRole);
  const role: DoctorRole = fixedRole || chosenRole;
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [soapOpen, setSoapOpen] = useState(false);
  const [scribeText, setScribeText] = useState('');
  const [showAllStreams, setShowAllStreams] = useState(false);
  const [queue, setQueue] = useState<PatientQueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'queue' | 'intake' | 'workspace'>('queue');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [divertedIds, setDivertedIds] = useState<string[]>([]);
  // Below 1025 px the desk shows one column at a time (tabs); above it shows all three.
  const [isWide, setIsWide] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth > 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prescription drafts are kept per patient, so switching patients (or the 3.5 s queue refresh)
  // never throws away what the doctor has written.
  const draftsRef = useRef<Record<string, RxDraft>>({});
  const [draft, setDraft] = useState<RxDraft>(emptyRxDraft);
  const selectedRef = useRef<string | null>(null);
  const demoRestoreTriedRef = useRef(false);

  const updateDraft = useCallback((patch: Partial<RxDraft> | ((d: RxDraft) => Partial<RxDraft>)) => {
    setDraft(prev => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      if (selectedRef.current) draftsRef.current[selectedRef.current] = next;
      return next;
    });
  }, []);

  const setAllopathicMeds: React.Dispatch<React.SetStateAction<AllopathicMedication[]>> = useCallback(
    value => updateDraft(d => ({ allopathic: typeof value === 'function' ? (value as any)(d.allopathic) : value })),
    [updateDraft]
  );
  const setAyushFormulations: React.Dispatch<React.SetStateAction<AyushFormulation[]>> = useCallback(
    value => updateDraft(d => ({ ayush: typeof value === 'function' ? (value as any)(d.ayush) : value })),
    [updateDraft]
  );

  const visibleQueue = useMemo(
    () => (showAllStreams ? queue : queue.filter(item => isPatientForRole(item, role))),
    [queue, role, showAllStreams]
  );

  const selectPatient = useCallback(async (item: PatientQueueItem | null, isExplicitUserClick = false) => {
    if (!item) {
      selectedRef.current = null;
      setSelectedSessionId(null);
      setCurrentSession(null);
      setDraft(emptyRxDraft());
      return;
    }
    selectedRef.current = item.sessionId;
    setSelectedSessionId(item.sessionId);
    setDraft(draftsRef.current[item.sessionId] || emptyRxDraft());
    if (isExplicitUserClick && typeof window !== 'undefined' && window.innerWidth <= 1024) setMobileTab('intake');

    const detail = await api.getSessionDetail(item.sessionId);
    if (selectedRef.current !== item.sessionId) return; // the doctor already moved on
    setCurrentSession(detail);

    // First time this patient is opened: start from an earlier finalized encounter, or from the
    // medicines found on the documents they scanned at the kiosk.
    if (!draftsRef.current[item.sessionId] && detail) {
      const initial = emptyRxDraft();
      if (detail.existingEncounter) {
        initial.allopathic = detail.existingEncounter.allopathicPrescription || [];
        initial.ayush = detail.existingEncounter.ayushPrescription || [];
        initial.pathya = detail.existingEncounter.pathya || [];
        initial.apathya = detail.existingEncounter.apathya || [];
        initial.advice = detail.existingEncounter.advice || '';
      } else {
        const meds = (detail.scannedDocs || []).flatMap((d: any) => (Array.isArray(d.extractedMedications) ? d.extractedMedications : []));
        initial.allopathic = meds.map((m: any) => ({
          name: typeof m === 'string' ? m : m.name || m.genericName || 'Medicine from previous prescription',
          dosage: m.dosage || '',
          route: 'ORAL',
          frequency: m.frequency || '',
          durationDays: m.durationDays || 0,
          instructions: 'From previous prescription — review'
        }));
      }
      draftsRef.current[item.sessionId] = initial;
      setDraft(initial);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    const { items, online: isOnline } = await api.getQueueStatus();
    setOnline(isOnline);
    setQueueLoaded(true);

    // Empty waiting room on first open: put the demo patients back (never deletes real records).
    if (isOnline && items.length === 0 && !demoRestoreTriedRef.current) {
      demoRestoreTriedRef.current = true;
      if ((await api.restoreDemoQueue()) > 0) {
        const again = await api.getQueueStatus();
        setQueue(again.items);
        return;
      }
    }
    demoRestoreTriedRef.current = true;
    setQueue(items);
  }, []);

  // Keep the selection valid when the queue or the role filter changes.
  useEffect(() => {
    if (!queueLoaded) return;
    const handoff = (() => { try { return sessionStorage.getItem('selected_doctor_session'); } catch { return null; } })();
    if (handoff) {
      const target = queue.find(item => item.sessionId === handoff);
      if (target) {
        try { sessionStorage.removeItem('selected_doctor_session'); } catch {}
        if (selectedRef.current !== target.sessionId) selectPatient(target, true);
        return;
      }
    }
    const current = selectedRef.current;
    if (current && visibleQueue.some(item => item.sessionId === current)) return;
    selectPatient(visibleQueue[0] || null);
  }, [queue, visibleQueue, queueLoaded, selectPatient]);

  const loadAlerts = useCallback(() => {
    api.getAlerts().then(a => setSosAlerts(a.filter((x: any) => !x.resolvedAt))).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
    loadAlerts();
    // Live updates arrive over the event stream; the poll is only a safety net.
    const interval = setInterval(() => { loadQueue(); loadAlerts(); }, 15000);
    const stop = api.subscribeStaffEvents(e => {
      if (e.type === 'queue.changed') loadQueue();
      if (e.type === 'sos.raised') {
        try { sovereignSound.playEmergencyCodeRed(); } catch {}
        loadAlerts();
      }
      if (e.type === 'sos.updated') loadAlerts();
    });
    const handleSync = () => loadQueue();
    window.addEventListener('focus', handleSync);
    window.addEventListener('kiosk_patient_registered', handleSync);
    return () => {
      clearInterval(interval);
      stop();
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('kiosk_patient_registered', handleSync);
    };
  }, [loadQueue, loadAlerts]);

  const changeRole = (next: DoctorRole) => {
    sovereignSound.playMechanicalSnap();
    setRole(next);
    saveDoctorRole(next);
  };

  const stepPatient = (direction: 1 | -1) => {
    if (visibleQueue.length === 0) return;
    const idx = visibleQueue.findIndex(q => q.sessionId === selectedSessionId);
    const next = visibleQueue[(idx + direction + visibleQueue.length) % visibleQueue.length];
    selectPatient(next, true);
    sovereignSound.playDialNotch();
  };

  const handleSaveVitals = async (vitals: VitalsData) => {
    if (!currentSession) return false;
    const ok = await api.updateSessionVitals(currentSession.sessionId, vitals);
    if (ok) {
      setCurrentSession(prev => (prev ? { ...prev, vitals: { ...prev.vitals, ...vitals } } : prev));
      setQueue(prev => prev.map(q => (q.sessionId === currentSession.sessionId ? { ...q, vitals: { ...q.vitals, ...vitals } } : q)));
    }
    return ok;
  };

  const handleCallPatient = async () => {
    if (!currentSession) return;
    try {
      const r = await api.callPatient(currentSession.sessionId);
      sovereignSound.playCrystalChime();
      setNotice({ tone: 'success', text: `Token ${r.tokenNo} called to Room ${r.room}${r.callCount > 1 ? ` (call ${r.callCount})` : ''}. It is shown and announced on the waiting-room screen.` });
      loadQueue();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.message || 'Could not call the patient.' });
    }
  };

  const handleNoShow = async () => {
    if (!currentSession) return;
    if (!window.confirm(`Mark ${currentSession.patientName} as not present? They leave the queue (they can check in again).`)) return;
    try {
      await api.markNoShow(currentSession.sessionId);
      setNotice({ tone: 'success', text: `${currentSession.patientName} was marked as not present.` });
      loadQueue();
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.message || 'Could not update the queue.' });
    }
  };

  const handleSendToEmergency = async () => {
    if (!currentSession) return;
    const ok = await api.updateSessionStatus(currentSession.sessionId, 'DIVERTED_EMERGENCY');
    if (ok) {
      setDivertedIds(prev => [...prev, currentSession.sessionId]);
      setNotice({ tone: 'success', text: `${currentSession.patientName} has been sent to the Emergency Room.` });
      loadQueue();
    } else {
      setNotice({ tone: 'error', text: 'Could not update the patient status — the hospital server is not reachable.' });
    }
  };

  const handleAutoExtractFromScribe = async (transcriptText?: string) => {
    const text = (transcriptText || '').trim();
    if (!text) {
      setNotice({ tone: 'error', text: 'The scribe transcript is empty — record or type the consultation first.' });
      return;
    }
    try {
      sovereignSound.playCrystalChime();
      const parsed = await api.parseAudioTranscript(text, selectedSessionId || undefined);
      const meds = parsed.medications || [];
      const ayush = parsed.ayushPrescriptions || [];
      if (meds.length === 0 && ayush.length === 0) {
        setNotice({ tone: 'error', text: 'No medicines were recognised in the transcript.' });
        return;
      }
      updateDraft(d => {
        const allopathic = [...d.allopathic];
        for (const m of meds as any[]) {
          const name = typeof m === 'string' ? m : m.drugName || m.name || m.genericName;
          if (!name || allopathic.some(e => e.name.toLowerCase() === name.toLowerCase())) continue;
          allopathic.push({ name, dosage: m.dosage || '', route: m.route || 'ORAL', frequency: m.frequency || '', durationDays: m.durationDays || parseInt(m.duration, 10) || 0 });
        }
        const ayushList = [...d.ayush];
        for (const a of ayush as any[]) {
          const name = typeof a === 'string' ? a : a.formulationName || a.classicalName || a.name;
          if (!name || ayushList.some(e => e.classicalName.toLowerCase() === name.toLowerCase())) continue;
          ayushList.push({ classicalName: name, dosageForm: a.dosageForm || a.category || '', dose: a.dose || a.dosage || '', anupana: a.anupana || '', frequency: a.frequency || '', durationDays: a.durationDays || parseInt(a.duration, 10) || 0 });
        }
        return { allopathic, ayush: ayushList };
      });
    } catch (e) {
      console.warn('Auto-extract transcript error:', e);
      setNotice({ tone: 'error', text: 'The transcript could not be analysed — the hospital server is not reachable.' });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (e.code === 'Space' && !isRxModalOpen && currentSession && canPrescribe) {
        e.preventDefault();
        setIsRxModalOpen(true);
      } else if (e.key === '[') {
        e.preventDefault();
        stepPatient(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        stepPatient(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const fallbackProfile = DOCTOR_PROFILES[role];
  const userDept = user?.department && (user.department in DEPARTMENTS) ? (user.department as DepartmentCode) : fallbackProfile.department;
  const profile = canPrescribe && user
    ? { name: user.displayName, title: user.qualification || '', registration: user.registrationNo || 'Registration not set', department: userDept }
    : { ...fallbackProfile, name: `${user?.displayName || 'Staff'} (viewing ${role === 'AYURVEDA' ? 'Ayurveda' : 'modern medicine'} queue)`, title: canPrescribe ? fallbackProfile.title : 'cannot prescribe' };
  const isEmergency = currentSession?.triagePriority === 'EMERGENCY_RED_FLAG';
  const selectedQueueItem = queue.find(q => q.sessionId === selectedSessionId);

  return (
    <div className={`main-wrapper doctor-desk-container show-${mobileTab}`}>
      {sosAlerts.length > 0 && (
        <div className="no-print mb-4 p-3 rounded-2xl border-2 border-rose-600 bg-rose-500/10 flex items-center justify-between gap-3 flex-wrap" role="alert">
          <div className="flex items-center gap-2.5 text-sm font-bold text-rose-800 dark:text-rose-200 min-w-0">
            <Siren size={18} className="shrink-0" />
            <span className="truncate">SOS: {sosAlerts[0].message}{sosAlerts[0].location ? ` — ${sosAlerts[0].location}` : ''}{sosAlerts.length > 1 ? ` (+${sosAlerts.length - 1} more)` : ''}</span>
          </div>
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">{sosAlerts[0].acknowledgedAt ? `${sosAlerts[0].acknowledgedBy} is attending` : 'Not yet acknowledged — nurse station alerted'}</span>
        </div>
      )}
      {currentSession && isEmergency && (
        <EmergencyBanner
          redFlags={currentSession.redFlags}
          patientName={currentSession.patientName}
          onDivertClick={handleSendToEmergency}
          isDiverted={divertedIds.includes(currentSession.sessionId) || currentSession.status === 'DIVERTED_EMERGENCY'}
        />
      )}

      {notice && (
        <div className={`no-print p-3.5 rounded-2xl mb-4 flex items-center justify-between gap-3 border ${notice.tone === 'success' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-rose-500/10 border-rose-500/50'}`} role="status">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <CheckCircle2 size={17} className={notice.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Doctor header: who is consulting and which kind of practice */}
      <div className="no-print glass rounded-2xl border border-border/70 p-3.5 sm:px-5 mb-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${role === 'AYURVEDA' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-sky-500/10 text-sky-700 border-sky-500/30'}`}>
            {role === 'AYURVEDA' ? <Leaf size={18} /> : <Stethoscope size={18} />}
          </div>
          <div className="min-w-0">
            <div className="font-heading font-bold text-sm text-foreground truncate">{profile.name} · <span className="font-medium text-muted-foreground">{profile.title}</span></div>
            <div className="text-xs text-muted-foreground truncate">
              {roomLabel(profile.department, 'en')} · {departmentName(profile.department, 'en')} · {profile.registration}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!fixedRole && <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/70" role="radiogroup" aria-label="Doctor type">
            {([
              { id: 'AYURVEDA', label: 'Ayurveda (Vaidya)', icon: Leaf },
              { id: 'ALLOPATHY', label: 'Modern medicine', icon: Pill }
            ] as const).map(opt => {
              const Icon = opt.icon;
              const active = role === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => changeRole(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${active ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon size={13} />
                  {opt.label}
                </button>
              );
            })}
          </div>}
          {currentSession && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={handleCallPatient} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5" title="Show and announce this token on the waiting-room screen">
                <Megaphone size={13} /> {selectedQueueItem?.calledAt ? 'Call again' : 'Call to room'}{selectedQueueItem?.tokenNo ? ` · ${selectedQueueItem.tokenNo}` : ''}
              </button>
              <button type="button" onClick={handleNoShow} className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5" title="Patient did not come when called">
                <UserX size={13} /> Not present
              </button>
            </div>
          )}
          <span className="text-xs font-mono text-muted-foreground"><strong className="text-foreground">{visibleQueue.length}</strong> waiting</span>
          <div className="flex items-center gap-1 font-mono">
            <button onClick={() => stepPatient(-1)} title="Previous patient ( [ )" className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 border border-border/60 text-xs font-medium flex items-center gap-1">
              <ChevronLeft size={13} /><span>[</span>
            </button>
            <button onClick={() => stepPatient(1)} title="Next patient ( ] )" className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 border border-border/60 text-xs font-medium flex items-center gap-1">
              <span>]</span><ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tablet / phone tabs */}
      <div className="mobile-desk-toggle">
        {([
          { id: 'queue', label: `Queue (${visibleQueue.length})`, icon: Users },
          { id: 'intake', label: 'Intake & vitals', icon: Activity },
          { id: 'workspace', label: 'Prescribe', icon: Stethoscope }
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={mobileTab === tab.id ? 'active' : ''} onClick={() => { sovereignSound.playDialNotch(); setMobileTab(tab.id); }}>
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="doctor-desk-grid">
        <div className="doctor-desk-sidebar">
          <PatientQueueList
            queue={visibleQueue}
            totalCount={queue.length}
            selectedSessionId={selectedSessionId}
            onSelectPatient={item => selectPatient(item, true)}
            onRefresh={loadQueue}
            online={online}
            loaded={queueLoaded}
            role={role}
            showAllStreams={showAllStreams}
            onToggleShowAll={() => setShowAllStreams(v => !v)}
            onLoadDemo={async () => {
              const n = await api.restoreDemoQueue();
              setNotice(n > 0 ? { tone: 'success', text: `${n} demo patients added to the queue.` } : { tone: 'error', text: 'Demo patients could not be added.' });
              loadQueue();
            }}
          />
        </div>

        <div className="doctor-desk-preintake">
          <PreIntakePanel session={currentSession} role={role} onSaveVitals={handleSaveVitals} />
        </div>

        <div className="doctor-desk-workspace">
          <AmbientScribePanel onAutoExtract={handleAutoExtractFromScribe} onTranscriptChange={setScribeText} />
          {currentSession && (
            <div className="no-print mb-4 flex justify-end">
              <button type="button" onClick={() => setSoapOpen(true)} className="h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5">
                <FileText size={14} /> Draft visit note (SOAP)
              </button>
            </div>
          )}
          <DualPharmacologyPrescriber
            role={role}
            allopathicMeds={draft.allopathic}
            setAllopathicMeds={setAllopathicMeds}
            ayushFormulations={draft.ayush}
            setAyushFormulations={setAyushFormulations}
            draft={draft}
            updateDraft={updateDraft}
            sessionId={selectedSessionId || ''}
            session={currentSession}
            onOpenRxModal={() => setIsRxModalOpen(true)}
          />
        </div>
      </div>

      {/* Bottom action dock */}
      <aside aria-label="Clinical action dock" className="doctor-persistent-dock no-print fixed bottom-5 right-6 z-40 glass border border-border/80 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity size={14} className={isEmergency ? 'text-rose-500 shrink-0' : 'text-primary shrink-0'} />
          <span className="text-sm font-bold text-foreground truncate max-w-[180px]">{currentSession ? currentSession.patientName : 'No patient selected'}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px] text-foreground font-semibold">Space</kbd>
          <span>Finalize</span>
        </div>
        {!isWide && mobileTab === 'queue' ? (
          <button onClick={() => setMobileTab('intake')} className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: 9999, fontSize: 12 }}>
            <span>View intake</span><ChevronRight size={13} />
          </button>
        ) : !isWide && mobileTab === 'intake' ? (
          <button onClick={() => setMobileTab('workspace')} className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: 9999, fontSize: 12 }}>
            <span>Prescribe</span><ChevronRight size={13} />
          </button>
        ) : (
          <button onClick={() => currentSession && setIsRxModalOpen(true)} disabled={!currentSession || !canPrescribe} title={canPrescribe ? '' : 'Only a doctor or vaidya can sign a prescription'} className="btn btn-primary" style={{ padding: '7px 18px', borderRadius: 9999, fontSize: 12 }}>
            <Printer size={13} /><span>{canPrescribe ? 'Finalize & print Rx' : 'Doctor signs Rx'}</span>
          </button>
        )}
      </aside>

      {soapOpen && currentSession && (
        <SoapNoteModal
          session={currentSession}
          transcript={scribeText}
          draft={draft}
          onClose={() => setSoapOpen(false)}
          onInsert={note => {
            updateDraft(d => ({ notes: d.notes ? `${d.notes}\n\n${note}` : note }));
            setSoapOpen(false);
            setNotice({ tone: 'success', text: 'Visit note added to the prescription notes. Review it before finalizing.' });
          }}
        />
      )}

      <OfficialAiiaRxModal
        isOpen={isRxModalOpen && canPrescribe}
        onClose={() => setIsRxModalOpen(false)}
        session={currentSession}
        role={role}
        allopathicMeds={draft.allopathic}
        ayushFormulations={draft.ayush}
        draft={draft}
        prescriber={canPrescribe && user ? { name: user.displayName, title: user.qualification || '', registration: user.registrationNo || '', department: userDept } : null}
        onFinalized={() => {
          setNotice({ tone: 'success', text: `Prescription for ${currentSession?.patientName || 'the patient'} was saved and sent to the pharmacy.` });
          if (selectedRef.current) delete draftsRef.current[selectedRef.current];
          loadQueue();
        }}
      />
    </div>
  );
};
