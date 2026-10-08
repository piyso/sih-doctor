import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Scan, CheckCircle2, AlertTriangle, Printer, ShieldCheck, ShieldAlert, Pill, Sparkles, RefreshCw, Loader2, XCircle, Leaf } from 'lucide-react';
import { PharmacyDispenseItem } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { api } from '../../services/api';
import { printElement } from '../../utils/printDocument';
import { buildInstruction, LANGUAGE_NATIVE_NAME, RxLang, isRxLang } from '../../utils/rxInstructions';
import { HOSPITAL } from '../../utils/hospitalConfig';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING_VERIFICATION: { text: 'Waiting', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  DISPENSED: { text: 'Dispensed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  PARTIAL: { text: 'Partly given', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  NOT_DISPENSED: { text: 'Not given', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  REFERRED_BACK: { text: 'Sent back to doctor', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' }
};

const LABEL_LANGS: RxLang[] = ['hi', 'en', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];

/**
 * Pharmacy counter: signed prescriptions arrive from the doctor desk. The pharmacist checks the
 * digital signature, reviews interaction warnings, prints dose labels in the patient's language and
 * records what was handed over.
 */
export const PharmacyDeskView: React.FC = () => {
  const [queue, setQueue] = useState<PharmacyDispenseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, { valid: boolean; reason?: string } | 'checking'>>({});
  const [labelLang, setLabelLang] = useState<RxLang>('hi');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const items = await api.getPharmacyQueue();
      setQueue(items);
      setOnline(true);
      setSelectedId(prev => prev && items.some((i: PharmacyDispenseItem) => i.id === prev) ? prev : items[0]?.id || null);
    } catch {
      setOnline(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const selected = queue.find(q => q.id === selectedId) || null;

  // Check the doctor's digital signature whenever a prescription is opened.
  useEffect(() => {
    if (!selected || verification[selected.id]) return;
    setVerification(v => ({ ...v, [selected.id]: 'checking' }));
    api.verifyEncounterSignature(selected.id)
      .then(r => setVerification(v => ({ ...v, [selected.id]: r })))
      .catch(() => setVerification(v => ({ ...v, [selected.id]: { valid: false, reason: 'Could not reach the server to check the signature.' } })));
    if (isRxLang(selected.language)) setLabelLang(selected.language as RxLang);
    setNote('');
    setMessage(null);
  }, [selected, verification]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim().toUpperCase();
    if (!q) return;
    const found = queue.find(i => i.prescriptionToken.toUpperCase().includes(q) || i.patientName.toUpperCase().includes(q) || i.id.toUpperCase().startsWith(q.replace(/^RX\|/, '')));
    if (found) {
      sovereignSound('chime');
      setSelectedId(found.id);
      setSearch('');
    } else {
      sovereignSound('alert');
      setMessage({ tone: 'error', text: `No prescription found for "${search.trim()}" in the last 3 days.` });
    }
  };

  const record = async (status: 'DISPENSED' | 'PARTIAL' | 'NOT_DISPENSED' | 'REFERRED_BACK') => {
    if (!selected) return;
    if (status !== 'DISPENSED' && !note.trim()) {
      setMessage({ tone: 'error', text: 'Write a short note (e.g. which medicine was out of stock, or why it goes back to the doctor).' });
      return;
    }
    setBusy(true);
    try {
      await api.recordDispense(selected.id, status, note.trim() || undefined);
      sovereignSound('chime');
      setMessage({ tone: 'ok', text: `${STATUS_LABEL[status].text} recorded for ${selected.patientName}.` });
      load();
    } catch (e: any) {
      setMessage({ tone: 'error', text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const ver = selected ? verification[selected.id] : undefined;
  const signatureOk = ver && ver !== 'checking' && ver.valid;
  const criticalAlerts = (selected?.conflictAlerts || []).filter(a => /CRITICAL/.test(String(a.severity)));
  const otherAlerts = (selected?.conflictAlerts || []).filter(a => !/CRITICAL/.test(String(a.severity)));
  const items = selected ? [
    ...selected.allopathicMeds.map(m => ({ kind: 'allo' as const, name: m.name, detail: [m.dosage, m.frequency, m.durationDays ? `${m.durationDays} days` : '', m.route].filter(Boolean).join(' · '), instr: buildInstruction({ dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays }, labelLang) })),
    ...selected.ayushFormulations.map(a => ({ kind: 'ayush' as const, name: a.classicalName, detail: [a.dose, a.dosageForm, a.frequency, a.durationDays ? `${a.durationDays} days` : '', a.anupana ? `with ${a.anupana}` : ''].filter(Boolean).join(' · '), instr: buildInstruction({ dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }, labelLang) }))
  ] : [];

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4 space-y-4">
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600"><Pill size={20} /></div>
          <div>
            <h1 className="text-base font-extrabold text-foreground">Pharmacy counter</h1>
            <p className="text-xs text-muted-foreground">Signed prescriptions from the last 3 days{!online ? ' · server unreachable, showing last list' : ''}</p>
          </div>
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <div className="relative">
            <Scan size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Scan prescription QR / token / name" className="w-64 h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm font-mono" />
          </div>
          <button type="submit" className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Find</button>
          <button type="button" onClick={load} className="h-9 px-2.5 rounded-lg border border-border bg-background hover:bg-muted" aria-label="Refresh"><RefreshCw size={14} /></button>
        </form>
      </div>

      {message && (
        <div className={`p-2.5 rounded-xl border text-xs font-semibold ${message.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200' : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-200'}`} role="status">{message.text}</div>
      )}

      <div className="pharmacy-grid">
        {/* Queue */}
        <div className="rounded-2xl border border-border/80 bg-card p-3">
          <div className="text-xs font-bold text-muted-foreground mb-2">Prescriptions ({queue.filter(q => q.dispenseStatus === 'PENDING_VERIFICATION').length} waiting)</div>
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
            {!loaded ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>
              : queue.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">No prescriptions yet today.</div>
              : queue.map(item => {
                const st = STATUS_LABEL[item.dispenseStatus] || STATUS_LABEL.PENDING_VERIFICATION;
                return (
                  <button key={item.id} type="button" onClick={() => { sovereignSound('notch'); setSelectedId(item.id); }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors ${selectedId === item.id ? 'border-primary bg-primary/5' : 'border-border/70 bg-background hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate">{item.patientName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${st.cls}`}>{st.text}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{item.prescriptionToken} · {item.age}y · {new Date(item.prescribedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {(item.conflictAlerts || []).some(a => /CRITICAL/.test(String(a.severity))) && (
                      <div className="text-[10.5px] font-bold text-rose-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={11} /> Critical interaction warning</div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 min-h-[300px]">
          {!selected ? <div className="py-16 text-center text-sm text-muted-foreground">Select a prescription.</div> : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap border-b border-border/70 pb-3">
                <div>
                  <h2 className="text-lg font-extrabold">{selected.patientName} <span className="text-xs font-medium text-muted-foreground">· {selected.age} y · {selected.gender}</span></h2>
                  <div className="text-xs text-muted-foreground">Token {selected.prescriptionToken} · by <strong className="text-foreground">{selected.doctorName}</strong>{selected.doctorRegistration ? ` (${selected.doctorRegistration})` : ''} · {new Date(selected.prescribedAt).toLocaleString()}</div>
                </div>
                <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${ver === 'checking' || !ver ? 'border-border text-muted-foreground' : signatureOk ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
                  {ver === 'checking' || !ver ? <><Loader2 size={13} className="animate-spin" /> Checking signature…</>
                    : signatureOk ? <><ShieldCheck size={14} /> Doctor's signature valid</>
                    : <><ShieldAlert size={14} /> Signature problem: {(ver as any).reason}</>}
                </div>
              </div>

              {ver && ver !== 'checking' && !ver.valid && (
                <div className="p-3 rounded-xl bg-rose-500/10 border-2 border-rose-500/60 text-sm font-semibold text-rose-800 dark:text-rose-200">
                  Do not dispense until the doctor confirms this prescription. It may have been changed after signing.
                </div>
              )}

              {criticalAlerts.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/50">
                  <div className="text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1"><AlertTriangle size={14} /> Critical interaction — confirm with the doctor before dispensing</div>
                  {criticalAlerts.map(a => <div key={a.alertId} className="text-xs text-rose-900 dark:text-rose-100"><strong>{a.itemA} + {a.itemB}:</strong> {a.clinicalAction || a.mechanism}</div>)}
                </div>
              )}
              {otherAlerts.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
                  {otherAlerts.map(a => <div key={a.alertId} className="text-xs text-amber-900 dark:text-amber-100"><strong>{a.itemA} + {a.itemB}:</strong> {a.clinicalAction || a.mechanism}</div>)}
                </div>
              )}
              {selected.scheduleE1PoisonVerification?.containsScheduleE1 && (
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/40 text-xs font-semibold text-violet-900 dark:text-violet-100">
                  Contains a Schedule E(1) Ayurvedic medicine: dispense only against this signed prescription and record the batch.
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase">To hand over</div>
                {items.length === 0 ? <p className="text-xs text-muted-foreground">No medicines on this prescription (advice only).</p> : items.map((it, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border ${it.kind === 'ayush' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-sky-500/30 bg-sky-500/5'}`}>
                    <div className="text-sm font-bold flex items-center gap-1.5">{it.kind === 'ayush' ? <Leaf size={13} className="text-emerald-600" /> : <Pill size={13} className="text-sky-600" />}{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.detail || '—'}</div>
                  </div>
                ))}
                {(selected.ongoingMedicines || []).length > 0 && (
                  <p className="text-[11px] text-muted-foreground">Patient's own ongoing medicines (not dispensed here): {(selected.ongoingMedicines || []).map((m: any) => m.name || m.classicalName).join(', ')}</p>
                )}
                {selected.advice && <p className="text-xs"><strong>Doctor's advice:</strong> {selected.advice}</p>}
              </div>

              {selected.dispenseStatus !== 'PENDING_VERIFICATION' ? (
                <div className="p-2.5 rounded-xl bg-muted text-xs font-semibold">
                  {STATUS_LABEL[selected.dispenseStatus]?.text} by {selected.dispensedBy} at {selected.dispensedAt ? new Date(selected.dispensedAt).toLocaleString() : ''}{selected.dispenseNote ? ` — ${selected.dispenseNote}` : ''}
                </div>
              ) : (
                <div className="border-t border-border/70 pt-3 space-y-2">
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (needed if not everything was given)" className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" />
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button type="button" disabled={busy} onClick={() => record('REFERRED_BACK')} className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5"><XCircle size={14} /> Send back to doctor</button>
                    <button type="button" disabled={busy} onClick={() => record('PARTIAL')} className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold">Partly given</button>
                    <button type="button" disabled={busy || !signatureOk} onClick={() => record('DISPENSED')} title={signatureOk ? '' : 'The signature must be valid first'} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} All given to patient
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Labels */}
        <div className="rounded-2xl border border-border/80 bg-card p-3 space-y-3">
          <div className="text-xs font-bold text-muted-foreground">Dose labels</div>
          {!selected ? <p className="text-xs text-muted-foreground">Select a prescription.</p> : (
            <>
              <select value={labelLang} onChange={e => setLabelLang(e.target.value as RxLang)} className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm">
                {LABEL_LANGS.map(l => <option key={l} value={l}>{LANGUAGE_NATIVE_NAME[l]}{selected.language === l ? ' (patient\'s language)' : ''}</option>)}
              </select>
              <div ref={labelRef} style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                {items.map((it, i) => (
                  <div key={i} style={{ border: '1px solid #94a3b8', borderRadius: 6, padding: 8, marginBottom: 8, pageBreakInside: 'avoid', width: '100%', maxWidth: 320 }}>
                    <div style={{ fontSize: 9, color: '#475569' }}>{HOSPITAL.name} · {selected.prescriptionToken}</div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{it.name}</div>
                    <div style={{ fontSize: 11 }}>{selected.patientName} · {new Date(selected.prescribedAt).toLocaleDateString('en-IN')}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{it.instr || it.detail}</div>
                    {!it.instr && labelLang !== 'en' && <div style={{ fontSize: 9, color: '#b45309' }}>Instruction not translatable automatically — explain to the patient.</div>}
                  </div>
                ))}
              </div>
              <button type="button" disabled={!items.length} onClick={() => { sovereignSound('shutter'); printElement(labelRef.current, `Labels — ${selected.patientName}`); }} className="w-full h-10 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Printer size={14} /> Print labels
              </button>
              <p className="text-[10.5px] text-muted-foreground flex gap-1"><Sparkles size={11} className="shrink-0 mt-0.5" /> Labels are generated from the doctor's exact frequency and duration. Check each one against the prescription.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
