import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, CheckCircle2, AlertTriangle, Loader2, Send, RotateCcw } from 'lucide-react';
import { SessionDetail, AllopathicMedication, AyushFormulation } from '../../types/api';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { RealQrCode } from '../common/RealQrCode';
import { printElement } from '../../utils/printDocument';
import { PAIN_CHARACTERS, kioskText } from '../../utils/kioskLocalization';
import { DOCTOR_PROFILES, DepartmentCode, departmentName, roomLabel } from '../../utils/hospitalDirectory';
import { DoctorRole, RxDraft, formatDiagnosis } from './doctorRole';
import { HOSPITAL } from '../../utils/hospitalConfig';
import { buildInstruction, isRxLang, LANGUAGE_NATIVE_NAME } from '../../utils/rxInstructions';

export interface PrescriberProfile {
  name: string;
  title: string;
  registration: string;
  department: DepartmentCode;
}

interface OfficialAiiaRxModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetail | null;
  role: DoctorRole;
  allopathicMeds: AllopathicMedication[];
  ayushFormulations: AyushFormulation[];
  draft: RxDraft;
  /** The signed-in doctor/vaidya. Printed as the prescriber; the server uses the same identity. */
  prescriber?: PrescriberProfile | null;
  onFinalized?: () => void;
}

type Phase = 'review' | 'confirm' | 'saving' | 'done' | 'error' | 'already';

interface Snapshot {
  session: SessionDetail;
  allopathic: AllopathicMedication[];
  ayush: AyushFormulation[];
  draft: RxDraft;
  role: DoctorRole;
  openedAt: Date;
}

const characterEn = (value?: string) => {
  const match = PAIN_CHARACTERS.find(c => c.value === value);
  return match ? kioskText('en')(match.key) : value || '';
};

