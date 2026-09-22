#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign Hospital OS - 1-Command Vercel Frontend Edge Deployment
# PS ID 26047 — Ministry of Ayush & MoHFW
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================================"
echo "⚡ DEPLOYING AIIA HOSPITAL OS FRONTEND TO VERCEL EDGE (MUMBAI/DELHI CDN)"
echo "================================================================================"
echo ""

# 1. Build frontend locally first to verify zero errors
echo "📦 [1/2] Verifying frontend production build..."
(cd frontend && npm run build)

# 2. Deploy to Vercel
echo ""
echo "🚀 [2/2] Launching Vercel Production Deployment..."
echo "👉 If this is your first time, it will prompt you once to log in with GitHub."
echo ""

cd "$ROOT_DIR/frontend"
npx -y vercel@latest --prod

echo ""
echo "================================================================================"
echo "✅ DEPLOYMENT COMPLETE! YOUR 24/7 LIVE LINK IS DISPLAYED ABOVE."
echo "================================================================================"
