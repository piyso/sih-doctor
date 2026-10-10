import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, OctagonAlert, TriangleAlert, Info } from 'lucide-react';
import { ConflictAlert, ResolvedLineInfo } from '../../types/api';
import { FoodTiming, formatSig, parseSig, PATTERN_LABELS, quantity } from '../../utils/sig';

export interface LineFields {
  title: string;
  dose: string;
  frequency: string;
  durationDays: number;
  anupana?: string;
  indication?: string;
}

interface MedicineLineProps {
  kind: 'allo' | 'ayush';
  fields: LineFields;
  onChange: (patch: Partial<LineFields>) => void;
  onRemove: () => void;
  alerts: ConflictAlert[];
  resolved?: ResolvedLineInfo;
  readOnlyNote?: string;
  sourceLabel?: string;
}

const TIER_STYLE = {
  STOP: { box: 'border-rose-500 bg-rose-500/5', chip: 'bg-rose-600 text-white', icon: OctagonAlert },
  WARN: { box: 'border-amber-500/60 bg-amber-500/5', chip: 'bg-amber-500 text-white', icon: TriangleAlert },
  INFO: { box: 'border-sky-500/30 bg-sky-500/5', chip: 'bg-sky-600 text-white', icon: Info }
} as const;

const FOODS: FoodTiming[] = ['', 'before food', 'after food', 'empty stomach', 'with food'];
/** Whole words on the 1-0-1 buttons: a clipped "Noo" or "Nig" reads as a mistake on a prescription screen. */
const SLOT_SHORT = ['Morn', 'Noon', 'Night'];

