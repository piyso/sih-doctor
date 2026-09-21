#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk - Instant Zero-Cloud Live Tunnel (Cloudflare Edge)
# PS ID 26047 — Ministry of Ayush & MoHFW
# Exposes local Sovereign MediKiosk to a public HTTPS URL with zero cloud servers
# Perfect for Hackathon Jury Evaluation & Live Mobile Testing
# ==============================================================================

set -e

echo "================================================================================"
echo "🛡️  AIIA SOVEREIGN MEDIKIOSK - INSTANT ZERO-CLOUD DEMO TUNNEL"
echo "================================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Check if backend and frontend are running, if not launch them
if ! curl -s http://localhost:8001/health >/dev/null 2>&1; then
  echo "🚀 Starting backend sovereign server..."
  cd backend && npm run build && node dist/index.js &
  BACKEND_PID=$!
  sleep 2
  cd "$ROOT_DIR"
fi

if ! curl -s http://localhost:5173 >/dev/null 2>&1; then
  echo "🚀 Starting frontend Vite server..."
  cd frontend && npm run dev -- --host 0.0.0.0 --port 5173 &
  FRONTEND_PID=$!
  sleep 3
  cd "$ROOT_DIR"
fi

# 2. Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
  echo "📦 Installing cloudflared via Homebrew / curl..."
  if command -v brew &> /dev/null; then
    brew install cloudflare/cloudflare/cloudflared
  else
    curl -L --output cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64
    chmod +x cloudflared
    sudo mv cloudflared /usr/local/bin/
  fi
fi

echo ""
echo "================================================================================"
echo "⚡ GENERATING INSTANT PUBLIC HTTPS TUNNEL..."
echo "================================================================================"
echo "👉 Your local air-gapped sovereign kiosk is now live globally on Cloudflare edge."
echo "👉 Share the URL below with hackathon judges or scan QR code on mobile devices."
echo "================================================================================"
echo ""

cloudflared tunnel --url http://localhost:5173
