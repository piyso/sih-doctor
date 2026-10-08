import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Lock, LogIn, LogOut, KeyRound, ShieldCheck, UserRound, Loader2, AlertCircle, Delete } from 'lucide-react';
import { api } from '../../services/api';
import { session, StaffRole, StaffUser, ROLE_LABEL } from '../../services/session';

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

/**
 * Puts a staff sign-in in front of a terminal: username + PIN, forced PIN change on first use,
 * first-run administrator setup, role check, and automatic sign-out after inactivity.
 */
export const StaffGate: React.FC<StaffGateProps> = ({ roles, terminalName, children }) => {
  const user = useStaffUser();
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Validate a remembered session once (the server may have expired it).
  useEffect(() => {
    let alive = true;
    if (session.staffToken) {
      api.me().then(u => {
        if (!alive) return;
        if (!u) session.clearStaff();
        setChecked(true);
      });
    } else {
      setChecked(true);
    }
    const onExpired = () => setNotice('Your session ended. Please sign in again.');
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
  if (!roles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="rounded-3xl border border-border bg-card p-7 text-center shadow-sm">
          <Lock className="mx-auto mb-3 text-amber-600" size={28} />
          <h2 className="text-lg font-bold text-foreground">{terminalName} is not available for your role</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            You are signed in as <strong>{user.displayName}</strong> ({ROLE_LABEL[user.role]}). This screen is for: {roles.map(r => ROLE_LABEL[r]).join(', ')}.
          </p>
          <button type="button" onClick={() => api.logout()} className="mt-5 h-10 px-5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold inline-flex items-center gap-2">
            <LogOut size={15} /> Sign in as someone else
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

/** Small user chip with sign-out, for terminal top bars. */
export const StaffChip: React.FC = () => {
  const user = useStaffUser();
  const [changing, setChanging] = useState(false);
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/60 border border-border/80 text-[11px] font-semibold text-foreground">
        <UserRound size={13} className="text-muted-foreground" />
        <span className="max-w-[180px] truncate">{user.displayName}</span>
        <span className="text-muted-foreground font-medium">· {ROLE_LABEL[user.role]}</span>
        {user.isDemo && <span className="px-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">demo</span>}
      </div>
      <button type="button" onClick={() => setChanging(true)} className="h-8 px-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-[11px] font-semibold inline-flex items-center gap-1.5" title="Change PIN">
        <KeyRound size={13} /> <span className="hidden md:inline">PIN</span>
      </button>
      <button type="button" onClick={() => api.logout()} className="h-8 px-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-[11px] font-semibold inline-flex items-center gap-1.5">
        <LogOut size={13} /> <span className="hidden md:inline">Sign out</span>
      </button>
      {changing && (
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm"><ChangePinCard onClose={() => setChanging(false)} /></div>
        </div>
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
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.getAuthStatus>> | null>(null);
  const [offline, setOffline] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getAuthStatus().then(setStatus).catch(() => setOffline(true));
  }, []);

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

  if (status?.needsSetup) return <FirstRunSetup needsCode={status.setupNeedsCode} onDone={() => api.getAuthStatus().then(setStatus)} />;

  const suggested = (status?.demoAccounts || []).filter(a => roles.includes(a.role as StaffRole));

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
        {offline && <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-200">The hospital server is not reachable. Check the network and try again.</div>}

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

        {status?.demoMode && suggested.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border/70">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-2">Demo mode — test accounts (PINs are in backend/src/db/demoStaff.ts):</p>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map(a => (
                <button key={a.username} type="button" onClick={() => { setUsername(a.username); setError(null); }} className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-semibold text-foreground">
                  {a.displayName} <span className="text-muted-foreground font-normal">({a.username})</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
