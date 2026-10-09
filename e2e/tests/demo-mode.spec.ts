import { test, expect } from '@playwright/test';
import { API } from '../helpers';

/**
 * Demonstration-mode badge and dialog. Read-only on purpose: the shared dev server is never
 * switched off here (the backend battery tests/demo_mode.test.ts covers switching on a temp DB),
 * and no wrong PINs are tried (they would count towards the demo admin's lockout).
 */
test.describe('Demonstration mode', () => {
  test('the server reports its mode publicly', async ({ request }) => {
    const r = await request.get(`${API}/system/mode`);
    expect(r.status()).toBe(200);
    const { data } = await r.json();
    expect(typeof data.demoMode).toBe('boolean');
    expect(typeof data.demoToggle).toBe('boolean');
  });

  test('the gateway badge opens the switch, which needs an administrator', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByRole('button', { name: 'Demo mode', exact: true });
    await expect(badge).toBeVisible();
    await badge.click();
    const dialog = page.getByRole('dialog', { name: 'Demonstration mode' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Live mode', { exact: true })).toBeVisible();
    // Not signed in: an administrator's username and PIN are asked for before anything changes.
    await expect(dialog.getByLabel('Administrator username')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Switch to live mode' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: "Choose this computer's role" })).toBeVisible();
  });
});
