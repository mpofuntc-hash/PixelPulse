require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');

// Initialize OwnPay client (will be loaded dynamically)
let ownpay = null;

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
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        plan_type TEXT,
        amount_cents INTEGER,
        status TEXT,
        start_date TEXT,
        end_date TEXT,
        stripe_subscription_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
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

// Initialize database on startup
initDatabase();

// Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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

🔗 Start now: https://cold-showers-shake.loca.lt

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
    
    message += '🔗 Bet now: https://cold-showers-shake.loca.lt';
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

🔗 Website: https://cold-showers-shake.loca.lt

For support, contact: @PixelPulseSupport
  `;
  ctx.reply(helpMessage);
});

// Handle text messages
bot.on('text', (ctx) => {
  ctx.reply('Use /help to see available commands. Visit https://cold-showers-shake.loca.lt for anime streaming and betting!');
});

// Start bot (only if not in Vercel serverless)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  bot.launch()
    .then(() => console.log('Bot started successfully'))
    .catch(err => console.error('Error starting bot:', err));
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API: Get all anime
app.get('/api/anime', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM anime ORDER BY title');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching anime:', error);
    res.status(500).json({ error: 'Failed to fetch anime' });
  }
});

// API: Get anime by ID
app.get('/api/anime/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM anime WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anime not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching anime:', error);
    res.status(500).json({ error: 'Failed to fetch anime' });
  }
});

// API: Get episodes for anime
app.get('/api/anime/:id/episodes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM episodes WHERE anime_id = $1 ORDER BY season, episode_number', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

// API: Get betting markets
app.get('/api/betting/markets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM betting_markets WHERE status = $1 ORDER BY created_at DESC', ['active']);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// API: Place bet
app.post('/api/betting/bet', async (req, res) => {
  try {
    const { userId, marketId, option, amount } = req.body;
    
    // Get market
    const marketResult = await pool.query('SELECT * FROM betting_markets WHERE id = $1', [marketId]);
    const market = marketResult.rows[0];
    
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Calculate potential payout (2% fee)
    const fee = amount * market.fee_rate;
    const potentialPayout = amount - fee;
    
    // Check user balance
    const balanceResult = await pool.query('SELECT * FROM user_balances WHERE user_id = $1', [userId]);
    let balance = balanceResult.rows[0];
    
    if (!balance) {
      // Create balance for new user
      await pool.query('INSERT INTO user_balances (user_id, btc_balance) VALUES ($1, 0)', [userId]);
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    if (balance.btc_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct from balance
    await pool.query('UPDATE user_balances SET btc_balance = btc_balance - $1 WHERE user_id = $2', [amount, userId]);
    
    // Record bet
    const betResult = await pool.query(
      'INSERT INTO user_bets (user_id, market_id, option, amount, potential_payout) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, marketId, option, amount, potentialPayout]
    );
    
    // Update market volume
    await pool.query('UPDATE betting_markets SET total_volume = total_volume + $1 WHERE id = $2', [amount, marketId]);
    
    // Record transaction
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, $2, $3, $4)',
      [userId, 'bet', amount, 'completed']
    );
    
    res.json({ success: true, bet: betResult.rows[0] });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// API: Get user bets
app.get('/api/betting/bets/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_bets WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// API: Get user balance
app.get('/api/betting/balance/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_balances WHERE user_id = $1', [req.params.userId]);
    if (result.rows.length === 0) {
      return res.json({ btc_balance: 0, total_deposited: 0, total_won: 0 });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// API: Deposit (OwnPayment)
app.post('/api/betting/deposit', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    // Dynamic import of OwnPay
    const OwnPayModule = await import('ownpay-nodejs');
    const ownpay = new OwnPayModule.default({ 
      apiKey: process.env.OWNPAY_API_KEY, 
      baseUrl: process.env.OWNPAY_BASE_URL 
    });
    
    const payment = await ownpay.payments.create({
      amount: amount,
      currency: 'BTC',
      redirect_url: `${req.headers.host}/success`,
      cancel_url: `${req.headers.host}/cancel`,
      callback_url: `${req.headers.host}/webhook/ownpay`,
      reference: `deposit_${userId}_${Date.now()}`,
      metadata: { userId, type: 'deposit' }
    });
    
    res.json({ url: payment.checkoutUrl, paymentId: payment.paymentId });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// API: Resolve market (admin only)
app.post('/api/betting/markets/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    const marketId = req.params.id;
    
    // Update market status
    await pool.query('UPDATE betting_markets SET status = $1, resolution = $2 WHERE id = $3', ['resolved', resolution, marketId]);
    
    // Process winning bets
    const winningBetsResult = await pool.query(
      'SELECT * FROM user_bets WHERE market_id = $1 AND option = $2 AND status = $3',
      [marketId, resolution, 'pending']
    );
    const winningBets = winningBetsResult.rows;
    
    for (const bet of winningBets) {
      const payout = bet.potential_payout;
      
      // Update user balance
      await pool.query('UPDATE user_balances SET btc_balance = btc_balance + $1, total_won = total_won + $1 WHERE user_id = $2', [payout, bet.user_id]);
      
      // Update bet status
      await pool.query('UPDATE user_bets SET status = $1 WHERE id = $2', ['won', bet.id]);
      
      // Record transaction
      await pool.query('INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, $2, $3, $4)', [bet.user_id, 'win', payout, 'completed']);
    }
    
    // Mark losing bets
    await pool.query('UPDATE user_bets SET status = $1 WHERE market_id = $2 AND option != $3 AND status = $4', ['lost', marketId, resolution, 'pending']);
    
    res.json({ message: 'Market resolved successfully', winners: winningBets.length });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

// ANALYTICS API ENDPOINTS

// API: Get platform analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const totalUsers = (await pool.query('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalAnime = (await pool.query('SELECT COUNT(*) as count FROM anime')).rows[0].count;
    const totalEpisodes = (await pool.query('SELECT COUNT(*) as count FROM episodes')).rows[0].count;
    const activeMarkets = (await pool.query('SELECT COUNT(*) as count FROM betting_markets WHERE status = $1', ['active'])).rows[0].count;
    const totalMarkets = (await pool.query('SELECT COUNT(*) as count FROM betting_markets')).rows[0].count;
    const totalBets = (await pool.query('SELECT COUNT(*) as count FROM user_bets')).rows[0].count;
    const totalVolume = (await pool.query('SELECT SUM(total_volume) as volume FROM betting_markets')).rows[0].volume || 0;
    const totalFees = (await pool.query('SELECT SUM(amount * fee_rate) as fees FROM betting_markets')).rows[0].fees || 0;
    const totalDeposits = (await pool.query('SELECT SUM(amount) as deposits FROM transactions WHERE type = $1 AND status = $2', ['deposit', 'completed'])).rows[0].deposits || 0;
    const totalWithdrawals = (await pool.query('SELECT SUM(amount) as withdrawals FROM transactions WHERE type = $1 AND status = $2', ['withdraw', 'completed'])).rows[0].withdrawals || 0;
    
    // Recent activity
    const recentBetsResult = await pool.query(`
      SELECT ub.*, bm.title as market_title, u.username
      FROM user_bets ub
      JOIN betting_markets bm ON ub.market_id = bm.id
      JOIN users u ON ub.user_id = u.id
      ORDER BY ub.created_at DESC
      LIMIT 10
    `);
    
    // Top markets by volume
    const topMarketsResult = await pool.query(`
      SELECT *, (SELECT COUNT(*) FROM user_bets WHERE market_id = betting_markets.id) as bet_count
      FROM betting_markets
      ORDER BY total_volume DESC
      LIMIT 5
    `);
    
    res.json({
      users: {
        total: totalUsers,
        active: totalUsers
      },
      content: {
        anime: totalAnime,
        episodes: totalEpisodes
      },
      betting: {
        activeMarkets,
        totalMarkets,
        totalBets,
        totalVolume,
        totalFees
      },
      finance: {
        totalDeposits,
        totalWithdrawals,
        netRevenue: totalFees
      },
      recentActivity: recentBetsResult.rows,
      topMarkets: topMarketsResult.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// API: Get market analytics
app.get('/api/analytics/markets/:id', async (req, res) => {
  try {
    const marketId = req.params.id;
    
    const marketResult = await pool.query('SELECT * FROM betting_markets WHERE id = $1', [marketId]);
    const market = marketResult.rows[0];
    
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    const totalBets = (await pool.query('SELECT COUNT(*) as count FROM user_bets WHERE market_id = $1', [marketId])).rows[0].count;
    const totalVolume = (await pool.query('SELECT SUM(amount) as volume FROM user_bets WHERE market_id = $1', [marketId])).rows[0].volume || 0;
    
    // Bets by option
    const betsByOptionResult = await pool.query(`
      SELECT option, COUNT(*) as count, SUM(amount) as volume
      FROM user_bets
      WHERE market_id = $1
      GROUP BY option
    `, [marketId]);
    
    // Recent bets
    const recentBetsResult = await pool.query(`
      SELECT ub.*, u.username
      FROM user_bets ub
      JOIN users u ON ub.user_id = u.id
      WHERE ub.market_id = $1
      ORDER BY ub.created_at DESC
      LIMIT 10
    `, [marketId]);
    
    res.json({
      market,
      totalBets,
      totalVolume,
      betsByOption: betsByOptionResult.rows,
      recentBets: recentBetsResult.rows
    });
  } catch (error) {
    console.error('Error fetching market analytics:', error);
    res.status(500).json({ error: 'Failed to fetch market analytics' });
  }
});

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export for Vercel serverless
module.exports = app;

// Start server only if not in Vercel
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`PixelPulse server running on port ${PORT}`);
  });
}
