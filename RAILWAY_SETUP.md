# Railway Telegram Bot Setup Guide

## Overview
Deploy the PixelPulse Telegram bot to Railway for persistent, always-on service.

---

## Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Verify your email

---

## Step 2: Prepare Bot-Only Code

### 2.1 Create `bot.js`
Create a separate file for the bot (not the full app):

```javascript
const Telegraf = require('telegraf');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Bot commands - Marketing & News Focus
bot.command('start', (ctx) => {
  const welcomeMessage = `
🎰 Welcome to PixelPulse - Anime Streaming & Betting!

📺 FREE Anime Streaming
• 22+ anime series
• 560+ episodes
• No subscription required

🎲 BETTING MARKETS
• Predict anime outcomes
• Win BTC prizes
• 2% flat fee on all bets

🔗 Start now: https://your-vercel-app.vercel.app

Commands:
/markets - View active betting markets
/news - Latest anime news
/stats - Platform statistics
/help - Get help
  `;
  ctx.reply(welcomeMessage);
});

bot.command('markets', async (ctx) => {
  try {
    const result = await pool.query(
      'SELECT * FROM betting_markets WHERE status = $1 ORDER BY created_at DESC LIMIT 5',
      ['active']
    );
    const markets = result.rows;
    
    if (markets.length === 0) {
      ctx.reply('No active markets right now. Check back later!');
      return;
    }
    
    let message = '🎲 Active Betting Markets:\n\n';
    markets.forEach((market, index) => {
      const options = JSON.parse(market.options).join(', ');
      message += `${index + 1}. ${market.title}\n   Options: ${options}\n   Ends: ${new Date(market.end_date).toLocaleDateString()}\n\n`;
    });
    
    message += '🔗 Bet now: https://your-vercel-app.vercel.app';
    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching markets:', error);
    ctx.reply('Error fetching markets. Please try again later.');
  }
});

bot.command('news', (ctx) => {
  const newsMessage = `
📰 Latest Anime News

🔥 HOT: New betting markets added!
• One Piece continuation prediction
• Jujutsu Kaisen final villain poll
• Demon Slayer Season 4 release date

📺 NEW UPLOADS:
• Attack on Titan Junior High (12 eps)
• Hunter x Hunter (148 eps)
• Jujutsu Kaisen Season 1 (18 eps)

🎲 TIP: Bet on anime you know best!
  `;
  ctx.reply(newsMessage);
});

bot.command('stats', async (ctx) => {
  try {
    const totalAnime = (await pool.query('SELECT COUNT(*) as count FROM anime')).rows[0].count;
    const totalEpisodes = (await pool.query('SELECT COUNT(*) as count FROM episodes')).rows[0].count;
    const activeMarkets = (await pool.query('SELECT COUNT(*) as count FROM betting_markets WHERE status = $1', ['active'])).rows[0].count;
    const totalVolume = (await pool.query('SELECT COALESCE(SUM(total_volume), 0) as volume FROM betting_markets')).rows[0].volume;
    
    const statsMessage = `
📊 Platform Statistics

📺 Content:
• ${totalAnime} Anime Series
• ${totalEpisodes} Episodes

🎲 Betting:
• ${activeMarkets} Active Markets
• ${totalVolume.toFixed(4)} BTC Total Volume

👥 Community growing daily!
  `;
    ctx.reply(statsMessage);
  } catch (error) {
    console.error('Error fetching stats:', error);
    ctx.reply('Error fetching statistics. Please try again later.');
  }
});

bot.command('help', (ctx) => {
  const helpMessage = `
🆘 Help & Commands

/start - Welcome message
/markets - View betting markets
/news - Latest anime news
/stats - Platform statistics
/help - This help message

🔗 Website: https://your-vercel-app.vercel.app

