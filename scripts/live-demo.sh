#!/usr/bin/env bash
# ==============================================================================
# Hospital OS — run the demonstration backend and keep the public site pointed at it.
#
#   scripts/live-demo.sh                    start what is missing, publish the address
#   scripts/live-demo.sh --status           report only (changes nothing)
#   scripts/live-demo.sh --restart-backend  try the current code on a spare port, then swap it in
#   scripts/live-demo.sh --reset            demo accounts, Mock mode, sample patients, leftovers
#   scripts/live-demo.sh --watch            stay running and heal: backend, tunnel, published address
#   add --no-push to keep deploy/live-backend.json local (start / watch)
#
# The public site (https://sih-doctor.vercel.app) has no backend of its own. Its backend is this
# project's backend on THIS machine, reached through a Cloudflare quick tunnel. The site reads the
# tunnel's address at start-up from deploy/live-backend.json in the repository, so a new address
# needs no new build — only this script, which pushes that one file.
#
# During a demonstration:
#   * the backend runs WITHOUT file-watching (a half-saved file can never restart or break it);
#     new code goes live only through --restart-backend, which first proves it can start;
#   * leave `scripts/live-demo.sh --watch` running in a terminal: it restarts whatever dies;
#   * keep this Mac plugged in, lid open and online (the script starts `caffeinate`).
# ==============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8001}"
SMOKE_PORT="${SMOKE_PORT:-8009}"
METRICS="127.0.0.1:20241"
RUN_DIR="$ROOT/.live-demo"
POINTER="$ROOT/deploy/live-backend.json"
SITE="https://sih-doctor.vercel.app"

MODE="start"
PUSH=1
for arg in "$@"; do
  case "$arg" in
    --status) MODE="status" ;;
    --restart-backend) MODE="restart" ;;
    --reset) MODE="reset" ;;
    --watch) MODE="watch" ;;
    --no-push) PUSH=0 ;;
    --keep-visits) ;; # passed through to the reset
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

mkdir -p "$RUN_DIR"
say() { printf '%s\n' "$*"; }
ok()  { printf '  [ok]   %s\n' "$*"; }
bad() { printf '  [fail] %s\n' "$*" >&2; }
now() { date '+%H:%M:%S'; }

backend_up() { curl -fsS -m 4 "http://127.0.0.1:${1:-$PORT}/health" >/dev/null 2>&1; }
tunnel_host() { curl -fsS -m 3 "http://$METRICS/quicktunnel" 2>/dev/null | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p'; }
listeners() { lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null || true; }

CLOUDFLARED="$(command -v cloudflared || true)"
[ -z "$CLOUDFLARED" ] && [ -x /opt/homebrew/bin/cloudflared ] && CLOUDFLARED=/opt/homebrew/bin/cloudflared
[ -z "$CLOUDFLARED" ] && [ -x /usr/local/bin/cloudflared ] && CLOUDFLARED=/usr/local/bin/cloudflared

# ---- backend ------------------------------------------------------------------
# Started detached and WITHOUT file-watching: saving a source file changes nothing until
# --restart-backend is run.
start_backend() {
  (cd "$ROOT/backend" && PORT="$PORT" nohup npx tsx src/index.ts >>"$RUN_DIR/backend.log" 2>&1 &)
  for _ in $(seq 1 45); do backend_up && return 0; sleep 1; done
  return 1
}

# Stops whatever listens on $PORT, including a `tsx watch` parent that would respawn it.
stop_backend() {
  local pid parent cmd
  for pid in $(listeners "$PORT"); do
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    cmd="$(ps -o command= -p "${parent:-0}" 2>/dev/null || true)"
    case "$cmd" in *tsx*watch*) kill "$parent" 2>/dev/null || true ;; esac
    kill "$pid" 2>/dev/null || true
  done
  for _ in $(seq 1 20); do [ -z "$(listeners "$PORT")" ] && return 0; sleep 0.5; done
  for pid in $(listeners "$PORT"); do kill -9 "$pid" 2>/dev/null || true; done
  sleep 1
}

