# Microsoft Azure $200 Free Credit — Production Deployment Guide

This guide walks you through deploying **Hospital OS & Sovereign MediKiosk** onto **Microsoft Azure** using the **$200 Free Trial Credit** (or standard Azure subscription).

---

## 1. Azure Free Tier & $200 Credit Breakdown

| Plan / Tier | Specifications | Monthly Cost | Covered by $200 Credit? |
|---|---|---|---|
| **Standard_B2s** *(Recommended)* | 2 vCPUs, 4 GiB RAM, 64 GB SSD | ~$30 / month | ✅ **100% Free** (lasts ~6 months) |
| **Standard_B2ms** *(Powerhouse)* | 2 vCPUs, 8 GiB RAM, 64 GB SSD | ~$60 / month | ✅ **100% Free** (lasts >3 months, runs full Edge AI speech + SLM) |
| **Standard_B1s** *(Always Free 12 mo)* | 1 vCPU, 1 GiB RAM, 64 GB SSD | $0 / month (750 hrs/mo) | ✅ **Free for 12 months** (lightweight core only, swap required) |

> [!TIP]
> **Recommended Choice**: Choose **Standard_B2s (4 GiB RAM)** or **Standard_B2ms (8 GiB RAM)** in **Central India (Pune)** or **South India (Chennai)**. This gives you plenty of memory for smooth Docker builds, SQLite WAL database, Caddy HTTPS, and the bilingual Hindi + English Edge AI speech service.

---

## 2. Step 1: Create the Azure Virtual Machine

### Option A: Via Azure Web Portal (GUI)
1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. In the top search bar, type **Virtual Machines** and select it.
3. Click **Create** > **Azure virtual machine**.
4. Fill in the **Basics** tab:
   - **Subscription**: Free Trial (or your active subscription)
   - **Resource group**: Click *Create new* -> enter `hospitalos-rg`
   - **Virtual machine name**: `hospitalos-server`
   - **Region**: `(Asia Pacific) Central India` (or `South India` / closest region)
   - **Availability options**: No infrastructure redundancy required
   - **Security type**: Standard
   - **Image**: **Ubuntu Server 22.04 LTS - x64 Gen2** (or Ubuntu 24.04 LTS)
   - **VM architecture**: x64
   - **Size**: Select **Standard_B2s** (2 vcpus, 4 GiB memory)
5. **Administrator account**:
   - Select **SSH public key** (recommended) or **Password**.
   - Username: `azureuser`
   - Key pair name: `hospitalos-key` (download the `.pem` file when prompted)
6. **Inbound port rules**:
   - Public inbound ports: Select **Allow selected ports**
   - Select ports: **SSH (22)**
7. Click **Review + create** -> **Create**.

---

### Option B: Via Azure CLI (One Command)
If you have Azure CLI installed locally:
```bash
# 1. Create Resource Group in Central India (Pune)
az group create --name hospitalos-rg --location centralindia

# 2. Create the VM (Standard_B2s with Ubuntu 22.04)
az vm create \
  --resource-group hospitalos-rg \
  --name hospitalos-server \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard
```

---

## 3. Step 2: Open Inbound Ports 80 & 443 in Azure NSG (CRITICAL)

> [!IMPORTANT]
> By default, Azure's Network Security Group (NSG) **blocks all incoming web traffic** except SSH port 22. You **must** open port 80 and port 443 in Azure's firewall.

### Via Azure Portal:
1. Go to your Virtual Machine (`hospitalos-server`).
2. In the left navigation menu, click **Networking** (or **Network settings**).
3. Click **Add inbound port rule** button on the right.
4. Set the following:
   - **Destination port ranges**: `80,443`
   - **Protocol**: `TCP`
   - **Action**: `Allow`
   - **Priority**: `300`
   - **Name**: `Allow-HTTP-HTTPS`
5. Click **Add**.

### Via Azure CLI:
```bash
az vm open-port --resource-group hospitalos-rg --name hospitalos-server --port 80 --priority 300
az vm open-port --resource-group hospitalos-rg --name hospitalos-server --port 443 --priority 310
```

---

## 4. Step 3: Configure Azure's Free Public DNS Name (No Custom Domain Needed)

Azure gives you a **free permanent domain name** (`*.cloudapp.azure.com`) so you don't have to buy a domain from GoDaddy or Namecheap!

