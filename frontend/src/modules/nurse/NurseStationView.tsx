import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Siren, CheckCircle2, BellRing, HeartPulse, Save, Loader2, WifiOff, Megaphone, AlertOctagon } from 'lucide-react';
import { api } from '../../services/api';
import { PatientQueueItem } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { parseBp, parseNumber, normaliseTempF, bpStatus, pulseStatus, spo2Status, tempStatus, STATUS_TONE, summariseVitals, VitalStatus, isCritical, isAbnormal } from '../../utils/vitals';

const STATUS_WORD: Record<VitalStatus, string> = {
  empty: '', invalid: 'check', normal: 'normal', low: 'low', veryLow: 'very low', high: 'high', veryHigh: 'very high', fever: 'fever'
};

const PRIORITY_RANK: Record<string, number> = { EMERGENCY_RED_FLAG: 0, HIGH_PRIORITY: 1, ROUTINE: 2 };

const waitedFor = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

/** One reading, coloured only when it is out of range. */
const Reading: React.FC<{ label: string; value?: string | number | null; status: VitalStatus }> = ({ label, value, status }) => (
  <span className={`font-mono ${isCritical(status) ? 'text-rose-600 font-bold' : isAbnormal(status) ? 'text-amber-600 font-semibold' : value ? 'text-foreground' : 'text-muted-foreground'}`}>
    <span className="text-muted-foreground font-sans font-normal">{label} </span>{value || '—'}
  </span>
);

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};

/** Inline vitals form for one patient, with instant interpretation. */
const VitalsRow: React.FC<{ item: PatientQueueItem; onSaved: () => void }> = ({ item, onSaved }) => {
  const v: any = item.vitals || {};
  const [bp, setBp] = useState(v.bp || '');
  const [pulse, setPulse] = useState(v.pulse ? String(v.pulse) : '');
  const [spo2, setSpo2] = useState(v.spo2 ? String(v.spo2).replace('%', '') : '');
  const [temp, setTemp] = useState(v.temp ? String(v.temp).replace(/°?F/i, '') : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { sys, dia } = parseBp(bp);
  const st = { bp: bp ? bpStatus(sys, dia) : 'empty', pulse: pulseStatus(parseNumber(pulse)), spo2: spo2Status(parseNumber(spo2)), temp: tempStatus(normaliseTempF(temp)) } as Record<string, VitalStatus>;
  const invalid = Object.values(st).includes('invalid');

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const ok = await api.updateSessionVitals(item.sessionId, { bp: bp.trim() || null, pulse: pulse.trim() || null, spo2: spo2.trim() || null, temp: temp.trim() || null });
    setBusy(false);
    setMsg(ok ? 'Saved' : 'Not saved — try again');
    if (ok) onSaved();
  };

  const box = (label: string, value: string, set: (s: string) => void, status: VitalStatus, placeholder: string, width = 'w-24') => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <input value={value} onChange={e => set(e.target.value)} inputMode="decimal" placeholder={placeholder} className={`${width} h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary`} />
      <span className={`h-4 text-[10px] font-bold px-1 rounded border w-fit ${status === 'empty' ? 'border-transparent' : STATUS_TONE[status]}`}>{STATUS_WORD[status]}</span>
    </label>
  );

  return (
    <div className="flex items-end gap-2 flex-wrap">
      {box('BP (mmHg)', bp, setBp, st.bp, '120/80', 'w-28')}
      {box('Pulse /min', pulse, setPulse, st.pulse, '72')}
      {box('SpO₂ %', spo2, setSpo2, st.spo2, '98')}
      {box('Temp °F/°C', temp, setTemp, st.temp, '98.6')}
      <div className="flex flex-col items-start gap-0.5 pb-4">
        <button type="button" onClick={save} disabled={busy || invalid} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>
      <span className="pb-5 text-[11px] font-semibold text-muted-foreground min-w-[90px]">{msg || ''}</span>
    </div>
  );
};

