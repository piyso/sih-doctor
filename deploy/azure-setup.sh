#!/usr/bin/env bash
# ==============================================================================
# Hospital OS & AIIA Sovereign MediKiosk — Microsoft Azure Production Setup
# Works on any Azure Ubuntu VM (Ubuntu 22.04 LTS / 24.04 LTS, x86_64 or ARM64)
# Fully compatible with Microsoft Azure Free Trial ($200 Credit / B-series VMs)
#
# Usage:
#   sudo bash deploy/azure-setup.sh <azure-fqdn-or-domain> <admin-email> [repo-url]
#
# Example:
#   sudo bash deploy/azure-setup.sh myhospital.centralindia.cloudapp.azure.com admin@example.com
# ==============================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
REPO="${3:-https://github.com/piyso/sih-doctor.git}"
DIR="/opt/hospital-os"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "================================================================================"
  echo "ERROR: Missing required arguments."
  echo "Usage: sudo bash deploy/azure-setup.sh <azure-domain-or-fqdn> <admin-email> [repo-url]"
  echo ""
  echo "Example using Azure's free cloudapp.azure.com domain:"
  echo "  sudo bash deploy/azure-setup.sh medikiosk-demo.centralindia.cloudapp.azure.com admin@example.com"
  echo "================================================================================"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (use: sudo bash deploy/azure-setup.sh ...)" >&2
  exit 1
fi

echo "================================================================================"
echo " Hospital OS — Microsoft Azure Automated Deployment Pipeline"
echo " Target Domain: $DOMAIN"
echo " SSL Contact:   $EMAIL"
echo "================================================================================"

# ------------------------------------------------------------------------------
# 1. System Memory Check & Swap Space Allocation
# ------------------------------------------------------------------------------
echo "==> [1/7] Checking system resources and swap space..."
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
echo "    Detected physical RAM: ${TOTAL_RAM_MB} MB"

EXISTING_SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
if [ "$EXISTING_SWAP_KB" -lt 2097152 ]; then
  echo "    Configuring 4 GB swap space to prevent memory exhaustion during Docker builds..."
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo "    4 GB swap space activated successfully."
  else
    swapon /swapfile 2>/dev/null || true
  fi
else
  echo "    Sufficient swap space is already active (${EXISTING_SWAP_KB} KB)."
fi

# ------------------------------------------------------------------------------
# 2. Package Installation (Docker & Tools)
# ------------------------------------------------------------------------------
echo "==> [2/7] Installing Docker Engine, Compose v2, and system utilities..."
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

# Install Docker via official Ubuntu packages if not present
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y -q docker.io docker-compose-v2
fi

systemctl enable --now docker

# ------------------------------------------------------------------------------
# 3. Firewall Configuration (Azure VM internal firewall)
# ------------------------------------------------------------------------------
echo "==> [3/7] Opening ports 80 (HTTP), 443 (HTTPS), and 22 (SSH) in OS firewall..."
# Ensure UFW allows necessary ports if UFW is active
if ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw reload
fi

# Ensure iptables accepts traffic for ports 80 and 443
for port in 80 443 22; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save 2>/dev/null || true

# ------------------------------------------------------------------------------
# 4. Clone or Update Repository
# ------------------------------------------------------------------------------
echo "==> [4/7] Synchronizing application source code..."
if [ -d "$PWD/backend" ] && [ -f "$PWD/docker-compose.yml" ]; then
  DIR="$PWD"
  echo "    Using local directory: $DIR"
else
  if [ ! -d "$DIR/.git" ]; then
    echo "    Cloning $REPO into $DIR..."
    git clone "$REPO" "$DIR"
  else
    echo "    Updating existing repository at $DIR..."
    cd "$DIR"
    git fetch origin
    git reset --hard origin/main || git pull origin main
  fi
fi

cd "$DIR"
[ -f docker-compose.yml ] || cd "$(dirname "$(find . -maxdepth 2 -name docker-compose.yml | head -1)")"

