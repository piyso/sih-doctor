import React, { useEffect, useState } from 'react';
import { User, Heart, Flame, Wind, Activity, Pencil, Check, X, Loader2, Leaf, Pill, ClipboardList, Info } from 'lucide-react';
import { SessionDetail, SocratesSymptom, VitalsData } from '../../types/api';
import { PAIN_CHARACTERS, kioskText } from '../../utils/kioskLocalization';
import {
  STATUS_TONE, VITAL_LIMITS, VitalStatus, bpStatus, normaliseTempF, parseBp, parseNumber, pulseStatus, spo2Status, tempStatus
} from '../../utils/vitals';
import { DoctorRole, formatDiagnosis } from './doctorRole';

interface PreIntakePanelProps {
  session: SessionDetail | null;
  role: DoctorRole;
  onSaveVitals: (vitals: VitalsData) => Promise<boolean>;
}

const STATUS_LABEL: Record<VitalStatus, string> = {
  empty: 'Not recorded', invalid: 'Check value', normal: 'Normal', low: 'Low', veryLow: 'Very low', high: 'High', veryHigh: 'Very high', fever: 'Fever'
};

const BP_DETAIL = (sys: number | null, dia: number | null) => {
  if (sys === null || dia === null) return '';
  if (sys >= 180 || dia >= 120) return 'Hypertensive crisis range';
  if (sys >= 140 || dia >= 90) return 'Stage 2 hypertension range';
  if (sys >= 130 || dia >= 80) return 'Stage 1 hypertension range';
  if (sys < 90) return 'Hypotension';
  return '';
};

