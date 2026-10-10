import { test, expect } from '@playwright/test';
import { API, apiLogin, uiLogin } from '../helpers';

/**
 * The Mock / Real switch of a demonstration server. The round trip below really switches the dev
 * server for about a second and always switches it back to Mock; nothing is deleted by it and
 * nobody is signed out. (The backend battery tests/demo_mode.test.ts covers the rules on a temp DB.)
 */
test.describe('Mock / Real switch', () => {
  test('the server reports its mode publicly', async ({ request }) => {
    const r = await request.get(`${API}/system/mode`);
    expect(r.status()).toBe(200);
    const { data } = await r.json();
    expect(typeof data.demoMode).toBe('boolean');
    expect(data.demoToggle).toBe(true);
  });

  test('one click on the gateway switches to Real and back, without signing in', async ({ page, request }) => {
    const mode = async () => (await (await request.get(`${API}/system/mode`)).json()).data.demoMode as boolean;
    const doctor = await apiLogin(request, 'dr.sharma');
    const sampleInQueue = async () => {
      const q = await (await request.get(`${API}/doctor/queue`, { headers: { Authorization: `Bearer ${doctor}` } })).json();
      return (q.data as Array<{ sessionId: string }>).some(x => /^sess-0\d\d$/.test(x.sessionId));
    };
    await page.goto('/');
    const group = page.getByRole('radiogroup', { name: 'Mock or Real mode' });
    const mock = group.getByRole('radio', { name: 'Mock' });
    const real = group.getByRole('radio', { name: 'Real' });
    await expect(mock).toHaveAttribute('aria-checked', 'true');
    try {
      await real.click();
      await expect(real).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText(/Real mode is on/)).toBeVisible();
      expect(await mode()).toBe(false);
      expect(await sampleInQueue()).toBe(false);
      // The doctor signed in before the switch is still signed in.
      expect((await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${doctor}` } })).status()).toBe(200);
    } finally {
      await mock.click();
      await expect(mock).toHaveAttribute('aria-checked', 'true');
    }
    await expect(page.getByText(/Mock mode is on/)).toBeVisible();
    expect(await mode()).toBe(true);
    expect(await sampleInQueue()).toBe(true);
  });

  test('a doctor desk left open on a sample patient shows no sample data once the server is in Real mode', async ({ page, request }) => {
    const admin = await apiLogin(request, 'admin');
    const switchServer = (on: boolean) => request.post(`${API}/system/demo-mode`, { data: { on }, headers: { Authorization: `Bearer ${admin}` } });
    await uiLogin(page, 'doctor', 'dr.sharma');
    // Mock mode: the first sample patient is open on the desk, with the medicines read from his scanned prescription.
    const main = page.locator('main');
    await expect(main.getByText('Ramesh Kumar').first()).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Mock or Real mode' }).getByRole('radio', { name: 'Mock' })).toHaveAttribute('aria-checked', 'true');
    try {
      // The switch is made somewhere else (another device, another tab): this desk must follow by itself.
      expect((await switchServer(false)).ok()).toBeTruthy();
      await expect(page.getByRole('radiogroup', { name: 'Mock or Real mode' }).getByRole('radio', { name: 'Real' })).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
      await expect(main.getByText('Ramesh Kumar')).toHaveCount(0);
      for (const sample of ['Shanti Devi', 'Lakshmi Ammal', 'Devi Lal Meena', 'from a scanned prescription', 'reference case (synthetic)', '91-4567-8901-2345']) {
        await expect(main.getByText(sample)).toHaveCount(0);
      }
      // Asking the server for the sample visit by id gives nothing either.
      const doctor = await apiLogin(request, 'dr.sharma');
      const byId = await request.get(`${API}/doctor/session/sess-001`, { headers: { Authorization: `Bearer ${doctor}` } });
      expect(byId.status()).toBe(404);
      expect((await byId.json()).code).toBe('SAMPLE_HIDDEN');
    } finally {
      await switchServer(true);
    }
    await expect(page.getByRole('radiogroup', { name: 'Mock or Real mode' }).getByRole('radio', { name: 'Mock' })).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
    await expect(main.getByText('Ramesh Kumar').first()).toBeVisible();
  });

  test('the explanation says what each mode means', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'What Mock and Real mode mean' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mock or Real' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Mock mode', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Real mode', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Mock mode · sample patients from the hospital server/)).toBeVisible();
    // Keyboard: Tab never leaves the dialog, Escape closes it and focus returns to the "i" button.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'What Mock and Real mode mean' })).toBeFocused();
    await expect(page.getByRole('heading', { name: "Choose this computer's role" })).toBeVisible();
  });
});
