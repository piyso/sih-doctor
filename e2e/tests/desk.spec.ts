import { test, expect } from '@playwright/test';
import { API, TAG, apiLogin, checkIn, uiLogin } from '../helpers';

test.describe('Doctor desk', () => {
  test('a STOP alert needs a typed reason, and the reason reaches the pharmacy', async ({ page, request }) => {
    const name = `${TAG}Desk ${Date.now().toString(36)}`;
    await checkIn(request, name, {
      patient: { name, age: 66, gender: 'MALE' },
      history: { conditions: ['Hypertension'], allergies: 'Penicillin', currentMedicines: 'Warfarin 5 mg' }
    });

    await uiLogin(page, 'doctor', 'dr.sharma');
    await page.getByText(name).first().click();
    // The allergy is on screen before any medicine is chosen.
    await expect(page.getByText('ALLERGY: Penicillin').first()).toBeVisible();

    const search = page.getByLabel('Search medicines');
    await search.fill('ibuprofen');
    await search.press('Enter');
    await expect(page.getByText('Warfarin × Ibuprofen').first()).toBeVisible();

    const dx = page.getByLabel('Search diagnosis');
    await dx.fill('Osteoarthritis of knee');
    await dx.press('Enter');

    await page.getByRole('button', { name: 'Review & sign' }).first().click();
    const sign = page.getByTestId('sign-rx');
    await expect(sign).toBeDisabled();
    await page.getByLabel('Reason for Warfarin × Ibuprofen').fill('E2E: 3 days only with a PPI, INR in 3 days');
    await expect(sign).toBeEnabled();
    await sign.click();
    await expect(page.getByText('Sealed and sent to the pharmacy · Record')).toBeVisible();

    // The pharmacist sees the doctor's reason next to the alert it answers.
    const pharm = await apiLogin(request, 'pharma.ravi');
    const q = await request.get(`${API}/doctor/pharmacy-queue`, { headers: { Authorization: `Bearer ${pharm}` } });
    const rx = (await q.json()).data.find((e: any) => e.patientName === name);
    expect(rx, 'signed prescription is in the pharmacy queue').toBeTruthy();
    expect(JSON.stringify(rx)).toContain('E2E: 3 days only with a PPI, INR in 3 days');
  });

  test('an antibiotic cannot be signed without an indication', async ({ page, request }) => {
    const name = `${TAG}Abx ${Date.now().toString(36)}`;
    await checkIn(request, name, { patient: { name, age: 30, gender: 'FEMALE' }, history: { conditions: [], allergies: 'none', currentMedicines: '' } });

    await uiLogin(page, 'doctor', 'dr.sharma');
    await page.getByText(name).first().click();
    const search = page.getByLabel('Search medicines');
    await search.fill('amoxy');
    await search.press('Enter');
    // Plain amoxicillin is the first match, not the clavulanate combination.
    await expect(page.getByText('Amoxicillin', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Amoxicillin + clavulanic acid', { exact: true })).toHaveCount(0);
    const dx = page.getByLabel('Search diagnosis');
    await dx.fill('Acute otitis media');
    await dx.press('Enter');

    await page.getByRole('button', { name: 'Review & sign' }).first().click();
    const sign = page.getByTestId('sign-rx');
    await expect(sign).toBeDisabled();
    await page.getByLabel('Indication for Amoxicillin').fill('Acute otitis media');
    await expect(sign).toBeEnabled();
  });

  test('room recording needs recorded consent; withdrawal is one tap; a child needs a guardian', async ({ page, request }) => {
    const adult = `${TAG}Consent ${Date.now().toString(36)}`;
    const child = `${TAG}Child ${Date.now().toString(36)}`;
    await checkIn(request, adult, { patient: { name: adult, age: 45, gender: 'MALE' } });
    await checkIn(request, child, { patient: { name: child, age: 8, gender: 'FEMALE' } });

    await uiLogin(page, 'doctor', 'dr.sharma');
    await page.getByText(adult).first().click();
    const room = page.getByTestId('scribe-room');
    await expect(room).toContainText('needs the patient’s consent');
    await page.getByTestId('scribe-consent-ask').click();
    const agree = page.getByTestId('scribe-consent-agree');
    await expect(agree).toBeDisabled();
    await page.getByLabel('Others in the room were told').check();
    await expect(agree).toBeEnabled();
    await agree.click();
    await expect(page.getByTestId('scribe-consent-state')).toContainText('Consent for this visit');
    await page.getByTestId('scribe-withdraw').first().click();
    await expect(page.getByTestId('scribe-consent-state')).toContainText('Consent withdrawn');

    await page.getByText(child).first().click();
    await page.getByTestId('scribe-consent-ask').click();
    await expect(page.getByRole('radio', { name: 'The patient' })).toBeDisabled();
    await expect(page.getByText('a parent or guardian answers')).toBeVisible();
  });
});
