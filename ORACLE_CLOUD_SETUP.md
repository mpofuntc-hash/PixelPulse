# Oracle Cloud Free Tier Setup Guide

## Overview
Deploy PixelPulse on Oracle Cloud Free Tier for anime streaming and betting.

---

## Step 1: Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Click "Sign Up"
3. Fill in your details:
   - Email (use separate admin email, not personal)
   - Country/Region
   - Phone number (for verification)
4. Verify your email
5. Verify your phone number
6. Add credit card (required for verification, won't be charged for free tier)
7. Complete signup

---

## Step 2: Create Compute Instance

1. Go to Oracle Cloud Console: https://console.oraclecloud.com/
2. Navigate to: Compute → Instances
3. Click "Create Instance"
4. Configure:
   - **Name**: pixelpulse-server
   - **Compartment**: (your compartment)
   - **Shape**: Always Free (VM.Standard.E2.1.Micro)
   - **Operating System**: Ubuntu 22.04 or 24.04
   - **SSH Keys**: Create or upload your SSH public key
5. Click "Create"

**Wait for instance to be running** (usually 5-10 minutes)

---

## Step 3: Connect to Instance

**On Windows (PowerShell):**
```powershell
ssh ubuntu@YOUR_PUBLIC_IP
```

**On Mac/Linux:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

Replace `YOUR_PUBLIC_IP` with your instance's public IP (shown in Oracle Console)

---

## Step 4: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2

# Install ffmpeg (for video processing)
sudo apt install -y ffmpeg

# Create project directory
mkdir -p ~/pixelpulse
cd ~/pixelpulse
```

---

## Step 5: Clone Repository

```bash
git clone https://github.com/mpofuntc-hash/PixelPulse.git .
```

---

## Step 6: Install Dependencies

```bash
npm install
```

---

## Step 7: Create Anime Storage Directory

```bash
mkdir -p ~/anime
```

---

## Step 8: Upload Anime Files

**From your local machine (Windows):**
1. Edit `scripts/upload-to-oracle.bat`
2. Set `ORACLE_IP` to your Oracle Cloud public IP
3. Run the script:
   ```cmd
   cd scripts
   upload-to-oracle.bat
   ```

**From your local machine (Mac/Linux with Git Bash):**
1. Edit `scripts/upload-to-oracle.sh`
2. Set `ORACLE_IP` to your Oracle Cloud public IP
3. Run the script:
   ```bash
   chmod +x scripts/upload-to-oracle.sh
   ./scripts/upload-to-oracle.sh
   ```

---

## Step 9: Configure Environment Variables

```bash
# On the Oracle Cloud instance
cd ~/pixelpulse
nano .env
```

Add your environment variables:
```
TELEGRAM_BOT_TOKEN=8657988536:AAEY_vH5WaBseYHOxs2Reb7wcN2NU0k3Z00
OWNPAY_IPN_KEY=WVapLMnLORCPaA7KHX4U6RgXHb5IJlUn
OWNPAY_API_KEY=D9B166B-M24MSZJ-QA84NPF-H723HH5
OWNPAY_PUBLIC_KEY=b49fd05b-8b8b-45e1-802e-6267a68bd60b
OWNPAY_BASE_URL=https://api.ownpayment.com
BTC_WALLET_ADDRESS=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
PORT=3000
ANIME_PATH=/home/ubuntu/anime
```

Save with `Ctrl+X`, then `Y`, then `Enter`

---

## Step 10: Update Video Paths in Database

```bash
# Run the import script to update video URLs
node src/import-anime.js
```

---

## Step 11: Start Application with PM2

```bash
# Start the main app
pm2 start src/index.js --name pixelpulse

# Start the bot
pm2 start bot.js --name pixelpulse-bot

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

Run the command that `pm2 startup` outputs (usually starts with `sudo env PATH=...`)

---

## Step 12: Configure Firewall

```bash
# Allow HTTP
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow HTTPS
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow SSH (keep this!)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Save iptables rules
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Step 13: Access Your Site

Your site is now available at:
```
http://YOUR_PUBLIC_IP:3000
```

Replace `YOUR_PUBLIC_IP` with your Oracle Cloud instance IP.

---

## Step 14: Optional - Set Up Domain

1. Buy a domain (e.g., from Namecheap, Porkbun)
2. Enable WHOIS privacy protection
3. Point domain to your Oracle Cloud IP (A record)
4. Install SSL with Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Step 15: Monitor Your Server

```bash
# View logs
pm2 logs pixelpulse

# View status
pm2 status

# Restart app
pm2 restart pixelpulse

# Stop app
pm2 stop pixelpulse
```

---

## Free Tier Limits

- **2 AMD VMs** with 1/8 OCPU, 1GB RAM each
- **200GB storage** (Block Volume)
- **10TB/month outbound transfer**
- **4TB/month inbound transfer**

---

## Troubleshooting

### Can't connect via SSH
- Check your IP is correct
- Check SSH key is uploaded correctly
- Check security list allows port 22

### App won't start
- Check logs: `pm2 logs pixelpulse`
- Check dependencies installed: `npm install`
- Check .env file exists and is correct

### Videos not loading
- Check anime files uploaded: `ls ~/anime`
- Check ANIME_PATH in .env is correct
- Check file permissions: `chmod -R 755 ~/anime`

### Out of storage
- Check usage: `df -h`
- Delete old anime if needed
- Upgrade to paid tier for more storage

---

## Next Steps

1. Upload your anime files
2. Test the site
3. Deploy bot to Railway (separate guide)
4. Set up domain and SSL
5. Configure security measures
