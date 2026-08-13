require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');

// Database setup - SQLite (simple, local)
const db = new Database('./data/pixelpulse.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE,
    username TEXT,
    subscription_status TEXT DEFAULT 'free',
    subscription_end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY,
    title TEXT,
    description TEXT,
    cover_image TEXT,
    genre TEXT,
    year INTEGER,
    rating TEXT,
    free_tier INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY,
    anime_id INTEGER,
    episode_number INTEGER,
    title TEXT,
    video_url TEXT,
    duration INTEGER,
    season INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anime_id) REFERENCES anime(id)
  );

  CREATE TABLE IF NOT EXISTS betting_markets (
    id INTEGER PRIMARY KEY,
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

  CREATE TABLE IF NOT EXISTS user_bets (
    id INTEGER PRIMARY KEY,
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

  CREATE TABLE IF NOT EXISTS user_balances (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE,
    btc_balance REAL DEFAULT 0,
    total_deposited REAL DEFAULT 0,
    total_withdrawn REAL DEFAULT 0,
    total_won REAL DEFAULT 0,
    total_lost REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
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

// Initialize OwnPay client (will be loaded dynamically)
let ownpay = null;

// Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Bot commands - Marketing & News Focus
bot.command('start', (ctx) => {
  const welcomeMessage = `
� Welcome to PixelPulse - Anime Streaming & Betting!

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

bot.command('markets', (ctx) => {
  const markets = db.prepare('SELECT * FROM betting_markets WHERE status = ? ORDER BY created_at DESC LIMIT 5').all('active');
  
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

bot.command('stats', (ctx) => {
  const totalAnime = db.prepare('SELECT COUNT(*) as count FROM anime').get().count;
  const totalEpisodes = db.prepare('SELECT COUNT(*) as count FROM episodes').get().count;
  const activeMarkets = db.prepare('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?').get('active').count;
  const totalVolume = db.prepare('SELECT COALESCE(SUM(total_volume), 0) as volume FROM betting_markets').get().volume;
  
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

// Express middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// API: Get anime catalogue
app.get('/api/anime', (req, res) => {
  const anime = db.prepare('SELECT * FROM anime ORDER BY created_at DESC').all();
  res.json(anime);
});

// API: Get anime episodes
app.get('/api/anime/:id/episodes', (req, res) => {
  const episodes = db.prepare('SELECT * FROM episodes WHERE anime_id = ? ORDER BY episode_number').all(req.params.id);
  res.json(episodes);
});

// API: Stream video file
app.get('/api/video/:episodeId', (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.episodeId);
  
  if (!episode) {
    return res.status(404).json({ error: 'Episode not found' });
  }
  
  const videoPath = episode.video_url;
  
  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }
  
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    // Handle range request for video streaming
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Send entire file
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// BETTING API ENDPOINTS

// API: Get all betting markets
app.get('/api/betting/markets', (req, res) => {
  const markets = db.prepare('SELECT * FROM betting_markets WHERE status = ? ORDER BY created_at DESC').all('active');
  res.json(markets);
});

// API: Get single market details
app.get('/api/betting/markets/:id', (req, res) => {
  const market = db.prepare('SELECT * FROM betting_markets WHERE id = ?').get(req.params.id);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  // Get betting volume for each option
  const bets = db.prepare('SELECT option, SUM(amount) as volume FROM user_bets WHERE market_id = ? GROUP BY option').all(req.params.id);
  
  market.options = JSON.parse(market.options);
  market.betting_volume = bets;
  
  res.json(market);
});

// API: Create new betting market (admin only)
app.post('/api/betting/markets', (req, res) => {
  const { title, description, category, options, end_date, fee_rate } = req.body;
  
  const result = db.prepare(`
    INSERT INTO betting_markets (title, description, category, options, end_date, fee_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, description, category, JSON.stringify(options), end_date, fee_rate || 0.02);
  
  res.json({ id: result.lastInsertRowid, message: 'Market created successfully' });
});

// API: Place a bet
app.post('/api/betting/bet', (req, res) => {
  const { userId, marketId, option, amount } = req.body;
  
  // Get market
  const market = db.prepare('SELECT * FROM betting_markets WHERE id = ?').get(marketId);
  if (!market || market.status !== 'active') {
    return res.status(400).json({ error: 'Market not available' });
  }
  
  // Get user balance
  let balance = db.prepare('SELECT * FROM user_balances WHERE user_id = ?').get(userId);
  if (!balance) {
    // Create balance for user
    const result = db.prepare('INSERT INTO user_balances (user_id) VALUES (?)').run(userId);
    balance = db.prepare('SELECT * FROM user_balances WHERE id = ?').get(result.lastInsertRowid);
  }
  
  if (balance.btc_balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  // Calculate potential payout (simple parimutuel)
  const fee = amount * market.fee_rate;
  const netAmount = amount - fee;
  
  // Deduct from balance
  db.prepare('UPDATE user_balances SET btc_balance = btc_balance - ? WHERE user_id = ?').run(amount, userId);
  
  // Record bet
  const result = db.prepare(`
    INSERT INTO user_bets (user_id, market_id, option, amount, potential_payout)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, marketId, option, amount, netAmount);
  
  // Update market volume
  db.prepare('UPDATE betting_markets SET total_volume = total_volume + ? WHERE id = ?').run(amount, marketId);
  
  // Record transaction
  db.prepare(`
    INSERT INTO transactions (user_id, type, amount, status)
    VALUES (?, 'bet', ?, 'completed')
  `).run(userId, amount);
  
  res.json({ 
    betId: result.lastInsertRowid, 
    message: 'Bet placed successfully',
    potentialPayout: netAmount
  });
});

// API: Get user bets
app.get('/api/betting/user/:userId/bets', (req, res) => {
  const bets = db.prepare(`
    SELECT ub.*, bm.title as market_title, bm.status as market_status
    FROM user_bets ub
    JOIN betting_markets bm ON ub.market_id = bm.id
    WHERE ub.user_id = ?
    ORDER BY ub.created_at DESC
  `).all(req.params.userId);
  
  res.json(bets);
});

// API: Get user balance
app.get('/api/betting/user/:userId/balance', (req, res) => {
  let balance = db.prepare('SELECT * FROM user_balances WHERE user_id = ?').get(req.params.userId);
  if (!balance) {
    balance = {
      btc_balance: 0,
      total_deposited: 0,
      total_withdrawn: 0,
      total_won: 0,
      total_lost: 0
    };
  }
  res.json(balance);
});

// API: Deposit crypto (BTCPay Server integration)
app.post('/api/betting/deposit', async (req, res) => {
  const { userId, amount, crypto } = req.body;
  
  try {
    // Create BTCPay invoice
    const response = await fetch(`${process.env.BTCPAY_URL}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${process.env.BTCPAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        currency: crypto || 'BTC',
        metadata: {
          userId: userId.toString(),
          orderId: `DEPOSIT-${userId}-${Date.now()}`
        }
      })
    });
    
    const invoice = await response.json();
    
    // Create deposit transaction
    const result = db.prepare(`
      INSERT INTO transactions (user_id, type, amount, btc_address, tx_hash, status)
      VALUES (?, 'deposit', ?, ?, ?, 'pending')
    `).run(userId, amount, process.env.BTC_WALLET_ADDRESS, invoice.id);
    
    res.json({ 
      transactionId: result.lastInsertRowid,
      message: 'Deposit initiated',
      checkoutUrl: invoice.checkoutUrl,
      invoiceId: invoice.id,
      btcAddress: process.env.BTC_WALLET_ADDRESS
    });
  } catch (error) {
    console.error('BTCPay error:', error);
    // Fallback to manual deposit
    const result = db.prepare(`
      INSERT INTO transactions (user_id, type, amount, btc_address, status)
      VALUES (?, 'deposit', ?, ?, 'pending')
    `).run(userId, amount, process.env.BTC_WALLET_ADDRESS);
    
    res.json({ 
      transactionId: result.lastInsertRowid,
      message: 'Deposit initiated (manual)',
      btcAddress: process.env.BTC_WALLET_ADDRESS
    });
  }
});

// API: BTCPay webhook handler
app.post('/webhook/btcpay', async (req, res) => {
  try {
    const { type, invoiceId } = req.body;
    
    if (type === 'InvoiceSettled') {
      // Get transaction by invoice ID
      const transaction = db.prepare('SELECT * FROM transactions WHERE tx_hash = ?').get(invoiceId);
      
      if (transaction && transaction.status === 'pending') {
        // Update transaction status
        db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('completed', transaction.id);
        
        // Update user balance
        db.prepare('UPDATE user_balances SET btc_balance = btc_balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?').run(transaction.amount, transaction.amount, transaction.user_id);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// API: Resolve market (admin only)
app.post('/api/betting/markets/:id/resolve', (req, res) => {
  const { resolution } = req.body;
  const marketId = req.params.id;
  
  // Update market status
  db.prepare('UPDATE betting_markets SET status = ?, resolution = ? WHERE id = ?').run('resolved', resolution, marketId);
  
  // Process winning bets
  const winningBets = db.prepare('SELECT * FROM user_bets WHERE market_id = ? AND option = ? AND status = ?').all(marketId, resolution, 'pending');
  
  winningBets.forEach(bet => {
    // Calculate payout (simplified - in production use proper parimutuel)
    const payout = bet.potential_payout;
    
    // Update user balance
    db.prepare('UPDATE user_balances SET btc_balance = btc_balance + ?, total_won = total_won + ? WHERE user_id = ?').run(payout, payout, bet.user_id);
    
    // Update bet status
    db.prepare('UPDATE user_bets SET status = ? WHERE id = ?').run('won', bet.id);
    
    // Record transaction
    db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)').run(bet.user_id, 'win', payout, 'completed');
  });
  
  // Mark losing bets
  db.prepare('UPDATE user_bets SET status = ? WHERE market_id = ? AND option != ? AND status = ?').run('lost', marketId, resolution, 'pending');
  
  res.json({ message: 'Market resolved successfully', winners: winningBets.length });
});

// ANALYTICS API ENDPOINTS

// API: Get platform analytics
app.get('/api/analytics', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalAnime = db.prepare('SELECT COUNT(*) as count FROM anime').get().count;
  const totalEpisodes = db.prepare('SELECT COUNT(*) as count FROM episodes').get().count;
  const activeMarkets = db.prepare('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?').get('active').count;
  const totalMarkets = db.prepare('SELECT COUNT(*) as count FROM betting_markets').get().count;
  const totalBets = db.prepare('SELECT COUNT(*) as count FROM user_bets').get().count;
  const totalVolume = db.prepare('SELECT SUM(total_volume) as volume FROM betting_markets').get().volume || 0;
  const totalFees = db.prepare('SELECT SUM(amount * fee_rate) as fees FROM betting_markets').get().fees || 0;
  const totalDeposits = db.prepare('SELECT SUM(amount) as deposits FROM transactions WHERE type = ? AND status = ?').get('deposit', 'completed').deposits || 0;
  const totalWithdrawals = db.prepare('SELECT SUM(amount) as withdrawals FROM transactions WHERE type = ? AND status = ?').get('withdraw', 'completed').withdrawals || 0;
  
  // Recent activity
  const recentBets = db.prepare(`
    SELECT ub.*, bm.title as market_title, u.username
    FROM user_bets ub
    JOIN betting_markets bm ON ub.market_id = bm.id
    JOIN users u ON ub.user_id = u.id
    ORDER BY ub.created_at DESC
    LIMIT 10
  `).all();
  
  // Top markets by volume
  const topMarkets = db.prepare(`
    SELECT *, (SELECT COUNT(*) FROM user_bets WHERE market_id = betting_markets.id) as bet_count
    FROM betting_markets
    ORDER BY total_volume DESC
    LIMIT 5
  `).all();
  
  res.json({
    users: {
      total: totalUsers,
      active: totalUsers // Simplified - in production track active users
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
    recentActivity: recentBets,
    topMarkets: topMarkets
  });
});

// API: Get market analytics
app.get('/api/analytics/markets/:id', (req, res) => {
  const marketId = req.params.id;
  
  const market = db.prepare('SELECT * FROM betting_markets WHERE id = ?').get(marketId);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const totalBets = db.prepare('SELECT COUNT(*) as count FROM user_bets WHERE market_id = ?').get(marketId).count;
  const totalVolume = db.prepare('SELECT SUM(amount) as volume FROM user_bets WHERE market_id = ?').get(marketId).volume || 0;
  
  // Bets by option
  const betsByOption = db.prepare(`
    SELECT option, COUNT(*) as count, SUM(amount) as volume
    FROM user_bets
    WHERE market_id = ?
    GROUP BY option
  `).all(marketId);
  
  // Recent bets
  const recentBets = db.prepare(`
    SELECT ub.*, u.username
    FROM user_bets ub
    JOIN users u ON ub.user_id = u.id
    WHERE ub.market_id = ?
    ORDER BY ub.created_at DESC
    LIMIT 10
  `).all(marketId);
  
  res.json({
    market,
    totalBets,
    totalVolume,
    betsByOption,
    recentBets
  });
});

// API: Check subscription status
app.get('/api/subscription/:telegramId', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.params.telegramId);
  if (!user) {
    return res.json({ subscribed: false });
  }
  
  const now = new Date().toISOString();
  const isSubscribed = user.subscription_status === 'premium' && user.subscription_end_date > now;
  res.json({ subscribed: isSubscribed, endDate: user.subscription_end_date });
});

// API: Create OwnPay payment
app.post('/api/create-payment', async (req, res) => {
  try {
    // Load OwnPay dynamically (ES module)
    if (!ownpay) {
      const OwnPayModule = await import('ownpay-nodejs');
      ownpay = new OwnPayModule.default({
        apiKey: process.env.OWNPAY_API_KEY,
        baseUrl: process.env.OWNPAY_BASE_URL || 'https://pay.ownpay.org'
      });
    }

    const { planType, telegramId } = req.body;
    
    const prices = {
      monthly: process.env.MONTHLY_PRICE || 50,
      quarterly: process.env.QUARTERLY_PRICE || 150,
      yearly: process.env.YEARLY_PRICE || 500
    };
    
    const price = prices[planType];
    
    // Create or get user
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (!user) {
      const result = db.prepare('INSERT INTO users (telegram_id, username, subscription_status) VALUES (?, ?, ?)').run(telegramId, 'user', 'free');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }
    
    // Create OwnPay payment
    const payment = await ownpay.payments.create({
      amount: price.toString(),
      currency: 'ZAR',
      description: `PixelPulse ${planType.charAt(0).toUpperCase() + planType.slice(1)} Subscription`,
      redirect_url: `${req.protocol}://${req.get('host')}/success?payment_id={PAYMENT_ID}&telegram_id=${telegramId}&plan=${planType}`,
      cancel_url: `${req.protocol}://${req.get('host')}/cancel`,
      callback_url: `${req.protocol}://${req.get('host')}/webhook`,
      reference: `PIXELPULSE-${telegramId}-${planType}-${Date.now()}`,
      metadata: {
        telegram_id: telegramId.toString(),
        plan_type: planType
      }
    });
    
    res.json({ url: payment.checkoutUrl, paymentId: payment.paymentId });
  } catch (error) {
    console.error('OwnPay error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// API: Handle successful payment
app.get('/success', async (req, res) => {
  const { payment_id, telegram_id, plan } = req.query;
  
  try {
    // Load OwnPay dynamically if needed
    if (!ownpay) {
      const OwnPayModule = await import('ownpay-nodejs');
      ownpay = new OwnPayModule.default({
        apiKey: process.env.OWNPAY_API_KEY,
        baseUrl: process.env.OWNPAY_BASE_URL || 'https://pay.ownpay.org'
      });
    }

    const payment = await ownpay.payments.get(payment_id);
    
    if (payment.status === 'completed' || payment.status === 'paid') {
      // Calculate subscription end date
      const now = new Date();
      let endDate;
      
      switch (plan) {
        case 'monthly':
          endDate = new Date(now.setMonth(now.getMonth() + 1));
          break;
        case 'quarterly':
          endDate = new Date(now.setMonth(now.getMonth() + 3));
          break;
        case 'yearly':
          endDate = new Date(now.setFullYear(now.getFullYear() + 1));
          break;
      }
      
      // Update user subscription
      db.prepare(`
        UPDATE users 
        SET subscription_status = 'premium', subscription_end_date = ?
        WHERE telegram_id = ?
      `).run(endDate.toISOString(), telegram_id);
      
      // Record subscription
      db.prepare(`
        INSERT INTO subscriptions (user_id, plan_type, amount_cents, status, start_date, end_date, stripe_subscription_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegram_id).id,
        plan,
        payment.amount,
        'active',
        new Date().toISOString(),
        endDate.toISOString(),
        payment_id
      );
      
      res.send(`
        <html>
          <head><title>Payment Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🎉 Payment Successful!</h1>
            <p>Your subscription is now active. You can now watch unlimited anime.</p>
            <p>Close this window and return to Telegram to continue.</p>
          </body>
        </html>
      `);
    } else {
      res.send('Payment is still processing. Please wait for confirmation.');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.send('Error verifying payment. Please contact support.');
  }
});

// API: Handle cancelled payment
app.get('/cancel', (req, res) => {
  res.send(`
    <html>
      <head><title>Payment Cancelled</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. You can try again anytime.</p>
        <p>Close this window and return to Telegram.</p>
      </body>
    </html>
  `);
});

// API: Add sample anime data (for testing)
app.post('/api/seed', (req, res) => {
  const sampleAnime = [
    {
      title: 'One Piece',
      description: 'A young pirate sets out to find the ultimate treasure and become the King of the Pirates.',
      cover_image: 'https://images.unsplash.com/photo-1607604276583-c1ebf0e4a3e7?w=400',
      genre: 'Action, Adventure',
      year: 1999,
      rating: 'TV-14',
      free_tier: 1
    },
    {
      title: 'Naruto',
      description: 'A young ninja strives to become the Hokage and earn the respect of his village.',
      cover_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
      genre: 'Action, Adventure',
      year: 2002,
      rating: 'TV-14',
      free_tier: 1
    },
    {
      title: 'Dragon Ball Z',
      description: 'Goku and his friends defend Earth against powerful villains using martial arts and super powers.',
      cover_image: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=400',
      genre: 'Action, Fantasy',
      year: 1989,
      rating: 'TV-14',
      free_tier: 1
    },
    {
      title: 'Attack on Titan',
      description: 'Humanity fights for survival against giant humanoid Titans that have brought civilization to the brink of extinction.',
      cover_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400',
      genre: 'Action, Drama',
      year: 2013,
      rating: 'TV-MA',
      free_tier: 0
    },
    {
      title: 'Demon Slayer',
      description: 'A young boy becomes a demon slayer after his family is slaughtered and his younger sister is turned into a demon.',
      cover_image: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=400',
      genre: 'Action, Fantasy',
      year: 2019,
      rating: 'TV-14',
      free_tier: 0
    },
    {
      title: 'My Hero Academia',
      description: 'In a world where most people have superpowers, a powerless boy dreams of becoming a hero.',
      cover_image: 'https://images.unsplash.com/photo-1607604276583-c1ebf0e4a3e7?w=400',
      genre: 'Action, Comedy',
      year: 2016,
      rating: 'TV-14',
      free_tier: 0
    },
    {
      title: 'Jujutsu Kaisen',
      description: 'A boy swallows a cursed talisman and becomes host to a powerful demon, joining a secret organization of sorcerers.',
      cover_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
      genre: 'Action, Supernatural',
      year: 2020,
      rating: 'TV-MA',
      free_tier: 0
    }
  ];

  sampleAnime.forEach(anime => {
    const existing = db.prepare('SELECT * FROM anime WHERE title = ?').get(anime.title);
    if (!existing) {
      const result = db.prepare(`
        INSERT INTO anime (title, description, cover_image, genre, year, rating, free_tier)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(anime.title, anime.description, anime.cover_image, anime.genre, anime.year, anime.rating, anime.free_tier);
      
      // Add sample episodes
      for (let i = 1; i <= 3; i++) {
        db.prepare(`
          INSERT INTO episodes (anime_id, episode_number, title, video_url, duration)
          VALUES (?, ?, ?, ?, ?)
        `).run(result.lastInsertRowid, i, `Episode ${i}`, `https://example.com/video${i}.mp4`, 1440);
      }
    }
  });

  res.json({ message: 'Sample data added successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`PixelPulse server running on port ${PORT}`);
});

// Start Telegram bot
bot.launch().then(() => {
  console.log('Telegram bot started');
}).catch(err => {
  console.error('Failed to start bot:', err);
});
