import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, RefreshCw, Volume2, VolumeX, MapPin, Users, X, CheckCircle2, AlertOctagon, WifiOff, Clock, Loader2 } from 'lucide-react';
import { api, IntakeResult, KioskConsent } from '../../services/api';
import { SocratesSymptom, DashavidhaPariksha, VitalsData, PatientHistory } from '../../types/api';
import { printThermalSlip } from '../../utils/thermalPrint';
import { speak, stopSpeaking } from '../../utils/speech';
import { sovereignSound } from '../../utils/audio';
import { RealQrCode } from '../common/RealQrCode';
import { BCP47, PAIN_CHARACTERS, kioskText, normalizeLang, regionName } from '../../utils/kioskLocalization';
import { DEPARTMENTS, DepartmentCode, departmentName, floorName, roomLabel, routeCheckIn, tokenFromSession } from '../../utils/hospitalDirectory';
import { printElement } from '../../utils/printDocument';
import { KioskPatient } from './Step2AbhaAuth';

interface Step7TokenSummaryProps {
  patient: KioskPatient;
  symptoms: SocratesSymptom[];
  pariksha: DashavidhaPariksha;
  history: PatientHistory;
  vitals: VitalsData;
  redFlags: string[];
  scannedDocs?: any[];
  transcript?: string;
  language?: string;
  sessionId: string;
  /** Token, department and queue position issued by the server (absent when offline). */
  ticket?: IntakeResult | null;
  consent?: KioskConsent;
  isOffline?: boolean;
  causalDagOverride?: any;
  mlcCaseInfo?: any;
  airborneIsolationInfo?: any;
  onReset: () => void;
}

interface FamilyMember { name: string; age: string; gender: 'MALE' | 'FEMALE' | 'OTHER'; relationship: string; chiefComplaint: string }
const emptyMember = (): FamilyMember => ({ name: '', age: '', gender: 'FEMALE', relationship: '', chiefComplaint: '' });

