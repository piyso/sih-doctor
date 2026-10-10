# Mock / Real mode (the demonstration switch)

A demonstration server can show the system **with sample data** (Mock) or **exactly as it runs with real patients** (Real). The switch is the two-position control `Mock | Real` at the top right of every screen and on the gateway page; it is also under Administration → System & backups. One click, no PIN, nobody is signed out, nothing is deleted. Every screen on every device follows within seconds.

## What each mode means

| | Mock | Real |
|---|---|---|
| Sample patients | 10 sample visits in the doctor queue, nurse worklist, display board, pharmacy and reports | Hidden everywhere; only patients who check in while the server is in Real mode appear |
| What is created | A check-in, prescription, SOS alert or ASHA visit made now is **sample data** too | A check-in made now is a real record; it is kept and shown in both modes |
| Kiosk | Sample profiles, a demo OTP, sample documents and the phone-upload walk-through | None of these; ABHA shows "not verified" until a real verification |
| Similar past cases | This hospital's cases plus the synthetic reference cases (labelled) | This hospital's real cases only; an honest empty list until doctors have signed some |
| Demo endpoints (`/api/doctor/seed`, `/demo-queue`) | Answer | 404 |
| Server not reachable | Built-in **offline sandbox** takes over in that browser tab (doctor desk with stand-in patients; other screens say they need the server) | The screen says the server is not answering. **No stand-in data, ever** |
| Staff sign-in | One tap per demo account | The same — one tap per demo account |

Real mode is honest by construction: mock data is only ever returned inside the offline sandbox (`session.isSandbox`), and the sandbox can only start in Mock mode on a demonstration deployment. A failed request in Real mode fails; it is never replaced by invented data.

## What counts as sample data, and how Real mode keeps it out

A patient is a **sample record** when the demo seed loaded it or when it was created while the server was in Mock mode (`patients.is_demo = 1`). Visits (`sessions.is_demo`, set by a database trigger from the patient), prescriptions, documents, SOS alerts (`alerts.is_demo`) and ASHA visits (`field_visits.is_demo`) belong to the world of their patient. The rule lives in `backend/src/services/sampleData.ts`:

1. **Lists and reports leave sample rows out.** On the switch to Real every sample visit — waiting, in consultation, signed, dispensed, closed — gets the status `DEMO_PARKED` (its own status waits in `sessions.parked_status` and comes back with Mock mode). Queries that do not go through a visit status use `realOnly(<patient id column>)`: the doctor's favourite medicines, prescribing quality, alert outcomes, the weekly IHIP return, medicine-safety and follow-up figures, ADR and notifiable lists, patient search, SMS log, ABDM consents and counts, follow-up reminders, the similar-case index.
2. **A request that names a sample record gets 404** (`hideSampleRecords`, code `SAMPLE_HIDDEN`), before it reaches any route: by path, query or body id. A doctor desk left open from Mock mode can neither keep showing a sample patient nor save vitals, call, send to emergency, draft or sign for one.
3. **The two worlds never share a patient.** A check-in only matches patients of the current mode. An ABHA number is unique: a real person takes it over from a sample record; a sample check-in never takes a real patient's number. An unfinished kiosk check-in can only be resumed in the mode it was started in.
4. **Screens start afresh on a switch.** The open screen is reloaded when the mode changes (`App.tsx`), and every device follows at once through the event stream (`system.mode`), so nothing loaded in Mock mode stays on screen. The ASHA app keeps Real-mode visits in a store of their own on the device.

Existing databases are sorted once (schema step 10): on a demonstration server the audit trail holds every switch, so a patient who was created or checked in during a Real-mode period stays real and everything else becomes sample data.

Not hidden, on purpose: the **audit trail** (it is the record of what was done on this server, in either mode, and shows ids only) and the **demo staff accounts** (they are how a demonstration server is used in both modes).

## Who can switch

- The switch exists only on a **demonstration server** (`DEMO_TOGGLE`; the default in development). A hospital installation has no switch and shows no badge.
- The server still requires an administrator for `POST /api/system/demo-mode`. On a demonstration server the app sends the demo administrator's approval automatically (those demo credentials ship with the frontend for one-tap sign-in), which is what makes it one click. If that account's PIN was changed on a server, the app asks for an administrator's username and PIN instead.
- Every switch is audited (`system.demo_mode`).
- Demo accounts stay usable in both modes on a demonstration server, so switching to Real never locks anyone out. On a hospital installation with demo data off, demo accounts cannot sign in and their sessions are rejected.

