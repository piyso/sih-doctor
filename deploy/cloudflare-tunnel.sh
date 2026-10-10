#!/usr/bin/env bash
# ==============================================================================
# Hospital OS — 1-Click Instant Global HTTPS Tunnel (Zero Cloud / Zero Credit Card)
# Uses Cloudflare Quick Tunnels to expose your local backend to the world.
#
# Requirements:
#   - Mac or Linux with internet access
#   - cloudflared (installed via brew install cloudflared or apt/curl)
# ==============================================================================
set -euo pipefail

PORT="${1:-8001}"

echo "================================================================================"
echo "    🏥 Hospital OS — 1-Click Global Public HTTPS Tunnel                         "
echo "================================================================================"
echo "[+] Target Local Service: http://localhost:$PORT"

# Ensure cloudflared is installed
if ! command -v cloudflared >/dev/null 2>&1; then
  if [ -x "/opt/homebrew/bin/cloudflared" ]; then
    CLOUDFLARED="/opt/homebrew/bin/cloudflared"
  elif [ -x "/usr/local/bin/cloudflared" ]; then
    CLOUDFLARED="/usr/local/bin/cloudflared"
  else
    echo "[+] cloudflared not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew install cloudflared
      CLOUDFLARED="/opt/homebrew/bin/cloudflared"
    else
      curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
      chmod +x /usr/local/bin/cloudflared
      CLOUDFLARED="/usr/local/bin/cloudflared"
    fi
  fi
else
  CLOUDFLARED="cloudflared"
fi

echo "[+] Starting Cloudflare Quick Tunnel on port $PORT..."
echo "[+] This gives you an instant, secure, globally distributed public HTTPS URL."
echo "--------------------------------------------------------------------------------"
"$CLOUDFLARED" tunnel --url "http://localhost:$PORT"
