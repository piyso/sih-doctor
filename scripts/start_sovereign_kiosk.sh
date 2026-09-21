#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk (PS ID 26047) - One-Command Master Startup Script
# Boots Backend Engine, Frontend Web Terminal & Chromium Kiosk Lock
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║       ALL INDIA INSTITUTE OF AYURVEDA (AIIA) - SOVEREIGN MEDIKIOSK          ║"
echo "║       ONE-COMMAND PRODUCTION LAUNCHER & HARDWARE KIOSK BOOTSTRAP             ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

echo "✓ Node.js $(node -v) detected."

# 2. Check Backend Dependencies & Build
echo "⚡ Starting Backend Sovereign Engine on port 8001..."
cd "$ROOT_DIR/backend"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend packages..."
    npm ci
fi
npm run build
npm start &
BACKEND_PID=$!
echo "✓ Backend running with PID $BACKEND_PID"

# 3. Wait for Backend Healthcheck
echo "⏳ Waiting for SQLite WAL & PiyGraph initialization..."
for i in {1..15}; do
    if curl -s http://localhost:8001/health > /dev/null; then
        echo "✓ Backend is healthy and responding at http://localhost:8001/health"
        break
    fi
    sleep 1
done

# 4. Start Frontend
echo "⚡ Starting Frontend Hospital OS Terminal on port 5173..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend packages..."
    npm ci
fi
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
echo "✓ Frontend running with PID $FRONTEND_PID"

# 5. Optional Physical Chromium Kiosk Lock Launch
if [ "$1" == "--kiosk" ]; then
    echo "🖥️ Launching Fullscreen Hardware Kiosk Lock mode..."
    sleep 3
    if command -v google-chrome &> /dev/null; then
        google-chrome --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 "http://localhost:5173/?mode=kiosk"
    elif command -v chromium-browser &> /dev/null; then
        chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 "http://localhost:5173/?mode=kiosk"
    elif [ "$(uname)" == "Darwin" ]; then
        open -a "Google Chrome" --args --kiosk "http://localhost:5173/?mode=kiosk"
    fi
fi

echo ""
echo "┌────────────────────────────────────────────────────────────────────────┐"
echo "│                      MEDIKIOSK LAUNCHED SUCCESSFULLY                   │"
echo "├────────────────────────────────────────────────────────────────────────┤"
echo "│ • Hospital OS Gateway: http://localhost:5173                          │"
echo "│ • Patient Kiosk:       http://localhost:5173/?mode=kiosk              │"
echo "│ • Doctor Consultation: http://localhost:5173/?mode=doctor             │"
echo "│ • Pharmacy Dispensing: http://localhost:5173/?mode=pharmacy           │"
echo "│ • ASHA Field Worker:   http://localhost:5173/?mode=asha               │"
echo "│ • Command Center NOC:  http://localhost:5173/?mode=admin              │"
echo "│ • Backend REST & WS:   http://localhost:8001 (ws://localhost:8001/ws) │"
echo "└────────────────────────────────────────────────────────────────────────┘"
echo "Press Ctrl+C to terminate all services."

# Trap exit signals to cleanup children
cleanup() {
    echo "🛑 Shutting down Sovereign MediKiosk processes..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT
wait
