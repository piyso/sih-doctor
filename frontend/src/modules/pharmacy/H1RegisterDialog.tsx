import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { apiFetch, BASE_URL } from '../../services/api';
import { printElement } from '../../utils/printDocument';
import { HOSPITAL } from '../../utils/hospitalConfig';

interface RegisterEntry {
  suppliedAt: string;
  encounterId: string;
  token: string | null;
  prescriber: string;
  prescriberRegistration: string;
  patient: string;
  age: number;
  gender: string;
  medicine: string;
  generic: string;
  schedule: 'H1' | 'NDPS';
  quantity: number | null;
  batch: string | null;
  supplied: 'yes' | 'not recorded';
  pharmacist: string;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};
const dayText = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The Schedule H1 register: every supply of a Schedule H1 or NDPS medicine with its prescriber, patient,
 * medicine and quantity. The server builds it from the signed prescriptions and the hand-over records,
 * so the pharmacist does not keep a second, hand-written copy that can drift from what was dispensed.
 */
export const H1RegisterDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [entries, setEntries] = useState<RegisterEntry[] | null>(null);
  const [error, setError] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/doctor/h1-register?from=${from}&to=${to}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `The register could not be loaded (${res.status}).`);
      setEntries(body?.data?.entries || []);
    } catch (e: any) {
      setEntries(null);
      setError(e?.message || 'The register could not be loaded.');
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // A dialog: focus moves in, Escape closes, and focus goes back to where it was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // Capture phase, and stop it there: the app shell treats a bare Escape as "back to all screens".
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); before?.focus?.(); };
  }, [onClose]);

  const unconfirmed = (entries || []).filter(e => e.supplied !== 'yes').length;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="h1-register-title" className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4">
          <div className="min-w-0">
            <h2 id="h1-register-title" className="text-base font-extrabold text-foreground">Schedule H1 register</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Every Schedule H1 or NDPS medicine handed over, taken from the signed prescriptions and the hand-over records. To be kept for three years.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the register" className="h-9 w-9 rounded-lg hover:bg-muted inline-flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>

        <div className="px-4 sm:px-5 py-3 flex items-end gap-2 flex-wrap">
          <label className="text-[11px] font-semibold text-muted-foreground">From
            <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} className="block mt-0.5 h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">To
            <input type="date" value={to} min={from} max={isoDay(new Date())} onChange={e => e.target.value && setTo(e.target.value)} className="block mt-0.5 h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <button type="button" disabled={!entries?.length} onClick={() => printElement(sheetRef.current, `Schedule H1 register ${from} to ${to}`)}
            className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-45 ml-auto">
            <Printer size={14} /> Print
          </button>
        </div>

        <div ref={sheetRef} className="px-4 sm:px-5 pb-5">
          {/* Printed heading (the screen already says this above). */}
          <div className="hidden print:block mb-3">
            <div className="text-base font-extrabold">{HOSPITAL.name}</div>
            <div className="text-xs">{HOSPITAL.address}</div>
            <div className="text-sm font-bold mt-2">Schedule H1 register · {dayText(from)} to {dayText(to)}</div>
          </div>
          {error ? <p role="alert" className="py-6 text-sm font-semibold text-rose-700">{error}</p>
            : !entries ? <p className="py-8 text-center text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1.5" /> Loading…</p>
            : entries.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No Schedule H1 or NDPS medicine was handed over between {dayText(from)} and {dayText(to)}.</p>
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-semibold">Supplied</th>
                        <th className="py-2 pr-3 font-semibold">Patient</th>
                        <th className="py-2 pr-3 font-semibold">Medicine</th>
                        <th className="py-2 pr-3 font-semibold text-right">Quantity</th>
                        <th className="py-2 pr-3 font-semibold">Batch</th>
                        <th className="py-2 pr-3 font-semibold">Prescriber</th>
                        <th className="py-2 font-semibold">Given by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, i) => (
                        <tr key={`${e.encounterId}-${e.medicine}-${i}`} className="border-b border-border/50 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">{when(e.suppliedAt)}</td>
                          <td className="py-2 pr-3"><span className="font-semibold text-foreground">{e.patient}</span><span className="block text-muted-foreground">{e.age} y{e.token ? ` · ${e.token}` : ''}</span></td>
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-foreground">{e.medicine}</span>
                            <span className="block text-muted-foreground">{e.generic.toLowerCase() !== e.medicine.toLowerCase() ? `${e.generic} · ` : ''}{e.schedule === 'NDPS' ? 'NDPS' : 'Schedule H1'}</span>
                            {e.supplied !== 'yes' && <span className="block font-semibold text-amber-800">Partly given — this line was not confirmed</span>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-bold">{e.quantity ?? '—'}</td>
                          <td className="py-2 pr-3 font-mono">{e.batch || '—'}</td>
                          <td className="py-2 pr-3">{e.prescriber}{e.prescriberRegistration && <span className="block text-muted-foreground">{e.prescriberRegistration}</span>}</td>
                          <td className="py-2">{e.pharmacist}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {entries.length} suppl{entries.length === 1 ? 'y' : 'ies'}. Prescriber’s address: {HOSPITAL.name}, {HOSPITAL.address}.
                  {unconfirmed > 0 ? ` ${unconfirmed} line${unconfirmed === 1 ? ' was' : 's were'} on a partly-given prescription without a per-medicine record — confirm against stock.` : ''}
                </p>
              </>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};