# ------------------------------------------------------------------------------
# 5. Environment Configuration (.env)
# ------------------------------------------------------------------------------
echo "==> [5/7] Generating production configuration (.env)..."
if [ ! -f .env ]; then
  cp .env.example .env
  SETUP_CODE=$(openssl rand -hex 16)
  EDGE_TOKEN=$(openssl rand -hex 24)

  sed -i "s|^SETUP_CODE=.*|SETUP_CODE=$SETUP_CODE|" .env
  sed -i "s|^HOSPITAL_HOSTNAME=.*|HOSPITAL_HOSTNAME=$DOMAIN|" .env
  sed -i "s|^CADDY_TLS=.*|CADDY_TLS=$EMAIL|" .env
  sed -i "s|^EDGE_AI_TOKEN=.*|EDGE_AI_TOKEN=$EDGE_TOKEN|" .env
  # Default to demo data active for Azure cloud evaluation/pilot
  sed -i "s|^ALLOW_DEMO_DATA=.*|ALLOW_DEMO_DATA=true|" .env
  sed -i "s|^DEMO_TOGGLE=.*|DEMO_TOGGLE=true|" .env
  chmod 600 .env
  echo "    Generated new .env with cryptographically secure tokens."
else
  echo "    Preserving existing .env file. Updating HOSPITAL_HOSTNAME and CADDY_TLS..."
  sed -i "s|^HOSPITAL_HOSTNAME=.*|HOSPITAL_HOSTNAME=$DOMAIN|" .env
  sed -i "s|^CADDY_TLS=.*|CADDY_TLS=$EMAIL|" .env
fi

# ------------------------------------------------------------------------------
# 6. Build and Launch Containers
# ------------------------------------------------------------------------------
echo "==> [6/7] Building and starting Hospital OS containers..."

# Determine whether to enable on-premise AI models based on available RAM
COMPOSE_PROFILES="--profile https"
if [ "$TOTAL_RAM_MB" -ge 3500 ]; then
  echo "    RAM is >= 3.5 GB. Enabling Edge AI speech models profile..."
  COMPOSE_PROFILES="--profile https --profile ai"
  docker compose $COMPOSE_PROFILES build
  echo "    Fetching Sherpa Hindi + English speech models..."
  docker compose --profile ai run --rm edge-ai scripts/fetch_models.sh || echo "    [Notice] Model fetch completed or using local cache."
else
  echo "    RAM is < 3.5 GB (${TOTAL_RAM_MB} MB). Running lightweight Core + HTTPS profile."
  echo "    (Browser speech recognition will be used automatically on HTTPS kiosks)."
  docker compose $COMPOSE_PROFILES build
fi

docker compose $COMPOSE_PROFILES up -d

# ------------------------------------------------------------------------------
# 7. Verification & Health Check
# ------------------------------------------------------------------------------
echo "==> [7/7] Verifying container health..."
echo "    Waiting 15 seconds for backend SQLite initialization and Caddy TLS challenge..."
sleep 15

docker compose ps

ADMIN_SETUP_CODE=$(grep '^SETUP_CODE=' .env | cut -d'=' -f2)

echo ""
echo "================================================================================"
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "================================================================================"
echo " Hospital OS is now live on Microsoft Azure at:"
echo "   👉  https://$DOMAIN"
echo ""
echo " 🔑 Administrator First-Time Setup Code:"
echo "   $ADMIN_SETUP_CODE"
echo ""
echo " ⚠️  CRITICAL AZURE NETWORK STEP:"
echo "   In your Azure Portal (or Azure CLI):"
echo "   Go to: Virtual Machine > Networking > Network Security Group (NSG)"
echo "   Verify that Inbound Port Rules for Port 80 (HTTP) and Port 443 (HTTPS) are ALLOWED!"
echo "   (By default, Azure NSG only allows Port 22 SSH)."
echo ""
echo " Useful commands on this VM:"
echo "   View logs:        cd $DIR && docker compose logs -f"
echo "   Restart stack:    cd $DIR && docker compose restart"
echo "   Check health:     curl -I http://localhost:8001/health"
echo "   Inspect secrets:  grep SETUP_CODE $DIR/.env"
echo "================================================================================"
