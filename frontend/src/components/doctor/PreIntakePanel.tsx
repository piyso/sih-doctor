import React, { useEffect, useState } from 'react';
import { User, Heart, Flame, Wind, Activity, Pencil, Check, X, Loader2, Leaf, Pill, ClipboardList, AlertTriangle, Info } from 'lucide-react';
import { SessionDetail, VitalsData } from '../../types/api';
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
  return 'Within normal range';
};

const PRIORITY_INFO: Record<string, { label: string; tone: string; help: string }> = {
  EMERGENCY_RED_FLAG: { label: 'Emergency', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', help: 'Red-flag symptoms or critical vitals — needs immediate assessment.' },
  HIGH_PRIORITY: { label: 'Priority', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', help: 'Abnormal vitals or severe symptoms — see before routine patients.' },
  ROUTINE: { label: 'Routine', tone: 'bg-muted text-foreground border-border/80', help: 'Stable — seen in OPD order.' }
};

const characterEn = (value?: string) => {
  const match = PAIN_CHARACTERS.find(c => c.value === value);
  return match ? kioskText('en')(match.key) : value || '';
};

export const PreIntakePanel: React.FC<PreIntakePanelProps> = ({ session, role, onSaveVitals }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ sys: '', dia: '', pulse: '', spo2: '', temp: '' });

  const loadForm = (v: VitalsData = {}) => {
    const { sys, dia } = parseBp(v.bp);
    setForm({
      sys: sys?.toString() || '',
      dia: dia?.toString() || '',
      pulse: parseNumber(v.pulse)?.toString() || '',
      spo2: parseNumber(v.spo2)?.toString() || '',
      temp: parseNumber(v.temp)?.toString() || ''
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
    const ok = await onSaveVitals(payload);
    setSaving(false);
    if (ok) setEditing(false);
    else setSaveError('Could not save — the hospital server is not reachable.');
  };

  const primary = session.symptoms?.[0];
  const priority = PRIORITY_INFO[session.triagePriority] || PRIORITY_INFO.ROUTINE;
  const isAyurveda = role === 'AYURVEDA';
  const hasPariksha = !!(session.pariksha?.prakriti || session.pariksha?.agni || session.pariksha?.sara);
  const history = session.history;

  const vitalTile = (
    key: 'bp' | 'pulse' | 'spo2' | 'temp',
    label: string,
    icon: React.ReactNode,
    unit: string,
    display: string,
    detail = ''
  ) => (
    <div className="p-2.5 rounded-xl border border-border/80 bg-card flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">{icon}{label}</span>
        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${STATUS_TONE[status[key]]}`}>{STATUS_LABEL[status[key]]}</span>
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
      <div className="min-h-[14px] text-[9.5px] text-muted-foreground">{status[key] === 'invalid' ? `Expected ${VITAL_LIMITS[key === 'bp' ? 'sys' : key][0]}–${VITAL_LIMITS[key === 'bp' ? 'sys' : key][1]}` : detail}</div>
    </div>
  );

  return (
    <div className="physical-card p-4 flex flex-col gap-3.5">
      {/* Patient header */}
      <div className="flex justify-between items-start gap-2 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${session.triagePriority === 'EMERGENCY_RED_FLAG' ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' : 'bg-muted text-foreground border-border/80'}`}>
            {session.patientName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-heading font-bold text-foreground truncate">{session.patientName}</h3>
              <span className="text-xs text-muted-foreground font-mono">{session.age ? `${session.age}y` : ''} · {session.gender}</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              {session.abhaId && <span className="font-mono">ABHA {session.abhaId}</span>}
              <span className="flex items-center gap-1">
                {session.careStream === 'AYURVEDA' ? <><Leaf size={11} className="text-emerald-600" /> Wants Ayurveda</> : session.careStream === 'ALLOPATHY' ? <><Pill size={11} className="text-sky-600" /> Wants modern medicine</> : 'No doctor preference'}
              </span>
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold uppercase shrink-0 cursor-help ${priority.tone}`} title={priority.help}>
          {priority.label}
        </span>
      </div>

      {(session.isPregnant || session.isLactating) && (
        <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/25 text-xs font-semibold text-pink-800 dark:text-pink-200 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{session.isPregnant ? `Pregnant${session.gestationalWeeks ? ` (${session.gestationalWeeks} weeks)` : ''}` : 'Breastfeeding'} — medicines unsafe in pregnancy / lactation are blocked.</span>
        </div>
      )}

      {/* Vitals: view + edit with instant interpretation */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-primary">Vitals</span>
          {editing ? (
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
        </div>
        <div className="vitals-4-grid">
          {vitalTile('bp', 'BP', <Activity size={10} />, 'mmHg', sys !== null && dia !== null ? `${sys}/${dia}` : '', BP_DETAIL(sys, dia))}
          {vitalTile('pulse', 'Pulse', <Heart size={10} />, 'bpm', pulse !== null ? String(pulse) : '')}
          {vitalTile('spo2', 'SpO2', <Wind size={10} />, '%', spo2 !== null ? String(spo2) : '')}
          {vitalTile('temp', 'Temp', <Flame size={10} />, '°F', tempF !== null ? String(tempF) : '', form.temp && tempF !== parseNumber(form.temp) ? `${form.temp}°C converted` : '')}
        </div>
        <p className={`min-h-[16px] text-xs font-semibold ${saveError ? 'text-rose-600' : 'text-transparent'}`} role={saveError ? 'alert' : undefined}>{saveError || '·'}</p>
      </div>

      {/* Presenting complaint */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/75">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-primary">Presenting complaints</span>
          {primary && primary.severityScore > 0 && (
            <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${primary.severityScore >= 8 ? 'bg-rose-500/15 text-rose-700' : 'bg-muted text-foreground border border-border/70'}`}>
              Pain {primary.severityScore}/10
            </span>
          )}
        </div>
        {session.symptoms && session.symptoms.length > 0 ? (
          <ul className="text-xs text-foreground space-y-1">
            {session.symptoms.map((s, i) => (
              <li key={i}>
                <strong>{s.name || s.site}</strong>
                {[s.site && s.site !== 'General' && s.name && !s.name.includes(s.site) ? s.site : '', characterEn(s.character), s.onset, s.radiation ? `radiates to ${s.radiation}` : ''].filter(Boolean).length > 0 && (
                  <span className="text-muted-foreground"> — {[s.site && s.site !== 'General' && s.name && !s.name.includes(s.site) ? s.site : '', characterEn(s.character), s.onset, s.radiation ? `radiates to ${s.radiation}` : ''].filter(Boolean).join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground">No complaints were recorded at the kiosk.</div>
        )}
        {session.rawTranscript && (
          <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <span className="font-semibold">Patient's own words:</span> “{session.rawTranscript}”
          </div>
        )}
      </div>

      {(() => {
        const dx = formatDiagnosis(session.provisionalDiagnoses?.[0], role);
        return dx ? (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/25">
            <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">Suggested provisional diagnosis</span>
            <div className="text-sm font-bold text-foreground">{dx.title}</div>
            {dx.subtitle && <div className="text-xs text-muted-foreground">{dx.subtitle}</div>}
            {dx.codes.length > 0 && <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">{dx.codes.join(' · ')}</div>}
            <div className="text-[10.5px] text-muted-foreground mt-1">Generated from the kiosk intake — confirm clinically.</div>
          </div>
        ) : null;
      })()}

      {/* History */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/75">
        <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1.5"><ClipboardList size={12} /> History</span>
        {history ? (
          <div className="text-xs text-foreground space-y-0.5">
            <div><span className="text-muted-foreground">Conditions:</span> {history.conditions.filter(c => c !== 'None').join(', ') || 'None reported'}</div>
            <div><span className="text-muted-foreground">Allergies:</span> {history.allergies || 'None reported'}</div>
            <div><span className="text-muted-foreground">Current medicines:</span> {history.currentMedicines || 'None reported'}</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Not captured for this visit — ask the patient.</div>
        )}
      </div>

      {/* Ayurvedic assessment: only on the Vaidya desk */}
      {isAyurveda && (
        <div className="p-3 rounded-xl bg-muted/40 border border-border/75">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2"><Leaf size={12} /> Dashavidha Pariksha (patient-reported)</span>
          {hasPariksha ? (
            <div className="pariksha-4-grid text-xs">
              <div><span className="text-[10px] text-muted-foreground block">Prakriti</span><strong className="text-foreground">{session.pariksha?.prakriti || '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Agni</span><strong className="text-foreground">{session.pariksha?.agni || '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Sara / Bala</span><strong className="text-foreground">{session.pariksha?.sara || '—'}</strong></div>
              <div><span className="text-[10px] text-muted-foreground block">Vikriti</span><strong className="text-foreground">{session.pariksha?.vikriti || 'To assess'}</strong></div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Info size={12} /> The patient chose modern medicine, so the Ayurvedic questions were not asked at the kiosk.</div>
          )}
        </div>
      )}

      {session.normalizedLabMarkers && session.normalizedLabMarkers.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/40 border border-sky-400/30">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-sky-600 block mb-1.5">Lab values from scanned reports</span>
          <div className="space-y-1">
            {session.normalizedLabMarkers.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-foreground">{m.marker}</span>
                <span className={`font-mono font-bold ${m.isAbnormal ? 'text-rose-600' : 'text-emerald-600'}`}>{m.normalizedValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
