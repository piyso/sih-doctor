import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Lock, LogIn, LogOut, KeyRound, ShieldCheck, UserRound, Loader2, AlertCircle, Delete, Server, RefreshCw, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import { api, BASE_URL, getCustomApiUrl, setCustomApiUrl } from '../../services/api';
import { session, StaffRole, StaffUser, ROLE_LABEL } from '../../services/session';
import { demoAccount } from '../../services/demoAccounts';
import { useAppMode } from '../../services/runtimeMode';

/** Current staff user, re-rendering when they sign in or out. */
export function useStaffUser(): StaffUser | null {
  return useSyncExternalStore(session.subscribe, () => session.user, () => null);
}

interface StaffGateProps {
  /** Roles allowed into this terminal. */
  roles: StaffRole[];
  /** Shown on the sign-in card, e.g. "Doctor desk". */
  terminalName: string;
  children: React.ReactNode;
}

const IDLE_MINUTES = 30;

type AuthStatus = Awaited<ReturnType<typeof api.getAuthStatus>>;

/**
 * What the sign-in screen needs from the server, retried until it answers (a sleeping cloud server
 * can take a while). In the offline sandbox the stand-in accounts are returned at once.
 */
function useAuthStatus(): { status: AuthStatus | null; waiting: boolean; reload: () => void } {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryOnce = () => {
      api.getAuthStatus()
        .then(st => { if (alive) { setStatus(st); setWaiting(false); } })
        .catch(() => {
          if (!alive) return;
          setWaiting(true);
          timer = setTimeout(tryOnce, 4000);
        });
    };
    tryOnce();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [nonce]);
  return { status, waiting, reload: () => setNonce(n => n + 1) };
}

interface QuickAccount { username: string; displayName: string; role: StaffRole }

/** The one-tap accounts allowed on a screen, the screen's own role first. */
const quickAccountsFor = (status: AuthStatus | null, roles: StaffRole[]): QuickAccount[] =>
  ((status?.demoAccounts || []).filter(a => roles.includes(a.role as StaffRole)) as QuickAccount[])
    .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role));

const initialsOf = (name: string) => name.replace(/^(Dr|Sr|Vaidya)\.?\s+/i, '').replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/**
 * One-tap sign-in for the demo staff accounts of a demonstration server (or the stand-in accounts
 * of the offline sandbox). A hospital installation has no demo accounts, so this renders nothing there.
 */
