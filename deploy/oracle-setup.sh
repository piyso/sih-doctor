#!/usr/bin/env bash
# Sets up Hospital OS on a fresh Ubuntu 22.04/24.04 VM (ARM or x86) in an India cloud region — e.g. an Oracle
# Cloud "Ampere A1" VM (4 OCPU / 24 GB) in Mumbai or Hyderabad. For a pilot or demo; for live patient use
# prefer an on-premise box (docs/DEPLOYMENT.md).
#
#   sudo bash deploy/oracle-setup.sh <public-domain> <admin-email> [repo-url]
#
# Before running: point the domain's DNS A record at the VM, and in the cloud console allow inbound TCP 80 and
# 443 (Oracle: VCN › Security List › Ingress rules). This script opens the same ports in the VM's own firewall.
set -euo pipefail
DOMAIN="${1:?usage: oracle-setup.sh <public-domain> <admin-email> [repo-url]}"
EMAIL="${2:?admin e-mail for the HTTPS certificate}"
REPO="${3:-https://github.com/piyso/sih-doctor.git}"
DIR=/opt/hospital-os
[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }

echo "== packages"
apt-get update -y
apt-get install -y docker.io docker-compose-v2 git iptables-persistent openssl curl
systemctl enable --now docker

echo "== firewall (Oracle Ubuntu images reject everything except SSH by default)"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save

echo "== code"
if [ ! -d "$DIR/.git" ]; then git clone "$REPO" "$DIR"; fi
cd "$DIR"
# the repository root may contain the app in a sub-folder
[ -f docker-compose.yml ] || cd "$(dirname "$(find . -maxdepth 2 -name docker-compose.yml | head -1)")"

echo "== configuration"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^SETUP_CODE=.*|SETUP_CODE=$(openssl rand -hex 16)|" .env
  sed -i "s|^HOSPITAL_HOSTNAME=.*|HOSPITAL_HOSTNAME=$DOMAIN|" .env
  sed -i "s|^CADDY_TLS=.*|CADDY_TLS=$EMAIL|" .env
  sed -i "s|^EDGE_AI_TOKEN=.*|EDGE_AI_TOKEN=$(openssl rand -hex 24)|" .env
  sed -i "s|^ALLOW_DEMO_DATA=.*|ALLOW_DEMO_DATA=false|" .env
  chmod 600 .env
fi

echo "== build and speech models (~690 MB, SHA-256 verified)"
docker compose --profile https --profile ai build
docker compose --profile ai run --rm edge-ai scripts/fetch_models.sh

echo "== start"
docker compose --profile https --profile ai up -d
sleep 10
docker compose ps

cat <<MSG

Hospital OS is starting at https://$DOMAIN
  First sign-in creates the administrator; it asks for SETUP_CODE:  grep SETUP_CODE $PWD/.env
  Backups: $PWD/backups — copy them AND the signing keys off this VM daily (docs/DEPLOYMENT.md §4).
  Free-tier VMs can be reclaimed when idle; keep an off-site backup and do not rely on one free VM for live care.
MSG
