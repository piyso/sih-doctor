#!/usr/bin/env bash
# ==============================================================================
# ALL INDIA INSTITUTE OF AYURVEDA (AIIA) - SOVEREIGN HOSPITAL OS
# Problem Statement ID: 26047 | Ministry of Ayush & MoHFW
# Universal 1-Click Startup Launcher (macOS, Linux, WSL)
# ==============================================================================

set -e

# Color definitions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
GOLD='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear 2>/dev/null || true

echo -e "${GOLD}"
echo "  ╔══════════════════════════════════════════════════════════════════════════════╗"
echo "  ║      🏛️  ALL INDIA INSTITUTE OF AYURVEDA (AIIA) · SOVEREIGN HOSPITAL OS       ║"
echo "  ║            SMART INDIA HACKATHON 2026 · PROBLEM STATEMENT ID: 26047          ║"
echo "  ╚══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Detect System Architecture & Node.js
echo -e "${CYAN}▶ [1/4] Checking System Environment...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed.${NC}"
    echo "Please install Node.js (version 20+ recommended) from https://nodejs.org/"
    exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "  ${GREEN}✓${NC} Node.js Runtime: ${BOLD}$NODE_VER${NC}"
echo -e "  ${GREEN}✓${NC} NPM Package Mgr: ${BOLD}$NPM_VER${NC}"
echo -e "  ${GREEN}✓${NC} Operating System: ${BOLD}$(uname -s) ($(uname -m))${NC}"

# 2. Detect Local Network IP for Multi-Device Demonstration (Phone / Laptop)
echo -e "\n${CYAN}▶ [2/4] Detecting Local Network Interfaces...${NC}"
LAN_IP="127.0.0.1"
if command -v ifconfig &> /dev/null; then
    LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
elif command -v ip &> /dev/null; then
    LAN_IP=$(ip route get 1.1.1.1 | awk '{print $7}' | head -n 1)
elif command -v hostname &> /dev/null; then
    LAN_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LAN_IP" ]; then
    LAN_IP="127.0.0.1"
fi
echo -e "  ${GREEN}✓${NC} Localhost: ${BOLD}http://localhost:5173${NC}"
echo -e "  ${GREEN}✓${NC} Mobile Wi-Fi Access: ${BOLD}${GOLD}http://${LAN_IP}:5173${NC}"

# 3. Check & Install Dependencies
echo -e "\n${CYAN}▶ [3/4] Verifying Package Dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "  ${DIM}Installing root dependencies...${NC}"
    npm install --silent
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "  ${DIM}Installing backend engine packages...${NC}"
    (cd backend && npm install --silent)
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "  ${DIM}Installing frontend hospital OS packages...${NC}"
    (cd frontend && npm install --silent)
fi
echo -e "  ${GREEN}✓${NC} All dependencies validated."

# 4. Clean stale ports if necessary
echo -e "\n${CYAN}▶ [4/4] Allocating High-Speed Ports (8001, 5173)...${NC}"
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${DIM}Freeing backend port 8001...${NC}"
    lsof -Pi :8001 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
fi
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${DIM}Freeing frontend port 5173...${NC}"
    lsof -Pi :5173 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
fi
echo -e "  ${GREEN}✓${NC} Ports ready."

# 5. Launch Services
echo -e "\n${GOLD}══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  🚀 HOSPITAL OS IS READY FOR DEMONSTRATION!${NC}"
echo -e "${GOLD}══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}🖥️  OPEN ANY OF THESE URLS IN YOUR BROWSER / PHONE:${NC}"
echo -e "  ────────────────────────────────────────────────────────────────────────────"
echo -e "  ${BOLD}1. Hospital OS Gateway:${NC}        ${GREEN}http://localhost:5173/${NC}"
echo -e "  ${BOLD}2. Patient Touch MediKiosk:${NC}    ${GREEN}http://localhost:5173/?mode=kiosk${NC}"
echo -e "  ${BOLD}3. Doctor Clinical Cockpit:${NC}    ${GREEN}http://localhost:5173/?mode=doctor${NC}"
echo -e "  ${BOLD}4. Dispensary Pharmacy POS:${NC}    ${GREEN}http://localhost:5173/?mode=pharmacy${NC}"
echo -e "  ${BOLD}5. Frontline ASHA Field App:${NC}   ${GREEN}http://localhost:5173/?mode=asha${NC}"
echo -e "  ${BOLD}6. Command & Outbreak NOC:${NC}     ${GREEN}http://localhost:5173/?mode=admin${NC}"
echo -e "  ${BOLD}7. System Defense Matrix:${NC}      ${GREEN}http://localhost:5173/?mode=matrix${NC}"
echo -e "  ────────────────────────────────────────────────────────────────────────────"
echo -e "  ${BOLD}📱 Phone / Tablet Access on Wi-Fi:${NC}  ${GOLD}http://${LAN_IP}:5173/${NC}"
echo -e "  ────────────────────────────────────────────────────────────────────────────"
echo -e "  ${DIM}Press Ctrl+C at any time to cleanly stop all hospital OS services.${NC}"
echo ""

# Start concurrent servers
npx concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "cyan.bold,green.bold" \
  --kill-others \
  "npm run dev --prefix backend" \
  "npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173"
