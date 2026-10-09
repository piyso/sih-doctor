import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PatientQueueList } from './PatientQueueList';
import { PreIntakePanel } from './PreIntakePanel';
import { SimilarCasesPanel } from './SimilarCasesPanel';
import { AmbientScribePanel } from './AmbientScribePanel';
import { PrescriptionPad, TranscriptSuggestions } from './PrescriptionPad';
import { OfficialAiiaRxModal } from './OfficialAiiaRxModal';
import { PatientSafetyBanner } from './PatientSafetyBanner';
import { AdrReportModal } from './AdrReportModal';
import { QualityPanel } from './QualityPanel';
import { EmergencyBanner } from '../common/EmergencyBanner';
import { PatientQueueItem, SessionDetail, VitalsData, SafetyEvaluation, SeenTodayItem } from '../../types/api';
import { api } from '../../services/api';
import { Users, Stethoscope, CheckCircle2, ChevronLeft, ChevronRight, Activity, Leaf, Pill, X, Megaphone, UserX, Siren, PenLine, BarChart3, Volume2, VolumeX, TriangleAlert } from 'lucide-react';
import { DOCTOR_PROFILES, departmentName, roomLabel, DepartmentCode, DEPARTMENTS } from '../../utils/hospitalDirectory';
import { DoctorRole, RxDraft, emptyRxDraft, loadDoctorRole, saveDoctorRole, normaliseDraft } from './doctorRole';
import { useStaffUser } from '../auth/StaffGate';
import { fetchDemoMode, useDemoMode } from '../../services/runtimeMode';
import { SoapNoteModal } from './SoapNoteModal';
import { playSound, soundsEnabled, setSoundsEnabled } from '../../utils/deskSound';

/** Patients a doctor of this role should see (their stream, undecided, and every emergency). */
export const isPatientForRole = (item: Pick<PatientQueueItem, 'careStream' | 'triagePriority'>, role: DoctorRole) =>
  item.triagePriority === 'EMERGENCY_RED_FLAG' || !item.careStream || item.careStream === 'UNDECIDED' || item.careStream === role;

const EMPTY_SAFETY: SafetyEvaluation = { alerts: [], stopGroups: [], coverage: null, resolvedLines: [], checks: [], checked: true };
const localDraftKey = (sessionId: string) => `rx_draft_${sessionId}`;

