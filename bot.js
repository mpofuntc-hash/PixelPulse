require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Database setup - Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        subscription_status TEXT DEFAULT 'free',
        subscription_end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS anime (
        id SERIAL PRIMARY KEY,
        title TEXT,
        description TEXT,
        cover_image TEXT,
        genre TEXT,
        year INTEGER,
        rating TEXT,
        free_tier INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        anime_id INTEGER,
        episode_number INTEGER,
        title TEXT,
        video_url TEXT,
        duration INTEGER,
        season INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (anime_id) REFERENCES anime(id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS betting_markets (
        id SERIAL PRIMARY KEY,
        title TEXT,
        description TEXT,
        category TEXT,
        options TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        resolution TEXT,
        total_volume REAL DEFAULT 0,
        fee_rate REAL DEFAULT 0.02,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_bets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        market_id INTEGER,
        option TEXT,
        amount REAL,
        potential_payout REAL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (market_id) REFERENCES betting_markets(id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        btc_balance REAL DEFAULT 0,
        total_deposited REAL DEFAULT 0,
        total_withdrawn REAL DEFAULT 0,
        total_won REAL DEFAULT 0,
        total_lost REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        type TEXT,
        amount REAL,
        btc_address TEXT,
        tx_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

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
    const result = await pool.query('SELECT * FROM betting_markets WHERE status = $1 ORDER BY created_at DESC LIMIT 5', ['active']);
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
async function startBot() {
  await initDatabase();
  bot.launch()
    .then(() => console.log('Bot started successfully'))
    .catch(err => console.error('Error starting bot:', err));
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
