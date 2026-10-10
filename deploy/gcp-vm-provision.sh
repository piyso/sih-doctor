#!/usr/bin/env bash
# ==============================================================================
# Hospital OS — Automated Google Cloud Platform (GCP) Compute Engine Provisioner
# Run this inside Google Cloud Shell (https://shell.cloud.google.com)
#
# Free Tier Specs:
#   - $300 (₹25,000 INR) Google Cloud Free Trial Credits
#   - High-throughput Mumbai datacenter (asia-south1) with ZERO quota bottlenecks
# ==============================================================================
set -euo pipefail

INSTANCE_NAME="hospital-os-mumbai"
ZONE="asia-south1-a"
MACHINE_TYPE="e2-medium" # 2 vCPU, 4 GB RAM (Smooth, fast Docker build)
DISK_SIZE="30GB"

echo "================================================================================"
echo "    🏥 Hospital OS — Google Cloud Engine Provisioning Pipeline (Mumbai)        "
echo "================================================================================"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "[-] ERROR: No active GCP project found. Run: gcloud config set project <YOUR_PROJECT_ID>"
  exit 1
fi
echo "[+] Active GCP Project: $PROJECT_ID"

# 1. Enable Compute Engine API
echo "[+] Enabling Google Compute Engine API (takes ~15 seconds)..."
gcloud services enable compute.googleapis.com --project="$PROJECT_ID"

# 2. Configure Firewall Rule for Ingress HTTP / HTTPS / 8001
echo "[+] Creating firewall rule for Hospital OS web traffic..."
if ! gcloud compute firewall-rules describe allow-hospital-web --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute firewall-rules create allow-hospital-web \
    --project="$PROJECT_ID" \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443,tcp:8001 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=hospital-web-server
  echo "[+] Firewall rule 'allow-hospital-web' created successfully."
else
  echo "[+] Firewall rule 'allow-hospital-web' already exists."
fi

# 3. Create Compute Engine VM Instance
echo "[+] Creating Ubuntu 22.04 LTS instance ($INSTANCE_NAME) in $ZONE..."
if ! gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --tags=hospital-web-server,http-server,https-server \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size="$DISK_SIZE" \
    --boot-disk-type=pd-balanced
  echo "[+] Instance $INSTANCE_NAME created successfully!"
else
  echo "[+] Instance $INSTANCE_NAME already exists."
fi

# 4. Retrieve External Public IP
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT_ID" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "================================================================================"
echo "    🚀 VM PROVISIONED SUCCESSFULLY IN MUMBAI (asia-south1)                      "
echo "================================================================================"
echo "  VM Name:     $INSTANCE_NAME"
echo "  Machine:     $MACHINE_TYPE (2 vCPU, 4 GB RAM)"
echo "  Public IP:   $EXTERNAL_IP"
echo ""
echo "  To launch Hospital OS on this VM right now, run:"
echo "--------------------------------------------------------------------------------"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command=\"curl -fsSL https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/cloud-vm-setup.sh | sudo bash\""
echo "--------------------------------------------------------------------------------"
echo "  Once the command finishes, your app will be live at:"
echo "    HTTPS: https://${EXTERNAL_IP}.sslip.io"
echo "    HTTP:  http://${EXTERNAL_IP}"
echo "================================================================================"
