import { useEffect, useSyncExternalStore } from 'react';
import { BASE_URL, apiFetch, SERVER_MODE_CHANGED } from './api';
import { session } from './session';
import { DEMO_ADMIN } from './demoAccounts';

/**
 * Mock / Real mode: the one place that decides what the screens may show.
 *
 *   MOCK  sample patients and demo shortcuts. They come from the hospital server while it
 *         answers (its ten sample visits, real engines), and from the built-in offline sandbox
 *         in this browser when it does not — so Mock mode always works.
 *   REAL  only what the hospital server says. No sample patients, no demo OTP, no sandbox, no
 *         silent stand-ins: if the server does not answer, the screen says so.
 *
 * The server's mode is shared by every device; this store follows it (on load, on focus, every
 * 30 s, every 5 s while it is not answering). The offline sandbox exists only on demonstration
 * deployments — never on a hospital installation, where a network blip must not put invented
 * patients on a clinician's screen.
 */

/** What the server reports (GET /api/system/mode). */
export interface RuntimeMode {
  demoMode: boolean;
  /** Demonstration server: Mock / Real can be switched at run time. */
  demoToggle: boolean;
  kioskOpen: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

export type AppMode = 'mock' | 'real';

export interface ModeSnapshot {
  mode: AppMode;
  /** Where the data on screen comes from. 'none': connecting, or Real mode without a server. */
  source: 'server' | 'sandbox' | 'none';
  /** Whether the hospital server answered the last check (null until the first check ends). */
  reachable: boolean | null;
  server: RuntimeMode | null;
  /** Whether this deployment has a Mock / Real switch at all (demonstration deployments only). */
  canSwitch: boolean;
  /** The offline sandbox is in use although the server answers again. */
  serverBack: boolean;
}

const PREF_KEY = 'hos_app_mode';
const DEMO_SERVER_KEY = 'hos_demo_server';
const MOCK_TOKEN = 'mock-token-sandbox';

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

/** Public demo hosts and local development are demonstration deployments until a server says otherwise. */
const looksLikeDemoDeployment = (): boolean => {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return /(\.vercel\.app|\.onrender\.com|\.netlify\.app|\.github\.io|\.trycloudflare\.com|\.app\.github\.dev)$/.test(window.location.hostname);
};

let server: RuntimeMode | null = null;
let reachable: boolean | null = null;
let everReached = false;
let failures = 0;
let pref: AppMode = read(PREF_KEY) === 'real' ? 'real' : 'mock';
/** A switch made while the server was not answering, to be applied to it when it returns. */
let pendingPush: AppMode | null = null;
let pending: Promise<RuntimeMode | null> | null = null;
let snapshot: ModeSnapshot | null = null;
const listeners = new Set<() => void>();

/** Whether the offline sandbox may be used here: only where a server last said "demonstration server". */
function sandboxAllowed(): boolean {
  const known = read(DEMO_SERVER_KEY);
  return known === '1' || (known === null && looksLikeDemoDeployment());
}

function compute(): ModeSnapshot {
  const sandbox = session.isSandbox;
  if (sandbox) return { mode: 'mock', source: 'sandbox', reachable, server, canSwitch: true, serverBack: reachable === true };
  if (reachable && server) {
    return { mode: server.demoMode ? 'mock' : 'real', source: 'server', reachable, server, canSwitch: server.demoToggle, serverBack: false };
  }
  return { mode: pref, source: 'none', reachable, server, canSwitch: sandboxAllowed(), serverBack: false };
}

function publish() {
  const next = compute();
  const prev = snapshot;
  if (prev && prev.mode === next.mode && prev.source === next.source && prev.reachable === next.reachable && prev.server === next.server && prev.canSwitch === next.canSwitch && prev.serverBack === next.serverBack) return;
  snapshot = next;
  listeners.forEach(l => l());
  if (typeof window !== 'undefined' && (!prev || prev.mode !== next.mode || prev.source !== next.source)) {
    window.dispatchEvent(new CustomEvent('hos:runtime-mode', { detail: next }));
  }
}

function setPref(mode: AppMode) {
  pref = mode;
  write(PREF_KEY, mode);
}

function enterSandbox() {
  if (session.isSandbox) return;
  session.setSandbox(true);
}

function leaveSandbox() {
  if (!session.isSandbox) return;
  session.setSandbox(false);
  // A sandbox sign-in means nothing to the real server: ask for a (one-tap) sign-in again.
  if (session.staffToken === MOCK_TOKEN) session.clearStaff();
}

async function probe(): Promise<RuntimeMode | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch(`${BASE_URL}/api/system/mode`, { signal: ctrl.signal, cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    if (!j?.data) throw new Error('no mode');
    const firstAnswer = !everReached;
    everReached = true;
    failures = 0;
    reachable = true;
    server = j.data as RuntimeMode;
    write(DEMO_SERVER_KEY, server.demoToggle ? '1' : '0');
    // A page that loads while the server answers never starts in a sandbox left over from last time.
    if (firstAnswer && session.isSandbox && !pendingPush) leaveSandbox();
    if (!server.demoToggle && session.isSandbox) leaveSandbox(); // a hospital installation has no sandbox
    if (pendingPush && server.demoToggle && !session.isSandbox && (pendingPush === 'mock') !== server.demoMode) {
      const target = pendingPush;
      pendingPush = null;
      await postSwitch(target === 'mock').then(apply).catch(() => { /* the switch stays where the server has it */ });
    } else if (!session.isSandbox) {
      pendingPush = null;
      setPref(server.demoMode ? 'mock' : 'real');
    }
    return server;
  } catch {
    failures++;
    reachable = false;
    // Mock mode keeps working without the server, but only after three misses in a row, so a
    // server restart or a network blip changes nothing. A page that has not reached the server
    // yet retries quickly (a dead server is noticed in ~3 s); a page that had it waits ~15 s.
    if (pref === 'mock' && !session.isSandbox && sandboxAllowed() && failures >= 3) enterSandbox();
    else if (!everReached && failures < 3) setTimeout(() => { refreshRuntimeMode(); }, 1200);
    return server;
  } finally {
    clearTimeout(timer);
    publish();
  }
}

function apply(next: RuntimeMode) {
  server = next;
  reachable = true;
  setPref(next.demoMode ? 'mock' : 'real');
  publish();
}

export function refreshRuntimeMode(): Promise<RuntimeMode | null> {
  if (!pending) pending = probe().finally(() => { pending = null; });
  return pending;
}

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  snapshot = compute();
  refreshRuntimeMode();
  window.addEventListener('focus', () => { refreshRuntimeMode(); });
  // The server announced a switch on the event stream, or refused a sample record: follow at once.
  window.addEventListener(SERVER_MODE_CHANGED, () => { refreshRuntimeMode(); });
  session.subscribe(publish);
  // Every 30 s while visible; every 5 s while the server is not answering, so screens recover by themselves.
  let last = 0;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (reachable !== true || now - last >= 30000) { last = now; refreshRuntimeMode(); }
  }, 5000);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = (): ModeSnapshot => snapshot || (snapshot = compute());
