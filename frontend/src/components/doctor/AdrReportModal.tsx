import React, { useState } from 'react';
import { X, Siren, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { SessionDetail, TimelineEncounter } from '../../types/api';

interface AdrReportModalProps {
  session: SessionDetail;
  onClose: () => void;
}

/**
 * Suspected adverse drug reaction, pre-filled from the patient's recent medicines. Modern medicines
 * go to PvPI (Indian Pharmacopoeia Commission, HCP form v1.4 fields); Ayurvedic ones to the
 * Ministry of Ayush pharmacovigilance portal (Ayush Suraksha). The report is prepared here and
 * submitted on the national portal; its reference number is then recorded.
 */
export const AdrReportModal: React.FC<AdrReportModalProps> = ({ session, onClose }) => {
  const recent: Array<{ name: string; stream: string; dosage?: string }> = (session.previousEncounters || []).flatMap((e: TimelineEncounter) => e.medicines.map(m => ({ name: m.name, stream: m.stream, dosage: m.dosage }))).slice(0, 12);
  const [picked, setPicked] = useState<string[]>([]);
  const [reaction, setReaction] = useState('');
  const [onset, setOnset] = useState('');
  const [seriousness, setSeriousness] = useState('non-serious');
  const [outcome, setOutcome] = useState('recovering');
  const [action, setAction] = useState('drug withdrawn');
  const [other, setOther] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saved, setSaved] = useState<{ channel: string } | null>(null);

  const submit = async () => {
    setState('saving');
    const suspected = [...recent.filter(m => picked.includes(m.name)), ...(other.trim() ? [{ name: other.trim(), stream: 'ALLOPATHY' }] : [])];
    try {
      const r = await api.createAdrReport({ patientId: session.patientId, sessionId: session.sessionId, reaction, onset, seriousness, outcome, actionTaken: action, suspectedMedicines: suspected });
      setSaved({ channel: r.data.channel });
      setState('done');
    } catch { setState('error'); }
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Report a suspected adverse drug reaction">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold flex items-center gap-2"><Siren size={16} className="text-rose-600" /> Suspected adverse drug reaction — {session.patientName}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} /></button></div>
        {state === 'done' ? (
          <div className="text-sm text-foreground flex flex-col gap-2">
            <span className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Report prepared for {saved?.channel}.</span>
            <span className="text-xs text-muted-foreground">Submit it on the national portal (PvPI: ipc.gov.in / ADR PvPI app, helpline 1800-180-3024; Ayush Suraksha for Ayurvedic medicines), then record the reference number from the Pharmacovigilance list. Reporting has no legal implication for the reporter.</span>
            <button type="button" onClick={onClose} className="self-end h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Done</button>
          </div>
        ) : (
          <>
            <span className="text-xs font-bold">Suspected medicine(s)</span>
            <div className="flex flex-wrap gap-1.5">
              {recent.map(m => (
                <label key={m.name} className={`px-2 py-1 rounded-lg border text-xs cursor-pointer ${picked.includes(m.name) ? 'bg-rose-500/10 border-rose-500/50' : 'border-border'}`}>
                  <input type="checkbox" className="mr-1" checked={picked.includes(m.name)} onChange={e => setPicked(p => (e.target.checked ? [...p, m.name] : p.filter(x => x !== m.name)))} />{m.name}{m.dosage ? ` ${m.dosage}` : ''}
                </label>
              ))}
              {recent.length === 0 && <span className="text-xs text-muted-foreground">No previous prescriptions on record.</span>}
            </div>
            <input value={other} onChange={e => setOther(e.target.value)} placeholder="Other medicine (name, strength)" className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background" />
            <label className="flex flex-col gap-1 text-xs font-bold">Reaction<textarea value={reaction} onChange={e => setReaction(e.target.value)} rows={2} placeholder="What happened (e.g. itchy rash 2 hours after the first dose)" className="px-2.5 py-2 text-xs font-normal rounded-lg border border-border bg-background" /></label>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <label className="flex flex-col gap-1 text-xs font-bold">Onset<input value={onset} onChange={e => setOnset(e.target.value)} placeholder="date / time" className="px-2 py-1 text-xs font-normal rounded-lg border border-border bg-background" /></label>
              <label className="flex flex-col gap-1 text-xs font-bold">Seriousness<select value={seriousness} onChange={e => setSeriousness(e.target.value)} className="px-2 py-1 text-xs font-normal rounded-lg border border-border bg-background"><option value="non-serious">Non-serious</option><option value="hospitalisation">Hospitalisation</option><option value="life-threatening">Life-threatening</option><option value="disability">Disability</option><option value="death">Death</option></select></label>
              <label className="flex flex-col gap-1 text-xs font-bold">Outcome<select value={outcome} onChange={e => setOutcome(e.target.value)} className="px-2 py-1 text-xs font-normal rounded-lg border border-border bg-background"><option value="recovering">Recovering</option><option value="recovered">Recovered</option><option value="not recovered">Not recovered</option><option value="unknown">Unknown</option></select></label>
              <label className="flex flex-col gap-1 text-xs font-bold">Action taken<select value={action} onChange={e => setAction(e.target.value)} className="px-2 py-1 text-xs font-normal rounded-lg border border-border bg-background"><option value="drug withdrawn">Drug withdrawn</option><option value="dose reduced">Dose reduced</option><option value="dose not changed">Dose not changed</option><option value="unknown">Unknown</option></select></label>
            </div>
            {state === 'error' && <div className="text-xs font-semibold text-rose-700">The report could not be saved.</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancel</button>
              <button type="button" disabled={state === 'saving' || reaction.trim().length < 3 || (picked.length === 0 && !other.trim())} onClick={submit} className="h-9 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5">{state === 'saving' && <Loader2 size={14} className="animate-spin" />} Prepare report</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
