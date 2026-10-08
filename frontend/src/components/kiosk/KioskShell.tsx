import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorSmartphone, KeyRound, Loader2, Lock } from 'lucide-react';
import { api } from '../../services/api';
import { session } from '../../services/session';

const LOCK_KEY = 'hos_kiosk_locked';

export const isKioskLocked = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get('lock') === '1') return true;
    return localStorage.getItem(LOCK_KEY) === '1';
  } catch {
    return false;
  }
};

export const setKioskLocked = (locked: boolean) => {
  try {
    if (locked) localStorage.setItem(LOCK_KEY, '1');
    else localStorage.removeItem(LOCK_KEY);
  } catch {}
};

/**
 * Wraps the patient kiosk:
 *  1. Enrolment gate — on a production server a kiosk works only after an administrator enrols it.
 *  2. Lockdown — when locked, patients cannot leave the kiosk screen: no context menu, no zoom
 *     gestures, no keyboard shortcuts. Staff exit by pressing and holding the top-left corner for
 *     3 seconds and signing in.
 * For full lockdown also start the browser in kiosk mode (see scripts/start-kiosk.sh).
 */
export const KioskShell: React.FC<{ locked: boolean; onExit: () => void; children: React.ReactNode }> = ({ locked, onExit, children }) => {
  const [state, setState] = useState<'checking' | 'ok' | 'enroll'>('checking');

  const check = useCallback(async () => {
    try {
      const s = await api.getKioskDeviceStatus();
      setState(s.enrolled || s.kioskOpen ? 'ok' : 'enroll');
    } catch {
      // Server unreachable: let the kiosk run in its offline mode.
      setState('ok');
    }
  }, []);

  useEffect(() => {
    check();
    const onNeed = () => setState('enroll');
    window.addEventListener('hos:kiosk-enrollment', onNeed);
    return () => window.removeEventListener('hos:kiosk-enrollment', onNeed);
  }, [check]);

  // Lockdown behaviour.
  useEffect(() => {
    if (!locked) return;
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === 'Escape' || e.key === 'F5' || e.key === 'F11' || e.key === 'F12' || (e.ctrlKey || e.metaKey) && ['r', 'w', 'n', 't', 'p', 'l', '+', '-', '=', '0'].includes(k) || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('contextmenu', block);
    document.addEventListener('gesturestart', block as EventListener);
    window.addEventListener('keydown', keys, true);
    document.documentElement.classList.add('kiosk-locked');
    const goFull = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
    window.addEventListener('pointerdown', goFull, { once: true });
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('gesturestart', block as EventListener);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pointerdown', goFull);
      document.documentElement.classList.remove('kiosk-locked');
    };
  }, [locked]);

  if (state === 'checking') {
    return <div className="flex items-center justify-center py-24 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Starting kiosk…</div>;
  }
  if (state === 'enroll') return <EnrollScreen onEnrolled={() => setState('ok')} />;

  return (
    <>
      {locked && <StaffExitHotspot onExit={onExit} />}
      {children}
    </>
  );
};

const EnrollScreen: React.FC<{ onEnrolled: () => void }> = ({ onEnrolled }) => {
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const useCode = async () => {
    setBusy(true);
    setError(null);
    session.setDeviceToken(code.trim());
    const s = await api.getKioskDeviceStatus().catch(() => null);
    setBusy(false);
    if (s?.enrolled) onEnrolled();
    else {
      session.clearDeviceToken();
      setError('This code is not valid or was revoked.');
    }
  };

  const enrollWithLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.login(username, pin);
      if (user.role !== 'admin') throw new Error('Only an administrator can enrol a kiosk.');
      const r = await api.enrollDevice({ name: name || 'Kiosk' });
      session.setDeviceToken(r.token);
      await api.logout();
      onEnrolled();
    } catch (e: any) {
      await api.logout();
      setError(e?.message || 'Enrolment failed.');
    } finally {
      setBusy(false);
      setPin('');
    }
  };

  const input = 'w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <MonitorSmartphone className="text-primary" size={26} />
          <h2 className="text-lg font-bold">Set up this kiosk</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">This screen is for hospital staff. Patients: please ask at the registration desk for help.</p>

        <h3 className="text-xs font-bold text-muted-foreground mb-1.5">Option 1 — enrolment code from Administration › Kiosks & screens</h3>
        <div className="flex gap-2">
          <input className={input} value={code} onChange={e => setCode(e.target.value)} placeholder="Paste the enrolment code" />
          <button type="button" onClick={useCode} disabled={busy || code.trim().length < 20} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">Use code</button>
        </div>

        <h3 className="text-xs font-bold text-muted-foreground mt-6 mb-1.5">Option 2 — administrator signs in here</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Kiosk name" />
          <input className={input} value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin username" autoCapitalize="none" />
          <input className={input} type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" />
        </div>
        <button type="button" onClick={enrollWithLogin} disabled={busy || !username || !pin} className="mt-2 w-full h-11 rounded-xl border border-border bg-background hover:bg-muted text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Enrol this kiosk
        </button>
        <div className="min-h-[20px] mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</div>
      </div>
    </div>
  );
};

/** Invisible 56×56 px corner: press and hold 3 s, then a staff member signs in to leave kiosk mode. */
const StaffExitHotspot: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [asking, setAsking] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = () => { timer.current = setTimeout(() => setAsking(true), 3000); };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };

  const unlock = async () => {
    setError(null);
    try {
      const { user } = await api.login(username, pin);
      if (!['admin', 'nurse', 'reception'].includes(user.role)) throw new Error('Only admin, nurse or reception staff can leave kiosk mode.');
      await api.logout();
      setKioskLocked(false);
      setAsking(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      onExit();
    } catch (e: any) {
      await api.logout();
      setError(e?.message || 'Not allowed.');
      setPin('');
    }
  };

  return (
    <>
      <div
        className="fixed top-0 left-0 w-14 h-14 z-[2000]"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        aria-hidden="true"
      />
      {asking && (
        <div className="fixed inset-0 z-[2100] bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-bold flex items-center gap-2"><Lock size={15} /> Staff: leave kiosk mode</h3>
            <input className="mt-3 w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" />
            <input className="mt-2 w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" placeholder="PIN" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') unlock(); }} />
            <div className="min-h-[18px] mt-1 text-xs font-semibold text-rose-600">{error}</div>
            <div className="flex gap-2 justify-end mt-1">
              <button type="button" onClick={() => { setAsking(false); setPin(''); }} className="h-10 px-4 rounded-xl border border-border text-sm font-semibold">Cancel</button>
              <button type="button" onClick={unlock} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
