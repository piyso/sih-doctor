#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk - Coolify 1-Command Server Setup & Deployment Script
# Ministry of Ayush & MoHFW, Government of India
# Tested on: Oracle Cloud Always Free (ARM Ampere A1), Ubuntu 22.04/24.04, Debian 12
# ==============================================================================

set -e

echo "================================================================================"
echo "AIIA SOVEREIGN MEDIKIOSK - COOLIFY SERVER SETUP & DEPLOYMENT SCRIPT"
echo "================================================================================"
echo "Target Platform: Coolify PaaS (Self-Hosted Zero-Cloud Alternative to Vercel/Heroku)"
echo "Specs Recommended: Cloud Host (4 vCPUs, 24GB RAM, 200GB SSD)"
echo "================================================================================"

# Step 1: Detect Root / Sudo
if [ "$EUID" -ne 0 ]; then
  echo "[WARNING] This installer requires sudo privileges on your Linux host."
  echo "Please run: sudo bash scripts/deploy_coolify.sh"
  exit 1
fi

echo "[1/4] Updating system packages and installing curl & docker..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw libsqlite3-dev

# Step 2: Open necessary ports on Linux VPS Firewall (UFW)
echo "[2/4] Configuring UFW Firewall for Coolify and MediKiosk..."
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP (Web / Let's Encrypt)
ufw allow 443/tcp    # HTTPS (SSL)
ufw allow 8000/tcp   # Coolify Dashboard
ufw allow 8001/tcp   # MediKiosk API Backend (Optional Direct Access)
ufw allow 6001/tcp   # Coolify WebSockets
ufw --force enable

# Step 3: Install Coolify Engine via official 1-command installer
echo "[3/4] Launching Coolify PaaS Engine..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Step 4: Print Post-Install Instructions
SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo "================================================================================"
echo "[SUCCESS] COOLIFY PAAS ENGINE SUCCESSFULLY INSTALLED AND RUNNING"
echo "================================================================================"
echo "Coolify Web Dashboard: http://${SERVER_IP}:8000"
echo ""
echo "Deployment Steps for AIIA MediKiosk ('sih-doctor'):"
echo "  1. Open http://${SERVER_IP}:8000 in your browser and create your root admin account."
echo "  2. Click '+ Create Project' -> 'Production Stack'."
echo "  3. Click '+ New Resource' -> 'Docker Compose' or 'Public/Private GitHub Repository'."
echo "     - If GitHub: Enter 'https://github.com/piyso/sih-doctor' (or your repo name)"
echo "     - If Docker Compose: Paste the contents of 'docker-compose.coolify.yml'"
echo "  4. Click 'Deploy'."
echo ""
echo "Automated Features Configured by Coolify:"
echo "  * Continuous 24/7 Node.js 20+ Runtime + Native Tesseract OCR"
echo "  * Persistent SQLite WAL Volume ('medikiosk-data')"
echo "  * Automatic SSL / HTTPS Certificates via Let's Encrypt"
echo "  * WebSocket Support ('/ws/ambient') for Real-time Doctor Ambient Scribe"
echo "  * GitHub Auto-Deploy: Updates automatically on every 'git push'."
echo "================================================================================"
