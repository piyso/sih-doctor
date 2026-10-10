import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Search, Check } from 'lucide-react';
import { api } from '../../services/api';
import { DiagnosisEntry } from '../../types/api';
import { DoctorRole, suggestionToDiagnosis } from './doctorRole';

interface DiagnosisPickerProps {
  role: DoctorRole;
  value: DiagnosisEntry[];
  onChange: (next: DiagnosisEntry[]) => void;
  suggestions: any[];
}

/**
 * The doctor's diagnosis. Kiosk suggestions are chips to accept, never the default. Search covers
 * the terminology index (NAMASTE, ICD-11 TM2/MMS when imported); free text is always allowed.
 * A vaidya can record both an Ayurvedic and a biomedical diagnosis (dual coding, ICD-11 TM2 intent).
 */
export const DiagnosisPicker: React.FC<DiagnosisPickerProps> = ({ role, value, onChange, suggestions }) => {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<any[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setHits([]); return; }
    const my = ++seq.current;
    const t = setTimeout(() => api.searchDiagnoses(q).then(r => { if (my === seq.current) setHits(r); }), 180);
    return () => clearTimeout(t);
  }, [term]);

  const add = (d: DiagnosisEntry) => {
    if (value.some(v => v.display.toLowerCase() === d.display.toLowerCase())) return;
    onChange([...value, d]);
    setTerm('');
    setHits([]);
  };
  const pendingSuggestions = suggestions
    .map(s => suggestionToDiagnosis(s, role))
    .filter((d): d is DiagnosisEntry => !!d && !value.some(v => v.display.toLowerCase() === d.display.toLowerCase()))
    // Two complaints can resolve to the same diagnosis: offer it once.
    .filter((d, i, all) => all.findIndex(x => x.display.toLowerCase() === d.display.toLowerCase()) === i)
    .slice(0, 3);

  return (
    <section className="flex flex-col gap-2" aria-label="Diagnosis">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-foreground">Diagnosis</span>
        {value.length === 0 && <span className="text-[11px] text-amber-800 font-semibold">Not recorded yet</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((d, i) => (
          <span key={d.display} className={`pl-2.5 pr-1 py-1 rounded-lg text-xs border flex items-center gap-1.5 ${d.status === 'final' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-card border-border'}`}>
            <span className="font-semibold text-foreground">{d.display}</span>
            {d.icd10 && <span className="font-mono text-[11px] text-muted-foreground">ICD-10 {d.icd10}</span>}
            {d.system === 'NAMASTE' && d.code && d.codeVerified && <span className="font-mono text-[11px] text-muted-foreground">NAMASTE {d.code}</span>}
            <button type="button" onClick={() => onChange(value.map((v, j) => (j === i ? { ...v, status: v.status === 'final' ? 'provisional' : 'final' } : v)))}
              className={`px-1.5 rounded text-[11px] font-bold border ${d.status === 'final' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border text-muted-foreground'}`} title="Toggle provisional / final">
              {d.status === 'final' ? 'Final' : 'Provisional'}
            </button>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted" aria-label={`Remove ${d.display}`}><X size={11} /></button>
          </span>
        ))}
      </div>
      {pendingSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">Suggested from the kiosk intake:</span>
          {pendingSuggestions.map(s => (
            <button key={s.display} type="button" onClick={() => add(s)} className="min-h-8 px-2 py-1 rounded-lg border border-dashed border-emerald-500/50 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 flex items-center gap-1">
              <Check size={11} /> {s.display}{s.icd10 ? ` · ${s.icd10}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && term.trim()) {
              e.preventDefault();
              const h = hits[0];
              add(h ? { display: h.display, system: h.system, code: h.code, codeVerified: h.codeVerified, icd10: h.icd10, snomed: h.snomed, english: h.english, status: 'provisional', source: 'doctor' }
                : { display: term.trim(), system: 'FREE_TEXT', status: 'provisional', source: 'doctor' });
            }
          }}
          placeholder={role === 'AYURVEDA' ? 'Search Ayurvedic or biomedical diagnosis (e.g. Amlapitta, sandhivata, fever)…' : 'Search diagnosis or type it (e.g. acute pharyngitis)…'}
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background"
          aria-label="Search diagnosis"
        />
        {term.trim().length >= 2 && (
          <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-1 flex flex-col gap-0.5">
            {hits.map(h => (
              <button key={`${h.system}-${h.code}`} type="button" onClick={() => add({ display: h.display, system: h.system, code: h.code, codeVerified: h.codeVerified, icd10: h.icd10, snomed: h.snomed, english: h.english, status: 'provisional', source: 'doctor' })}
                className="text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted">
                <strong className="text-foreground">{h.display}</strong>
                <span className="block text-[11px] text-muted-foreground">
                  {[h.icd10 && `ICD-10 ${h.icd10}`, h.icd11 && `ICD-11 ${h.icd11}`, h.codeVerified ? `${h.system} ${h.code}` : null].filter(Boolean).join(' · ') || h.system}
                  {!h.codeVerified && ' · demo term (official NAMASTE code not imported)'}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => add({ display: term.trim(), system: 'FREE_TEXT', status: 'provisional', source: 'doctor' })} className="text-left px-2.5 py-1.5 rounded-lg border border-dashed border-primary/40 text-xs font-semibold text-primary flex items-center gap-1">
              <Plus size={12} /> Record “{term.trim()}” as written
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
