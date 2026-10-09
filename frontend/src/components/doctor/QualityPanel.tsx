import React, { useEffect, useState } from 'react';
import { X, BarChart3, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { PrescribingQuality } from '../../types/api';

/**
 * The doctor's own prescribing mirror: WHO/INRUD core prescribing indicators and the WHO AWaRe
 * antibiotic mix, computed from their signed prescriptions. Private to the doctor by default.
 */
export const QualityPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [scope, setScope] = useState<'me' | 'hospital'>('me');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PrescribingQuality | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.getPrescribingQuality(scope, days).then(d => { setData(d); setLoading(false); }); }, [scope, days]);

  const inTarget = (id: string, v: number | null) => {
    if (v === null) return null;
    if (id === 'drugs_per_encounter') return v <= 2.2;
    if (id === 'antibiotic_pct') return v <= 30;
    if (id === 'injection_pct') return v <= 24.1;
    if (id === 'access_pct') return v >= 60;
    return v >= 90;
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Prescribing quality">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold flex items-center gap-2"><BarChart3 size={16} className="text-primary" /> Prescribing quality</h2>
          <div className="flex items-center gap-2">
            <select value={scope} onChange={e => setScope(e.target.value as any)} className="px-2 py-1 text-xs rounded-lg border border-border bg-background"><option value="me">My prescriptions</option><option value="hospital">Whole hospital</option></select>
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-2 py-1 text-xs rounded-lg border border-border bg-background"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        {loading ? <div className="py-10 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : !data ? <div className="text-sm text-muted-foreground">Could not load.</div> : (
          <>
            <div className="text-xs text-muted-foreground">{data.encounters} prescription{data.encounters === 1 ? '' : 's'} with modern medicines in the last {data.windowDays} days · {data.coverage.recognised}/{data.coverage.medicines} medicines recognised.</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {data.indicators.map(i => {
                const ok = inTarget(i.id, i.value);
                return (
                  <div key={i.id} className={`rounded-xl border p-3 ${ok === null ? 'border-border' : ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
                    <div className="text-[11px] text-muted-foreground">{i.label}</div>
                    <div className="text-xl font-extrabold text-foreground">{i.value === null ? '—' : `${i.value}${i.unit}`}</div>
                    <div className="text-[11px] text-muted-foreground">WHO target {i.target}{i.unit}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs">AWaRe antibiotics: <strong className="text-emerald-700">Access {data.aware.access}</strong> · <strong className="text-amber-700">Watch {data.aware.watch}</strong> · <strong className="text-rose-700">Reserve {data.aware.reserve}</strong></div>
            <div className="text-[11px] text-muted-foreground">{data.source}. Indian OPD audits report 2.3–4.9 medicines per encounter and 1–66% generic naming; generic names are printed in capitals on this desk.</div>
          </>
        )}
      </div>
    </div>
  );
};
