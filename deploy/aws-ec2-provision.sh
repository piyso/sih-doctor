#!/usr/bin/env bash
# ==============================================================================
# Hospital OS — Automated Amazon Web Services (AWS) EC2 Provisioner
# Run this inside AWS CloudShell (https://console.aws.amazon.com/cloudshell/)
#
# Free Tier Specs:
#   - 750 hours/month of t3.micro or t2.micro for 12 months
#   - Mumbai region (ap-south-1) with 30 GB EBS gp3 SSD
# ==============================================================================
set -euo pipefail

REGION="ap-south-1"
INSTANCE_NAME="hospital-os-mumbai"
INSTANCE_TYPE="t3.micro" # 1 vCPU, 1 GB RAM (Free Tier eligible; swap is configured automatically)
SG_NAME="hospital-os-security-group"

echo "================================================================================"
echo "    🏥 Hospital OS — AWS EC2 Provisioning Pipeline (Mumbai ap-south-1)         "
echo "================================================================================"

# 1. Fetch Default VPC
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
  echo "[-] ERROR: Default VPC not found in $REGION."
  exit 1
fi
echo "[+] Using VPC: $VPC_ID"

# 2. Configure Security Group
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=$SG_NAME" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || true)
if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
  echo "[+] Creating Security Group: $SG_NAME..."
  SG_ID=$(aws ec2 create-security-group --region "$REGION" --group-name "$SG_NAME" --description "Security group for Hospital OS Web and API" --vpc-id "$VPC_ID" --query "GroupId" --output text)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 8001 --cidr 0.0.0.0/0
  echo "[+] Security Group $SG_ID configured with ports 22, 80, 443, 8001."
else
  echo "[+] Using existing Security Group: $SG_ID"
fi

# 3. Find latest Ubuntu 22.04 LTS AMI in ap-south-1
echo "[+] Locating official Ubuntu 22.04 LTS AMI in $REGION..."
AMI_ID=$(aws ec2 describe-images --region "$REGION" \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text)
echo "[+] Selected AMI: $AMI_ID"

# 4. Create Key Pair if needed
KEY_NAME="hospital-os-key"
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" >/dev/null 2>&1; then
  echo "[+] Creating SSH Key Pair: $KEY_NAME..."
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" --query "KeyMaterial" --output text > ~/hospital-os-key.pem
  chmod 400 ~/hospital-os-key.pem
  echo "[+] Saved private key to ~/hospital-os-key.pem"
else
  echo "[+] Key pair $KEY_NAME already exists."
fi

# 5. Launch EC2 Instance with User Data (auto-bootstrap)
echo "[+] Launching $INSTANCE_TYPE instance..."
INSTANCE_ID=$(aws ec2 run-instances --region "$REGION" \
  --image-id "$AMI_ID" \
  --count 1 \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}]" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query "Instances[0].InstanceId" --output text)

echo "[+] Instance $INSTANCE_ID launched. Waiting for running state..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo ""
echo "================================================================================"
echo "    🚀 AWS EC2 INSTANCE LIVE IN MUMBAI (ap-south-1)                             "
echo "================================================================================"
echo "  Instance ID: $INSTANCE_ID"
echo "  Type:        $INSTANCE_TYPE (Free Tier eligible)"
echo "  Public IP:   $PUBLIC_IP"
echo ""
echo "  To complete setup and start Hospital OS, SSH in:"
echo "--------------------------------------------------------------------------------"
echo "  ssh -i ~/hospital-os-key.pem ubuntu@$PUBLIC_IP"
echo "  curl -fsSL https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/cloud-vm-setup.sh | sudo bash"
echo "--------------------------------------------------------------------------------"
echo "  Once complete, access at: https://${PUBLIC_IP}.sslip.io (or http://${PUBLIC_IP})"
echo "================================================================================"