export const OfficialAiiaRxModal: React.FC<OfficialAiiaRxModalProps> = ({
  isOpen,
  onClose,
  session,
  role,
  allopathicMeds,
  ayushFormulations,
  draft,
  prescriber,
  onFinalized
}) => {
  // All hooks run on every render (the old version returned early before some hooks and crashed).
  const docRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('review');
  const [error, setError] = useState<string | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [signature, setSignature] = useState<{ keyId: string; recordSha256: string; signedAt: string } | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);
  // Optional machine translation of the free-text advice; the doctor edits it before it is printed.
  const [adviceLocal, setAdviceLocal] = useState('');
  const [translating, setTranslating] = useState<'idle' | 'busy' | 'unavailable'>('idle');
  const [snap, setSnap] = useState<Snapshot | null>(null);

  // Freeze what is being prescribed when the dialog opens, so the 3.5 s queue refresh (which moves to
  // the next patient after finalizing) can never change the prescription that is on screen / printed.
  useEffect(() => {
    if (isOpen && session) {
      setSnap({ session, allopathic: allopathicMeds, ayush: ayushFormulations, draft, role, openedAt: new Date() });
      setPhase('review');
      setError(null);
      setEncounterId(null);
      setSignature(null);
      setSmsNote(null);
      setAdviceLocal('');
      setTranslating('idle');
    }
    if (!isOpen) setSnap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'saving') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, phase, onClose]);

  if (!isOpen || !snap) return null;

  const s = snap.session;
  const profile = prescriber || DOCTOR_PROFILES[snap.role];
  const patientLang = isRxLang(s.language) && s.language !== 'en' ? s.language : null;
  const isAyurveda = snap.role === 'AYURVEDA';
  const medCount = snap.allopathic.length + snap.ayush.length;
  const opdNumber = `${HOSPITAL.opdPrefix}/${snap.openedAt.getFullYear()}/${s.sessionId.slice(-6).toUpperCase()}`;
  const dateText = snap.openedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeText = snap.openedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const diagnosis = formatDiagnosis(s.provisionalDiagnoses?.[0], snap.role);
  // The prescriber's own list is prescribed; the other list is what the patient already takes.
  const prescribedAyush = isAyurveda ? snap.ayush : [];
  const prescribedAllo = isAyurveda ? [] : snap.allopathic;
  const ongoing = isAyurveda ? snap.allopathic.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`) : snap.ayush.map(a => `${a.classicalName}${a.dose ? ` ${a.dose}` : ''}${a.frequency ? `, ${a.frequency}` : ''}`);
  const prescribedCount = prescribedAyush.length + prescribedAllo.length;
  const vitalsParts = [
    s.vitals?.bp ? `BP ${s.vitals.bp} mmHg` : '',
    s.vitals?.pulse ? `Pulse ${s.vitals.pulse}/min` : '',
    s.vitals?.spo2 ? `SpO2 ${s.vitals.spo2}` : '',
    s.vitals?.temp ? `Temp ${s.vitals.temp}` : ''
  ].filter(Boolean);

  const finalize = async (amend = false) => {
    setPhase('saving');
    setError(null);
    try {
      const res = await api.finalizePrescription({
        sessionId: s.sessionId,
        patientId: s.patientId,
        careStream: snap.role,
        symptoms: s.symptoms,
        pariksha: s.pariksha,
        vitals: s.vitals,
        diagnoses: s.provisionalDiagnoses,
        allopathicPrescription: snap.allopathic,
        ayushPrescription: snap.ayush,
        pathya: isAyurveda ? snap.draft.pathya : [],
        apathya: isAyurveda ? snap.draft.apathya : [],
        advice: snap.draft.advice,
        followUpDays: snap.draft.followUpDays || undefined,
        doctorNotes: snap.draft.notes,
        adviceLocal: adviceLocal.trim() || undefined,
        adviceLanguage: adviceLocal.trim() ? patientLang || undefined : undefined,
        amend
      });
      setEncounterId(res.encounterId || null);
      setSignature(res.signature || null);
      setSmsNote(res.sms?.sent ? 'The patient was sent an SMS that the medicines are ready.' : null);
      setPhase('done');
      try { sovereignSound.playCrystalChime(); } catch {}
      onFinalized?.();
    } catch (e: any) {
      console.error('[Rx] Finalize failed:', e);
      if (e?.code === 'ALREADY_FINALIZED') {
        setPhase('already');
        return;
      }
      setError(e?.name === 'AbortError' ? 'The hospital server did not respond in time.' : e?.message || 'The hospital server is not reachable.');
      setPhase('error');
      try { sovereignSound.playClinicalAlert(); } catch {}
    }
  };

  const translateAdvice = async () => {
    if (!patientLang || !snap.draft.advice.trim()) return;
    setTranslating('busy');
    try {
      const r = await api.translateTexts([snap.draft.advice], patientLang);
      setAdviceLocal(r.translations[0] || '');
      setTranslating('idle');
    } catch {
      setTranslating('unavailable');
    }
  };

  const print = () => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    printElement(docRef.current, `Prescription — ${s.patientName}`);
  };

  const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 11 };
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, verticalAlign: 'top' };

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      onClick={() => { if (phase !== 'saving') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Prescription"
    >
      <div className="w-full max-w-[920px] max-h-[94vh] flex flex-col bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Controls */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white text-slate-900 flex-wrap">
          <div>
            <h3 className="text-sm font-bold m-0">Prescription — {s.patientName}</h3>
            <span className="text-[11px] text-slate-500">{isAyurveda ? 'Ayurveda' : 'Modern medicine'} · {prescribedCount} prescribed</span>
          </div>
          <div className="flex items-center gap-2">
            {(phase === 'review' || phase === 'error') && (
              <button type="button" onClick={() => setPhase('confirm')} disabled={prescribedCount === 0 && !snap.draft.advice} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }} title={prescribedCount === 0 && !snap.draft.advice ? 'Add at least one medicine or advice first' : undefined}>
                <Send size={14} /> <span>{phase === 'error' ? 'Try again' : 'Finalize prescription'}</span>
              </button>
            )}
            {(phase === 'done' || phase === 'error') && (
              <button type="button" onClick={print} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
                <Printer size={14} /> <span>{phase === 'done' ? 'Print' : 'Print without saving'}</span>
              </button>
            )}
            <button type="button" onClick={onClose} disabled={phase === 'saving'} className="btn btn-secondary" style={{ padding: '8px 10px' }} aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Status strip */}
        {phase === 'confirm' && (
          <div className="px-5 py-3 bg-sky-50 border-b border-sky-200 flex items-center justify-between gap-3 flex-wrap text-slate-900">
            <span className="text-sm font-semibold">Save this prescription to the patient record and send it to the pharmacy? It cannot be edited afterwards.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPhase('review')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Go back</button>
              <button type="button" onClick={() => finalize(false)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
                <CheckCircle2 size={14} /> <span>Yes, finalize</span>
              </button>
            </div>
          </div>
        )}
        {phase === 'already' && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 flex-wrap text-amber-950">
            <span className="text-sm font-semibold">A prescription was already signed for this visit. Save this one as an amended prescription? Both stay in the record.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPhase('review')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Cancel</button>
              <button type="button" onClick={() => finalize(true)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>Save as amendment</button>
            </div>
          </div>
        )}
        {phase === 'saving' && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Loader2 size={16} className="animate-spin" /> Saving and signing the prescription…
          </div>
        )}
        {phase === 'done' && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 flex-wrap text-emerald-900">
            <span className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" /> Prescription signed and sent to the pharmacy{encounterId ? ` · Record ${encounterId.slice(0, 8)}` : ''}.{smsNote ? ` ${smsNote}` : ''}
            </span>
            <button type="button" onClick={print} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, background: '#059669', borderColor: '#059669' }}>
              <Printer size={14} /> <span>Print now</span>
            </button>
          </div>
        )}
        {phase === 'error' && (
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-sm font-semibold text-rose-900" role="alert">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>Not saved: {error} You can try again, or print a copy now (it will not be in the hospital record).</span>
            <RotateCcw size={14} className="hidden" />
          </div>
        )}
        {phase === 'review' && prescribedCount === 0 && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-900">
            No medicines added yet — add {isAyurveda ? 'formulations' : 'medicines'} on the prescription pad before finalizing.
          </div>
        )}

        {patientLang && snap.draft.advice.trim() && (phase === 'review' || phase === 'confirm' || phase === 'error') && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-slate-900 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold">Advice in the patient's language ({LANGUAGE_NATIVE_NAME[patientLang]}) — optional, check before printing</span>
              <button type="button" onClick={translateAdvice} disabled={translating === 'busy'} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>
                {translating === 'busy' ? 'Translating…' : adviceLocal ? 'Translate again' : 'Machine-translate advice'}
              </button>
            </div>
            {translating === 'unavailable' && <span className="text-[11px] text-amber-700">The on-premise translation model is not installed. You can type the advice in the patient's language below.</span>}
            <textarea value={adviceLocal} onChange={e => setAdviceLocal(e.target.value)} rows={2} placeholder="Type or generate the advice in the patient's language" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" />
          </div>
        )}

        {/* Printable document */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div ref={docRef} style={{ padding: '24px 28px', background: '#ffffff', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '2px solid #047857', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src={HOSPITAL.emblem} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', fontWeight: 700 }}>{HOSPITAL.authority}</div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#064e3b' }}>{HOSPITAL.name}</div>
                  <div style={{ fontSize: 11, color: '#334155' }}>{HOSPITAL.address}{HOSPITAL.phone ? ` · ${HOSPITAL.phone}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#047857', fontWeight: 700, marginTop: 2 }}>
                    {departmentName(profile.department, 'en')} · {roomLabel(profile.department, 'en')}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <RealQrCode value={encounterId && signature ? `RX|${encounterId}|${signature.recordSha256.slice(0, 32)}` : `RX-DRAFT|${opdNumber}`} size={60} level="M" title={opdNumber} />
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', marginTop: 2 }}>{opdNumber}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Patient</div><strong>{s.patientName}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Age / Sex</div><strong>{s.age ? `${s.age} y` : '—'} / {s.gender}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>ABHA</div><strong style={{ fontFamily: 'monospace' }}>{s.abhaId || 'Not linked'}</strong></div>
              <div><div style={{ fontSize: 10, color: '#64748b' }}>Date</div><strong>{dateText}, {timeText}</strong></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', marginBottom: 4 }}>Complaints</div>
                {s.symptoms.length > 0 ? s.symptoms.map((sym, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                    • <strong>{sym.name || sym.site}</strong>
                    {[characterEn(sym.character), sym.severityScore ? `${sym.severityScore}/10` : '', sym.onset].filter(Boolean).length > 0 && (
                      <span style={{ color: '#475569' }}> — {[characterEn(sym.character), sym.severityScore ? `pain ${sym.severityScore}/10` : '', sym.onset].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                )) : <div style={{ fontSize: 12, color: '#64748b' }}>As per consultation</div>}
                {s.history && (s.history.allergies || s.history.conditions.some(c => c !== 'None')) && (
                  <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4 }}>
                    {s.history.allergies ? <><strong>Allergies:</strong> {s.history.allergies}. </> : null}
                    {s.history.conditions.filter(c => c !== 'None').length > 0 ? <><strong>Known conditions:</strong> {s.history.conditions.filter(c => c !== 'None').join(', ')}.</> : null}
                  </div>
                )}
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', marginBottom: 4 }}>Examination</div>
                <div style={{ fontSize: 12 }}>{vitalsParts.length ? vitalsParts.join(' · ') : 'Vitals not recorded'}</div>
                {isAyurveda && (s.pariksha?.prakriti || s.pariksha?.agni) && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {s.pariksha?.prakriti ? `Prakriti: ${s.pariksha.prakriti}` : ''}{s.pariksha?.prakriti && s.pariksha?.agni ? ' · ' : ''}{s.pariksha?.agni ? `Agni: ${s.pariksha.agni}` : ''}
                  </div>
                )}
              </div>
            </div>

            {diagnosis && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Provisional diagnosis</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#064e3b' }}>{diagnosis.title}</div>
                {diagnosis.subtitle && <div style={{ fontSize: 12, color: '#065f46' }}>{diagnosis.subtitle}</div>}
                {diagnosis.codes.length > 0 && <div style={{ fontSize: 10.5, color: '#047857', fontFamily: 'monospace' }}>{diagnosis.codes.join(' · ')}</div>}
              </div>
            )}

            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>℞</div>
            {prescribedCount === 0 ? (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>No medicines prescribed.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ ...th, width: '5%' }}>#</th>
                    <th style={{ ...th, width: '37%' }}>Medicine</th>
                    <th style={th}>Dose</th>
                    <th style={th}>When</th>
                    <th style={th}>{isAyurveda ? 'Anupana' : 'Route'}</th>
                    <th style={th}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {[...prescribedAyush.map(a => ({ kind: 'ayush' as const, a })), ...prescribedAllo.map(m => ({ kind: 'allo' as const, m }))].map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ ...td, fontWeight: 700 }}>{i + 1}</td>
                      {row.kind === 'ayush' ? (
                        <>
                          <td style={td}><strong>{row.a.classicalName}</strong>{row.a.dosageForm ? <div style={{ fontSize: 9.5, color: '#64748b' }}>{row.a.dosageForm}{row.a.namasteCode ? ` · ${row.a.namasteCode}` : ''}</div> : null}</td>
                          <td style={td}>{row.a.dose || '—'}</td>
                          <td style={td}>{row.a.frequency || '—'}</td>
                          <td style={td}>{row.a.anupana || '—'}</td>
                          <td style={td}>{row.a.durationDays || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td style={td}><strong>{row.m.name}</strong>{row.m.genericName && row.m.genericName !== row.m.name ? <div style={{ fontSize: 9.5, color: '#64748b' }}>{row.m.genericName}</div> : null}</td>
                          <td style={td}>{row.m.dosage || '—'}</td>
                          <td style={td}>{row.m.frequency || '—'}</td>
                          <td style={td}>{isAyurveda ? '—' : row.m.route || 'Oral'}</td>
                          <td style={td}>{row.m.durationDays || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {patientLang && prescribedCount > 0 && (() => {
              const rows = [
                ...prescribedAyush.map(a => ({ name: a.classicalName, text: buildInstruction({ dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }, patientLang) })),
                ...prescribedAllo.map(m => ({ name: m.name, text: buildInstruction({ dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays }, patientLang) }))
              ].filter(r => r.text);
              return rows.length ? (
                <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#075985', marginBottom: 4 }}>How to take your medicines · {LANGUAGE_NATIVE_NAME[patientLang]}</div>
                  {rows.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 2 }}><strong>{r.name}:</strong> {r.text}</div>
                  ))}
                </div>
              ) : null;
            })()}

            {ongoing.length > 0 && (
              <div style={{ fontSize: 11.5, color: '#334155', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>
                <strong>{isAyurveda ? 'Ongoing modern medicines' : 'Ongoing Ayurvedic / herbal medicines'} (not prescribed here; checked for interactions):</strong> {ongoing.join('; ')}
              </div>
            )}

            {isAyurveda && (snap.draft.pathya.length > 0 || snap.draft.apathya.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12 }}>
                <div><strong style={{ color: '#047857' }}>Pathya (follow):</strong> {snap.draft.pathya.join(', ') || '—'}</div>
                <div><strong style={{ color: '#b91c1c' }}>Apathya (avoid):</strong> {snap.draft.apathya.join(', ') || '—'}</div>
              </div>
            )}

            {(snap.draft.advice || snap.draft.followUpDays) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12 }}>
                {snap.draft.advice && <div><strong>Advice:</strong> {snap.draft.advice}</div>}
                {adviceLocal.trim() && patientLang && <div style={{ marginTop: 4, fontSize: 13 }}><strong>{LANGUAGE_NATIVE_NAME[patientLang]}:</strong> {adviceLocal}</div>}
                {snap.draft.followUpDays ? <div style={{ marginTop: 4 }}><strong>Review after:</strong> {snap.draft.followUpDays} days</div> : null}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: 12, marginTop: 18 }}>
              <div style={{ fontSize: 9.5, color: '#64748b', maxWidth: '55%' }}>
                {phase === 'done' && signature
                  ? <>Digitally signed (Ed25519) on {new Date(signature.signedAt).toLocaleString('en-IN')} · key {signature.keyId} · record {signature.recordSha256.slice(0, 16)}… The pharmacy verifies this before dispensing. </>
                  : 'Draft — not yet saved or signed. '}
                Bring this prescription on your next visit.
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ width: 160, borderBottom: '1px solid #94a3b8', height: 26, marginLeft: 'auto' }} />
                <div style={{ fontSize: 12, fontWeight: 800 }}>{profile.name}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{profile.title}</div>
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>{profile.registration}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