backend_watches_files() {
  local pid parent
  for pid in $(listeners "$PORT"); do
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    case "$(ps -o command= -p "${parent:-0}" 2>/dev/null || true)" in *tsx*watch*) return 0 ;; esac
  done
  return 1
}

# Proves the code on disk can start, on a spare port with a throw-away database.
smoke_test() {
  local dir="$RUN_DIR/smoke" pid
  rm -rf "$dir"; mkdir -p "$dir"
  for pid in $(listeners "$SMOKE_PORT"); do kill "$pid" 2>/dev/null || true; done
  (cd "$ROOT/backend" && PORT="$SMOKE_PORT" DB_PATH="$dir/hospital.db" DATA_DIR="$dir" BACKUP_HOUR=off nohup npx tsx src/index.ts >"$RUN_DIR/smoke.log" 2>&1 &)
  local up=1
  for _ in $(seq 1 45); do
    if backend_up "$SMOKE_PORT" && curl -fsS -m 4 "http://127.0.0.1:$SMOKE_PORT/api/system/mode" >/dev/null 2>&1; then up=0; break; fi
    sleep 1
  done
  for pid in $(listeners "$SMOKE_PORT"); do kill "$pid" 2>/dev/null || true; done
  rm -rf "$dir"
  return $up
}

# ---- tunnel -------------------------------------------------------------------
start_tunnel() {
  [ -z "$CLOUDFLARED" ] && { bad "cloudflared is not installed (brew install cloudflared)"; return 1; }
  nohup "$CLOUDFLARED" tunnel --url "http://localhost:$PORT" --metrics "$METRICS" >>"$RUN_DIR/tunnel.log" 2>&1 &
  for _ in $(seq 1 45); do [ -n "$(tunnel_host || true)" ] && return 0; sleep 1; done
  return 1
}

public_ok() { curl -fsS -m 6 "$1/api/system/mode" 2>/dev/null; }

# ---- the pointer the public site reads ----------------------------------------
pointer_url() { sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' "$POINTER" 2>/dev/null || true; }

publish() {
  local url="$1"
  [ "$(pointer_url)" = "$url" ] && return 0
  cat >"$POINTER" <<JSON
{
  "url": "$url",
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "note": "Backend of the public demonstration site. Written by scripts/live-demo.sh; the site reads it at start-up (frontend/src/services/liveBackend.ts), so a new tunnel address needs no new build."
}
JSON
  ok "wrote deploy/live-backend.json ($url)"
  if [ "$PUSH" = 1 ]; then
    # Only this one file is committed; other work in the tree is left alone.
    if (cd "$ROOT" && git add deploy/live-backend.json && git commit -q -m "chore(deploy): live backend address" -- deploy/live-backend.json && git push -q); then
      ok "pushed — the site uses it from the next page load"
    else
      bad "could not push deploy/live-backend.json. Push it yourself, or on the site use 'Change server' with $url"
    fi
  else
    say "         not pushed (--no-push)"
  fi
}

keep_awake() {
  command -v caffeinate >/dev/null 2>&1 || return 0
  pgrep -f "caffeinate -dims" >/dev/null 2>&1 && return 0
  nohup caffeinate -dims >/dev/null 2>&1 &
  ok "keeping this Mac awake (caffeinate)"
}

report() {
  local host url mode
  if backend_up; then
    if backend_watches_files; then ok "backend answers on :$PORT — WITH file-watching (a saved file restarts it; use --restart-backend to freeze it)"
    else ok "backend answers on :$PORT — frozen (no file-watching)"; fi
  else bad "backend is not answering on :$PORT"; fi
  host="$(tunnel_host || true)"
  if [ -n "$host" ]; then
    url="https://$host"
    ok "tunnel is up: $url"
    mode="$(public_ok "$url" || true)"
    if [ -n "$mode" ]; then
      case "$mode" in *'"demoMode":true'*) ok "reachable from the internet — Mock mode (sample patients)" ;; *) ok "reachable from the internet — Real mode (no mock data)" ;; esac
      case "$mode" in *'"demoToggle":true'*) ;; *) bad "this backend has no Mock / Real switch (DEMO_TOGGLE is off)" ;; esac
    else bad "the backend does not answer through $url"; fi
    if [ "$(pointer_url)" = "$url" ]; then ok "the site points at this address"; else bad "the site points at $(pointer_url) — run scripts/live-demo.sh to publish $url"; fi
  else bad "no Cloudflare tunnel is running"; fi
}