export const NurseStationView: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [queue, setQueue] = useState<PatientQueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [live, setLive] = useState(false);
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [openVitals, setOpenVitals] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ id: string; note: string } | null>(null);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, q] = await Promise.all([api.getAlerts(), api.getQueueStatus()]);
      setAlerts(a);
      setQueue(q.items);
      setOnline(q.online);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const stop = api.subscribeStaffEvents(e => {
      if (e.type === 'stream.open') { setLive(true); return; }
      if (e.type === 'stream.closed') { setLive(false); return; }
      setLive(true);
      if (e.type === 'sos.raised') {
        try { sovereignSound.playEmergencyCodeRed(); } catch {}
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('SOS at kiosk', { body: e.message, requireInteraction: true }); } catch {}
        }
      }
      load();
    });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    return () => { clearInterval(poll); stop(); };
  }, [load]);

  // Keep sounding the alarm every 8 seconds while any SOS is unacknowledged.
  const unacked = alerts.filter(a => !a.acknowledgedAt && !a.resolvedAt);
  useEffect(() => {
    if (alarmRef.current) clearInterval(alarmRef.current);
    if (unacked.length) {
      alarmRef.current = setInterval(() => { try { sovereignSound.playEmergencyCodeRed(); } catch {} }, 8000);
    }
    return () => { if (alarmRef.current) clearInterval(alarmRef.current); };
  }, [unacked.length]);

  const ack = async (id: string) => {
    setBusyAlert(id);
    try { await api.acknowledgeAlert(id); await load(); } finally { setBusyAlert(null); }
  };
  const resolve = async (id: string, note: string) => {
    setBusyAlert(id);
    try { await api.resolveAlert(id, note); setResolving(null); await load(); } finally { setBusyAlert(null); }
  };

  const waiting = queue
    .filter(q => q.status === 'PENDING_DOCTOR' || q.status === 'DIVERTED_EMERGENCY')
    .sort((a, b) => (PRIORITY_RANK[a.triagePriority] ?? 3) - (PRIORITY_RANK[b.triagePriority] ?? 3) || new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());
  const needVitals = waiting.filter(q => !summariseVitals(q.vitals).anyRecorded || (q.vitals as any)?.source !== 'clinician');
  const [listTab, setListTab] = useState<'need' | 'all'>('need');
  const list = listTab === 'need' ? needVitals : waiting;
  const openAlerts = alerts.filter(a => !a.resolvedAt);
  const resolvedAlerts = alerts.filter(a => a.resolvedAt);

  const alertCard = (a: any) => {
    const open = !a.resolvedAt;
    const isUnacked = open && !a.acknowledgedAt;
    return (
      <div key={a.id} className={`p-3.5 rounded-xl border-2 ${isUnacked ? 'border-rose-600 bg-rose-500/10 animate-pulse' : open ? 'border-amber-500/60 bg-amber-500/10' : 'border-border/60 bg-card'}`} role={isUnacked ? 'alert' : undefined}>
        <div className="flex items-start gap-2.5 min-w-0">
          <Siren size={20} className={`shrink-0 ${isUnacked ? 'text-rose-600' : open ? 'text-amber-600' : 'text-muted-foreground'}`} />
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-foreground">{a.message}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {a.location || 'Kiosk'}{a.tokenNo ? ` · token ${a.tokenNo}` : ''}{a.patientName ? ` · ${a.patientName}` : ''} · {ago(a.createdAt)}
            </div>
            {a.acknowledgedAt && <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 mt-0.5">Acknowledged by {a.acknowledgedBy} ({ago(a.acknowledgedAt)})</div>}
            {a.resolvedAt && <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">Resolved by {a.resolvedBy}</div>}
          </div>
        </div>
        {open && resolving?.id === a.id ? (
          <div className="flex gap-2 items-center mt-3">
            <input autoFocus value={resolving?.note || ''} onChange={e => setResolving({ id: a.id, note: e.target.value })} placeholder='What happened? e.g. "Taken to ER, stable"' className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            <button type="button" onClick={() => resolve(a.id, resolving?.note || '')} disabled={busyAlert === a.id} className="h-10 px-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold">Save</button>
            <button type="button" onClick={() => setResolving(null)} className="h-10 px-3 rounded-xl border border-border text-sm font-semibold">Cancel</button>
          </div>
        ) : open && (
          <div className="flex gap-2 mt-3">
            {isUnacked && (
              <button type="button" onClick={() => ack(a.id)} disabled={busyAlert === a.id} className="flex-1 h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2">
                <BellRing size={16} /> I'm going
              </button>
            )}
            <button type="button" onClick={() => setResolving({ id: a.id, note: '' })} disabled={busyAlert === a.id} className="h-11 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-bold">Resolved</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4 space-y-3">
      {/* Summary strip: what needs a nurse now. The screen name is in the top bar. */}
      <div className="rounded-2xl border border-border/80 bg-card px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span><strong className={`text-base font-extrabold tabular-nums ${openAlerts.length ? 'text-rose-600' : 'text-foreground'}`}>{openAlerts.length}</strong> open SOS</span>
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{needVitals.length}</strong> need measured vitals</span>
          <span><strong className="text-base font-extrabold tabular-nums text-foreground">{waiting.length}</strong> waiting</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          {!online && <span className="px-2 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 inline-flex items-center gap-1"><WifiOff size={12} /> Server unreachable</span>}
          <span className={`px-2 py-1 rounded-full ${live ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{live ? '● Live alerts connected' : 'Connecting to live alerts…'}</span>
        </div>
      </div>

      <div className="nurse-grid">
        {/* SOS alerts: always beside the worklist, never scrolled away. */}
        <section aria-label="SOS alerts" className="nurse-sos rounded-2xl border border-border/80 bg-card p-3.5 flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Siren size={13} /> SOS alerts</h2>
          {openAlerts.length === 0 ? (
            <div className="p-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> No SOS alerts.</div>
          ) : openAlerts.map(alertCard)}
          {resolvedAlerts.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground font-semibold select-none">Resolved ({resolvedAlerts.length})</summary>
              <div className="mt-2 space-y-2 opacity-80">{resolvedAlerts.map(alertCard)}</div>
            </details>
          )}
          <p className="mt-auto pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex gap-1.5"><Megaphone size={12} className="shrink-0 mt-px" /> Keep this screen open with sound on. Allow browser notifications so alerts also appear when another window is in front.</p>
        </section>

        {/* Vitals worklist, most urgent first. */}
        <section aria-label="Vitals worklist" className="rounded-2xl border border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><HeartPulse size={13} className="text-rose-500" /> Measure vitals</h2>
            <div className="flex gap-0.5 p-0.5 rounded-xl bg-muted/60 border border-border/70" role="tablist">
              {([{ id: 'need', label: 'Need measuring', n: needVitals.length }, { id: 'all', label: 'All waiting', n: waiting.length }] as const).map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={listTab === t.id} onClick={() => setListTab(t.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${listTab === t.id ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label} <span className="font-mono">{t.n}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">Kiosk vitals are patient-reported. Measured values replace them and are marked with your name.</p>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{listTab === 'need' ? 'Every waiting patient has measured vitals.' : 'No patients waiting.'}</p>
          ) : (
            <div className="space-y-1.5">
              {list.map(q => {
                const v: any = q.vitals || {};
                const sum = summariseVitals(q.vitals);
                const measured = v.source === 'clinician';
                const isEmergency = q.triagePriority === 'EMERGENCY_RED_FLAG';
                const isHigh = q.triagePriority === 'HIGH_PRIORITY';
                const isOpen = openVitals === q.sessionId;
                return (
                  <div key={q.sessionId} className={`rounded-xl border border-l-4 px-3 py-2.5 ${isEmergency ? 'border-l-rose-500' : isHigh ? 'border-l-amber-500' : 'border-l-border'} ${isOpen ? 'border-primary/50 bg-primary/5' : 'border-border/70'}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground flex items-baseline gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-muted-foreground">{q.tokenNo || '—'}</span>
                          <span>{q.patientName}</span>
                          <span className="text-xs font-medium text-muted-foreground">{q.age} y · {q.gender === 'FEMALE' ? 'F' : q.gender === 'MALE' ? 'M' : 'O'}{q.room ? ` · Room ${q.room}` : ''} · waiting {waitedFor(q.registeredAt)}</span>
                          {isEmergency && <span className="px-1.5 py-px rounded bg-rose-600 text-white text-[9.5px] font-bold uppercase">Emergency</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{q.primaryComplaint || 'Complaint not recorded'}</div>
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px]">
                          <Reading label="BP" value={v.bp} status={sum.statuses.bp} />
                          <Reading label="P" value={v.pulse} status={sum.statuses.pulse} />
                          <Reading label="SpO₂" value={v.spo2} status={sum.statuses.spo2} />
                          <Reading label="T" value={v.temp} status={sum.statuses.temp} />
                          <span className={`text-[10.5px] ${measured ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-muted-foreground'}`}>
                            {sum.anyRecorded ? (measured ? `measured${v.recordedBy ? ` by ${v.recordedBy}` : ''}` : 'patient-reported') : 'no vitals yet'}
                          </span>
                          {sum.anyCritical && <span className="text-rose-600 font-bold inline-flex items-center gap-1"><AlertOctagon size={11} /> critical value</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => setOpenVitals(isOpen ? null : q.sessionId)} className={`h-9 px-3 rounded-lg text-xs font-bold shrink-0 ${isOpen ? 'border border-border bg-background hover:bg-muted' : measured ? 'border border-border bg-background hover:bg-muted' : 'bg-primary text-primary-foreground'}`}>
                        {isOpen ? 'Close' : measured ? 'Update vitals' : 'Enter vitals'}
                      </button>
                    </div>
                    {isOpen && <div className="mt-2.5 pt-2.5 border-t border-border/60"><VitalsRow item={q} onSaved={load} /></div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
