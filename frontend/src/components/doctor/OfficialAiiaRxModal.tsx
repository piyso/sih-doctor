import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X, CheckCircle2, AlertTriangle, Loader2, PenLine, OctagonAlert, UserCheck, Megaphone } from 'lucide-react';
import { SessionDetail, AllopathicMedication, AyushFormulation, SafetyEvaluation, StopGroup } from '../../types/api';
import { api } from '../../services/api';
import { RealQrCode } from '../common/RealQrCode';
import { printElement } from '../../utils/printDocument';
import { DOCTOR_PROFILES, DepartmentCode, departmentName, roomLabel } from '../../utils/hospitalDirectory';
import { DoctorRole, RxDraft, formatDiagnosis } from './doctorRole';
import { HOSPITAL } from '../../utils/hospitalConfig';
import { buildInstruction, isRxLang, LANGUAGE_NATIVE_NAME } from '../../utils/rxInstructions';
import { parseSig, quantity } from '../../utils/sig';
import { playSound } from '../../utils/deskSound';

export interface PrescriberProfile {
  name: string;
  title: string;
  registration: string;
  department: DepartmentCode;
  hprId?: string | null;
}

interface OfficialAiiaRxModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetail | null;
  role: DoctorRole;
  draft: RxDraft;
  safety: SafetyEvaluation;
  /** A safety check for the current draft is still running: signing waits for it. */
  checking?: boolean;
  /** Saves a typed reason for a STOP group into the draft (kept if the dialog is closed). */
  onAcknowledge: (groupKey: string, reason: string) => void;
  /** Saves the indication typed for an antibiotic line (WHO AWaRe stewardship) into the draft. */
  onIndication?: (lineIndex: number, indication: string) => void;
  prescriber?: PrescriberProfile | null;
  consultationStartedAt?: number | null;
  onFinalized?: (result: any) => void;
}

type Phase = 'review' | 'saving' | 'done' | 'error' | 'already' | 'claimed';

/** National reporting channels for notifiable events detected at signing. Neither has a public API: the doctor reports and records the reference. */
const NOTIFY_TEXT: Record<string, { text: string; ref: string }> = {
  NIKSHAY_TB: { text: 'TB is notifiable: notify on Nikshay (nikshay.in) now.', ref: 'Nikshay ID / reference' },
  IHIP_ANIMAL_BITE: { text: 'Animal bite: report on IHIP (ihip.mohfw.gov.in) under the National Rabies Control Programme.', ref: 'IHIP reference' }
};

interface Snapshot { session: SessionDetail; draft: RxDraft; role: DoctorRole; safety: SafetyEvaluation; openedAt: Date }

/** Morning / noon / night pictogram for 1-0-1 timing (validated pictograms are dose and timing only). */
const TimingPictogram: React.FC<{ frequency: string }> = ({ frequency }) => {
  const p = parseSig(frequency).pattern;
  if (!p) return <span style={{ fontSize: 10.5 }}>{frequency || '—'}</span>;
  const icon = (i: number) => i === 0
    ? <circle cx="8" cy="8" r="4" fill="#f59e0b" />
    : i === 1 ? <><circle cx="8" cy="8" r="5" fill="#f97316" /><circle cx="8" cy="8" r="2" fill="#fde68a" /></>
    : <path d="M10 3a5 5 0 1 0 3 9A6 6 0 0 1 10 3z" fill="#334155" />;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: p[i] ? 1 : 0.25 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{icon(i)}</svg>
          <strong style={{ fontSize: 12 }}>{p[i] === 0.5 ? '½' : p[i] || 0}</strong>
        </span>
      ))}
    </span>
  );
};

