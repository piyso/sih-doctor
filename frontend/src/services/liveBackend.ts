/**
 * Where the public demonstration site (Vercel and similar hosts) finds its backend.
 *
 * The demonstration backend is reached through a tunnel whose address changes whenever the tunnel
 * restarts. Instead of baking that address into the build, the site reads it at start-up from a
 * small pointer file in the repository (deploy/live-backend.json, written by
 * scripts/live-demo.sh). A new tunnel address therefore needs no new build of the site.
 *
 * Order of preference for the backend address (see api.ts): an address typed in by the user
 * ("Change server"), VITE_API_URL, this pointer, the last address built in below, the page's own
 * origin (local development and hospital installations, which never use any of this).
 */

const STORAGE_KEY = 'HOS_LIVE_BACKEND';

/** Used until the pointer has been read once (and if it cannot be read at all). */
const BUILT_IN_BACKEND = 'https://gamma-tones-positioning-adjust.trycloudflare.com';

const POINTERS = [
  // The contents API is always fresh; raw.githubusercontent.com may lag a few minutes.
  { url: 'https://api.github.com/repos/piyso/sih-doctor/contents/deploy/live-backend.json?ref=main', headers: { Accept: 'application/vnd.github.raw+json' } },
  { url: 'https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/live-backend.json', headers: {} as Record<string, string> }
];

const isBrowser = typeof window !== 'undefined';

/** Public hosts that serve only the frontend and need a backend elsewhere. */
export const isCloudFrontendHost = (hostname: string): boolean =>
  (hostname.endsWith('.vercel.app') || hostname.includes('onrender.com') || hostname.includes('github.io') || hostname.includes('netlify.app')) && !hostname.includes('backend');

const clean = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const u = url.trim().replace(/\/$/, '');
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) ? u : null;
};

/** The backend address for a cloud-hosted frontend, as far as it is known right now. */
export function knownLiveBackend(): string {
  if (isBrowser) {
    try {
      const stored = clean(sessionStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch { /* storage blocked */ }
  }
  return BUILT_IN_BACKEND;
}

async function readPointer(timeoutMs: number): Promise<string | null> {
  for (const p of POINTERS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(p.url, { headers: p.headers, signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) continue;
      const url = clean((await res.json())?.url);
      if (url) return url;
    } catch { /* try the next source */ } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Called once before the app starts (main.tsx). On a cloud-hosted frontend it reads the pointer:
 * the first load in a tab waits for it (at most ~2.5 s); later loads start at once with the
 * remembered address and reload a single time if the pointer has moved since.
 */
export async function resolveLiveBackend(): Promise<void> {
  if (!isBrowser || !isCloudFrontendHost(window.location.hostname)) return;
  try { if (localStorage.getItem('HOSPITAL_BACKEND_URL')) return; } catch { return; }

  let remembered: string | null = null;
  try { remembered = clean(sessionStorage.getItem(STORAGE_KEY)); } catch { return; }

  const apply = (url: string | null) => {
    if (!url) return false;
    try { sessionStorage.setItem(STORAGE_KEY, url); } catch { return false; }
    return url !== remembered;
  };

  if (!remembered) {
    apply(await readPointer(2500));
    return;
  }
  // Already running on a remembered address: check in the background, reload once if it moved.
  void readPointer(4000).then(url => { if (apply(url)) window.location.reload(); });
}
