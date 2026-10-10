# Mock / Real mode (the demonstration switch)

A demonstration server can show the system **with sample data** (Mock) or **exactly as it runs with real patients** (Real). The switch is the two-position control `Mock | Real` at the top right of every screen and on the gateway page; it is also under Administration → System & backups. One click, no PIN, nobody is signed out, nothing is deleted. Every screen on every device follows within seconds.

## What each mode means

| | Mock | Real |
|---|---|---|
| Sample patients | 10 sample visits in the doctor queue, nurse worklist, display board, pharmacy and reports | Hidden everywhere (parked as `DEMO_PARKED`); only patients who really check in appear |
| Kiosk | Sample profiles and a demo OTP | Neither; ABHA shows "not verified" until a real verification |
| Demo endpoints (`/api/doctor/seed`, `/demo-queue`) | Answer | 404 |
| Server not reachable | Built-in **offline sandbox** takes over in that browser tab (doctor desk with stand-in patients; other screens say they need the server) | The screen says the server is not answering. **No stand-in data, ever** |
| Staff sign-in | One tap per demo account | The same — one tap per demo account |

Real mode is honest by construction: mock data is only ever returned inside the offline sandbox (`session.isSandbox`), and the sandbox can only start in Mock mode on a demonstration deployment. A failed request in Real mode fails; it is never replaced by invented data.

## Who can switch

- The switch exists only on a **demonstration server** (`DEMO_TOGGLE`; the default in development). A hospital installation has no switch and shows no badge.
- The server still requires an administrator for `POST /api/system/demo-mode`. On a demonstration server the app sends the demo administrator's approval automatically (those demo credentials ship with the frontend for one-tap sign-in), which is what makes it one click. If that account's PIN was changed on a server, the app asks for an administrator's username and PIN instead.
- Every switch is audited (`system.demo_mode`).
- Demo accounts stay usable in both modes on a demonstration server, so switching to Real never locks anyone out. On a hospital installation with demo data off, demo accounts cannot sign in and their sessions are rejected.

## The public demonstration site

`https://sih-doctor.vercel.app` has no backend of its own. Its backend is this project's backend running on the demonstration machine, published through a Cloudflare quick tunnel whose address changes whenever the tunnel restarts. The site therefore reads the current address at start-up from `deploy/live-backend.json` in the repository (see `frontend/src/services/liveBackend.ts`), so a new address needs **no new build** of the site.

```bash
scripts/live-demo.sh            # start backend + tunnel if needed, publish the address
scripts/live-demo.sh --status   # report only
scripts/live-demo.sh --no-push  # write deploy/live-backend.json, do not push it
```

Keep the demonstration machine awake and online. If the tunnel is down, visitors get Mock mode from the offline sandbox; Real mode tells them the server is not answering.

## Server settings

| Variable | Meaning | Default |
|---|---|---|
| `ALLOW_DEMO_DATA` | Starting mode (true = Mock) | on in development, off in production |
| `DEMO_TOGGLE` | Demonstration server: the switch exists, demo accounts work in both modes, kiosks need no enrolment | on in development, off in production |
| `KIOSK_OPEN` | Fix kiosk enrolment either way | unset |

The last choice is stored in the database (`system_settings.demo_mode`) and survives restarts only while `DEMO_TOGGLE` is on. Hospital deployment (`docker-compose.yml`): `ALLOW_DEMO_DATA=false`, `DEMO_TOGGLE=false`.

## Tests

- `backend/tests/demo_mode.test.ts` (battery 29 of `npm test`): who may switch, Real mode leaves no sample data while staff can still sign in and a real check-in appears alone, switching back restores the ten sample patients, and a hospital installation keeps demo accounts and unenrolled kiosks out.
- `e2e/tests/demo-mode.spec.ts`: one click on the signed-out gateway switches to Real and back.
- `e2e/tests/security.spec.ts`: one-tap sign-in, and username + PIN still enforced.