const PRIORITY_INFO: Record<string, { label: string; tone: string; help: string }> = {
  EMERGENCY_RED_FLAG: { label: 'Emergency', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', help: 'Red-flag symptoms or critical vitals — needs immediate assessment.' },
  HIGH_PRIORITY: { label: 'Priority', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', help: 'Abnormal vitals or severe symptoms — see before routine patients.' },
  ROUTINE: { label: 'Routine', tone: 'bg-muted text-foreground border-border/80', help: 'Stable — seen in OPD order.' }
};

/** One heading style for every block of the intake, so the column reads top-to-bottom without coloured boxes. */
const Section: React.FC<{ title: React.ReactNode; right?: React.ReactNode; tone?: 'default' | 'ayurveda'; children: React.ReactNode }> = ({ title, right, tone = 'default', children }) => (
  <section className="pt-3 border-t border-border/70 first:border-t-0 first:pt-0">
    <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[22px]">
      <h4 className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 m-0 ${tone === 'ayurveda' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{title}</h4>
      {right}
    </div>
    {children}
  </section>
);

const characterEn = (value?: string) => {
  const match = PAIN_CHARACTERS.find(c => c.value === value);
  return match ? kioskText('en')(match.key) : value || '';
};

export const PreIntakePanel: React.FC<PreIntakePanelProps> = ({ session, role, onSaveVitals }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ sys: '', dia: '', pulse: '', spo2: '', temp: '', rr: '', avpu: '', o2: false, weight: '', sugar: '' });

  const loadForm = (v: VitalsData = {}) => {
    const { sys, dia } = parseBp(v.bp);
    setForm({
      sys: sys?.toString() || '',
      dia: dia?.toString() || '',
      pulse: parseNumber(v.pulse)?.toString() || '',
      spo2: parseNumber(v.spo2)?.toString() || '',
      temp: parseNumber(v.temp)?.toString() || '',
      rr: parseNumber(v.respiratoryRate)?.toString() || '',
      avpu: (v.consciousness || '').toString().charAt(0).toUpperCase(),
      o2: v.onOxygen === true,
      weight: parseNumber(v.weightKg)?.toString() || '',
      sugar: parseNumber(v.bloodSugar)?.toString() || ''
    });
  };

  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    loadForm(session?.vitals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  if (!session) {
    return (
      <div className="physical-card p-10 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60">
          <User size={24} />
        </div>
        <div>
          <h4 className="text-xs font-heading font-bold text-foreground mb-1">No patient selected</h4>
          <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">Choose a patient from the queue to see their kiosk intake and vitals.</p>
        </div>
      </div>
    );
  }

  // Live interpretation of whatever is in the form (edit mode) or saved (view mode).
  const sys = parseNumber(form.sys);
  const dia = parseNumber(form.dia);
  const pulse = parseNumber(form.pulse);
  const spo2 = parseNumber(form.spo2);
  const tempF = normaliseTempF(form.temp);
  const status = {
    bp: bpStatus(sys, dia),
    pulse: pulseStatus(pulse),
    spo2: spo2Status(spo2),
    temp: tempStatus(tempF)
  };
  const hasInvalid = Object.values(status).includes('invalid');

  const handleSave = async () => {
    if (hasInvalid) {
      setSaveError('Fix the highlighted values before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const vitals: VitalsData = {
      bp: sys !== null && dia !== null ? `${sys}/${dia}` : undefined,
      pulse: pulse !== null ? Math.round(pulse) : undefined,
      spo2: spo2 !== null ? `${Math.round(spo2)}%` : undefined,
      temp: tempF !== null ? `${tempF}°F` : undefined
    };
    const payload: any = {};
    (['bp', 'pulse', 'spo2', 'temp'] as const).forEach(k => { payload[k] = vitals[k] ?? null; });
    const rr = parseNumber(form.rr);
    const w = parseNumber(form.weight);
    const sugar = parseNumber(form.sugar);
    if (rr !== null && (rr < 4 || rr > 80)) { setSaving(false); setSaveError('Respiratory rate should be 4–80 /min.'); return; }
    if (w !== null && (w < 0.5 || w > 300)) { setSaving(false); setSaveError('Weight should be 0.5–300 kg.'); return; }
    payload.respiratoryRate = rr !== null ? Math.round(rr) : null;
    payload.consciousness = form.avpu || null;
    payload.onOxygen = form.o2 ? true : null;
    payload.weightKg = w;
    payload.bloodSugar = sugar !== null ? Math.round(sugar) : null;
    const ok = await onSaveVitals(payload);
    setSaving(false);
    if (ok) setEditing(false);
    else setSaveError('Could not save — the hospital server is not reachable.');
  };

  const primary = session.symptoms?.[0];
  const priority = PRIORITY_INFO[session.triagePriority] || PRIORITY_INFO.ROUTINE;
  const isAyurveda = role === 'AYURVEDA';
  const hasPariksha = !!(session.pariksha?.prakriti || session.pariksha?.agni || session.pariksha?.sara || session.pariksha?.prakritiScreen?.provisional || session.pariksha?.energySelfReport);
  // What the patient said about each complaint, in the doctor's words: site, character, since when, spread, worse /
  // better with, when it comes, how it started.
  const complaintDetail = (s: SocratesSymptom) => [
    s.site && s.site !== 'General' && s.name && !s.name.includes(s.site) ? s.site : '',
    characterEn(s.character),
    s.onset,
    s.onsetType === 'Sudden' ? 'sudden onset' : s.onsetType === 'Gradual' ? 'gradual onset' : '',
    s.radiation ? `radiates to ${s.radiation}` : '',
    s.exacerbatingFactors?.length ? `worse with ${s.exacerbatingFactors.join(', ').toLowerCase()}` : '',
    s.relievingFactors?.length ? `better with ${s.relievingFactors.join(', ').toLowerCase()}` : '',
    s.timing && s.timing !== s.onset ? s.timing.toLowerCase() : ''
  ].filter(Boolean);
  // A blank answer was never "none": say whether the patient denied it, was unsure, or was not asked.
  const answered = (text: string | undefined, status: 'none' | 'unknown' | 'listed' | undefined, none: string) =>
    status === 'none' ? none : status === 'unknown' && !text ? 'Patient not sure' : text || 'Not answered — ask the patient';
  const history = session.history;
  const summary = session.historySummary;
  const vitalsAssessment = session.vitalsAssessment;
  const ctx = session.patientContext;
  const SECTION_TONE: Record<string, string> = {
    complete: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    not_asked: 'bg-muted text-muted-foreground border-border/70'
  };
  const NEWS_TONE: Record<string, string> = {
    HIGH: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    LOW_MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    LOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
  };

  const vitalTile = (
    key: 'bp' | 'pulse' | 'spo2' | 'temp',
    label: string,
    icon: React.ReactNode,
    unit: string,
    display: string,
    detail = ''
  ) => (
    <div className={`p-2.5 rounded-xl border bg-card flex flex-col gap-1 ${status[key] === 'normal' || status[key] === 'empty' ? 'border-border/80' : status[key] === 'veryHigh' || status[key] === 'veryLow' ? 'border-rose-500/50' : 'border-amber-500/50'}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">{icon}{label}</span>
        {status[key] !== 'empty' && (editing || status[key] !== 'normal') && (
          <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${STATUS_TONE[status[key]]}`}>{STATUS_LABEL[status[key]]}</span>
        )}
      </div>
      {editing ? (
        key === 'bp' ? (
          <div className="flex items-center gap-1">
            <input aria-label="Systolic" inputMode="numeric" value={form.sys} onChange={e => setForm(f => ({ ...f, sys: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="120" className="w-full px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm font-bold" />
            <span className="text-muted-foreground">/</span>
            <input aria-label="Diastolic" inputMode="numeric" value={form.dia} onChange={e => setForm(f => ({ ...f, dia: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="80" className="w-full px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm font-bold" />
          </div>
        ) : (
          <input
            aria-label={label}
            inputMode="decimal"
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))}
            placeholder={key === 'pulse' ? '72' : key === 'spo2' ? '98' : '98.6'}
            className="w-full px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm font-bold"
          />
        )
      ) : (
        <div className="font-mono text-sm font-extrabold text-foreground">{display || '—'} {display && <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>}</div>
      )}
      {(status[key] === 'invalid' || detail) && <div className="text-[9.5px] leading-tight text-muted-foreground">{status[key] === 'invalid' ? `Expected ${VITAL_LIMITS[key === 'bp' ? 'sys' : key][0]}–${VITAL_LIMITS[key === 'bp' ? 'sys' : key][1]}` : detail}</div>}
    </div>
  );

  return (
    <div className="physical-card p-4 flex flex-col gap-3">
      {/* Who and what kind of visit. Name, age, allergies and pregnancy are in the safety banner above. */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        <span className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold uppercase cursor-help ${priority.tone}`} title={priority.help}>{priority.label}</span>
        <span className="flex items-center gap-1">
          {session.careStream === 'AYURVEDA' ? <><Leaf size={11} className="text-emerald-600" /> Wants Ayurveda</> : session.careStream === 'ALLOPATHY' ? <><Pill size={11} className="text-sky-600" /> Wants modern medicine</> : 'No doctor preference'}
        </span>
        {session.abhaId && <span className="font-mono">· ABHA {session.abhaId}</span>}
      </div>

      {/* Vitals: view + edit with instant interpretation */}
      <Section
        title={<>Vitals
            {vitalsAssessment?.applicable && (
              <span className={`px-1.5 py-0.5 rounded border font-mono text-[9.5px] font-bold normal-case tracking-normal ${NEWS_TONE[vitalsAssessment.band]}`} title={`${vitalsAssessment.clinicalResponse} (${vitalsAssessment.reference})`}>
                NEWS2 {vitalsAssessment.news2}{vitalsAssessment.selfReported ? ' · unverified' : ''}
              </span>
            )}</>}
        right={editing ? (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => { setEditing(false); setSaveError(null); loadForm(session.vitals); }} className="px-2 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted flex items-center gap-1">
                <X size={12} /> Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-primary-foreground flex items-center gap-1 disabled:opacity-60">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save vitals
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1">
              <Pencil size={12} /> {Object.values(status).every(s => s === 'empty') ? 'Record vitals' : 'Edit vitals'}
            </button>
          )}
      >
        <div className="vitals-4-grid">
          {vitalTile('bp', 'BP', <Activity size={10} />, 'mmHg', sys !== null && dia !== null ? `${sys}/${dia}` : '', BP_DETAIL(sys, dia))}
          {vitalTile('pulse', 'Pulse', <Heart size={10} />, 'bpm', pulse !== null ? String(pulse) : '')}
          {vitalTile('spo2', 'SpO2', <Wind size={10} />, '%', spo2 !== null ? String(spo2) : '')}
          {vitalTile('temp', 'Temp', <Flame size={10} />, '°F', tempF !== null ? String(tempF) : '', form.temp && tempF !== parseNumber(form.temp) ? `${form.temp}°C converted` : '')}
        </div>
        {/* NEWS2 needs respiratory rate, consciousness (AVPU) and oxygen; weight drives children's doses. */}
        {editing ? (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <label className="flex flex-col gap-0.5 w-20"><span className="text-[10px] font-mono uppercase text-muted-foreground">Resp. rate</span><input inputMode="numeric" aria-label="Respiratory rate" value={form.rr} onChange={e => setForm(f => ({ ...f, rr: e.target.value.replace(/\D/g, '').slice(0, 2) }))} placeholder="16" className="px-2 py-1 rounded-lg border border-border bg-background font-mono font-bold" /></label>
            <label className="flex flex-col gap-0.5 w-28"><span className="text-[10px] font-mono uppercase text-muted-foreground">AVPU</span>
              <select aria-label="Consciousness (AVPU)" value={form.avpu} onChange={e => setForm(f => ({ ...f, avpu: e.target.value }))} className="px-2 py-1 rounded-lg border border-border bg-background">
                <option value="">—</option><option value="A">Alert</option><option value="C">New confusion</option><option value="V">Voice</option><option value="P">Pain</option><option value="U">Unresponsive</option>
              </select></label>
            <label className="flex items-center gap-1.5 mt-4"><input type="checkbox" checked={form.o2} onChange={e => setForm(f => ({ ...f, o2: e.target.checked }))} /> On oxygen</label>
            <label className="flex flex-col gap-0.5 w-20"><span className="text-[10px] font-mono uppercase text-muted-foreground">Weight kg</span><input inputMode="decimal" aria-label="Weight" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))} placeholder="60" className="px-2 py-1 rounded-lg border border-border bg-background font-mono font-bold" /></label>
            <label className="flex flex-col gap-0.5 w-24"><span className="text-[10px] font-mono uppercase text-muted-foreground">Sugar mg/dL</span><input inputMode="numeric" aria-label="Blood sugar" value={form.sugar} onChange={e => setForm(f => ({ ...f, sugar: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="110" className="px-2 py-1 rounded-lg border border-border bg-background font-mono font-bold" /></label>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
            <span>RR {session.vitals?.respiratoryRate ?? '—'}</span>
            <span>AVPU {session.vitals?.consciousness || '—'}{session.vitals?.onOxygen ? ' · on O₂' : ''}</span>
            <span className={!session.vitals?.weightKg && !session.weightKg && session.age < 12 ? 'text-amber-700 font-bold' : ''}>Weight {session.vitals?.weightKg || session.weightKg || '—'} kg</span>
            <span>Sugar {session.vitals?.bloodSugar ?? '—'}</span>
            {session.vitals?.recordedBy && <span>· measured by {session.vitals.recordedBy}</span>}
          </div>
        )}
        {saveError && <p className="mt-1 text-xs font-semibold text-rose-600" role="alert">{saveError}</p>}
      </Section>

      {/* Presenting complaint */}
      <Section
        title="Presenting complaints"
        right={primary && primary.severityScore > 0 ? (
          <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${primary.severityScore >= 8 ? 'bg-rose-500/15 text-rose-700' : 'bg-muted text-foreground border border-border/70'}`}>
            Pain {primary.severityScore}/10
          </span>
        ) : undefined}
      >
        {session.symptoms && session.symptoms.some(s => !(s as { isNegated?: boolean }).isNegated) ? (
          <ul className="text-xs text-foreground space-y-1.5 leading-relaxed">
            {session.symptoms.filter(s => !(s as { isNegated?: boolean }).isNegated).map((s, i) => (
              <li key={i}>
                <strong>{s.name || s.site}</strong>
                {complaintDetail(s).length > 0 && (
                  <span className="text-muted-foreground"> — {complaintDetail(s).join(' · ')}</span>
                )}
                {s.severityScore > 0 && s !== primary && <span className="text-muted-foreground"> · {s.severityScore}/10</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground">No complaints were recorded at the kiosk.</div>
        )}
        {session.deniedSymptoms && session.deniedSymptoms.length > 0 && (
          <div className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-semibold">Patient said no to:</span> {session.deniedSymptoms.join(', ')}
          </div>
        )}
        {session.rawTranscript && (
          <blockquote className="mt-2 pl-2.5 border-l-2 border-border text-[11px] text-muted-foreground italic">
            <span className="not-italic font-semibold">Patient's own words:</span> “{session.rawTranscript}”
          </blockquote>
        )}
      </Section>

      {(() => {
        const dx = formatDiagnosis(session.provisionalDiagnoses?.[0], role);
        return dx ? (
          <Section title="Kiosk suggestion — confirm in the Diagnosis field">
            <div className="px-3 py-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5">
              <div className="text-sm font-bold text-foreground">{dx.title}</div>
              {dx.subtitle && <div className="text-xs text-muted-foreground">{dx.subtitle}</div>}
              {dx.codes.length > 0 && <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">{dx.codes.join(' · ')}</div>}
              <div className="text-[10.5px] text-muted-foreground mt-1">Generated from the kiosk intake — confirm clinically.</div>
            </div>
          </Section>
        ) : null;
      })()}

      {ctx && (ctx.eGfr !== undefined || ctx.knownConditions.length > 0 || ctx.missing.length > 0) && (
        <Section title="Safety context">
          <div className="text-xs text-foreground space-y-0.5">
            {ctx.eGfr !== undefined && <div>eGFR <strong>{ctx.eGfr}</strong> mL/min ({ctx.eGfrMethod === 'CKD-EPI-2021' ? 'CKD-EPI 2021 from last creatinine' : 'reported'})</div>}
            {ctx.knownConditions.length > 0 && <div><span className="text-muted-foreground">Known:</span> {ctx.knownConditions.join(', ')}</div>}
            {ctx.missing.length > 0 && <div className="text-muted-foreground">Not on file: {ctx.missing.join(', ')}</div>}
          </div>
        </Section>
      )}

      {/* What changed since the last visit, and previous visits */}
      {session.sinceLastVisit && !session.sinceLastVisit.firstVisit && (
        <Section title={`Since last visit (${session.sinceLastVisit.previousVisit ? new Date(session.sinceLastVisit.previousVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''})`}>
          {session.sinceLastVisit.changes.length ? (
            <ul className="text-xs text-foreground list-disc pl-4 space-y-0.5">{session.sinceLastVisit.changes.map(c => <li key={c}>{c}</li>)}</ul>
          ) : <div className="text-xs text-muted-foreground">No change in recorded vitals, complaints or results.</div>}
        </Section>
      )}
      {(session.previousEncounters?.length || 0) > 0 && (
        <Section title="Previous visits">
          <div className="space-y-2">
            {session.previousEncounters!.slice(0, 3).map(e => (
              <div key={e.encounterId} className="text-xs">
                <div className="flex items-center gap-2 flex-wrap"><strong className="text-foreground">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</strong><span className="text-muted-foreground">{e.doctorName}</span>
                  <span className={`px-1.5 rounded border text-[9.5px] font-bold ${e.dispensed === 'DISPENSED' ? 'border-emerald-500/40 text-emerald-700' : 'border-amber-500/40 text-amber-800'}`}>{e.dispensed.replace(/_/g, ' ').toLowerCase()}</span></div>
                {e.diagnoses.length > 0 && <div className="text-muted-foreground">{e.diagnoses.join(', ')}</div>}
                <div className="text-foreground">{e.medicines.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join(' · ') || 'No medicines'}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* History: what was answered is listed; sections never asked are named in one line, not hidden. */}
      {(() => {
        const sections = summary ? summary.sections.filter(sec => !['chiefComplaint', 'hpi', 'vitals'].includes(sec.id)) : [];
        const asked = sections.filter(sec => sec.status !== 'not_asked');
        const notAsked = sections.filter(sec => sec.status === 'not_asked');
        return (
          <Section
            title={<><ClipboardList size={12} /> History</>}
            right={summary ? (
              <span className="text-[10px] font-mono text-muted-foreground" title="Sections answered / asked at the kiosk">
                {summary.completeness.answered}/{summary.completeness.asked} answered{summary.completeness.skipped ? ` · ${summary.completeness.skipped} skipped` : ''}
              </span>
            ) : undefined}
          >
            {summary ? (
              <div className="space-y-1.5">
                {asked.map(sec => (
                  <div key={sec.id} className="text-xs text-foreground">
                    <span className="text-muted-foreground">{sec.title}:</span> {sec.text}
                    {sec.status === 'partial' && <span className={`ml-1.5 px-1 py-px rounded border font-mono text-[9px] uppercase ${SECTION_TONE.partial}`}>partial</span>}
                  </div>
                ))}
                {notAsked.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className={`mr-1.5 px-1 py-px rounded border font-mono text-[9px] uppercase ${SECTION_TONE.not_asked}`}>not asked</span>
                    {notAsked.map(sec => sec.title).join(' · ')} — ask the patient.
                  </div>
                )}
              </div>
            ) : history ? (
              <div className="text-xs text-foreground space-y-0.5">
                <div><span className="text-muted-foreground">Conditions:</span> {history.conditions.filter(c => !/^none$/i.test(c)).join(', ') || (history.conditions.some(c => /^none$/i.test(c)) ? 'None of the listed conditions' : 'Not answered — ask the patient')}</div>
                <div><span className="text-muted-foreground">Allergies:</span> {answered(history.allergies, history.allergyStatus, 'No known allergy (patient said no)')}</div>
                <div><span className="text-muted-foreground">Current medicines:</span> {answered(history.currentMedicines, history.medicineStatus, 'None (patient said no)')}</div>
                {history.mentionedInSpeech && (history.mentionedInSpeech.conditions.length + history.mentionedInSpeech.medicines.length > 0) && (
                  <div className="text-muted-foreground">Mentioned while describing the complaint: {[...history.mentionedInSpeech.conditions, ...history.mentionedInSpeech.medicines].join(', ')}</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Not captured for this visit — ask the patient.</div>
            )}
          </Section>
        );
      })()}

      {/* Ayurvedic assessment: only on the Vaidya desk */}
      {isAyurveda && (
        <Section tone="ayurveda" title={<><Leaf size={12} /> Ayurveda — patient-reported, not examined</>}>
          {hasPariksha ? (
            <div className="pariksha-4-grid text-xs">
              <div><span className="text-[10px] text-muted-foreground block">Body type (3-question screen)</span><strong className="text-foreground">{session.pariksha?.prakritiScreen?.provisional || '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Digestion (Agni, own answer)</span><strong className="text-foreground">{session.pariksha?.agni ? session.pariksha.agni.charAt(0) + session.pariksha.agni.slice(1).toLowerCase() : '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Energy (own answer)</span><strong className="text-foreground">{session.pariksha?.energySelfReport || '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Prakriti · Sara · Vikriti</span><strong className="text-foreground">{[session.pariksha?.prakriti, session.pariksha?.sara, session.pariksha?.vikriti].filter(Boolean).join(' · ') || 'Vaidya to assess'}</strong></div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Info size={12} /> The patient chose modern medicine, so the Ayurvedic questions were not asked at the kiosk.</div>
          )}
        </Section>
      )}

      {session.normalizedLabMarkers && session.normalizedLabMarkers.length > 0 && (
        <Section title="Lab values from scanned reports">
          <div className="space-y-1">
            {session.normalizedLabMarkers.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-foreground">{m.marker}</span>
                <span className={`font-mono font-bold ${m.isAbnormal ? 'text-rose-600' : 'text-emerald-600'}`}>{m.normalizedValue}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};
