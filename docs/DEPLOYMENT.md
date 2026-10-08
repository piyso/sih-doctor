# Deploying Hospital OS in a hospital

This guide installs the system on one server. For real patients, use an on-premise box; for a pilot or demo, an India-region cloud VM.

## 1. Server

| Where | When | Why |
|---|---|---|
| **On-premise box** (recommended for a hospital) — a small PC with 4+ cores, 16 GB RAM, SSD, on a UPS, on the hospital LAN | Live use with patients | Kiosks keep working when the internet is down; patient data stays in the hospital (DPDP); Hindi + English speech recognition runs on its CPU. |
| **India-region cloud VM** — e.g. an ARM VM (4 cores / 24 GB) in Mumbai or Hyderabad; `deploy/oracle-setup.sh` sets one up | Pilot, demo, multi-site dashboard | Persistent disk, data stays in India, enough RAM for the speech models. Check whether your client requires a MeitY-empanelled provider. |
| ~~Free PaaS tiers (e.g. Render free)~~ | Never with patient data | The disk is wiped on every restart (the SQLite database and signing keys are lost), the service sleeps after inactivity, and the region may be outside India. |

- Linux (Ubuntu 22.04+), Docker and Docker Compose.
- A fixed LAN IP and a name, e.g. `hospital.local`, through the hospital DNS or the router.
- **One close-talk microphone per kiosk** (USB gooseneck or telephone-style handset, ₹1–3k). In our tests the room's noise and echo mattered more than any model choice: an echoing hall cut the right-symptom rate from 35/40 to 15/40.

## 2. Install

```bash
cp .env.example .env        # then edit: SETUP_CODE, HOSPITAL_HOSTNAME, HOSPITAL_SHORT_NAME, EDGE_AI_TOKEN
docker compose --profile https up -d --build
```

Open `https://hospital.local`. The first staff sign-in screen asks to create the administrator. It needs `SETUP_CODE` from `.env`.

### HTTPS on the LAN

Browsers allow the camera (document scanner), the microphone (voice input) and offline mode only on HTTPS. The `https` profile runs Caddy with its own certificate authority. To install that authority on each kiosk and PC once:

```bash
docker compose cp https:/data/caddy/pki/authorities/local/root.crt ./hospital-root.crt
```

Then import `hospital-root.crt` as a trusted root on each device (Windows: certmgr › Trusted Root; Android: Settings › Security › Install certificate). With a public domain, remove `tls internal` from `deploy/Caddyfile` and Caddy gets a Let's Encrypt certificate automatically.

## 3. First day setup (administrator)

1. Sign in at **Administration** and choose your own PIN.
2. **Staff**: add every doctor (with NMC/state council registration), vaidya (NCISM/state board registration), nurse, pharmacist, ASHA and reception user. Each person sets their own PIN at first sign-in.
3. **Kiosks & screens**: on each kiosk PC, sign in as admin, press **Enrol this device** and set its thermal printer (`IP:9100`). Then start it in kiosk mode:
   - Linux/macOS: `scripts/start-kiosk-browser.sh https://hospital.local`
   - Windows: `scripts\start-kiosk-browser.bat https://hospital.local`
   - Waiting-room TV: add `display`.
4. Put the nurse-station PC on **Nurse Station** with sound on, and allow notifications.
5. Check **System & backups**: demo data must be *off*, kiosk enrolment *required*, audit chain *intact*.

## 4. Backups (do not skip)

- A nightly encrypted backup is written to `./backups` (02:00, keeps 14).
- Copy `./backups` **and** the key folder off the server every day (USB drive kept in another room, or another server). The data volume holds the keys under `keys/`:
  ```bash
  docker compose cp backend:/app/data/keys ./keys-backup
  ```
  Without the keys, backups cannot be decrypted and prescriptions cannot be verified.
- Test a restore every month:
  ```bash
  docker compose exec backend node -e "require('./dist/services/backup.service').decryptBackup('/app/backups/<file>.db.enc','/tmp/restore-test.db')"
  ```

## 5. Optional services

| Service | How | Notes |
|---|---|---|
| SMS (token, medicines ready, follow-up) | `SMS_PROVIDER=msg91` plus `MSG91_*` template ids | Templates must be DLT-registered with the telecom operator. Patients opt in at the kiosk. |
| Thermal token printer | Set per kiosk in Administration › Kiosks | Any ESC/POS 80 mm network printer (port 9100). |
| On-premise speech recognition (Hindi + English) | `docker compose --profile ai run --rm edge-ai scripts/fetch_models.sh` once, then `docker compose --profile ai up -d` | CPU only, ~2.5 GB RAM. Without it the kiosk falls back to the browser's speech recognition (audio goes to the browser vendor; set `VITE_ALLOW_CLOUD_SPEECH=false` to forbid). Tapping and typing always work. See `edge-ai/README.md`. |
| ABDM / ABHA | `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET` | From NHA after facility registration; finish the sandbox certification first. |

## 6. Go-live checklist (needs people, not code)

- [ ] **Clinical review**: a physician and a vaidya review the triage rules, the red-flag list and emergency rules (`frontend/src/utils/clinicalLexicon.ts` — run `npm run eval:matcher` in `frontend/` after any change), the interaction table and the high-risk-pregnancy thresholds, and sign off.
- [ ] **Speech check**: record ~30 consenting staff and patients saying common complaints through each kiosk's microphone, put the files in `edge-ai/eval/audio/` and run the speech evaluation. Do not enable voice input on a kiosk whose microphone fails it — tapping still works.
- [ ] **Language review**: a native speaker checks the kiosk text in every enabled language. The Gujarati, Kannada, Malayalam, Punjabi and Odia text was machine-assisted and especially needs checking.
- [ ] **DPDP Act**: name the Data Protection Officer (`GRIEVANCE_OFFICER_*`), display the privacy notice at registration, and set the retention period with the medical records department.
- [ ] **Security audit**: run a VAPT (CERT-In empanelled auditor) before connecting to ABDM or the internet.
- [ ] **Regulatory**: decide with your regulatory adviser whether any feature counts as Software as a Medical Device under the CDSCO Medical Devices Rules. The triage and interaction checks are decision support only; doctors make the decisions.
- [ ] **Drill**: test an SOS from every kiosk and time the nurse response. Test a power cut: the kiosk must resume or restart cleanly.
- [ ] **Training**: 30 minutes per role. Show reception staff how to help patients at the kiosk.
