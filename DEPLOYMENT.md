# PixelPulse Deployment Guide

## Overview
PixelPulse is deployed across multiple services for optimal performance and cost:
- **Vercel**: Frontend + API (serverless functions)
- **Cloudflare R2**: Video storage (cheap, no egress fees)
- **Railway**: Telegram bot (persistent server)
- **Vercel Postgres**: Database (or PlanetScale)

---

## Step 1: Vercel Deployment

### 1.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Install Vercel CLI: `npm i -g vercel`

### 1.2 Deploy to Vercel
```bash
# From your PixelPulse directory
vercel login
vercel
```

Follow the prompts:
- Link to existing project? No
- Project name: pixelpulse
- Directory: ./
- Override settings? No

### 1.3 Configure Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

```
TELEGRAM_BOT_TOKEN=your_bot_token
BTCPAY_URL=https://your-btcpay-server.com
BTCPAY_STORE_ID=your_store_id
BTCPAY_API_KEY=your_api_key
BTC_WALLET_ADDRESS=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
DATABASE_URL=postgres://user:password@host:port/database
```

### 1.4 Set Up Database
**Option A: Vercel Postgres (Recommended)**
1. Vercel Dashboard → Storage → Create Database
2. Select Postgres
3. Copy DATABASE_URL to environment variables

