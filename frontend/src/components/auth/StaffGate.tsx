import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Lock, LogIn, LogOut, KeyRound, ShieldCheck, UserRound, Loader2, AlertCircle, Delete, Globe, Server, RefreshCw } from 'lucide-react';
import { api, BASE_URL, getCustomApiUrl, setCustomApiUrl } from '../../services/api';
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
      if (session.isSandbox) {
        setChecked(true);
      } else {
        api.me().then(u => {
          if (!alive) return;
          if (!u && !session.isSandbox) session.clearStaff();
          setChecked(true);
        }).catch(() => {
          if (!alive) return;
          setChecked(true);
        });
      }
    } else {
      setChecked(true);
    }
    const onExpired = () => {
      if (!session.isSandbox) {
        setNotice('Your session ended. Please sign in again.');
      }
    };
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
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setChanging(true); }} className="w-full h-9 px-2.5 rounded-lg hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-2">
            <KeyRound size={14} className="text-muted-foreground" /> Change PIN
          </button>
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

const DEMO_PREFILL_USERS: Array<{ username: string; displayName: string; role: StaffRole; pin: string }> = [
  { username: 'dr.sharma', displayName: 'Dr. Ananya Sharma', role: 'doctor', pin: '482913' },
  { username: 'vaidya.sharma', displayName: 'Vaidya V. K. Sharma', role: 'vaidya', pin: '573920' },
  { username: 'admin', displayName: 'Hospital Admin', role: 'admin', pin: '802211' },
  { username: 'nurse.priya', displayName: 'Sr. Nurse Priya', role: 'nurse', pin: '619384' }
];

const SignInCard: React.FC<{ terminalName: string; roles: StaffRole[]; notice: string | null; onDone: () => void }> = ({ terminalName, roles, notice, onDone }) => {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.getAuthStatus>> | null>(null);
  const [offline, setOffline] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep trying: a free cloud server that was asleep answers after up to a minute.
  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryOnce = (n: number) => {
      api.getAuthStatus()
        .then(st => { if (alive) { setStatus(st); setOffline(false); } })
        .catch(() => {
          if (!alive) return;
          setOffline(true);
          setAttempts(n + 1);
          timer = setTimeout(() => tryOnce(n + 1), 4000);
        });
    };
    tryOnce(0);
    return () => { alive = false; if (timer) clearTimeout(timer); };
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

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverInput, setServerInput] = useState(getCustomApiUrl() || '');

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
        {offline && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <span className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> Server is sleeping or unreachable
              </span>
              <button
                type="button"
                onClick={() => {
                  session.setSandbox(true);
                  setUsername('dr.sharma');
                  setPin('482913');
                  setTimeout(() => submit(), 50);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm"
              >
                <span>⚡ 1-Click Offline Sandbox</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Free cloud backends take time to wake. Click <strong>1-Click Offline Sandbox</strong> to immediately access the Doctor Desk, Dual-Pharmacology Prescriber, and Kiosk with sample patients and zero waiting.
            </p>
          </div>
        )}

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

        <div className="mt-5 pt-4 border-t border-border/70">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            <span>1-Click Test Accounts:</span>
            {session.isSandbox && <span className="text-amber-600 font-bold uppercase tracking-wider text-[10px]">Sandbox Active</span>}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_PREFILL_USERS.filter(u => roles.includes(u.role as StaffRole)).map(a => (
              <button
                key={a.username}
                type="button"
                onClick={() => {
                  setUsername(a.username);
                  setPin(a.pin);
                  setError(null);
                }}
                className="px-2.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-left transition-all"
              >
                <div className="text-xs font-bold text-foreground leading-snug">{a.displayName}</div>
                <div className="text-[10px] text-muted-foreground">User: <code className="font-mono text-primary font-bold">{a.username}</code> · PIN: <code className="font-mono">{a.pin}</code></div>
              </button>
            ))}
          </div>
        </div>

        {/* Server Connection Manager */}
        <div className="mt-4 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1.5 font-medium">
              <Server size={12} className="text-primary" /> Hospital Server:
            </span>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              {showServerConfig ? 'Close' : 'Change Server'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-foreground/80 truncate bg-muted/50 px-2 py-1 rounded-md border border-border/50">
            {BASE_URL}
          </div>

          {showServerConfig && (
            <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
              <label className="block text-[11px] font-semibold text-foreground">Custom Server URL (Cloudflare Tunnel, Codespaces, or VPS)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={serverInput}
                  onChange={e => setServerInput(e.target.value)}
                  placeholder="https://...trycloudflare.com or https://...app.github.dev"
                  className="flex-1 h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setCustomApiUrl(serverInput)}
                  className="px-3 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs whitespace-nowrap"
                >
                  Connect
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCustomApiUrl('https://gamma-tones-positioning-adjust.trycloudflare.com')}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Globe size={11} /> ⚡ Connect Live Cloudflare Tunnel
                </button>
                {getCustomApiUrl() && (
                  <button
                    type="button"
                    onClick={() => setCustomApiUrl(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Reset Default
                  </button>
                )}
              </div>
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
