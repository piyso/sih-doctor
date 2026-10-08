import { test, expect } from '@playwright/test';
import { API, apiLogin, uiLogin, demoPin } from '../helpers';

test.describe('Access control', () => {
  test('patient data needs a signed-in clinician', async ({ request }) => {
    expect((await request.get(`${API}/doctor/queue`)).status()).toBe(401);
    expect((await request.get(`${API}/admin/users`)).status()).toBe(401);
    const pharm = await apiLogin(request, 'pharma.ravi');
    expect((await request.get(`${API}/doctor/queue`, { headers: { Authorization: `Bearer ${pharm}` } })).status()).toBe(403);
    const doc = await apiLogin(request, 'dr.sharma');
    expect((await request.get(`${API}/doctor/queue`, { headers: { Authorization: `Bearer ${doc}` } })).status()).toBe(200);
  });

  test('wrong PIN is refused and does not reveal which usernames exist', async ({ request }) => {
    const a = await request.post(`${API}/auth/login`, { data: { username: 'dr.sharma', pin: '000001' } });
    const b = await request.post(`${API}/auth/login`, { data: { username: 'no.such.user', pin: '000001' } });
    expect(a.status()).toBe(401);
    expect(b.status()).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error);
  });

  test('only doctors and vaidyas can sign prescriptions', async ({ request }) => {
    const nurse = await apiLogin(request, 'nurse.priya');
    const r = await request.post(`${API}/doctor/prescribe`, { headers: { Authorization: `Bearer ${nurse}` }, data: { sessionId: 'x' } });
    expect(r.status()).toBe(403);
  });

  test('audit chain is intact', async ({ request }) => {
    const admin = await apiLogin(request, 'admin');
    const r = await request.get(`${API}/admin/audit/verify`, { headers: { Authorization: `Bearer ${admin}` } });
    expect((await r.json()).data.valid).toBe(true);
  });

  test('staff sign-in screen guards the doctor desk', async ({ page }) => {
    await page.goto('/?mode=doctor');
    await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
    await page.getByLabel('Username').fill('dr.sharma');
    await page.locator('input[type=password]').first().fill('111222');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Username or PIN is not correct.')).toBeVisible();
    await page.locator('input[type=password]').first().fill(demoPin('dr.sharma'));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Dr. Ananya Sharma').first()).toBeVisible();
  });

  test('a pharmacist cannot open the doctor desk', async ({ page }) => {
    await uiLogin(page, 'doctor', 'pharma.ravi');
    await expect(page.getByText('is not available for your role')).toBeVisible();
  });
});
