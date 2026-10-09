/**
 * ABDM (Ayushman Bharat Digital Mission) gateway client.
 *
 * Needs credentials issued by NHA after registering the facility on the ABDM sandbox
 * (https://sandbox.abdm.gov.in): ABDM_CLIENT_ID, ABDM_CLIENT_SECRET, and the base URLs below.
 * Until those are set, ABHA numbers are only format-checked and every response says so plainly.
 *
 * NOTE: ABDM API paths and payloads are versioned by NHA. Verify each call against the current
 * sandbox documentation and complete NHA's integration test before going live.
 */

import crypto from 'crypto';

const GATEWAY = (process.env.ABDM_GATEWAY_URL || 'https://dev.abdm.gov.in/gateway').replace(/\/$/, '');
const ABHA_BASE = (process.env.ABDM_ABHA_URL || 'https://abhasbx.abdm.gov.in/abha/api').replace(/\/$/, '');
const CLIENT_ID = process.env.ABDM_CLIENT_ID || '';
const CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET || '';

let token: { value: string; expires: number } | null = null;

export const AbdmClient = {
  isConfigured: !!(CLIENT_ID && CLIENT_SECRET),
  mode: CLIENT_ID && CLIENT_SECRET ? (GATEWAY.includes('dev.') || ABHA_BASE.includes('sbx') ? 'SANDBOX' : 'LIVE') : 'NOT_CONFIGURED',

  async sessionToken(): Promise<string> {
    if (!this.isConfigured) throw new Error('ABDM is not configured');
    if (token && token.expires > Date.now() + 30_000) return token.value;
    const r = await fetch(`${GATEWAY}/v0.5/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!r.ok) throw new Error(`ABDM session failed (${r.status})`);
    const body: any = await r.json();
    token = { value: body.accessToken, expires: Date.now() + (Number(body.expiresIn) || 600) * 1000 };
    return token.value;
  },

  /** Authenticated POST to the gateway (used by the HIP layer). */
  async gatewayPost(path: string, body: unknown): Promise<any> {
    const t = await this.sessionToken();
    const r = await fetch(`${GATEWAY}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, 'X-CM-ID': process.env.ABDM_CM_ID || 'sbx' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    if (!r.ok) throw new Error(`ABDM ${path} failed (${r.status})`);
    return r.status === 202 ? { accepted: true } : r.json().catch(() => ({}));
  },

  /** Look up an ABHA number. Returns null when the number is not found. */
  async searchAbha(abhaNumber: string): Promise<{ status: string; name?: string; abhaAddress?: string[] } | null> {
    const t = await this.sessionToken();
    const r = await fetch(`${ABHA_BASE}/v3/profile/account/abha/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        'REQUEST-ID': crypto.randomUUID(),
        TIMESTAMP: new Date().toISOString()
      },
      body: JSON.stringify({ scope: ['search-abha'], abhaNumber }),
      signal: AbortSignal.timeout(10_000)
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`ABHA search failed (${r.status})`);
    const body: any = await r.json();
    const acct = Array.isArray(body) ? body[0] : body;
    return acct ? { status: acct.status || 'UNKNOWN', name: acct.name, abhaAddress: acct.preferredAbhaAddress ? [acct.preferredAbhaAddress] : acct.abhaAddress } : null;
  }
};
