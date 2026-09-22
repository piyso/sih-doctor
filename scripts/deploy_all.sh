#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk & Hospital OS - Universal Master Deployment Suite
# PS ID 26047 — Ministry of Ayush & MoHFW | Team Agastya Sutra
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================================"
echo "🛡️  AIIA SOVEREIGN MEDIKIOSK (PS ID 26047) - UNIVERSAL DEPLOYMENT SUITE"
echo "================================================================================"
echo "Choose your target deployment environment:"
echo ""
echo "  [1] 🏆 Coolify on Oracle Cloud Always Free (SOTA 24GB RAM, 0ms Sleep, $0/mo)"
echo "  [2] ⚡ Instant Cloudflare Public HTTPS Tunnel (Live Demo for SIH Jury)"
echo "  [3] 🐳 Local Multi-Container Docker Compose (Air-Gapped Hospital Production)"
echo "  [4] 🌐 Vercel Edge Frontend + Fly.io Persistent Backend (Serverless Split)"
echo "  [5] 🚀 GitHub Auto-Push & CI/CD Trigger (piyso/sih-doctor)"
echo "  [6] 🔬 Run Full 22-Battery Clinical Rigor Test Suite"
echo "  [7] 📦 Complete Full Production Rebuild (Backend Dist + Frontend Dist)"
echo "================================================================================"

CHOICE="${1:-}"

if [ -z "$CHOICE" ]; then
  read -p "Enter selection [1-7] (Default: 5): " CHOICE
  CHOICE="${CHOICE:-5}"
fi

case "$CHOICE" in
  1)
    echo "📦 Deploying to Coolify..."
    echo "1. Run this on your remote VPS (Oracle Cloud Always Free):"
    echo "   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"
    echo "2. Open Coolify Dashboard (http://<VPS-IP>:8000) and import repo 'https://github.com/piyso/sih-doctor'"
    echo "3. Select 'Docker Compose' using 'docker-compose.coolify.yml' and click Deploy!"
    ;;
  2)
    echo "⚡ Launching 1-Command Cloudflare Live Tunnel..."
    bash scripts/live_cloud_tunnel.sh
    ;;
  3)
    echo "🐳 Starting Local Multi-Container Production Docker Compose..."
    docker compose -f docker-compose.yml up --build -d
    echo "✅ Docker containers running! Access at http://localhost:5173"
    ;;
  4)
    echo "🌐 Deploying Vercel + Fly.io Stack..."
    cd frontend && npx vercel --prod
    cd "$ROOT_DIR"
    fly deploy
    ;;
  5)
    echo "🚀 Running GitHub Auto-Push to piyso/sih-doctor..."
    bash scripts/git_autopush_and_deploy.sh "sih-doctor" "feat: production release deployment pipeline verified"
    ;;
  6)
    echo "🔬 Running 22-Battery Scientific Clinical Rigor Harness..."
    cd backend && npm test
    ;;
  7)
    echo "📦 Rebuilding Backend & Frontend Production Bundles..."
    cd backend && npm run build
    cd "$ROOT_DIR/frontend" && npm run build
    echo "✅ Full production build complete!"
    ;;
  *)
    echo "❌ Invalid selection. Please enter 1-7."
    exit 1
    ;;
esac