export const Step7TokenSummary: React.FC<Step7TokenSummaryProps> = ({
  patient,
  symptoms,
  history,
  vitals,
  redFlags,
  scannedDocs = [],
  transcript = '',
  language = 'hi',
  sessionId,
  ticket,
  consent,
  isOffline = false,
  causalDagOverride,
  mlcCaseInfo,
  airborneIsolationInfo,
  onReset
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);
  const slipRef = useRef<HTMLDivElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [position, setPosition] = useState<{ ahead: number; estimatedWaitMinutes: number; status: string; calledAt: string | null } | null>(
    ticket ? { ahead: ticket.ahead ?? 0, estimatedWaitMinutes: ticket.estimatedWaitMinutes ?? 0, status: ticket.status, calledAt: null } : null
  );
  const [printState, setPrintState] = useState<'idle' | 'printing' | 'printed' | 'failed'>('idle');
  const [issuedAt] = useState(() => new Date());

  const isEmergency = redFlags.length > 0 || symptoms.some(s => (s.severityScore || 0) >= 8 && s.isEmergency) || !!causalDagOverride?.triggered || ticket?.triagePriority === 'EMERGENCY_RED_FLAG';
  const localDept = useMemo(() => routeCheckIn({
    careStream: patient.careStream,
    age: patient.age,
    gender: patient.gender,
    isPregnant: patient.isPregnant,
    isEmergency,
    isAirborne: !!airborneIsolationInfo?.isAirborneRisk,
    isMlc: !!mlcCaseInfo?.isMlc,
    complaintText: [...symptoms.map(s => `${s.site} ${s.name || ''}`), transcript].join(' ')
  }), [patient, isEmergency, airborneIsolationInfo, mlcCaseInfo, symptoms, transcript]);
  // The server decides the department and issues a unique daily token; offline we fall back to a local estimate.
  const deptCode: DepartmentCode = ticket?.department && ticket.department in DEPARTMENTS ? (ticket.department as DepartmentCode) : localDept;
  const dept = DEPARTMENTS[deptCode];
  const token = ticket?.tokenNo || tokenFromSession(deptCode, sessionId || 'offline');

  // Keep the position fresh while the patient is still looking at the screen.
  useEffect(() => {
    if (isOffline || !sessionId || !ticket) return;
    let alive = true;
    const poll = async () => {
      const p = await api.getQueuePosition(sessionId);
      if (alive && p) setPosition(p);
    };
    const t = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(t); stopSpeaking(); sovereignSound.stopSpeech(); };
  }, [isOffline, sessionId, ticket]);

  const called = position?.status === 'IN_CONSULTATION' || !!position?.calledAt;
  const ahead = position && position.status === 'PENDING_DOCTOR' ? position.ahead : -1;
  const waitMins = position ? position.estimatedWaitMinutes : null;

  // Print automatically on the kiosk's thermal printer if it has one.
  useEffect(() => {
    let alive = true;
    setPrintState('printing');
    printThermalSlip({
      hospital: tx('hospitalName'),
      title: tx('s7Token'),
      token,
      lines: [
        { text: `${roomLabel(deptCode, lang)} · ${floorName(dept.floor, lang)}`, size: 30, bold: true },
        { text: departmentName(deptCode, lang), size: 24 },
        { text: isEmergency ? tx('s7Immediate') : waitMins !== null ? `${tx('s7Wait')}: ${tx('s7WaitMins', { n: waitMins })}` : '', size: 24 },
        { text: `${patient.name || ''}${patient.age ? ` · ${patient.age}` : ''}`, size: 22 },
        { text: `${issuedAt.toLocaleDateString('en-IN')} ${issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, size: 20 }
      ].filter(l => l.text),
      qr: `OPD|${token}|${sessionId}`
    }).then(ok => { if (alive) setPrintState(ok ? 'printed' : 'idle'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnnounce = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    sovereignSound.playMechanicalSnap();
    setIsSpeaking(true);
    speak(
      tx('s7AnnounceText', {
        token,
        name: patient.name || tx('patientFallback'),
        room: roomLabel(deptCode, lang),
        floor: floorName(dept.floor, lang),
        mins: waitMins ?? '—'
      }),
      lang
    ).finally(() => setIsSpeaking(false));
  };

  const handlePrint = async () => {
    sovereignSound.playMechanicalSnap();
    setPrintState('printing');
    const ok = await printThermalSlip({
      hospital: tx('hospitalName'),
      title: tx('s7Token'),
      token,
      lines: [
        { text: `${roomLabel(deptCode, lang)} · ${floorName(dept.floor, lang)}`, size: 30, bold: true },
        { text: departmentName(deptCode, lang), size: 24 },
        { text: `${patient.name || ''}${patient.age ? ` · ${patient.age}` : ''}`, size: 22 }
      ],
      qr: `OPD|${token}|${sessionId}`
    });
    if (ok) {
      setPrintState('printed');
      return;
    }
    // No thermal printer: use the normal printer dialog.
    setPrintState('idle');
    printElement(slipRef.current, `${token} · ${patient.name || ''}`);
  };

  const characterLabel = (value?: string) => {
    const match = PAIN_CHARACTERS.find(c => c.value === value);
    return match ? tx(match.key) : '';
  };

  const vitalsParts = [
    vitals.bp ? `${tx('vBp')}: ${vitals.bp}` : '',
    vitals.pulse ? `${tx('vPulse')}: ${vitals.pulse}` : '',
    vitals.spo2 ? `SpO2: ${vitals.spo2}` : '',
    vitals.temp ? `${tx('vTemp')}: ${vitals.temp}` : ''
  ].filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto py-3 px-2">
      <div className="text-center mb-4">
        <div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-600">
          <CheckCircle2 size={26} />
        </div>
        <h2 className="text-2xl font-heading font-extrabold text-foreground">{tx('s7Title')}</h2>
      </div>

      {isEmergency && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/60 flex items-center gap-3 text-rose-800 dark:text-rose-200 font-bold" role="alert">
          <AlertOctagon size={22} className="shrink-0" />
          <span>{tx('s7Emergency')}</span>
        </div>
      )}
      {called && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-600 text-white flex items-center gap-3 font-extrabold text-lg animate-pulse" role="alert">
          <CheckCircle2 size={24} className="shrink-0" />
          <span>{tx('s7Called', { room: dept.room })}</span>
        </div>
      )}
      {printState !== 'idle' && (
        <div className={`mb-3 p-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${printState === 'printed' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40' : printState === 'failed' ? 'bg-amber-500/10 text-amber-900 border border-amber-500/40' : 'bg-muted text-muted-foreground'}`} role="status">
          {printState === 'printing' && <Loader2 size={15} className="animate-spin" />}
          {printState === 'printing' ? tx('s7Printing') : printState === 'printed' ? tx('s7Printed') : tx('s7PrintFailed')}
        </div>
      )}
      {consent?.purposes.sms && ticket?.smsConfigured && !isOffline && (
        <div className="mb-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sm font-semibold text-sky-900 dark:text-sky-100">{tx('s7SmsSent')}</div>
      )}
      {isOffline && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/50 flex items-center gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
          <WifiOff size={18} className="shrink-0" />
          <span>{tx('s7Offline')}</span>
        </div>
      )}

      {/* Printable slip */}
      <div ref={slipRef} className="bg-white text-slate-900 border border-slate-300 rounded-2xl p-5 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4">
          <img src="/ashoka-stambh-hd.png" alt="" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <div className="text-base font-extrabold leading-tight">{tx('hospitalName')}</div>
            <div className="text-xs text-slate-600">
              {issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-center sm:text-left">
            <div className="text-xs font-semibold text-slate-600">{tx('s7Token')}</div>
            <div className="text-4xl font-mono font-extrabold tracking-tight">{token}</div>
            <div className={`mt-1 text-sm font-bold ${isEmergency ? 'text-rose-700' : 'text-slate-700'}`}>
              {isEmergency ? tx('s7Immediate') : ahead === 0 ? tx('s7Next') : ahead > 0 ? tx('s7Ahead', { n: ahead }) : ''}
            </div>
          </div>
          <div className="p-1.5 bg-white rounded-lg border border-slate-300">
            <RealQrCode value={`OPD|${token}|${sessionId}`} size={88} level="M" title={token} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
          <div className="sm:col-span-2">
            <div className="text-xs font-semibold text-slate-600">{tx('s7Room')}</div>
            <div className="text-lg font-extrabold">{roomLabel(deptCode, lang)} · {floorName(dept.floor, lang)}</div>
            <div className="text-slate-700">{departmentName(deptCode, lang)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">{tx('s7Doctor')}</div>
            <div className="font-semibold">{dept.doctor}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Clock size={12} /> {tx('s7Wait')}</div>
            <div className="font-semibold">{isEmergency ? tx('s7Immediate') : waitMins !== null ? tx('s7WaitMins', { n: waitMins }) : '—'}</div>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-300 my-4" />

        <div className="text-sm space-y-2">
          <div>
            <span className="text-xs font-semibold text-slate-600">{tx('s7PatientDetails')}: </span>
            <span className="font-semibold">{patient.name || tx('patientFallback')}</span>
            {patient.age ? <span> · {patient.age}</span> : null}
            <span> · {patient.gender === 'FEMALE' ? tx('s2Female') : patient.gender === 'MALE' ? tx('s2Male') : tx('s2Other')}</span>
            {patient.abhaId ? <span className="font-mono text-xs"> · ABHA {patient.abhaId}</span> : null}
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">{tx('s7Complaints')}: </span>
            {symptoms.length > 0
              ? symptoms.map(s => [s.labelLocal || (s.site !== 'General' ? regionName(s.site, lang) : '') || s.name, characterLabel(s.character), s.severityScore ? `${s.severityScore}/10` : ''].filter(Boolean).join(' · ')).join('; ')
              : transcript || '—'}
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">{tx('s7Vitals')}: </span>
            {vitalsParts.length > 0 ? <span className="font-mono">{vitalsParts.join(' · ')}</span> : <span className="italic text-slate-600">{tx('s7VitalsNone')}</span>}
          </div>
          {(history.conditions.filter(c => c !== 'None').length > 0 || history.allergies || history.currentMedicines) && (
            <div>
              <span className="text-xs font-semibold text-slate-600">{tx('s7History')}: </span>
              {[history.conditions.filter(c => c !== 'None').join(', '), history.allergies ? `${tx('s7Allergy')}: ${history.allergies}` : '', history.currentMedicines ? `${tx('s7Medicines')}: ${history.currentMedicines}` : ''].filter(Boolean).join(' · ')}
            </div>
          )}
          {scannedDocs.length > 0 && <div className="text-slate-700">{tx('s7Docs', { n: scannedDocs.length })}</div>}
        </div>

        <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-500">{sessionId}</div>
      </div>

      {/* Actions (not printed) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
        <button type="button" onClick={handlePrint} className="tactile-btn py-3 px-3 text-sm font-bold gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 justify-center">
          <Printer size={16} /> {tx('s7Print')}
        </button>
        <button type="button" onClick={handleAnnounce} className="tactile-btn py-3 px-3 text-sm font-semibold gap-2 rounded-xl justify-center">
          {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />} {isSpeaking ? tx('s7StopVoice') : tx('s7Announce')}
        </button>
        <button type="button" onClick={() => setShowDirections(true)} className="tactile-btn py-3 px-3 text-sm font-semibold gap-2 rounded-xl justify-center">
          <MapPin size={16} /> {tx('s7Directions')}
        </button>
        <button type="button" onClick={() => setShowFamily(true)} className="tactile-btn py-3 px-3 text-sm font-semibold gap-2 rounded-xl justify-center">
          <Users size={16} /> {tx('s7Family')}
        </button>
      </div>
      <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onReset(); }} className="w-full mt-3 btn btn-primary py-3 rounded-xl text-sm font-bold gap-2">
        <RefreshCw size={16} /> {tx('s7Done')}
      </button>

      {showDirections && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-card border border-border max-w-md w-full p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-heading font-extrabold text-lg text-foreground">{roomLabel(deptCode, lang)}</h3>
                <p className="text-sm text-muted-foreground">{departmentName(deptCode, lang)}</p>
              </div>
              <button type="button" onClick={() => setShowDirections(false)} className="p-1 rounded-lg hover:bg-muted" aria-label={tx('close')}><X size={18} /></button>
            </div>
            <ol className="space-y-3 mb-5">
              {[dept.floor === 0 ? tx('wayGround') : tx('wayLift', { floor: floorName(dept.floor, lang) }), tx('wayFollow', { room: roomLabel(deptCode, lang) }), tx('wayShow')].map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center font-mono font-bold text-xs shrink-0">{idx + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setShowDirections(false)} className="w-full btn btn-primary py-2.5 rounded-xl text-sm font-bold">{tx('s7GotIt')}</button>
          </div>
        </div>
      )}

      {showFamily && (
        <FamilyModal language={lang} masterPhone={patient.phone || ''} careStream={patient.careStream} consent={consent} onClose={() => setShowFamily(false)} />
      )}
    </div>
  );
};

const FamilyModal: React.FC<{ language: string; masterPhone: string; careStream: KioskPatient['careStream']; consent?: KioskConsent; onClose: () => void }> = ({ language, masterPhone, careStream, consent, onClose }) => {
  const tx = kioskText(language);
  const [members, setMembers] = useState<FamilyMember[]>([emptyMember()]);
  const [tokens, setTokens] = useState<any[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<FamilyMember>) => setMembers(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const submit = async () => {
    if (members.some(m => !m.name.trim() || !(parseInt(m.age, 10) >= 0))) {
      setError(tx('famNeedName'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.submitFamilyIntake(masterPhone, members.map(m => ({
        name: m.name.trim(),
        age: parseInt(m.age, 10),
        gender: m.gender,
        relationship: m.relationship || 'Family member',
        chiefComplaint: m.chiefComplaint
      })) as any, {
        // The adult registering the family agrees on their behalf (recorded as assisted consent).
        consent: { purposes: { care: true, abha_link: false, sms: false, research: !!consent?.purposes.research }, language, method: 'kiosk_assisted' },
        careStream,
        language
      });
      setTokens((res as any).familyTokens || (res as any).tokens || []);
      sovereignSound.playCrystalChime();
    } catch (e) {
      console.error('[Kiosk] Family registration failed:', e);
      setError(tx('famFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg';
  return (
    <div className="fixed inset-0 z-[1100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border max-w-xl w-full p-6 rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-heading font-extrabold text-lg text-foreground">{tx('famTitle')}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-muted" aria-label={tx('close')}><X size={18} /></button>
        </div>
        {!tokens ? (
          <div className="space-y-3">
            {members.map((m, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={m.name} onChange={e => update(idx, { name: e.target.value })} placeholder={tx('s2Name')} className={inputCls} />
                  <div className="flex gap-1.5">
                    <input value={m.age} inputMode="numeric" onChange={e => update(idx, { age: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder={tx('s2Age')} className={`${inputCls} w-20`} />
                    <select value={m.gender} onChange={e => update(idx, { gender: e.target.value as FamilyMember['gender'] })} className={inputCls}>
                      <option value="MALE">{tx('s2Male')}</option>
                      <option value="FEMALE">{tx('s2Female')}</option>
                      <option value="OTHER">{tx('s2Other')}</option>
                    </select>
                  </div>
                  <input value={m.relationship} onChange={e => update(idx, { relationship: e.target.value })} placeholder={tx('famRelation')} className={inputCls} />
                </div>
                <input value={m.chiefComplaint} onChange={e => update(idx, { chiefComplaint: e.target.value })} placeholder={tx('famComplaint')} className={inputCls} />
                {members.length > 1 && (
                  <button type="button" onClick={() => setMembers(prev => prev.filter((_, i) => i !== idx))} className="text-xs font-semibold text-rose-600">{tx('remove')}</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setMembers(prev => [...prev, emptyMember()])} className="text-sm font-semibold text-primary">+ {tx('famAddMore')}</button>
            <p className={`min-h-[18px] text-xs font-semibold ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || '·'}</p>
            <button type="button" disabled={submitting} onClick={submit} className="w-full btn btn-primary py-2.5 rounded-xl text-sm font-bold gap-2">
              {submitting && <Loader2 size={15} className="animate-spin" />} {tx('famSubmit')}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tokens.map((ft, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-foreground">{ft.patientName || ft.name}</div>
                  <div className="text-xs text-muted-foreground">{ft.departmentCode && ft.departmentCode in DEPARTMENTS ? departmentName(ft.departmentCode, language) : ft.department} · {roomLabel((ft.departmentCode in DEPARTMENTS ? ft.departmentCode : 'GENMED') as DepartmentCode, language)}</div>
                </div>
                <div className="text-xl font-mono font-extrabold text-primary">{ft.tokenNumber}</div>
              </div>
            ))}
            <button type="button" onClick={onClose} className="w-full btn btn-primary py-2.5 rounded-xl text-sm font-bold">{tx('s7GotIt')}</button>
          </div>
        )}
      </div>
    </div>
  );
};