/** One prescription line: dose, 1-0-1 timing, food, days, quantity, indication, and its own alerts. */
export const MedicineLine: React.FC<MedicineLineProps> = ({ kind, fields, onChange, onRemove, alerts, resolved, readOnlyNote, sourceLabel }) => {
  const [open, setOpen] = useState<string | null>(null);
  const sig = parseSig(fields.frequency);
  const qty = kind === 'allo' ? quantity(fields.dose, fields.frequency, fields.durationDays) : null;
  const worst = alerts.some(a => a.tier === 'STOP') ? 'STOP' : alerts.some(a => a.tier === 'WARN') ? 'WARN' : null;
  const isAntibiotic = !!resolved?.aware?.length;
  const generic = resolved?.generics?.length ? resolved.generics.join(' + ') : '';
  const showGeneric = generic && generic.toLowerCase() !== fields.title.toLowerCase();

  const setPattern = (i: number) => {
    const base = sig.pattern ? [...sig.pattern] : [0, 0, 0];
    while (base.length < 3) base.push(0);
    base[i] = base[i] >= 2 ? 0 : base[i] + 1;
    onChange({ frequency: formatSig({ pattern: base, other: '', food: sig.food }) });
  };

  return (
    <div className={`p-3 rounded-xl border bg-card flex flex-col gap-2 ${worst ? TIER_STYLE[worst].box : kind === 'ayush' ? 'border-emerald-500/30' : 'border-sky-500/30'}`} data-testid="rx-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
            <span className={kind === 'allo' ? 'uppercase tracking-wide' : ''}>{fields.title}</span>
            {showGeneric && <span className="text-[11px] font-semibold text-muted-foreground normal-case">= {generic}</span>}
            {resolved?.aware?.map(a => <span key={a} className={`px-1 rounded border text-[11px] font-bold ${a === 'ACCESS' ? 'border-emerald-500/40 text-emerald-700' : a === 'WATCH' ? 'border-amber-500/50 text-amber-800' : 'border-rose-500/40 text-rose-700'}`}>AWaRe {a}</span>)}
            {resolved?.schedule?.map(s => <span key={s} className="px-1 rounded border border-border text-[11px] font-bold">{s === 'NDPS' ? 'NDPS' : `Sch ${s}`}</span>)}
            {resolved?.scheduleE1?.length ? <span className="px-1 rounded border border-amber-500/50 text-amber-800 text-[11px] font-bold" title="Drugs & Cosmetics Rules Schedule E(1): dispense only against prescription; caution label">Schedule E(1): {resolved.scheduleE1.join(', ')}</span> : null}
            {resolved && resolved.unresolved.length > 0 && <span className="px-1 rounded border border-dashed border-muted-foreground/50 text-[11px] text-muted-foreground" title="Not in the safety database: interactions, doses and allergies could not be checked for this line">not checked</span>}
            {sourceLabel && <span className="text-[11px] text-muted-foreground font-normal">· {sourceLabel}</span>}
          </div>
          {readOnlyNote && <div className="text-[11px] text-muted-foreground">{readOnlyNote}</div>}
        </div>
        <button type="button" onClick={onRemove} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 shrink-0" aria-label={`Remove ${fields.title}`}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 w-28">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Dose</span>
          <input value={fields.dose} onChange={e => onChange({ dose: e.target.value })} placeholder={kind === 'allo' ? '500 mg' : '3 g'} className="h-9 px-2 text-[13px] font-semibold rounded-lg border border-border bg-background" />
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">When (1-0-1)</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <button key={i} type="button" onClick={() => setPattern(i)} title={`${PATTERN_LABELS[i]}: tap to change (0 → 1 → 2)`}
                aria-label={`${PATTERN_LABELS[i]}: ${sig.pattern ? sig.pattern[i] ?? 0 : 0}`}
                className={`w-11 h-9 rounded-lg border text-xs font-bold ${sig.pattern && sig.pattern[i] > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                <span className="block text-[11px] font-semibold leading-none opacity-80">{SLOT_SHORT[i]}</span>
                {sig.pattern ? (sig.pattern[i] === 0.5 ? '½' : sig.pattern[i] ?? 0) : 0}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-0.5 min-w-[190px] flex-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Or other / food</span>
          <div className="flex gap-1">
            <input value={sig.pattern ? '' : sig.other} onChange={e => onChange({ frequency: formatSig({ pattern: null, other: e.target.value, food: sig.food }) })} placeholder={sig.pattern ? formatSig(sig) : 'SOS, weekly…'} aria-label="Other frequency" className="flex-1 min-w-0 h-9 px-2 text-[13px] rounded-lg border border-border bg-background" />
            <select value={sig.food} onChange={e => onChange({ frequency: formatSig({ ...sig, food: e.target.value as FoodTiming }) })} className="h-9 px-1.5 text-xs rounded-lg border border-border bg-background" aria-label="Food timing">
              {FOODS.map(f => <option key={f} value={f}>{f || 'food: any'}</option>)}
            </select>
          </div>
        </label>
        {kind === 'ayush' && (
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Anupana</span>
            <input value={fields.anupana || ''} onChange={e => onChange({ anupana: e.target.value })} placeholder="Lukewarm water" className="h-9 px-2 text-[13px] rounded-lg border border-border bg-background" />
          </label>
        )}
        <label className="flex flex-col gap-0.5 w-16">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Days</span>
          <input type="number" min={0} value={fields.durationDays || ''} onChange={e => onChange({ durationDays: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="h-9 px-2 text-[13px] font-semibold rounded-lg border border-border bg-background" />
        </label>
        {kind === 'allo' && qty ? <div className="text-xs font-semibold text-muted-foreground pb-2 tabular-nums whitespace-nowrap" title="Quantity to dispense (dose × frequency × days)">Qty {qty}</div> : null}
      </div>

      {kind === 'allo' && isAntibiotic && (
        <label className="flex items-center gap-2 text-xs">
          <span className={`text-[11px] font-semibold uppercase shrink-0 ${fields.indication ? 'text-muted-foreground' : 'text-amber-800'}`}>Indication</span>
          <input value={fields.indication || ''} onChange={e => onChange({ indication: e.target.value })} placeholder="Why this antibiotic? (required — MoHFW 2024)" className="flex-1 h-9 px-2 text-[13px] rounded-lg border border-border bg-background" />
        </label>
      )}

      {alerts.length > 0 && (
        <div className="flex flex-col gap-1">
          {alerts.map(a => {
            const t = (a.tier || 'WARN') as keyof typeof TIER_STYLE;
            const Icon = TIER_STYLE[t].icon;
            const key = `${a.groupKey}-${a.alertId}`;
            return (
              <div key={key} className="text-[11.5px]">
                <button type="button" onClick={() => setOpen(open === key ? null : key)} className="w-full text-left flex items-start gap-1.5">
                  <span className={`px-1.5 rounded text-[11px] font-bold shrink-0 mt-0.5 ${TIER_STYLE[t].chip}`}>{t}</span>
                  <Icon size={13} className={`shrink-0 mt-0.5 ${t === 'STOP' ? 'text-rose-600' : t === 'WARN' ? 'text-amber-600' : 'text-sky-600'}`} />
                  <span className="text-foreground font-semibold">{a.itemA} × {a.itemB}</span>
                  {open === key ? <ChevronUp size={12} className="ml-auto shrink-0" /> : <ChevronDown size={12} className="ml-auto shrink-0" />}
                </button>
                {open === key && (
                  <div className="pl-7 pt-1 text-muted-foreground space-y-0.5">
                    <div><strong className="text-foreground">Why:</strong> {a.mechanism}</div>
                    <div><strong className="text-foreground">Do:</strong> {a.clinicalAction || a.recommendedAction}</div>
                    <div className="text-[11px]">{a.evidence ? `Evidence: ${a.evidence}. ` : ''}{a.citation ? `Source: ${a.citation}` : ''}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
