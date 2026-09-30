#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk & Hospital OS - Universal Master Deployment Suite
# Department of Public Health & Medical Education | AIIA
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================================"
echo "AIIA SOVEREIGN MEDIKIOSK - UNIVERSAL DEPLOYMENT SUITE"
echo "================================================================================"
echo "Choose your target deployment environment:"
echo ""
echo "  [1] Coolify on Cloud Host (Always Free Tier, 0ms Sleep, $0/mo)"
echo "  [2] Instant Cloudflare Public HTTPS Tunnel (Live Demo)"
echo "  [3] Local Multi-Container Docker Compose (Air-Gapped Hospital Production)"
echo "  [4] Vercel Edge Frontend + Fly.io Persistent Backend (Serverless Split)"
echo "  [5] GitHub Auto-Push & CI/CD Trigger (piyso/sih-doctor)"
echo "  [6] Run Full 22-Battery Clinical Rigor Test Suite"
echo "  [7] Complete Full Production Rebuild (Backend Dist + Frontend Dist)"
echo "================================================================================"

CHOICE="${1:-}"

if [ -z "$CHOICE" ]; then
  read -p "Enter selection [1-7] (Default: 5): " CHOICE
  CHOICE="${CHOICE:-5}"
fi

case "$CHOICE" in
  1)
    echo "[INFO] Deploying to Coolify..."
    echo "1. Run this on your remote host:"
    echo "   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"
    echo "2. Open Coolify Dashboard (http://<HOST-IP>:8000) and import repo 'https://github.com/piyso/sih-doctor'"
    echo "3. Select 'Docker Compose' using 'docker-compose.coolify.yml' and click Deploy!"
    ;;
  2)
    echo "[INFO] Launching Cloudflare Live Tunnel..."
    bash scripts/live_cloud_tunnel.sh
    ;;
  3)
    echo "[INFO] Starting Local Multi-Container Production Docker Compose..."
    docker compose -f docker-compose.yml up --build -d
    echo "[OK] Docker containers running. Access at http://localhost:5173"
    ;;
  4)
    echo "[INFO] Deploying Vercel + Fly.io Stack..."
    cd frontend && npx vercel --prod
    cd "$ROOT_DIR"
    fly deploy
    ;;
  5)
    echo "[INFO] Running GitHub Auto-Push to piyso/sih-doctor..."
    bash scripts/git_autopush_and_deploy.sh "sih-doctor" "feat: production release deployment pipeline verified"
    ;;
  6)
    echo "[INFO] Running 22-Battery Scientific Clinical Rigor Harness..."
    cd backend && npm test
    ;;
  7)
    echo "[INFO] Rebuilding Backend & Frontend Production Bundles..."
    cd backend && npm run build
    cd "$ROOT_DIR/frontend" && npm run build
    echo "[OK] Full production build complete."
    ;;
  *)
    echo "[ERROR] Invalid selection. Please enter 1-7."
    exit 1
    ;;
esac
