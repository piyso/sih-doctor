import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, Building2, Loader2, X, ShieldCheck, AlertCircle, CheckCircle2, Info, WifiOff, RefreshCw } from 'lucide-react';
import { useAppMode, switchAppMode, refreshRuntimeMode, returnToServer, DemoModeSwitchError, AppMode, ModeSnapshot, SwitchResult } from '../../services/runtimeMode';

/**
 * Mock / Real: the one switch of a demonstration deployment.
 *   <DemoModeBadge />  two-position switch for top bars — one click, every screen follows
 *   <DemoModePanel />  the same switch with what each mode means (dialog, Administration → System)
 *   <ModeBanner />     says so when the server is not answering, or when the offline sandbox is on
 */

const MOCK_POINTS = [
  'Ten sample patients wait in every queue (triage, pregnancy, emergencies).',
  'The kiosk offers sample profiles and a demo OTP.',
  'Keeps working if the server cannot be reached: a built-in offline sandbox takes over.'
];
const REAL_POINTS = [
  'No sample patients anywhere: queues, board, pharmacy and reports show only real check-ins.',
  'No demo OTP, no sample profiles, no stand-in data of any kind.',
  'Everything comes from the hospital server. If it does not answer, the screen says so.'
];

/** One sentence for what is on screen right now. */
function describe(s: ModeSnapshot): string {
  if (s.source === 'sandbox') return 'Mock mode · offline sandbox in this browser (the hospital server is not answering)';
  if (s.source === 'server') return s.mode === 'mock' ? 'Mock mode · sample patients from the hospital server' : 'Real mode · live hospital server, no mock data';
  if (s.reachable === null) return 'Connecting to the hospital server…';
  return s.mode === 'real' ? 'Real mode · waiting for the hospital server (no mock data is shown)' : 'Connecting to the hospital server…';
}

function outcome(r: SwitchResult): string {
  if (r.scope === 'server') {
    return r.mode === 'mock'
      ? `Mock mode is on${r.restored ? ` — ${r.restored} sample patients are in the queue` : ''}. Every screen follows.`
      : `Real mode is on${r.parked ? ` — ${r.parked} sample visits are hidden` : ''}. Only real check-ins are shown, on every screen.`;
  }
  return r.mode === 'mock'
    ? 'Mock mode is on in this browser (offline sandbox): the hospital server is not answering.'
    : 'Real mode is on. The hospital server is not answering yet; no mock data is shown meanwhile.';
}

/** Shared switching logic: busy state, result message, and the rare case that needs an administrator. */
function useModeSwitch() {
  const snap = useAppMode();
  const [busy, setBusy] = useState<AppMode | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [needsApproval, setNeedsApproval] = useState<AppMode | null>(null);

  const go = async (target: AppMode, approver?: { username: string; pin: string }) => {
    if (busy) return;
    if (target === snap.mode && !approver) return;
    setBusy(target);
    setMessage(null);
    try {
      const r = await switchAppMode(target, approver);
      setNeedsApproval(null);
      setMessage({ tone: 'ok', text: outcome(r) });
    } catch (err: any) {
      if (err instanceof DemoModeSwitchError && err.code === 'ADMIN_APPROVAL_REQUIRED') setNeedsApproval(target);
      setMessage({ tone: 'error', text: err?.message || 'Could not switch.' });
    } finally {
      setBusy(null);
    }
  };
  return { snap, busy, message, setMessage, needsApproval, go };
}

const segment = (active: boolean, tone: 'amber' | 'emerald') =>
  `inline-flex items-center justify-center gap-1.5 font-bold transition-colors disabled:cursor-default ${active
    ? tone === 'amber' ? 'bg-amber-500 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
    : 'text-muted-foreground hover:text-foreground hover:bg-background/70'}`;

/** The two positions. `size` only changes dimensions. */
const Segments: React.FC<{ snap: ModeSnapshot; busy: AppMode | null; onPick: (m: AppMode) => void; size: 'sm' | 'lg' }> = ({ snap, busy, onPick, size }) => {
  const dims = size === 'sm' ? 'h-7 px-2.5 rounded-full text-[11px]' : 'h-11 px-5 rounded-xl text-sm flex-1';
  const icon = size === 'sm' ? 12 : 16;
  return (
    <div role="radiogroup" aria-label="Mock or Real mode" className={`inline-flex items-center gap-0.5 p-0.5 border border-border/80 bg-muted/60 ${size === 'sm' ? 'rounded-full' : 'rounded-2xl w-full'}`}>
      <button type="button" role="radio" aria-checked={snap.mode === 'mock'} disabled={!!busy} onClick={() => onPick('mock')}
        title="Mock mode: sample patients and demo shortcuts" className={`${dims} ${segment(snap.mode === 'mock', 'amber')}`}>
        {busy === 'mock' ? <Loader2 size={icon} className="animate-spin" /> : snap.source === 'sandbox' ? <WifiOff size={icon} /> : <FlaskConical size={icon} />}
        Mock
      </button>
      <button type="button" role="radio" aria-checked={snap.mode === 'real'} disabled={!!busy} onClick={() => onPick('real')}
        title="Real mode: live hospital server, no mock data" className={`${dims} ${segment(snap.mode === 'real', 'emerald')}`}>
        {busy === 'real' ? <Loader2 size={icon} className="animate-spin" /> : <Building2 size={icon} />}
        Real
      </button>
    </div>
  );
};