## The public demonstration site

`https://sih-doctor.vercel.app` has no backend of its own. Its backend is this project's backend running on the demonstration machine, published through a Cloudflare quick tunnel whose address changes whenever the tunnel restarts. The site therefore reads the current address at start-up from `deploy/live-backend.json` in the repository (see `frontend/src/services/liveBackend.ts`), so a new address needs **no new build** of the site.

```bash
scripts/live-demo.sh                    # start what is missing (backend, tunnel, keep-awake), publish the address
scripts/live-demo.sh --status           # report only
scripts/live-demo.sh --watch            # stay running: restart a dead backend or tunnel, republish the address
scripts/live-demo.sh --restart-backend  # prove the code on disk starts (spare port, throw-away DB), then swap it in
scripts/live-demo.sh --reset            # demo accounts, Mock mode, ten sample patients, leftover visits, SOS alerts
```

- The demonstration backend runs **without file-watching** and in its own session: saving a source file, or closing the terminal that started it, does not touch it. New backend code goes live only through `--restart-backend`.
- `--reset` works even if a visitor changed a demo PIN or deactivated a demo account, because it restores the accounts in the database directly; the rest goes through the running server so every screen updates. `--keep-visits` keeps patients who checked in for real.
- Demo accounts are never locked out by wrong PINs on a demonstration server (their PINs are public). Hospital installations lock after five wrong PINs as before.
- If the tunnel is down, visitors get Mock mode from the offline sandbox; Real mode tells them the server is not answering.

### On the day

1. `scripts/live-demo.sh --status` — four `[ok]` lines.
2. `scripts/live-demo.sh --reset` — clean start: Mock mode, ten sample patients, all accounts working.
3. Leave `scripts/live-demo.sh --watch` running in a terminal. Keep the machine plugged in, lid open, online.
4. Present from this machine at `http://localhost:5173` (no internet needed); the public link is for the audience.
5. Nobody edits backend files, restarts servers or runs the end-to-end tests during the demonstration (the e2e switch test flips the shared server for a second).
6. The public link is open: anyone can sign in with one tap and flip Mock / Real. If something looks wrong, run `--reset`.

## Server settings

| Variable | Meaning | Default |
|---|---|---|
| `ALLOW_DEMO_DATA` | Starting mode (true = Mock) | on in development, off in production |
| `DEMO_TOGGLE` | Demonstration server: the switch exists, demo accounts work in both modes, kiosks need no enrolment | on in development, off in production |
| `KIOSK_OPEN` | Fix kiosk enrolment either way | unset |

The last choice is stored in the database (`system_settings.demo_mode`) and survives restarts only while `DEMO_TOGGLE` is on. Hospital deployment (`docker-compose.yml`): `ALLOW_DEMO_DATA=false`, `DEMO_TOGGLE=false`.

## Tests

- `backend/tests/demo_mode.test.ts` (battery 29 of `npm test`, 34 checks): who may switch, Real mode leaves no sample data while staff can still sign in and a real check-in appears alone, switching back restores the ten sample patients, demo accounts never lock on a demonstration server, a hospital installation locks them and keeps unenrolled kiosks out, and a reset undoes tampering.
- `backend/tests/real_mode_sample_data.test.ts` (battery 31, 82 checks): after an ordinary Mock-mode demonstration (a sample visit signed and dispensed, one called, an SOS, a kiosk and a family check-in, an ASHA visit) every list, board and report in Real mode is searched for sample names, ids, ABHA numbers and tokens; every by-id read and every write to a sample record is refused; the two worlds do not share a patient; switching back restores everything.
- `e2e/tests/demo-mode.spec.ts`: one click on the signed-out gateway switches to Real and back; a doctor desk left open on a sample patient shows no sample data once the server is switched to Real from elsewhere.
- `e2e/tests/security.spec.ts`: one-tap sign-in, and username + PIN still enforced.
