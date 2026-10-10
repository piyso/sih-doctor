#!/usr/bin/env bash
# ==============================================================================
# Hospital OS & AIIA Sovereign MediKiosk — Universal Cloud VM Production Setup
# Compatible with:
#   - Google Cloud Platform (GCP Compute Engine e2-micro / e2-medium)
#   - Oracle Cloud Infrastructure (OCI Always Free Ampere A1 ARM / AMD Micro)
#   - Amazon Web Services (AWS EC2 Free Tier t3.micro / t2.micro)
#   - Any Ubuntu 22.04/24.04 LTS or Debian 11/12 VPS
#
# Usage:
#   sudo bash deploy/cloud-vm-setup.sh [domain-or-email] [admin-email]
#
# Examples:
#   # Option A: Automatic Public IP + Free SSL via sslip.io (Zero domain purchase needed!):
#   sudo bash deploy/cloud-vm-setup.sh
#
#   # Option B: Custom Domain with Let's Encrypt HTTPS:
#   sudo bash deploy/cloud-vm-setup.sh hospital.myhealth.org admin@myhealth.org
# ==============================================================================
set -euo pipefail

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "[-] ERROR: This script must be run as root (use: sudo bash deploy/cloud-vm-setup.sh)" >&2
  exit 1
fi

echo "================================================================================"
echo "    🏥 Hospital OS & Sovereign MediKiosk — Universal Cloud VM Installer        "
echo "================================================================================"

# ------------------------------------------------------------------------------
# 1. Detect Host Public IP & Determine Domain
# ------------------------------------------------------------------------------
echo "==> [1/7] Detecting server networking and public IP..."
PUBLIC_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://ifconfig.me || curl -s -m 5 http://checkip.amazonaws.com || true)
if [ -z "$PUBLIC_IP" ]; then
  # Fallback to local default gateway interface IP
  PUBLIC_IP=$(hostname -I | awk '{print $1}')
fi
echo "    Server Public IP: $PUBLIC_IP"

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  if [ -n "$PUBLIC_IP" ]; then
    DOMAIN="${PUBLIC_IP}.sslip.io"
    EMAIL="admin@${DOMAIN}"
    echo "    No domain specified. Using free auto-resolving wildcard SSL domain: $DOMAIN"
  else
    DOMAIN="localhost"
    EMAIL="admin@hospital.local"
  fi
elif [[ "$DOMAIN" == *"@"* ]]; then
  # User only passed an email as first argument
  EMAIL="$DOMAIN"
  DOMAIN="${PUBLIC_IP}.sslip.io"
  echo "    Using auto-resolving wildcard SSL domain: $DOMAIN with SSL contact: $EMAIL"
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@${DOMAIN}"
fi

REPO_URL="https://github.com/piyso/sih-doctor.git"
INSTALL_DIR="/opt/hospital-os"

# ------------------------------------------------------------------------------
# 2. Memory Inspection & Automatic 4GB Swap Space Configuration
# ------------------------------------------------------------------------------
echo "==> [2/7] Checking RAM and configuring swap space..."
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
echo "    Physical RAM: ${TOTAL_RAM_MB} MB"

EXISTING_SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
if [ "$EXISTING_SWAP_KB" -lt 2097152 ]; then
  echo "    Low swap detected (${EXISTING_SWAP_KB} KB). Creating 4 GB swapfile to ensure smooth Docker builds..."
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo "    ✓ 4 GB swap activated successfully."
  else
    swapon /swapfile 2>/dev/null || true
  fi
else
  echo "    ✓ Active swap space: $((EXISTING_SWAP_KB / 1024)) MB"
fi

# ------------------------------------------------------------------------------
# 3. Essential Packages & Docker Engine Installation
# ------------------------------------------------------------------------------
echo "==> [3/7] Installing Docker Engine, Git, and essential dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q
apt-get install -y -q \
  ca-certificates \
  curl \
  gnupg \
  git \
  openssl \
  iptables-persistent \
  ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "    Installing Docker Engine..."
  apt-get install -y -q docker.io docker-compose-v2 || {
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
  }
fi

systemctl enable --now docker

# ------------------------------------------------------------------------------
# 4. Firewall Ingress Rules (Open 80, 443, 8001, 22)
# ------------------------------------------------------------------------------
echo "==> [4/7] Configuring internal firewall rules for HTTP (80) and HTTPS (443)..."
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8001/tcp
  ufw reload
