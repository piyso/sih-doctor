import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Whether the server runs with demo data (development / demonstrations). Demo-only helpers such as
 * sample patients and the demo OTP are hidden on a real hospital deployment.
 */
let pending: Promise<boolean> | null = null;
let known: boolean | null = null;

export function fetchDemoMode(): Promise<boolean> {
  if (known !== null) return Promise.resolve(known);
  if (!pending) {
    pending = api.getAuthStatus()
      .then(s => (known = !!s.demoMode))
      .catch(() => {
        pending = null;
        return false;
      });
  }
  return pending;
}

export function useDemoMode(): boolean {
  const [demo, setDemo] = useState<boolean>(known ?? false);
  useEffect(() => {
    let alive = true;
    fetchDemoMode().then(v => alive && setDemo(v));
    return () => { alive = false; };
  }, []);
  return demo;
}