### Via Azure Portal:
1. In your VM **Overview** page, click on your **Public IP address** link.
2. In the left sidebar of the Public IP resource, click **Configuration**.
3. Under **DNS name label (optional)**, enter a unique subdomain (e.g., `aiia-medikiosk-india`).
4. Click **Save**.
5. Your permanent free FQDN is now displayed:
   `aiia-medikiosk-india.centralindia.cloudapp.azure.com`

*(If you already own a custom domain, simply create an **A Record** pointing your domain to the Azure Public IP).*

---

## 5. Step 4: Run the 1-Command Automated Deployer

Connect to your Azure VM via SSH from your Mac terminal:
```bash
ssh -i /path/to/hospitalos-key.pem azureuser@<YOUR-AZURE-PUBLIC-IP>
```

Once logged into the Azure VM, execute the deployment script:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/azure-setup.sh)" -- \
  <YOUR-AZURE-FQDN> \
  <YOUR-EMAIL>
```

### Example:
```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/piyso/sih-doctor/main/deploy/azure-setup.sh)" -- \
  aiia-medikiosk-india.centralindia.cloudapp.azure.com \
  admin@hospital.gov.in
```

### Alternatively, clone manually:
```bash
git clone https://github.com/piyso/sih-doctor.git /opt/hospital-os
cd /opt/hospital-os
sudo bash deploy/azure-setup.sh aiia-medikiosk-india.centralindia.cloudapp.azure.com admin@hospital.gov.in
```

---

## 6. What the Azure Setup Script Does Automatically

1. **Memory & Swap Shield**: Checks physical RAM; provisions a 4 GB swap space to prevent Out-Of-Memory (OOM) errors during Docker builds.
2. **System Dependencies**: Installs Docker Engine, Docker Compose v2, Git, OpenSSL, and firewall tools.
3. **Firewall Sync**: Opens ports 22, 80, and 443 in `ufw` and `iptables`.
4. **Environment Generation**:
   - Generates cryptographically secure `SETUP_CODE` (hex-32).
   - Generates `EDGE_AI_TOKEN` for speech microservice.
   - Configures `CADDY_TLS` with your email.
   - Enables `ALLOW_DEMO_DATA=true` so you can test all doctor, vaidya, and triage workflows immediately.
5. **Auto HTTPS with Caddy**: Automatically obtains and renews a real **Let's Encrypt SSL certificate** for your `.cloudapp.azure.com` domain.
6. **Container Launch**: Builds and starts the backend, frontend, Caddy proxy, and (if RAM ≥ 3.5GB) the offline Hindi/English Sherpa speech recognition engine.

---

## 7. Accessing Hospital OS

Once the script completes, open your browser and navigate to:
```
https://<YOUR-AZURE-FQDN>
```

### First Sign-in:
1. Navigate to **Administration** (or click any staff portal).
2. It will prompt for first-time admin setup.
3. Enter the `SETUP_CODE` printed at the end of the script (or run `grep SETUP_CODE /opt/hospital-os/.env`).
4. Set your custom Admin PIN.
5. You can now use:
   - **Kiosk Registration** (`/kiosk`)
   - **Doctor Desk** (`/doctor`) with dual AYUSH + Allopathy polypharmacy safety engine
   - **Nurse Station** (`/nurse`) with live triage queues and SOS monitor
   - **Pharmacy Desk** (`/pharmacy`)
   - **Waiting Room TV Board** (`/display`)

---

## 8. Managing Your Azure Server

| Action | Command |
|---|---|
| **View Live Logs** | `cd /opt/hospital-os && docker compose logs -f` |
| **Check Container Status** | `cd /opt/hospital-os && docker compose ps` |
| **Restart Stack** | `cd /opt/hospital-os && docker compose restart` |
| **View Admin Setup Code** | `grep SETUP_CODE /opt/hospital-os/.env` |
| **Inspect Encrypted Backups** | `ls -la /opt/hospital-os/backups/` |
| **Pull Latest Code & Rebuild** | `cd /opt/hospital-os && git pull && docker compose up -d --build` |

---

## 9. Azure Cost Optimization Tip

To make your $200 free credit last as long as possible:
- In Azure Portal, search **Auto-shutdown** on your Virtual Machine.
- Enable **Auto-shutdown** at 10:00 PM IST (so the VM doesn't burn compute credits while you sleep).
- When you want to demo or test, click **Start** in the Azure Portal. The containers will automatically start up within 15 seconds!
