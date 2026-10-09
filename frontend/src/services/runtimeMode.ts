import { useEffect, useSyncExternalStore } from 'react';
import { BASE_URL, apiFetch } from './api';

/**
 * Demonstration mode: whether the server runs with demo data (sample patients, demo staff accounts,
 * the kiosk's demo OTP) and whether an administrator may switch it here. Every screen reads it from
 * this one store, which follows the server: on load, when the window regains focus, every 30 s
 * while visible, and at once in the browser that switched it.
 */
export interface RuntimeMode {
  demoMode: boolean;
  demoToggle: boolean;
  kioskOpen: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

let state: RuntimeMode | null = null;
/** Whether the last call to the server got an answer (null until the first attempt finishes). */
let reachable: boolean | null = null;
let pending: Promise<RuntimeMode | null> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function setReachable(v: boolean) {
  if (reachable === v) return;
  reachable = v;
  emit();
}

function apply(next: RuntimeMode) {
  const changed = !state || state.demoMode !== next.demoMode || state.demoToggle !== next.demoToggle || state.changedAt !== next.changedAt;
  state = next;
  if (changed) {
    emit();
    window.dispatchEvent(new CustomEvent('hos:runtime-mode', { detail: next }));
  }
}

export function refreshRuntimeMode(): Promise<RuntimeMode | null> {
  if (!pending) {
    // A sleeping free-tier cloud server can take up to a minute to answer its first request.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 70000);
    pending = fetch(`${BASE_URL}/api/system/mode`, { signal: ctrl.signal })
      .then(r => { setReachable(true); return r.ok ? r.json() : null; })
      .then(j => { if (j?.data) apply(j.data as RuntimeMode); return state; })
      .catch(() => { setReachable(false); return state; })
      .finally(() => { clearTimeout(timer); pending = null; });
  }
  return pending;
}

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  refreshRuntimeMode();
  window.addEventListener('focus', () => { refreshRuntimeMode(); });
  // Every 30 s while visible; every 5 s while the server is not answering, so screens recover by themselves.
  let last = 0;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (reachable === false || now - last >= 30000) { last = now; refreshRuntimeMode(); }
  }, 5000);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The current mode, or null until the server has answered. */
export function useRuntimeMode(): RuntimeMode | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

/** Whether the hospital server is answering: null while the first check runs. */
export function useServerReachable(): boolean | null {
  return useSyncExternalStore(subscribe, () => reachable, () => null);
}

/** Kept for existing callers: resolves to whether demo data is on. */
export function fetchDemoMode(): Promise<boolean> {
  return (state ? Promise.resolve(state) : refreshRuntimeMode()).then(s => !!s?.demoMode);
}

/** True while the server runs with demo data. False until known, so demo helpers never flash on a real site. */
export function useDemoMode(): boolean {
  const mode = useRuntimeMode();
  // Re-check when a screen that depends on it mounts (kiosks have no live event stream).
  useEffect(() => { refreshRuntimeMode(); }, []);
  return !!mode?.demoMode;
}

export class DemoModeSwitchError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/**
 * Switch demonstration mode. A signed-in administrator needs nothing else; anyone else passes an
 * administrator's username and PIN as approval (checked like a sign-in, no session kept).
 */
export async function switchDemoMode(on: boolean, approver?: { username: string; pin: string }): Promise<RuntimeMode & { restored: number; parked: number }> {
  const res = await apiFetch(`${BASE_URL}/api/system/demo-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on, ...(approver ? { approver } : {}) })
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json.success) throw new DemoModeSwitchError(json.code || `HTTP_${res.status}`, json.error || 'The server could not switch demonstration mode.');
  apply(json.data);
  return json.data;
}