const SERVER_SNAPSHOT: ModeSnapshot = { mode: 'mock', source: 'none', reachable: null, server: null, canSwitch: false, serverBack: false };

/** Mock or Real, where the data comes from, and whether the server answers. */
export function useAppMode(): ModeSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/** What the server last reported, or null until it has answered. */
export function useRuntimeMode(): RuntimeMode | null {
  return useAppMode().server;
}

/** Whether the hospital server is answering: null while the first check runs. */
export function useServerReachable(): boolean | null {
  return useAppMode().reachable;
}

/** Resolves to whether mock data is in use (Mock mode with a source), once the first check is done. */
export function fetchDemoMode(): Promise<boolean> {
  const answer = () => { const s = getSnapshot(); return s.mode === 'mock' && s.source !== 'none'; };
  return reachable === null ? refreshRuntimeMode().then(answer) : Promise.resolve(answer());
}

/** True while mock data and demo shortcuts may be shown. False until known, so they never flash in Real mode. */
export function useDemoMode(): boolean {
  const s = useAppMode();
  // Re-check when a screen that depends on it mounts (kiosks have no live event stream).
  useEffect(() => { refreshRuntimeMode(); }, []);
  return s.mode === 'mock' && s.source !== 'none';
}

export class DemoModeSwitchError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