fi

# Ensure iptables accepts ingress traffic (critical for Oracle Cloud Ubuntu)
for port in 22 80 443 8001; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Clone or Update Application Codebase
# ------------------------------------------------------------------------------
echo "==> [5/7] Synchronizing application codebase..."
if [ -d "$PWD/backend" ] && [ -f "$PWD/docker-compose.yml" ]; then
  APP_DIR="$PWD"
  echo "    Running directly from current directory: $APP_DIR"
else
  APP_DIR="$INSTALL_DIR"
  if [ ! -d "$APP_DIR/.git" ]; then
    echo "    Cloning $REPO_URL to $APP_DIR..."
    git clone "$REPO_URL" "$APP_DIR"
  else
    echo "    Updating existing repo at $APP_DIR..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main || git pull origin main
  fi
fi

cd "$APP_DIR"
[ -f docker-compose.yml ] || cd "$(dirname "$(find . -maxdepth 2 -name docker-compose.yml | head -1)")"

# ------------------------------------------------------------------------------
# 6. Environment Configuration (.env)
# ------------------------------------------------------------------------------
echo "==> [6/7] Generating hardened environment config..."
SETUP_CODE=$(openssl rand -hex 16)
EDGE_TOKEN=$(openssl rand -hex 24)

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^SETUP_CODE=.*|SETUP_CODE=$SETUP_CODE|" .env
  sed -i "s|^HOSPITAL_HOSTNAME=.*|HOSPITAL_HOSTNAME=$DOMAIN|" .env
  sed -i "s|^CADDY_TLS=.*|CADDY_TLS=$EMAIL|" .env
  sed -i "s|^EDGE_AI_TOKEN=.*|EDGE_AI_TOKEN=$EDGE_TOKEN|" .env
  sed -i "s|^ALLOW_DEMO_DATA=.*|ALLOW_DEMO_DATA=true|" .env
  sed -i "s|^DEMO_TOGGLE=.*|DEMO_TOGGLE=true|" .env
  chmod 600 .env
else
  sed -i "s|^HOSPITAL_HOSTNAME=.*|HOSPITAL_HOSTNAME=$DOMAIN|" .env
  sed -i "s|^CADDY_TLS=.*|CADDY_TLS=$EMAIL|" .env
  sed -i "s|^ALLOW_DEMO_DATA=.*|ALLOW_DEMO_DATA=true|" .env
  sed -i "s|^DEMO_TOGGLE=.*|DEMO_TOGGLE=true|" .env
  SETUP_CODE=$(grep "^SETUP_CODE=" .env | cut -d= -f2 || echo "$SETUP_CODE")
fi

# ------------------------------------------------------------------------------
# 7. Build and Launch Containers
# ------------------------------------------------------------------------------
echo "==> [7/7] Launching containers via Docker Compose..."
# If RAM is < 2GB (e.g. AWS micro or GCP e2-micro), start backend + frontend + caddy first
docker compose --profile https build
docker compose --profile https up -d

echo "    Waiting for service healthcheck verification..."
HEALTHY=false
for i in $(seq 1 15); do
  if docker compose ps | grep -q "healthy"; then
    HEALTHY=true
    break
  fi
  sleep 2
done

echo ""
echo "================================================================================"
echo "    🎉 Hospital OS Deployment Complete & Live!                                  "
echo "================================================================================"
echo "  Primary HTTPS URL:  https://$DOMAIN"
echo "  Direct HTTP URL:   http://$PUBLIC_IP"
echo "  Backend Direct:    http://$PUBLIC_IP:8001/health"
echo ""
echo "  Hospital Setup Code: $SETUP_CODE"
echo "  (Use SETUP_CODE on first visit to create the root administrator)"
echo ""
echo "  Preloaded Demo Doctors (Immediate Login):"
echo "    - Modern OPD:  Username: dr.sharma      PIN: 482913"
echo "    - AYUSH OPD:   Username: vaidya.sharma  PIN: 573920"
echo "    - Admin Desk:  Username: admin          PIN: 802211"
echo "    - Triage:      Username: nurse.priya    PIN: 619384"
echo "================================================================================"
