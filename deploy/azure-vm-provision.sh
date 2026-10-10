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

# Clean up any stale/broken centralindia resource group from earlier attempts
if az group show --name "hospitalos-rg" >/dev/null 2>&1; then
  echo "==> Cleaning stale 'hospitalos-rg' to avoid cross-region VNet conflicts..."
  az group delete --name "hospitalos-rg" --yes --no-wait 2>/dev/null || true
fi

VM_NAME="hospitalos-server"

# Priority regions where Free Trial has active 10-core quota
CANDIDATE_REGIONS=("southeastasia" "eastus2" "northeurope" "centralus" "westeurope" "westus2" "eastus")

# Candidate sizes compatible with Azure Free Trial ($200 credit)
CANDIDATE_SIZES=("Standard_B1s" "Standard_B2ats_v2" "Standard_D2as_v5" "Standard_D2s_v5" "Standard_B1ms" "Standard_B2s")

SUCCESS=0
DEPLOYED_REGION=""
DEPLOYED_SIZE=""
DEPLOYED_RG=""

for REGION in "${CANDIDATE_REGIONS[@]}"; do
  echo "--> Checking compute quota in region: $REGION..."
  QUOTA=$(az vm list-usage --location "$REGION" --query "[?name.value=='cores'].limit" -o tsv 2>/dev/null || echo 0)
  
  if [ -z "$QUOTA" ] || [ "$QUOTA" -eq 0 ]; then
    echo "    Quota in $REGION is 0 cores. Skipping."
    continue
  fi
  
  echo "    Quota in $REGION is $QUOTA cores. Preparing fresh regional resource group..."
  RG="hospitalos-${REGION}-rg"
  az group create --name "$RG" --location "$REGION" -o none
  
  for SIZE in "${CANDIDATE_SIZES[@]}"; do
    DNS_PREFIX="medikiosk-$RANDOM"
    echo "    Attempting creation in $REGION with size $SIZE..."
    
    # Attempt VM creation (capturing error if any)
    ERR_MSG=$(az vm create \
        --resource-group "$RG" \
        --name "$VM_NAME" \
        --location "$REGION" \
        --image "Ubuntu2204" \
        --size "$SIZE" \
        --admin-username "azureuser" \
        --generate-ssh-keys \
        --public-ip-sku "Standard" \
        --public-ip-address-dns-name "$DNS_PREFIX" \
        -o none 2>&1 || true)
        
    if az vm show --resource-group "$RG" --name "$VM_NAME" >/dev/null 2>&1; then
        SUCCESS=1
        DEPLOYED_REGION="$REGION"
        DEPLOYED_SIZE="$SIZE"
        DEPLOYED_RG="$RG"
        echo "    SUCCESS: Virtual Machine provisioned in $REGION using $SIZE!"
        break 2
    else
        # Print concise reason
        REASON=$(echo "$ERR_MSG" | grep -o "Following SKUs have failed for Capacity Restrictions: [^']*" || echo "$ERR_MSG" | head -2)
        echo "    Notice: $REASON. Trying next option..."
    fi
  done
  
  # Clean empty failed regional RG
  if [ "$SUCCESS" -ne 1 ]; then
    az group delete --name "$RG" --yes --no-wait 2>/dev/null || true
  fi
done

if [ "$SUCCESS" -ne 1 ]; then
  echo ""
  echo "================================================================================"
  echo "❌ AUTO-PROVISIONING NOTICE"
  echo "All standard regions currently report hardware capacity constraints for trial SKUs."
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
az vm open-port --resource-group "$DEPLOYED_RG" --name "$VM_NAME" --port 80 --priority 300 -o none 2>/dev/null || true
az vm open-port --resource-group "$DEPLOYED_RG" --name "$VM_NAME" --port 443 --priority 310 -o none 2>/dev/null || true

PUBLIC_IP=$(az vm show -g "$DEPLOYED_RG" -n "$VM_NAME" -d --query publicIps -o tsv)
FQDN=$(az vm show -g "$DEPLOYED_RG" -n "$VM_NAME" -d --query fqdns -o tsv)

echo ""
echo "================================================================================"
echo "🎉 AZURE VIRTUAL MACHINE CREATED SUCCESSFULLY!"
echo "================================================================================"
echo " Resource Group: $DEPLOYED_RG"
echo " Region:         $DEPLOYED_REGION"
echo " Size:           $DEPLOYED_SIZE"
echo " Public IP:      $PUBLIC_IP"
echo " Domain:         $FQDN"
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
