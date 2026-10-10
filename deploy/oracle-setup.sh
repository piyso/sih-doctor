#!/usr/bin/env bash
# ==============================================================================
# Hospital OS & AIIA Sovereign MediKiosk — Oracle Cloud Infrastructure (OCI) Setup
# Optimized for Oracle Cloud Always Free:
#   - 4 OCPU ARM Ampere A1 Compute, 24 GB RAM, 200 GB NVMe (Mumbai / Hyderabad)
#   - Or 2 AMD Micro VMs (1/8 OCPU, 1 GB RAM each)
#
# Usage:
#   sudo bash deploy/oracle-setup.sh [domain-or-email] [admin-email]
#
# Examples:
#   # 1. Zero domain purchase needed (Free auto-resolving SSL via sslip.io):
#   sudo bash deploy/oracle-setup.sh
#
#   # 2. Custom Domain:
#   sudo bash deploy/oracle-setup.sh hospital.myhealth.org admin@myhealth.org
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[-] ERROR: This script must be run as root (use: sudo bash deploy/oracle-setup.sh)" >&2
  exit 1
fi

echo "================================================================================"
echo "    🏥 Hospital OS — Oracle Cloud Always Free Automated Deployment              "
echo "================================================================================"

# 1. Auto-detect Public IP
PUBLIC_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://ifconfig.me || curl -s -m 5 http://checkip.amazonaws.com || true)
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP=$(hostname -I | awk '{print $1}')
fi
echo "[+] Detected Server Public IP: $PUBLIC_IP"

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  if [ -n "$PUBLIC_IP" ]; then
    DOMAIN="${PUBLIC_IP}.sslip.io"
    EMAIL="admin@${DOMAIN}"
    echo "[+] Using auto-configured SSL domain: $DOMAIN"
  else
    DOMAIN="localhost"
    EMAIL="admin@hospital.local"
  fi
elif [[ "$DOMAIN" == *"@"* ]]; then
  EMAIL="$DOMAIN"
  DOMAIN="${PUBLIC_IP}.sslip.io"
  echo "[+] Using auto-configured SSL domain: $DOMAIN with contact: $EMAIL"
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@${DOMAIN}"
fi

REPO="${3:-https://github.com/piyso/sih-doctor.git}"
DIR="/opt/hospital-os"

# 2. Swap configuration (if running on AMD micro 1GB)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
if [ "$TOTAL_RAM_KB" -lt 4194304 ]; then
  echo "[+] Physical RAM is under 4GB. Ensuring swapfile is active..."
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "[+] 4 GB swap space configured."
  else
    swapon /swapfile 2>/dev/null || true
  fi
fi

# 3. Packages
echo "[+] Installing Docker Engine and utilities..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q
apt-get install -y -q docker.io docker-compose-v2 git iptables-persistent openssl curl ufw
systemctl enable --now docker

# 4. Oracle Linux / Ubuntu Firewall (Oracle blocks non-SSH ports by default)
echo "[+] Opening ports 80 (HTTP), 443 (HTTPS), 8001 (API), and 22 (SSH)..."
for port in 22 80 443 8001; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save 2>/dev/null || true

# 5. Application Code
echo "[+] Synchronizing codebase..."
if [ -d "$PWD/backend" ] && [ -f "$PWD/docker-compose.yml" ]; then
  APP_DIR="$PWD"
else
  APP_DIR="$DIR"
  if [ ! -d "$APP_DIR/.git" ]; then
    git clone "$REPO" "$APP_DIR"
  else
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main || git pull origin main
  fi
fi

cd "$APP_DIR"
[ -f docker-compose.yml ] || cd "$(dirname "$(find . -maxdepth 2 -name docker-compose.yml | head -1)")"

# 6. Configuration (.env)
echo "[+] Configuring environment variables..."
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

# 7. Launch Containers
echo "[+] Starting Hospital OS containers..."
docker compose --profile https up -d --build

echo ""
echo "================================================================================"
echo "    🎉 Hospital OS is LIVE on Oracle Cloud!                                     "
echo "================================================================================"
echo "  Primary HTTPS URL:  https://$DOMAIN"
echo "  Direct HTTP URL:   http://$PUBLIC_IP"
echo "  Hospital Setup Code: $SETUP_CODE"
echo ""
echo "  Demo Doctor Logins:"
echo "    - Modern OPD:  dr.sharma     / 482913"
echo "    - AYUSH OPD:   vaidya.sharma / 573920"
echo "    - Admin Desk:  admin         / 802211"
echo "    - Nurse Desk:  nurse.priya   / 619384"
echo "================================================================================"