export const OfficialAiiaRxModal: React.FC<OfficialAiiaRxModalProps> = ({ isOpen, onClose, session, role, draft, safety, checking = false, onAcknowledge, onIndication, prescriber, consultationStartedAt, onFinalized }) => {
  const docRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('review');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [serverStops, setServerStops] = useState<StopGroup[] | null>(null);
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [already, setAlready] = useState<{ by: string; same: boolean } | null>(null);
  const [adviceLocal, setAdviceLocal] = useState('');
  const [translating, setTranslating] = useState<'idle' | 'busy' | 'unavailable'>('idle');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [notifyRefs, setNotifyRefs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && session) {
      setSnap({ session, draft, role, safety, openedAt: new Date() });
      setPhase('review'); setError(null); setResult(null); setServerStops(null); setClaimedBy(null); setAlready(null); setAdviceLocal(''); setTranslating('idle');
    }
    if (!isOpen) setSnap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  // Reasons typed in this dialog flow back to the draft; keep the snapshot's copy in sync.
  useEffect(() => { if (snap && phase === 'review') setSnap(s => (s ? { ...s, draft: { ...s.draft, acknowledgements: draft.acknowledgements } } : s)); }, [draft.acknowledgements]); // eslint-disable-line react-hooks/exhaustive-deps
  // The live check keeps running while the dialog is open (e.g. it opened before the last medicine was checked, or an
  // indication was just typed): follow it, so the dialog never gates on a stale result.
  useEffect(() => { if (snap && phase === 'review') setSnap(s => (s ? { ...s, safety } : s)); }, [safety]); // eslint-disable-line react-hooks/exhaustive-deps
  // Indications typed here likewise (the desk behind the dialog cannot change the medicines meanwhile).
  useEffect(() => { if (snap && phase === 'review') setSnap(s => (s ? { ...s, draft: { ...s.draft, allopathic: draft.allopathic } } : s)); }, [draft.allopathic]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'saving') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, phase, onClose]);

  const stops: StopGroup[] = useMemo(() => serverStops || snap?.safety.stopGroups || [], [serverStops, snap]);
  if (!isOpen || !snap) return null;

  const s = snap.session;
  const d = snap.draft;
  const isAyurveda = snap.role === 'AYURVEDA';
  const profile = prescriber || DOCTOR_PROFILES[snap.role];
  const patientLang = isRxLang(s.language) && s.language !== 'en' ? s.language : null;
  const prescribedAyush = isAyurveda ? d.ayush : [];
  const prescribedAllo = isAyurveda ? [] : d.allopathic;
  const ongoing = isAyurveda ? d.allopathic.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`) : d.ayush.map(a => `${a.classicalName}${a.dose ? ` ${a.dose}` : ''}`);
  const prescribedCount = prescribedAyush.length + prescribedAllo.length;
  const opdNumber = `${HOSPITAL.opdPrefix}/${snap.openedAt.getFullYear()}/${s.sessionId.slice(-6).toUpperCase()}`;
  const dateText = snap.openedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeText = snap.openedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const missingReasons = stops.filter(g => (d.acknowledgements[g.groupKey] || '').trim().length < 5);
  const isAntibiotic = (i: number) => !!snap.safety.resolvedLines.find(r => r.index === i)?.aware?.length;
  const antibioticLines = prescribedAllo.map((m, i) => ({ m, i })).filter(({ i }) => isAntibiotic(i));
  const antibioticWithoutIndication = antibioticLines.filter(({ m }) => !m.indication?.trim()).map(({ m }) => m);
  const unchecked = !snap.safety.checked;
  const allergies = s.patientContext?.allergies;
  const followUpDate = d.followUpDays ? new Date(snap.openedAt.getTime() + Number(d.followUpDays) * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const vitalsParts = [
    s.vitals?.bp ? `BP ${s.vitals.bp} mmHg` : '', s.vitals?.pulse ? `Pulse ${s.vitals.pulse}/min` : '', s.vitals?.spo2 ? `SpO2 ${s.vitals.spo2}` : '',
    s.vitals?.temp ? `Temp ${s.vitals.temp}` : '', s.vitals?.respiratoryRate ? `RR ${s.vitals.respiratoryRate}/min` : '', s.vitals?.weightKg ? `Wt ${s.vitals.weightKg} kg` : ''
  ].filter(Boolean);
  const genericOf = (i: number, fallback: string) => {
    const g = snap.safety.resolvedLines.find(r => r.index === i)?.generics;
    return g?.length ? g.join(' + ') : fallback;
  };
  const e1Of = (i: number) => snap.safety.resolvedLines.find(r => r.index === i)?.scheduleE1;

  const finalize = async (opts: { amend?: boolean; takeOver?: boolean } = {}) => {
    setPhase('saving');
    setError(null);
    try {
      const res = await api.finalizePrescription({
        sessionId: s.sessionId, patientId: s.patientId, careStream: snap.role,
        symptoms: s.symptoms, pariksha: s.pariksha, vitals: s.vitals,
        diagnoses: d.diagnoses,
        allopathicPrescription: d.allopathic.map(m => ({ ...m, quantity: quantity(m.dosage, m.frequency, m.durationDays) || undefined })),
        ayushPrescription: d.ayush,
        investigationsOrdered: d.investigations,
        pathya: isAyurveda ? d.pathya : [], apathya: isAyurveda ? d.apathya : [],
        advice: d.advice, followUpDays: d.followUpDays || undefined, doctorNotes: d.notes,
        clinicalExamination: d.examination,
        consultationMinutes: consultationStartedAt ? Math.round((Date.now() - consultationStartedAt) / 60000) : undefined,
        adviceLocal: adviceLocal.trim() || undefined, adviceLanguage: adviceLocal.trim() ? patientLang || undefined : undefined,
        alertAcknowledgements: Object.entries(d.acknowledgements).filter(([, r]) => r.trim()).map(([groupKey, reason]) => ({ groupKey, reason })),
        amend: opts.amend, takeOver: opts.takeOver
      });
      setResult(res);
      setPhase('done');
      playSound('success');
      onFinalized?.(res);
    } catch (e: any) {
      const details = e?.details || {};
      if (e?.code === 'CRITICAL_CONTRAINDICATION') {
        setServerStops(details.stopGroups || []);
        setError(e.message);
        setPhase('review');
        return;
      }
      if (e?.code === 'INDICATION_REQUIRED') { setError(e.message); setPhase('error'); return; }
      if (e?.code === 'ALREADY_FINALIZED') { setAlready({ by: details.finalizedBy, same: !!details.sameDoctor }); setPhase('already'); return; }
      if (e?.code === 'CLAIMED_BY_OTHER') { setClaimedBy(details.claimedBy?.name || 'another clinician'); setPhase('claimed'); return; }
      setError(e?.name === 'AbortError' ? 'The hospital server did not respond in time.' : e?.message || 'The hospital server is not reachable.');
      setPhase('error');
      playSound('alert');
    }
  };

  const translateAdvice = async () => {
    if (!patientLang || !d.advice.trim()) return;
    setTranslating('busy');
    try { setAdviceLocal((await api.translateTexts([d.advice], patientLang)).translations[0] || ''); setTranslating('idle'); } catch { setTranslating('unavailable'); }
  };
  const print = () => printElement(docRef.current, `Prescription — ${s.patientName}`);
  const signed = phase === 'done' && result?.signature;
  // Said on the printout only when the signed record shows room clips under consent that was not withdrawn.
  const aids = signed ? result?.consultationRecord?.documentationAids : null;
  const roomAided: { consenter?: string } | null = aids?.roomRecording?.clips && aids.roomRecording.consent?.event === 'given' ? { consenter: aids.roomRecording.consent.consenter } : null;
  const canSign = prescribedCount > 0 || d.advice.trim();
  const needsDiagnosis = d.diagnoses.length === 0;
  // Once signed, print what the record holds (the server re-derives codes from the current ontology).
  const printedDiagnoses: RxDraft['diagnoses'] = signed && Array.isArray(result?.consultationRecord?.diagnoses) ? result.consultationRecord.diagnoses : d.diagnoses;
  const blockers = [
    ...missingReasons.map(g => `Reason needed: ${g.summary}`),
    ...antibioticWithoutIndication.map(m => `Indication needed for ${m.name}`),
    ...(needsDiagnosis ? ['Record a diagnosis on the desk (provisional is fine)'] : [])
  ];
  const signBlocked = checking || !canSign || missingReasons.length > 0 || antibioticWithoutIndication.length > 0 || needsDiagnosis;

  const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 11 };
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, verticalAlign: 'top' };

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" onClick={() => { if (phase !== 'saving') onClose(); }} role="dialog" aria-modal="true" aria-label="Review and sign prescription">
      <div className="w-full max-w-[940px] max-h-[94vh] flex flex-col bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white text-slate-900 flex-wrap">
          <div>
            <h3 className="text-sm font-bold m-0">Prescription — {s.patientName}</h3>
            <span className="text-[11px] text-slate-500">{isAyurveda ? 'Ayurveda' : 'Modern medicine'} · {prescribedCount} prescribed · {stops.length ? `${stops.length} STOP alert${stops.length > 1 ? 's' : ''}` : 'no STOP alerts'}{unchecked ? ' · NOT safety-checked' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {(phase === 'review' || phase === 'error') && (
              <button type="button" onClick={() => finalize()} disabled={signBlocked} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                title={blockers.length ? blockers.join('\n') : 'Seal and send to the pharmacy'} data-testid="sign-rx">
                {checking ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />} <span>{checking ? 'Checking safety…' : phase === 'error' ? 'Try again' : 'Sign & send to pharmacy'}</span>
              </button>
            )}
            {phase === 'done' && <button type="button" onClick={print} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12, background: '#059669', borderColor: '#059669' }}><Printer size={14} /> <span>Print</span></button>}
            {phase === 'error' && stops.length === 0 && !unchecked && (
              <button type="button" onClick={print} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }} title="Prints a DRAFT copy that is not in the hospital record"><Printer size={14} /> <span>Print draft copy</span></button>
            )}
            <button type="button" onClick={onClose} disabled={phase === 'saving'} className="btn btn-secondary" style={{ padding: '8px 10px' }} aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {(phase === 'review' || phase === 'error') && stops.length > 0 && (
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 text-slate-900 flex flex-col gap-2" data-testid="stop-reasons">
            <div className="text-sm font-bold text-rose-800 flex items-center gap-2"><OctagonAlert size={16} /> {error && serverStops ? error : 'These alerts must be resolved, or justified with your reason, before signing. Your reason is sealed into the record and shown to the pharmacist.'}</div>
            {stops.map(g => {
              const alert = snap.safety.alerts.find(a => a.groupKey === g.groupKey);
              return (
                <label key={g.groupKey} className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-900">{g.summary}{alert ? <span className="font-normal text-slate-600"> — {alert.mechanism}</span> : null}</span>
                  <input value={d.acknowledgements[g.groupKey] || ''} onChange={e => onAcknowledge(g.groupKey, e.target.value)} placeholder="Why you are proceeding (e.g. 'tolerated before, documented', 'benefit outweighs risk; INR in 3 days')"
                    className={`w-full rounded-lg border p-2 text-sm ${(d.acknowledgements[g.groupKey] || '').trim().length >= 5 ? 'border-emerald-400' : 'border-rose-300'}`} aria-label={`Reason for ${g.summary}`} />
                </label>
              );
            })}
            <span className="text-[11px] text-slate-600">Or close this dialog and change the prescription — the alert disappears when the cause is removed.</span>
          </div>
        )}
        {(phase === 'review' || phase === 'error') && unchecked && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle size={14} /> The safety check could not run (server unreachable). The server re-checks when you sign.</div>
        )}
        {(phase === 'review' || phase === 'error') && antibioticLines.length > 0 && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-slate-900 flex flex-col gap-2" data-testid="abx-indications">
            <div className="text-xs font-bold text-amber-900">Antibiotic indication (WHO AWaRe stewardship) — printed on the prescription and counted in your prescribing report.</div>
            {antibioticLines.map(({ m, i }) => (
              <label key={i} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-semibold min-w-[180px]">{m.name}</span>
                <input value={m.indication || ''} onChange={e => onIndication?.(i, e.target.value)} placeholder="e.g. acute bacterial sinusitis, UTI, cellulitis"
                  className={`flex-1 min-w-[200px] rounded-lg border p-2 text-sm ${(m.indication || '').trim() ? 'border-emerald-400' : 'border-amber-400'}`} aria-label={`Indication for ${m.name}`} />
              </label>
            ))}
          </div>
        )}
        {(phase === 'review') && needsDiagnosis && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-900">Record a diagnosis on the desk before signing (provisional is fine).</div>
        )}
        {phase === 'saving' && <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-sm font-semibold text-slate-700"><Loader2 size={16} className="animate-spin" /> Checking again, sealing and sending…</div>}
        {phase === 'already' && already && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 flex-wrap text-amber-950">
            <span className="text-sm font-semibold">{already.same ? 'You already signed a prescription for this visit.' : `${already.by} already signed a prescription for this visit.`} Save this one as an amendment? Both stay in the record.</span>
            <div className="flex gap-2"><button type="button" onClick={() => setPhase('review')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Cancel</button><button type="button" onClick={() => finalize({ amend: true })} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>Save as amendment</button></div>
          </div>
        )}
        {phase === 'claimed' && (
          <div className="px-5 py-3 bg-sky-50 border-b border-sky-200 flex items-center justify-between gap-3 flex-wrap text-sky-950">
            <span className="text-sm font-semibold flex items-center gap-2"><UserCheck size={16} /> {claimedBy} is seeing this patient. Take over only if you have agreed with them.</span>
            <div className="flex gap-2"><button type="button" onClick={() => setPhase('review')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Cancel</button><button type="button" onClick={() => finalize({ takeOver: true })} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>Take over and sign</button></div>
          </div>
        )}
        {phase === 'done' && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-col gap-2 text-emerald-900">
            <span className="text-sm font-bold flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> Sealed and sent to the pharmacy · Record {String(result?.encounterId || '').slice(0, 8)}{result?.sms?.sent ? ' · SMS sent to the patient' : ''}</span>
            {result?.notifiable?.map((n: any) => {
              const how = NOTIFY_TEXT[n.type] || { text: `${n.type} is reportable.`, ref: 'Reference number' };
              const ref = notifyRefs[n.id] || '';
              return (
                <div key={n.id} className="text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg p-2 flex items-center gap-2 flex-wrap">
                  <Megaphone size={14} /> {how.text} ({n.reason})
                  <input value={ref} onChange={e => setNotifyRefs(r => ({ ...r, [n.id]: e.target.value }))} placeholder={how.ref} aria-label={how.ref} className="px-2 py-1 rounded border border-amber-300 bg-white text-slate-900" />
                  <button type="button" disabled={!ref.trim() || n.done} onClick={async () => { await api.markNotifiableSubmitted(n.id, ref.trim()); n.done = true; setResult({ ...result }); }} className="px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50">{n.done ? 'Recorded' : 'Mark notified'}</button>
                </div>
              );
            })}
          </div>
        )}
        {phase === 'error' && <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-sm font-semibold text-rose-900" role="alert"><AlertTriangle size={16} className="text-rose-600 shrink-0" /> Not saved: {error}</div>}

        {patientLang && d.advice.trim() && (phase === 'review' || phase === 'error') && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-slate-900 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold">Advice in the patient’s language ({LANGUAGE_NATIVE_NAME[patientLang]}) — optional, check before printing</span>
              <button type="button" onClick={translateAdvice} disabled={translating === 'busy'} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>{translating === 'busy' ? 'Translating…' : adviceLocal ? 'Translate again' : 'Machine-translate advice'}</button>
            </div>
            {translating === 'unavailable' && <span className="text-[11px] text-amber-700">No translation service is available. Type the advice in the patient’s language below.</span>}
            <textarea value={adviceLocal} onChange={e => setAdviceLocal(e.target.value)} rows={2} placeholder="Type or generate the advice in the patient’s language" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white">
          <div ref={docRef} style={{ padding: '24px 28px', background: '#ffffff', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }}>
            {!signed && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', fontSize: 64, fontWeight: 900, color: 'rgba(225,29,72,0.08)', transform: 'rotate(-18deg)', pointerEvents: 'none' }}>DRAFT — NOT SIGNED</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '2px solid #047857', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src={HOSPITAL.emblem} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', fontWeight: 700 }}>{HOSPITAL.authority}</div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#064e3b' }}>{HOSPITAL.name}</div>
                  <div style={{ fontSize: 11, color: '#334155' }}>{HOSPITAL.address}{HOSPITAL.phone ? ` · ${HOSPITAL.phone}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#047857', fontWeight: 700, marginTop: 2 }}>{departmentName(profile.department, 'en')} · {roomLabel(profile.department, 'en')}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <RealQrCode value={signed ? `RX|${result.encounterId}|${result.signature.recordSha256.slice(0, 32)}` : `RX-DRAFT|${opdNumber}`} size={60} level="M" title={opdNumber} />
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', marginTop: 2 }}>{opdNumber}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Patient</div><strong>{s.patientName}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Age / Sex / Weight</div><strong>{s.age ? `${s.age} y` : '—'} / {s.gender}{s.vitals?.weightKg || s.weightKg ? ` / ${s.vitals?.weightKg || s.weightKg} kg` : ''}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>ABHA</div><strong style={{ fontFamily: 'monospace' }}>{s.abhaId || 'Not linked'}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Date</div><strong>{dateText}, {timeText}</strong></div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, color: allergies?.length ? '#b91c1c' : '#334155' }}>
              Allergies: {allergies === undefined ? 'not recorded' : allergies.length ? allergies.map(a => `${a.agent}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ') : 'No known drug allergies'}
              {s.isPregnant ? <span style={{ color: '#be185d' }}> · Pregnant{s.gestationalWeeks ? ` ${s.gestationalWeeks} wk` : ''}</span> : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', marginBottom: 4 }}>Diagnosis</div>
                {printedDiagnoses.length ? printedDiagnoses.map((dx, i) => {
                  const f = formatDiagnosis(dx, snap.role);
                  return <div key={i} style={{ fontSize: 13, fontWeight: 700 }}>{dx.display} <span style={{ fontSize: 10.5, fontWeight: 500, color: '#475569' }}>({dx.status}){f?.codes.length ? ` · ${f.codes.join(' · ')}` : ''}</span></div>;
                }) : <div style={{ fontSize: 12, color: '#64748b' }}>—</div>}
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', marginBottom: 4 }}>Examination</div>
                <div style={{ fontSize: 12 }}>{vitalsParts.length ? vitalsParts.join(' · ') : 'Vitals not recorded'}</div>
                {d.examination.general ? <div style={{ fontSize: 11.5, marginTop: 4 }}>{d.examination.general}</div> : null}
                {isAyurveda && d.examination.ashtavidha && Object.values(d.examination.ashtavidha).some(Boolean) && (
                  <div style={{ fontSize: 11, marginTop: 4 }}>{Object.entries(d.examination.ashtavidha).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}: ${v}`).join(' · ')}</div>
                )}
              </div>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>℞</div>
            {prescribedCount === 0 ? (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>No medicines prescribed.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ ...th, width: '4%' }}>#</th><th style={{ ...th, width: '34%' }}>Medicine</th><th style={th}>Dose</th><th style={th}>When (morning · noon · night)</th>
                    <th style={th}>{isAyurveda ? 'Anupana' : 'Food'}</th><th style={th}>Days</th>{!isAyurveda && <th style={th}>Qty</th>}
                  </tr>
                </thead>
                <tbody>
                  {prescribedAyush.map((a, i) => {
                    const idx = d.allopathic.length + i;
                    const e1 = e1Of(idx);
                    return (
                      <tr key={`a${i}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ ...td, fontWeight: 700 }}>{i + 1}</td>
                        <td style={td}><strong>{a.classicalName}</strong>{a.dosageForm ? <div style={{ fontSize: 9.5, color: '#64748b' }}>{a.dosageForm}</div> : null}{e1?.length ? <div style={{ fontSize: 9.5, color: '#b45309', fontWeight: 700 }}>Caution: to be taken under medical supervision (Schedule E(1))</div> : null}</td>
                        <td style={td}>{a.dose || '—'}</td><td style={td}><TimingPictogram frequency={a.frequency} /></td><td style={td}>{a.anupana || '—'}</td><td style={td}>{a.durationDays || '—'}</td>
                      </tr>
                    );
                  })}
                  {prescribedAllo.map((m, i) => {
                    const generic = genericOf(i, m.name);
                    const brand = generic.toLowerCase() !== m.name.toLowerCase() ? m.name : '';
                    const sig = parseSig(m.frequency);
                    return (
                      <tr key={`m${i}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ ...td, fontWeight: 700 }}>{i + 1}</td>
                        <td style={td}><strong style={{ letterSpacing: '0.02em' }}>{generic.toUpperCase()}</strong>{brand ? <span style={{ fontSize: 10, color: '#64748b' }}> ({brand})</span> : null}{m.indication ? <div style={{ fontSize: 9.5, color: '#475569' }}>For: {m.indication}</div> : null}</td>
                        <td style={td}>{m.dosage || '—'}</td><td style={td}><TimingPictogram frequency={m.frequency} /></td><td style={td}>{sig.food || '—'}</td><td style={td}>{m.durationDays || '—'}</td>
                        <td style={td}>{quantity(m.dosage, m.frequency, m.durationDays) ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {patientLang && prescribedCount > 0 && (() => {
              const rows = [
                ...prescribedAyush.map(a => ({ name: a.classicalName, text: buildInstruction({ dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }, patientLang) })),
                ...prescribedAllo.map((m, i) => ({ name: genericOf(i, m.name), text: buildInstruction({ dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays }, patientLang) }))
              ].filter(r => r.text);
              return rows.length ? (
                <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#075985', marginBottom: 4 }}>How to take your medicines · {LANGUAGE_NATIVE_NAME[patientLang]}</div>
                  {rows.map((r, i) => <div key={i} style={{ fontSize: 13, marginBottom: 2 }}><strong>{r.name}:</strong> {r.text}</div>)}
                </div>
              ) : null;
            })()}

            {ongoing.length > 0 && <div style={{ fontSize: 11.5, color: '#334155', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}><strong>{isAyurveda ? 'Ongoing modern medicines' : 'Ongoing Ayurvedic / herbal medicines'} (not prescribed here; checked for interactions):</strong> {ongoing.join('; ')}</div>}
            {d.investigations.length > 0 && <div style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 14 }}><strong>Tests:</strong> {d.investigations.map(i => `${i.display}${i.urgency === 'urgent' ? ' (urgent)' : ''}`).join(', ')}</div>}
            {isAyurveda && (d.pathya.length > 0 || d.apathya.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12 }}>
                <div><strong style={{ color: '#047857' }}>Pathya (follow):</strong> {d.pathya.join(', ') || '—'}</div>
                <div><strong style={{ color: '#b91c1c' }}>Apathya (avoid):</strong> {d.apathya.join(', ') || '—'}</div>
              </div>
            )}
            {(d.advice || d.followUpDays) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12 }}>
                {d.advice && <div><strong>Advice:</strong> {d.advice}</div>}
                {adviceLocal.trim() && patientLang && <div style={{ marginTop: 4, fontSize: 13 }}><strong>{LANGUAGE_NATIVE_NAME[patientLang]}:</strong> {adviceLocal}</div>}
                {followUpDate ? <div style={{ marginTop: 4, fontSize: 13 }}><strong>Come back on:</strong> {followUpDate}</div> : null}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: 12, marginTop: 18 }}>
              <div style={{ fontSize: 9.5, color: '#64748b', maxWidth: '58%' }}>
                {signed
                  ? <>Tamper-evident seal (Ed25519) {new Date(result.signature.signedAt).toLocaleString('en-IN')} · key {result.signature.keyId} · record {String(result.signature.recordSha256).slice(0, 16)}… The pharmacy verifies the seal before dispensing. {result.signature.legal?.configured ? 'Legal e-signature applied via the eSign provider.' : 'Legal signature: the prescriber’s signature on this copy.'} </>
                  : 'Draft — not sealed or sent. '}
                Bring this prescription on your next visit.
                {roomAided && (
                  <div style={{ marginTop: 4, color: '#334155' }}>
                    Part of today’s notes was drafted from a recording of the consultation, made with {roomAided.consenter && roomAided.consenter !== 'patient' ? 'your family’s' : 'your'} consent. The recording was not kept; the doctor checked the notes.
                    {patientLang === 'hi' && <> आज के नोट्स का कुछ हिस्सा आपकी सहमति से की गई बातचीत की रिकॉर्डिंग से तैयार किया गया। रिकॉर्डिंग रखी नहीं गई; डॉक्टर ने नोट्स जाँचे।</>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ width: 160, borderBottom: '1px solid #94a3b8', height: 26, marginLeft: 'auto' }} />
                <div style={{ fontSize: 12, fontWeight: 800 }}>{profile.name}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{profile.title}</div>
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>{profile.registration}</div>
                {(prescriber as PrescriberProfile | null | undefined)?.hprId ? <div style={{ fontSize: 10, color: '#475569' }}>HPR {(prescriber as PrescriberProfile).hprId}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export type { AllopathicMedication, AyushFormulation };