export const DoctorDeskContainer: React.FC = () => {
  const user = useStaffUser();
  const demoMode = useDemoMode();
  // A doctor always works as modern medicine and a vaidya as Ayurveda; nurses and admins may view either.
  const fixedRole: DoctorRole | null = user?.role === 'vaidya' ? 'AYURVEDA' : user?.role === 'doctor' ? 'ALLOPATHY' : null;
  const canPrescribe = user?.role === 'doctor' || user?.role === 'vaidya';
  const [chosenRole, setRole] = useState<DoctorRole>(loadDoctorRole);
  const role: DoctorRole = fixedRole || chosenRole;
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [soapOpen, setSoapOpen] = useState(false);
  const [adrOpen, setAdrOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [scribeText, setScribeText] = useState('');
  const [scribeHasRoom, setScribeHasRoom] = useState(false);
  /** Notes text that came from the room recording, per visit, so it can be deleted if consent is withdrawn before signing. */
  const roomDerivedNotes = useRef<Record<string, string[]>>({});
  const [suggestions, setSuggestions] = useState<TranscriptSuggestions | null>(null);
  const [showAllStreams, setShowAllStreams] = useState(false);
  const [queue, setQueue] = useState<PatientQueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  /** The selected patient's record could not be loaded: the pad stays hidden (no prescribing without the safety context). */
  const [detailFailed, setDetailFailed] = useState(false);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'queue' | 'intake' | 'workspace'>('queue');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string; action?: { label: string; run: () => void } } | null>(null);
  const [divertedIds, setDivertedIds] = useState<string[]>([]);
  const [safety, setSafety] = useState<SafetyEvaluation>(EMPTY_SAFETY);
  const [checking, setChecking] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled);
  const [consultStart, setConsultStart] = useState<number | null>(null);
  const [isWide, setIsWide] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth > 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Drafts are kept per patient in memory, mirrored to this browser and to the server, so switching
  // patients, the queue refresh, a page reload or another workstation never loses work.
  const draftsRef = useRef<Record<string, RxDraft>>({});
  const [draft, setDraft] = useState<RxDraft>(emptyRxDraft);
  const selectedRef = useRef<string | null>(null);
  const demoRestoreTriedRef = useRef(false);
  const dirtyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const updateDraft = useCallback((patch: Partial<RxDraft> | ((d: RxDraft) => Partial<RxDraft>)) => {
    setDraft(prev => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      if (selectedRef.current) {
        draftsRef.current[selectedRef.current] = next;
        try { localStorage.setItem(localDraftKey(selectedRef.current), JSON.stringify({ at: Date.now(), draft: next })); } catch {}
      }
      dirtyRef.current = true;
      return next;
    });
  }, []);

  // Server autosave (debounced).
  useEffect(() => {
    if (!canPrescribe || !selectedSessionId || !dirtyRef.current) return;
    const id = selectedSessionId;
    const t = setTimeout(() => { api.saveRxDraft(id, draft); dirtyRef.current = false; }, 1200);
    return () => clearTimeout(t);
  }, [draft, selectedSessionId, canPrescribe]);

  // Live safety check with the patient's context (debounced; the latest request wins).
  const safetySeq = useRef(0);
  useEffect(() => {
    const id = selectedSessionId;
    if (!id) { setSafety(EMPTY_SAFETY); return; }
    const my = ++safetySeq.current;
    setChecking(true);
    const t = setTimeout(() => {
      api.evaluateSafety({ sessionId: id, careStream: role, allopathic: draft.allopathic, ayush: draft.ayush, diet: role === 'AYURVEDA' ? draft.pathya : undefined })
        .then(r => { if (my === safetySeq.current) { setSafety(r); setChecking(false); } });
    }, 350);
    return () => clearTimeout(t);
  }, [draft.allopathic, draft.ayush, draft.pathya, selectedSessionId, role]);

  const visibleQueue = useMemo(
    () => (showAllStreams ? queue : queue.filter(item => isPatientForRole(item, role))),
    [queue, role, showAllStreams]
  );

  const initialDraftFor = (detail: SessionDetail): RxDraft => {
    // 1. Draft saved on the server or in this browser (newest wins).
    let local: { at: number; draft: any } | null = null;
    try { local = JSON.parse(localStorage.getItem(localDraftKey(detail.sessionId)) || 'null'); } catch {}
    const server = detail.savedDraft;
    if (server || local) {
      const serverAt = server ? new Date(server.updatedAt).getTime() : 0;
      return normaliseDraft(local && local.at > serverAt ? local.draft : server?.draft);
    }
    // 2. An earlier signed prescription for this visit (amend / pharmacy referral).
    const initial = emptyRxDraft();
    const enc = detail.existingEncounter;
    if (enc) {
      initial.allopathic = enc.allopathicPrescription || [];
      initial.ayush = enc.ayushPrescription || [];
      initial.pathya = enc.pathya || [];
      initial.apathya = enc.apathya || [];
      initial.advice = enc.advice || '';
      initial.diagnoses = (enc.diagnoses || []).filter((d: any) => d && typeof d === 'object' && d.display);
      initial.investigations = (enc.investigationsOrdered || []).map((i: any) => (typeof i === 'string' ? { display: i } : i));
      initial.notes = enc.doctorNotes || '';
      initial.followUpDays = enc.followUpDays || '';
      return initial;
    }
    // 3. Medicines read from documents the patient scanned at the kiosk (to review, not to sign blindly).
    const meds = (detail.scannedDocs || []).flatMap((d: any) => (Array.isArray(d.extractedMedications) ? d.extractedMedications : []));
    initial.allopathic = meds.map((m: any) => ({
      name: typeof m === 'string' ? m : m.name || m.genericName || 'Medicine from previous prescription',
      dosage: m.dosage || '', route: 'ORAL', frequency: m.frequency || '', durationDays: m.durationDays || 0, source: 'scanned_document' as const
    }));
    return initial;
  };

  const selectPatient = useCallback(async (item: Pick<PatientQueueItem, 'sessionId'> | null, isExplicitUserClick = false) => {
    if (!item) {
      selectedRef.current = null;
      setSelectedSessionId(null);
      setCurrentSession(null);
      setDraft(emptyRxDraft());
      setSuggestions(null);
      setConsultStart(null);
      return;
    }
    if (selectedRef.current === item.sessionId && currentSession) return;
    selectedRef.current = item.sessionId;
    setSelectedSessionId(item.sessionId);
    setSuggestions(null);
    setScribeText('');
    dirtyRef.current = false;
    setDraft(draftsRef.current[item.sessionId] || emptyRxDraft());
    if (isExplicitUserClick && typeof window !== 'undefined' && window.innerWidth <= 1024) setMobileTab('intake');

    setDetailFailed(false);
    const detail = await api.getSessionDetail(item.sessionId);
    if (selectedRef.current !== item.sessionId) return; // the doctor already moved on
    setCurrentSession(detail);
    if (!detail) setDetailFailed(true);
    setConsultStart(Date.now());
    if (!draftsRef.current[item.sessionId] && detail) {
      const initial = initialDraftFor(detail);
      draftsRef.current[item.sessionId] = initial;
      setDraft(initial);
    }
  }, [currentSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQueue = useCallback(async () => {
    const { items, online: isOnline } = await api.getQueueStatus();
    setOnline(isOnline);
    setQueueLoaded(true);
    // Demo servers only: an empty queue is refilled with the sample patients once.
    if (isOnline && items.length === 0 && !demoRestoreTriedRef.current && (await fetchDemoMode())) {
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
    if (current) return; // never jump away from the patient being written for
    if (visibleQueue[0]) selectPatient(visibleQueue[0]);
  }, [queue, visibleQueue, queueLoaded, selectPatient]);

  const loadAlerts = useCallback(() => {
    api.getAlerts().then(a => setSosAlerts(a.filter((x: any) => !x.resolvedAt))).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
    loadAlerts();
    const interval = setInterval(() => { loadQueue(); loadAlerts(); }, 15000);
    const stop = api.subscribeStaffEvents(e => {
      if (e.type === 'queue.changed') loadQueue();
      if (e.type === 'sos.raised') { playSound('emergency'); loadAlerts(); }
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

  const changeRole = (next: DoctorRole) => { setRole(next); saveDoctorRole(next); };

  const stepPatient = (direction: 1 | -1) => {
    if (visibleQueue.length === 0) return;
    const idx = visibleQueue.findIndex(q => q.sessionId === selectedSessionId);
    const next = visibleQueue[(idx + direction + visibleQueue.length) % visibleQueue.length];
    selectPatient(next, true);
  };

  const claim = async (takeOver = false) => {
    if (!currentSession) return false;
    try {
      await api.claimPatient(currentSession.sessionId, takeOver);
      setCurrentSession(prev => (prev ? { ...prev, claimedBy: { id: user?.id || '', name: user?.displayName || '', at: new Date().toISOString() } } : prev));
      return true;
    } catch (e: any) {
      if (e?.code === 'CLAIMED_BY_OTHER') {
        setNotice({ tone: 'error', text: `${e.details?.claimedBy?.name || 'Another clinician'} is already seeing ${currentSession.patientName}.`, action: { label: 'Take over', run: () => { setNotice(null); claim(true); } } });
      }
      return false;
    }
  };

  const handleSaveVitals = async (vitals: VitalsData) => {
    if (!currentSession) return false;
    const ok = await api.updateSessionVitals(currentSession.sessionId, vitals);
    if (ok) {
      const fresh = await api.getSessionDetail(currentSession.sessionId);
      if (fresh && selectedRef.current === fresh.sessionId) setCurrentSession(fresh);
      loadQueue();
    }
    return ok;
  };

  const handleCallPatient = async () => {
    if (!currentSession) return;
    try {
      const r = await api.callPatient(currentSession.sessionId);
      if (canPrescribe) await claim();
      playSound('success');
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
      selectPatient(null);
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

  /** Medicines found in the transcript are offered for confirmation; nothing is added silently. */
  const onScribeTranscript = useCallback((text: string, hasRoom: boolean) => { setScribeText(text); setScribeHasRoom(hasRoom); }, []);
  const appendNotes = (text: string, fromRoom: boolean) => {
    const sid = selectedRef.current;
    if (fromRoom && sid) roomDerivedNotes.current[sid] = [...(roomDerivedNotes.current[sid] || []), text];
    updateDraft(d => ({ notes: d.notes ? `${d.notes}\n\n${text}` : text }));
  };
  const insertScribeNotes = useCallback((text: string, fromRoom: boolean) => appendNotes(text, fromRoom), []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Consent withdrawn: delete what the room recording put into the unsigned notes (each block exactly as inserted). */
  const removeRoomDerivedNotes = useCallback(() => {
    const sid = selectedRef.current;
    const blocks = sid ? roomDerivedNotes.current[sid] || [] : [];
    if (!sid || !blocks.length) return;
    let removed = 0;
    updateDraft(d => {
      let notes = d.notes || '';
      for (const b of blocks) if (notes.includes(b)) { notes = notes.replace(b, ''); removed++; }
      return { notes: notes.replace(/\n{3,}/g, '\n\n').trim() };
    });
    roomDerivedNotes.current[sid] = [];
    setNotice({ tone: 'success', text: `Consent withdrawn: text from the room recording was removed from the unsigned notes (${blocks.length} block${blocks.length > 1 ? 's' : ''}). Check the notes; anything you rewrote yourself stays.` });
    void removed;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoExtractFromScribe = async (transcriptText: string) => {
    const text = (transcriptText || '').trim();
    if (!text) { setNotice({ tone: 'error', text: 'The transcript is empty — dictate or type first.' }); return; }
    try {
      const parsed = await api.parseAudioTranscript(text, selectedSessionId || undefined);
      const meds = (parsed.medications || []) as any[];
      const ayush = (parsed.ayushPrescriptions || []) as any[];
      if (meds.length === 0 && ayush.length === 0) { setNotice({ tone: 'error', text: 'No medicines were recognised in the transcript.' }); return; }
      setSuggestions({
        allopathic: meds.map(m => ({ name: typeof m === 'string' ? m : m.drugName || m.name || m.genericName, dosage: m.dosage || '', route: m.route || 'ORAL', frequency: m.frequency || '', durationDays: m.durationDays || parseInt(m.duration, 10) || 0 })).filter(m => m.name),
        ayush: ayush.map(a => ({ classicalName: typeof a === 'string' ? a : a.formulationName || a.classicalName || a.name, dosageForm: a.dosageForm || '', dose: a.dose || a.dosage || '', anupana: a.anupana || '', frequency: a.frequency || '', durationDays: a.durationDays || parseInt(a.duration, 10) || 0 })).filter(a => a.classicalName)
      });
    } catch (e) {
      console.warn('Auto-extract transcript error:', e);
      setNotice({ tone: 'error', text: 'The transcript could not be analysed — the hospital server is not reachable.' });
    }
  };

  const openSign = useCallback(async () => {
    if (!currentSession || !canPrescribe) return;
    const claimer = currentSession.claimedBy;
    if (!claimer || claimer.id !== user?.id) await claim();
    setIsRxModalOpen(true);
  }, [currentSession, canPrescribe, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: "/" add medicine, Ctrl/⌘+Enter review & sign, [ and ] previous / next patient.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isRxModalOpen) { e.preventDefault(); openSign(); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === '[') { e.preventDefault(); stepPatient(-1); }
      else if (e.key === ']') { e.preventDefault(); stepPatient(1); }
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
  const claimedByOther = currentSession?.claimedBy && currentSession.claimedBy.id !== user?.id ? currentSession.claimedBy.name : null;
  const stopCount = safety.stopGroups.length;

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
        <EmergencyBanner redFlags={currentSession.redFlags} patientName={currentSession.patientName} onDivertClick={handleSendToEmergency}
          isDiverted={divertedIds.includes(currentSession.sessionId) || currentSession.status === 'DIVERTED_EMERGENCY'} />
      )}

      {notice && (
        <div className={`desk-toast no-print p-3 rounded-2xl flex items-center justify-between gap-3 border shadow-xl bg-card ${notice.tone === 'success' ? 'border-emerald-500/60' : 'border-rose-500/60'}`} role="status">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            {notice.tone === 'success' ? <CheckCircle2 size={17} className="text-emerald-600" /> : <TriangleAlert size={17} className="text-rose-600" />}
            <span>{notice.text}</span>
            {notice.action && <button type="button" onClick={notice.action.run} className="ml-2 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-bold">{notice.action.label}</button>}
          </div>
          <button type="button" onClick={() => setNotice(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {/* Who is at this desk, and desk-wide tools. Patient actions live in the patient bar below. */}
      <div className="no-print rounded-2xl border border-border/70 bg-card px-3.5 py-2 mb-3 flex items-center justify-between flex-wrap gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border ${role === 'AYURVEDA' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-sky-500/10 text-sky-700 border-sky-500/30'}`}>
            {role === 'AYURVEDA' ? <Leaf size={15} /> : <Stethoscope size={15} />}
          </div>
          <div className="min-w-0 text-xs truncate" title={`${profile.registration}${(user as any)?.hprId ? ` · HPR ${(user as any).hprId}` : ''}`}>
            <span className="font-heading font-bold text-sm text-foreground">{profile.name}</span>
            <span className="text-muted-foreground"> · {profile.title} · {roomLabel(profile.department, 'en')} · {departmentName(profile.department, 'en')}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!fixedRole && <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/60 border border-border/70" role="radiogroup" aria-label="Doctor type">
            {([{ id: 'AYURVEDA', label: 'Ayurveda (Vaidya)', icon: Leaf }, { id: 'ALLOPATHY', label: 'Modern medicine', icon: Pill }] as const).map(opt => {
              const Icon = opt.icon;
              const active = role === opt.id;
              return (
                <button key={opt.id} type="button" role="radio" aria-checked={active} onClick={() => changeRole(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${active ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon size={13} />{opt.label}
                </button>
              );
            })}
          </div>}
          {canPrescribe && <button type="button" onClick={() => setQualityOpen(true)} className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5" title="My prescribing indicators (WHO/INRUD, AWaRe)"><BarChart3 size={13} /> My prescribing</button>}
          <button type="button" onClick={() => { setSoundsEnabled(!sounds); setSounds(!sounds); }} className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted inline-flex items-center justify-center" title={sounds ? 'Desk sounds on (emergencies always sound)' : 'Desk sounds off (emergencies always sound)'} aria-label="Toggle desk sounds">
            {sounds ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <div className="flex items-center gap-1 pl-1.5 ml-0.5 border-l border-border/70">
            <button onClick={() => stepPatient(-1)} title="Previous patient ( [ )" aria-label="Previous patient" className="h-7 w-7 rounded-lg border border-border/60 bg-muted hover:bg-muted/80 inline-flex items-center justify-center"><ChevronLeft size={14} /></button>
            <span className="text-xs font-mono text-muted-foreground px-1"><strong className="text-foreground">{visibleQueue.length}</strong> waiting</span>
            <button onClick={() => stepPatient(1)} title="Next patient ( ] )" aria-label="Next patient" className="h-7 w-7 rounded-lg border border-border/60 bg-muted hover:bg-muted/80 inline-flex items-center justify-center"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {currentSession && <PatientSafetyBanner session={currentSession} claimedByOther={claimedByOther} actions={<>
        <button type="button" onClick={handleCallPatient} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5" title="Show and announce this token on the waiting-room screen; you take the patient">
          <Megaphone size={13} /> {selectedQueueItem?.calledAt ? 'Call again' : 'Call to room'}{selectedQueueItem?.tokenNo ? ` · ${selectedQueueItem.tokenNo}` : ''}
        </button>
        <button type="button" onClick={handleNoShow} className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5" title="Patient did not come when called">
          <UserX size={13} /> Not present
        </button>
        <button type="button" onClick={() => setAdrOpen(true)} className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5" title="Report a suspected adverse drug reaction (PvPI / Ayush Suraksha)">
          <Siren size={13} /> ADR
        </button>
      </>} />}

      {/* Tablet / phone tabs */}
      <div className="mobile-desk-toggle">
        {([{ id: 'queue', label: `Queue (${visibleQueue.length})`, icon: Users }, { id: 'intake', label: 'Intake & vitals', icon: Activity }, { id: 'workspace', label: 'Prescribe', icon: Stethoscope }] as const).map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" className={mobileTab === tab.id ? 'active' : ''} onClick={() => setMobileTab(tab.id)}><Icon size={13} /><span>{tab.label}</span></button>;
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
            staffId={user?.id}
            onOpenSeen={(s: SeenTodayItem) => selectPatient({ sessionId: s.sessionId }, true)}
            onLoadDemo={!demoMode ? undefined : async () => {
              const n = await api.restoreDemoQueue();
              setNotice(n > 0 ? { tone: 'success', text: `${n} demo patients added to the queue.` } : { tone: 'error', text: 'Demo patients could not be added.' });
              loadQueue();
            }}
          />
        </div>

        <div className="doctor-desk-preintake">
          <PreIntakePanel session={currentSession} role={role} onSaveVitals={handleSaveVitals} />
          <SimilarCasesPanel sessionId={currentSession?.sessionId ?? null} />
        </div>

        <div className="doctor-desk-workspace">
          {currentSession && (
            <AmbientScribePanel
              key={currentSession.sessionId}
              sessionId={currentSession.sessionId}
              patientAge={currentSession.age}
              patientLanguage={currentSession.language}
              clinicianName={user?.displayName || 'the clinician'}
              consent={currentSession.recordingConsent || null}
              onConsentChange={c => setCurrentSession(prev => (prev ? { ...prev, recordingConsent: c } : prev))}
              onAutoExtract={handleAutoExtractFromScribe}
              onTranscriptChange={onScribeTranscript}
              onInsertNotes={insertScribeNotes}
              onWithdrawn={removeRoomDerivedNotes}
            />
          )}
          {!selectedSessionId && <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Select a patient from the queue to prescribe.</div>}
          {!currentSession && selectedSessionId && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm flex items-center justify-between gap-3 flex-wrap" role={detailFailed ? 'alert' : 'status'}>
              {detailFailed
                ? <span className="font-semibold text-rose-700">Could not load this patient’s record (server not reachable, or the visit was closed). Your draft is kept.</span>
                : <span className="text-muted-foreground">Loading the patient’s record…</span>}
              {detailFailed && <button type="button" onClick={() => { const id = selectedSessionId; selectedRef.current = null; selectPatient({ sessionId: id }, true); }} className="h-8 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted">Retry</button>}
            </div>
          )}
          {currentSession && <PrescriptionPad
            role={role}
            draft={draft}
            updateDraft={updateDraft}
            session={currentSession}
            safety={safety}
            checking={checking}
            canPrescribe={canPrescribe}
            onOpenRxModal={openSign}
            onDraftNote={() => setSoapOpen(true)}
            searchRef={searchRef}
            suggestions={suggestions}
            onClearSuggestions={() => setSuggestions(null)}
          />}
        </div>
      </div>

      {/* Bottom action dock */}
      <aside aria-label="Clinical action dock" className="doctor-persistent-dock no-print fixed bottom-5 right-6 z-40 glass border border-border/80 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity size={14} className={isEmergency ? 'text-rose-500 shrink-0' : 'text-primary shrink-0'} />
          <span className="text-sm font-bold text-foreground truncate max-w-[180px]">{currentSession ? currentSession.patientName : 'No patient selected'}</span>
          {stopCount > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10.5px] font-bold">{stopCount} STOP</span>}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px] text-foreground font-semibold">Ctrl ↵</kbd><span>Sign</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px] text-foreground font-semibold">/</kbd><span>Add</span>
        </div>
        {!isWide && mobileTab === 'queue' ? (
          <button onClick={() => setMobileTab('intake')} className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: 9999, fontSize: 12 }}><span>View intake</span><ChevronRight size={13} /></button>
        ) : !isWide && mobileTab === 'intake' ? (
          <button onClick={() => setMobileTab('workspace')} className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: 9999, fontSize: 12 }}><span>Prescribe</span><ChevronRight size={13} /></button>
        ) : (
          <button onClick={openSign} disabled={!currentSession || !canPrescribe} title={canPrescribe ? 'Review, give reasons for any STOP, and sign' : 'Only a doctor or vaidya can sign a prescription'} className="btn btn-primary" style={{ padding: '7px 18px', borderRadius: 9999, fontSize: 12 }}>
            <PenLine size={13} /><span>{canPrescribe ? 'Review & sign' : 'Doctor signs Rx'}</span>
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
            // A note drafted while room-recording text was in the transcript counts as room-derived.
            appendNotes(note, scribeHasRoom);
            setSoapOpen(false);
            setNotice({ tone: 'success', text: 'Visit note added to the clinical notes. Review it before signing.' });
          }}
        />
      )}
      {adrOpen && currentSession && <AdrReportModal session={currentSession} onClose={() => setAdrOpen(false)} />}
      {qualityOpen && <QualityPanel onClose={() => setQualityOpen(false)} />}

      <OfficialAiiaRxModal
        isOpen={isRxModalOpen && canPrescribe}
        onClose={() => setIsRxModalOpen(false)}
        session={currentSession}
        role={role}
        draft={draft}
        safety={safety}
        checking={checking}
        onAcknowledge={(groupKey, reason) => updateDraft(d => ({ acknowledgements: { ...d.acknowledgements, [groupKey]: reason } }))}
        onIndication={(index, indication) => updateDraft(d => ({ allopathic: d.allopathic.map((m, i) => (i === index ? { ...m, indication } : m)) }))}
        prescriber={canPrescribe && user ? { name: user.displayName, title: user.qualification || '', registration: user.registrationNo || '', department: userDept, hprId: (user as any).hprId || null } : null}
        consultationStartedAt={consultStart}
        onFinalized={() => {
          setNotice({ tone: 'success', text: `Prescription for ${currentSession?.patientName || 'the patient'} was sealed and sent to the pharmacy.` });
          if (selectedRef.current) {
            delete draftsRef.current[selectedRef.current];
            try { localStorage.removeItem(localDraftKey(selectedRef.current)); } catch {}
          }
          dirtyRef.current = false;
          loadQueue();
        }}
      />
    </div>
  );
};