const QuickAccounts: React.FC<{ accounts: QuickAccount[]; onSignedIn: () => void; onNeedsPin: (username: string, message: string) => void; beforeSignIn?: () => Promise<void> }> = ({ accounts, onSignedIn, onNeedsPin, beforeSignIn }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const signIn = async (a: QuickAccount) => {
    if (busy) return;
    const known = demoAccount(a.username);
    if (!known && !session.isSandbox) { onNeedsPin(a.username, 'Enter the PIN for this account.'); return; }
    setBusy(a.username);
    try {
      await beforeSignIn?.();
      await api.login(a.username, known?.pin || '');
      onSignedIn();
    } catch (e: any) {
      onNeedsPin(a.username, e?.name === 'AbortError' ? 'The hospital server did not respond. Try again.' : e?.message || 'Sign-in failed.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      {accounts.map(a => (
        <button key={a.username} type="button" onClick={() => signIn(a)} disabled={!!busy} data-testid={`quick-signin-${a.username}`}
          className="w-full h-12 px-3 rounded-xl border border-border bg-background hover:bg-muted hover:border-primary/50 text-left flex items-center gap-3 transition-colors disabled:opacity-60">
          <span className="h-8 w-8 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">
            {busy === a.username ? <Loader2 size={14} className="animate-spin" /> : initialsOf(a.displayName) || <UserRound size={14} />}
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-foreground truncate">{a.displayName.replace(/\s*\(.*?\)\s*$/, '')}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">{ROLE_LABEL[a.role]}</span>
          <LogIn size={14} className="text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
};

/**
 * Puts a staff sign-in in front of a terminal: one-tap demo accounts on a demonstration server,
 * username + PIN everywhere, forced PIN change on first use, first-run administrator setup, role
 * check, and automatic sign-out after inactivity.
 */
export const StaffGate: React.FC<StaffGateProps> = ({ roles, terminalName, children }) => {
  const user = useStaffUser();
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Validate a remembered session once (the server may have expired it). The offline sandbox has
  // no server to ask; an unreachable server proves nothing, so the session is kept.
  useEffect(() => {
    let alive = true;
    if (session.staffToken && !session.isSandbox) {
      api.me().then(u => {
        if (!alive) return;
        if (!u && !session.isSandbox) session.clearStaff();
      }).catch(() => undefined).finally(() => { if (alive) setChecked(true); });
    } else {
      setChecked(true);
    }
    const onExpired = () => { if (!session.isSandbox) setNotice('Your session ended. Please sign in again.'); };
    window.addEventListener('hos:auth-required', onExpired);
    return () => { alive = false; window.removeEventListener('hos:auth-required', onExpired); };
  }, []);

  // Sign out after inactivity on shared hospital computers.
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!user) return;
    const bump = () => { lastActivity.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_MINUTES * 60000) {
        api.logout();
        setNotice(`Signed out after ${IDLE_MINUTES} minutes without activity.`);
      }
    }, 30000);
    return () => {
      events.forEach(e => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [user]);

  if (!checked) {
    return <div className="flex items-center justify-center py-24 text-sm text-muted-foreground"><Loader2 className="animate-spin mr-2" size={16} /> Checking sign-in…</div>;
  }
  if (!user) return <SignInCard terminalName={terminalName} roles={roles} notice={notice} onDone={() => setNotice(null)} />;
  if (user.mustChangePin) return <ChangePinCard forced />;
  if (!roles.includes(user.role)) return <WrongRoleCard user={user} roles={roles} terminalName={terminalName} />;
  return <>{children}</>;
};

/** Signed in, but this screen is for other roles: say so, and on a demonstration server offer the right account in one tap. */
const WrongRoleCard: React.FC<{ user: StaffUser; roles: StaffRole[]; terminalName: string }> = ({ user, roles, terminalName }) => {
  const { status } = useAuthStatus();
  const [error, setError] = useState<string | null>(null);
  const quick = quickAccountsFor(status, roles);
  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="rounded-3xl border border-border bg-card p-7 text-center shadow-sm">
        <Lock className="mx-auto mb-3 text-amber-600" size={28} />
        <h2 className="text-lg font-bold text-foreground">{terminalName} is not available for your role</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          You are signed in as <strong>{user.displayName}</strong> ({ROLE_LABEL[user.role]}). This screen is for: {roles.map(r => ROLE_LABEL[r]).join(', ')}.
        </p>
        {quick.length > 0 && (
          <div className="mt-5 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Continue as</div>
            <QuickAccounts accounts={quick} onSignedIn={() => setError(null)} onNeedsPin={(_u, m) => setError(m)} beforeSignIn={() => api.logout()} />
            {error && <div className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</div>}
          </div>
        )}
        <button type="button" onClick={() => api.logout()} className="mt-5 h-10 px-5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold inline-flex items-center gap-2">
          <LogOut size={15} /> Sign in as someone else
        </button>
      </div>
    </div>
  );
};

