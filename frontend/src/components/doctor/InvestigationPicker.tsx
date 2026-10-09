import React, { useEffect, useMemo, useState } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { api } from '../../services/api';
import { InvestigationOrder } from '../../types/api';

interface InvestigationPickerProps {
  value: InvestigationOrder[];
  onChange: (next: InvestigationOrder[]) => void;
}

let catalogCache: InvestigationOrder[] | null = null;

/** Tests to order. LOINC is attached where the code is certain; the rest are coded locally. */
export const InvestigationPicker: React.FC<InvestigationPickerProps> = ({ value, onChange }) => {
  const [catalog, setCatalog] = useState<InvestigationOrder[]>(catalogCache || []);
  const [term, setTerm] = useState('');
  useEffect(() => {
    if (catalogCache) return;
    api.getInvestigationCatalog().then(c => { catalogCache = c; setCatalog(c); });
  }, []);
  const hits = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter(c => c.display.toLowerCase().includes(q) || (c.id || '').includes(q)).filter(c => !value.some(v => v.id === c.id)).slice(0, 8);
  }, [term, catalog, value]);
  const add = (i: InvestigationOrder) => { onChange([...value, { ...i, urgency: 'routine' }]); setTerm(''); };

  return (
    <section className="flex flex-col gap-2" aria-label="Investigations">
      <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5"><FlaskConical size={13} /> Tests</span>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={`${v.id || v.display}`} className="pl-2.5 pr-1 py-1 rounded-lg text-xs border border-border bg-card flex items-center gap-1.5">
              {v.display}
              <button type="button" onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, urgency: x.urgency === 'urgent' ? 'routine' : 'urgent' } : x)))} className={`px-1.5 rounded text-[11px] font-bold border ${v.urgency === 'urgent' ? 'bg-rose-600 text-white border-rose-600' : 'border-border text-muted-foreground'}`}>{v.urgency === 'urgent' ? 'Urgent' : 'Routine'}</button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted" aria-label={`Remove ${v.display}`}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && term.trim()) { e.preventDefault(); add(hits[0] || { display: term.trim() }); } }}
          placeholder="Order a test (CBC, HbA1c, creatinine, dengue NS1, chest X-ray…)" className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background" aria-label="Order a test" />
        {hits.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl p-1 flex flex-col gap-0.5">
            {hits.map(h => (
              <button key={h.id} type="button" onClick={() => add(h)} className="text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted">
                {h.display}{h.loinc ? <span className="text-[11px] text-muted-foreground font-mono"> · LOINC {h.loinc}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
