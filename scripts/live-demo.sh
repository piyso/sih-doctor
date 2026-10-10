#!/usr/bin/env bash
# ==============================================================================
# Hospital OS — put the demonstration backend online and tell the public site.
#
#   scripts/live-demo.sh            start what is missing, publish the address
#   scripts/live-demo.sh --status   only report (changes nothing)
#   scripts/live-demo.sh --no-push  write deploy/live-backend.json but do not push it
#
# What it does:
#   1. makes sure the backend answers on :8001 (starts `npm run dev` in backend/ if not);
#   2. makes sure a Cloudflare quick tunnel points at it (starts one if not) and reads the
#      tunnel's public address from cloudflared itself;
#   3. checks the backend through that public address;
#   4. writes the address to deploy/live-backend.json and pushes that one file, so
#      https://sih-doctor.vercel.app finds the backend at its next page load — no rebuild.
#
# Keep this Mac awake and online while the demonstration runs (the script starts `caffeinate`).
# The Mock / Real switch, the sample patients and the staff accounts all live in this backend.
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8001}"
METRICS="127.0.0.1:20241"
RUN_DIR="$ROOT/.live-demo"
POINTER="$ROOT/deploy/live-backend.json"
SITE="https://sih-doctor.vercel.app"
MODE="${1:-}"

mkdir -p "$RUN_DIR"
say() { printf '%s\n' "$*"; }
ok()  { printf '  [ok]   %s\n' "$*"; }
bad() { printf '  [fail] %s\n' "$*" >&2; }

backend_up() { curl -fsS -m 4 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; }
tunnel_host() { curl -fsS -m 3 "http://$METRICS/quicktunnel" 2>/dev/null | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p'; }

CLOUDFLARED="$(command -v cloudflared || true)"
[ -z "$CLOUDFLARED" ] && [ -x /opt/homebrew/bin/cloudflared ] && CLOUDFLARED=/opt/homebrew/bin/cloudflared
[ -z "$CLOUDFLARED" ] && [ -x /usr/local/bin/cloudflared ] && CLOUDFLARED=/usr/local/bin/cloudflared

say "Hospital OS — live demonstration backend"

# ---- 1. backend ---------------------------------------------------------------
if backend_up; then
  ok "backend answers on :$PORT"
elif [ "$MODE" = "--status" ]; then
  bad "backend is not answering on :$PORT"
else
  say "  starting the backend (log: .live-demo/backend.log)…"
  (cd "$ROOT/backend" && nohup npm run dev >"$RUN_DIR/backend.log" 2>&1 &)
  for _ in $(seq 1 40); do backend_up && break; sleep 1; done
  if backend_up; then ok "backend started on :$PORT"; else bad "backend did not start — see .live-demo/backend.log"; exit 1; fi
fi

# ---- 2. tunnel ----------------------------------------------------------------
HOST="$(tunnel_host || true)"
if [ -n "$HOST" ]; then
  ok "tunnel is up: https://$HOST"
elif [ "$MODE" = "--status" ]; then
  bad "no Cloudflare tunnel is running"
else
  if [ -z "$CLOUDFLARED" ]; then bad "cloudflared is not installed (brew install cloudflared)"; exit 1; fi
  say "  starting a Cloudflare tunnel (log: .live-demo/tunnel.log)…"
  nohup "$CLOUDFLARED" tunnel --url "http://localhost:$PORT" --metrics "$METRICS" >"$RUN_DIR/tunnel.log" 2>&1 &
  for _ in $(seq 1 40); do HOST="$(tunnel_host || true)"; [ -n "$HOST" ] && break; sleep 1; done
  if [ -n "$HOST" ]; then ok "tunnel started: https://$HOST"; else bad "the tunnel did not come up — see .live-demo/tunnel.log"; exit 1; fi
fi

# Keep the Mac awake while the tunnel runs (macOS only; harmless elsewhere).
if [ "$MODE" != "--status" ] && command -v caffeinate >/dev/null 2>&1 && ! pgrep -f "caffeinate -dims" >/dev/null 2>&1; then
  nohup caffeinate -dims >/dev/null 2>&1 &
  ok "keeping this Mac awake (caffeinate)"
fi

# ---- 3. the backend through the public address --------------------------------
URL=""
if [ -n "$HOST" ]; then
  URL="https://$HOST"
  PUBLIC_OK=""
  for _ in $(seq 1 15); do
    if curl -fsS -m 6 "$URL/api/system/mode" >"$RUN_DIR/mode.json" 2>/dev/null; then PUBLIC_OK=1; break; fi
    sleep 2
  done
  if [ -n "$PUBLIC_OK" ]; then
    if grep -q '"demoMode":true' "$RUN_DIR/mode.json"; then ok "reachable from the internet — Mock mode (sample patients)"; else ok "reachable from the internet — Real mode (no mock data)"; fi
    grep -q '"demoToggle":true' "$RUN_DIR/mode.json" || bad "this backend has no Mock / Real switch (DEMO_TOGGLE is off)"
  else
    bad "the backend does not answer through $URL yet"
  fi
fi

# ---- 4. tell the public site --------------------------------------------------
CURRENT="$(sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' "$POINTER" 2>/dev/null || true)"
if [ -z "$URL" ]; then
  say "Nothing to publish."
elif [ "$CURRENT" = "$URL" ]; then
  ok "the site already points at this address"
elif [ "$MODE" = "--status" ]; then
  bad "the site points at $CURRENT but the tunnel is $URL — run scripts/live-demo.sh to publish it"
else
  cat >"$POINTER" <<JSON
{
  "url": "$URL",
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "note": "Backend of the public demonstration site. Written by scripts/live-demo.sh; the site reads it at start-up (frontend/src/services/liveBackend.ts), so a new tunnel address needs no new build."
}
JSON
  ok "wrote deploy/live-backend.json"
  if [ "$MODE" = "--no-push" ]; then
    say "  not pushed (--no-push). Publish with: git add deploy/live-backend.json && git commit -m 'chore(deploy): live backend address' && git push"
  else
    (cd "$ROOT" && git add deploy/live-backend.json && git commit -q -m "chore(deploy): live backend address" -- deploy/live-backend.json && git push -q) \
      && ok "pushed — the site picks it up on the next page load" \
      || bad "could not push deploy/live-backend.json — push it yourself, or use 'Change server' on the sign-in card with $URL"
  fi
fi

say ""
say "Site:    $SITE"
[ -n "$URL" ] && say "Backend: $URL"
say "Switch Mock / Real with the switch at the top right of any screen."