/** Account menu for terminal top bars: who is signed in, change PIN, sign out. */
export const StaffChip: React.FC = () => {
  const user = useStaffUser();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  if (!user) return null;
  const initials = user.displayName.replace(/^(Dr|Sr|Vaidya)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${user.displayName}, ${ROLE_LABEL[user.role]}`}
        className="h-8 pl-1 pr-2.5 rounded-full border border-border/80 bg-background hover:bg-muted inline-flex items-center gap-2 text-[11px] font-semibold text-foreground">
        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold inline-flex items-center justify-center">{initials || <UserRound size={13} />}</span>
        <span className="hidden md:inline max-w-[160px] truncate">{user.displayName}</span>
        <span className="hidden lg:inline text-muted-foreground font-medium">· {ROLE_LABEL[user.role]}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1.5 w-60 rounded-xl border border-border bg-card shadow-xl p-1.5 z-[60]">
          <div className="px-2.5 py-2 border-b border-border/70 mb-1">
            <div className="text-sm font-bold text-foreground truncate">{user.displayName}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {ROLE_LABEL[user.role]} · {user.username}
              {user.isDemo && <span className="px-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">demo account</span>}
            </div>
          </div>
          {/* A demo account's PIN is what one-tap sign-in uses, so it is not changed from here. */}
          {!user.isDemo && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); setChanging(true); }} className="w-full h-9 px-2.5 rounded-lg hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-2">
              <KeyRound size={14} className="text-muted-foreground" /> Change PIN
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); api.logout(); }} className="w-full h-9 px-2.5 rounded-lg hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-2">
            <LogOut size={14} className="text-muted-foreground" /> Sign out
          </button>
        </div>
      )}
      {changing && createPortal(
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm"><ChangePinCard onClose={() => setChanging(false)} /></div>
        </div>,
        document.body
      )}
    </div>
  );
};

const FieldError: React.FC<{ message?: string | null }> = ({ message }) => (
  <div className="min-h-[20px] mt-1 text-xs font-semibold text-rose-600 flex items-center gap-1" role={message ? 'alert' : undefined}>
    {message && <><AlertCircle size={12} className="shrink-0" /> {message}</>}
  </div>
);

/** Touch-friendly PIN pad, also usable with a keyboard. */
const PinPad: React.FC<{ value: string; onChange: (v: string) => void; onSubmit?: () => void; label: string; autoFocus?: boolean }> = ({ value, onChange, onSubmit, label, autoFocus }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
    <input
      type="password"
      inputMode="numeric"
      autoComplete="current-password"
      value={value}
      autoFocus={autoFocus}
      onChange={e => onChange(e.target.value.slice(0, 32))}
      onKeyDown={e => { if (e.key === 'Enter') onSubmit?.(); }}
      className="mt-1 w-full h-12 rounded-xl border border-border bg-background px-4 text-xl tracking-[0.4em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={label}
    />
    <div className="grid grid-cols-3 gap-1.5 mt-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
        <button key={d} type="button" onClick={() => onChange((value + d).slice(0, 32))} className="h-11 rounded-xl border border-border bg-background hover:bg-muted text-lg font-semibold text-foreground">{d}</button>
      ))}
      <button type="button" onClick={() => onChange('')} className="h-11 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground">Clear</button>
      <button type="button" onClick={() => onChange((value + '0').slice(0, 32))} className="h-11 rounded-xl border border-border bg-background hover:bg-muted text-lg font-semibold text-foreground">0</button>
      <button type="button" onClick={() => onChange(value.slice(0, -1))} className="h-11 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Delete last digit"><Delete size={18} /></button>
    </div>
  </div>
);

const SignInCard: React.FC<{ terminalName: string; roles: StaffRole[]; notice: string | null; onDone: () => void }> = ({ terminalName, roles, notice, onDone }) => {
  const { status, waiting, reload } = useAuthStatus();
  const mode = useAppMode();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverInput, setServerInput] = useState(getCustomApiUrl() || '');

  const submit = useCallback(async () => {
    if (!username.trim() || !pin) {
      setError('Enter your username and PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.login(username.trim(), pin);
      onDone();
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'The hospital server did not respond.' : e?.message || 'Sign-in failed.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }, [username, pin, onDone]);

  if (status?.needsSetup) return <FirstRunSetup needsCode={status.setupNeedsCode} onDone={reload} />;

  // One-tap accounts: the demo staff of a demonstration server (or the sandbox stand-ins), for this screen's roles.
  const quick = quickAccountsFor(status, roles);
  const formOpen = showForm || (!!status && quick.length === 0);
  const sandbox = mode.source === 'sandbox';

  return (
    <div className="max-w-md mx-auto mt-10 mb-16 px-4">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary"><ShieldCheck size={22} /></div>
          <div>
            <h2 className="text-lg font-bold text-foreground leading-tight">Staff sign-in</h2>
            <p className="text-xs text-muted-foreground">{terminalName}</p>
          </div>
        </div>

        {notice && <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-200">{notice}</div>}
        {waiting && !status && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-start gap-2" role="status">
            <Loader2 size={14} className="animate-spin shrink-0 mt-px" />
            <span>{mode.mode === 'real'
              ? 'Real mode needs the hospital server, which is not answering yet. You can sign in as soon as it does.'
              : 'Connecting to the hospital server… You can sign in as soon as it answers.'}</span>
          </div>
        )}

        {quick.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Choose who you are</span>
              {sandbox && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 inline-flex items-center gap-1"><WifiOff size={11} /> Offline sandbox</span>}
            </div>
            <QuickAccounts accounts={quick} onSignedIn={onDone} onNeedsPin={(u, m) => { setUsername(u); setPin(''); setError(m); setShowForm(true); }} />
            <p className="mt-2 text-[11px] text-muted-foreground">Demonstration accounts: one tap, no PIN to type.</p>
            <button type="button" onClick={() => setShowForm(v => !v)} aria-expanded={formOpen}
              className="mt-3 w-full h-9 rounded-lg border border-border/80 bg-background hover:bg-muted text-xs font-semibold text-muted-foreground inline-flex items-center justify-center gap-1.5">
              {formOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Sign in with a username and PIN
            </button>
          </div>
        )}

        {formOpen && (
          <div className={quick.length > 0 ? 'mt-4 pt-4 border-t border-border/70' : ''}>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="staff-username">Username</label>
            <input
              id="staff-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. dr.sharma"
            />
            <div className="h-3" />
            <PinPad value={pin} onChange={setPin} onSubmit={submit} label="PIN" />
            <FieldError message={error} />

            <button type="button" onClick={submit} disabled={busy} className="mt-2 w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Sign in
            </button>
          </div>
        )}
        {!formOpen && error && <FieldError message={error} />}

        {/* Which server this screen talks to; a demonstration site can be pointed at another one. */}
        <div className="mt-5 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${mode.reachable ? 'bg-emerald-500' : mode.reachable === false ? 'bg-rose-500' : 'bg-muted-foreground'}`} />
              <Server size={12} className="shrink-0" />
              <span className="font-mono truncate" title={BASE_URL}>{BASE_URL.replace(/^https?:\/\//, '')}</span>
            </span>
            <button type="button" onClick={() => setShowServerConfig(v => !v)} aria-expanded={showServerConfig} className="text-[11px] text-primary hover:underline font-semibold shrink-0">
              {showServerConfig ? 'Close' : 'Change server'}
            </button>
          </div>

          {showServerConfig && (
            <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
              <label className="block text-[11px] font-semibold text-foreground" htmlFor="staff-server-url">Server address (tunnel, Codespaces or VPS)</label>
              <div className="flex gap-1.5">
                <input
                  id="staff-server-url"
                  type="text"
                  value={serverInput}
                  onChange={e => setServerInput(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-0 h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={() => setCustomApiUrl(serverInput)} className="px-3 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs whitespace-nowrap">Connect</button>
              </div>
              {getCustomApiUrl() && (
                <button type="button" onClick={() => setCustomApiUrl(null)} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <RefreshCw size={11} /> Use the default server again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChangePinCard: React.FC<{ forced?: boolean; onClose?: () => void }> = ({ forced, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (next !== confirm) {
      setError('The new PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.changePin(current, next);
      setDone(true);
      if (!forced) setTimeout(() => onClose?.(), 900);
    } catch (e: any) {
      setError(e?.message || 'Could not change the PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={forced ? 'max-w-sm mx-auto mt-10 px-4' : ''}>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><KeyRound size={18} /> {forced ? 'Choose your own PIN' : 'Change PIN'}</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          {forced ? 'Your account was set up by an administrator. Choose a new PIN only you know.' : 'At least 6 digits (or 8+ characters). Avoid 123456, birthdays or repeated digits.'}
        </p>
        {(['Current PIN', 'New PIN', 'Repeat new PIN'] as const).map((label, i) => (
          <div key={label} className="mb-2">
            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete={i === 0 ? 'current-password' : 'new-password'}
              value={[current, next, confirm][i]}
              onChange={e => [setCurrent, setNext, setConfirm][i](e.target.value.slice(0, 64))}
              onKeyDown={e => { if (e.key === 'Enter' && i === 2) submit(); }}
              className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3.5 text-base tracking-[0.3em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
        <FieldError message={error} />
        {done && <p className="text-xs font-semibold text-emerald-600 mb-2">PIN changed.</p>}
        <div className="flex gap-2 mt-1">
          {!forced && <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold">Cancel</button>}
          {forced && <button type="button" onClick={() => api.logout()} className="flex-1 h-11 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold">Sign out</button>}
          <button type="button" onClick={submit} disabled={busy || done} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold disabled:opacity-60">
            {busy ? 'Saving…' : 'Save PIN'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FirstRunSetup: React.FC<{ needsCode: boolean; onDone: () => void }> = ({ needsCode, onDone }) => {
  const [form, setForm] = useState({ username: '', displayName: '', pin: '', confirm: '', setupCode: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (form.pin !== form.confirm) {
      setError('The PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.firstRunSetup({ username: form.username, displayName: form.displayName, pin: form.pin, setupCode: form.setupCode || undefined });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Setup failed.');
    } finally {
      setBusy(false);
    }
  };

  const input = (label: string, key: keyof typeof form, type = 'text') => (
    <div className="mb-2">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input type={type} value={form[key]} onChange={set(key)} className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">First-time setup</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">No staff accounts exist yet. Create the hospital administrator; they then add doctors, nurses and other staff.</p>
        {input('Administrator username', 'username')}
        {input('Full name', 'displayName')}
        {input('PIN (6+ digits)', 'pin', 'password')}
        {input('Repeat PIN', 'confirm', 'password')}
        {needsCode && input('Setup code (from the server administrator)', 'setupCode', 'password')}
        <FieldError message={error} />
        <button type="button" onClick={submit} disabled={busy} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60">{busy ? 'Creating…' : 'Create administrator'}</button>
      </div>
    </div>
  );
};