# ==============================================================================
say "Hospital OS — live demonstration backend"

case "$MODE" in
  status)
    report
    ;;

  reset)
    backend_up || { bad "backend is not answering on :$PORT — start it first (scripts/live-demo.sh)"; exit 1; }
    passthru=()
    for arg in "$@"; do [ "$arg" = "--keep-visits" ] && passthru+=("--keep-visits"); done
    (cd "$ROOT/backend" && PORT="$PORT" npx tsx scripts/reset-demo.ts ${passthru[@]+"${passthru[@]}"})
    ;;

  restart)
    say "  trying the code on disk on port $SMOKE_PORT (throw-away database)…"
    if smoke_test; then
      ok "the code starts and answers"
    else
      bad "the code on disk does not start — the running backend was NOT touched. See .live-demo/smoke.log"
      tail -n 12 "$RUN_DIR/smoke.log" 2>/dev/null | sed 's/^/         /' >&2
      exit 1
    fi
    stop_backend
    if start_backend; then ok "backend restarted on :$PORT — frozen (no file-watching), log: .live-demo/backend.log"
    else bad "backend did not come back — see .live-demo/backend.log"; exit 1; fi
    report
    ;;

  start)
    if backend_up; then
      if backend_watches_files; then ok "backend answers on :$PORT (file-watching; --restart-backend freezes it)"; else ok "backend answers on :$PORT (frozen)"; fi
    else
      say "  starting the backend…"
      if start_backend; then ok "backend started on :$PORT (frozen, log: .live-demo/backend.log)"; else bad "backend did not start — see .live-demo/backend.log"; exit 1; fi
    fi
    HOST="$(tunnel_host || true)"
    if [ -z "$HOST" ]; then
      say "  starting a Cloudflare tunnel…"
      start_tunnel || { bad "the tunnel did not come up — see .live-demo/tunnel.log"; exit 1; }
      HOST="$(tunnel_host)"
    fi
    ok "tunnel: https://$HOST"
    keep_awake
    for _ in $(seq 1 15); do public_ok "https://$HOST" >/dev/null && break; sleep 2; done
    if public_ok "https://$HOST" >/dev/null; then ok "reachable from the internet"; publish "https://$HOST"; else bad "the backend does not answer through https://$HOST yet — run this again in a moment"; fi
    ;;

  watch)
    keep_awake
    say "  watching every 10 s — Ctrl+C to stop. Only changes are printed."
    last=""
    while true; do
      state="ok"
      if ! backend_up; then
        sleep 3
        if ! backend_up; then
          say "  $(now) backend is down — starting it"
          [ -n "$(listeners "$PORT")" ] && stop_backend
          if start_backend; then say "  $(now) backend is back"; else say "  $(now) backend did NOT start — see .live-demo/backend.log"; state="backend down"; fi
        fi
      fi
      HOST="$(tunnel_host || true)"
      if [ -z "$HOST" ]; then
        say "  $(now) tunnel is down — starting a new one"
        if start_tunnel; then HOST="$(tunnel_host)"; say "  $(now) new tunnel: https://$HOST"; else say "  $(now) tunnel did NOT start — see .live-demo/tunnel.log"; state="tunnel down"; fi
      fi
      if [ -n "$HOST" ] && [ "$(pointer_url)" != "https://$HOST" ] && public_ok "https://$HOST" >/dev/null; then
        say "  $(now) publishing the new address"
        publish "https://$HOST"
      fi
      if [ "$state" != "$last" ]; then say "  $(now) state: $state"; last="$state"; fi
      sleep 10
    done
    ;;
esac

say ""
say "Site:    $SITE"
HOST_NOW="$(tunnel_host || true)"
[ -n "$HOST_NOW" ] && say "Backend: https://$HOST_NOW"
say "Switch Mock / Real with the switch at the top right of any screen."
