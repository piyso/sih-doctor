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

export async function uiLogin(page: Page, mode: string, username: string) {
  await page.goto(`/?mode=${mode}`);
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
