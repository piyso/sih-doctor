import fs from 'fs';
import path from 'path';
import { APIRequestContext, Page, expect } from '@playwright/test';

export const API = process.env.E2E_API_URL || 'http://localhost:8001/api';
export const TAG = 'E2E-';

/** Demo PINs live in the project's seed file; read them from there instead of copying them here. */
export function demoPin(username: string): string {
  const file = fs.readFileSync(path.resolve(__dirname, '../backend/src/db/demoStaff.ts'), 'utf8');
  const m = file.match(new RegExp(`^ \\*\\s+${username.replace('.', '\\.')}\\s+\\S+\\s+(\\d+)`, 'm'));
  if (!m) throw new Error(`No demo PIN for ${username}`);
  return m[1];
}

const tokens = new Map<string, string>();

/** Sign in once per user per run (the server rate-limits sign-ins). */
export async function apiLogin(request: APIRequestContext, username: string): Promise<string> {
  const cached = tokens.get(username);
  if (cached) return cached;
  const r = await request.post(`${API}/auth/login`, { data: { username, pin: demoPin(username) } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const token = (await r.json()).token;
  tokens.set(username, token);
  return token;
}

/** Open the username + PIN form of the sign-in card (it sits behind a button where one-tap accounts are offered). */
export async function openPinForm(page: Page) {
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  const username = page.getByLabel('Username');
  if (!(await username.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Sign in with a username and PIN' }).click();
  }
  await expect(username).toBeVisible();
}

/**
 * Sign in on a screen: with the one-tap account when the screen offers it for this user (a
 * demonstration server does, for the screen's own roles), otherwise with username + PIN.
 */
export async function uiLogin(page: Page, mode: string, username: string) {
  await page.goto(`/?mode=${mode}`);
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  const tile = page.getByTestId(`quick-signin-${username}`);
  // The tiles arrive with the server's answer; give them a moment before falling back to the form.
  const offered = await tile.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
  if (offered) {
    await tile.click();
    return;
  }
  await openPinForm(page);
  await page.getByLabel('Username').fill(username);
  await page.locator('input[type=password]').first().fill(demoPin(username));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

export const consentCare = { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' };

export async function checkIn(request: APIRequestContext, name: string, extra: Record<string, unknown> = {}) {
  const r = await request.post(`${API}/kiosk/intake`, {
    data: {
      patient: { name, age: 44, gender: 'MALE' },
      careStream: 'ALLOPATHY',
      language: 'hi',
      symptoms: [{ name: 'Fever', site: 'General', severityScore: 4 }],
      consent: consentCare,
      ...extra
    }
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
