import { test, expect } from '@playwright/test';
import { API, TAG, apiLogin, checkIn, consentCare, uiLogin } from '../helpers';

test.describe('Patient journey', () => {
  test('check-in without consent is refused; with consent a unique token is issued', async ({ request }) => {
    const bad = await request.post(`${API}/kiosk/intake`, { data: { patient: { name: `${TAG}NoConsent`, age: 30, gender: 'FEMALE' }, symptoms: [] } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).code).toBe('CONSENT_REQUIRED');

    const a = await checkIn(request, `${TAG}Token A`);
    const b = await checkIn(request, `${TAG}Token B`);
    expect(a.tokenNo).toMatch(/^[A-Z]+-\d{3}$/);
    expect(a.tokenNo).not.toBe(b.tokenNo);
    expect(a.department).toBe(b.department);
  });

  test('emergency words are triaged on the server even without the SOS button', async ({ request }) => {
    const snake = await checkIn(request, `${TAG}Snakebite`, { rawTranscript: 'मुझे साँप ने काट लिया है' });
    expect(snake.triagePriority).toBe('EMERGENCY_RED_FLAG');
    expect(snake.redFlags.join(' ')).toMatch(/snake/i);
    const dog = await checkIn(request, `${TAG}Dogbite`, { rawTranscript: 'I was bitten by a dog' });
    expect(dog.triagePriority).toBe('HIGH_PRIORITY');
    const knee = await checkIn(request, `${TAG}Knee`, { rawTranscript: 'घुटने में दर्द है' });
    expect(knee.triagePriority).toBe('ROUTINE');
  });

  test('kiosk Next stays blocked until treatment consent is given', async ({ page }) => {
    await page.goto('/?mode=kiosk&step=2');
    await page.locator('#kiosk-name').fill(`${TAG}Kiosk`);
    await page.locator('#kiosk-age').fill('40');
    const next = page.locator('nav[aria-label="Kiosk step navigation"] button').last();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('checkbox').first().click();
    await expect(next).toHaveAttribute('aria-disabled', 'false');
  });

  test('doctor calls a token and the waiting-room display shows it', async ({ page, request }) => {
    const visit = await checkIn(request, `${TAG}Display`);
    await page.goto('/?mode=display');
    await expect(page.getByText('OPD Queue')).toBeVisible();
    await page.waitForTimeout(1500); // let the live stream connect
    const doc = await apiLogin(request, 'dr.sharma');
    const call = await request.post(`${API}/queue/call/${visit.sessionId}`, { headers: { Authorization: `Bearer ${doc}` } });
    expect(call.ok()).toBeTruthy();
    await expect(page.getByRole('status').getByText(visit.tokenNo)).toBeVisible({ timeout: 10_000 });
    // The board never shows names.
    await expect(page.getByText(`${TAG}Display`)).toHaveCount(0);
  });

  test('SOS reaches the nurse station and the kiosk sees the acknowledgement', async ({ page, request }) => {
    const sos = await checkIn(request, `${TAG}SOS`, { sosTriggered: true, triageOverride: 'EMERGENCY_RED_FLAG', consent: { ...consentCare, method: 'emergency' } });
    expect(sos.alertId).toBeTruthy();
    expect(sos.status).toBe('DIVERTED_EMERGENCY');

    await uiLogin(page, 'nurse', 'nurse.priya');
    await expect(page.getByText(`${TAG}SOS`).first()).toBeVisible();
    await page.getByRole('button', { name: "I'm going" }).first().click();
    await expect.poll(async () => (await (await request.get(`${API}/kiosk/alert/${sos.alertId}`)).json()).acknowledged).toBe(true);
  });

  test('signed prescription verifies at the pharmacy and dispensing is recorded', async ({ request }) => {
    const visit = await checkIn(request, `${TAG}Rx`);
    const doc = await apiLogin(request, 'dr.sharma');
    const rx = await request.post(`${API}/doctor/prescribe`, {
      headers: { Authorization: `Bearer ${doc}` },
      data: { sessionId: visit.sessionId, allopathicPrescription: [{ name: 'Paracetamol', dosage: '500 mg', frequency: 'BD (Twice daily)', durationDays: 3 }], doctorName: 'Someone Else' }
    });
    const body = await rx.json();
    expect(rx.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.consultationRecord.doctorName).toBe('Dr. Ananya Sharma'); // identity comes from the sign-in, not the request
    expect(body.signature.algorithm).toBe('Ed25519');

    const again = await request.post(`${API}/doctor/prescribe`, { headers: { Authorization: `Bearer ${doc}` }, data: { sessionId: visit.sessionId, advice: 'x' } });
    expect(again.status()).toBe(409);

    const pharm = await apiLogin(request, 'pharma.ravi');
    const v = await request.get(`${API}/admin/verify-encounter/${body.encounterId}`, { headers: { Authorization: `Bearer ${pharm}` } });
    expect((await v.json()).valid).toBe(true);
    const d = await request.post(`${API}/doctor/encounters/${body.encounterId}/dispense`, { headers: { Authorization: `Bearer ${pharm}` }, data: { status: 'DISPENSED' } });
    expect(d.ok()).toBeTruthy();
  });

  test('ASHA sync is per record and flags high-risk pregnancy on the server', async ({ request }) => {
    const asha = await apiLogin(request, 'asha.sunita');
    const id = `v-e2e-${Date.now()}`;
    const now = new Date().toISOString();
    const r = await request.post(`${API}/asha/sync`, {
      headers: { Authorization: `Bearer ${asha}` },
      data: {
        records: [
          { id, version: 1, patientName: `${TAG}ASHA`, age: 17, gender: 'FEMALE', isPregnant: true, hemoglobinGdl: 6.5, bloodPressure: '150/100', village: 'Test', dangerSigns: [], visitAt: now, clientUpdatedAt: now },
          { id: 'bad', patientName: '' }
        ]
      }
    });
    const results = (await r.json()).results;
    expect(results[0].status).toBe('accepted');
    expect(results[0].riskFlags.map((f: any) => f.code)).toEqual(expect.arrayContaining(['hb_severe', 'bp_high', 'age_risk']));
    expect(results[1].status).toBe('rejected');
  });
});
