# Demonstration mode (demo ↔ live switch)

The same server can show the system **with sample data** (demo mode) or **exactly as a hospital runs it** (live mode). An administrator switches it while the server runs; every screen follows within ~30 seconds (at once in the browser that switched).

## What changes

| | Demo mode | Live mode |
|---|---|---|
| Sample patients | 10 demo visits in the doctor queue, nurse worklist, display board, pharmacy, reports | Parked out of every queue and report (status `DEMO_PARKED`; nothing is deleted) |
| Demo staff accounts (`backend/src/db/demoStaff.ts`) | Listed on the sign-in screen, can sign in | Cannot sign in; open sessions stop working |
| Kiosk | Sample profiles + demo OTP; no enrolment needed (unless `KIOSK_OPEN` is set) | ABHA needs real verification; kiosks must be enrolled (Administration → Kiosks & screens) |
| Demo endpoints (`/api/doctor/seed`, `/demo-queue`) | Answer | 404 |

Switching back on re-opens the 10 sample visits and re-enables the demo accounts. Real records are never wiped.

## How to switch

- Click the **Demo mode / Live mode** badge in the top bar (every staff screen) or on the gateway page, or use **Administration → System & backups → Demonstration mode**.
- A signed-in administrator switches directly. Anyone else (e.g. a presenter signed in at the doctor desk) types an administrator's username and PIN as approval; this goes through the normal sign-in checks (rate limit, lockout, audit) and keeps no session.
- **Before the first switch to live mode**, create a real administrator account (Administration → Staff, role Administrator). Switching off is refused while only demo administrators exist, because nobody could sign in afterwards to switch back.
- Every switch is written to the audit trail (`system.demo_mode`) with who approved it.

## Server settings

| Variable | Meaning | Default |
|---|---|---|
| `ALLOW_DEMO_DATA` | Starting mode | on in development, off in production |
| `DEMO_TOGGLE` | Whether the switch exists at all | on in development, off in production |
| `KIOSK_OPEN` | Fix kiosk enrolment either way; unset = open exactly while demo mode is on | unset |

The administrator's choice is stored in the database (`system_settings.demo_mode`) and survives restarts **only while `DEMO_TOGGLE` is on**; with the switch disabled, the environment always wins.

- Public demonstration servers (`render.yaml`, `fly.toml`, `docker-compose.coolify.yml`): `ALLOW_DEMO_DATA=true`, `DEMO_TOGGLE=true`.
- Hospital deployment (`docker-compose.yml` + `.env`): `ALLOW_DEMO_DATA=false`, `DEMO_TOGGLE=false`; the badge is hidden.

## Tests

- `backend/tests/demo_mode.test.ts` (battery 29 in `npm test`): who may switch, lock-out guard, everything closed while off, everything restored when on.
- `e2e/tests/demo-mode.spec.ts`: badge and dialog (read-only; never switches the shared dev server).
