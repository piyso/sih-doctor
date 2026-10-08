import React, { useEffect, useState } from 'react';
import { Activity, AlertOctagon, HeartPulse, ShieldCheck, Volume2, Thermometer, Wind } from 'lucide-react';
import { SocratesSymptom, VitalsData } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { BCP47, KioskTextKey, PAIN_CHARACTERS, kioskText, normalizeLang, regionName } from '../../utils/kioskLocalization';
import {
  VITAL_LIMITS, VitalStatus, STATUS_TONE, bpStatus, diaStatus, isCritical, normaliseTempF, parseBp, parseNumber,
  pulseStatus, spo2Status, sysStatus, tempStatus
} from '../../utils/vitals';
import { RegisterNav, useStepNav } from './kioskNav';

interface Step4SocratesProps {
  symptoms: SocratesSymptom[];
  setSymptoms: React.Dispatch<React.SetStateAction<SocratesSymptom[]>>;
  vitals: VitalsData;
  setVitals: React.Dispatch<React.SetStateAction<VitalsData>>;
  selectedBodyRegion?: string;
  language?: string;
  registerNav?: RegisterNav;
  onEmergency: () => void;
}

const DURATIONS: Array<{ en: string; key: KioskTextKey }> = [
  { en: 'Since today', key: 'durToday' },
  { en: '2–3 days', key: 'dur23' },
  { en: 'About a week', key: 'durWeek' },
  { en: '1 month or more', key: 'durMonth' }
];

const FACES: Array<{ score: number; key: KioskTextKey }> = [
  { score: 0, key: 'face0' }, { score: 2, key: 'face2' }, { score: 4, key: 'face4' },
  { score: 6, key: 'face6' }, { score: 8, key: 'face8' }, { score: 10, key: 'face10' }
];

const STATUS_KEY: Record<VitalStatus, KioskTextKey> = {
  empty: 'vNotEntered', invalid: 'vCheck', normal: 'vNormal', low: 'vLow', veryLow: 'vVeryLow',
  high: 'vHigh', veryHigh: 'vVeryHigh', fever: 'vFever'
};

const FaceIcon: React.FC<{ score: number; selected: boolean }> = ({ score, selected }) => {
  const stroke = score === 0 ? '#16a34a' : score === 2 ? '#059669' : score === 4 ? '#d97706' : score === 6 ? '#ea580c' : score === 8 ? '#dc2626' : '#991b1b';
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="mx-auto">
      <circle cx="18" cy="18" r="15" fill={selected ? '#e0f2fe' : '#ffffff'} />
      {score < 8 ? (<><circle cx="13" cy="14" r="1.5" fill={stroke} /><circle cx="23" cy="14" r="1.5" fill={stroke} /></>) : (<><path d="M11 13 L15 15 M11 15 L15 13 M21 13 L25 15 M21 15 L25 13" /></>)}
      {score === 0 && <path d="M12 22 Q18 28 24 22" />}
      {score === 2 && <path d="M13 23 Q18 26 23 23" />}
      {score === 4 && <line x1="13" y1="23" x2="23" y2="23" />}
      {score === 6 && <path d="M13 24 Q18 21 23 24" />}
      {score === 8 && <path d="M12 25 Q18 19 24 25" />}
      {score === 10 && <path d="M12 26 Q18 18 24 26" />}
    </svg>
  );
};

