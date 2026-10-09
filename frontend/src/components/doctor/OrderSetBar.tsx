import React, { useEffect, useState } from 'react';
import { ListChecks, Repeat, Star, Save, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import { OrderSet, TimelineEncounter } from '../../types/api';
import { DoctorRole } from './doctorRole';

interface OrderSetBarProps {
  role: DoctorRole;
  canPrescribe: boolean;
  lastEncounter?: TimelineEncounter;
  onApplySet: (set: OrderSet, stepMedicines?: any[]) => void;
  onAddFavourite: (item: any) => void;
  onRepeat: (enc: TimelineEncounter) => void;
  onSaveCurrent: (name: string) => Promise<void>;
  hasItems: boolean;
}

/** Fast paths: national-protocol order sets, the doctor's own favourites, repeat last prescription. */
export const OrderSetBar: React.FC<OrderSetBarProps> = ({ role, canPrescribe, lastEncounter, onApplySet, onAddFavourite, onRepeat, onSaveCurrent, hasItems }) => {
  const [sets, setSets] = useState<OrderSet[]>([]);
  const [favs, setFavs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    api.getOrderSets(role).then(s => alive && setSets(s));
    if (canPrescribe) api.getFavourites(role).then(f => alive && setFavs(f.slice(0, 8)));
    return () => { alive = false; };
  }, [role, canPrescribe]);

  const lastSameStream = lastEncounter && lastEncounter.medicines.some(m => m.stream === role);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative">
          <button type="button" onClick={() => setOpen(o => !o)} className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted inline-flex items-center gap-1.5" aria-expanded={open}>
            <ListChecks size={13} /> Order sets <ChevronDown size={12} />
          </button>
          {open && (
            <div className="absolute z-40 mt-1 w-[min(92vw,420px)] max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-1.5 flex flex-col gap-1">
              {sets.map(s => (
                <div key={s.id} className="rounded-lg border border-border p-2">
                  <button type="button" onClick={() => { onApplySet(s); setOpen(false); }} className="w-full text-left">
                    <div className="text-xs font-bold text-foreground">{s.name}{s.mine ? <span className="ml-1 text-[11px] text-primary">mine</span> : null}</div>
                    <div className="text-[11px] text-muted-foreground">{s.medicines.map((m: any) => m.name || m.classicalName).join(', ') || '—'}</div>
                    {s.source && <div className="text-[11px] text-muted-foreground italic">{s.source}</div>}
                  </button>
                  {s.steps && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.steps.map(st => (
                        <button key={st.step} type="button" onClick={() => { onApplySet(s, st.medicines); setOpen(false); }} className="px-1.5 py-0.5 rounded border border-sky-500/40 text-[11px] font-semibold text-sky-800 dark:text-sky-300 hover:bg-sky-500/10" title={`Step ${st.step}`}>
                          {st.step}. {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sets.length === 0 && <div className="text-[11px] text-muted-foreground p-2">No order sets available.</div>}
            </div>
          )}
        </div>
        {lastSameStream && (
          <button type="button" onClick={() => onRepeat(lastEncounter!)} className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted inline-flex items-center gap-1.5" title={`Repeat the prescription of ${new Date(lastEncounter!.date).toLocaleDateString('en-IN')}`}>
            <Repeat size={13} /> Repeat last ({new Date(lastEncounter!.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
          </button>
        )}
        {canPrescribe && hasItems && (
          <button type="button" disabled={saving} onClick={async () => {
            const name = window.prompt('Name for this order set (e.g. “My fever, adult”)');
            if (!name?.trim()) return;
            setSaving(true);
            try { await onSaveCurrent(name.trim()); setSets(await api.getOrderSets(role)); } finally { setSaving(false); }
          }} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted inline-flex items-center gap-1.5"><Save size={13} /> Save as my set</button>
        )}
      </div>
      {favs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <Star size={12} className="text-amber-500" />
          {favs.map(f => (
            <button key={(f.name || f.classicalName) + (f.dosage || f.dose || '')} type="button" onClick={() => onAddFavourite(f)} className="px-2 py-0.5 rounded-lg border border-border bg-background hover:bg-muted font-semibold" title={`Prescribed ${f.timesPrescribed} times`}>
              + {f.name || f.classicalName}{(f.dosage || f.dose) ? ` ${f.dosage || f.dose}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
