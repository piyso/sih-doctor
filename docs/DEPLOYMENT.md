# Deploying Hospital OS in a hospital

This guide installs the system on one on-premise server for a hospital LAN.

## 1. Server

- Linux server (Ubuntu 22.04+) or a small PC: 4+ cores, 8 GB RAM, SSD. Add a GPU or 32 GB RAM to run the on-premise AI models.
- Docker and Docker Compose.
- A fixed LAN IP and a name, e.g. `hospital.local`, through the hospital DNS or the router.

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
| On-premise AI | `docker compose --profile ai up -d` | See `edge-ai/README.md` for models and hardware. Everything works without it. |
| ABDM / ABHA | `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET` | From NHA after facility registration; finish the sandbox certification first. |

## 6. Go-live checklist (needs people, not code)

- [ ] **Clinical review**: a physician and a vaidya review the triage rules, the red-flag list, the interaction table and the high-risk-pregnancy thresholds, and sign off.
- [ ] **Language review**: a native speaker checks the kiosk text in every enabled language. The Gujarati, Kannada, Malayalam, Punjabi and Odia text was machine-assisted and especially needs checking.
- [ ] **DPDP Act**: name the Data Protection Officer (`GRIEVANCE_OFFICER_*`), display the privacy notice at registration, and set the retention period with the medical records department.
- [ ] **Security audit**: run a VAPT (CERT-In empanelled auditor) before connecting to ABDM or the internet.
- [ ] **Regulatory**: decide with your regulatory adviser whether any feature counts as Software as a Medical Device under the CDSCO Medical Devices Rules. The triage and interaction checks are decision support only; doctors make the decisions.
- [ ] **Drill**: test an SOS from every kiosk and time the nurse response. Test a power cut: the kiosk must resume or restart cleanly.
- [ ] **Training**: 30 minutes per role. Show reception staff how to help patients at the kiosk.