export const Step4Socrates: React.FC<Step4SocratesProps> = ({
  symptoms,
  setSymptoms,
  vitals,
  setVitals,
  selectedBodyRegion,
  language = 'hi',
  registerNav,
  onEmergency
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);

  const primary: SocratesSymptom = symptoms[0] || {
    key: 'manual:general',
    site: selectedBodyRegion || 'General',
    onset: '', character: '', radiation: '', associations: [], timing: '',
    exacerbatingFactors: [], relievingFactors: [], severityScore: 0
  };

  const updatePrimary = (patch: Partial<SocratesSymptom>) => {
    setSymptoms(prev => {
      const base = prev[0] || primary;
      return [{ ...base, ...patch }, ...prev.slice(1)];
    });
  };

  // ---------------------------------------------------------------- Vitals (local text so typing is never fought)
  const initialBp = parseBp(vitals.bp);
  const [sysText, setSysText] = useState(initialBp.sys?.toString() || '');
  const [diaText, setDiaText] = useState(initialBp.dia?.toString() || '');
  const [pulseText, setPulseText] = useState(parseNumber(vitals.pulse)?.toString() || '');
  const [spo2Text, setSpo2Text] = useState(parseNumber(vitals.spo2)?.toString() || '');
  const [tempText, setTempText] = useState(parseNumber(vitals.temp)?.toString() || '');

  const sys = parseNumber(sysText);
  const dia = parseNumber(diaText);
  const pulse = parseNumber(pulseText);
  const spo2 = parseNumber(spo2Text);
  const tempF = normaliseTempF(tempText);

  const status = {
    sys: sysStatus(sys),
    dia: diaStatus(dia),
    bp: bpStatus(sys, dia),
    pulse: pulseStatus(pulse),
    spo2: spo2Status(spo2),
    temp: tempStatus(tempF)
  };

  // Push only valid values to the shared record; invalid/partial input stays local with an error.
  useEffect(() => {
    setVitals(prev => {
      const next: VitalsData = { ...prev };
      next.bp = status.bp !== 'invalid' && status.bp !== 'empty' ? `${sys}/${dia}` : undefined;
      next.pulse = status.pulse !== 'invalid' && pulse !== null ? Math.round(pulse) : undefined;
      next.spo2 = status.spo2 !== 'invalid' && spo2 !== null ? `${Math.round(spo2)}%` : undefined;
      next.temp = status.temp !== 'invalid' && tempF !== null ? `${tempF}°F` : undefined;
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sysText, diaText, pulseText, spo2Text, tempText]);

  const fieldError = (s: VitalStatus, limits: readonly [number, number]) =>
    s === 'invalid' ? tx('vInvalid', { min: limits[0], max: limits[1] }) : null;
  const bpError = status.sys === 'invalid'
    ? tx('vInvalid', { min: VITAL_LIMITS.sys[0], max: VITAL_LIMITS.sys[1] })
    : status.dia === 'invalid'
    ? tx('vInvalid', { min: VITAL_LIMITS.dia[0], max: VITAL_LIMITS.dia[1] })
    : sys !== null && dia !== null && sys <= dia
    ? tx('vBpOrder')
    : (sys === null) !== (dia === null) && (sysText || diaText)
    ? tx('vNotEntered')
    : null;

  useStepNav(registerNav, { canNext: true });

  // ---------------------------------------------------------------- Status / emergency (fixed slot)
  const score = primary.severityScore || 0;
  const vitalCritical = [status.bp, status.pulse, status.spo2, status.temp].some(isCritical);
  const isChest = /chest|precordium|heart/i.test(primary.site) || /chest/i.test(primary.name || '');
  const isHead = /^head$/i.test(primary.site) || /headache/i.test(primary.name || '');
  const isEmergency = score >= 8 || vitalCritical;

  const playGuidance = () => {
    sovereignSound.playMechanicalSnap();
    sovereignSound.speakGuidance(tx('s4Audio'), BCP47[lang]);
  };

  const vitalInput = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    hasError: boolean,
    width = 'w-full'
  ) => (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
      placeholder={placeholder}
      className={`${width} px-3 py-2 rounded-xl bg-background border text-lg font-mono font-bold text-foreground outline-none focus:ring-2 ${hasError ? 'border-rose-500 focus:ring-rose-500/30' : 'border-border focus:ring-sky-500/30 focus:border-sky-500'}`}
    />
  );

  const statusPill = (s: VitalStatus) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold ${STATUS_TONE[s]}`}>{tx(STATUS_KEY[s])}</span>
  );

  return (
    <div className="max-w-5xl mx-auto py-2 px-1 sm:px-4">
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mb-1">{tx('s4Title')}</h2>
        <div className="flex justify-center items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">{tx('s4Sub')}</p>
          <button type="button" onClick={playGuidance} className="tactile-btn text-xs font-semibold px-2.5 py-1 rounded-full gap-1 text-primary border-primary/30 bg-primary/10">
            <Volume2 size={12} />
            <span>{tx('listenBtn')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* About the pain */}
        <div className="physical-card p-5 rounded-2xl flex flex-col gap-4">
          <h3 className="text-sm font-bold text-foreground border-b border-border/70 pb-2">{tx('s4PainCard')}</h3>

          <div>
            <span className="block text-sm font-semibold text-foreground/90 mb-1.5">{tx('s4Site')}</span>
            {primary.site && primary.site !== 'General' && !/side not stated/.test(primary.site) ? (
              <div className="px-3 py-2 rounded-xl bg-muted/40 border border-border/70 text-sm font-bold text-foreground">
                {regionName(primary.site, lang) || primary.site}
              </div>
            ) : (
              <input
                type="text"
                value={primary.location || ''}
                onChange={e => updatePrimary({ location: e.target.value })}
                placeholder={tx('s4SitePh')}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="s4-character">{tx('s4Character')}</label>
            <select
              id="s4-character"
              value={primary.character || ''}
              onChange={e => { sovereignSound.playDialNotch(); updatePrimary({ character: e.target.value }); }}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <option value="">{tx('s4CharacterPh')}</option>
              {PAIN_CHARACTERS.map(c => <option key={c.value} value={c.value}>{tx(c.key)}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-sm font-semibold text-foreground/90 mb-1.5">{tx('s4Onset')}</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DURATIONS.map(d => (
                <button
                  key={d.en}
                  type="button"
                  onClick={() => updatePrimary({ onset: primary.onset === d.en ? '' : d.en })}
                  aria-pressed={primary.onset === d.en}
                  className={`py-2 px-1 rounded-xl text-sm font-semibold border transition-colors ${primary.onset === d.en ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                >
                  {tx(d.key)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="s4-radiation">{tx('s4Radiation')}</label>
            <input
              id="s4-radiation"
              type="text"
              value={primary.radiation || ''}
              onChange={e => updatePrimary({ radiation: e.target.value })}
              placeholder={tx('s4RadiationPh')}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Pain level + vitals */}
        <div className="physical-card p-5 rounded-2xl flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/70">
            <div className="flex justify-between items-center mb-2 gap-2">
              <span className="text-sm font-semibold text-foreground/90">{tx('s4Severity')}</span>
              <span className="text-lg font-mono font-extrabold tabular-nums w-[132px] text-right shrink-0" style={{ color: score >= 8 ? '#e11d48' : score >= 5 ? '#d97706' : score > 0 ? '#059669' : '#64748b' }}>
                {score}/10 <span className="text-xs font-sans font-semibold">{score === 0 ? tx('painNone') : score >= 8 ? tx('painSevere') : score >= 5 ? tx('painModerate') : tx('painMild')}</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={score}
              onChange={e => { sovereignSound.playDialNotch(); updatePrimary({ severityScore: parseInt(e.target.value, 10) }); }}
              className="w-full h-2 cursor-pointer mb-2"
              aria-label={tx('s4Severity')}
            />
            <div className="grid grid-cols-6 gap-1 text-center">
              {FACES.map(f => (
                <button
                  key={f.score}
                  type="button"
                  onClick={() => { sovereignSound.playDialNotch(); updatePrimary({ severityScore: f.score }); }}
                  aria-pressed={score === f.score}
                  className={`p-1 rounded-lg border transition-colors ${score === f.score ? 'bg-background border-sky-500/50 ring-1 ring-sky-500/40' : 'border-transparent hover:bg-muted/40'}`}
                >
                  <FaceIcon score={f.score} selected={score === f.score} />
                  <div className="text-[10px] font-mono text-muted-foreground">{f.score}</div>
                  <div className="text-[10px] font-semibold text-foreground/80 leading-tight h-6 overflow-hidden">{tx(f.key)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vitals */}
          <div>
            <h3 className="text-sm font-bold text-foreground">{tx('vitalsTitle')}</h3>
            <p className="text-xs text-muted-foreground mb-3">{tx('vitalsHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 p-3 rounded-xl border border-border/80 bg-card">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5" htmlFor="v-sys"><Activity size={14} className="text-primary" /> {tx('vBp')} <span className="text-xs font-normal text-muted-foreground">mmHg</span></label>
                  {statusPill(status.bp === 'invalid' && !bpError ? 'empty' : status.bp)}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="block text-[11px] text-muted-foreground mb-0.5">{tx('vSys')}</span>
                    {vitalInput('v-sys', sysText, setSysText, '120', status.sys === 'invalid' || !!(bpError && sys !== null && dia !== null))}
                  </div>
                  <span className="text-2xl font-mono text-muted-foreground mt-4">/</span>
                  <div className="flex-1">
                    <span className="block text-[11px] text-muted-foreground mb-0.5">{tx('vDia')}</span>
                    {vitalInput('v-dia', diaText, setDiaText, '80', status.dia === 'invalid' || !!(bpError && sys !== null && dia !== null))}
                  </div>
                </div>
                <p className={`min-h-[18px] mt-1 text-xs font-semibold ${bpError ? 'text-rose-600' : 'text-transparent'}`}>{bpError || '·'}</p>
              </div>

              {([
                { id: 'v-pulse', label: tx('vPulse'), unit: 'bpm', icon: HeartPulse, value: pulseText, set: setPulseText, ph: '72', s: status.pulse, limits: VITAL_LIMITS.pulse },
                { id: 'v-spo2', label: tx('vSpo2'), unit: '%', icon: Wind, value: spo2Text, set: setSpo2Text, ph: '98', s: status.spo2, limits: VITAL_LIMITS.spo2 },
                { id: 'v-temp', label: tx('vTemp'), unit: '°F / °C', icon: Thermometer, value: tempText, set: setTempText, ph: '98.6', s: status.temp, limits: VITAL_LIMITS.temp }
              ] as const).map(f => {
                const Icon = f.icon;
                const err = fieldError(f.s, f.limits);
                return (
                  <div key={f.id} className="p-3 rounded-xl border border-border/80 bg-card">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <label className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5" htmlFor={f.id}><Icon size={14} className="text-primary" /> {f.label} <span className="text-xs font-normal text-muted-foreground">{f.unit}</span></label>
                      {statusPill(f.s)}
                    </div>
                    {vitalInput(f.id, f.value, f.set, f.ph, !!err)}
                    <p className={`min-h-[18px] mt-1 text-xs font-semibold ${err ? 'text-rose-600' : 'text-transparent'}`}>{err || '·'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reserved status slot — always the same height so nothing jumps */}
      <div className="mt-4 min-h-[76px]" aria-live="polite">
        {isEmergency ? (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertOctagon size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-800 dark:text-rose-200">
                <div className="font-bold">
                  {score >= 8 ? (isChest ? tx('emergencyChest') : isHead ? tx('emergencyHead') : tx('emergencyGeneral')) : tx('statusVitalsAlert')}
                </div>
                {score >= 8 && vitalCritical && <div className="text-xs mt-0.5">{tx('statusVitalsAlert')}</div>}
              </div>
            </div>
            <button type="button" onClick={() => { sovereignSound.playEmergencyCodeRed(); onEmergency(); }} className="btn btn-danger text-sm font-bold px-4 py-2 rounded-xl shrink-0">
              {tx('emergencyAction')}
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <ShieldCheck size={18} className="text-primary shrink-0" />
            <span>
              {score === 0 ? tx('statusWaiting') : [status.bp, status.pulse, status.spo2, status.temp].some(s => s === 'low' || s === 'high' || s === 'fever') ? tx('statusVitalsAlert') : score >= 6 ? tx('statusUrgent') : tx('statusRoutine')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
