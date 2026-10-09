import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, Building2, Loader2, X, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRuntimeMode, switchDemoMode, DemoModeSwitchError } from '../../services/runtimeMode';
import { useStaffUser } from '../auth/StaffGate';
import { session } from '../../services/session';

/** What each mode means, in the words a presenter would use in front of an audience. */
const ON_POINTS = [
  'Ten sample patients wait in the queue (triage, pregnancy, emergencies).',
  'Demo staff accounts are listed on the sign-in screen.',
  'The kiosk offers sample profiles and a demo OTP; kiosks need no enrolment.'
];
const OFF_POINTS = [
  'Sample patients leave every queue, board and report (nothing is deleted).',
  'Demo accounts cannot sign in; staff use their own accounts.',
  'ABHA needs real verification and kiosks must be enrolled by an administrator.'
];

const ModeColumn: React.FC<{ active: boolean; title: string; icon: React.ReactNode; points: string[]; tone: 'amber' | 'emerald' }> = ({ active, title, icon, points, tone }) => (
  <div className={`rounded-xl border p-3 ${active ? (tone === 'amber' ? 'border-amber-500/60 bg-amber-500/5' : 'border-emerald-500/60 bg-emerald-500/5') : 'border-border/70 bg-background opacity-80'}`}>
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">{icon}{title}</span>
      {active && <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tone === 'amber' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'}`}>Current</span>}
    </div>
    <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
      {points.map(p => <li key={p}>{p}</li>)}
    </ul>
  </div>
);

/**
 * The switch itself, used inside the dialog and on Administration → System. A signed-in
 * administrator switches directly; anyone else needs an administrator's username and PIN.
 */
export const DemoModePanel: React.FC<{ compact?: boolean; onSwitched?: (on: boolean) => void }> = ({ compact, onSwitched }) => {
  const mode = useRuntimeMode();
  const user = useStaffUser();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!mode) return <div className="py-6 flex items-center justify-center text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin mr-2" /> Checking the server…</div>;

  const on = mode.demoMode;
  const isAdmin = user?.role === 'admin' && !user.mustChangePin;
  const target = !on;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await switchDemoMode(target, isAdmin ? undefined : { username: username.trim(), pin });
      setPin('');
      setDone(target
        ? `Demo mode is on.${r.restored ? ` ${r.restored} sample patients are back in the queue.` : ''}`
        : `Live mode is on.${r.parked ? ` ${r.parked} sample visits were taken out of the queue.` : ''} Demo accounts can no longer sign in.`);
      // A presenter signed in with a demo account is signed out by the server when demo mode ends.
      if (!target && user?.isDemo) {
        session.clearStaff();
        window.dispatchEvent(new CustomEvent('hos:auth-required'));
      }
      onSwitched?.(target);
    } catch (err: any) {
      setError({ code: err instanceof DemoModeSwitchError ? err.code : 'ERROR', text: err?.message || 'Could not switch.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={`grid gap-2.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <ModeColumn active={on} title="Demo mode" icon={<FlaskConical size={15} className="text-amber-600" />} points={ON_POINTS} tone="amber" />
        <ModeColumn active={!on} title="Live mode" icon={<Building2 size={15} className="text-emerald-600" />} points={OFF_POINTS} tone="emerald" />
      </div>

      {!mode.demoToggle ? (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5"><ShieldCheck size={14} className="shrink-0 mt-px" /> This server's mode is fixed by its operator (ALLOW_DEMO_DATA). The switch is only enabled on demonstration servers (DEMO_TOGGLE).</p>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          {!isAdmin && (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
              <div className="text-xs font-semibold text-foreground mb-2">Administrator approval{user ? ` — you stay signed in as ${user.displayName}` : ''}</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin username" autoComplete="off" aria-label="Administrator username"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input value={pin} onChange={e => setPin(e.target.value.slice(0, 32))} type="password" inputMode="numeric" placeholder="PIN" autoComplete="off" aria-label="Administrator PIN"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-200 flex items-start gap-2" role="alert">
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>{error.text}{error.code === 'NO_REAL_ADMIN' && <> <a href="?mode=admin&tab=staff" className="underline underline-offset-2">Open Staff</a></>}</span>
            </div>
          )}
          {done && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-start gap-2" role="status">
              <CheckCircle2 size={14} className="shrink-0 mt-px" /> <span>{done}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{mode.changedAt ? `Last switched by ${mode.changedBy || 'an administrator'} · ${new Date(mode.changedAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Set by the server configuration'}</span>
            <button type="submit" disabled={busy || (!isAdmin && (!username.trim() || pin.length < 4))}
              className={`h-10 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 ${target ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : target ? <FlaskConical size={15} /> : <Building2 size={15} />}
              {target ? 'Switch to demo mode' : 'Switch to live mode'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

/**
 * Small badge for top bars: says which mode the server is in and opens the switch. Hidden on a
 * hospital deployment (live mode, switch disabled), where there is nothing to show.
 */
export const DemoModeBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const mode = useRuntimeMode();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!mode || (!mode.demoMode && !mode.demoToggle)) return null;
  const on = mode.demoMode;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        title={on ? 'Demo mode: sample patients and demo accounts. Click to switch.' : 'Live mode: no demo data. Click to switch.'}
        className={`h-8 px-2.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors ${on
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20'
          : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20'} ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        {on ? 'Demo mode' : 'Live mode'}
      </button>
      {/* Portal: the top bar's backdrop blur would otherwise trap a fixed overlay inside the bar. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="demo-mode-title" className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl p-5 outline-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 id="demo-mode-title" className="text-base font-extrabold text-foreground">Demonstration mode</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Show the system with sample data, or exactly as a hospital would run it. Every screen follows within seconds.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center text-muted-foreground" aria-label="Close"><X size={16} /></button>
            </div>
            <DemoModePanel />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