**Option B: PlanetScale**
1. Go to [planetscale.com](https://planetscale.com)
2. Create database
3. Get connection string
4. Add to Vercel environment variables

### 1.5 Migrate Database Schema
The current SQLite schema needs to be converted to Postgres. Run this in your Postgres database:

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id INTEGER UNIQUE,
  username TEXT,
  subscription_status TEXT DEFAULT 'free',
  subscription_end_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Anime table
CREATE TABLE anime (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_free_tier INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Episodes table
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  anime_id INTEGER REFERENCES anime(id),
  title TEXT,
  season INTEGER,
  episode_number INTEGER,
  file_path TEXT,
  duration INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Betting markets table
CREATE TABLE betting_markets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'anime',
  options TEXT NOT NULL,
  end_date TEXT NOT NULL,
  fee_rate REAL DEFAULT 0.02,
  status TEXT DEFAULT 'active',
  resolution TEXT,
  total_volume REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User bets table
CREATE TABLE user_bets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  market_id INTEGER REFERENCES betting_markets(id),
  option TEXT NOT NULL,
  amount REAL NOT NULL,
  potential_payout REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User balances table
CREATE TABLE user_balances (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  btc_balance REAL DEFAULT 0,
  total_deposited REAL DEFAULT 0,
  total_withdrawn REAL DEFAULT 0,
  total_won REAL DEFAULT 0,
  total_lost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  btc_address TEXT,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Step 2: Cloudflare R2 Setup (Video Storage)

### 2.1 Create Cloudflare Account
1. Go to [cloudflare.com](https://cloudflare.com)
2. Sign up for free account

### 2.2 Create R2 Bucket
1. Cloudflare Dashboard → R2 → Create Bucket
2. Bucket name: pixelpulse-videos
3. Region: Auto (closest to users)

### 2.3 Get API Credentials
1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API Token with permissions:
   - Object Read
   - Object Write
   - List Objects
3. Save Access Key ID and Secret Access Key

### 2.4 Configure Environment Variables
Add to Vercel environment variables:
```
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=pixelpulse-videos
```

### 2.5 Upload Videos
**Option A: Web Interface**
1. Cloudflare Dashboard → R2 → pixelpulse-videos
2. Upload video files directly

**Option B: AWS CLI (for bulk upload)**
```bash
# Install AWS CLI
npm install -g aws-cli

# Configure
aws configure
# Enter your Cloudflare R2 credentials
# Region: auto
# Output format: json

# Upload videos
aws s3 sync E:\PixelPulse s3://pixelpulse-videos --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

### 2.6 Enable Public Access
1. Cloudflare Dashboard → R2 → pixelpulse-videos → Settings
2. Enable "Public Access"
3. Videos will be accessible at: `https://pub-<account-id>.r2.dev/<filename>`

---

## Step 3: Railway Deployment (Telegram Bot)

### 3.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 3.2 Deploy Telegram Bot
1. Click "New Project" → "Deploy from GitHub"
2. Select your PixelPulse repository
3. Railway will detect Node.js project
4. Configure environment variables:
```
TELEGRAM_BOT_TOKEN=your_bot_token
DATABASE_URL=postgres://user:password@host:port/database
```

### 3.3 Modify for Bot-Only Deployment
Create `bot.js` (separate from main app):
```javascript
const Telegraf = require('telegraf');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Bot commands here (same as current implementation)

bot.launch();
```

Update `package.json`:
```json
{
  "scripts": {
    "start": "node bot.js"
  }
}
```

### 3.4 Deploy
```bash
railway login
railway init
railway up
```

---

## Step 4: BTCPay Server Setup

### 4.1 Install BTCPay Server
**Option A: Self-Hosted (Recommended)**
1. Deploy BTCPay Server on VPS (DigitalOcean, Linode)
2. Follow [BTCPay Server docs](https://docs.btcpayserver.org/)
3. Create store and get API credentials

**Option B: Hosted Service**
1. Use [BTCPay Server hosted](https://hosted.btcpayserver.org/)
2. Pay monthly fee (~$50/month)

### 4.2 Configure Webhook
1. BTCPay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-vercel-app.vercel.app/webhook/btcpay`
3. Select events: InvoiceSettled

### 4.3 Add to Environment Variables
```
BTCPAY_URL=https://your-btcpay-server.com
BTCPAY_STORE_ID=your_store_id
BTCPAY_API_KEY=your_api_key
```

---

## Step 5: Update Video Streaming

### 5.1 Update Database
Update episodes table to use R2 URLs:
```sql
UPDATE episodes SET file_path = 'https://pub-<account-id>.r2.dev/' || file_path;
```

### 5.2 Update Streaming Endpoint
The current `/api/video/:episodeId` endpoint will work with R2 URLs since they're public.

---

## Step 6: Testing

### 6.1 Test Vercel Deployment
```bash
# Check deployment
vercel --prod

# View logs
vercel logs --prod
```

### 6.2 Test Railway Bot
```bash
# Check logs
railway logs
```

### 6.3 Test R2 Access
Try accessing a video URL in browser:
```
https://pub-<account-id>.r2.dev/anime-title-episode-1.mp4
```

---

## Cost Breakdown (Monthly)

- **Vercel**: Free (Hobby plan)
- **Cloudflare R2**: 
  - Storage: $0.015/GB/month
  - Egress: Free (unlimited!)
- **Railway**: $5/month (bot)
- **Vercel Postgres**: Free (Hobby plan) or $20/month (Pro)
- **BTCPay Server**: $0 (self-hosted) or $50/month (hosted)

**Estimated monthly cost**: $5-25/month depending on choices

---

## Troubleshooting

### Vercel Issues
- **Function timeout**: Increase timeout in vercel.json
- **Database connection**: Check DATABASE_URL format
- **Environment variables**: Verify all are set in Vercel dashboard

### R2 Issues
- **403 errors**: Check public access is enabled
- **Slow uploads**: Use AWS CLI for bulk uploads
- **CORS errors**: Configure CORS in R2 settings

### Railway Issues
- **Bot not responding**: Check TELEGRAM_BOT_TOKEN
- **Database errors**: Verify DATABASE_URL
- **Memory limits**: Upgrade plan if needed

---

## Next Steps

1. Deploy to Vercel
2. Set up Cloudflare R2
3. Upload videos to R2
4. Deploy bot to Railway
5. Configure BTCPay Server
6. Test all integrations
7. Launch!
