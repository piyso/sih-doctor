import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Search, Plus, AlertOctagon } from 'lucide-react';
import { api } from '../../services/api';
import { AyushFormularyHit, FormularyHit } from '../../types/api';
import { DoctorRole } from './doctorRole';

interface MedicineSearchProps {
  stream: DoctorRole;
  placeholder?: string;
  onPickAllopathic: (hit: FormularyHit | { generic: string; custom: true }) => void;
  onPickAyush: (hit: AyushFormularyHit | { name: string; custom: true }) => void;
  compact?: boolean;
}

const AWARE_TONE: Record<string, string> = {
  ACCESS: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  WATCH: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
  RESERVE: 'bg-rose-500/10 text-rose-700 border-rose-500/30'
};

/** Search the hospital formulary (generic first). Enter picks the first result; "/" focuses it from anywhere on the desk. */
export const MedicineSearch = forwardRef<HTMLInputElement, MedicineSearchProps>(({ stream, placeholder, onPickAllopathic, onPickAyush, compact }, ref) => {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Array<FormularyHit | AyushFormularyHit>>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  /** The text the current results belong to (results arrive after a short pause in typing). */
  const [hitsFor, setHitsFor] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setHits([]); setHitsFor(''); return; }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api.searchFormulary(q, stream).then(r => { if (my === seq.current) { setHits(r); setHitsFor(q); setActive(0); setLoading(false); } });
    }, 150);
    return () => clearTimeout(t);
  }, [term, stream]);

  const pick = (h: FormularyHit | AyushFormularyHit) => {
    if (stream === 'ALLOPATHY') onPickAllopathic(h as FormularyHit); else onPickAyush(h as AyushFormularyHit);
    setTerm('');
    setHits([]);
    setHitsFor('');
  };
  // Enter pressed before the results for the typed text arrived: look it up now instead of adding the
  // raw text as an unchecked line (a fast typist would otherwise get "amoxy" instead of Amoxicillin).
  const enter = async () => {
    const q = term.trim();
    if (q === hitsFor && !loading) { if (hits[active]) pick(hits[active]); else custom(); return; }
    const my = ++seq.current;
    setLoading(true);
    const r = await api.searchFormulary(q, stream);
    if (my !== seq.current) return; // the doctor kept typing
    setLoading(false);
    if (r[0]) pick(r[0]); else custom();
  };
  const custom = () => {
    const name = term.trim();
    if (!name) return;
    if (stream === 'ALLOPATHY') onPickAllopathic({ generic: name, custom: true }); else onPickAyush({ name, custom: true });
    setTerm('');
    setHits([]);
    setHitsFor('');
  };

  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
      <input
        ref={ref}
        value={term}
        onChange={e => setTerm(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && term.trim()) { e.preventDefault(); void enter(); }
          else if (e.key === 'Escape') { setTerm(''); setHits([]); }
        }}
        placeholder={placeholder || (stream === 'ALLOPATHY' ? 'Add medicine — type generic or brand (press / to focus)' : 'Add formulation — type the classical name (press / to focus)')}
        className={`w-full pl-8 pr-3 ${compact ? 'py-1' : 'py-1.5'} text-xs rounded-lg border border-border bg-background`}
        aria-label={stream === 'ALLOPATHY' ? 'Search medicines' : 'Search formulations'}
        role="combobox"
        aria-expanded={hits.length > 0}
      />
      {term.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-1 flex flex-col gap-0.5" role="listbox">
          {loading && hits.length === 0 && <div className="px-2.5 py-2 text-[11px] text-muted-foreground">Searching…</div>}
          {hits.map((h, i) => {
            const isAllo = 'generic' in h;
            return (
              <button key={h.id} type="button" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}
                className={`text-left px-2.5 py-1.5 rounded-lg text-xs ${i === active ? 'bg-muted' : ''}`}>
                {isAllo ? (() => {
                  const a = h as FormularyHit;
                  return (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-foreground uppercase tracking-wide">{a.generic}</strong>
                        {a.matchedBrand && <span className="text-muted-foreground">(“{a.matchedBrand}”)</span>}
                        {a.aware && <span className={`px-1 rounded border text-[9.5px] font-bold ${AWARE_TONE[a.aware]}`}>AWaRe {a.aware}</span>}
                        {a.schedule && <span className="px-1 rounded border border-border text-[9.5px] font-bold">Sch {a.schedule}</span>}
                        {a.ndps && <span className="px-1 rounded border border-rose-500/30 text-rose-700 text-[9.5px] font-bold">NDPS</span>}
                        {a.highAlert && <span className="px-1 rounded border border-amber-500/40 text-amber-800 text-[9.5px] font-bold flex items-center gap-0.5"><AlertOctagon size={9} />High-alert</span>}
                        {!a.nlem && <span className="text-[9.5px] text-muted-foreground">not in NLEM</span>}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">{a.defaults ? `Usual: ${a.defaults.dosage} · ${a.defaults.frequency}${a.defaults.food ? ` ${a.defaults.food}` : ''} · ${a.defaults.durationDays} d` : 'Enter dose'}{a.brands.length ? ` · also sold as ${a.brands.slice(0, 3).join(', ')}` : ''}</div>
                    </>
                  );
                })() : (() => {
                  const y = h as AyushFormularyHit;
                  return (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-foreground">{y.name}</strong>
                        <span className="text-[10px] text-muted-foreground">{y.form}</span>
                        {y.scheduleE1.length > 0 && <span className="px-1 rounded border border-amber-500/40 text-amber-800 text-[9.5px] font-bold">Schedule E(1): {y.scheduleE1.join(', ')}</span>}
                        {y.alcohol && <span className="px-1 rounded border border-border text-[9.5px]">contains alcohol</span>}
                        {y.external && <span className="px-1 rounded border border-border text-[9.5px]">external use</span>}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">{y.defaults ? `Usual: ${y.defaults.dose} · ${y.defaults.frequency} · ${y.defaults.anupana} · ${y.defaults.durationDays} d` : 'Enter dose'}{y.keyConstituents.length ? ` · key constituents: ${y.keyConstituents.slice(0, 4).join(', ')}` : ''}</div>
                    </>
                  );
                })()}
              </button>
            );
          })}
          <button type="button" onClick={custom} className={`text-left px-2.5 py-1.5 rounded-lg border border-dashed border-primary/40 text-xs font-semibold text-primary flex items-center gap-1 ${active === hits.length ? 'bg-muted' : ''}`}>
            <Plus size={12} /> Add “{term.trim()}” as written (not in the safety database — it will not be checked)
          </button>
        </div>
      )}
    </div>
  );
});
MedicineSearch.displayName = 'MedicineSearch';
