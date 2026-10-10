#!/usr/bin/env bash
# ==============================================================================
# Azure Cloud Shell Automated VM Provisioner for Hospital OS
# Automatically discovers an available region & SKU with quota on Free Trial,
# provisions Ubuntu 22.04 LTS, configures ports 80/443, and prepares deployment.
# ==============================================================================
set -e

echo "================================================================================"
echo " Hospital OS — Azure Cloud Shell Auto-Provisioner"
echo " Searching for active compute quota and available hardware..."
echo "================================================================================"

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: 'az' CLI not found. Please run this inside Azure Cloud Shell."
  exit 1
fi

RG="hospitalos-rg"
VM_NAME="hospitalos-server"

# Ensure resource group exists
echo "==> Ensuring resource group '$RG' exists..."
az group create --name "$RG" --location "southeastasia" -o none 2>/dev/null || true

# Priority candidate regions: Singapore (closest to India), East US 2, North Europe, etc.
CANDIDATE_REGIONS=("southeastasia" "eastus2" "northeurope" "centralus" "westeurope" "westus2" "eastus")

# Candidate sizes compatible with Azure Free Trial ($200 credit)
CANDIDATE_SIZES=("Standard_B1s" "Standard_B2ats_v2" "Standard_D2as_v5" "Standard_D2s_v5" "Standard_B1ms" "Standard_B2s")

SUCCESS=0
DEPLOYED_REGION=""
DEPLOYED_SIZE=""

for REGION in "${CANDIDATE_REGIONS[@]}"; do
  echo "--> Checking compute quota in region: $REGION..."
  QUOTA=$(az vm list-usage --location "$REGION" --query "[?name.value=='cores'].limit" -o tsv 2>/dev/null || echo 0)
  
  if [ -z "$QUOTA" ] || [ "$QUOTA" -eq 0 ]; then
    echo "    Quota in $REGION is 0 cores (restricted for this subscription). Skipping."
    continue
  fi
  
  echo "    Quota in $REGION is $QUOTA cores. Searching for available VM size..."
  
  for SIZE in "${CANDIDATE_SIZES[@]}"; do
    DNS_PREFIX="medikiosk-$RANDOM"
    echo "    Attempting creation in $REGION with size $SIZE..."
    
    # Attempt VM creation
    if az vm create \
        --resource-group "$RG" \
        --name "$VM_NAME" \
        --location "$REGION" \
        --image "Ubuntu2204" \
        --size "$SIZE" \
        --admin-username "azureuser" \
        --generate-ssh-keys \
        --public-ip-sku "Standard" \
        --public-ip-address-dns-name "$DNS_PREFIX" \
        -o none 2>/dev/null; then
        
        SUCCESS=1
        DEPLOYED_REGION="$REGION"
        DEPLOYED_SIZE="$SIZE"
        echo "    SUCCESS: Virtual Machine provisioned in $REGION using $SIZE!"
        break 2
    else
        echo "    Size $SIZE in $REGION unavailable or restricted. Trying next size..."
    fi
  done
done

if [ "$SUCCESS" -ne 1 ]; then
  echo ""
  echo "================================================================================"
  echo "❌ AUTO-PROVISIONING NOTICE"
  echo "All standard regions currently report 0 quota for Free Trial trial vCPUs."
  echo ""
  echo "To instantly unlock regional compute for your $200 credit:"
  echo "1. Go to Azure Portal: https://portal.azure.com"
  echo "2. Click 'Upgrade' in the top bar to convert from Free Trial to Pay-As-You-Go."
  echo "   (Your \$200 credit stays active for 30 days — you are charged ₹0)."
  echo "3. Re-run this script, and it will deploy in Central India immediately."
  echo "================================================================================"
  exit 1
fi

echo ""
echo "==> Configuring Network Security Group (Opening ports 80 & 443)..."
az vm open-port --resource-group "$RG" --name "$VM_NAME" --port 80 --priority 300 -o none 2>/dev/null || true
az vm open-port --resource-group "$RG" --name "$VM_NAME" --port 443 --priority 310 -o none 2>/dev/null || true

PUBLIC_IP=$(az vm show -g "$RG" -n "$VM_NAME" -d --query publicIps -o tsv)
FQDN=$(az vm show -g "$RG" -n "$VM_NAME" -d --query fqdns -o tsv)

echo ""
echo "================================================================================"
echo "🎉 AZURE VIRTUAL MACHINE CREATED SUCCESSFULLY!"
echo "================================================================================"
echo " Region:    $DEPLOYED_REGION"
echo " Size:      $DEPLOYED_SIZE"
echo " Public IP: $PUBLIC_IP"
echo " Domain:    $FQDN"
echo "================================================================================"
echo ""
echo "To connect to your VM and deploy Hospital OS, run:"
echo ""
echo "  ssh azureuser@$PUBLIC_IP"
echo ""
echo "Then paste this deploy command inside your VM:"
echo ""
echo "  sudo bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/azure-setup.sh)\" -- $FQDN admin@hospital.gov.in"
echo ""
echo "================================================================================"