async function postSwitch(on: boolean, approver?: { username: string; pin: string }): Promise<RuntimeMode & { restored: number; parked: number }> {
  const send = (body: Record<string, unknown>) => apiFetch(`${BASE_URL}/api/system/demo-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let res = await send({ on, ...(approver ? { approver } : {}) });
  let json = await res.json().catch(() => ({} as any));
  // The server asks for an administrator. On a demonstration server the demo administrator's
  // approval is carried automatically, so the switch stays one click for the presenter.
  if (!approver && res.status === 401 && json.code === 'ADMIN_APPROVAL_REQUIRED') {
    res = await send({ on, approver: { username: DEMO_ADMIN.username, pin: DEMO_ADMIN.pin } });
    json = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new DemoModeSwitchError('ADMIN_APPROVAL_REQUIRED', 'This server needs an administrator to approve the switch.');
  }
  if (!res.ok || !json.success) throw new DemoModeSwitchError(json.code || `HTTP_${res.status}`, json.error || 'The server could not switch the mode.');
  return json.data;
}

export interface SwitchResult {
  mode: AppMode;
  /** 'server': every device follows. 'browser': only this browser (the server was not answering). */
  scope: 'server' | 'browser';
  restored: number;
  parked: number;
}

/**
 * The one switch. With the server answering, it switches the server (all devices follow) and
 * leaves the offline sandbox. Without it, Mock means the offline sandbox in this browser and Real
 * means waiting for the server; the choice is applied to the server when it returns.
 * `approver` is only needed where the demo administrator's approval is not accepted.
 */
export async function switchAppMode(target: AppMode, approver?: { username: string; pin: string }): Promise<SwitchResult> {
  if (reachable === true && server?.demoToggle) {
    const wasSandbox = session.isSandbox;
    if (wasSandbox) leaveSandbox();
    try {
      const data = (target === 'mock') === server.demoMode && !approver
        ? { ...server, restored: 0, parked: 0 }
        : await postSwitch(target === 'mock', approver);
      pendingPush = null;
      apply(data);
      return { mode: target, scope: 'server', restored: data.restored, parked: data.parked };
    } catch (err) {
      // A dropped connection in the middle of the click: fall through to the offline rule below.
      if (err instanceof DemoModeSwitchError) { publish(); throw err; }
      reachable = false;
    }
  }
  if (reachable === true && server && !server.demoToggle) {
    throw new DemoModeSwitchError('TOGGLE_DISABLED', 'This is a hospital installation: it has no Mock / Real switch.');
  }
  setPref(target);
  pendingPush = target;
  if (target === 'mock' && sandboxAllowed()) enterSandbox(); else leaveSandbox();
  publish();
  return { mode: target, scope: 'browser', restored: 0, parked: 0 };
}

/** Stop using the offline sandbox and go back to the hospital server (it answers again). */
export function returnToServer(): void {
  leaveSandbox();
  pendingPush = null;
  publish();
  refreshRuntimeMode();
}

/** Start the offline sandbox by hand (the server is not answering and Mock mode is wanted now). */
export function startOfflineSandbox(): void {
  if (!sandboxAllowed()) return;
  setPref('mock');
  pendingPush = null;
  enterSandbox();
  publish();
}