/** Only where the demo administrator's approval is not accepted (its PIN was changed on that server). */
const ApprovalForm: React.FC<{ target: AppMode; busy: boolean; onApprove: (a: { username: string; pin: string }) => void }> = ({ target, busy, onApprove }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onApprove({ username: username.trim(), pin }); }} className="rounded-xl border border-border/80 bg-muted/30 p-3">
      <div className="text-xs font-semibold text-foreground mb-2">This server asks an administrator to approve switching to {target === 'mock' ? 'Mock' : 'Real'} mode</div>
      <div className="flex gap-2 flex-wrap">
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin username" autoComplete="off" aria-label="Administrator username"
          className="flex-1 min-w-[130px] h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <input value={pin} onChange={e => setPin(e.target.value.slice(0, 32))} type="password" inputMode="numeric" placeholder="PIN" autoComplete="off" aria-label="Administrator PIN"
          className="w-28 h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary" />
        <button type="submit" disabled={busy || !username.trim() || pin.length < 4} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">Approve</button>
      </div>
    </form>
  );
};

const ModeColumn: React.FC<{ active: boolean; title: string; icon: React.ReactNode; points: string[]; tone: 'amber' | 'emerald' }> = ({ active, title, icon, points, tone }) => (
  <div className={`rounded-xl border p-3 ${active ? (tone === 'amber' ? 'border-amber-500/60 bg-amber-500/5' : 'border-emerald-500/60 bg-emerald-500/5') : 'border-border/70 bg-background'}`}>
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">{icon}{title}</span>
      {active && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tone === 'amber' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'}`}>Now</span>}
    </div>
    <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
      {points.map(p => <li key={p}>{p}</li>)}
    </ul>
  </div>
);

/** The switch with what each mode means: the dialog behind the badge, and Administration → System. */
export const DemoModePanel: React.FC<{ compact?: boolean; onSwitched?: (on: boolean) => void }> = ({ compact, onSwitched }) => {
  const { snap, busy, message, needsApproval, go } = useModeSwitch();
  const pick = (m: AppMode, approver?: { username: string; pin: string }) => go(m, approver).then(() => onSwitched?.(m === 'mock'));

  return (
    <div className="space-y-3">
      {snap.canSwitch ? (
        <Segments snap={snap} busy={busy} onPick={m => pick(m)} size="lg" />
      ) : (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5"><ShieldCheck size={14} className="shrink-0 mt-px" /> This is a hospital installation: its mode is fixed by the server settings and it has no Mock / Real switch.</p>
      )}

      <div className="text-xs font-semibold text-foreground flex items-center gap-2 flex-wrap" role="status">
        <span className={`h-2 w-2 rounded-full shrink-0 ${snap.source === 'none' ? 'bg-muted-foreground animate-pulse' : snap.mode === 'mock' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <span>{describe(snap)}</span>
        {snap.serverBack && (
          <button type="button" onClick={() => returnToServer()} className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-bold">The server is back — use it</button>
        )}
      </div>

      {needsApproval && <ApprovalForm target={needsApproval} busy={!!busy} onApprove={a => pick(needsApproval, a)} />}
      {message && (
        <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-start gap-2 ${message.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200' : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-200'}`} role={message.tone === 'ok' ? 'status' : 'alert'}>
          {message.tone === 'ok' ? <CheckCircle2 size={14} className="shrink-0 mt-px" /> : <AlertCircle size={14} className="shrink-0 mt-px" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={`grid gap-2.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <ModeColumn active={snap.mode === 'mock'} title="Mock mode" icon={<FlaskConical size={15} className="text-amber-600" />} points={MOCK_POINTS} tone="amber" />
        <ModeColumn active={snap.mode === 'real'} title="Real mode" icon={<Building2 size={15} className="text-emerald-600" />} points={REAL_POINTS} tone="emerald" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Staff sign in the same way in both modes, nobody is signed out, and nothing is deleted when you switch.
        {snap.server?.changedAt && ` Last switched by ${snap.server.changedBy || 'a staff member'} · ${new Date(snap.server.changedAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
      </p>
    </div>
  );
};

/**
 * The switch for top bars. One click on the other position switches at once; the "i" opens the
 * explanation. Renders nothing on a hospital installation running without demo data.
 */
export const DemoModeBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { snap, busy, message, setMessage, needsApproval, go } = useModeSwitch();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); infoRef.current?.focus(); } };
    window.addEventListener('keydown', onKey, true);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  // The result of a click shows for a few seconds under the switch; a needed approval opens the dialog.
  useEffect(() => {
    if (!message || open) return;
    const t = setTimeout(() => setMessage(null), message.tone === 'ok' ? 4500 : 8000);
    return () => clearTimeout(t);
  }, [message, open, setMessage]);
  useEffect(() => { if (needsApproval) setOpen(true); }, [needsApproval]);

  if (!snap.canSwitch) {
    // Fixed mode: a server running permanently with demo data says so; a hospital shows nothing.
    if (snap.source === 'server' && snap.mode === 'mock') {
      return <span className={`h-8 px-2.5 rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0 ${className}`} title="This server runs with sample data"><FlaskConical size={12} /> Demo data</span>;
    }
    return null;
  }

  return (
    <div className={`relative inline-flex items-center gap-1 shrink-0 ${className}`}>
      <Segments snap={snap} busy={busy} onPick={m => go(m)} size="sm" />
      <button ref={infoRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="What Mock and Real mode mean" title={describe(snap)}
        className="h-7 w-7 rounded-full hover:bg-muted inline-flex items-center justify-center text-muted-foreground">
        <Info size={14} />
      </button>

      {message && !open && (
        <div className={`absolute right-0 top-full mt-2 z-[70] w-72 max-w-[calc(100vw-24px)] p-2.5 rounded-xl border bg-card shadow-xl text-xs font-semibold flex items-start gap-2 ${message.tone === 'ok' ? 'border-emerald-500/50 text-foreground' : 'border-rose-500/50 text-rose-700 dark:text-rose-200'}`} role={message.tone === 'ok' ? 'status' : 'alert'}>
          {message.tone === 'ok' ? <CheckCircle2 size={14} className="shrink-0 mt-px text-emerald-600" /> : <AlertCircle size={14} className="shrink-0 mt-px" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Portal: the top bar's backdrop blur would otherwise trap a fixed overlay inside the bar. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="demo-mode-title" className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl p-5 outline-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 id="demo-mode-title" className="text-base font-extrabold text-foreground">Mock or Real</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Show the system with sample patients, or exactly as it runs with real ones. One click; every screen follows within seconds.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center text-muted-foreground" aria-label="Close"><X size={16} /></button>
            </div>
            <DemoModePanel />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/**
 * A slim notice at the bottom of every screen when what is shown depends on the connection:
 * the offline sandbox is on, Real mode is waiting for the server, or the server is still connecting.
 */
export const ModeBanner: React.FC = () => {
  const snap = useAppMode();
  const [switching, setSwitching] = useState(false);
  if (snap.reachable !== false && !snap.serverBack) return null;

  const shell = 'no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-[1300] max-w-[calc(100vw-24px)] rounded-xl border bg-card shadow-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs flex-wrap sm:flex-nowrap';
  const btn = 'h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted font-semibold text-xs inline-flex items-center gap-1.5 shrink-0';

  if (snap.serverBack) {
    return (
      <div className={`${shell} border-emerald-500/50`} role="status">
        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
        <span className="text-foreground"><strong>The hospital server is back.</strong><span className="text-muted-foreground"> You are still in the offline sandbox.</span></span>
        <button type="button" onClick={() => returnToServer()} className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0">Use the server</button>
      </div>
    );
  }
  if (snap.source === 'sandbox') {
    return (
      <div className={`${shell} border-amber-500/50`} role="status">
        <WifiOff size={15} className="text-amber-600 shrink-0" />
        <span className="text-foreground"><strong>Offline sandbox.</strong><span className="text-muted-foreground"> The hospital server is not answering, so Mock mode shows built-in sample patients. Nothing is saved.</span></span>
        <button type="button" onClick={() => refreshRuntimeMode()} className={btn}><RefreshCw size={12} /> Retry</button>
      </div>
    );
  }
  if (snap.mode === 'real') {
    return (
      <div className={`${shell} border-rose-500/50`} role="alert">
        <Loader2 size={15} className="animate-spin text-rose-600 shrink-0" />
        <span className="text-foreground"><strong>Real mode needs the hospital server, which is not answering.</strong><span className="text-muted-foreground"> No mock data is shown. Retrying automatically.</span></span>
        <button type="button" onClick={() => refreshRuntimeMode()} className={btn}><RefreshCw size={12} /> Retry</button>
        {snap.canSwitch && (
          <button type="button" disabled={switching} onClick={() => { setSwitching(true); switchAppMode('mock').finally(() => setSwitching(false)); }} className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 disabled:opacity-60">Switch to Mock</button>
        )}
      </div>
    );
  }
  return (
    <div className={`${shell} border-amber-500/50`} role="status">
      <Loader2 size={15} className="animate-spin text-amber-600 shrink-0" />
      <span className="text-foreground"><strong>Connecting to the hospital server…</strong><span className="text-muted-foreground"> Retrying automatically.</span></span>
      <button type="button" onClick={() => refreshRuntimeMode()} className={btn}><RefreshCw size={12} /> Retry</button>
    </div>
  );
};
