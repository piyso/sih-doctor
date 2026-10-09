import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Scan, CheckCircle2, AlertTriangle, Printer, ShieldCheck, ShieldAlert, Pill, Sparkles, RefreshCw, Loader2, XCircle, Leaf, Check } from 'lucide-react';
import { ConflictAlert, PharmacyDispenseItem } from '../../types/api';
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

const isCritical = (a: { severity?: unknown }) => /CRITICAL/.test(String(a.severity));
/** Older records carry the pair and the advice under different field names. */
const alertText = (a: ConflictAlert) => {
  const pair = [a.itemA || a.allopathicDrug, a.itemB || a.ayushHerb].filter(Boolean).join(' × ');
  const what = a.clinicalAction || a.recommendedAction || a.mechanism || a.clinicalConsequence || 'Details not recorded — check with the doctor.';
  return <>{pair && <strong>{pair}: </strong>}{what}</>;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Small uppercase heading used for every block of the counter, so the page reads as one system. */
const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{children}</h3>
    {right}
  </div>
);

/**
 * Pharmacy counter: signed prescriptions arrive from the doctor desk. The pharmacist checks the
 * digital signature, reviews interaction warnings, picks each medicine, prints dose labels in the
 * patient's language and records what was handed over.
 */
export const PharmacyDeskView: React.FC = () => {
  const [queue, setQueue] = useState<PharmacyDispenseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, { valid: boolean; reason?: string } | 'checking'>>({});
  const [labelLang, setLabelLang] = useState<RxLang>('hi');
  /** Lines the pharmacist has ticked as picked, per prescription (a working aid; not saved). */
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const items = await api.getPharmacyQueue();
      setQueue(items);
      setOnline(true);
      setSelectedId(prev => {
        if (prev && items.some((i: PharmacyDispenseItem) => i.id === prev)) return prev;
        const firstWaiting = items.find((i: PharmacyDispenseItem) => i.dispenseStatus === 'PENDING_VERIFICATION');
        return (firstWaiting || items[0])?.id || null;
      });
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
  const pending = queue.filter(q => q.dispenseStatus === 'PENDING_VERIFICATION');
  const done = queue.filter(q => q.dispenseStatus !== 'PENDING_VERIFICATION');
  const shown = tab === 'pending' ? pending : done;

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

  const open = (item: PharmacyDispenseItem) => {
    setSelectedId(item.id);
    setTab(item.dispenseStatus === 'PENDING_VERIFICATION' ? 'pending' : 'done');
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim().toUpperCase();
    if (!q) return;
    const found = queue.find(i => i.prescriptionToken.toUpperCase().includes(q) || i.patientName.toUpperCase().includes(q) || i.id.toUpperCase().startsWith(q.replace(/^RX\|/, '')));
    if (found) {
      sovereignSound('chime');
      open(found);
      setSearch('');
    } else {
      sovereignSound('alert');
      setMessage({ tone: 'error', text: `No prescription found for "${search.trim()}" in the last 3 days.` });
    }
  };

  const ver = selected ? verification[selected.id] : undefined;
  const signatureOk = ver && ver !== 'checking' && ver.valid;
  const criticalAlerts = (selected?.conflictAlerts || []).filter(isCritical);
  const otherAlerts = (selected?.conflictAlerts || []).filter(a => !isCritical(a));
  const acknowledged: any[] = (selected as any)?.acknowledgedAlerts || [];
  const scheduleH1: any[] = (selected as any)?.scheduleH1 || [];
  const diagnoses: string[] = (selected as any)?.diagnoses || [];
  const hasE1 = !!selected?.scheduleE1PoisonVerification?.containsScheduleE1;
  const hasChecks = criticalAlerts.length + otherAlerts.length + scheduleH1.length > 0 || hasE1;
  const items = selected ? [
    ...selected.allopathicMeds.map((m: any) => ({ kind: 'allo' as const, name: m.name, detail: [m.dosage, m.frequency, m.durationDays ? `${m.durationDays} days` : '', m.quantity ? `Qty ${m.quantity}` : '', m.indication ? `for ${m.indication}` : ''].filter(Boolean).join(' · '), instr: buildInstruction({ dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays }, labelLang) })),
    ...selected.ayushFormulations.map(a => ({ kind: 'ayush' as const, name: a.classicalName, detail: [a.dose, a.dosageForm, a.frequency, a.durationDays ? `${a.durationDays} days` : '', a.anupana ? `with ${a.anupana}` : ''].filter(Boolean).join(' · '), instr: buildInstruction({ dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }, labelLang) }))
  ] : [];
  const pickedHere = selected ? picked[selected.id] || [] : [];
  const notPicked = items.filter((_, i) => !pickedHere.includes(i)).map(it => it.name || 'unnamed item');
  const togglePicked = (i: number) => {
    if (!selected) return;
    setPicked(p => {
      const cur = p[selected.id] || [];
      return { ...p, [selected.id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] };
    });
  };

  const record = async (status: 'DISPENSED' | 'PARTIAL' | 'NOT_DISPENSED' | 'REFERRED_BACK') => {
    if (!selected) return;
    // A partly-given record names what was not given; the ticks fill that in when the note is empty.
    const text = note.trim() || (status === 'PARTIAL' && pickedHere.length > 0 && notPicked.length > 0 ? `Not given: ${notPicked.join(', ')}` : '');
    if (status !== 'DISPENSED' && !text) {
      setMessage({ tone: 'error', text: 'Write a short note (e.g. which medicine was out of stock, or why it goes back to the doctor).' });
      return;
    }
    setBusy(true);
    try {
      await api.recordDispense(selected.id, status, text || undefined);
      sovereignSound('chime');
      setMessage({ tone: 'ok', text: `${STATUS_LABEL[status].text} recorded for ${selected.patientName}.` });
      load();
    } catch (e: any) {
      setMessage({ tone: 'error', text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1480px] mx-auto px-3 sm:px-5 py-4 space-y-3">
      {/* Summary strip and the first thing done at the counter: find the prescription. The screen name is in the top bar. */}
      <div className="rounded-2xl border border-border/80 bg-card px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{pending.length}</strong> to dispense</span>
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{done.length}</strong> done</span>
          <span>Signed prescriptions from the last 3 days</span>
          {!online && <span className="px-2 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold">Server unreachable — showing the last list</span>}
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Scan size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Scan Rx QR, or type token / name" aria-label="Find prescription" className="w-full sm:w-80 h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm" />
          </div>
          <button type="submit" className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Find</button>
          <button type="button" onClick={load} className="h-9 px-2.5 rounded-lg border border-border bg-background hover:bg-muted" aria-label="Refresh" title="Refresh"><RefreshCw size={14} /></button>
        </form>
      </div>

      {message && (
        <div className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${message.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200' : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-200'}`} role="status">
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="p-0.5 rounded hover:bg-background/60" aria-label="Dismiss"><XCircle size={14} /></button>
        </div>
      )}

      <div className="pharmacy-grid">
        {/* Queue */}
        <div className="pharmacy-pane rounded-2xl border border-border/80 bg-card p-3 flex flex-col">
          <div className="flex gap-0.5 p-0.5 mb-2.5 rounded-xl bg-muted/60 border border-border/70" role="tablist">
            {([{ id: 'pending', label: 'To dispense', n: pending.length }, { id: 'done', label: 'Done', n: done.length }] as const).map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t.label} <span className="font-mono">{t.n}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
            {!loaded ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>
              : shown.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">{tab === 'pending' ? 'Nothing waiting — new prescriptions appear here as soon as the doctor signs.' : 'Nothing dispensed yet today.'}</div>
              : shown.map(item => {
                const st = STATUS_LABEL[item.dispenseStatus] || STATUS_LABEL.PENDING_VERIFICATION;
                const critical = (item.conflictAlerts || []).some(isCritical);
                const active = selectedId === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => { sovereignSound('notch'); setSelectedId(item.id); }} aria-pressed={active}
                    className={`w-full text-left pl-3 pr-2.5 py-2 rounded-xl border border-l-4 transition-colors ${critical ? 'border-l-rose-500' : 'border-l-transparent'} ${active ? 'border-primary bg-primary/5' : 'border-border/70 bg-background hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate">{item.patientName}</span>
                      {tab === 'done'
                        ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${st.cls}`}>{st.text}</span>
                        : <span className="text-[11px] font-mono text-muted-foreground shrink-0">{timeOf(item.prescribedAt)}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{item.prescriptionToken} · {item.age}y · {item.doctorName}</div>
                    {critical && <div className="text-[10.5px] font-bold text-rose-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={11} /> Critical interaction warning</div>}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border/80 bg-card min-h-[300px] flex flex-col">
          {!selected ? <div className="py-16 text-center text-sm text-muted-foreground">Select a prescription, or scan its QR code.</div> : (
            <>
              <div className="p-4 space-y-4 flex-1">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-tight">{selected.patientName} <span className="text-xs font-medium text-muted-foreground">· {selected.age} y · {selected.gender}</span></h2>
                    <div className="text-xs text-muted-foreground mt-0.5">Token <span className="font-mono text-foreground">{selected.prescriptionToken}</span> · {selected.doctorName}{selected.doctorRegistration ? ` (${selected.doctorRegistration})` : ''} · {new Date(selected.prescribedAt).toLocaleString()}</div>
                    {diagnoses.length > 0 && <div className="text-xs mt-1"><span className="text-muted-foreground">Diagnosis:</span> <strong>{diagnoses.join(', ')}</strong></div>}
                  </div>
                  {selected.dispenseStatus !== 'PENDING_VERIFICATION' && (
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${STATUS_LABEL[selected.dispenseStatus]?.cls || ''}`}>{STATUS_LABEL[selected.dispenseStatus]?.text}</span>
                  )}
                </div>

                {/* Step 1 — is this the prescription the doctor signed? */}
                {ver === 'checking' || !ver ? (
                  <div className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Checking the doctor's signature…</div>
                ) : signatureOk ? (
                  <div className="px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"><ShieldCheck size={15} /> Seal valid — unchanged since the doctor signed</div>
                ) : (
                  <div className="p-3 rounded-xl border-2 border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200" role="alert">
                    <div className="text-sm font-extrabold flex items-center gap-2"><ShieldAlert size={16} /> Do not dispense until the doctor confirms this prescription</div>
                    <div className="text-xs font-semibold mt-0.5">Signature problem: {(ver as any).reason} It may have been changed after signing.</div>
                  </div>
                )}

                {/* Step 2 — what to watch for before handing over. */}
                {hasChecks && (
                  <section>
                    <SectionTitle>Check before handing over</SectionTitle>
                    <div className="space-y-2">
                      {criticalAlerts.length > 0 && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/50">
                          <div className="text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1"><AlertTriangle size={14} /> Serious alert{criticalAlerts.length > 1 ? 's' : ''} the doctor signed through</div>
                          {criticalAlerts.map((a, i) => <div key={`${a.groupKey || a.alertId}-${i}`} className="text-xs text-rose-900 dark:text-rose-100">{alertText(a)}</div>)}
                          {acknowledged.map((k: any) => (
                            <div key={k.groupKey} className="mt-1.5 text-xs text-foreground bg-card/70 rounded-lg px-2 py-1 border border-border"><strong>Doctor’s reason ({k.summary}):</strong> {k.reason}</div>
                          ))}
                          {!acknowledged.length && <div className="mt-1 text-xs font-semibold text-rose-800 dark:text-rose-200">No reason recorded — confirm with the doctor before dispensing.</div>}
                        </div>
                      )}
                      {otherAlerts.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-0.5">
                          {otherAlerts.map((a, i) => <div key={`${a.groupKey || a.alertId}-${i}`} className="text-xs text-amber-900 dark:text-amber-100">{alertText(a)}</div>)}
                        </div>
                      )}
                      {hasE1 && (
                        <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/40 text-xs font-semibold text-violet-900 dark:text-violet-100">
                          Schedule E(1): {((selected.scheduleE1PoisonVerification as any).items || []).map((x: any) => `${x.name} (${x.ingredients.join(', ')})`).join('; ') || 'Ayurvedic medicine with a poisonous ingredient'} — label “Caution: to be taken under medical supervision”; dispense only against this prescription and record the batch.
                        </div>
                      )}
                      {scheduleH1.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-900 dark:text-amber-100">
                          Enter in the Schedule H1 register (prescriber, patient, drug, quantity; keep 3 years): {scheduleH1.map((x: any) => `${x.generic}${x.ndps ? ' — NDPS' : ''}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Step 3 — pick and hand over. Ticks are a working aid for the pharmacist. */}
                <section>
                  <SectionTitle right={items.length > 0 && selected.dispenseStatus === 'PENDING_VERIFICATION' ? <span className="text-[11px] font-semibold text-muted-foreground">{pickedHere.length} of {items.length} picked</span> : undefined}>
                    To hand over ({items.length})
                  </SectionTitle>
                  {items.length === 0 ? <p className="text-xs text-muted-foreground">No medicines on this prescription (advice only).</p> : (
                    <div className="rounded-xl border border-border/80 divide-y divide-border/60 overflow-hidden">
                      {items.map((it, i) => {
                        const isPicked = pickedHere.includes(i);
                        const canTick = selected.dispenseStatus === 'PENDING_VERIFICATION';
                        return (
                          <label key={i} className={`flex items-start gap-3 px-3 py-2.5 ${canTick ? 'cursor-pointer hover:bg-muted/40' : ''} ${isPicked ? 'bg-emerald-500/5' : ''}`}>
                            {canTick && (
                              <span className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${isPicked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border bg-background'}`}>
                                {isPicked && <Check size={13} strokeWidth={3} />}
                                <input type="checkbox" className="sr-only" checked={isPicked} onChange={() => togglePicked(i)} aria-label={`Picked ${it.name || 'unnamed item'}`} />
                              </span>
                            )}
                            <span className="mt-0.5 shrink-0">{it.kind === 'ayush' ? <Leaf size={14} className="text-emerald-600" /> : <Pill size={14} className="text-sky-600" />}</span>
                            <span className="min-w-0">
                              {it.name
                                ? <span className={`block text-sm font-bold ${isPicked ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>{it.name}</span>
                                : <span className="block text-sm font-bold text-amber-700 dark:text-amber-300">Name missing — confirm with the doctor</span>}
                              <span className="block text-xs text-muted-foreground">{it.detail || '—'}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {((selected.ongoingMedicines || []).length > 0 || selected.advice) && (
                    <div className="mt-2 space-y-1 text-xs">
                      {selected.advice && <p><span className="text-muted-foreground">Doctor's advice:</span> {selected.advice}</p>}
                      {(selected.ongoingMedicines || []).length > 0 && (
                        <p className="text-muted-foreground">Patient's own ongoing medicines (not dispensed here): {(selected.ongoingMedicines || []).map((m: any) => m.name || m.classicalName).join(', ')}</p>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* Step 4 — record what happened. Stays on screen while scrolling a long prescription. */}
              {selected.dispenseStatus !== 'PENDING_VERIFICATION' ? (
                <div className="m-4 mt-0 p-2.5 rounded-xl bg-muted text-xs font-semibold">
                  {STATUS_LABEL[selected.dispenseStatus]?.text} by {selected.dispensedBy} at {selected.dispensedAt ? new Date(selected.dispensedAt).toLocaleString() : ''}{selected.dispenseNote ? ` — ${selected.dispenseNote}` : ''}
                </div>
              ) : (
                <div className="sticky bottom-0 border-t border-border/70 bg-card/95 backdrop-blur rounded-b-2xl px-4 py-3 flex items-center justify-end gap-2 flex-wrap">
                  <input value={note} onChange={e => setNote(e.target.value)}
                    placeholder={pickedHere.length > 0 && notPicked.length > 0 ? `Note — e.g. Not given: ${notPicked.join(', ')}` : 'Note (needed if not everything was given)'}
                    aria-label="Dispensing note" className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                  <button type="button" disabled={busy} onClick={() => record('REFERRED_BACK')} className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center gap-1.5"><XCircle size={14} /> Send back to doctor</button>
                  <button type="button" disabled={busy} onClick={() => record('PARTIAL')} className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold">Partly given</button>
                  <button type="button" disabled={busy || !signatureOk} onClick={() => record('DISPENSED')} title={signatureOk ? '' : 'The signature must be valid first'} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} All given to patient
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Labels */}
        <div className="pharmacy-pane rounded-2xl border border-border/80 bg-card p-3 flex flex-col gap-3">
          <SectionTitle>Dose labels</SectionTitle>
          {!selected ? <p className="text-xs text-muted-foreground -mt-2">Select a prescription.</p> : (
            <>
              <select value={labelLang} onChange={e => setLabelLang(e.target.value as RxLang)} aria-label="Label language" className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm -mt-1">
                {LABEL_LANGS.map(l => <option key={l} value={l}>{LANGUAGE_NATIVE_NAME[l]}{selected.language === l ? ' (patient\'s language)' : ''}</option>)}
              </select>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div ref={labelRef} style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ border: '1px solid #94a3b8', borderRadius: 6, padding: 8, marginBottom: 8, pageBreakInside: 'avoid', width: '100%', maxWidth: 320 }}>
                      <div style={{ fontSize: 9, color: '#475569' }}>{HOSPITAL.name} · {selected.prescriptionToken}</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{it.name || '—'}</div>
                      <div style={{ fontSize: 11 }}>{selected.patientName} · {new Date(selected.prescribedAt).toLocaleDateString('en-IN')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{it.instr || it.detail}</div>
                      {!it.instr && labelLang !== 'en' && <div style={{ fontSize: 9, color: '#b45309' }}>Instruction not translatable automatically — explain to the patient.</div>}
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" disabled={!items.length} onClick={() => { sovereignSound('shutter'); printElement(labelRef.current, `Labels — ${selected.patientName}`); }} className="w-full h-10 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Printer size={14} /> Print {items.length} label{items.length === 1 ? '' : 's'}
              </button>
              <p className="text-[10.5px] text-muted-foreground flex gap-1"><Sparkles size={11} className="shrink-0 mt-0.5" /> Labels are generated from the doctor's exact frequency and duration. Check each one against the prescription.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