For support, contact: @PixelPulseSupport
  `;
  ctx.reply(helpMessage);
});

// Handle text messages
bot.on('text', (ctx) => {
  ctx.reply('Use /help to see available commands. Visit https://your-vercel-app.vercel.app for anime streaming and betting!');
});

// Start bot
bot.launch()
  .then(() => console.log('Bot started successfully'))
  .catch(err => console.error('Error starting bot:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

### 2.2 Update `package.json`
Add bot-specific script:

```json
{
  "name": "pixelpulse",
  "version": "1.0.0",
  "description": "PixelPulse - Anime Streaming & Betting Platform",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "bot": "node bot.js",
    "seed": "node src/seed-betting-markets.js",
    "import": "node src/import-anime.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "telegraf": "^4.16.3",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3"
  }
}
```

---

## Step 3: Deploy to Railway

### 3.1 Install Railway CLI
```bash
npm install -g @railway/cli
```

### 3.2 Login to Railway
```bash
railway login
```

### 3.3 Initialize Project
```bash
railway init
```

Follow the prompts:
- Project name: pixelpulse-bot
- Select: Empty project

### 3.4 Add Environment Variables
```bash
railway variables set TELEGRAM_BOT_TOKEN=8657988536:AAEY_vH5WaBseYHOxs2Reb7wcN2NU0k3Z00
railway variables set DATABASE_URL=postgresql://neondb_owner:npg_romK0N2VdvQM@ep-broad-pond-avft85az-pooler.c-11.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

Or use Railway Dashboard:
1. Go to your project in Railway
2. Settings → Variables
3. Add:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from BotFather
   - `DATABASE_URL`: Your Vercel Postgres connection string

### 3.5 Deploy
```bash
railway up
```

Or use Railway Dashboard:
1. Click "New Service" → "Deploy from GitHub"
2. Select your PixelPulse repository
3. Railway will auto-detect Node.js
4. Set start command: `npm run bot`

---

## Step 4: Configure Database Connection

### 4.1 Get Vercel Postgres URL
1. Vercel Dashboard → Storage → Your Database
2. Copy connection string
3. Add to Railway environment variables

### 4.2 Test Connection
Railway will automatically test the connection. If it fails:
- Check DATABASE_URL format
- Ensure Vercel Postgres allows external connections
- Verify IP whitelist settings

---

## Step 5: Monitor Bot

### 5.1 View Logs
```bash
railway logs
```

### 5.2 View Metrics
Railway Dashboard → Your Project → Metrics

### 5.3 Set Up Alerts
Railway Dashboard → Your Project → Alerts
- CPU usage > 80%
- Memory usage > 80%
- Error rate > 5%

---

## Step 6: Update Webhook URL

After deployment, update the bot's welcome message with your Vercel URL:

```javascript
// In bot.js, replace:
🔗 Start now: https://your-vercel-app.vercel.app
```

With your actual Vercel URL.

---

## Troubleshooting

### Bot Not Responding
- Check TELEGRAM_BOT_TOKEN is correct
- Verify bot is running: `railway logs`
- Check for errors in logs

### Database Connection Errors
- Verify DATABASE_URL format
- Check Vercel Postgres allows external connections
- Test connection locally first

### Bot Crashes
- Check logs for error messages
- Ensure all dependencies are installed
- Verify environment variables are set

### Memory Issues
- Upgrade Railway plan if needed
- Optimize database queries
- Implement caching

---

## Cost

- **Railway**: $5/month (Hobby plan)
- Includes:
  - 512MB RAM
  - 0.5 vCPU
  - 1GB storage
  - Always-on service

---

## Scaling

If you need more resources:
1. Railway Dashboard → Your Project → Settings
2. Upgrade plan:
   - Pro: $20/month (2GB RAM, 1 vCPU)
   - Team: $50/month (4GB RAM, 2 vCPU)

---

## Alternative: Use Your Existing VPS

If you already have a VPS (DigitalOcean, Linode, etc.):

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone repository
git clone https://github.com/mpofuntc-hash/PixelPulse.git
cd PixelPulse

# Install dependencies
npm install

# Set environment variables
export TELEGRAM_BOT_TOKEN=your_token
export DATABASE_URL=your_db_url

# Run bot
npm run bot

# Use PM2 for persistence
npm install -g pm2
pm2 start bot.js --name pixelpulse-bot
pm2 startup
pm2 save
```

---

## Next Steps

1. Deploy bot to Railway
2. Test all bot commands
3. Monitor logs for errors
4. Set up alerts
5. Update welcome message with Vercel URL

---

## Quick Reference

**Your Credentials:**
- Telegram Bot Token: `8657988536:AAEY_vH5WaBseYHOxs2Reb7wcN2NU0k3Z00`
- Neon Database URL: `postgresql://neondb_owner:npg_romK0N2VdvQM@ep-broad-pond-avft85az-pooler.c-11.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require`

**Railway Settings:**
- Start Command: `npm run bot`
- Environment Variables: Set both above
