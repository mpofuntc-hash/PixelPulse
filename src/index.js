require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const express = require('express');
const bcrypt = require('bcryptjs');
const app = express();

process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err && err.stack ? err.stack : err);
});

const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');
const https = require('https');

// Avatar & Banner System
const { AVATARS, BANNERS, getPixelationLevel, getBlurFromLevel, canUnlockAvatar, canUnlockBanner } = require('./avatar-system');

// Database setup - SQLite (sqlite3 for Node v24 compatibility)
const sqlite3 = require('sqlite3').verbose();
const dataDirectory = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}
const db = new sqlite3.Database(path.join(dataDirectory, 'pixelpulse.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Database connected');
});

// Helper function to run queries synchronously (wrap in promise)
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureSchemaColumn(tableName, columnName, definition) {
  const columns = await dbAll(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  await dbExec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`Migrated ${tableName}.${columnName}`);
}

async function ensureLegacySchema() {
  const requiredColumns = [
    ['users', 'email', 'TEXT'],
    ['users', 'password_hash', 'TEXT'],
    ['users', 'username', 'TEXT'],
    ['users', 'is_adult', 'INTEGER DEFAULT 0'],
    ['users', 'subscription_status', "TEXT DEFAULT 'free'"],
    ['users', 'game_points', 'INTEGER DEFAULT 0'],
    ['users', 'steam_tokens', 'REAL DEFAULT 0'],
    ['users', 'standoff2_tokens', 'REAL DEFAULT 0'],
    ['users', 'robux_tokens', 'REAL DEFAULT 0'],
    ['users', 'vbucks_tokens', 'REAL DEFAULT 0'],
    ['users', 'pubg_uc_tokens', 'REAL DEFAULT 0'],
    ['users', 'valorant_vp_tokens', 'REAL DEFAULT 0'],
    ['users', 'genshin_crystals_tokens', 'REAL DEFAULT 0'],
    ['users', 'freefire_diamonds_tokens', 'REAL DEFAULT 0'],
    ['users', 'discord_id', 'TEXT'],
    ['users', 'referred_by', 'TEXT'],
    ['chat_messages', 'source', "TEXT DEFAULT 'webapp'"],
    ['skins', 'price_fiat', 'REAL DEFAULT 0'],
    ['skins', 'fiat_currency', "TEXT DEFAULT ''"],
    ['admin_users', 'email', 'TEXT'],
    ['admin_users', 'password_hash', 'TEXT'],
    ['admin_users', 'is_one_time_password', 'INTEGER DEFAULT 1'],
    ['betting_markets', 'fee_rate', 'REAL DEFAULT 0.02'],
    ['betting_markets', 'total_volume', 'REAL DEFAULT 0'],
    ['betting_markets', 'bet_type', "TEXT DEFAULT 'simple'"],
    ['betting_markets', 'api_source', 'TEXT'],
    ['betting_markets', 'api_event_id', 'TEXT'],
    ['betting_markets', 'resolution_value', 'TEXT'],
    ['betting_markets', 'parent_market_id', 'INTEGER'],
    ['betting_markets', 'layer_depth', 'INTEGER DEFAULT 0'],
    ['betting_markets', 'condition_logic', 'TEXT'],
    ['user_balances', 'btc_balance', 'REAL DEFAULT 0'],
    ['user_profiles', 'username', 'TEXT'],
    ['user_profiles', 'avatar_id', "TEXT DEFAULT 'male_default'"],
    ['user_profiles', 'banner_id', "TEXT DEFAULT 'bronze_cloth'"],
    ['user_profiles', 'pixelation_level', 'INTEGER DEFAULT 8'],
    ['user_profiles', 'dragon_id', 'TEXT'],
    ['user_profiles', 'weekly_streak', 'INTEGER DEFAULT 0'],
    ['user_profiles', 'max_streak', 'INTEGER DEFAULT 0'],
    ['user_profiles', 'clip_wins', 'INTEGER DEFAULT 0'],
    ['user_profiles', 'username_changed_at', 'TEXT'],
    ['user_points', 'points', 'INTEGER DEFAULT 0'],
    ['sessions', 'session_token', 'TEXT'],
    ['sessions', 'expires_at', 'TEXT'],
    ['token_conversions', 'wallet_address', 'TEXT'],
    ['token_conversions', 'target_currency', 'TEXT'],
    ['token_conversions', 'tx_hash', 'TEXT'],
    ['token_conversions', 'paid_at', 'TEXT'],
    ['users', 'preferred_currency', "TEXT DEFAULT 'USD'"],
    ['skin_transactions', 'price_usd', 'REAL'],
    ['skin_transactions', 'buyer_currency', 'TEXT'],
    ['skin_transactions', 'price_in_buyer_currency', 'REAL'],
    ['token_deposits', 'estimated_usd_value', 'REAL'],
    ['token_deposits', 'is_high_value', 'INTEGER DEFAULT 0']
  ];

  for (const [tableName, columnName, definition] of requiredColumns) {
    try {
      await ensureSchemaColumn(tableName, columnName, definition);
    } catch (error) {
      console.warn(`Schema migration skipped for ${tableName}.${columnName}:`, error.message);
    }
  }
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`HTTP ${response.statusCode}`));
          resolve(JSON.parse(data));
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

// Deposits at or above this USD-equivalent value are flagged for admin attention
// (e.g. worth personally reselling on Steam/third-party markets rather than letting sit).
const HIGH_VALUE_DEPOSIT_THRESHOLD_USD = parseFloat(process.env.HIGH_VALUE_DEPOSIT_THRESHOLD_USD) || 200;

// Supported currencies
const SUPPORTED_CURRENCIES = {
  'USD': { symbol: '$', type: 'fiat' },
  'EUR': { symbol: '€', type: 'fiat' },
  'GBP': { symbol: '£', type: 'fiat' },
  'ZAR': { symbol: 'R', type: 'fiat' },
  'BTC': { symbol: '₿', type: 'crypto' },
  'ETH': { symbol: 'Ξ', type: 'crypto' },
  'USDT': { symbol: '₮', type: 'crypto' }
};

const TOKEN_TYPES = {
  'steam':         { column: 'steam_tokens',           label: 'Steam',              icon: '🎮', game: 'CS2' },
  'standoff2':     { column: 'standoff2_tokens',       label: 'Standoff 2',         icon: '⚔️', game: 'Standoff 2' },
  'roblox':        { column: 'robux_tokens',           label: 'Roblox (Robux)',     icon: '🟢', game: 'Roblox' },
  'fortnite':      { column: 'vbucks_tokens',          label: 'Fortnite (V-Bucks)', icon: '🔵', game: 'Fortnite' },
  'pubgmobile':    { column: 'pubg_uc_tokens',         label: 'PUBG Mobile (UC)',   icon: '🪙', game: 'PUBG Mobile' },
  'valorant':      { column: 'valorant_vp_tokens',     label: 'Valorant (VP)',      icon: '🔴', game: 'Valorant' },
  'genshin':       { column: 'genshin_crystals_tokens',label: 'Genshin (Crystals)', icon: '💎', game: 'Genshin Impact' },
  'freefire':      { column: 'freefire_diamonds_tokens',label:'Free Fire (Diamonds)',icon: '🔶', game: 'Free Fire' }
};

function getTokenColumn(tokenType) {
  const t = TOKEN_TYPES[tokenType];
  return t ? t.column : null;
}

function getTokenLabel(tokenType) {
  const t = TOKEN_TYPES[tokenType];
  return t ? t.label : tokenType;
}

// Initialize exchange rates
async function initializeExchangeRates() {
  // Seed default rates (will be updated from API)
  const defaultRates = [
    { currency: 'USD', rate_to_usd: 1, rate_to_btc: 0.000015 },
    { currency: 'EUR', rate_to_usd: 1.08, rate_to_btc: 0.000016 },
    { currency: 'GBP', rate_to_usd: 1.27, rate_to_btc: 0.000019 },
    { currency: 'ZAR', rate_to_usd: 0.053, rate_to_btc: 0.0000008 },
    { currency: 'BTC', rate_to_usd: 65000, rate_to_btc: 1 },
    { currency: 'ETH', rate_to_usd: 3500, rate_to_btc: 0.054 },
    { currency: 'USDT', rate_to_usd: 1, rate_to_btc: 0.000015 }
  ];

  for (const rate of defaultRates) {
    await dbRun(`
      INSERT OR IGNORE INTO exchange_rates (currency, rate_to_usd, rate_to_btc)
      VALUES (?, ?, ?)
    `, [rate.currency, rate.rate_to_usd, rate.rate_to_btc]);
  }

  // Seed token rates for all supported game tokens
  const defaultTokenRates = [
    { type: 'steam',       rate_to_usd: 0.0001, rate_to_btc: 0.0000000015 },
    { type: 'standoff2',   rate_to_usd: 0.0001, rate_to_btc: 0.0000000015 },
    { type: 'roblox',      rate_to_usd: 0.0125, rate_to_btc: 0.00000000019 },
    { type: 'fortnite',    rate_to_usd: 0.01,   rate_to_btc: 0.00000000015 },
    { type: 'pubgmobile',  rate_to_usd: 0.016,  rate_to_btc: 0.00000000024 },
    { type: 'valorant',    rate_to_usd: 0.01,   rate_to_btc: 0.00000000015 },
    { type: 'genshin',     rate_to_usd: 0.014,  rate_to_btc: 0.00000000021 },
    { type: 'freefire',    rate_to_usd: 0.01,   rate_to_btc: 0.00000000015 }
  ];
  for (const r of defaultTokenRates) {
    await dbRun('INSERT OR IGNORE INTO token_rates (token_type, rate_to_usd, rate_to_btc) VALUES (?, ?, ?)', [r.type, r.rate_to_usd, r.rate_to_btc]);
  }
}

// Fetch real-time crypto prices from CoinGecko API
async function updateCryptoPrices() {
  return new Promise((resolve, reject) => {
    https.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,btc', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const prices = JSON.parse(data);
          
          // Update BTC
          if (prices.bitcoin) {
            await dbRun(`
              UPDATE exchange_rates SET rate_to_usd = ?, rate_to_btc = 1, updated_at = datetime('now')
              WHERE currency = 'BTC'
            `, [prices.bitcoin.usd]);
          }
          
          // Update ETH
          if (prices.ethereum) {
            await dbRun(`
              UPDATE exchange_rates SET rate_to_usd = ?, rate_to_btc = ?, updated_at = datetime('now')
              WHERE currency = 'ETH'
            `, [prices.ethereum.usd, prices.ethereum.btc]);
          }
          
          // Update USDT
          if (prices.tether) {
            await dbRun(`
              UPDATE exchange_rates SET rate_to_usd = ?, rate_to_btc = ?, updated_at = datetime('now')
              WHERE currency = 'USDT'
            `, [prices.tether.usd, prices.tether.btc]);
          }
          
          resolve(prices);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Get current exchange rate for a currency
async function getExchangeRate(currency) {
  const rate = await dbGet('SELECT * FROM exchange_rates WHERE currency = ?', [currency]);
  return rate;
}

// Get token rate
async function getTokenRate(tokenType) {
  const rate = await dbGet('SELECT * FROM token_rates WHERE token_type = ?', [tokenType]);
  return rate;
}

// ESPORTS API INTEGRATION

// PandaScore creates and settles markets from provider facts; it never
// fabricates an outcome or claims an event is live without source data.
const PANDASCORE_GAMES = { cs2: 'csgo', valorant: 'valorant', lol: 'lol', dota2: 'dota2' };

async function fetchPandaScoreMatches(game = 'cs2', state = 'upcoming') {
  const gameId = PANDASCORE_GAMES[game];
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey || !gameId) return [];
  const endpoint = state === 'live' ? 'running' : 'upcoming';
  const url = new URL(`https://api.pandascore.co/matches/${endpoint}`);
  url.searchParams.set('filter[videogame]', gameId);
  url.searchParams.set('token', apiKey);
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`PandaScore returned HTTP ${res.statusCode}`));
          const matches = JSON.parse(data);
          resolve(Array.isArray(matches) ? matches : []);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// GGScore API integration (mock - would need actual API)
async function fetchGGScoreMatches(game = 'cs2') {
  // Placeholder for GGScore API integration
  return [];
}

// Liquipedia API integration (mock - would need actual API)
async function fetchLiquipediaMatches(game = 'cs2') {
  // Placeholder for Liquipedia API integration
  return [];
}

// Unified esports data fetcher
async function fetchEsportsMatches(game = 'cs2') {
  try {
    const [pandaMatches, ggMatches, liquiMatches] = await Promise.all([
      fetchPandaScoreMatches(game).catch(() => []),
      fetchGGScoreMatches(game).catch(() => []),
      fetchLiquipediaMatches(game).catch(() => [])
    ]);
    
    const seen = new Set();
    return [...pandaMatches, ...ggMatches, ...liquiMatches].filter(match => {
      const key = `${match.id || ''}:${match.name || ''}:${match.scheduled_at || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('Error fetching esports matches:', error);
    return [];
  }
}

// Create betting market from esports match
async function createBettingMarketFromMatch(match, game) {
  const options = JSON.stringify([
    match.opponent1?.name || 'Team A',
    match.opponent2?.name || 'Team B'
  ]);
  
  const result = await dbRun(`
    INSERT INTO betting_markets (
      title, description, category, options, end_date, status,
      bet_type, api_source, api_event_id, resolution_value
    ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', 'pandascore', ?, ?)
  `, [
    `${match.opponent1?.name} vs ${match.opponent2?.name}`,
    `${game.toUpperCase()} Match - ${match.league?.name || 'Tournament'}`,
    game,
    options,
    match.scheduled_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    'active',
    match.id,
    JSON.stringify({ winner: null })
  ]);
  
  const marketId = result.lastID;
  
  // Create sub-bets for match micro-events
  await createSubBetsForMatch(marketId, match, game);
  
  // Notify Telegram channel of new market
  const matchTitle = `${(match.opponent1 && match.opponent1.name) || 'Team A'} vs ${(match.opponent2 && match.opponent2.name) || 'Team B'}`;
  const leagueName = (match.league && match.league.name) || 'Tournament';
  notifyNewEsportsMarket(matchTitle, leagueName, game, match.scheduled_at).catch(e => console.error('Channel notify error:', e.message));
  
  return marketId;
}

// Create sub-bets for match micro-events
async function createSubBetsForMatch(parentMarketId, match, game) {
  // Layer 1: Player performance bets
  const playerBets = [
    {
      title: `${match.opponent1?.name} - First Blood`,
      options: ['Yes', 'No'],
      condition: 'first_blood'
    },
    {
      title: `${match.opponent2?.name} - First Blood`,
      options: ['Yes', 'No'],
      condition: 'first_blood'
    },
    {
      title: `Total Kills Over 30`,
      options: ['Over', 'Under'],
      condition: 'total_kills'
    }
  ];
  
  for (const bet of playerBets) {
    await dbRun(`
      INSERT INTO betting_markets (
        title, description, category, options, end_date, status,
        bet_type, parent_market_id, layer_depth, condition_logic
      ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', ?, 1, ?)
    `, [
      bet.title,
      `Micro-event bet for ${game.toUpperCase()} match`,
      game,
      JSON.stringify(bet.options),
      match.scheduled_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      'active',
      parentMarketId,
      bet.condition
    ]);
  }
  
  // Layer 2: Map-specific outcomes (for CS2)
  if (game === 'cs2') {
    const mapBets = [
      {
        title: `Map 1 Winner`,
        options: [match.opponent1?.name || 'Team A', match.opponent2?.name || 'Team B'],
        condition: 'map_winner'
      },
      {
        title: `Total Rounds Over 25`,
        options: ['Over', 'Under'],
        condition: 'total_rounds'
      }
    ];
    
    for (const bet of mapBets) {
      await dbRun(`
        INSERT INTO betting_markets (
          title, description, category, options, end_date, status,
          bet_type, parent_market_id, layer_depth, condition_logic
        ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', ?, 2, ?)
      `, [
        bet.title,
        `Map-specific bet for ${game.toUpperCase()} match`,
        game,
        JSON.stringify(bet.options),
        match.scheduled_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        'active',
        parentMarketId,
        bet.condition
      ]);
    }
  }
}

// Sync esports matches to betting markets
async function syncEsportsMatches() {
  if (!process.env.PANDASCORE_API_KEY) {
    console.log('Esports sync skipped: PANDASCORE_API_KEY is not configured');
    return { created: 0, skipped: 'missing_api_key' };
  }
  const games = Object.keys(PANDASCORE_GAMES);
  let created = 0;
  
  for (const game of games) {
    try {
      const matches = await fetchEsportsMatches(game);
      
      for (const match of matches) {
        // Check if market already exists
        const existing = await dbGet('SELECT * FROM betting_markets WHERE api_event_id = ?', [match.id]);
        
        if (!existing) {
          await createBettingMarketFromMatch(match, game);
          created++;
          console.log(`Created betting market for ${game} match: ${match.opponent1?.name} vs ${match.opponent2?.name}`);
        }
      }
    } catch (error) {
      console.error(`Error syncing ${game} matches:`, error);
    }
  }
  return { created };
}

// Resolve betting markets from API data
async function resolveBettingMarkets() {
  const activeMarkets = await dbAll('SELECT * FROM betting_markets WHERE status = ? AND api_event_id IS NOT NULL', ['active']);
  
  for (const market of activeMarkets) {
    try {
      // Fetch match result from API
      const matchData = await fetchMatchResult(market.api_source, market.api_event_id);
      
      if (matchData && matchData.winner) {
        const winningOption = matchData.winner;
        
        // Update market
        await dbRun(`
          UPDATE betting_markets 
          SET status = 'resolved', resolution_value = ?
          WHERE id = ?
        `, [JSON.stringify({ winner: winningOption }), market.id]);
        
        // Resolve user bets
        const bets = await dbAll('SELECT * FROM user_bets WHERE market_id = ?', [market.id]);
        
        for (const bet of bets) {
          if (bet.option === winningOption) {
            // Calculate payout
            const totalBets = (await dbGet('SELECT SUM(amount) as total FROM user_bets WHERE market_id = ?', [market.id])).total;
            const winningBets = (await dbGet('SELECT SUM(amount) as total FROM user_bets WHERE market_id = ? AND option = ?', [market.id, winningOption])).total;
            const payout = (bet.amount / winningBets) * totalBets * (1 - market.fee_rate);
            
            // Update user balance
            await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ? WHERE user_id = ?', [payout, bet.user_id]);
            await dbRun('UPDATE user_bets SET status = ?, potential_payout = ? WHERE id = ?', ['won', payout, bet.id]);
          } else {
            await dbRun('UPDATE user_bets SET status = ? WHERE id = ?', ['lost', bet.id]);
          }
        }
        
        console.log(`Resolved betting market ${market.id}: Winner is ${winningOption}`);
        
        // Notify Telegram channel of market resolution
        const totalVol = (await dbGet('SELECT COALESCE(SUM(total_volume), 0) as vol FROM betting_markets WHERE id = ?', [market.id])).vol;
        const topWin = await dbGet('SELECT MAX(potential_payout) as top FROM user_bets WHERE market_id = ? AND status = ?', [market.id, 'won']);
        notifyMarketResolved(market.title, winningOption, totalVol, topWin && topWin.top ? topWin.top : null).catch(e => console.error('Channel notify error:', e.message));
        
        // Resolve any parlay slips that include this market
        try { resolveParlayTickets(market.id, winningOption); } catch(e) { console.error('Parlay resolve error:', e.message); }
      }
    } catch (error) {
      console.error(`Error resolving market ${market.id}:`, error);
    }
  }
}

// Fetch match result from API
async function fetchMatchResult(apiSource, eventId) {
  if (apiSource === 'pandascore') {
    return new Promise((resolve, reject) => {
      https.get(`https://api.pandascore.co/matches/${eventId}`, {
        headers: { 'Authorization': `Bearer ${process.env.PANDASCORE_API_KEY || ''}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const match = JSON.parse(data);
            if (match.winner) {
              resolve({ winner: match.winner.name });
            } else {
              resolve(null);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }
  return null;
}

// ANIME API INTEGRATION

// MyAnimeList API integration
async function fetchMALAnime() {
  return new Promise((resolve, reject) => {
    https.get('https://api.jikan.moe/v4/seasons/upcoming?limit=20', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const anime = JSON.parse(data);
          resolve(anime.data || []);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// AniList API integration
async function fetchAniListAnime() {
  return new Promise((resolve, reject) => {
    const query = `
      query {
        Page(page: 1, perPage: 20) {
          media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large medium }
            startDate { year month day }
            genres
            averageScore
            description
          }
        }
      }
    `;
    
    postJson('https://graphql.anilist.co', { query })
      .then(anime => resolve(anime.data?.Page?.media || []))
      .catch(reject);
  });
}

// LiveChart API integration
async function fetchLiveChartAnime() {
  return new Promise((resolve, reject) => {
    https.get('https://api.livechart.me/anime/upcoming', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const anime = JSON.parse(data);
          resolve(anime.data || []);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Unified anime data fetcher
async function fetchAnimeData() {
  try {
    const [malAnime, anilistAnime, livechartAnime] = await Promise.all([
      fetchMALAnime().catch(() => []),
      fetchAniListAnime().catch(() => []),
      fetchLiveChartAnime().catch(() => [])
    ]);

    // Normalize coverImage across all sources
    const normalize = item => {
      // AniList returns coverImage as { large: "url", medium: "url" }
      if (item.coverImage && typeof item.coverImage === 'object') {
        item.coverImage = item.coverImage.large || item.coverImage.medium || null;
      }
      if (!item.coverImage) {
        if (item.images?.jpg?.large_image_url) item.coverImage = item.images.jpg.large_image_url;
        else if (item.images?.jpg?.image_url) item.coverImage = item.images.jpg.image_url;
        else if (item.cover_image) item.coverImage = item.cover_image;
        else if (item.image_url) item.coverImage = item.image_url;
      }
      return item;
    };

    return [...malAnime, ...anilistAnime, ...livechartAnime].map(normalize);
  } catch (error) {
    console.error('Error fetching anime data:', error);
    return [];
  }
}

// Create betting market from anime release
async function createAnimeBettingMarket(anime) {
  const title = anime.title?.english || anime.title?.romaji || anime.title;
  const releaseDate = anime.startDate || anime.airing_start;
  
  const options = JSON.stringify([
    'Released on scheduled date',
    'Delayed beyond scheduled date'
  ]);
  
  const result = await dbRun(`
    INSERT INTO betting_markets (
      title, description, category, options, end_date, status,
      bet_type, api_source, api_event_id, resolution_value
    ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', 'anilist', ?, ?)
  `, [
    `${title} - Release Date`,
    `Will ${title} be released on schedule?`,
    'anime',
    options,
    releaseDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    'active',
    anime.id,
    JSON.stringify({ released: null })
  ]);
  
  const marketId = result.lastID;
  
  // Create sub-bets for narrative details (multi-layer)
  await createSubBetsForAnime(marketId, anime);
  
  // Notify Telegram channel of new anime market
  const coverImage = anime.coverImage || (anime.images && anime.images.jpg && anime.images.jpg.large_image_url) || null;
  notifyNewAnimeMarket(title, releaseDate, coverImage).catch(e => console.error('Channel notify error:', e.message));
  
  return marketId;
}

// Create sub-bets for anime narrative details
async function createSubBetsForAnime(parentMarketId, anime) {
  const title = anime.title?.english || anime.title?.romaji || anime.title;
  
  // Layer 1: Character appearance bets
  const characterBets = [
    {
      title: `${title} - Main Character in Opening`,
      options: ['Yes', 'No'],
      condition: 'opening_appearance'
    },
    {
      title: `${title} - Episode 1 Plot Twist`,
      options: ['Yes', 'No'],
      condition: 'plot_twist'
    }
  ];
  
  for (const bet of characterBets) {
    await dbRun(`
      INSERT INTO betting_markets (
        title, description, category, options, end_date, status,
        bet_type, parent_market_id, layer_depth, condition_logic
      ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', ?, 1, ?)
    `, [
      bet.title,
      `Narrative detail bet for ${title}`,
      'anime',
      JSON.stringify(bet.options),
      anime.startDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      'active',
      parentMarketId,
      bet.condition
    ]);
  }
  
  // Layer 2: Popularity threshold bets
  const popularityBets = [
    {
      title: `${title} - MAL Score Over 8.0`,
      options: ['Over', 'Under'],
      condition: 'popularity_threshold'
    },
    {
      title: `${title} - Top 10 Weekly Ranking`,
      options: ['Yes', 'No'],
      condition: 'ranking_threshold'
    }
  ];
  
  for (const bet of popularityBets) {
    await dbRun(`
      INSERT INTO betting_markets (
        title, description, category, options, end_date, status,
        bet_type, parent_market_id, layer_depth, condition_logic
      ) VALUES (?, ?, ?, ?, ?, ?, 'multi-layer', ?, 2, ?)
    `, [
      bet.title,
      `Popularity metric bet for ${title}`,
      'anime',
      JSON.stringify(bet.options),
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      'active',
      parentMarketId,
      bet.condition
    ]);
  }
}

// Sync anime data to betting markets
async function syncAnimeData() {
  try {
    const animeList = await fetchAnimeData();
    
    for (const anime of animeList) {
      // Check if market already exists
      const existing = await dbGet('SELECT * FROM betting_markets WHERE api_event_id = ?', [anime.id]);
      
      if (!existing) {
        await createAnimeBettingMarket(anime);
        console.log(`Created betting market for anime: ${anime.title?.english || anime.title?.romaji}`);
      }
    }
  } catch (error) {
    console.error('Error syncing anime data:', error);
  }
}

// Resolve anime betting markets
async function resolveAnimeMarkets() {
  const activeMarkets = await dbAll('SELECT * FROM betting_markets WHERE status = ? AND category = ? AND api_event_id IS NOT NULL', ['active', 'anime']);
  
  for (const market of activeMarkets) {
    try {
      // Fetch anime status from API
      const animeData = await fetchAnimeStatus(market.api_source, market.api_event_id);
      
      if (animeData && animeData.status === 'released') {
        const scheduledDate = new Date(market.end_date);
        const actualDate = animeData.airing_start ? new Date(animeData.airing_start) : new Date();
        
        const winningOption = actualDate <= scheduledDate ? 'Released on scheduled date' : 'Delayed beyond scheduled date';
        
        // Update market
        await dbRun(`
          UPDATE betting_markets 
          SET status = 'resolved', resolution_value = ?
          WHERE id = ?
        `, [JSON.stringify({ released: winningOption }), market.id]);
        
        // Resolve user bets
        const bets = await dbAll('SELECT * FROM user_bets WHERE market_id = ?', [market.id]);
        
        for (const bet of bets) {
          if (bet.option === winningOption) {
            const totalBets = (await dbGet('SELECT SUM(amount) as total FROM user_bets WHERE market_id = ?', [market.id])).total;
            const winningBets = (await dbGet('SELECT SUM(amount) as total FROM user_bets WHERE market_id = ? AND option = ?', [market.id, winningOption])).total;
            const payout = (bet.amount / winningBets) * totalBets * (1 - market.fee_rate);
            
            await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ? WHERE user_id = ?', [payout, bet.user_id]);
            await dbRun('UPDATE user_bets SET status = ?, potential_payout = ? WHERE id = ?', ['won', payout, bet.id]);
          } else {
            await dbRun('UPDATE user_bets SET status = ? WHERE id = ?', ['lost', bet.id]);
          }
        }
        
        console.log(`Resolved anime betting market ${market.id}: ${winningOption}`);
        
        // Notify Telegram channel of anime market resolution
        const animeVol = (await dbGet('SELECT COALESCE(SUM(total_volume), 0) as vol FROM betting_markets WHERE id = ?', [market.id])).vol;
        const animeTopWin = await dbGet('SELECT MAX(potential_payout) as top FROM user_bets WHERE market_id = ? AND status = ?', [market.id, 'won']);
        notifyMarketResolved(market.title, winningOption, animeVol, animeTopWin && animeTopWin.top ? animeTopWin.top : null).catch(e => console.error('Channel notify error:', e.message));
        
        // Resolve any parlay slips that include this anime market
        try { resolveParlayTickets(market.id, winningOption); } catch(e) { console.error('Parlay resolve error:', e.message); }
      }
    } catch (error) {
      console.error(`Error resolving anime market ${market.id}:`, error);
    }
  }
}

// Fetch anime status from API
async function fetchAnimeStatus(apiSource, eventId) {
  if (apiSource === 'anilist') {
    return new Promise((resolve, reject) => {
      const query = `
        query {
          Media(id: ${eventId}, type: ANIME) {
            status
            airing_start
          }
        }
      `;
      
      postJson('https://graphql.anilist.co', { query })
        .then(anime => resolve(anime.data?.Media))
        .catch(reject);
    });
  }
  return null;
}

// Helper function to execute SQL (async)
function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Initialize database schema
async function initSchema() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      username TEXT,
      is_adult INTEGER DEFAULT 0,
      subscription_status TEXT DEFAULT 'free',
      subscription_end_date TEXT,
      game_points INTEGER DEFAULT 0,
      steam_tokens REAL DEFAULT 0,
      standoff2_tokens REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      session_token TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY,
      admin_id INTEGER,
      session_token TEXT UNIQUE,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin_users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      message TEXT,
      message_type TEXT DEFAULT 'community',
      recipient_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS token_conversions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      token_type TEXT,
      amount REAL,
      btc_received REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS token_trade_listings (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      offer_token_type TEXT NOT NULL,
      offer_amount REAL NOT NULL,
      want_token_type TEXT NOT NULL,
      want_amount REAL NOT NULL,
      status TEXT DEFAULT 'open',
      buyer_id INTEGER,
      fee_amount REAL DEFAULT 0,
      fee_percent REAL DEFAULT 0,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS platform_token_revenue (
      token_type TEXT PRIMARY KEY,
      accumulated_amount REAL DEFAULT 0,
      total_collected REAL DEFAULT 0
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS point_conversions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      game_points INTEGER,
      btc_received REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY,
      currency TEXT UNIQUE,
      rate_to_usd REAL,
      rate_to_btc REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS token_rates (
      id INTEGER PRIMARY KEY,
      token_type TEXT UNIQUE,
      rate_to_usd REAL,
      rate_to_btc REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      description TEXT,
      video_url TEXT,
      game_type TEXT,
      thumbnail_url TEXT,
      views INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS clip_votes (
      id INTEGER PRIMARY KEY,
      clip_id INTEGER,
      user_id INTEGER,
      vote_type INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clip_id) REFERENCES clips(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(clip_id, user_id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS clip_comments (
      id INTEGER PRIMARY KEY,
      clip_id INTEGER,
      user_id INTEGER,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clip_id) REFERENCES clips(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS weekly_leaderboard (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      week_start TEXT,
      total_likes INTEGER DEFAULT 0,
      total_clips INTEGER DEFAULT 0,
      rank INTEGER,
      streak_weeks INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS streak_rewards (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      streak_length INTEGER,
      reward_type TEXT,
      reward_amount REAL,
      reward_description TEXT,
      awarded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS site_analytics (
      id INTEGER PRIMARY KEY,
      date TEXT,
      unique_visitors INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      active_users INTEGER DEFAULT 0,
      total_bets INTEGER DEFAULT 0,
      total_volume REAL DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS it_tickets (
      id INTEGER PRIMARY KEY,
      title TEXT,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      category TEXT,
      assigned_to TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY,
      log_type TEXT,
      message TEXT,
      details TEXT,
      severity TEXT DEFAULT 'info',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS parlay_tickets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      selections TEXT,
      stake_amount REAL,
      potential_payout REAL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      is_one_time_password INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS platform_fee_pool (
      id INTEGER PRIMARY KEY DEFAULT 1,
      accumulated_btc REAL DEFAULT 0,
      total_swept_btc REAL DEFAULT 0,
      wallet_address TEXT,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      last_sweep_at TEXT
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS payout_history (
      id INTEGER PRIMARY KEY,
      amount_btc REAL,
      wallet_address TEXT,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS skins (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      game_type TEXT,
      skin_name TEXT,
      weapon TEXT,
      rarity TEXT,
      float_value REAL,
      price_tokens REAL,
      token_type TEXT DEFAULT 'steam',
      image_url TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS skin_transactions (
      id INTEGER PRIMARY KEY,
      skin_id INTEGER,
      seller_id INTEGER,
      buyer_id INTEGER,
      price_tokens REAL,
      token_type TEXT,
      status TEXT DEFAULT 'pending',
      bot_trade_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (skin_id) REFERENCES skins(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS betting_markets (
      id INTEGER PRIMARY KEY,
      title TEXT,
      description TEXT,
      category TEXT,
      options TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      fee_rate REAL DEFAULT 0.02,
      total_volume REAL DEFAULT 0,
      bet_type TEXT DEFAULT 'simple',
      api_source TEXT,
      api_event_id TEXT,
      resolution_value TEXT,
      parent_market_id INTEGER,
      layer_depth INTEGER DEFAULT 0,
      condition_logic TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_market_id) REFERENCES betting_markets(id)
    );
  `);

  await dbExec(`
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
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_balances (
      id INTEGER PRIMARY KEY,
      user_id INTEGER UNIQUE,
      btc_balance REAL DEFAULT 0,
      usd_balance REAL DEFAULT 0,
      total_deposited REAL DEFAULT 0,
      total_withdrawn REAL DEFAULT 0,
      total_won REAL DEFAULT 0,
      total_lost REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
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

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_points (
      id INTEGER PRIMARY KEY,
      user_id INTEGER UNIQUE,
      points INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY,
      anime_id INTEGER,
      title TEXT,
      description TEXT,
      questions TEXT,
      reward_points INTEGER DEFAULT 50,
      difficulty TEXT DEFAULT 'easy',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_quiz_attempts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      quiz_id INTEGER,
      score INTEGER,
      points_earned INTEGER DEFAULT 0,
      completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER UNIQUE,
      username TEXT,
      bio TEXT,
      cover_image TEXT,
      profile_image TEXT,
      badges TEXT,
      avatar_id TEXT DEFAULT 'male_default',
      banner_id TEXT DEFAULT 'bronze_cloth',
      dragon_id TEXT,
      pixelation_level INTEGER DEFAULT 8,
      weekly_streak INTEGER DEFAULT 0,
      max_streak INTEGER DEFAULT 0,
      last_streak_week TEXT,
      clip_wins INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_avatar_unlocks (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      avatar_id TEXT,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      unlock_method TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_banner_unlocks (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      banner_id TEXT,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      unlock_method TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS streak_history (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      week_start TEXT,
      clip_contest_rank INTEGER,
      streak_before INTEGER,
      streak_after INTEGER,
      event_type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS steam_accounts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER UNIQUE,
      steam_id TEXT,
      steam_username TEXT,
      avatar_url TEXT,
      trade_url TEXT,
      inventory_verified INTEGER DEFAULT 0,
      linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS standoff2_accounts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER UNIQUE,
      player_id TEXT,
      player_name TEXT,
      linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS escrow_trades (
      id INTEGER PRIMARY KEY,
      skin_id INTEGER,
      seller_id INTEGER,
      buyer_id INTEGER,
      price_tokens REAL,
      token_type TEXT,
      status TEXT DEFAULT 'pending',
      seller_confirmed INTEGER DEFAULT 0,
      buyer_confirmed INTEGER DEFAULT 0,
      seller_confirm_at TEXT,
      buyer_confirm_at TEXT,
      dispute_reason TEXT,
      trade_type TEXT DEFAULT 'manual',
      steam_trade_offer_id TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (skin_id) REFERENCES skins(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS token_deposits (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      token_type TEXT,
      amount REAL,
      status TEXT DEFAULT 'pending',
      verification_method TEXT,
      admin_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Standoff 2 Gold transfer workflow. These records describe and audit the
  // marketplace hand-off; they do not attempt to control the game client.
  await dbExec(`
    CREATE TABLE IF NOT EXISTS marketplace_identifiers (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      identifier_type TEXT NOT NULL,
      identifier_value TEXT NOT NULL,
      label TEXT,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, identifier_type, identifier_value),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_trust (
      user_id INTEGER PRIMARY KEY,
      reputation_score INTEGER DEFAULT 50,
      verified INTEGER DEFAULT 0,
      completed_transfers INTEGER DEFAULT 0,
      disputed_transfers INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_inventory_items (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      pattern_number TEXT,
      serial_number TEXT,
      quantity INTEGER DEFAULT 1,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS gold_transfers (
      id INTEGER PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      pattern_number TEXT,
      serial_number TEXT,
      gold_amount REAL NOT NULL,
      marketplace_fee_gold REAL NOT NULL,
      recipient_net_gold REAL NOT NULL,
      listing_id TEXT,
      status TEXT DEFAULT 'awaiting_recipient_listing',
      sender_confirmed_at TEXT,
      recipient_listed_at TEXT,
      completed_at TEXT,
      disputed_by INTEGER,
      dispute_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS gold_transfer_events (
      id INTEGER PRIMARY KEY,
      transfer_id INTEGER NOT NULL,
      actor_id INTEGER,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transfer_id) REFERENCES gold_transfers(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS activity_rewards (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      xp_awarded INTEGER NOT NULL,
      credit_awarded INTEGER DEFAULT 0,
      transfer_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (transfer_id) REFERENCES gold_transfers(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      badge_key TEXT NOT NULL,
      awarded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS referral_agents (
      id INTEGER PRIMARY KEY,
      agent_name TEXT NOT NULL,
      agent_email TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      commission_percent REAL DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      total_referrals INTEGER DEFAULT 0,
      total_earned_usd REAL DEFAULT 0,
      total_paid_out_usd REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS referral_tracking (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL,
      first_purchase_made INTEGER DEFAULT 0,
      commission_earned_usd REAL DEFAULT 0,
      commission_status TEXT DEFAULT 'none',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      first_purchase_at TEXT,
      FOREIGN KEY (agent_id) REFERENCES referral_agents(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id)
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS referral_payouts (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      amount_usd REAL NOT NULL,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES referral_agents(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY,
      post_type TEXT NOT NULL,
      title TEXT,
      content TEXT,
      poll_options TEXT,
      follow_up TEXT,
      source TEXT,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS p2p_trades (
      id INTEGER PRIMARY KEY,
      trade_category TEXT NOT NULL,
      listing_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      game_type TEXT,
      item_details TEXT,
      price_amount REAL,
      price_currency TEXT,
      payment_methods TEXT,
      seller_id INTEGER NOT NULL,
      buyer_id INTEGER,
      status TEXT DEFAULT 'open',
      seller_confirmed INTEGER DEFAULT 0,
      buyer_confirmed INTEGER DEFAULT 0,
      seller_confirm_at TEXT,
      buyer_confirm_at TEXT,
      dispute_reason TEXT,
      fee_percent REAL DEFAULT 5.0,
      fee_amount REAL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      trade_type TEXT NOT NULL,
      trade_id INTEGER,
      item_title TEXT,
      game_type TEXT,
      price_display TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_penalties (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      penalty_type TEXT NOT NULL,
      reason TEXT,
      dispute_trade_id INTEGER,
      ban_days INTEGER,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      lifted_at TEXT,
      lifted_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS user_reputation (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      total_trades INTEGER DEFAULT 0,
      completed_trades INTEGER DEFAULT 0,
      disputed_trades INTEGER DEFAULT 0,
      cancelled_trades INTEGER DEFAULT 0,
      trust_score INTEGER DEFAULT 0,
      is_trusted INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      flag_reason TEXT,
      is_banned INTEGER DEFAULT 0,
      ban_until TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS game_bets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game_type TEXT NOT NULL,
      stake_amount REAL NOT NULL,
      stake_currency TEXT DEFAULT 'RC',
      multiplier REAL DEFAULT 0,
      payout REAL DEFAULT 0,
      result TEXT,
      game_data TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS prediction_markets (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT DEFAULT 'reddit',
      source_url TEXT,
      options_json TEXT NOT NULL,
      category TEXT DEFAULT 'anime',
      status TEXT DEFAULT 'open',
      resolves_at TEXT,
      resolved_option TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS prediction_bets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      market_id INTEGER NOT NULL,
      chosen_option TEXT NOT NULL,
      stake_amount REAL NOT NULL,
      stake_currency TEXT DEFAULT 'RC',
      payout REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (market_id) REFERENCES prediction_markets(id)
    );
  `);
}
async function initDatabaseAndSchema() {
  await ensureLegacySchema();
  await initSchema();
  await initializeExchangeRates();
}

// Initialize admin user if not exists
async function initAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'chester.nt@zentriva.online';
  const existingAdmin = await dbGet('SELECT * FROM admin_users WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    await dbRun('INSERT INTO admin_users (email, password_hash, is_one_time_password) VALUES (?, NULL, 1)', [adminEmail]);
    console.log(`Admin user created with no password for ${adminEmail}; use reset_admin.js to set one-time password.`);
  }

  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0) {
    const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
    await dbRun('UPDATE admin_users SET password_hash = ?, is_one_time_password = 1 WHERE email = ?', [passwordHash, adminEmail]);
    console.log('Admin password applied from ADMIN_PASSWORD at startup.');
  }
}

// Initialize OwnPay client (will be loaded dynamically)
let ownpay = null;

// Telegram bot setup
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let bot;
if (TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(TELEGRAM_BOT_TOKEN);
} else {
  bot = {
    launch: async () => {},
    stop: async () => {},
    command: () => {},
    on: () => {},
    telegram: { sendMessage: async () => {}, sendPhoto: async () => {} }
  };
}

// Discord bot setup
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';
let discordClient = null;
let discordReady = false;

if (DISCORD_BOT_TOKEN) {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ]
  });

  discordClient.once('ready', () => {
    console.log(`Discord bot logged in as ${discordClient.user.tag}`);
    discordReady = true;
    registerDiscordSlashCommands();
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleDiscordSlashCommand(interaction);
  });

  discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (DISCORD_CHANNEL_ID && message.channelId === DISCORD_CHANNEL_ID) {
      await handleDiscordChatBridge(message);
    }
    await handleDiscordClipAutoUpload(message);
  });

  discordClient.login(DISCORD_BOT_TOKEN).catch(err => console.error('Discord login error:', err));
} else {
  console.log('No DISCORD_BOT_TOKEN provided, Discord bot disabled');
}

// Discord slash commands registration
async function registerDiscordSlashCommands() {
  if (!DISCORD_BOT_TOKEN || !discordClient?.application) return;
  const commands = [
    new SlashCommandBuilder().setName('start').setDescription('Welcome to PixelPulse'),
    new SlashCommandBuilder().setName('markets').setDescription('View active prediction markets'),
    new SlashCommandBuilder().setName('clips').setDescription('View top clips'),
    new SlashCommandBuilder().setName('marketplace').setDescription('Browse skin marketplace'),
    new SlashCommandBuilder().setName('stats').setDescription('Platform statistics'),
    new SlashCommandBuilder().setName('quiz').setDescription('Take a gaming or anime quiz and earn Royal Coins'),
    new SlashCommandBuilder().setName('help').setDescription('Get help'),
    new SlashCommandBuilder().setName('balance').setDescription('Check your arcade USD balance'),
    new SlashCommandBuilder().setName('deposit').setDescription('Get deposit instructions for arcade funds')
      .addStringOption(opt => opt.setName('amount').setDescription('Amount in USD to deposit').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin — heads or tails (min $0.50)')
      .addStringOption(opt => opt.setName('choice').setDescription('heads or tails').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }))
      .addNumberOption(opt => opt.setName('stake').setDescription('Stake amount in USD (min 0.50)').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Spin the slots (min $0.50)')
      .addNumberOption(opt => opt.setName('stake').setDescription('Stake amount in USD (min 0.50)').setRequired(true)),
    new SlashCommandBuilder().setName('crash').setDescription('Castle Crash — cash out before the guard turns! (min $0.50)')
      .addNumberOption(opt => opt.setName('stake').setDescription('Stake amount in USD (min 0.50)').setRequired(true)),
    new SlashCommandBuilder().setName('winners').setDescription('View recent arcade winners'),
    new SlashCommandBuilder().setName('link').setDescription('Link your Discord to your PixelPulse account')
      .addStringOption(opt => opt.setName('username').setDescription('Your PixelPulse username').setRequired(true))
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(discordClient.application.id), { body: commands });
    console.log('Discord slash commands registered');
  } catch (err) {
    console.error('Failed to register Discord slash commands:', err);
  }
}

// Discord slash command handler
async function handleDiscordSlashCommand(interaction) {
  try {
    switch (interaction.commandName) {
      case 'start': {
        const embed = new EmbedBuilder()
          .setTitle('🎮 PixelPulse - Gaming Marketplace & Community')
          .setColor(0xe50914)
          .setDescription([
            '🎬 **CLIPS** — Share highlights from any game, get upvoted, win weekly prizes',
            '💼 **MARKETPLACE** — Buy & sell skins, game accounts, and gift cards — escrow protected',
            '🔄 **TRADE HUB** — Swap tokens across 8+ platforms (Steam, Roblox, Fortnite, PUBG Mobile, Valorant, Genshin, Free Fire, Call of Duty)',
            '🔮 **PREDICTIONS** — Predict esports matches and anime events, win BTC prizes',
            '',
            '🔗 **Start now:** https://pixelpulse.zentriva-clubsync.online'
          ].join('\n'));
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'markets': {
        await interaction.deferReply();
        const markets = await dbAll('SELECT * FROM betting_markets WHERE status = ? ORDER BY created_at DESC LIMIT 5', ['active']);
        if (markets.length === 0) {
          await interaction.editReply('No active markets right now. Check back later!');
          return;
        }
        const embed = new EmbedBuilder().setTitle('🔮 Active Prediction Markets').setColor(0xe50914);
        markets.forEach((m, i) => {
          const options = JSON.parse(m.options).join(', ');
          embed.addFields({ name: `${i + 1}. ${m.title}`, value: `Options: ${options}\nEnds: ${new Date(m.end_date).toLocaleDateString()}` });
        });
        embed.setFooter({ text: 'Predict now: https://pixelpulse.zentriva-clubsync.online' });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'clips': {
        await interaction.deferReply();
        const clips = await dbAll('SELECT c.*, u.username, (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) as upvotes FROM clips c JOIN users u ON c.user_id = u.id ORDER BY upvotes DESC LIMIT 5');
        if (clips.length === 0) {
          await interaction.editReply('No clips yet. Be the first to share your highlight!');
          return;
        }
        const embed = new EmbedBuilder().setTitle('🎬 Top Clips').setColor(0xe50914);
        clips.forEach((c, i) => {
          embed.addFields({ name: `${i + 1}. ${c.title}`, value: `Game: ${c.game_type} | 👍 ${c.upvotes} upvotes | 👤 ${c.username}` });
        });
        embed.setFooter({ text: 'Watch clips: https://pixelpulse.zentriva-clubsync.online' });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'marketplace': {
        await interaction.deferReply();
        const skins = await dbAll('SELECT s.*, u.username FROM skins s JOIN users u ON s.user_id = u.id WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 5', ['available']);
        if (skins.length === 0) {
          await interaction.editReply('No skins listed yet. List your first skin!');
          return;
        }
        const embed = new EmbedBuilder().setTitle('💼 Skin Marketplace').setColor(0xe50914);
        skins.forEach((s, i) => {
          embed.addFields({ name: `${i + 1}. ${s.skin_name}`, value: `Weapon: ${s.weapon} | Game: ${s.game_type} | Price: ${s.price_tokens} tokens | 👤 ${s.username}` });
        });
        embed.setFooter({ text: 'Browse marketplace: https://pixelpulse.zentriva-clubsync.online' });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'stats': {
        await interaction.deferReply();
        const totalClips = (await dbGet('SELECT COUNT(*) as count FROM clips')).count;
        const totalSkins = (await dbGet('SELECT COUNT(*) as count FROM skins WHERE status = ?', ['available'])).count;
        const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
        const totalVolume = (await dbGet('SELECT COALESCE(SUM(total_volume), 0) as volume FROM betting_markets')).volume;
        const embed = new EmbedBuilder()
          .setTitle('📊 Platform Statistics')
          .setColor(0xe50914)
          .addFields(
            { name: '🎬 Clips', value: `${totalClips}`, inline: true },
            { name: '💼 Skins Listed', value: `${totalSkins}`, inline: true },
            { name: '🔮 Active Markets', value: `${activeMarkets}`, inline: true },
            { name: '💰 Total Volume', value: `${totalVolume.toFixed(4)} BTC`, inline: true }
          );
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'quiz': {
        await interaction.deferReply();
        const quizzes = await dbAll('SELECT id, title, description, reward_points, difficulty FROM quizzes ORDER BY RANDOM() LIMIT 5');
        if (quizzes.length === 0) {
          await interaction.editReply('No quizzes available right now. Check back later!');
          break;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎮 Quizzes — Earn Royal Coins!')
          .setColor(0xe50914)
          .setDescription('Take a quiz on the website to earn Royal Coins. Click a link below to start!');
        quizzes.forEach((q, i) => {
          const diffEmoji = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'medium' ? '🟡' : '🔴';
          embed.addFields({
            name: `${i + 1}. ${q.title} ${diffEmoji}`,
            value: `${q.description || ''}\nReward: ${q.reward_points} Royal Coins • [Take Quiz](https://pixelpulse.zentriva-clubsync.online/#quizzes)`
          });
        });
        embed.setFooter({ text: 'Complete quizzes on the website to earn coins and climb the leaderboard' });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('🆘 Help & Commands')
          .setColor(0xe50914)
          .setDescription([
            '/start — Welcome message',
            '/markets — View betting markets',
            '/clips — View top clips',
            '/marketplace — Browse marketplace',
            '/quiz — Take a quiz and earn Royal Coins',
            '/stats — Platform statistics',
            '/balance — Check your arcade USD balance',
            '/deposit — Deposit USD to your arcade balance',
            '/coinflip — Bet on heads or tails (min $0.50)',
            '/slots — Spin the slot machine (min $0.50)',
            '/crash — Castle Crash game (min $0.50)',
            '/winners — View recent arcade winners',
            '/link — Link your Discord to PixelPulse account',
            '/help — This help message',
            '',
            '💡 Share a YouTube or Twitch link in any channel to auto-upload it as a clip to PixelPulse!',
            '',
            '🔗 Website: https://pixelpulse.zentriva-clubsync.online'
          ].join('\n'));
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'link': {
        const username = interaction.options.getString('username');
        const user = await dbGet('SELECT id, discord_id FROM users WHERE username = ?', [username]);
        if (!user) {
          await interaction.reply({ content: `No PixelPulse account found with username "${username}". Create one at https://pixelpulse.zentriva-clubsync.online`, ephemeral: true });
          return;
        }
        if (user.discord_id && user.discord_id !== interaction.user.id) {
          await interaction.reply({ content: 'That account is already linked to another Discord user.', ephemeral: true });
          return;
        }
        await dbRun('UPDATE users SET discord_id = ? WHERE id = ?', [interaction.user.id, user.id]);
        await interaction.reply({ content: `✅ Linked Discord account to PixelPulse user **${username}**! You can now use arcade commands.`, ephemeral: true });
        break;
      }
      case 'balance': {
        const user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
        if (!user) {
          await interaction.reply({ content: 'Link your account first with `/link <username>`', ephemeral: true });
          return;
        }
        const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [user.id]);
        const embed = new EmbedBuilder()
          .setTitle('💰 Arcade Balance')
          .setColor(0xe50914)
          .setDescription(`Your USD balance: **$${(bal?.usd_balance || 0).toFixed(2)}**\n\nUse /deposit to add funds, then /coinflip, /slots, or /crash to play!`)
          .setFooter({ text: 'Minimum stake: $0.50' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'deposit': {
        const amount = interaction.options.getString('amount');
        const user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
        if (!user) {
          await interaction.reply({ content: 'Link your account first with `/link <username>`', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('💳 Deposit to Arcade')
          .setColor(0xe50914)
          .setDescription([
            `To deposit **$${amount}** to your arcade balance:`,
            '',
            '1. Go to https://pixelpulse.zentriva-clubsync.online',
            '2. Login and navigate to Wallet',
            '3. Deposit BTC — it will be converted to USD automatically',
            '4. Use /balance to check your updated balance',
            '',
            'BTC deposits are credited within 1-3 confirmations.',
            'Your balance is shared between the website and Discord.'
          ].join('\n'));
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
      case 'coinflip': {
        const choice = interaction.options.getString('choice');
        const stake = interaction.options.getNumber('stake');
        if (stake < DISCORD_MIN_STAKE) {
          await interaction.reply({ content: `Minimum stake is $${DISCORD_MIN_STAKE}`, ephemeral: true });
          return;
        }
        const user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
        if (!user) {
          await interaction.reply({ content: 'Link your account first with `/link <username>`', ephemeral: true });
          return;
        }
        const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [user.id]);
        if (!bal || bal.usd_balance < stake) {
          await interaction.reply({ content: `Insufficient balance. You have $${(bal?.usd_balance || 0).toFixed(2)}. Use /deposit to add funds.`, ephemeral: true });
          return;
        }
        const serverSeed = generateServerSeed();
        const cSeed = arcadeCrypto.randomBytes(8).toString('hex');
        const nonce = Date.now();
        const roll = provablyFairResult(serverSeed, cSeed, nonce);
        const result = roll < 0.5 ? 'heads' : 'tails';
        const won = result === choice;
        const multiplier = won ? (2 - HOUSE_EDGE * 2) : 0;
        const payout = won ? Math.floor(stake * multiplier * 100) / 100 : 0;

        await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ?, total_lost = total_lost + ? WHERE user_id = ?', [stake, stake, user.id]);
        if (payout > 0) await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, user.id]);
        await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, server_seed, client_seed, nonce) VALUES (?, 'coinflip', ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, stake, multiplier, payout, won ? 'won' : 'lost', JSON.stringify({ choice, result, source: 'discord' }), serverSeed, cSeed, nonce]);

        const coinEmoji = result === 'heads' ? '🪙' : '🥈';
        const embed = new EmbedBuilder()
          .setTitle(`🪙 Coin Flip — ${result.toUpperCase()}`)
          .setColor(won ? 0x4caf50 : 0xf44336)
          .setDescription([
            `You chose: **${choice}**`,
            `Result: **${result}** ${coinEmoji}`,
            `Stake: $${stake.toFixed(2)}`,
            won ? `🎉 You won **$${payout.toFixed(2)}** (${multiplier.toFixed(2)}x)` : `❌ You lost $${stake.toFixed(2)}`,
            `New balance: $${(bal.usd_balance - stake + payout).toFixed(2)}`
          ].join('\n'));
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'slots': {
        const stake = interaction.options.getNumber('stake');
        if (stake < DISCORD_MIN_STAKE) {
          await interaction.reply({ content: `Minimum stake is $${DISCORD_MIN_STAKE}`, ephemeral: true });
          return;
        }
        const user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
        if (!user) {
          await interaction.reply({ content: 'Link your account first with `/link <username>`', ephemeral: true });
          return;
        }
        const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [user.id]);
        if (!bal || bal.usd_balance < stake) {
          await interaction.reply({ content: `Insufficient balance. You have $${(bal?.usd_balance || 0).toFixed(2)}.`, ephemeral: true });
          return;
        }
        const serverSeed = generateServerSeed();
        const cSeed = arcadeCrypto.randomBytes(8).toString('hex');
        const nonce = Date.now();
        const reels = [];
        for (let i = 0; i < 3; i++) {
          const roll = provablyFairResult(serverSeed, cSeed, nonce + i);
          reels.push(SLOT_SYMBOLS[Math.floor(roll * SLOT_SYMBOLS.length)]);
        }
        let multiplier = 0, result = 'lost';
        if (reels[0] === reels[1] && reels[1] === reels[2]) {
          multiplier = SLOT_PAYOUTS[reels[0]] * (1 - HOUSE_EDGE);
          result = 'jackpot';
        } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
          multiplier = 1.5 * (1 - HOUSE_EDGE);
          result = 'won';
        }
        const payout = multiplier > 0 ? Math.floor(stake * multiplier * 100) / 100 : 0;
        await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ?, total_lost = total_lost + ? WHERE user_id = ?', [stake, stake, user.id]);
        if (payout > 0) await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, user.id]);
        await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, server_seed, client_seed, nonce) VALUES (?, 'slots', ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, stake, multiplier, payout, result, JSON.stringify({ reels, source: 'discord' }), serverSeed, cSeed, nonce]);

        const embed = new EmbedBuilder()
          .setTitle('🎰 Slots')
          .setColor(payout > 0 ? 0x4caf50 : 0xf44336)
          .setDescription([
            `# ${reels.join(' | ')}`,
            '',
            result === 'jackpot' ? `🎉 JACKPOT! 3x ${reels[0]}` : result === 'won' ? '✅ Two of a kind!' : '❌ No match',
            `Stake: $${stake.toFixed(2)}`,
            payout > 0 ? `You won **$${payout.toFixed(2)}** (${multiplier.toFixed(2)}x)` : `You lost $${stake.toFixed(2)}`,
            `New balance: $${(bal.usd_balance - stake + payout).toFixed(2)}`
          ].join('\n'));
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'crash': {
        const stake = interaction.options.getNumber('stake');
        if (stake < DISCORD_MIN_STAKE) {
          await interaction.reply({ content: `Minimum stake is $${DISCORD_MIN_STAKE}`, ephemeral: true });
          return;
        }
        const user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
        if (!user) {
          await interaction.reply({ content: 'Link your account first with `/link <username>`', ephemeral: true });
          return;
        }
        const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [user.id]);
        if (!bal || bal.usd_balance < stake) {
          await interaction.reply({ content: `Insufficient balance. You have $${(bal?.usd_balance || 0).toFixed(2)}.`, ephemeral: true });
          return;
        }

        const serverSeed = generateServerSeed();
        const cSeed = arcadeCrypto.randomBytes(8).toString('hex');
        const nonce = Date.now();
        const crashPoint = generateCrashPoint(serverSeed, cSeed, nonce);

        await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ? WHERE user_id = ?', [stake, user.id]);

        // Discord crash: animated with buttons
        const row = new (require('discord.js').ActionRowBuilder)()
          .addComponents(
            new (require('discord.js').ButtonBuilder)()
              .setCustomId('crash_cashout')
              .setLabel('💰 CASH OUT')
              .setStyle(require('discord.js').ButtonStyle.Success)
          );

        const embed = new EmbedBuilder()
          .setTitle('🏰 Castle Crash')
          .setColor(0xe50914)
          .setDescription([
            '🦹 A thief sneaks down the castle corridor...',
            'Guards patrol ahead. Cash out before they turn around!',
            '',
            `Stake: $${stake.toFixed(2)}`,
            `Multiplier: **1.00x**`,
            `Potential payout: $${stake.toFixed(2)}`
          ].join('\n'))
          .setFooter({ text: 'Click CASH OUT to secure your winnings!' });

        await interaction.reply({ embeds: [embed], components: [row] });
        const reply = await interaction.fetchReply();

        // Animate multiplier growth
        let currentMult = 1.00;
        const startTime = Date.now();
        let crashed = false;
        let cashedOut = false;

        const updateInterval = setInterval(async () => {
          if (cashedOut || crashed) { clearInterval(updateInterval); return; }
          const elapsed = (Date.now() - startTime) / 1000;
          currentMult = 1 + (elapsed * elapsed * 0.15); // accelerating growth
          if (currentMult >= crashPoint) {
            crashed = true;
            clearInterval(updateInterval);
            await dbRun('UPDATE user_balances SET total_lost = total_lost + ? WHERE user_id = ?', [stake, user.id]);
            await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, nonce) VALUES (?, 'castle_crash', ?, 'USD', 0, 0, 'crashed', ?, ?)`,
              [user.id, stake, JSON.stringify({ crashPoint, multiplierAtCrash: currentMult, source: 'discord' }), nonce]);

            const crashEmbed = EmbedBuilder.from(embed)
              .setColor(0xf44336)
              .setDescription([
                '🚨 **GUARD TURNED AROUND!** 🚨',
                '🦹 The thief was caught!',
                '',
                `Crashed at **${crashPoint.toFixed(2)}x**`,
                `You lost $${stake.toFixed(2)}`
              ].join('\n'));
            await interaction.editReply({ embeds: [crashEmbed], components: [] });
            return;
          }

          const potentialPayout = Math.floor(stake * currentMult * 100) / 100;
          const updatedEmbed = EmbedBuilder.from(embed)
            .setDescription([
              '🦹 The thief sneaks deeper into the castle...',
              `Steps: ${Math.floor(elapsed * 2)} | Guards still facing away`,
              '',
              `Stake: $${stake.toFixed(2)}`,
              `Multiplier: **${currentMult.toFixed(2)}x**`,
              `Potential payout: $${potentialPayout.toFixed(2)}`
            ].join('\n'));
          try { await interaction.editReply({ embeds: [updatedEmbed] }); } catch(e) {}
        }, 1500);

        // Button collector for cashout
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async (btnInteraction) => {
          if (btnInteraction.user.id !== interaction.user.id) {
            await btnInteraction.reply({ content: 'This is not your game!', ephemeral: true });
            return;
          }
          if (cashedOut || crashed) return;
          cashedOut = true;
          clearInterval(updateInterval);
          collector.stop();

          const payout = Math.floor(stake * currentMult * 100) / 100;
          await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, user.id]);
          await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, nonce) VALUES (?, 'castle_crash', ?, 'USD', ?, ?, 'cashed_out', ?, ?)`,
            [user.id, stake, currentMult, payout, JSON.stringify({ cashoutMultiplier: currentMult, source: 'discord' }), nonce]);

          const cashEmbed = EmbedBuilder.from(embed)
            .setColor(0x4caf50)
            .setDescription([
              '💰 **CASHED OUT SUCCESSFULLY!**',
              `🦹 The thief escaped with the treasure!`,
              '',
              `Multiplier: **${currentMult.toFixed(2)}x**`,
              `You won **$${payout.toFixed(2)}**`,
              `Stake: $${stake.toFixed(2)}`
            ].join('\n'));
          await btnInteraction.update({ embeds: [cashEmbed], components: [] });
        });
        collector.on('end', async () => {
          if (!cashedOut && !crashed) {
            clearInterval(updateInterval);
            // Auto-crash if timer expires
            crashed = true;
            await dbRun('UPDATE user_balances SET total_lost = total_lost + ? WHERE user_id = ?', [stake, user.id]);
            await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, nonce) VALUES (?, 'castle_crash', ?, 'USD', 0, 0, 'crashed', ?, ?)`,
              [user.id, stake, JSON.stringify({ crashPoint, multiplierAtCrash: currentMult, source: 'discord', reason: 'timeout' }), nonce]);
            const timeoutEmbed = EmbedBuilder.from(embed)
              .setColor(0xf44336)
              .setDescription([
                '⏰ **Time ran out! The guard caught the thief.**',
                '',
                `You lost $${stake.toFixed(2)}`
              ].join('\n'));
            try { await interaction.editReply({ embeds: [timeoutEmbed], components: [] }); } catch(e) {}
          }
        });
        break;
      }
      case 'winners': {
        await interaction.deferReply();
        const winners = await dbAll(`
          SELECT gb.*, u.username FROM game_bets gb
          JOIN users u ON gb.user_id = u.id
          WHERE gb.payout > 0 AND gb.stake_currency = 'USD'
          ORDER BY gb.created_at DESC LIMIT 10
        `);
        if (winners.length === 0) {
          await interaction.editReply('No winners yet. Be the first to win!');
          return;
        }
        const embed = new EmbedBuilder().setTitle('🏆 Recent Arcade Winners').setColor(0xffd700);
        winners.forEach((w, i) => {
          const gameName = w.game_type === 'coinflip' ? '🪙 Coin Flip' : w.game_type === 'slots' ? '🎰 Slots' : '🏰 Castle Crash';
          embed.addFields({ name: `${i + 1}. ${w.username}`, value: `${gameName} | Staked $${w.stake_amount} | Won **$${w.payout}** (${w.multiplier.toFixed(2)}x)` });
        });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    console.error('Discord slash command error:', err);
    if (interaction.deferred) await interaction.editReply('Error processing command.');
    else if (!interaction.replied) await interaction.reply('Error processing command.');
  }
}

// Discord auto clip-upload: detect YouTube/Twitch links and upload to webapp
async function handleDiscordClipAutoUpload(message) {
  try {
    const content = message.content || '';
    const ytMatch = content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const twMatch = content.match(/(?:twitch\.tv\/videos\/(\d+)|clips\.twitch\.tv\/([a-zA-Z0-9_-]+)|twitch\.tv\/([a-zA-Z0-9_]+))/);

    if (!ytMatch && !twMatch) return;

    const videoUrl = ytMatch
      ? `https://www.youtube.com/watch?v=${ytMatch[1]}`
      : twMatch[1]
        ? `https://twitch.tv/videos/${twMatch[1]}`
        : twMatch[2]
          ? `https://clips.twitch.tv/${twMatch[2]}`
          : `https://twitch.tv/${twMatch[3]}`;

    // Find user by Discord ID
    const user = await dbGet('SELECT id, username FROM users WHERE discord_id = ?', [message.author.id]);
    if (!user) {
      // User hasn't linked their Discord to PixelPulse yet
      await message.reply({
        content: `Nice clip! Link your Discord account to PixelPulse to auto-upload clips to your profile.\nSign up at https://pixelpulse.zentriva-clubsync.online/ and link your Discord in your profile settings.`,
        allowedMentions: { repliedUser: false }
      }).catch(() => {});
      return;
    }

    // Check for duplicate (same video URL by same user in last 24h)
    const existing = await dbGet(
      'SELECT id FROM clips WHERE user_id = ? AND video_url LIKE ? AND created_at > datetime("now", "-1 day")',
      [user.id, `%${ytMatch ? ytMatch[1] : (twMatch[1] || twMatch[2] || twMatch[3])}%`]
    );
    if (existing) return; // Already uploaded recently, skip silently

    // Derive a title from the message or use a default
    const title = content.replace(videoUrl, '').trim().substring(0, 100) || `Clip shared by ${user.username}`;
    const gameType = 'General';

    // Build embed URL
    let embedUrl = videoUrl;
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    } else if (twMatch) {
      const channel = twMatch[3];
      if (channel) embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=${message.guild ? 'pixelpulse.zentriva-clubsync.online' : 'localhost'}`;
    }

    // Insert clip
    const result = await dbRun(
      'INSERT INTO clips (user_id, title, description, video_url, game_type, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, title, `Shared via Discord by ${message.author.username}`, embedUrl, gameType, '']
    );

    await awardRoyalCoins(user.id, ROYAL_COIN_REWARDS.CLIP_UPLOAD, 'Clip upload via Discord');

    // Notify Telegram channel
    notifyNewClip(title, 'General', user.username, embedUrl).catch(() => {});

    await message.reply({
      content: `Clip uploaded to PixelPulse! View it on your profile: https://pixelpulse.zentriva-clubsync.online/\n+${ROYAL_COIN_REWARDS.CLIP_UPLOAD} Royal Coins earned!`,
      allowedMentions: { repliedUser: false }
    }).catch(() => {});

    console.log(`Discord clip auto-uploaded: user ${user.username}, clip ID ${result.lastID}`);
  } catch (err) {
    console.error('Discord clip auto-upload error:', err);
  }
}

// Discord chat bridge: Discord -> webapp
async function handleDiscordChatBridge(message) {
  try {
    const username = message.author.username;
    const content = message.content;
    if (!content || content.length > 500) return;

    // Find or create a system user for this Discord user
    let user = await dbGet('SELECT id FROM users WHERE discord_id = ?', [message.author.id]);
    if (!user) {
      // Create a lightweight user record for Discord users
      const result = await dbRun('INSERT INTO users (username, discord_id, is_adult) VALUES (?, ?, 0)', [`d_${username}`, message.author.id]);
      user = { id: result.lastID };
    }

    await dbRun('INSERT INTO chat_messages (user_id, message, message_type, source) VALUES (?, ?, ?, ?)', [user.id, content.trim(), 'community', 'discord']);
  } catch (err) {
    console.error('Discord chat bridge error:', err);
  }
}

// Broadcast to Discord channel
async function broadcastToDiscord(title, description, color = 0xe50914) {
  if (!discordReady || !discordClient || !DISCORD_CHANNEL_ID) return;
  try {
    const channel = await discordClient.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder().setTitle(title).setColor(color).setDescription(description).setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Discord broadcast error:', err);
  }
}

// Initialize database on startup
async function startupInit() {
  await initDatabaseAndSchema();
  await initAdminUser();
  console.log('Database initialization complete');
}

const databaseInitialization = startupInit();
databaseInitialization.catch(err => {
  console.error('Startup initialization error:', err);
  process.exit(1);
});

// Update crypto prices every 5 minutes
setInterval(() => {
  updateCryptoPrices().catch(err => console.error('Failed to update crypto prices:', err));
}, 5 * 60 * 1000);

// Sync esports matches every 10 minutes
setInterval(() => {
  syncEsportsMatches().catch(err => console.error('Failed to sync esports matches:', err));
}, 10 * 60 * 1000);

// Resolve betting markets every 5 minutes
setInterval(() => {
  resolveBettingMarkets().catch(err => console.error('Failed to resolve betting markets:', err));
}, 5 * 60 * 1000);

// Initial sync on startup
syncEsportsMatches().catch(err => console.error('Failed to sync esports matches on startup:', err));
syncAnimeData().catch(err => console.error('Failed to sync anime data on startup:', err));

// Sync anime data every 30 minutes
setInterval(() => {
  syncAnimeData().catch(err => console.error('Failed to sync anime data:', err));
}, 30 * 60 * 1000);

// Resolve anime betting markets every 15 minutes
setInterval(() => {
  resolveAnimeMarkets().catch(err => console.error('Failed to resolve anime markets:', err));
}, 15 * 60 * 1000);

// STREAK SYSTEM

// Update weekly leaderboard based on clip performance
async function updateWeeklyLeaderboard() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  const clipStats = await dbAll(`
    SELECT 
      c.user_id,
      COUNT(c.id) as total_clips,
      COALESCE(SUM((SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) - 
                      (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = -1)), 0) as total_likes
    FROM clips c
    WHERE c.created_at >= ?
    GROUP BY c.user_id
  `, [weekStartStr]);
  
  for (const [index, stat] of clipStats.entries()) {
    const existing = await dbGet('SELECT * FROM weekly_leaderboard WHERE user_id = ? AND week_start = ?', [stat.user_id, weekStartStr]);
    
    if (existing) {
      await dbRun(`
        UPDATE weekly_leaderboard 
        SET total_likes = ?, total_clips = ?, rank = ?
        WHERE id = ?
      `, [stat.total_likes, stat.total_clips, index + 1, existing.id]);
    } else {
      await dbRun(`
        INSERT INTO weekly_leaderboard (user_id, week_start, total_likes, total_clips, rank)
        VALUES (?, ?, ?, ?, ?)
      `, [stat.user_id, weekStartStr, stat.total_likes, stat.total_clips, index + 1]);
    }
  }
  
  await updateStreaks(weekStartStr);
}

// Update streaks for users who consistently perform well
async function updateStreaks(weekStartStr) {
  const topUsers = await dbAll('SELECT user_id, rank FROM weekly_leaderboard WHERE week_start = ? AND rank <= 10 ORDER BY rank ASC', [weekStartStr]);
  
  for (const user of topUsers) {
    if (user.rank === 1) {
      await awardRoyalCoins(user.user_id, ROYAL_COIN_REWARDS.WEEKLY_WIN_1ST, 'Weekly clip contest 1st place');
    } else if (user.rank === 2) {
      await awardRoyalCoins(user.user_id, ROYAL_COIN_REWARDS.WEEKLY_WIN_2ND, 'Weekly clip contest 2nd place');
    } else if (user.rank === 3) {
      await awardRoyalCoins(user.user_id, ROYAL_COIN_REWARDS.WEEKLY_WIN_3RD, 'Weekly clip contest 3rd place');
    }
    
    // Check if user was in top 10 previous week
    const prevWeekStart = new Date(weekStartStr);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStr = prevWeekStart.toISOString().split('T')[0];
    
    const prevWeek = await dbGet('SELECT * FROM weekly_leaderboard WHERE user_id = ? AND week_start = ? AND rank <= 10', [user.user_id, prevWeekStr]);
    
    if (prevWeek) {
      const currentStreak = await dbGet('SELECT streak_weeks FROM weekly_leaderboard WHERE user_id = ? AND week_start = ?', [user.user_id, weekStartStr]);
      const newStreak = (currentStreak?.streak_weeks || 0) + 1;
      
      await dbRun('UPDATE weekly_leaderboard SET streak_weeks = ? WHERE user_id = ? AND week_start = ?', [newStreak, user.user_id, weekStartStr]);
      
      await awardStreakReward(user.user_id, newStreak);
      await updateWeeklyStreak(user.user_id, user.rank);
    } else {
      await dbRun('UPDATE weekly_leaderboard SET streak_weeks = 1 WHERE user_id = ? AND week_start = ?', [user.user_id, weekStartStr]);
      await updateWeeklyStreak(user.user_id, user.rank);
    }
  }
}

// Helper: Award Royal Coins to a user
async function awardRoyalCoins(userId, amount, reason) {
  if (!amount || amount <= 0) return;
  const existing = await dbGet('SELECT * FROM user_points WHERE user_id = ?', [userId]);
  if (existing) {
    await dbRun('UPDATE user_points SET points = points + ?, total_earned = total_earned + ? WHERE user_id = ?', [amount, amount, userId]);
  } else {
    await dbRun('INSERT INTO user_points (user_id, points, total_earned) VALUES (?, ?, ?)', [userId, amount, amount]);
  }
  await logSystemEvent('info', `Awarded ${amount} Royal Coins to user ${userId}`, reason || 'Activity reward');
}

// Royal Coins reward constants
const ROYAL_COIN_REWARDS = {
  CLIP_UPLOAD: 25,
  QUIZ_COMPLETION: 25,
  BET_PLACEMENT: 10,
  WEEKLY_WIN_1ST: 500,
  WEEKLY_WIN_2ND: 300,
  WEEKLY_WIN_3RD: 150,
  STREAK_2_WEEK: 100,
  STREAK_BONUS_EVEN: 200
};

// Award streak rewards
async function awardStreakReward(userId, streakLength) {
  let reward = null;
  
  if (streakLength === 2) {
    reward = {
      type: 'royal_coins',
      amount: ROYAL_COIN_REWARDS.STREAK_2_WEEK,
      description: `2-week streak bonus: ${ROYAL_COIN_REWARDS.STREAK_2_WEEK} Royal Coins`
    };
  } else if (streakLength === 3) {
    reward = {
      type: 'btc',
      amount: 0.00001,
      description: '3-week streak bonus: 0.00001 BTC'
    };
  } else if (streakLength >= 4 && streakLength % 2 === 0) {
    reward = {
      type: 'royal_coins',
      amount: ROYAL_COIN_REWARDS.STREAK_BONUS_EVEN,
      description: `${streakLength}-week streak bonus: ${ROYAL_COIN_REWARDS.STREAK_BONUS_EVEN} Royal Coins`
    };
  }
  
  if (reward) {
    await dbRun(`
      INSERT INTO streak_rewards (user_id, streak_length, reward_type, reward_amount, reward_description)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, streakLength, reward.type, reward.amount, reward.description]);
    
    if (reward.type === 'royal_coins') {
      await awardRoyalCoins(userId, reward.amount, `Streak bonus (${streakLength} weeks)`);
    } else if (reward.type === 'btc') {
      await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ? WHERE user_id = ?', [reward.amount, userId]);
    }
    
    console.log(`Awarded streak reward to user ${userId}: ${reward.description}`);
  }
}

// Calculate leaderboard every week
setInterval(() => {
  calculateWeeklyLeaderboard();
}, 7 * 24 * 60 * 60 * 1000); // Weekly

// Do not calculate the leaderboard before the asynchronous schema initialization
// has completed. The scheduled calculation remains available for the weekly job.

// ANALYTICS TRACKING

// Track page view
async function trackPageView() {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET page_views = page_views + 1 WHERE id = ?', [existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, page_views) VALUES (?, 1)', [today]);
  }
}

// Track unique visitor
async function trackVisitor(sessionId) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET unique_visitors = unique_visitors + 1 WHERE id = ?', [existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, unique_visitors) VALUES (?, 1)', [today]);
  }
}

// Track new user registration
async function trackNewUser() {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET new_users = new_users + 1 WHERE id = ?', [existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, new_users) VALUES (?, 1)', [today]);
  }
}

// Track bet placement
async function trackBet(amount) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET total_bets = total_bets + 1, total_volume = total_volume + ? WHERE id = ?', [amount, existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, total_bets, total_volume) VALUES (?, 1, ?)', [today, amount]);
  }
}

// Track revenue (fees) - all fees converted to BTC equivalent and pooled
async function trackRevenue(amountInBTC) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET total_revenue = total_revenue + ? WHERE id = ?', [amountInBTC, existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, total_revenue) VALUES (?, ?)', [today, amountInBTC]);
  }
  
  // Add to platform fee pool (in BTC)
  const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
  if (pool) {
    await dbRun('UPDATE platform_fee_pool SET accumulated_btc = accumulated_btc + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1', [amountInBTC]);
  } else {
    await dbRun('INSERT INTO platform_fee_pool (id, accumulated_btc, total_swept_btc, wallet_address) VALUES (1, ?, 0, ?)', [amountInBTC, process.env.BTC_WALLET_ADDRESS]);
  }
}

// Track fee from any currency conversion - converts the fee to BTC before pooling
async function trackFeeFromConversion(feeAmount, feeCurrency) {
  let feeInBTC = 0;
  
  if (feeCurrency === 'BTC') {
    feeInBTC = feeAmount;
  } else {
    // Convert fee to USD first, then to BTC using current rates
    const currencyRate = await getExchangeRate(feeCurrency);
    if (currencyRate) {
      const feeInUSD = feeAmount * currencyRate.rate_to_usd;
      const btcRate = await getExchangeRate('BTC');
      if (btcRate && btcRate.rate_to_usd > 0) {
        feeInBTC = feeInUSD / btcRate.rate_to_usd;
      }
    }
  }
  
  await trackRevenue(feeInBTC);
  return feeInBTC;
}

// Track token conversion
async function trackConversion() {
  const today = new Date().toISOString().split('T')[0];
  const existing = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]);
  
  if (existing) {
    await dbRun('UPDATE site_analytics SET conversions = conversions + 1 WHERE id = ?', [existing.id]);
  } else {
    await dbRun('INSERT INTO site_analytics (date, conversions) VALUES (?, 1)', [today]);
  }
}

// Log system event
async function logSystemEvent(logType, message, details = null, severity = 'info') {
  await dbRun(`
    INSERT INTO system_logs (log_type, message, details, severity)
    VALUES (?, ?, ?, ?)
  `, [logType, message, details, severity]);
}

// IT TICKET SYSTEM

// Create IT ticket
async function createITTicket(title, description, priority, category, createdBy) {
  const result = await dbRun(`
    INSERT INTO it_tickets (title, description, priority, category, created_by)
    VALUES (?, ?, ?, ?, ?)
  `, [title, description, priority, category, createdBy]);
  
  await logSystemEvent('info', `IT Ticket created: ${title}`, `Ticket ID: ${result.lastID}, Priority: ${priority}`);
  return result.lastID;
}

// Update IT ticket status
async function updateITTicketStatus(ticketId, status, assignedTo = null) {
  await dbRun(`
    UPDATE it_tickets 
    SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, assignedTo, ticketId]);
  
  if (status === 'resolved') {
    await dbRun('UPDATE it_tickets SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
  }
  
  await logSystemEvent('info', `IT Ticket ${ticketId} updated to ${status}`);
}

// Bot commands - Gaming Focus
bot.command('start', (ctx) => {
  const welcomeMessage = `
🎮 Welcome to PixelPulse - Gaming Marketplace & Community!

🎬 CLIPS
• Share highlights from any game — CS2, Roblox, Fortnite, Valorant, and more
• Get upvoted to win weekly prizes
• Build your streak for bonus rewards

💼 MARKETPLACE
• Buy & sell skins, game accounts, and gift cards
• CS2, Roblox, Fortnite, PUBG Mobile, Free Fire, Valorant, Call of Duty, and more
• Escrow-protected trades for safe transactions

🔄 TRADE HUB
• Swap game tokens across all supported platforms
• Send Gold to other players directly
• 8+ token types supported

🔮 PREDICTION MARKETS
• Predict esports match outcomes and anime events
• Win BTC prizes
• 3% flat fee on all predictions

🔗 Start now: https://pixelpulse.zentriva-clubsync.online

Commands:
/clips - View top clips
/markets - View active prediction markets
/marketplace - Browse skin marketplace
/stats - Platform statistics
/help - Get help
  `;
  ctx.reply(welcomeMessage);
});

bot.command('markets', async (ctx) => {
  const markets = await dbAll('SELECT * FROM betting_markets WHERE status = ? ORDER BY created_at DESC LIMIT 5', ['active']);
  
  if (markets.length === 0) {
    ctx.reply('No active markets right now. Check back later!');
    return;
  }
  
  let message = '🔮 Active Prediction Markets:\n\n';
  markets.forEach((market, index) => {
    const options = JSON.parse(market.options).join(', ');
    message += `${index + 1}. ${market.title}\n   Options: ${options}\n   Ends: ${new Date(market.end_date).toLocaleDateString()}\n\n`;
  });
  
  message += '🔗 Predict now: https://pixelpulse.zentriva-clubsync.online';
  ctx.reply(message);
});

bot.command('clips', async (ctx) => {
  const clips = await dbAll('SELECT c.*, u.username, (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) as upvotes FROM clips c JOIN users u ON c.user_id = u.id ORDER BY upvotes DESC LIMIT 5');
  
  if (clips.length === 0) {
    ctx.reply('No clips yet. Be the first to share your highlight!');
    return;
  }
  
  let message = '🎬 Top Clips:\n\n';
  clips.forEach((clip, index) => {
    message += `${index + 1}. ${clip.title}\n   Game: ${clip.game_type}\n   👍 ${clip.upvotes} upvotes\n   👤 ${clip.username}\n\n`;
  });
  
  message += '🔗 Watch clips: https://pixelpulse.zentriva-clubsync.online';
  ctx.reply(message);
});

bot.command('marketplace', async (ctx) => {
  const skins = await dbAll('SELECT s.*, u.username FROM skins s JOIN users u ON s.user_id = u.id WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 5', ['available']);
  
  if (skins.length === 0) {
    ctx.reply('No skins listed yet. List your first skin!');
    return;
  }
  
  let message = '💼 Skin Marketplace:\n\n';
  skins.forEach((skin, index) => {
    message += `${index + 1}. ${skin.skin_name}\n   Weapon: ${skin.weapon}\n   Game: ${skin.game_type}\n   Price: ${skin.price_btc} BTC\n   👤 ${skin.username}\n\n`;
  });
  
  message += '🔗 Browse marketplace: https://pixelpulse.zentriva-clubsync.online';
  ctx.reply(message);
});

bot.command('stats', async (ctx) => {
  const totalClips = (await dbGet('SELECT COUNT(*) as count FROM clips')).count;
  const totalSkins = (await dbGet('SELECT COUNT(*) as count FROM skins WHERE status = ?', ['available'])).count;
  const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
  const totalVolume = (await dbGet('SELECT COALESCE(SUM(total_volume), 0) as volume FROM betting_markets')).volume;
  
  const statsMessage = `
📊 Platform Statistics

🎬 Content:
• ${totalClips} Clips
• ${totalSkins} Skins Listed

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

🔗 Website: https://pixelpulse.zentriva-clubsync.online

For support, contact: @PixelPulseSupport
  `;
  ctx.reply(helpMessage);
});

// Handle text messages
bot.on('text', (ctx) => {
  ctx.reply('Use /help to see available commands. Visit https://pixelpulse.zentriva-clubsync.online for anime streaming and predictions!');
});

// Express middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Session');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const rateLimitStore = new Map();
function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const identifier = key(req);
    const now = Date.now();
    const window = rateLimitStore.get(identifier) || { count: 0, resetAt: now + windowMs };
    if (now > window.resetAt) {
      window.count = 0;
      window.resetAt = now + windowMs;
    }
    window.count += 1;
    rateLimitStore.set(identifier, window);
    if (window.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

// Helper: Generate session token
function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateText(value, { maxLength = 300, required = false } = {}) {
  if (value === undefined || value === null) return !required ? true : false;
  const text = String(value).trim();
  if (required && text.length === 0) return false;
  return text.length <= maxLength;
}

function ensureOwnsResource(req, res, resourceUserId, label = 'resource') {
  if (Number(resourceUserId) !== Number(req.userId)) {
    return res.status(403).json({ error: `You do not own this ${label}.` });
  }
  return true;
}

// AUTHENTICATION API ENDPOINTS

// API: Register user
app.post('/api/auth/register', rateLimit({ windowMs: 60 * 1000, max: 5, key: req => `register:${req.ip || 'unknown'}` }), async (req, res) => {
  const { email, password, username, isAdult, referralCode } = req.body;

  if (!validateEmail(email) || !validateText(password, { maxLength: 128, required: true }) || !validateText(username, { maxLength: 50, required: true })) {
    return res.status(400).json({ error: 'Invalid email, password, or username.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (isAdult !== true && isAdult !== 1) {
    return res.status(400).json({ error: 'You must be 18+ to use this platform' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(String(password));

  // Validate referral code if provided
  let validReferralCode = null;
  if (referralCode && String(referralCode).trim().length > 0) {
    const agent = await dbGet('SELECT id, is_active FROM referral_agents WHERE referral_code = ?', [String(referralCode).trim()]);
    if (agent && agent.is_active === 1) {
      validReferralCode = String(referralCode).trim();
    }
  }

  const result = await dbRun(`
    INSERT INTO users (email, password_hash, username, is_adult, referred_by)
    VALUES (?, ?, ?, ?, ?)
  `, [normalizedEmail, passwordHash, String(username).trim(), 1, validReferralCode]);

  const userId = result.lastID;
  await dbRun('INSERT INTO user_balances (user_id, btc_balance) VALUES (?, 0)', [userId]);
  await dbRun('INSERT INTO user_profiles (user_id, username, avatar_id, banner_id, pixelation_level, weekly_streak, max_streak, clip_wins) VALUES (?, ?, ?, ?, 8, 0, 0, 0)', [userId, String(username).trim(), 'male_default', 'bronze_cloth']);
  await dbRun('INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, 0, 0, 0)', [userId]);

  // Create referral tracking record if valid referral code was used
  if (validReferralCode) {
    const agent = await dbGet('SELECT id FROM referral_agents WHERE referral_code = ?', [validReferralCode]);
    if (agent) {
      await dbRun('INSERT INTO referral_tracking (agent_id, referred_user_id) VALUES (?, ?)', [agent.id, userId]);
      await dbRun('UPDATE referral_agents SET total_referrals = total_referrals + 1 WHERE id = ?', [agent.id]);
    }
  }

  res.json({ message: 'Registration successful', userId });
});

// API: Login user
app.post('/api/auth/login', rateLimit({ windowMs: 60 * 1000, max: 10, key: req => `login:${req.ip || 'unknown'}` }), async (req, res) => {
  const { email, password } = req.body;

  if (!validateEmail(email) || !validateText(password, { maxLength: 128, required: true })) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!(await verifyPassword(String(password), user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await dbRun(`
    INSERT INTO sessions (user_id, session_token, expires_at)
    VALUES (?, ?, ?)
  `, [user.id, sessionToken, expiresAt]);

  res.json({
    message: 'Login successful',
    sessionToken,
    user: { id: user.id, username: user.username, email: user.email }
  });
});

// API: Logout user
app.post('/api/auth/logout', async (req, res) => {
  const { sessionToken } = req.body;
  
  await dbRun('DELETE FROM sessions WHERE session_token = ?', [sessionToken]);
  
  res.json({ message: 'Logout successful' });
});

// API: Get current user
app.get('/api/auth/me', async (req, res) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token' });
  }

  const session = await dbGet('SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime("now")', [sessionToken]);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const tokenColumns = Object.values(TOKEN_TYPES).map(t => t.column).join(', ');
  const user = await dbGet(`SELECT id, username, email, ${tokenColumns} FROM users WHERE id = ?`, [session.user_id]);
  const balance = await dbGet('SELECT * FROM user_balances WHERE user_id = ?', [session.user_id]);

  const tokens = {};
  for (const [key, info] of Object.entries(TOKEN_TYPES)) {
    tokens[key] = { label: info.label, icon: info.icon, game: info.game, balance: user[info.column] || 0 };
  }

  res.json({ user, balance, tokens });
});

// Middleware: Authenticate requests
async function authenticateRequest(req, res, next) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token' });
  }
  
  const session = await dbGet('SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime("now")', [sessionToken]);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.userId = session.user_id;
  req.isAdmin = session.is_admin || false;

  // Check if user is banned (only for trade-related write actions)
  const tradeActions = ['/api/skins', '/api/p2p-trades', '/api/escrow', '/api/trades/list'];
  const isTradeAction = req.method === 'POST' && tradeActions.some(p => req.path.startsWith(p));
  if (isTradeAction) {
    const banned = await isUserBanned(session.user_id);
    if (banned) {
      return res.status(403).json({ error: 'Your account has been banned due to trade disputes. Contact support if you believe this is an error.' });
    }
  }

  next();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// CLIPS API ENDPOINTS

// API: Get all clips
app.get('/api/clips', async (req, res) => {
  const clips = await dbAll(`
    SELECT c.*, u.username, 
           (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) as upvotes,
           (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = -1) as downvotes
    FROM clips c 
    JOIN users u ON c.user_id = u.id 
    ORDER BY c.created_at DESC
  `);
  res.json(clips);
});

// API: Get single clip
app.get('/api/clips/:id', async (req, res) => {
  const clip = await dbGet(`
    SELECT c.*, u.username, 
           (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) as upvotes,
           (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = -1) as downvotes
    FROM clips c 
    JOIN users u ON c.user_id = u.id 
    WHERE c.id = ?
  `, [req.params.id]);
  
  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' });
  }
  
  const comments = await dbAll(`
    SELECT cc.*, u.username 
    FROM clip_comments cc 
    JOIN users u ON cc.user_id = u.id 
    WHERE cc.clip_id = ? 
    ORDER BY cc.created_at DESC
  `, [req.params.id]);
  
  clip.comments = comments;
  res.json(clip);
});

// API: Upload clip
app.post('/api/clips', authenticateRequest, async (req, res) => {
  const { title, description, video_url, game_type, thumbnail_url } = req.body;

  if (!validateText(title, { maxLength: 120, required: true }) || !validateText(description, { maxLength: 500 })) {
    return res.status(400).json({ error: 'Clip title is required and must be shorter than 120 characters.' });
  }

  if (!video_url || !/^https?:\/\//.test(String(video_url))) {
    return res.status(400).json({ error: 'A valid video URL is required.' });
  }

  const finalGameType = game_type || 'General';

  let embedUrl = video_url;
  let videoType = 'direct';

  if (video_url.includes('youtube.com') || video_url.includes('youtu.be')) {
    videoType = 'youtube';
    const videoId = video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    if (videoId) {
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }
  } else if (video_url.includes('twitch.tv')) {
    videoType = 'twitch';
    const match = video_url.match(/twitch\.tv\/([^\/]+)/);
    if (match) {
      embedUrl = `https://player.twitch.tv/?channel=${match[1]}&parent=localhost`;
    }
  }

  const result = await dbRun(`
    INSERT INTO clips (user_id, title, description, video_url, game_type, thumbnail_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [req.userId, title, description, embedUrl, finalGameType, thumbnail_url]);
  
  await awardRoyalCoins(req.userId, ROYAL_COIN_REWARDS.CLIP_UPLOAD, 'Clip upload');
  
  // Notify Telegram channel
  const uploader = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  notifyNewClip(title, finalGameType, uploader?.username || 'Anonymous', embedUrl).catch(() => {});
  
  res.json({ id: result.lastID, message: 'Clip uploaded successfully', videoType, embedUrl, royalCoinsEarned: ROYAL_COIN_REWARDS.CLIP_UPLOAD });
});

// API: Vote on clip
app.post('/api/clips/:id/vote', authenticateRequest, async (req, res) => {
  const { vote_type } = req.body;
  
  if (vote_type !== 1 && vote_type !== -1) {
    return res.status(400).json({ error: 'Invalid vote type' });
  }
  
  const existingVote = await dbGet('SELECT * FROM clip_votes WHERE clip_id = ? AND user_id = ?', [req.params.id, req.userId]);
  
  if (existingVote) {
    await dbRun('UPDATE clip_votes SET vote_type = ? WHERE id = ?', [vote_type, existingVote.id]);
  } else {
    await dbRun('INSERT INTO clip_votes (clip_id, user_id, vote_type) VALUES (?, ?, ?)', [req.params.id, req.userId, vote_type]);
  }
  
  res.json({ message: 'Vote recorded successfully' });
});

// API: Comment on clip
app.post('/api/clips/:id/comments', authenticateRequest, rateLimit({ windowMs: 60 * 1000, max: 30, key: req => `clip-comments:${req.userId || req.ip}` }), async (req, res) => {
  const { comment } = req.body;

  if (!validateText(comment, { maxLength: 500, required: true })) {
    return res.status(400).json({ error: 'Comment must be 1-500 characters.' });
  }

  const result = await dbRun(`
    INSERT INTO clip_comments (clip_id, user_id, comment)
    VALUES (?, ?, ?)
  `, [req.params.id, req.userId, String(comment).trim()]);

  res.json({ id: result.lastID, message: 'Comment added successfully' });
});

// API: Get weekly leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const leaderboard = await dbAll(`
    SELECT u.username, wl.total_likes, wl.total_clips, wl.rank
    FROM weekly_leaderboard wl
    JOIN users u ON wl.user_id = u.id
    WHERE wl.week_start = date('now', 'weekday 0', '-7 days')
    ORDER BY wl.total_likes DESC
    LIMIT 10
  `);
  
  res.json(leaderboard);
});

// SKIN MARKETPLACE API ENDPOINTS

// API: Get all available skins
app.get('/api/skins', async (req, res) => {
  const skins = await dbAll(`
    SELECT s.*, u.username 
    FROM skins s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.status = 'available'
    ORDER BY s.created_at DESC
  `);

  const tokenRates = await dbAll('SELECT * FROM token_rates');
  const rateByType = {};
  tokenRates.forEach(r => { rateByType[r.token_type] = r.rate_to_usd; });

  const exchangeRates = await dbAll('SELECT * FROM exchange_rates');
  const fiatRateByCurrency = {};
  exchangeRates.forEach(r => { fiatRateByCurrency[r.currency] = r.rate_to_usd; });

  const btcUsd = fiatRateByCurrency['BTC'] || 65000;

  const skinsWithUsd = skins.map(skin => {
    const isCS2 = skin.game_type === 'CS2';
    let priceUsd = 0;
    if (isCS2 && skin.price_fiat > 0) {
      priceUsd = skin.price_fiat * (fiatRateByCurrency[skin.fiat_currency] || 1);
    } else {
      priceUsd = (rateByType[skin.token_type] || 0) * skin.price_tokens;
    }
    return {
      ...skin,
      price_usd: priceUsd,
      is_fiat_priced: isCS2,
      price_btc: isCS2 && btcUsd > 0 ? priceUsd / btcUsd : 0
    };
  });

  res.json(skinsWithUsd);
});

// API: Get seller's completed skin sale receipts
app.get('/api/skins/receipts', authenticateRequest, async (req, res) => {
  const receipts = await dbAll(`
    SELECT st.*, s.skin_name, s.game_type, s.image_url, buyer.username as buyer_username
    FROM skin_transactions st
    JOIN skins s ON st.skin_id = s.id
    JOIN users buyer ON st.buyer_id = buyer.id
    WHERE st.seller_id = ? AND st.status = 'completed'
    ORDER BY st.created_at DESC
  `, [req.userId]);
  res.json(receipts);
});

// API: Get buyer's completed skin purchase receipts
app.get('/api/skins/purchases', authenticateRequest, async (req, res) => {
  const receipts = await dbAll(`
    SELECT st.*, s.skin_name, s.game_type, s.image_url, seller.username as seller_username
    FROM skin_transactions st
    JOIN skins s ON st.skin_id = s.id
    JOIN users seller ON st.seller_id = seller.id
    WHERE st.buyer_id = ? AND st.status = 'completed'
    ORDER BY st.created_at DESC
  `, [req.userId]);
  res.json(receipts);
});

// API: List skin for sale
app.post('/api/skins', authenticateRequest, async (req, res) => {
  const { game_type, skin_name, weapon, rarity, float_value, price_tokens, token_type, image_url, price_fiat, fiat_currency } = req.body;

  if (!game_type) {
    return res.status(400).json({ error: 'Game type is required' });
  }

  const isCS2 = game_type === 'CS2';
  let resolvedTokenType = '';
  let resolvedPriceFiat = 0;
  let resolvedFiatCurrency = '';

  if (isCS2) {
    // CS2 skins are priced in fiat only
    if (!price_fiat || price_fiat <= 0) {
      return res.status(400).json({ error: 'CS2 skins require a fiat price' });
    }
    const currency = fiat_currency || 'USD';
    if (!SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[currency].type !== 'fiat') {
      return res.status(400).json({ error: 'Invalid fiat currency. Supported: USD, EUR, GBP, ZAR' });
    }
    resolvedPriceFiat = parseFloat(price_fiat);
    resolvedFiatCurrency = currency;
    resolvedTokenType = 'steam'; // placeholder for DB compatibility
  } else {
    // Non-CS2 skins use token pricing
    const tt = (token_type && TOKEN_TYPES[token_type]) ? token_type : (game_type === 'Standoff2' ? 'standoff2' : '');
    if (!tt || !TOKEN_TYPES[tt]) {
      return res.status(400).json({ error: 'Invalid token type' });
    }
    if (!price_tokens || price_tokens <= 0) {
      return res.status(400).json({ error: 'Non-CS2 skins require a token price' });
    }
    resolvedTokenType = tt;
  }

  const result = await dbRun(`
    INSERT INTO skins (user_id, game_type, skin_name, weapon, rarity, float_value, price_tokens, token_type, image_url, price_fiat, fiat_currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.userId, game_type, skin_name, weapon, rarity, float_value, isCS2 ? 0 : price_tokens, resolvedTokenType, image_url, resolvedPriceFiat, resolvedFiatCurrency]);

  // Broadcast to Discord
  const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  const priceDisplay = isCS2
    ? `${resolvedPriceFiat} ${resolvedFiatCurrency}`
    : `${price_tokens} ${getTokenLabel(resolvedTokenType)} tokens`;
  broadcastToDiscord(
    '🛒 New Skin Listing',
    `**${skin_name}** (${weapon})\nGame: ${game_type} | Rarity: ${rarity}\nPrice: ${priceDisplay}\nSeller: ${user?.username || 'Unknown'}`,
    0x4caf50
  ).catch(() => {});

  // Notify Telegram channel
  notifyNewSkinListing(
    `${skin_name} (${weapon || 'Item'})`,
    game_type,
    isCS2 ? resolvedPriceFiat : price_tokens,
    isCS2 ? resolvedFiatCurrency : `${getTokenLabel(resolvedTokenType)} tokens`,
    user?.username || 'Unknown'
  ).catch(() => {});

  res.json({ id: result.lastID, message: 'Skin listed successfully' });
});

// CHAT API ENDPOINTS

// API: Get community chat messages
app.get('/api/chat/community', async (req, res) => {
  const messages = await dbAll(`
    SELECT cm.*, u.username 
    FROM chat_messages cm 
    JOIN users u ON cm.user_id = u.id 
    WHERE cm.message_type = 'community'
    ORDER BY cm.created_at DESC 
    LIMIT 50
  `);
  
  res.json(messages.reverse());
});

// API: Get DM messages
app.get('/api/chat/dm/:userId', authenticateRequest, async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  
  const messages = await dbAll(`
    SELECT cm.*, u.username 
    FROM chat_messages cm 
    JOIN users u ON cm.user_id = u.id 
    WHERE cm.message_type = 'dm' 
      AND ((cm.user_id = ? AND cm.recipient_id = ?) OR (cm.user_id = ? AND cm.recipient_id = ?))
    ORDER BY cm.created_at ASC
  `, [req.userId, otherUserId, otherUserId, req.userId]);
  
  res.json(messages);
});

// API: Send community message
app.post('/api/chat/community', authenticateRequest, rateLimit({ windowMs: 60 * 1000, max: 20, key: req => `community-chat:${req.userId || req.ip}` }), async (req, res) => {
  const { message } = req.body;

  if (!validateText(message, { maxLength: 500, required: true })) {
    return res.status(400).json({ error: 'Message must be 1-500 characters.' });
  }

  await dbRun('INSERT INTO chat_messages (user_id, message, message_type) VALUES (?, ?, ?)', [req.userId, String(message).trim(), 'community']);

  // Bridge to Discord: send webapp community messages to Discord channel
  const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  if (user) {
    broadcastToDiscord('💬 Community Chat', `**${user.username}:** ${String(message).trim()}`, 0x5865f2).catch(() => {});
  }

  res.json({ message: 'Message sent' });
});

// API: Send DM
app.post('/api/chat/dm/:userId', authenticateRequest, rateLimit({ windowMs: 60 * 1000, max: 20, key: req => `dm-chat:${req.userId}:${req.params.userId}` }), async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const { message } = req.body;

  if (!Number.isInteger(otherUserId) || otherUserId === req.userId) {
    return res.status(400).json({ error: 'Invalid conversation target.' });
  }

  if (!validateText(message, { maxLength: 500, required: true })) {
    return res.status(400).json({ error: 'Message must be 1-500 characters.' });
  }

  await dbRun('INSERT INTO chat_messages (user_id, recipient_id, message, message_type) VALUES (?, ?, ?, ?)', [req.userId, otherUserId, String(message).trim(), 'dm']);

  res.json({ message: 'DM sent' });
});


// Conversion fee: 3%
const CONVERSION_FEE = 0.03;

// API: Get exchange rates
app.get('/api/rates', async (req, res) => {
  const rates = await dbAll('SELECT * FROM exchange_rates');
  const tokenRates = await dbAll('SELECT * FROM token_rates');
  const tokenTypes = Object.entries(TOKEN_TYPES).map(([key, info]) => ({
    key,
    label: info.label,
    icon: info.icon,
    game: info.game
  }));
  res.json({ currencies: rates, tokens: tokenRates, tokenTypes });
});

// API: Manual sync esports matches
app.post('/api/admin/sync-esports', checkAdminSession, (req, res) => {
  syncEsportsMatches()
    .then(() => res.json({ message: 'Esports matches synced successfully' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// API: Manual resolve betting markets
app.post('/api/admin/resolve-bets', checkAdminSession, (req, res) => {
  resolveBettingMarkets()
    .then(() => res.json({ message: 'Betting markets resolved successfully' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// API: Get esports sync status
app.get('/api/admin/esports-status', checkAdminSession, async (req, res) => {
  const totalMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets')).count;
  const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
  const apiMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE api_event_id IS NOT NULL')).count;
  const animeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE category = ?', ['anime'])).count;
  
  res.json({
    totalMarkets,
    activeMarkets,
    apiMarkets,
    animeMarkets,
    lastSync: new Date().toISOString()
  });
});

// API: Get anime data for display
app.get('/api/anime/data', async (req, res) => {
  try {
    const animeData = await fetchAnimeData();
    res.json(animeData);
  } catch (error) {
    console.error('Failed to fetch anime data:', error);
    res.status(500).json({ error: 'Failed to fetch anime data' });
  }
});

// API: Get esports data for display
app.get('/api/esports/data', async (req, res) => {
  try {
    const game = req.query.game || 'cs2';
    const esportsData = await fetchEsportsMatches(game);
    res.json(esportsData);
  } catch (error) {
    console.error('Failed to fetch esports data:', error);
    res.status(500).json({ error: 'Failed to fetch esports data' });
  }
});

// Information-first feed for the Prediction page. Fixtures are shown before a
// market is opened, and source availability is explicit instead of simulated.
app.get('/api/predictions/feed', async (req, res) => {
  const requested = String(req.query.games || 'cs2,valorant,lol,dota2')
    .split(',').map(game => game.trim()).filter(game => PANDASCORE_GAMES[game]);
  const games = requested.length ? requested : Object.keys(PANDASCORE_GAMES);
  const [liveGroups, upcomingGroups, anime] = await Promise.all([
    Promise.all(games.map(async game => ({ game, matches: await fetchPandaScoreMatches(game, 'live').catch(() => []) }))),
    Promise.all(games.map(async game => ({ game, matches: await fetchPandaScoreMatches(game, 'upcoming').catch(() => []) }))),
    fetchAniListAnime().catch(() => [])
  ]);
  const decorate = groups => groups.flatMap(({ game, matches }) => matches.map(match => ({
    id: match.id,
    game,
    title: match.name || `${match.opponents?.[0]?.opponent?.name || 'TBD'} vs ${match.opponents?.[1]?.opponent?.name || 'TBD'}`,
    league: match.league?.name || 'Tournament',
    scheduledAt: match.scheduled_at || match.begin_at,
    status: match.status,
    bestOf: match.number_of_games ? `BO${match.number_of_games}` : null,
    opponents: (match.opponents || []).map(entry => entry.opponent?.name).filter(Boolean)
  })));
  res.json({
    mode: process.env.PREDICTION_MODE || 'credits',
    sources: {
      pandaScore: { configured: Boolean(process.env.PANDASCORE_API_KEY), games: Object.keys(PANDASCORE_GAMES) },
      aniList: { configured: true }
    },
    live: decorate(liveGroups),
    upcoming: decorate(upcomingGroups),
    anime: anime.slice(0, 8).map(item => ({
      id: item.id,
      title: item.title?.english || item.title?.romaji || item.title,
      coverImage: (item.coverImage && typeof item.coverImage === 'object' ? (item.coverImage.large || item.coverImage.medium) : item.coverImage) || item.images?.jpg?.large_image_url || item.image_url || null,
      startDate: item.startDate,
      score: item.averageScore,
      genres: item.genres || []
    })),
    refreshedAt: new Date().toISOString()
  });
});

// API: Manual sync anime data
app.post('/api/admin/sync-anime', checkAdminSession, (req, res) => {
  syncAnimeData()
    .then(() => res.json({ message: 'Anime data synced successfully' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// API: Get user streak rewards
app.get('/api/streak/rewards/:userId', async (req, res) => {
  const rewards = await dbAll('SELECT * FROM streak_rewards WHERE user_id = ? ORDER BY awarded_at DESC', [req.params.userId]);
  res.json(rewards);
});

// API: Get current leaderboard with streaks
app.get('/api/leaderboard/current', async (req, res) => {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  const leaderboard = await dbAll(`
    SELECT wl.*, u.username 
    FROM weekly_leaderboard wl
    JOIN users u ON wl.user_id = u.id
    WHERE wl.week_start = ?
    ORDER BY wl.rank ASC
    LIMIT 10
  `, [weekStartStr]);
  
  res.json(leaderboard);
});

// QUIZ API ENDPOINTS

// API: Get all quizzes
app.get('/api/quizzes', async (req, res) => {
  const quizzes = await dbAll('SELECT id, anime_id, title, description, reward_points, difficulty FROM quizzes ORDER BY created_at DESC');
  res.json(quizzes);
});

// API: Get today's community posts (polls, news, discussions, quiz of the day)
app.get('/api/community/posts', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const posts = await dbAll(
    `SELECT * FROM community_posts WHERE date(created_at) = date('now') ORDER BY created_at DESC`
  );
  const parsed = posts.map(p => ({
    ...p,
    poll_options: p.poll_options ? JSON.parse(p.poll_options) : null,
    content: p.post_type === 'gaming_news' && p.content ? JSON.parse(p.content) : p.content
  }));
  res.json(parsed);
});

// API: Get recent community posts (last 7 days)
app.get('/api/community/posts/recent', async (req, res) => {
  const posts = await dbAll(
    `SELECT * FROM community_posts WHERE created_at >= datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 20`
  );
  const parsed = posts.map(p => ({
    ...p,
    poll_options: p.poll_options ? JSON.parse(p.poll_options) : null,
    content: p.post_type === 'gaming_news' && p.content ? JSON.parse(p.content) : p.content
  }));
  res.json(parsed);
});

// API: Get quiz by ID
app.get('/api/quizzes/:id', async (req, res) => {
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  
  let completed = false;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const session = await dbGet('SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime("now")', [token]);
    if (session) {
      const attempt = await dbGet('SELECT * FROM user_quiz_attempts WHERE user_id = ? AND quiz_id = ?', [session.user_id, quiz.id]);
      if (attempt) completed = true;
    }
  }
  
  res.json({ ...quiz, questions: JSON.parse(quiz.questions), completed });
});

// API: Submit quiz answers and earn Royal Coins
app.post('/api/quizzes/:id/submit', authenticateRequest, async (req, res) => {
  const { answers } = req.body;
  
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  
  // Check if already completed
  const existing = await dbGet('SELECT * FROM user_quiz_attempts WHERE user_id = ? AND quiz_id = ?', [req.userId, quiz.id]);
  if (existing) return res.status(400).json({ error: 'Quiz already completed' });
  
  // Grade the quiz
  const questions = JSON.parse(quiz.questions);
  let correctCount = 0;
  const totalQuestions = questions.length;
  
  answers.forEach(ans => {
    const question = questions[ans.questionIndex];
    if (question && question.correctAnswer === ans.selectedOption) {
      correctCount++;
    }
  });
  
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= 60;
  
  // Award Royal Coins only if passed
  let coinsEarned = 0;
  if (passed) {
    coinsEarned = ROYAL_COIN_REWARDS.QUIZ_COMPLETION;
    await awardRoyalCoins(req.userId, coinsEarned, `Quiz completed: ${quiz.title}`);
  }
  
  // Record attempt
  await dbRun('INSERT INTO user_quiz_attempts (user_id, quiz_id, score, points_earned) VALUES (?, ?, ?, ?)',
    [req.userId, quiz.id, score, coinsEarned]);
  
  res.json({
    score,
    correctCount,
    totalQuestions,
    passed,
    royalCoinsEarned: coinsEarned,
    message: passed ? `Quiz passed! +${coinsEarned} Royal Coins` : 'Quiz not passed. Try again next time.'
  });
});

// API: Get user's Royal Coins balance
app.get('/api/user/royal-coins', authenticateRequest, async (req, res) => {
  const points = await dbGet('SELECT * FROM user_points WHERE user_id = ?', [req.userId]);
  res.json({
    royalCoins: points?.points || 0,
    totalEarned: points?.total_earned || 0,
    totalSpent: points?.total_spent || 0
  });
});

// PARLAY/TICKET SYSTEM (Betway-style accumulator slip)

// Calculate odds for a market option based on pool distribution
async function calculateMarketOdds(marketId, selectedOption) {
  const market = await dbGet('SELECT * FROM betting_markets WHERE id = ?', [marketId]);
  if (!market) return 2.0;

  const totalBets = (await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM user_bets WHERE market_id = ?', [marketId])).total;
  const optionBets = (await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM user_bets WHERE market_id = ? AND option = ?', [marketId, selectedOption])).total;

  if (totalBets === 0 || optionBets === 0) {
    const options = JSON.parse(market.options);
    return Math.max(1.5, options.length * 0.9);
  }

  const feeRate = market.fee_rate || 0.03;
  const odds = (totalBets / optionBets) * (1 - feeRate);
  return Math.max(1.1, Math.min(odds, 50));
}

// API: Create parlay ticket (accumulator slip)
app.post('/api/parlay/create', authenticateRequest, async (req, res) => {
  const { selections, stakeAmount } = req.body;
  const userId = req.userId;
  
  if (!selections || !Array.isArray(selections) || selections.length < 2 || selections.length > 10) {
    return res.status(400).json({ error: 'Slip must have 2-10 selections' });
  }
  
  if (!stakeAmount || stakeAmount <= 0) {
    return res.status(400).json({ error: 'Invalid stake amount' });
  }
  
  // Check user balance
  const balance = await dbGet('SELECT btc_balance FROM user_balances WHERE user_id = ?', [userId]);
  if (!balance || balance.btc_balance < stakeAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  // Validate each selection and calculate combined odds
  let totalOdds = 1;
  const validatedSelections = [];
  
  for (const selection of selections) {
    const market = await dbGet('SELECT * FROM betting_markets WHERE id = ? AND status = ?', [selection.marketId, 'active']);
    if (!market) {
      return res.status(400).json({ error: `Market ${selection.marketId} is not active` });
    }
    
    const options = JSON.parse(market.options);
    if (!options.includes(selection.option)) {
      return res.status(400).json({ error: `Invalid option for market ${selection.marketId}` });
    }
    
    const odds = await calculateMarketOdds(selection.marketId, selection.option);
    totalOdds *= odds;
    
    validatedSelections.push({
      marketId: selection.marketId,
      marketTitle: market.title,
      option: selection.option,
      odds: odds
    });
  }
  
  const bonusMultiplier = selections.length >= 8 ? 1.10 : selections.length >= 5 ? 1.05 : 1;
  const platformFeeRate = parseFloat(process.env.PLATFORM_FEE_PERCENT || 3) / 100;
  const potentialPayout = stakeAmount * totalOdds * bonusMultiplier * (1 - platformFeeRate);
  
  await dbRun('UPDATE user_balances SET btc_balance = btc_balance - ? WHERE user_id = ?', [stakeAmount, userId]);
  
  const result = await dbRun(`
    INSERT INTO parlay_tickets (user_id, selections, stake_amount, potential_payout)
    VALUES (?, ?, ?, ?)
  `, [userId, JSON.stringify(validatedSelections), stakeAmount, potentialPayout]);
  
  await trackBet(stakeAmount);
  const feeInBTC = stakeAmount * platformFeeRate;
  await trackRevenue(feeInBTC);
  
  await awardRoyalCoins(userId, ROYAL_COIN_REWARDS.BET_PLACEMENT, 'Prediction slip placed');
  
  await logSystemEvent('info', `Parlay slip created by user ${userId}`, `Slip ID: ${result.lastID}, Selections: ${selections.length}, Odds: ${totalOdds.toFixed(2)}, Potential: ${potentialPayout.toFixed(8)} BTC`);
  
  res.json({
    ticketId: result.lastID,
    totalOdds: totalOdds * bonusMultiplier,
    potentialPayout,
    selections: validatedSelections,
    message: 'Prediction slip created successfully!',
    royalCoinsEarned: ROYAL_COIN_REWARDS.BET_PLACEMENT
  });
});

// API: Get user parlay tickets
app.get('/api/parlay/user/:userId', async (req, res) => {
  const tickets = await dbAll('SELECT * FROM parlay_tickets WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
  res.json(tickets);
});

// API: Get odds for a specific market option
app.get('/api/betting/markets/:marketId/odds/:option', async (req, res) => {
  const { marketId, option } = req.params;
  const decodedOption = decodeURIComponent(option);
  const odds = await calculateMarketOdds(parseInt(marketId), decodedOption);
  res.json({ marketId, option: decodedOption, odds });
});

// Resolve parlay tickets when markets resolve
async function resolveParlayTickets(marketId, winningOption) {
  const activeTickets = await dbAll('SELECT * FROM parlay_tickets WHERE status = ?', ['active']);
  
  for (const ticket of activeTickets) {
    const selections = JSON.parse(ticket.selections);
    const hasMarket = selections.some(s => s.marketId === marketId);
    
    if (!hasMarket) continue;
    
    const selection = selections.find(s => s.marketId === marketId);
    const won = selection.option === winningOption;
    
    if (!won) {
      await dbRun('UPDATE parlay_tickets SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?', ['lost', ticket.id]);
      await logSystemEvent('info', `Parlay slip ${ticket.id} lost`, `Selection ${marketId} (${selection.option}) did not win. Winner: ${winningOption}`);
      
      const user = await dbGet('SELECT username FROM users WHERE id = ?', [ticket.user_id]);
      if (ticket.stake_amount >= 0.01) {
        postToChannel(`💔 SLIP BUSTED\n\n👤 ${user?.username || 'Anonymous'}\n🎫 ${selections.length} selections\n💰 Stake: ${ticket.stake_amount} BTC\n❌ Lost on: ${selection.marketTitle}\n\nBetter luck next time! 🔮`).catch(() => {});
      }
      continue;
    }
    
    let allResolved = true;
    let allWon = true;
    
    for (const sel of selections) {
      if (sel.marketId === marketId) continue;
      
      const market = await dbGet('SELECT status, resolution_value FROM betting_markets WHERE id = ?', [sel.marketId]);
      if (!market || market.status !== 'resolved') {
        allResolved = false;
        break;
      }
      
      const resolution = JSON.parse(market.resolution_value || '{}');
      const marketWinner = resolution.winner || resolution.released;
      if (marketWinner !== sel.option) {
        allWon = false;
        break;
      }
    }
    
    if (allResolved && allWon) {
      await dbRun('UPDATE parlay_tickets SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?', ['won', ticket.id]);
      await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ? WHERE user_id = ?', [ticket.potential_payout, ticket.user_id]);
      
      await logSystemEvent('info', `Parlay slip ${ticket.id} WON!`, `Payout: ${ticket.potential_payout} BTC to user ${ticket.user_id}`);
      
      const user = await dbGet('SELECT username FROM users WHERE id = ?', [ticket.user_id]);
      const selectionsData = JSON.parse(ticket.selections);
      postToChannel(`🎉 PARLAY SLIP WON!\n\n👤 ${user?.username || 'Anonymous'}\n🎫 ${selectionsData.length} selections — ALL CORRECT!\n💰 Stake: ${ticket.stake_amount} BTC\n🤑 Payout: ${ticket.potential_payout.toFixed(8)} BTC\n\nCongratulations! 🏆`).catch(() => {});
      
      notifyMarketResolved(`Parlay Slip #${ticket.id}`, 'All selections won', ticket.stake_amount, ticket.potential_payout).catch(() => {});
    }
  }
}

// ===== AVATAR & BANNER SYSTEM API ENDPOINTS =====

// Helper: Get or create user profile
async function getOrCreateUserProfile(userId) {
  let profile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  if (!profile) {
    const user = await dbGet('SELECT username FROM users WHERE id = ?', [userId]);
    await dbRun('INSERT INTO user_profiles (user_id, username) VALUES (?, ?)', [userId, user?.username || 'User']);
    profile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  }
  return profile;
}

// Helper: Get user stats for unlock checks
async function getUserStats(userId) {
  const profile = await getOrCreateUserProfile(userId);
  const points = await dbGet('SELECT points FROM user_points WHERE user_id = ?', [userId]);
  return {
    sitePoints: points?.points || 0,
    weeklyStreak: profile?.weekly_streak || 0,
    clipWins: profile?.clip_wins || 0
  };
}

// Helper: Check and auto-unlock streak-based avatars/banners
async function checkStreakUnlocks(userId) {
  const stats = await getUserStats(userId);
  const profile = await getOrCreateUserProfile(userId);
  const unlocks = [];
  
  for (const avatar of AVATARS) {
    if (avatar.category === 'streak' && canUnlockAvatar(avatar, stats)) {
      const existing = await dbGet('SELECT 1 FROM user_avatar_unlocks WHERE user_id = ? AND avatar_id = ?', [userId, avatar.id]);
      if (!existing) {
        await dbRun('INSERT INTO user_avatar_unlocks (user_id, avatar_id, unlock_method) VALUES (?, ?, ?)', [userId, avatar.id, 'streak']);
        unlocks.push({ type: 'avatar', id: avatar.id, name: avatar.name });
      }
    }
  }
  
  for (const banner of BANNERS) {
    if (banner.category === 'streak' && canUnlockBanner(banner, stats)) {
      const existing = await dbGet('SELECT 1 FROM user_banner_unlocks WHERE user_id = ? AND banner_id = ?', [userId, banner.id]);
      if (!existing) {
        await dbRun('INSERT INTO user_banner_unlocks (user_id, banner_id, unlock_method) VALUES (?, ?, ?)', [userId, banner.id, 'streak']);
        unlocks.push({ type: 'banner', id: banner.id, name: banner.name });
      }
    }
  }
  
  const newPixelLevel = getPixelationLevel(stats.weeklyStreak);
  if (profile.pixelation_level !== newPixelLevel) {
    await dbRun('UPDATE user_profiles SET pixelation_level = ? WHERE user_id = ?', [newPixelLevel, userId]);
  }
  
  return unlocks;
}

// API: Get all avatars with unlock status
app.get('/api/avatars', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const stats = await getUserStats(userId);
  const unlockedAvatars = await dbAll('SELECT avatar_id FROM user_avatar_unlocks WHERE user_id = ?', [userId]);
  const unlockedIds = unlockedAvatars.map(a => a.avatar_id);
  
  const avatars = AVATARS.map(avatar => ({
    ...avatar,
    unlocked: avatar.unlockCondition === 'default' || unlockedIds.includes(avatar.id),
    canUnlock: canUnlockAvatar(avatar, stats)
  }));
  
  res.json(avatars);
});

// API: Get all banners with unlock status
app.get('/api/banners', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const stats = await getUserStats(userId);
  const unlockedBanners = await dbAll('SELECT banner_id FROM user_banner_unlocks WHERE user_id = ?', [userId]);
  const unlockedIds = unlockedBanners.map(b => b.banner_id);
  
  const banners = BANNERS.map(banner => ({
    ...banner,
    unlocked: banner.unlockCondition === 'default' || unlockedIds.includes(banner.id),
    canUnlock: canUnlockBanner(banner, stats)
  }));
  
  res.json(banners);
});

// API: Change username
app.post('/api/profile/username', authenticateRequest, async (req, res) => {
  const newUsername = String(req.body.username || '').trim();
  if (!newUsername || newUsername.length < 3 || newUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters long' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
  }

  // Check if username is taken by another user
  const existing = await dbGet('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, req.userId]);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken' });
  }

  // Check cooldown (30 days)
  const profile = await dbGet('SELECT username_changed_at FROM user_profiles WHERE user_id = ?', [req.userId]);
  if (profile && profile.username_changed_at) {
    const lastChange = new Date(profile.username_changed_at);
    const daysSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) {
      const daysLeft = Math.ceil(30 - daysSince);
      return res.status(429).json({ error: `You can change your username again in ${daysLeft} day(s)` });
    }
  }

  const oldUsername = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  await dbRun('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.userId]);
  await dbRun('UPDATE user_profiles SET username = ?, username_changed_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newUsername, req.userId]);

  console.log(`User ${req.userId} changed username from "${oldUsername?.username}" to "${newUsername}"`);
  res.json({ message: 'Username updated successfully', username: newUsername });
});

// API: Get user profile (avatar, banner, streak, etc.)
app.get('/api/profile', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const profile = await getOrCreateUserProfile(userId);
  const stats = await getUserStats(userId);
  const user = await dbGet('SELECT preferred_currency FROM users WHERE id = ?', [userId]);
  
  const newUnlocks = await checkStreakUnlocks(userId);
  
  const avatar = AVATARS.find(a => a.id === profile.avatar_id) || AVATARS[0];
  const banner = BANNERS.find(b => b.id === profile.banner_id) || BANNERS[0];
  const dragon = profile.dragon_id ? AVATARS.find(a => a.id === profile.dragon_id) : null;
  
  res.json({
    profile: {
      ...profile,
      avatar: avatar ? { id: avatar.id, name: avatar.name, svg: avatar.svg, tier: avatar.tier, rarity: avatar.rarity } : null,
      banner: banner ? { id: banner.id, name: banner.name, svg: banner.svg, tier: banner.tier, rarity: banner.rarity } : null,
      dragon: dragon ? { id: dragon.id, name: dragon.name, svg: dragon.svg } : null,
      pixelationLevel: profile.pixelation_level,
      blurAmount: getBlurFromLevel(profile.pixelation_level),
      sitePoints: stats.sitePoints,
      preferredCurrency: user?.preferred_currency || 'USD'
    },
    newUnlocks
  });
});

// API: Update preferred display currency
app.post('/api/profile/currency', authenticateRequest, async (req, res) => {
  const { currency } = req.body;
  if (!currency || !SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[currency].type !== 'fiat') {
    return res.status(400).json({ error: 'Invalid currency. Must be one of: ' + Object.keys(SUPPORTED_CURRENCIES).filter(c => SUPPORTED_CURRENCIES[c].type === 'fiat').join(', ') });
  }
  await dbRun('UPDATE users SET preferred_currency = ? WHERE id = ?', [currency, req.userId]);
  res.json({ message: 'Preferred currency updated', currency });
});

// API: Profile analytics - earnings, clip performance, trading activity
app.get('/api/profile/analytics', authenticateRequest, async (req, res) => {
  const userId = req.userId;

  const clips = await dbAll(`
    SELECT c.id, c.title, c.views, c.created_at,
      COALESCE((SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1), 0) as likes,
      COALESCE((SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = -1), 0) as dislikes
    FROM clips c
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const clipTotals = clips.reduce((acc, c) => {
    acc.totalViews += c.views || 0;
    acc.totalLikes += c.likes || 0;
    return acc;
  }, { totalViews: 0, totalLikes: 0 });

  const skinSales = await dbAll(`
    SELECT token_type, COUNT(*) as count, SUM(price_tokens) as total_tokens, SUM(price_usd) as total_usd
    FROM skin_transactions
    WHERE seller_id = ? AND status = 'completed'
    GROUP BY token_type
  `, [userId]);

  const skinPurchases = await dbAll(`
    SELECT COUNT(*) as count, SUM(price_usd) as total_usd
    FROM skin_transactions
    WHERE buyer_id = ? AND status = 'completed'
  `, [userId]);

  const tradesAsLister = await dbAll(`
    SELECT want_token_type, COUNT(*) as count, SUM(want_amount) as gross_received, SUM(fee_amount) as total_fees_paid
    FROM token_trade_listings
    WHERE user_id = ? AND status = 'completed'
    GROUP BY want_token_type
  `, [userId]);

  const tradesAsAcceptor = await dbGet(`
    SELECT COUNT(*) as count
    FROM token_trade_listings
    WHERE buyer_id = ? AND status = 'completed'
  `, [userId]);

  const conversions = await dbAll(`
    SELECT token_type, status, COUNT(*) as count, SUM(amount) as total_tokens, SUM(btc_received) as total_received
    FROM token_conversions
    WHERE user_id = ?
    GROUP BY token_type, status
  `, [userId]);

  res.json({
    clips: {
      totalClips: clips.length,
      totalViews: clipTotals.totalViews,
      totalLikes: clipTotals.totalLikes,
      list: clips
    },
    skinSales: {
      byTokenType: skinSales,
      totalCompletedSales: skinSales.reduce((sum, s) => sum + s.count, 0),
      totalEarnedUsd: skinSales.reduce((sum, s) => sum + (s.total_usd || 0), 0)
    },
    skinPurchases: {
      totalCompletedPurchases: skinPurchases[0]?.count || 0,
      totalSpentUsd: skinPurchases[0]?.total_usd || 0
    },
    tokenTrades: {
      asLister: tradesAsLister,
      asAcceptorCount: tradesAsAcceptor?.count || 0,
      totalFeesPaid: tradesAsLister.reduce((sum, t) => sum + (t.total_fees_paid || 0), 0)
    },
    conversions
  });
});

// API: Equip avatar
app.post('/api/profile/equip-avatar', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const { avatarId } = req.body;
  
  const avatar = AVATARS.find(a => a.id === avatarId);
  if (!avatar) return res.status(400).json({ error: 'Invalid avatar' });
  
  if (avatar.unlockCondition !== 'default') {
    const unlocked = await dbGet('SELECT 1 FROM user_avatar_unlocks WHERE user_id = ? AND avatar_id = ?', [userId, avatarId]);
    if (!unlocked) return res.status(403).json({ error: 'Avatar not unlocked' });
  }
  
  if (avatar.tier === 'dragon') {
    await dbRun('UPDATE user_profiles SET dragon_id = ? WHERE user_id = ?', [avatarId, userId]);
  } else {
    await dbRun('UPDATE user_profiles SET avatar_id = ? WHERE user_id = ?', [avatarId, userId]);
  }
  
  res.json({ message: 'Avatar equipped', avatarId });
});

// API: Equip banner
app.post('/api/profile/equip-banner', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const { bannerId } = req.body;
  
  const banner = BANNERS.find(b => b.id === bannerId);
  if (!banner) return res.status(400).json({ error: 'Invalid banner' });
  
  if (banner.unlockCondition !== 'default') {
    const unlocked = await dbGet('SELECT 1 FROM user_banner_unlocks WHERE user_id = ? AND banner_id = ?', [userId, bannerId]);
    if (!unlocked) return res.status(403).json({ error: 'Banner not unlocked' });
  }
  
  await dbRun('UPDATE user_profiles SET banner_id = ? WHERE user_id = ?', [bannerId, userId]);
  res.json({ message: 'Banner equipped', bannerId });
});

// API: Purchase avatar with site points
app.post('/api/avatars/purchase', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const { avatarId } = req.body;
  
  const avatar = AVATARS.find(a => a.id === avatarId);
  if (!avatar) return res.status(400).json({ error: 'Invalid avatar' });
  if (avatar.category !== 'buyable') return res.status(400).json({ error: 'This avatar cannot be purchased' });
  
  const stats = await getUserStats(userId);
  if (stats.sitePoints < avatar.cost) return res.status(400).json({ error: 'Insufficient site points' });
  
  const existing = await dbGet('SELECT 1 FROM user_avatar_unlocks WHERE user_id = ? AND avatar_id = ?', [userId, avatarId]);
  if (existing) return res.status(400).json({ error: 'Already unlocked' });
  
  await dbRun('UPDATE user_points SET points = points - ?, total_spent = total_spent + ? WHERE user_id = ?', [avatar.cost, avatar.cost, userId]);
  await dbRun('INSERT INTO user_avatar_unlocks (user_id, avatar_id, unlock_method) VALUES (?, ?, ?)', [userId, avatarId, 'purchase']);
  
  await logSystemEvent('info', `User ${userId} purchased avatar ${avatarId}`, `Cost: ${avatar.cost} points`);
  
  res.json({ message: 'Avatar purchased successfully!', avatarId, cost: avatar.cost });
});

// API: Purchase banner with site points
app.post('/api/banners/purchase', authenticateRequest, async (req, res) => {
  const userId = req.userId;
  const { bannerId } = req.body;
  
  const banner = BANNERS.find(b => b.id === bannerId);
  if (!banner) return res.status(400).json({ error: 'Invalid banner' });
  if (banner.category !== 'buyable') return res.status(400).json({ error: 'This banner cannot be purchased' });
  
  const stats = await getUserStats(userId);
  if (stats.sitePoints < banner.cost) return res.status(400).json({ error: 'Insufficient site points' });
  
  const existing = await dbGet('SELECT 1 FROM user_banner_unlocks WHERE user_id = ? AND banner_id = ?', [userId, bannerId]);
  if (existing) return res.status(400).json({ error: 'Already unlocked' });
  
  await dbRun('UPDATE user_points SET points = points - ?, total_spent = total_spent + ? WHERE user_id = ?', [banner.cost, banner.cost, userId]);
  await dbRun('INSERT INTO user_banner_unlocks (user_id, banner_id, unlock_method) VALUES (?, ?, ?)', [userId, bannerId, 'purchase']);
  
  await logSystemEvent('info', `User ${userId} purchased banner ${bannerId}`, `Cost: ${banner.cost} points`);
  
  res.json({ message: 'Banner purchased successfully!', bannerId, cost: banner.cost });
});

// API: Get user's avatar info for public display (chat, clips, leaderboard)
app.get('/api/user/:userId/avatar-info', async (req, res) => {
  const profile = await getOrCreateUserProfile(parseInt(req.params.userId));
  const avatar = AVATARS.find(a => a.id === profile.avatar_id) || AVATARS[0];
  const banner = BANNERS.find(b => b.id === profile.banner_id) || BANNERS[0];
  const dragon = profile.dragon_id ? AVATARS.find(a => a.id === profile.dragon_id) : null;
  
  res.json({
    username: profile.username,
    avatarId: profile.avatar_id,
    avatarSvg: avatar.svg,
    avatarName: avatar.name,
    avatarTier: avatar.tier,
    avatarRarity: avatar.rarity,
    bannerId: profile.banner_id,
    bannerSvg: banner.svg,
    bannerName: banner.name,
    dragon: dragon ? { id: dragon.id, name: dragon.name, svg: dragon.svg } : null,
    weeklyStreak: profile.weekly_streak,
    pixelationLevel: profile.pixelation_level,
    blurAmount: getBlurFromLevel(profile.pixelation_level)
  });
});

// API: Update streak (called internally when clip contest resolves)
async function updateWeeklyStreak(userId, contestRank) {
  const profile = getOrCreateUserProfile(userId);
  const thisWeek = new Date().toISOString().split('T')[0];
  const weekStart = new Date(Date.now() - ((new Date().getDay()) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  // Only update once per week
  if (profile.last_streak_week === weekStart) {
    return { streak: profile.weekly_streak, updated: false };
  }
  
  const oldStreak = profile.weekly_streak || 0;
  let newStreak;
  let eventType;
  
  if (contestRank && contestRank <= 3) {
    // Top 3 in clip contest — streak continues
    newStreak = oldStreak + 1;
    eventType = 'clip_win';
    
    // Increment clip_wins if rank 1
    if (contestRank === 1) {
      await dbRun('UPDATE user_profiles SET clip_wins = clip_wins + 1 WHERE user_id = ?', [userId]);
    }
  } else {
    newStreak = 0;
    eventType = 'streak_reset';
  }
  
  const maxStreak = Math.max(profile.max_streak || 0, newStreak);
  const newPixelLevel = getPixelationLevel(newStreak);
  
  await dbRun('UPDATE user_profiles SET weekly_streak = ?, max_streak = ?, last_streak_week = ?, pixelation_level = ? WHERE user_id = ?', [newStreak, maxStreak, weekStart, newPixelLevel, userId]);
  
  await dbRun('INSERT INTO streak_history (user_id, week_start, clip_contest_rank, streak_before, streak_after, event_type) VALUES (?, ?, ?, ?, ?, ?)', [userId, weekStart, contestRank || null, oldStreak, newStreak, eventType]);
  
  const unlocks = checkStreakUnlocks(userId);
  
  if (newStreak === 10 || newStreak === 25 || newStreak === 50) {
    const user = await dbGet('SELECT username FROM users WHERE id = ?', [userId]);
    postToChannel(`🔥 STREAK MILESTONE!\n\n👤 ${user?.username || 'Anonymous'}\n⚡ ${newStreak}-week streak achieved!\n${newStreak === 50 ? '👑 LEGENDARY STATUS UNLOCKED!' : newStreak === 25 ? '👑 ROYAL STATUS UNLOCKED!' : '🏆 STREAK BADGE EARNED!'}\n${unlocks.length > 0 ? '🎁 New unlocks: ' + unlocks.map(u => u.name).join(', ') : ''}`).catch(() => {});
  }
  
  return { streak: newStreak, updated: true, unlocks, oldStreak };
}

// API: Get streak history
app.get('/api/profile/streak-history', authenticateRequest, async (req, res) => {
  const history = await dbAll('SELECT * FROM streak_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 52', [req.userId]);
  res.json(history);
});

// API: Award Royal Coins (admin API)
app.post('/api/admin/award-points', checkAdminSession, (req, res) => {
  const { userId, points, reason } = req.body;
  if (!userId || !points) return res.status(400).json({ error: 'userId and points required' });
  
  awardRoyalCoins(userId, points, reason || 'Admin award');
  
  res.json({ message: 'Royal Coins awarded', userId, points });
});

// ADMIN DASHBOARD API ENDPOINTS

// API: Get analytics overview
app.get('/api/admin/analytics/overview', checkAdminSession, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const todayStats = await dbGet('SELECT * FROM site_analytics WHERE date = ?', [today]) || {};
  const weekStats = await dbGet('SELECT SUM(unique_visitors) as visitors, SUM(page_views) as views, SUM(total_bets) as bets, SUM(total_volume) as volume, SUM(total_revenue) as revenue FROM site_analytics WHERE date >= ?', [weekAgo]);
  const totalUsers = (await dbGet('SELECT COUNT(*) as count FROM users')).count;
  const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
  
  res.json({
    today: todayStats,
    week: weekStats,
    totalUsers,
    activeMarkets
  });
});

// API: Get analytics chart data
app.get('/api/admin/analytics/chart', checkAdminSession, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const chartData = await dbAll('SELECT * FROM site_analytics WHERE date >= ? ORDER BY date ASC', [startDate]);
  res.json(chartData);
});

// API: Get IT tickets
app.get('/api/admin/tickets', checkAdminSession, async (req, res) => {
  const status = req.query.status;
  let query = 'SELECT * FROM it_tickets';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const tickets = await dbAll(query, params);
  res.json(tickets);
});

// API: Create IT ticket
app.post('/api/admin/tickets', checkAdminSession, async (req, res) => {
  const { title, description, priority, category, createdBy } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description required' });
  }
  
  const ticketId = await createITTicket(title, description, priority || 'medium', category || 'general', createdBy || 'admin');
  res.json({ ticketId, message: 'Ticket created successfully' });
});

// API: Update IT ticket
app.put('/api/admin/tickets/:id', checkAdminSession, async (req, res) => {
  const { status, assignedTo } = req.body;
  
  await updateITTicketStatus(req.params.id, status, assignedTo);
  res.json({ message: 'Ticket updated successfully' });
});

// API: Get system logs
app.get('/api/admin/logs', checkAdminSession, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = await dbAll('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json(logs);
});

// API: Get revenue breakdown
app.get('/api/admin/revenue', checkAdminSession, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const revenueData = await dbAll('SELECT date, total_revenue FROM site_analytics WHERE date >= ? ORDER BY date ASC', [startDate]);
  const totalRevenue = (await dbGet('SELECT SUM(total_revenue) as total FROM site_analytics WHERE date >= ?', [startDate])).total || 0;
  
  res.json({
    daily: revenueData,
    total: totalRevenue
  });
});

// ADMIN AUTHENTICATION

// API: Admin login
app.post('/api/admin/login', rateLimit({ windowMs: 60 * 1000, max: 8, key: req => `admin-login:${req.ip || 'unknown'}` }), async (req, res) => {
  const { email, password } = req.body;

  if (!validateEmail(email) || !validateText(password, { maxLength: 128, required: true })) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await dbGet('SELECT * FROM admin_users WHERE email = ?', [String(email).trim().toLowerCase()]);
  if (!admin || !admin.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!(await verifyPassword(String(password), admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (admin.is_one_time_password === 1) {
    await dbRun('UPDATE admin_users SET is_one_time_password = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  } else {
    await dbRun('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  }

  const sessionToken = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await dbRun('INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, ?)', [admin.id, sessionToken, expiresAt]);

  res.json({
    message: 'Login successful',
    sessionToken,
    requiresPasswordChange: admin.is_one_time_password === 1
  });
});

// API: Admin change password
app.post('/api/admin/change-password', rateLimit({ windowMs: 60 * 1000, max: 5, key: req => `admin-change:${req.ip || 'unknown'}` }), async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!validateEmail(email) || !validateText(currentPassword, { maxLength: 128, required: true }) || !validateText(newPassword, { maxLength: 128, required: true })) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const admin = await dbGet('SELECT * FROM admin_users WHERE email = ?', [String(email).trim().toLowerCase()]);
  if (!admin || !admin.password_hash) {
    return res.status(401).json({ error: 'Invalid current password' });
  }

  if (!(await verifyPassword(String(currentPassword), admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid current password' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const newPasswordHash = await hashPassword(String(newPassword));
  await dbRun('UPDATE admin_users SET password_hash = ? WHERE id = ?', [newPasswordHash, admin.id]);

  logSystemEvent('info', `Admin password changed`, `Admin ID: ${admin.id}`);

  res.json({ message: 'Password changed successfully' });
});

// Middleware to check admin session
async function checkAdminSession(req, res, next) {
  const sessionToken = req.headers['x-admin-session'];

  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adminSession = await dbGet('SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > datetime("now")', [sessionToken]);
  if (!adminSession) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminId = adminSession.admin_id;
  next();
}

// Only real payout rails we can actually fulfil (manually, by admin) - no fiat/bank payout exists
const CONVERTIBLE_CURRENCIES = ['BTC', 'ETH', 'USDT'];

// API: Convert game tokens to crypto (queues a payout for manual admin processing - see /api/admin/token-conversions)
app.post('/api/convert', authenticateRequest, async (req, res) => {
  const { tokenType, amount, targetCurrency, walletAddress } = req.body;
  
  if (!tokenType || !['steam', 'standoff2'].includes(tokenType)) {
    return res.status(400).json({ error: 'Invalid token type. Must be steam or standoff2' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  if (!targetCurrency || !CONVERTIBLE_CURRENCIES.includes(targetCurrency)) {
    return res.status(400).json({ error: `Invalid target currency. Supported: ${CONVERTIBLE_CURRENCIES.join(', ')}` });
  }
  
  if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim().length < 10) {
    return res.status(400).json({ error: 'Valid wallet address required' });
  }
  
  // Get token rate
  const tokenRate = getTokenRate(tokenType);
  if (!tokenRate) {
    return res.status(500).json({ error: 'Token rate not available' });
  }
  
  // Get target currency rate
  const currencyRate = getExchangeRate(targetCurrency);
  if (!currencyRate) {
    return res.status(500).json({ error: 'Currency rate not available' });
  }
  
  const tokenColumn = getTokenColumn(tokenType);
  if (!tokenColumn) return res.status(400).json({ error: 'Invalid token type' });
  const user = await dbGet(`SELECT ${tokenColumn} FROM users WHERE id = ?`, [req.userId]);
  if (!user || user[tokenColumn] < amount) {
    return res.status(400).json({ error: `Insufficient ${tokenType} tokens` });
  }
  
  // Calculate conversion
  const usdValue = amount * tokenRate.rate_to_usd;
  const grossAmount = usdValue / currencyRate.rate_to_usd;
  const fee = grossAmount * CONVERSION_FEE;
  const netAmount = grossAmount - fee;
  
  // Track the fee in BTC equivalent for platform revenue pool
  const feeInBTC = await trackFeeFromConversion(fee, targetCurrency);
  trackConversion();
  
  // Deduct tokens now and queue a payout - actual crypto is sent manually by an admin
  // (see /api/admin/token-conversions and /api/admin/confirm-conversion-payout), matching
  // the same manual PAYOUT_FREQUENCY/PAYOUT_MINIMUM_BTC process already used for bet winnings.
  await dbRun(`UPDATE users SET ${tokenColumn} = ${tokenColumn} - ? WHERE id = ?`, [amount, req.userId]);
  
  const result = await dbRun(`
    INSERT INTO token_conversions (user_id, token_type, amount, btc_received, status, wallet_address, target_currency)
    VALUES (?, ?, ?, ?, 'pending_payout', ?, ?)
  `, [req.userId, tokenType, amount, netAmount, walletAddress.trim(), targetCurrency]);
  
  await logSystemEvent('info', `Token conversion queued for user ${req.userId}`, `Converting ${amount} ${tokenType} tokens to ${netAmount.toFixed(8)} ${targetCurrency} at ${walletAddress.trim()}. Fee: ${fee.toFixed(8)} ${targetCurrency} (${feeInBTC.toFixed(8)} BTC)`);
  
  res.json({ 
    id: result.lastID, 
    amountReceived: netAmount,
    currency: targetCurrency,
    symbol: SUPPORTED_CURRENCIES[targetCurrency].symbol,
    fee: fee,
    feeInBTC: feeInBTC,
    feePercentage: CONVERSION_FEE * 100,
    status: 'pending_payout',
    message: `Conversion queued. Your tokens have been deducted and ${SUPPORTED_CURRENCIES[targetCurrency].symbol}${netAmount.toFixed(8)} ${targetCurrency} will be sent to your wallet within the ${process.env.PAYOUT_FREQUENCY || 'weekly'} payout cycle.`
  });
});

// ============================================================
// TOKEN TRADE MARKETPLACE (Multi-game token trading)
// ============================================================
// A user lists "offer_amount of offer_token_type for want_amount of want_token_type".
// Another user accepts and the swap executes immediately. The LISTER pays a service
// fee (taken out of what they receive), tiered by the listed amount:
//   - listed amount > 2500 units: 2% fee
//   - listed amount <= 2500 units: 3% fee
// Fee is collected in tokens (not cash) and tracked in platform_token_revenue.

function getTradeFeePercent(offerAmount) {
  return offerAmount > 2500 ? 0.02 : 0.03;
}

async function creditPlatformTokenRevenue(tokenType, amount) {
  const existing = await dbGet('SELECT * FROM platform_token_revenue WHERE token_type = ?', [tokenType]);
  if (existing) {
    await dbRun('UPDATE platform_token_revenue SET accumulated_amount = accumulated_amount + ?, total_collected = total_collected + ? WHERE token_type = ?', [amount, amount, tokenType]);
  } else {
    await dbRun('INSERT INTO platform_token_revenue (token_type, accumulated_amount, total_collected) VALUES (?, ?, ?)', [tokenType, amount, amount]);
  }
}

// API: Create a token trade listing (escrows the offered tokens immediately)
app.post('/api/trades/list', authenticateRequest, async (req, res) => {
  const { offerTokenType, offerAmount, wantTokenType, wantAmount } = req.body;

  if (!TOKEN_TYPES[offerTokenType] || !TOKEN_TYPES[wantTokenType]) {
    return res.status(400).json({ error: 'Invalid token type. Supported: ' + Object.keys(TOKEN_TYPES).join(', ') });
  }
  if (offerTokenType === wantTokenType) {
    return res.status(400).json({ error: 'Offer and want token types must be different' });
  }
  if (!offerAmount || offerAmount <= 0 || !wantAmount || wantAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const offerColumn = getTokenColumn(offerTokenType);
  if (!offerColumn) return res.status(400).json({ error: 'Invalid token type' });
  const user = await dbGet(`SELECT ${offerColumn} FROM users WHERE id = ?`, [req.userId]);
  if (!user || user[offerColumn] < offerAmount) {
    return res.status(400).json({ error: `Insufficient ${offerTokenType} tokens` });
  }

  // Escrow the offered tokens now so the lister can't spend them elsewhere
  await dbRun(`UPDATE users SET ${offerColumn} = ${offerColumn} - ? WHERE id = ?`, [offerAmount, req.userId]);

  const result = await dbRun(`
    INSERT INTO token_trade_listings (user_id, offer_token_type, offer_amount, want_token_type, want_amount, fee_percent)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [req.userId, offerTokenType, offerAmount, wantTokenType, wantAmount, getTradeFeePercent(offerAmount)]);

  logSystemEvent('info', `Trade listing created by user ${req.userId}`, `Offering ${offerAmount} ${offerTokenType} for ${wantAmount} ${wantTokenType}`);

  // Broadcast to Discord
  const tradeUser = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  broadcastToDiscord(
    '🔄 New Token Trade Listing',
    `**${tradeUser?.username || 'A user'}** is offering **${offerAmount} ${getTokenLabel(offerTokenType)}** for **${wantAmount} ${getTokenLabel(wantTokenType)}**`,
    0xff9800
  ).catch(() => {});

  res.json({ id: result.lastID, message: 'Listing created. Your tokens are held in escrow until this trade completes or is cancelled.' });
});

// API: Browse open trade listings
app.get('/api/trades/listings', async (req, res) => {
  const listings = await dbAll(`
    SELECT ttl.*, u.username
    FROM token_trade_listings ttl
    JOIN users u ON ttl.user_id = u.id
    WHERE ttl.status = 'open'
    ORDER BY ttl.created_at DESC
  `);
  res.json(listings);
});

// API: Get my own trade listings
app.get('/api/trades/my-listings', authenticateRequest, async (req, res) => {
  const listings = await dbAll('SELECT * FROM token_trade_listings WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json(listings);
});

// API: Cancel an open listing (refunds escrowed tokens)
app.post('/api/trades/:id/cancel', authenticateRequest, async (req, res) => {
  const listing = await dbGet('SELECT * FROM token_trade_listings WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'open') return res.status(400).json({ error: `Cannot cancel listing in ${listing.status} state` });

  const offerColumn = listing.offer_token_type === 'steam' ? 'steam_tokens' : 'standoff2_tokens';
  await dbRun(`UPDATE users SET ${offerColumn} = ${offerColumn} + ? WHERE id = ?`, [listing.offer_amount, req.userId]);
  await dbRun('UPDATE token_trade_listings SET status = ?, cancelled_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', listing.id]);

  res.json({ message: 'Listing cancelled. Your escrowed tokens have been returned.' });
});

// API: Accept an open trade listing
app.post('/api/trades/:id/accept', authenticateRequest, async (req, res) => {
  const listing = await dbGet('SELECT * FROM token_trade_listings WHERE id = ?', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'open') return res.status(400).json({ error: `Listing is no longer open (${listing.status})` });
  if (listing.user_id === req.userId) return res.status(400).json({ error: 'Cannot accept your own listing' });

  const wantColumn = getTokenColumn(listing.want_token_type);
  const offerColumn = getTokenColumn(listing.offer_token_type);

  const acceptor = await dbGet(`SELECT ${wantColumn} FROM users WHERE id = ?`, [req.userId]);
  if (!acceptor || acceptor[wantColumn] < listing.want_amount) {
    return res.status(400).json({ error: `Insufficient ${listing.want_token_type} tokens` });
  }

  const feePercent = listing.fee_percent || getTradeFeePercent(listing.offer_amount);
  const feeAmount = listing.want_amount * feePercent;
  const listerReceives = listing.want_amount - feeAmount;

  // Acceptor pays want_amount, receives the full escrowed offer_amount
  await dbRun(`UPDATE users SET ${wantColumn} = ${wantColumn} - ? WHERE id = ?`, [listing.want_amount, req.userId]);
  await dbRun(`UPDATE users SET ${offerColumn} = ${offerColumn} + ? WHERE id = ?`, [listing.offer_amount, req.userId]);

  // Lister receives want_amount minus the service fee
  await dbRun(`UPDATE users SET ${wantColumn} = ${wantColumn} + ? WHERE id = ?`, [listerReceives, listing.user_id]);

  await creditPlatformTokenRevenue(listing.want_token_type, feeAmount);

  await dbRun(`
    UPDATE token_trade_listings
    SET status = 'completed', buyer_id = ?, fee_amount = ?, fee_percent = ?, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [req.userId, feeAmount, feePercent, listing.id]);

  logSystemEvent('info', `Trade completed`, `Listing ${listing.id}: ${listing.offer_amount} ${listing.offer_token_type} <-> ${listing.want_amount} ${listing.want_token_type}, fee ${feeAmount.toFixed(4)} ${listing.want_token_type} (${(feePercent * 100).toFixed(0)}%)`);

  res.json({
    message: 'Trade completed successfully',
    youReceived: listing.offer_amount,
    youReceivedType: listing.offer_token_type,
    youPaid: listing.want_amount,
    youPaidType: listing.want_token_type
  });
});

// API: Get platform token revenue (admin)
app.get('/api/admin/token-revenue', checkAdminSession, async (req, res) => {
  const revenue = await dbAll('SELECT * FROM platform_token_revenue');
  res.json(revenue);
});

// BETTING API ENDPOINTS

// API: Get all betting markets
app.get('/api/betting/markets', async (req, res) => {
  const markets = await dbAll(`SELECT bm.*, COUNT(ub.id) AS total_bets
    FROM betting_markets bm LEFT JOIN user_bets ub ON ub.market_id = bm.id
    WHERE bm.status = ? AND bm.parent_market_id IS NULL
    GROUP BY bm.id ORDER BY bm.end_date ASC`, ['active']);
  res.json(markets);
});

// API: Get sub-bets for a market
app.get('/api/betting/markets/:id/sub-bets', async (req, res) => {
  const subBets = await dbAll('SELECT * FROM betting_markets WHERE parent_market_id = ? AND status = ? ORDER BY layer_depth ASC', [req.params.id, 'active']);
  res.json(subBets);
});

// API: Get single market details
app.get('/api/betting/markets/:id', async (req, res) => {
  const market = await dbGet('SELECT * FROM betting_markets WHERE id = ?', [req.params.id]);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const bets = await dbAll('SELECT option, SUM(amount) as volume FROM user_bets WHERE market_id = ? GROUP BY option', [req.params.id]);
  
  market.options = JSON.parse(market.options);
  market.betting_volume = bets;
  
  res.json(market);
});

// API: Create new betting market (admin only)
app.post('/api/betting/markets', async (req, res) => {
  const { title, description, category, options, end_date, fee_rate } = req.body;
  
  const result = await dbRun(`
    INSERT INTO betting_markets (title, description, category, options, end_date, fee_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [title, description, category, JSON.stringify(options), end_date, fee_rate || 0.02]);
  
  res.json({ id: result.lastID, message: 'Market created successfully' });
});

// API: Place a bet
app.post('/api/betting/bet', async (req, res) => {
  const { userId, marketId, option, amount } = req.body;
  
  const market = await dbGet('SELECT * FROM betting_markets WHERE id = ?', [marketId]);
  if (!market || market.status !== 'active') {
    return res.status(400).json({ error: 'Market not available' });
  }

  const balance = await dbGet('SELECT btc_balance FROM user_balances WHERE user_id = ?', [userId]);
  if (!balance || balance.btc_balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  await dbRun('UPDATE user_balances SET btc_balance = btc_balance - ? WHERE user_id = ?', [amount, userId]);

  const potentialPayout = amount * (1 - market.fee_rate);
  await dbRun(`
    INSERT INTO user_bets (user_id, market_id, option, amount, potential_payout)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, marketId, option, amount, potentialPayout]);

  await dbRun('UPDATE betting_markets SET total_volume = total_volume + ? WHERE id = ?', [amount, marketId]);

  await trackBet(amount);
  await trackRevenue(amount * market.fee_rate);

  await logSystemEvent('info', `Bet placed by user ${userId}`, `Market: ${marketId}, Amount: ${amount} BTC`);

  res.json({ message: 'Bet placed successfully', potentialPayout });
});

// API: Get user bets
app.get('/api/betting/user/:userId/bets', async (req, res) => {
  const bets = await dbAll(`
    SELECT ub.*, bm.title as market_title, bm.status as market_status
    FROM user_bets ub
    JOIN betting_markets bm ON ub.market_id = bm.id
    WHERE ub.user_id = ?
    ORDER BY ub.created_at DESC
  `, [req.params.userId]);
  
  res.json(bets);
});

// API: Get user balance
app.get('/api/betting/user/:userId/balance', async (req, res) => {
  let balance = await dbGet('SELECT * FROM user_balances WHERE user_id = ?', [req.params.userId]);
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

// API: Demo-only betting deposit (real crypto deposits disabled)
app.post('/api/betting/deposit', async (req, res) => {
  const { userId, amount } = req.body;
  
  if (!userId || !Number.isFinite(amount) || amount <= 0 || amount > 0.1) {
    return res.status(400).json({ error: 'Invalid user or amount (max 0.1 demo BTC per deposit)' });
  }
  
  const DEMO_BALANCE_CAP = 1.0;
  const userBalance = await dbGet('SELECT btc_balance, total_deposited FROM user_balances WHERE user_id = ?', [userId]);
  if (userBalance && userBalance.btc_balance >= DEMO_BALANCE_CAP) {
    return res.status(400).json({ error: 'Demo betting balance cap reached' });
  }
  
  await dbRun(`
    INSERT INTO user_balances (user_id, btc_balance, total_deposited)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      btc_balance = btc_balance + ?,
      total_deposited = total_deposited + ?
  `, [userId, amount, amount, amount, amount]);
  
  const result = await dbRun(`
    INSERT INTO transactions (user_id, type, amount, btc_address, tx_hash, status)
    VALUES (?, 'demo_deposit', ?, ?, 'DEMO', 'completed')
  `, [userId, amount, process.env.BTC_WALLET_ADDRESS]);
  
  res.json({
    transactionId: result.lastID,
    message: 'Demo deposit credited (real crypto deposits are disabled)',
    amount,
    demo: true
  });
});

// API: Get all quizzes
app.get('/api/quizzes', async (req, res) => {
  const quizzes = await dbAll('SELECT * FROM quizzes ORDER BY created_at DESC');
  res.json(quizzes);
});

// API: Get quiz by ID
app.get('/api/quizzes/:id', async (req, res) => {
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  res.json(quiz);
});

// API: Submit quiz attempt
app.post('/api/quizzes/:id/submit', async (req, res) => {
  const { userId, answers } = req.body;
  const quizId = req.params.id;
  
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id = ?', [quizId]);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  
  const questions = JSON.parse(quiz.questions);
  let correctCount = 0;
  
  questions.forEach((q, index) => {
    if (answers[index] === q.correctAnswer) {
      correctCount++;
    }
  });
  
  const score = Math.round((correctCount / questions.length) * 100);
  const pointsEarned = Math.round((score / 100) * quiz.reward_points);
  
  await dbRun(`
    INSERT INTO user_quiz_attempts (user_id, quiz_id, score, points_earned)
    VALUES (?, ?, ?, ?)
  `, [userId, quizId, score, pointsEarned]);
  
  let userPoints = await dbGet('SELECT * FROM user_points WHERE user_id = ?', [userId]);
  if (!userPoints) {
    await dbRun(`
      INSERT INTO user_points (user_id, points, total_earned)
      VALUES (?, ?, ?)
    `, [userId, pointsEarned, pointsEarned]);
  } else {
    await dbRun(`
      UPDATE user_points
      SET points = points + ?, total_earned = total_earned + ?
      WHERE user_id = ?
    `, [pointsEarned, pointsEarned, userId]);
  }
  
  res.json({
    score,
    pointsEarned,
    correctCount,
    totalQuestions: questions.length,
    message: score >= 70 ? 'Great job! Points earned.' : 'Keep practicing!'
  });
});

// API: Get user points
app.get('/api/points/:userId', async (req, res) => {
  let points = await dbGet('SELECT * FROM user_points WHERE user_id = ?', [req.params.userId]);
  if (!points) {
    points = {
      points: 0,
      total_earned: 0,
      total_spent: 0
    };
  }
  res.json(points);
});

// API: Purchase points with BTC
app.post('/api/points/purchase', async (req, res) => {
  const { userId, pointsAmount } = req.body;
  
  // Calculate BTC cost (1000 points = 0.0001 BTC)
  const btcCost = (pointsAmount / 1000) * 0.0001;
  
  try {
    // Create payment with OwnPayment
    const OwnPayModule = await import('ownpay-nodejs');
    const ownpay = new OwnPayModule.default({
      apiKey: process.env.OWNPAY_API_KEY,
      baseUrl: process.env.OWNPAY_BASE_URL
    });
    
    const payment = await ownpay.payments.create({
      amount: btcCost,
      currency: 'BTC',
      redirect_url: `${process.env.SITE_URL}/points/success`,
      cancel_url: `${process.env.SITE_URL}/points/cancel`,
      callback_url: `${process.env.SITE_URL}/webhook/ownpayment`,
      reference: `POINTS-${userId}-${Date.now()}`,
      metadata: {
        userId: userId.toString(),
        pointsAmount: pointsAmount.toString()
      }
    });
    
    await dbRun(`
      INSERT INTO transactions (user_id, type, amount, btc_address, tx_hash, status)
      VALUES (?, 'points_purchase', ?, ?, ?, 'pending')
    `, [userId, pointsAmount, process.env.BTC_WALLET_ADDRESS, payment.paymentId]);
    
    res.json({
      checkoutUrl: payment.checkoutUrl,
      paymentId: payment.paymentId,
      btcCost,
      pointsAmount
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// API: Get user profile
app.get('/api/profile/:userId', async (req, res) => {
  const profile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [req.params.userId]);
  if (!profile) {
    return res.json({ username: null, bio: null, cover_image: null, profile_image: null, badges: [] });
  }
  profile.badges = profile.badges ? JSON.parse(profile.badges) : [];
  res.json(profile);
});

// API: Update user profile
app.put('/api/profile/:userId', authenticateRequest, async (req, res) => {
  const { username, bio, cover_image, profile_image } = req.body;
  const userId = parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId) || userId !== req.userId) {
    return res.status(403).json({ error: 'You can only update your own profile.' });
  }

  if (!validateText(username, { maxLength: 50, required: true })) {
    return res.status(400).json({ error: 'Username must be 1-50 characters.' });
  }

  const safeBio = validateText(bio, { maxLength: 500 }) ? String(bio || '').trim() : null;
  let existing = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

  if (existing) {
    await dbRun(`
      UPDATE user_profiles
      SET username = ?, bio = ?, cover_image = ?, profile_image = ?
      WHERE user_id = ?
    `, [username.trim(), safeBio, cover_image, profile_image, userId]);
  } else {
    await dbRun(`
      INSERT INTO user_profiles (user_id, username, bio, cover_image, profile_image)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, username.trim(), safeBio, cover_image, profile_image]);
  }

  res.json({ message: 'Profile updated successfully' });
});

// ============================================================
// STEAM INTEGRATION & ESCROW TRADE SYSTEM
// ============================================================

// Steam OpenID configuration
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

// API: Steam OpenID login redirect
app.get('/api/steam/auth', authenticateRequest, (req, res) => {
  const returnUrl = `${req.protocol}://${req.get('host')}/api/steam/auth/callback?token=${req.headers.authorization?.replace('Bearer ', '')}`;
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': `${req.protocol}://${req.get('host')}`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  res.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
});

// API: Steam OpenID callback
app.get('/api/steam/auth/callback', async (req, res) => {
  const { token, 'openid.claimed_id': claimedId } = req.query;
  
  if (!token || !claimedId) {
    return res.status(400).send('<script>window.close();</script>Invalid response');
  }
  
  // Extract Steam ID from claimed_id
  const steamIdMatch = claimedId.match(/\/openid\/id\/(\d+)$/);
  if (!steamIdMatch) {
    return res.status(400).send('Invalid Steam ID');
  }
  const steamId = steamIdMatch[1];
  
  const session = await dbGet('SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime("now")', [token]);
  if (!session) {
    return res.status(401).send('Invalid session');
  }
  
  let steamUsername = 'Steam User';
  let avatarUrl = '';
  if (STEAM_API_KEY) {
    try {
      const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`);
      const data = await response.json();
      if (data.response?.players?.[0]) {
        steamUsername = data.response.players[0].personaname;
        avatarUrl = data.response.players[0].avatarfull;
      }
    } catch (e) {
      console.error('Steam API error:', e.message);
    }
  }
  
  const verified = STEAM_API_KEY ? 1 : 0;
  await dbRun(`
    INSERT INTO steam_accounts (user_id, steam_id, steam_username, avatar_url, inventory_verified)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET steam_id = ?, steam_username = ?, avatar_url = ?, inventory_verified = ?
  `, [session.user_id, steamId, steamUsername, avatarUrl, verified,
       steamId, steamUsername, avatarUrl, verified]);
  
  logSystemEvent('info', `User ${session.user_id} linked Steam account`, `Steam ID: ${steamId}, Username: ${steamUsername}`);
  
  res.send('<script>window.close();</script>Steam account linked successfully! You can close this window.');
});

// API: Update Steam trade URL
app.post('/api/steam/trade-url', authenticateRequest, async (req, res) => {
  const { tradeUrl } = req.body;
  if (!tradeUrl || !tradeUrl.includes('steamcommunity.com/tradeoffer/new/')) {
    return res.status(400).json({ error: 'Invalid Steam trade URL' });
  }
  
  const existing = await dbGet('SELECT * FROM steam_accounts WHERE user_id = ?', [req.userId]);
  if (!existing) {
    return res.status(400).json({ error: 'Steam account not linked. Please link your Steam account first.' });
  }
  
  await dbRun('UPDATE steam_accounts SET trade_url = ? WHERE user_id = ?', [tradeUrl, req.userId]);
  res.json({ message: 'Trade URL saved successfully' });
});

// API: Get Steam account info
app.get('/api/steam/account', authenticateRequest, async (req, res) => {
  const steam = await dbGet('SELECT * FROM steam_accounts WHERE user_id = ?', [req.userId]);
  if (!steam) return res.json({ linked: false });
  res.json({ linked: true, ...steam });
});

// API: Verify Steam inventory (checks if user owns CS2 items)
app.get('/api/steam/inventory/:steamId', async (req, res) => {
  if (!STEAM_API_KEY) {
    return res.status(503).json({ error: 'Steam API key not configured' });
  }
  
  try {
    const response = await fetch(`https://steamcommunity.com/inventory/${req.params.steamId}/730/2?l=english&count=5000`);
    if (!response.ok) {
      return res.status(404).json({ error: 'Inventory is private or not found' });
    }
    const data = await response.json();
    const itemCount = data?.total_inventory_count || 0;
    res.json({ itemCount, available: itemCount > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// ============================================================
// STANDOFF2 ACCOUNT LINKING
// ============================================================

// API: Link Standoff2 account
app.post('/api/standoff2/link', authenticateRequest, async (req, res) => {
  const { playerId, playerName } = req.body;
  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Player ID and name required' });
  }
  
  await dbRun(`
    INSERT INTO standoff2_accounts (user_id, player_id, player_name)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET player_id = ?, player_name = ?
  `, [req.userId, playerId.trim(), playerName.trim(), playerId.trim(), playerName.trim()]);
  await dbRun(`INSERT INTO user_trust (user_id, verified) VALUES (?, 1)
    ON CONFLICT(user_id) DO UPDATE SET verified = 1, updated_at = CURRENT_TIMESTAMP`, [req.userId]);
  
  logSystemEvent('info', `User ${req.userId} linked Standoff2 account`, `Player: ${playerName} (${playerId})`);
  res.json({ message: 'Standoff2 account linked successfully' });
});

// API: Get Standoff2 account info
app.get('/api/standoff2/account', authenticateRequest, async (req, res) => {
  const so2 = await dbGet('SELECT * FROM standoff2_accounts WHERE user_id = ?', [req.userId]);
  if (!so2) return res.json({ linked: false });
  res.json({ linked: true, ...so2 });
});

// ============================================================
// STANDOFF 2 GOLD TRANSFERS
// ============================================================

const GOLD_USD_RATE = 0.01; // 100 Gold ≈ $1 USD
const GOLD_TRANSFER_RULES = [
  { action: 'Create a transfer', reward: 'No XP', explanation: 'The recipient receives a verified listing request.' },
  { action: 'List the agreed item', reward: '5 XP', explanation: 'The recipient submits the official-marketplace listing ID.' },
  { action: 'Confirm a completed purchase', reward: '25 XP each', explanation: 'Both profiles earn XP after the sender confirms.' },
  { action: 'Move 1,000 Gold', reward: '1000 Gold Moved badge', explanation: 'Unlocked from completed-transfer volume.' }
];

function makePublicTransferId() {
  return `PPG-${Date.now().toString(36).toUpperCase()}-${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;
}

async function getGoldQuote(goldAmount, refresh = false) {
  if (refresh) await updateCryptoPrices().catch(() => {});
  const bitcoin = await dbGet('SELECT rate_to_usd, updated_at FROM exchange_rates WHERE currency = ?', ['BTC']);
  const btcUsd = Number(bitcoin?.rate_to_usd) || 65000;
  const usd = Number(goldAmount) * GOLD_USD_RATE;
  return {
    gold: Number(goldAmount),
    usd,
    btc: usd / btcUsd,
    btcUsd,
    rateUpdatedAt: bitcoin?.updated_at || null,
    source: 'CoinGecko (with cached fallback)'
  };
}

async function logGoldTransferEvent(transferId, actorId, eventType, message, payload = null) {
  await dbRun(
    'INSERT INTO gold_transfer_events (transfer_id, actor_id, event_type, message, payload) VALUES (?, ?, ?, ?, ?)',
    [transferId, actorId || null, eventType, message, payload ? JSON.stringify(payload) : null]
  );
}

async function awardActivity(userId, actionType, xpAwarded, transferId = null) {
  await dbRun(`INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, ?, ?, 0)
    ON CONFLICT(user_id) DO UPDATE SET points = points + excluded.points, total_earned = total_earned + excluded.total_earned`,
    [userId, xpAwarded, xpAwarded]);
  await dbRun('INSERT INTO activity_rewards (user_id, action_type, xp_awarded, transfer_id) VALUES (?, ?, ?, ?)',
    [userId, actionType, xpAwarded, transferId]);
}

async function awardTransferBadges(userId) {
  const volume = await dbGet(`SELECT COALESCE(SUM(gold_amount), 0) AS volume, COUNT(*) AS transfers
    FROM gold_transfers WHERE status = 'completed' AND (sender_id = ? OR recipient_id = ?)`, [userId, userId]);
  const earned = [];
  if (volume.transfers >= 1) {
    await dbRun('INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?, ?)', [userId, 'first_transfer']);
    earned.push('First Transfer');
  }
  if (Number(volume.volume) >= 1000) {
    await dbRun('INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?, ?)', [userId, 'gold_1000_moved']);
    earned.push('1000 Gold Moved');
  }
  return earned;
}

async function getTransferDetails(id) {
  return dbGet(`SELECT gt.*, sender.username AS sender_username, recipient.username AS recipient_username,
      senderTrust.verified AS sender_verified, senderTrust.reputation_score AS sender_reputation,
      recipientTrust.verified AS recipient_verified, recipientTrust.reputation_score AS recipient_reputation
    FROM gold_transfers gt
    JOIN users sender ON sender.id = gt.sender_id
    JOIN users recipient ON recipient.id = gt.recipient_id
    LEFT JOIN user_trust senderTrust ON senderTrust.user_id = gt.sender_id
    LEFT JOIN user_trust recipientTrust ON recipientTrust.user_id = gt.recipient_id
    WHERE gt.id = ?`, [id]);
}

function canAccessTransfer(transfer, userId) {
  return transfer && (transfer.sender_id === userId || transfer.recipient_id === userId);
}

function listingInstructions(transfer) {
  return [
    `Open the official Standoff 2 marketplace and select ${transfer.item_name}.`,
    `Choose pattern ${transfer.pattern_number || 'the agreed pattern'}${transfer.serial_number ? ` and serial ${transfer.serial_number}` : ''}.`,
    `Create a listing for exactly ${transfer.gold_amount} Gold, then paste its listing ID into PixelPulse.`,
    `The sender confirms the purchase in the official marketplace; PixelPulse records the confirmation and audit trail.`
  ];
}

app.get('/api/gold-transfers/rules', authenticateRequest, async (req, res) => {
  res.json({ rules: GOLD_TRANSFER_RULES, marketplaceFeePercent: 20, goldUsdRate: GOLD_USD_RATE });
});

app.get('/api/gold/conversion', authenticateRequest, async (req, res) => {
  const gold = Number(req.query.gold);
  if (!Number.isFinite(gold) || gold <= 0) return res.status(400).json({ error: 'gold must be a positive number' });
  res.json(await getGoldQuote(gold, true));
});

app.get('/api/profile/game', authenticateRequest, async (req, res) => {
  const [user, profile, account, trust, identifiers, inventory, history, badges, points] = await Promise.all([
    dbGet('SELECT id, username FROM users WHERE id = ?', [req.userId]),
    dbGet('SELECT username, profile_image, avatar_id FROM user_profiles WHERE user_id = ?', [req.userId]),
    dbGet('SELECT player_id, player_name, linked_at FROM standoff2_accounts WHERE user_id = ?', [req.userId]),
    dbGet('SELECT reputation_score, verified, completed_transfers, disputed_transfers FROM user_trust WHERE user_id = ?', [req.userId]),
    dbAll('SELECT identifier_type, identifier_value, label, verified, created_at FROM marketplace_identifiers WHERE user_id = ? ORDER BY created_at DESC', [req.userId]),
    dbAll('SELECT * FROM user_inventory_items WHERE user_id = ? ORDER BY created_at DESC', [req.userId]),
    dbAll(`SELECT public_id, item_name, gold_amount, recipient_net_gold, status, created_at FROM gold_transfers
      WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at DESC LIMIT 25`, [req.userId, req.userId]),
    dbAll('SELECT badge_key, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at DESC', [req.userId]),
    dbGet('SELECT points, total_earned FROM user_points WHERE user_id = ?', [req.userId])
  ]);
  res.json({ user: { ...user, ...profile }, standoff2: account || { linked: false }, trust: trust || { reputation_score: 50, verified: 0 }, identifiers, inventory, history, badges, xp: points || { points: 0, total_earned: 0 } });
});

app.post('/api/profile/marketplace-identifiers', authenticateRequest, async (req, res) => {
  const { identifierType, identifierValue, label } = req.body;
  if (!identifierType || !identifierValue || String(identifierValue).trim().length > 100) {
    return res.status(400).json({ error: 'An identifier type and value are required' });
  }
  await dbRun(`INSERT OR IGNORE INTO marketplace_identifiers (user_id, identifier_type, identifier_value, label, verified)
    VALUES (?, ?, ?, ?, ?)`, [req.userId, String(identifierType).trim(), String(identifierValue).trim(), String(label || '').trim(), 0]);
  res.status(201).json({ message: 'Marketplace identifier saved' });
});

app.post('/api/profile/inventory', authenticateRequest, async (req, res) => {
  const { itemName, itemType = 'skin', patternNumber, serialNumber } = req.body;
  if (!itemName || String(itemName).trim().length > 120) return res.status(400).json({ error: 'A valid item name is required' });
  const result = await dbRun(`INSERT INTO user_inventory_items (user_id, game, item_type, item_name, pattern_number, serial_number)
    VALUES (?, 'standoff2', ?, ?, ?, ?)`, [req.userId, itemType, String(itemName).trim(), patternNumber || null, serialNumber || null]);
  res.status(201).json({ id: result.lastID, message: 'Inventory item saved' });
});

app.post('/api/gold-transfers', authenticateRequest, async (req, res) => {
  const { recipientUsername, goldAmount, itemName, patternNumber, serialNumber } = req.body;
  const gold = Number(goldAmount);
  if (!recipientUsername || !itemName || !Number.isFinite(gold) || gold <= 0 || gold > 1000000) {
    return res.status(400).json({ error: 'Recipient, item, and a valid Gold amount are required' });
  }
  const recipient = await dbGet('SELECT id, username FROM users WHERE lower(username) = lower(?)', [String(recipientUsername).trim()]);
  if (!recipient) return res.status(404).json({ error: 'Recipient profile not found' });
  if (recipient.id === req.userId) return res.status(400).json({ error: 'You cannot send Gold to yourself' });
  const [senderAccount, recipientAccount] = await Promise.all([
    dbGet('SELECT player_id FROM standoff2_accounts WHERE user_id = ?', [req.userId]),
    dbGet('SELECT player_id FROM standoff2_accounts WHERE user_id = ?', [recipient.id])
  ]);
  if (!senderAccount) return res.status(400).json({ error: 'Link your Standoff 2 profile before starting a Gold transfer' });
  if (!recipientAccount) return res.status(400).json({ error: 'Recipient must link a Standoff 2 profile before receiving Gold' });

  const fee = Number((gold * 0.20).toFixed(2));
  const net = Number((gold - fee).toFixed(2));
  const result = await dbRun(`INSERT INTO gold_transfers
    (public_id, sender_id, recipient_id, item_name, pattern_number, serial_number, gold_amount, marketplace_fee_gold, recipient_net_gold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [makePublicTransferId(), req.userId, recipient.id, String(itemName).trim(), patternNumber || null, serialNumber || null, gold, fee, net]);
  const transfer = await getTransferDetails(result.lastID);
  await logGoldTransferEvent(transfer.id, req.userId, 'created', `Transfer created for ${gold} Gold`, { recipient: recipient.username });
  res.status(201).json({ transfer, conversion: await getGoldQuote(gold, true), listingInstructions: listingInstructions(transfer), feedback: 'Recipient verified. Ask them to list the exact item, then confirm the marketplace purchase here.' });
});

app.get('/api/gold-transfers', authenticateRequest, async (req, res) => {
  const transfers = await dbAll(`SELECT gt.*, sender.username AS sender_username, recipient.username AS recipient_username,
      senderTrust.verified AS sender_verified, senderTrust.reputation_score AS sender_reputation,
      recipientTrust.verified AS recipient_verified, recipientTrust.reputation_score AS recipient_reputation
    FROM gold_transfers gt JOIN users sender ON sender.id = gt.sender_id JOIN users recipient ON recipient.id = gt.recipient_id
    LEFT JOIN user_trust senderTrust ON senderTrust.user_id = gt.sender_id LEFT JOIN user_trust recipientTrust ON recipientTrust.user_id = gt.recipient_id
    WHERE gt.sender_id = ? OR gt.recipient_id = ? ORDER BY gt.created_at DESC LIMIT 50`, [req.userId, req.userId]);
  res.json(transfers);
});

app.post('/api/gold-transfers/:id/listing', authenticateRequest, async (req, res) => {
  const transfer = await getTransferDetails(req.params.id);
  const { listingId, listingGold } = req.body;
  if (!canAccessTransfer(transfer, req.userId) || transfer.recipient_id !== req.userId) return res.status(403).json({ error: 'Only the verified recipient can submit this listing' });
  if (transfer.status !== 'awaiting_recipient_listing') return res.status(409).json({ error: 'This transfer is no longer awaiting a listing' });
  if (!listingId || String(listingId).trim().length > 120 || Math.abs(Number(listingGold) - Number(transfer.gold_amount)) > 0.001) {
    return res.status(400).json({ error: `Enter a marketplace listing ID at the agreed ${transfer.gold_amount} Gold price` });
  }
  await dbRun(`UPDATE gold_transfers SET listing_id = ?, status = 'ready_for_sender', recipient_listed_at = CURRENT_TIMESTAMP WHERE id = ?`, [String(listingId).trim(), transfer.id]);
  await awardActivity(req.userId, 'gold_listing_created', 5, transfer.id);
  await logGoldTransferEvent(transfer.id, req.userId, 'listing_submitted', 'Recipient submitted an official marketplace listing ID', { listingId: String(listingId).trim() });
  res.json({ message: 'Listing verified against the agreed amount. The sender can now confirm purchase.', xpEarned: 5 });
});

app.post('/api/gold-transfers/:id/confirm-purchase', authenticateRequest, async (req, res) => {
  const transfer = await getTransferDetails(req.params.id);
  if (!canAccessTransfer(transfer, req.userId) || transfer.sender_id !== req.userId) return res.status(403).json({ error: 'Only the sender can confirm this marketplace purchase' });
  if (transfer.status !== 'ready_for_sender') return res.status(409).json({ error: 'Wait for the recipient to submit the official marketplace listing first' });
  await dbRun(`UPDATE gold_transfers SET status = 'completed', sender_confirmed_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [transfer.id]);
  await Promise.all([
    awardActivity(transfer.sender_id, 'gold_transfer_completed', 25, transfer.id),
    awardActivity(transfer.recipient_id, 'gold_transfer_completed', 25, transfer.id),
    dbRun(`INSERT INTO user_trust (user_id, completed_transfers) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET completed_transfers = completed_transfers + 1, reputation_score = MIN(100, reputation_score + 2), updated_at = CURRENT_TIMESTAMP`, [transfer.sender_id]),
    dbRun(`INSERT INTO user_trust (user_id, completed_transfers) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET completed_transfers = completed_transfers + 1, reputation_score = MIN(100, reputation_score + 2), updated_at = CURRENT_TIMESTAMP`, [transfer.recipient_id])
  ]);
  const badges = [...await awardTransferBadges(transfer.sender_id), ...await awardTransferBadges(transfer.recipient_id)];
  await logGoldTransferEvent(transfer.id, req.userId, 'completed', 'Sender confirmed the marketplace purchase; transfer audit completed');
  res.json({ message: `Transfer completed. ${transfer.sender_username} and ${transfer.recipient_username} earned 25 XP.`, xpEarned: 25, badges: [...new Set(badges)], conversion: await getGoldQuote(transfer.gold_amount, true) });
});

app.post('/api/gold-transfers/:id/dispute', authenticateRequest, async (req, res) => {
  const transfer = await getTransferDetails(req.params.id);
  const reason = String(req.body.reason || '').trim();
  if (!canAccessTransfer(transfer, req.userId)) return res.status(403).json({ error: 'You cannot dispute this transfer' });
  if (!reason || reason.length > 500) return res.status(400).json({ error: 'Enter a dispute reason (up to 500 characters)' });
  if (transfer.status === 'completed') return res.status(409).json({ error: 'Completed transfers must be reviewed by support with their transaction log' });
  await dbRun(`UPDATE gold_transfers SET status = 'disputed', disputed_by = ?, dispute_reason = ? WHERE id = ?`, [req.userId, reason, transfer.id]);
  await dbRun(`INSERT INTO user_trust (user_id, disputed_transfers) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET disputed_transfers = disputed_transfers + 1, updated_at = CURRENT_TIMESTAMP`, [req.userId]);
  await logGoldTransferEvent(transfer.id, req.userId, 'disputed', 'Transfer disputed', { reason });
  res.json({ message: 'Dispute logged. Keep the marketplace receipt and listing ID for review.' });
});

app.get('/api/gold-transfers/:id', authenticateRequest, async (req, res) => {
  const transfer = await getTransferDetails(req.params.id);
  if (!canAccessTransfer(transfer, req.userId)) return res.status(404).json({ error: 'Transfer not found' });
  const events = await dbAll('SELECT event_type, message, payload, created_at FROM gold_transfer_events WHERE transfer_id = ? ORDER BY created_at ASC', [transfer.id]);
  res.json({ transfer, events, conversion: await getGoldQuote(transfer.gold_amount), listingInstructions: listingInstructions(transfer) });
});

// ============================================================
// TOKEN DEPOSIT SYSTEM
// ============================================================

// API: Request token deposit (user submits deposit request)
app.post('/api/tokens/deposit', authenticateRequest, async (req, res) => {
  const { tokenType, amount } = req.body;
  
  if (!tokenType || !['steam', 'standoff2'].includes(tokenType)) {
    return res.status(400).json({ error: 'Invalid token type' });
  }
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  if (tokenType === 'steam') {
    const steam = await dbGet('SELECT * FROM steam_accounts WHERE user_id = ?', [req.userId]);
    if (!steam) {
      return res.status(400).json({ error: 'Please link your Steam account first' });
    }
  }
  
  if (tokenType === 'standoff2') {
    const so2 = await dbGet('SELECT * FROM standoff2_accounts WHERE user_id = ?', [req.userId]);
    if (!so2) {
      return res.status(400).json({ error: 'Please link your Standoff2 account first' });
    }
  }
  
  const verificationMethod = tokenType === 'steam' ? 'steam_api' : 'manual';

  const tokenRate = await getTokenRate(tokenType);
  const estimatedUsdValue = tokenRate ? amount * tokenRate.rate_to_usd : 0;
  const isHighValue = estimatedUsdValue >= HIGH_VALUE_DEPOSIT_THRESHOLD_USD ? 1 : 0;

  const result = await dbRun(`
    INSERT INTO token_deposits (user_id, token_type, amount, status, verification_method, estimated_usd_value, is_high_value)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `, [req.userId, tokenType, amount, verificationMethod, estimatedUsdValue, isHighValue]);

  if (isHighValue) {
    logSystemEvent('warning', `High-value deposit flagged`, `User ${req.userId}: ${amount} ${tokenType} tokens (~$${estimatedUsdValue.toFixed(2)}). Review before approving.`);
  }
  
  logSystemEvent('info', `Token deposit request by user ${req.userId}`, `${amount} ${tokenType} tokens (ID: ${result.lastID})`);
  
  res.json({
    depositId: result.lastID,
    message: tokenType === 'steam' 
      ? 'Deposit request submitted. Your Steam inventory will be verified by the bot.'
      : 'Deposit request submitted. An admin will verify your Standoff2 transfer manually.'
  });
});

// API: Get user's deposit history
app.get('/api/tokens/deposits', authenticateRequest, async (req, res) => {
  const deposits = await dbAll('SELECT * FROM token_deposits WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json(deposits);
});

// API: Admin verify token deposit (approves and credits tokens)
app.post('/api/admin/verify-deposit', checkAdminSession, async (req, res) => {
  const { depositId, approved } = req.body;
  
  const deposit = await dbGet('SELECT * FROM token_deposits WHERE id = ?', [depositId]);
  if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Deposit already processed' });
  
  if (approved) {
    const tokenColumn = getTokenColumn(deposit.token_type);
    await dbRun(`UPDATE users SET ${tokenColumn} = ${tokenColumn} + ? WHERE id = ?`, [deposit.amount, deposit.user_id]);
    await dbRun('UPDATE token_deposits SET status = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?', ['verified', depositId]);
    
    logSystemEvent('info', `Token deposit verified`, `Deposit ID: ${depositId}, ${deposit.amount} ${deposit.token_type} tokens to user ${deposit.user_id}`);
    res.json({ message: 'Deposit verified and tokens credited' });
  } else {
    await dbRun('UPDATE token_deposits SET status = ? WHERE id = ?', ['rejected', depositId]);
    res.json({ message: 'Deposit rejected' });
  }
});

// API: Get pending token deposits (admin)
app.get('/api/admin/pending-deposits', checkAdminSession, async (req, res) => {
  const deposits = await dbAll(`
    SELECT td.*, u.username 
    FROM token_deposits td 
    JOIN users u ON td.user_id = u.id 
    WHERE td.status = 'pending' 
    ORDER BY td.is_high_value DESC, td.created_at ASC
  `);
  res.json(deposits);
});

// ============================================================
// ESCROW TRADE SYSTEM
// ============================================================

// Helper: Create escrow trade
async function createEscrowTrade(skinId, sellerId, buyerId, priceTokens, tokenType, tradeType) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  const result = await dbRun(`
    INSERT INTO escrow_trades (skin_id, seller_id, buyer_id, price_tokens, token_type, status, trade_type, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `, [skinId, sellerId, buyerId, priceTokens, tokenType, tradeType, expiresAt]);
  
  return result.lastID;
}

// Helper: Complete escrow trade (release payment to seller)
async function completeEscrowTrade(tradeId) {
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ?', [tradeId]);
  if (!trade || trade.status !== 'buyer_confirmed') return;

  if (trade.token_type === 'btc') {
    // CS2 fiat-priced skin: BTC was already deducted from buyer at purchase time, release to seller
    await dbRun('UPDATE users SET btc_balance = btc_balance + ? WHERE id = ?', [trade.price_tokens, trade.seller_id]);
  } else {
    // Token-priced skin: transfer tokens from buyer to seller
    const tokenColumn = getTokenColumn(trade.token_type);
    if (tokenColumn) {
      await dbRun(`UPDATE users SET ${tokenColumn} = ${tokenColumn} - ? WHERE id = ?`, [trade.price_tokens, trade.buyer_id]);
      await dbRun(`UPDATE users SET ${tokenColumn} = ${tokenColumn} + ? WHERE id = ?`, [trade.price_tokens, trade.seller_id]);
    }
  }

  await dbRun('UPDATE escrow_trades SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['completed', tradeId]);
  await dbRun('UPDATE skins SET status = ?, user_id = ? WHERE id = ?', ['sold', trade.buyer_id, trade.skin_id]);

  // Record completed trade for reputation
  await recordCompletedTrade(trade.seller_id);
  await recordCompletedTrade(trade.buyer_id);

  // Freeze a USD + buyer's local-currency price snapshot at completion time for receipts/analytics
  let priceUsd = 0;
  if (trade.token_type === 'btc') {
    const btcRate = await getExchangeRate('BTC');
    priceUsd = btcRate ? trade.price_tokens * btcRate.rate_to_usd : 0;
  } else {
    const tokenRate = await getTokenRate(trade.token_type);
    priceUsd = tokenRate ? trade.price_tokens * tokenRate.rate_to_usd : 0;
  }
  const buyer = await dbGet('SELECT preferred_currency FROM users WHERE id = ?', [trade.buyer_id]);
  const buyerCurrency = buyer?.preferred_currency || 'USD';
  const currencyRate = await getExchangeRate(buyerCurrency);
  const priceInBuyerCurrency = currencyRate && currencyRate.rate_to_usd > 0 ? priceUsd / currencyRate.rate_to_usd : priceUsd;

  await dbRun(`
    UPDATE skin_transactions
    SET status = 'completed', price_usd = ?, buyer_currency = ?, price_in_buyer_currency = ?
    WHERE skin_id = ? AND seller_id = ? AND buyer_id = ? AND status = 'pending'
  `, [priceUsd, buyerCurrency, priceInBuyerCurrency, trade.skin_id, trade.seller_id, trade.buyer_id]);

  // Referral commission: credit agent on buyer's first completed purchase
  if (priceUsd > 0) {
    const buyerRecord = await dbGet('SELECT referred_by FROM users WHERE id = ?', [trade.buyer_id]);
    if (buyerRecord && buyerRecord.referred_by) {
      const referral = await dbGet('SELECT * FROM referral_tracking WHERE referred_user_id = ? AND first_purchase_made = 0', [trade.buyer_id]);
      if (referral) {
        const agent = await dbGet('SELECT * FROM referral_agents WHERE id = ? AND is_active = 1', [referral.agent_id]);
        if (agent) {
          const commission = priceUsd * (agent.commission_percent / 100);
          await dbRun('UPDATE referral_tracking SET first_purchase_made = 1, commission_earned_usd = ?, commission_status = ?, first_purchase_at = CURRENT_TIMESTAMP WHERE id = ?', [commission, 'earned', referral.id]);
          await dbRun('UPDATE referral_agents SET total_earned_usd = total_earned_usd + ? WHERE id = ?', [commission, agent.id]);
          logSystemEvent('info', `Referral commission credited`, `Agent: ${agent.agent_name} (${agent.referral_code}), Commission: $${commission.toFixed(2)} on sale of $${priceUsd.toFixed(2)}`);
        }
      }
    }
  }

  logSystemEvent('info', `Escrow trade completed`, `Trade ID: ${tradeId}, Skin ID: ${trade.skin_id}`);
}

// Helper: Cancel escrow trade (refund buyer)
async function cancelEscrowTrade(tradeId, reason) {
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ?', [tradeId]);
  if (!trade) return;

  // Refund buyer: BTC for CS2 fiat-priced skins, tokens for others
  if (trade.token_type === 'btc') {
    await dbRun('UPDATE users SET btc_balance = btc_balance + ? WHERE id = ?', [trade.price_tokens, trade.buyer_id]);
  } else {
    const tokenColumn = getTokenColumn(trade.token_type);
    if (tokenColumn) {
      await dbRun(`UPDATE users SET ${tokenColumn} = ${tokenColumn} + ? WHERE id = ?`, [trade.price_tokens, trade.buyer_id]);
    }
  }

  await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?', ['cancelled', reason, tradeId]);
  await dbRun('UPDATE skins SET status = ? WHERE id = ?', ['available', trade.skin_id]);
  await dbRun(`
    UPDATE skin_transactions SET status = 'cancelled'
    WHERE skin_id = ? AND seller_id = ? AND buyer_id = ? AND status = 'pending'
  `, [trade.skin_id, trade.seller_id, trade.buyer_id]);
  
  logSystemEvent('info', `Escrow trade cancelled`, `Trade ID: ${tradeId}, Reason: ${reason}`);
}

// API: Purchase skin with escrow (replaces instant purchase)
app.post('/api/skins/:id/purchase', authenticateRequest, async (req, res) => {
  const skinId = req.params.id;
  
  const skin = await dbGet('SELECT * FROM skins WHERE id = ? AND status = ?', [skinId, 'available']);
  if (!skin) return res.status(404).json({ error: 'Skin not available' });
  if (skin.user_id === req.userId) return res.status(400).json({ error: 'Cannot purchase your own skin' });

  const isCS2 = skin.game_type === 'CS2';

  if (isCS2) {
    // CS2 skins are fiat-priced; buyer pays BTC equivalent from their BTC balance
    const fiatCurrency = skin.fiat_currency || 'USD';
    const fiatRate = await getExchangeRate(fiatCurrency);
    const btcRate = await getExchangeRate('BTC');
    if (!fiatRate || !btcRate) {
      return res.status(500).json({ error: 'Exchange rate unavailable' });
    }
    const priceUsd = skin.price_fiat * fiatRate.rate_to_usd;
    const priceBtc = btcRate.rate_to_usd > 0 ? priceUsd / btcRate.rate_to_usd : 0;

    const buyer = await dbGet('SELECT btc_balance FROM users WHERE id = ?', [req.userId]);
    if (!buyer || buyer.btc_balance < priceBtc) {
      const symbol = SUPPORTED_CURRENCIES[fiatCurrency]?.symbol || '$';
      return res.status(400).json({ error: `Insufficient BTC balance. This skin costs ${symbol}${skin.price_fiat} ${fiatCurrency} (~${priceBtc.toFixed(8)} BTC)` });
    }

    // Check Steam account for CS2 delivery
    const buyerSteam = await dbGet('SELECT * FROM steam_accounts WHERE user_id = ?', [req.userId]);
    if (!buyerSteam || !buyerSteam.trade_url) {
      return res.status(400).json({ error: 'Please link your Steam account and set your trade URL first' });
    }

    // Escrow: deduct BTC from buyer, hold in escrow until trade completes
    await dbRun('UPDATE users SET btc_balance = btc_balance - ? WHERE id = ?', [priceBtc, req.userId]);

    const escrowId = await createEscrowTrade(skinId, skin.user_id, req.userId, priceBtc, 'btc', 'steam_bot');

    await dbRun('UPDATE skins SET status = ? WHERE id = ?', ['pending', skinId]);

    await dbRun(`
      INSERT INTO skin_transactions (skin_id, seller_id, buyer_id, price_tokens, token_type, status, price_usd, buyer_currency)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [skinId, skin.user_id, req.userId, priceBtc, 'btc', priceUsd, fiatCurrency]);

    const symbol = SUPPORTED_CURRENCIES[fiatCurrency]?.symbol || '$';
    res.json({
      escrowId,
      message: `Escrow trade created! ${symbol}${skin.price_fiat} ${fiatCurrency} (~${priceBtc.toFixed(8)} BTC) held in escrow.`,
      tradeType: 'steam_bot',
      instructions: 'The seller will send the skin to the PixelPulse Steam bot. Once verified, it will be forwarded to your Steam account.',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } else {
    // Non-CS2 skins: token pricing (existing flow)
    const tokenColumn = getTokenColumn(skin.token_type);
    if (!tokenColumn) return res.status(400).json({ error: 'Invalid token type for this skin' });
    const buyer = await dbGet(`SELECT ${tokenColumn} FROM users WHERE id = ?`, [req.userId]);
    if (!buyer || buyer[tokenColumn] < skin.price_tokens) {
      return res.status(400).json({ error: `Insufficient ${getTokenLabel(skin.token_type)} tokens` });
    }

    const tradeType = 'manual';

    // For non-CS2 games, require appropriate game account
    if (skin.game_type === 'Standoff2') {
      const buyerSO2 = await dbGet('SELECT * FROM standoff2_accounts WHERE user_id = ?', [req.userId]);
      if (!buyerSO2) {
        return res.status(400).json({ error: 'Please link your Standoff2 account first' });
      }
    }

    const escrowId = await createEscrowTrade(skinId, skin.user_id, req.userId, skin.price_tokens, skin.token_type, tradeType);

    await dbRun('UPDATE skins SET status = ? WHERE id = ?', ['pending', skinId]);

    await dbRun(`
      INSERT INTO skin_transactions (skin_id, seller_id, buyer_id, price_tokens, token_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [skinId, skin.user_id, req.userId, skin.price_tokens, skin.token_type]);

    const tLabel = getTokenLabel(skin.token_type);
    const instructions = `The seller will send the skin in-game. Confirm receipt in your escrow panel once you receive it.`;

    res.json({
      escrowId,
      message: `Escrow trade created! ${skin.price_tokens} ${tLabel} tokens held in escrow.`,
      tradeType,
      instructions,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
});

// API: Get user's own listed skins (available status only)
app.get('/api/skins/my-listings', authenticateRequest, async (req, res) => {
  const skins = await dbAll(`
    SELECT * FROM skins WHERE user_id = ? AND status = 'available' ORDER BY created_at DESC
  `, [req.userId]);
  res.json(skins);
});

// API: Delist a skin (seller removes it from marketplace if still available)
app.post('/api/skins/:id/delist', authenticateRequest, async (req, res) => {
  const skinId = req.params.id;
  const skin = await dbGet('SELECT * FROM skins WHERE id = ? AND status = ?', [skinId, 'available']);
  if (!skin) return res.status(404).json({ error: 'Skin not found or no longer available' });
  if (skin.user_id !== req.userId) return res.status(403).json({ error: 'You can only delist your own skins' });

  await dbRun('UPDATE skins SET status = ? WHERE id = ?', ['delisted', skinId]);
  logSystemEvent('info', `Skin delisted by user`, `Skin ID: ${skinId}, User: ${req.userId}`);
  res.json({ message: 'Skin delisted successfully' });
});

// API: Get user's active escrow trades
app.get('/api/escrow/active', authenticateRequest, async (req, res) => {
  const trades = await dbAll(`
    SELECT et.*, s.skin_name, s.game_type, s.image_url,
           seller.username as seller_name, buyer.username as buyer_name
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    JOIN users seller ON et.seller_id = seller.id
    JOIN users buyer ON et.buyer_id = buyer.id
    WHERE (et.seller_id = ? OR et.buyer_id = ?) AND et.status NOT IN ('completed', 'cancelled')
    ORDER BY et.created_at DESC
  `, [req.userId, req.userId]);
  res.json(trades);
});

// API: Get escrow trade details
app.get('/api/escrow/:id', authenticateRequest, async (req, res) => {
  const trade = await dbGet(`
    SELECT et.*, s.skin_name, s.game_type, s.image_url, s.weapon, s.rarity,
           seller.username as seller_name, buyer.username as buyer_name,
           sa.trade_url as seller_steam_trade_url, sa.steam_username as seller_steam_name,
           so2a.player_id as seller_so2_id, so2a.player_name as seller_so2_name,
           ba.trade_url as buyer_steam_trade_url, ba.steam_username as buyer_steam_name,
           bso2a.player_id as buyer_so2_id, bso2a.player_name as buyer_so2_name
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    JOIN users seller ON et.seller_id = seller.id
    JOIN users buyer ON et.buyer_id = buyer.id
    LEFT JOIN steam_accounts sa ON et.seller_id = sa.user_id
    LEFT JOIN steam_accounts ba ON et.buyer_id = ba.user_id
    LEFT JOIN standoff2_accounts so2a ON et.seller_id = so2a.user_id
    LEFT JOIN standoff2_accounts bso2a ON et.buyer_id = bso2a.user_id
    WHERE et.id = ? AND (et.seller_id = ? OR et.buyer_id = ?)
  `, [req.params.id, req.userId, req.userId]);
  
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  res.json(trade);
});

// API: Seller confirms they sent the skin
app.post('/api/escrow/:id/seller-confirm', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ? AND seller_id = ?', [req.params.id, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.status !== 'pending') return res.status(400).json({ error: `Trade is already ${trade.status}` });
  
  await dbRun('UPDATE escrow_trades SET seller_confirmed = 1, seller_confirm_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
    ['seller_sent', trade.id]);
  
  logSystemEvent('info', `Seller confirmed skin sent`, `Trade ID: ${trade.id}, Seller: ${req.userId}`);
  res.json({ message: 'Confirmed! Waiting for buyer to confirm receipt.' });
});

// API: Buyer confirms they received the skin
app.post('/api/escrow/:id/buyer-confirm', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ? AND buyer_id = ?', [req.params.id, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.status !== 'seller_sent') return res.status(400).json({ error: `Seller must confirm sending first. Current status: ${trade.status}` });
  
  await dbRun('UPDATE escrow_trades SET buyer_confirmed = 1, buyer_confirm_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
    ['buyer_confirmed', trade.id]);
  
  // Complete the trade — release tokens to seller
  await completeEscrowTrade(trade.id);
  
  logSystemEvent('info', `Buyer confirmed skin received`, `Trade ID: ${trade.id}, Buyer: ${req.userId}`);
  res.json({ message: 'Trade completed! Tokens have been released to the seller.' });
});

// API: Raise a dispute
app.post('/api/escrow/:id/dispute', authenticateRequest, async (req, res) => {
  const { reason } = req.body;
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ? AND (seller_id = ? OR buyer_id = ?)', [req.params.id, req.userId, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (['completed', 'cancelled'].includes(trade.status)) return res.status(400).json({ error: 'Trade already finished' });
  
  await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?', ['disputed', reason || 'No reason provided', trade.id]);
  
  // Record dispute against both parties (the one who didn't raise it gets it too, admin decides)
  await recordDispute(trade.seller_id, trade.id, `Escrow dispute: ${reason || 'No reason'}`);
  await recordDispute(trade.buyer_id, trade.id, `Escrow dispute: ${reason || 'No reason'}`);
  
  logSystemEvent('warning', `Escrow dispute raised`, `Trade ID: ${trade.id}, By: ${req.userId}, Reason: ${reason}`);
  res.json({ message: 'Dispute raised. An admin will review this trade.' });
});

// API: Cancel escrow trade (either party can cancel if status is still 'pending')
app.post('/api/escrow/:id/cancel', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ? AND (seller_id = ? OR buyer_id = ?)', [req.params.id, req.userId, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (!['pending', 'seller_sent'].includes(trade.status)) return res.status(400).json({ error: `Cannot cancel trade in ${trade.status} state` });
  
  await cancelEscrowTrade(trade.id, req.body.reason || 'Cancelled by user');
  res.json({ message: 'Trade cancelled. Skin is back on the marketplace.' });
});

// API: Admin resolve disputed trade
app.post('/api/admin/resolve-escrow', checkAdminSession, async (req, res) => {
  const { tradeId, resolution } = req.body;
  // resolution: 'complete' (release tokens) or 'cancel' (refund)
  
  const trade = await dbGet('SELECT * FROM escrow_trades WHERE id = ?', [tradeId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.status !== 'disputed') return res.status(400).json({ error: 'Trade is not disputed' });
  
  if (resolution === 'complete') {
    await dbRun('UPDATE escrow_trades SET status = ? WHERE id = ?', ['buyer_confirmed', tradeId]);
    await completeEscrowTrade(tradeId);
    res.json({ message: 'Trade completed by admin. Tokens released to seller.' });
  } else {
    await cancelEscrowTrade(tradeId, 'Admin resolved dispute — trade cancelled');
    res.json({ message: 'Trade cancelled by admin. Skin returned to marketplace.' });
  }
});

// API: Get pending disputed trades (admin)
app.get('/api/admin/disputed-trades', checkAdminSession, async (req, res) => {
  const trades = await dbAll(`
    SELECT et.*, s.skin_name, s.game_type,
           seller.username as seller_name, buyer.username as buyer_name
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    JOIN users seller ON et.seller_id = seller.id
    JOIN users buyer ON et.buyer_id = buyer.id
    WHERE et.status = 'disputed'
    ORDER BY et.created_at ASC
  `);
  res.json(trades);
});

// ============================================================
// P2P TRADE SYSTEM (Gift Cards, Game Accounts, Token Swaps)
// ============================================================

// API: Create a P2P trade listing (gift card sale/swap, game account sale)
app.post('/api/p2p-trades/list', authenticateRequest, async (req, res) => {
  const { trade_category, listing_type, title, description, game_type, item_details, price_amount, price_currency, payment_methods } = req.body;

  if (!trade_category || !listing_type || !title || !price_amount || price_amount <= 0) {
    return res.status(400).json({ error: 'Missing required fields: trade_category, listing_type, title, price_amount' });
  }

  const validCategories = ['gift_card', 'game_account', 'token_swap', 'gold_send'];
  if (!validCategories.includes(trade_category)) {
    return res.status(400).json({ error: `Invalid trade category. Must be one of: ${validCategories.join(', ')}` });
  }

  const validListingTypes = ['sale', 'swap'];
  if (!validListingTypes.includes(listing_type)) {
    return res.status(400).json({ error: `Invalid listing type. Must be 'sale' or 'swap'` });
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const feePercent = 5.0;

  const result = await dbRun(`
    INSERT INTO p2p_trades (trade_category, listing_type, title, description, game_type, item_details, price_amount, price_currency, payment_methods, seller_id, fee_percent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [trade_category, listing_type, title, description || '', game_type || '', item_details || '', price_amount, price_currency || 'USD', payment_methods || 'BTC, PayPal', req.userId, feePercent, expiresAt]);

  logSystemEvent('info', `P2P trade listing created`, `Trade ID: ${result.lastID}, Category: ${trade_category}, User: ${req.userId}`);

  // Notify Telegram
  const seller = await dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  const categoryLabels = { gift_card: 'Gift Card', game_account: 'Game Account', token_swap: 'Token Swap', gold_send: 'Gold Send' };
  notifyNewSkinListing(title, game_type || categoryLabels[trade_category], price_amount, price_currency || 'USD', seller?.username || 'Unknown').catch(() => {});

  res.json({ id: result.lastID, message: 'P2P trade listing created successfully', feePercent });
});

// API: Browse all open P2P trade listings
app.get('/api/p2p-trades/listings', async (req, res) => {
  const { category } = req.query;
  let query = `
    SELECT pt.*, seller.username as seller_name
    FROM p2p_trades pt
    JOIN users seller ON pt.seller_id = seller.id
    WHERE pt.status = 'open'
  `;
  const params = [];
  if (category) {
    query += ` AND pt.trade_category = ?`;
    params.push(category);
  }
  query += ` ORDER BY pt.created_at DESC`;
  const listings = await dbAll(query, params);
  res.json(listings);
});

// API: Get a specific P2P trade
app.get('/api/p2p-trades/:id', async (req, res) => {
  const trade = await dbGet(`
    SELECT pt.*, seller.username as seller_name, buyer.username as buyer_name
    FROM p2p_trades pt
    JOIN users seller ON pt.seller_id = seller.id
    LEFT JOIN users buyer ON pt.buyer_id = buyer.id
    WHERE pt.id = ?
  `, [req.params.id]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  res.json(trade);
});

// API: Buyer initiates purchase of a P2P listing
app.post('/api/p2p-trades/:id/purchase', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM p2p_trades WHERE id = ? AND status = ?', [req.params.id, 'open']);
  if (!trade) return res.status(404).json({ error: 'Trade not available' });
  if (trade.seller_id === req.userId) return res.status(400).json({ error: 'Cannot purchase your own listing' });

  await dbRun('UPDATE p2p_trades SET buyer_id = ?, status = ? WHERE id = ?', [req.userId, 'pending', trade.id]);

  logSystemEvent('info', `P2P trade purchase initiated`, `Trade ID: ${trade.id}, Buyer: ${req.userId}`);

  res.json({
    tradeId: trade.id,
    message: 'Trade initiated! Contact the seller to arrange delivery. Once delivered, the seller confirms sending and you confirm receipt.',
    instructions: trade.trade_category === 'gift_card'
      ? 'Seller sends gift card code/details. Buyer redeems and confirms. 5% fee applies on completion.'
      : trade.trade_category === 'game_account'
      ? 'Seller transfers account credentials. Buyer changes password and confirms. 5% fee applies on completion.'
      : 'Arrange the swap details between yourselves. Both confirm when satisfied. 5% fee applies on completion.',
    expiresAt: trade.expires_at
  });
});

// API: Seller confirms they delivered the item
app.post('/api/p2p-trades/:id/seller-confirm', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM p2p_trades WHERE id = ? AND seller_id = ?', [req.params.id, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.status !== 'pending') return res.status(400).json({ error: `Trade is already ${trade.status}` });

  await dbRun('UPDATE p2p_trades SET seller_confirmed = 1, seller_confirm_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
    ['seller_sent', trade.id]);

  logSystemEvent('info', `P2P seller confirmed delivery`, `Trade ID: ${trade.id}, Seller: ${req.userId}`);
  res.json({ message: 'Confirmed! Waiting for buyer to confirm receipt.' });
});

// API: Buyer confirms they received the item — completes trade with 5% fee
app.post('/api/p2p-trades/:id/buyer-confirm', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM p2p_trades WHERE id = ? AND buyer_id = ?', [req.params.id, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.status !== 'seller_sent') return res.status(400).json({ error: `Seller must confirm sending first. Current status: ${trade.status}` });

  // Calculate 5% fee
  const feeAmount = trade.price_amount * (trade.fee_percent / 100);
  const sellerReceives = trade.price_amount - feeAmount;

  await dbRun('UPDATE p2p_trades SET buyer_confirmed = 1, buyer_confirm_at = CURRENT_TIMESTAMP, status = ?, fee_amount = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['completed', feeAmount, trade.id]);

  // Record completed trade for reputation
  await recordCompletedTrade(trade.seller_id);
  await recordCompletedTrade(trade.buyer_id);

  logSystemEvent('info', `P2P trade completed`, `Trade ID: ${trade.id}, Fee: ${feeAmount} ${trade.price_currency} (${trade.fee_percent}%), Seller receives: ${sellerReceives} ${trade.price_currency}`);

  res.json({
    message: 'Trade completed! Both parties confirmed satisfaction.',
    feeAmount,
    feePercent: trade.fee_percent,
    sellerReceives,
    currency: trade.price_currency
  });
});

// API: Raise dispute on P2P trade
app.post('/api/p2p-trades/:id/dispute', authenticateRequest, async (req, res) => {
  const { reason } = req.body;
  const trade = await dbGet('SELECT * FROM p2p_trades WHERE id = ? AND (seller_id = ? OR buyer_id = ?)', [req.params.id, req.userId, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (['completed', 'cancelled'].includes(trade.status)) return res.status(400).json({ error: 'Trade already finished' });

  await dbRun('UPDATE p2p_trades SET status = ?, dispute_reason = ? WHERE id = ?', ['disputed', reason || 'No reason provided', trade.id]);
  await recordDispute(trade.seller_id, trade.id, `P2P dispute: ${reason || 'No reason'}`);
  await recordDispute(trade.buyer_id, trade.id, `P2P dispute: ${reason || 'No reason'}`);
  logSystemEvent('warning', `P2P trade dispute raised`, `Trade ID: ${trade.id}, By: ${req.userId}, Reason: ${reason}`);
  res.json({ message: 'Dispute raised. An admin will review this trade.' });
});

// API: Cancel P2P trade
app.post('/api/p2p-trades/:id/cancel', authenticateRequest, async (req, res) => {
  const trade = await dbGet('SELECT * FROM p2p_trades WHERE id = ? AND (seller_id = ? OR buyer_id = ?)', [req.params.id, req.userId, req.userId]);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (!['open', 'pending', 'seller_sent'].includes(trade.status)) return res.status(400).json({ error: `Cannot cancel trade in ${trade.status} state` });

  await dbRun('UPDATE p2p_trades SET status = ? WHERE id = ?', ['cancelled', trade.id]);
  logSystemEvent('info', `P2P trade cancelled`, `Trade ID: ${trade.id}, By: ${req.userId}`);
  res.json({ message: 'Trade cancelled.' });
});

// API: Get user's active P2P trades
app.get('/api/p2p-trades/my-trades', authenticateRequest, async (req, res) => {
  const trades = await dbAll(`
    SELECT pt.*, seller.username as seller_name, buyer.username as buyer_name
    FROM p2p_trades pt
    JOIN users seller ON pt.seller_id = seller.id
    LEFT JOIN users buyer ON pt.buyer_id = buyer.id
    WHERE (pt.seller_id = ? OR pt.buyer_id = ?) AND pt.status NOT IN ('completed', 'cancelled')
    ORDER BY pt.created_at DESC
  `, [req.userId, req.userId]);
  res.json(trades);
});

// API: Get all trades across all trade types (unified trade reports)
app.get('/api/trades/all', async (req, res) => {
  const { status, category, limit } = req.query;
  const maxLimit = Math.min(parseInt(limit) || 50, 100);
  const statusFilter = status || 'all';

  // Fetch skin trades (escrow)
  let skinQuery = `
    SELECT et.id, et.status, et.created_at, et.completed_at, et.price_tokens, et.token_type,
           s.skin_name as item_title, s.game_type, s.image_url,
           seller.username as seller_name, buyer.username as buyer_name,
           'skin' as trade_type
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    JOIN users seller ON et.seller_id = seller.id
    JOIN users buyer ON et.buyer_id = buyer.id
  `;
  const skinParams = [];
  if (statusFilter !== 'all') {
    skinQuery += ` WHERE et.status = ?`;
    skinParams.push(statusFilter);
  }
  skinQuery += ` ORDER BY et.created_at DESC LIMIT ?`;
  skinParams.push(maxLimit);
  const skinTrades = await dbAll(skinQuery, skinParams);

  // Fetch P2P trades
  let p2pQuery = `
    SELECT pt.id, pt.trade_category, pt.listing_type, pt.title as item_title, pt.game_type, pt.description,
           pt.price_amount, pt.price_currency, pt.status, pt.created_at, pt.completed_at,
           pt.fee_percent, pt.fee_amount, pt.seller_confirmed, pt.buyer_confirmed,
           seller.username as seller_name, buyer.username as buyer_name,
           pt.trade_category as trade_type
    FROM p2p_trades pt
    JOIN users seller ON pt.seller_id = seller.id
    LEFT JOIN users buyer ON pt.buyer_id = buyer.id
  `;
  const p2pParams = [];
  const conditions = [];
  if (statusFilter !== 'all') {
    conditions.push('pt.status = ?');
    p2pParams.push(statusFilter);
  }
  if (category) {
    conditions.push('pt.trade_category = ?');
    p2pParams.push(category);
  }
  if (conditions.length > 0) {
    p2pQuery += ` WHERE ` + conditions.join(' AND ');
  }
  p2pQuery += ` ORDER BY pt.created_at DESC LIMIT ?`;
  p2pParams.push(maxLimit);
  const p2pTrades = await dbAll(p2pQuery, p2pParams);

  // Fetch token swap trades
  let tokenQuery = `
    SELECT ttl.id, ttl.offer_token_type, ttl.offer_amount, ttl.want_token_type, ttl.want_amount,
           ttl.status, ttl.created_at, ttl.fee_percent,
           u.username as seller_name,
           'token_swap' as trade_type,
           (ttl.offer_token_type || ' -> ' || ttl.want_token_type) as item_title,
           ttl.offer_amount as price_amount, ttl.offer_token_type as price_currency
    FROM token_trade_listings ttl
    JOIN users u ON ttl.user_id = u.id
  `;
  const tokenParams = [];
  if (statusFilter !== 'all') {
    tokenQuery += ` WHERE ttl.status = ?`;
    tokenParams.push(statusFilter);
  }
  tokenQuery += ` ORDER BY ttl.created_at DESC LIMIT ?`;
  tokenParams.push(maxLimit);
  const tokenTrades = await dbAll(tokenQuery, tokenParams);

  // Combine and sort by created_at desc
  const allTrades = [...skinTrades, ...p2pTrades, ...tokenTrades];

  // Fetch reputation for all sellers to sort trusted first
  const sellerNames = [...new Set(allTrades.map(t => t.seller_name).filter(Boolean))];
  const repMap = {};
  for (const name of sellerNames) {
    const user = await dbGet('SELECT id FROM users WHERE username = ?', [name]);
    if (user) {
      const rep = await ensureReputationRow(user.id);
      repMap[name] = {
        is_trusted: !!rep.is_trusted,
        is_flagged: !!rep.is_flagged,
        is_banned: !!rep.is_banned,
        trust_score: rep.trust_score,
        completed_trades: rep.completed_trades,
        badges: getReputationBadges(rep)
      };
    }
  }

  // Attach reputation to each trade
  allTrades.forEach(t => {
    t.seller_reputation = repMap[t.seller_name] || null;
  });

  // Sort: trusted sellers first, then non-flagged, then by date
  allTrades.sort((a, b) => {
    const aTrusted = a.seller_reputation?.is_trusted ? 0 : (a.seller_reputation?.is_banned ? 2 : (a.seller_reputation?.is_flagged ? 1 : 0));
    const bTrusted = b.seller_reputation?.is_trusted ? 0 : (b.seller_reputation?.is_banned ? 2 : (b.seller_reputation?.is_flagged ? 1 : 0));
    if (aTrusted !== bTrusted) return aTrusted - bTrusted;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  res.json({
    total: allTrades.length,
    trades: allTrades.slice(0, maxLimit),
    summary: {
      skins: skinTrades.length,
      p2p: p2pTrades.length,
      tokenSwaps: tokenTrades.length
    }
  });
});

// API: Get trade statistics (for dashboard)
app.get('/api/trades/stats', async (req, res) => {
  const skinCompleted = await dbGet(`SELECT COUNT(*) as count, COALESCE(SUM(price_tokens), 0) as volume FROM escrow_trades WHERE status = 'completed'`);
  const p2pCompleted = await dbGet(`SELECT COUNT(*) as count, COALESCE(SUM(price_amount), 0) as volume, COALESCE(SUM(fee_amount), 0) as fees FROM p2p_trades WHERE status = 'completed'`);
  const tokenCompleted = await dbGet(`SELECT COUNT(*) as count FROM token_trade_listings WHERE status = 'completed'`);
  const skinActive = await dbGet(`SELECT COUNT(*) as count FROM escrow_trades WHERE status NOT IN ('completed', 'cancelled')`);
  const p2pActive = await dbGet(`SELECT COUNT(*) as count FROM p2p_trades WHERE status NOT IN ('completed', 'cancelled')`);
  const tokenActive = await dbGet(`SELECT COUNT(*) as count FROM token_trade_listings WHERE status = 'open'`);
  const skinOpen = await dbGet(`SELECT COUNT(*) as count FROM skins WHERE status = 'available'`);
  const p2pOpen = await dbGet(`SELECT COUNT(*) as count FROM p2p_trades WHERE status = 'open'`);

  res.json({
    completed: {
      skins: skinCompleted.count,
      p2p: p2pCompleted.count,
      tokenSwaps: tokenCompleted.count,
      total: skinCompleted.count + p2pCompleted.count + tokenCompleted.count
    },
    active: {
      skins: skinActive.count,
      p2p: p2pActive.count,
      tokenSwaps: tokenActive.count,
      total: skinActive.count + p2pActive.count + tokenActive.count
    },
    open_listings: {
      skins: skinOpen.count,
      p2p: p2pOpen.count,
      total: skinOpen.count + p2pOpen.count
    },
    volume: {
      skins: skinCompleted.volume,
      p2p: p2pCompleted.volume,
      fees_collected: p2pCompleted.fees
    }
  });
});

// ============================================================
// ARCADE — PROVABLY FAIR GAMES (USD staking)
// ============================================================

const arcadeCrypto = require('crypto');

function generateServerSeed() {
  return arcadeCrypto.randomBytes(32).toString('hex');
}

function provablyFairResult(serverSeed, clientSeed, nonce) {
  const hmac = arcadeCrypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  const int = parseInt(hash.substring(0, 8), 16);
  return int / 0xFFFFFFFF;
}

const WEB_MIN_STAKE = 2.00;
const DISCORD_MIN_STAKE = 0.50;
const HOUSE_EDGE = 0.05;

// API: Get user's USD balance for arcade
app.get('/api/arcade/balance', authenticateRequest, async (req, res) => {
  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  res.json({ balance: bal?.usd_balance || 0, currency: 'USD', min_stake: WEB_MIN_STAKE });
});

// API: Get recent winners feed
app.get('/api/arcade/winners', async (req, res) => {
  const winners = await dbAll(`
    SELECT gb.*, u.username FROM game_bets gb
    JOIN users u ON gb.user_id = u.id
    WHERE gb.payout > 0 AND gb.stake_currency = 'USD'
    ORDER BY gb.created_at DESC LIMIT 20
  `);
  res.json(winners.map(w => ({
    username: w.username, game: w.game_type, stake: w.stake_amount,
    multiplier: w.multiplier, payout: w.payout, time: w.created_at
  })));
});

// API: Get user's bet history
app.get('/api/arcade/history', authenticateRequest, async (req, res) => {
  const bets = await dbAll('SELECT * FROM game_bets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.userId]);
  res.json(bets);
});

// ===== HEADS OR TAILS =====
app.post('/api/arcade/coinflip', authenticateRequest, async (req, res) => {
  const { choice, stake, clientSeed } = req.body;
  if (!choice || !['heads', 'tails'].includes(choice)) return res.status(400).json({ error: 'Choose heads or tails' });
  const stakeAmount = parseFloat(stake);
  if (isNaN(stakeAmount) || stakeAmount < WEB_MIN_STAKE) return res.status(400).json({ error: `Minimum stake is $${WEB_MIN_STAKE}` });

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  if (!bal || bal.usd_balance < stakeAmount) return res.status(400).json({ error: 'Insufficient USD balance' });

  const serverSeed = generateServerSeed();
  const cSeed = clientSeed || arcadeCrypto.randomBytes(8).toString('hex');
  const nonce = Date.now();
  const roll = provablyFairResult(serverSeed, cSeed, nonce);
  const result = roll < 0.5 ? 'heads' : 'tails';
  const won = result === choice;
  const multiplier = won ? (2 - HOUSE_EDGE * 2) : 0;
  const payout = won ? Math.floor(stakeAmount * multiplier * 100) / 100 : 0;

  await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ?, total_lost = total_lost + ? WHERE user_id = ?', [stakeAmount, stakeAmount, req.userId]);
  if (payout > 0) await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, req.userId]);

  await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, server_seed, client_seed, nonce) VALUES (?, 'coinflip', ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, stakeAmount, multiplier, payout, won ? 'won' : 'lost', JSON.stringify({ choice, result, roll: roll.toFixed(4) }), serverSeed, cSeed, nonce]);

  res.json({ result, won, multiplier, payout, stake: stakeAmount, newBalance: (bal.usd_balance - stakeAmount + payout) });
});

// ===== SLOTS (3-reel) =====
const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣', '🎮', '👾'];
const SLOT_PAYOUTS = { '💎': 50, '7️⃣': 25, '⭐': 15, '🔔': 10, '🎮': 8, '👾': 6, '🍒': 5, '🍋': 3 };

app.post('/api/arcade/slots', authenticateRequest, async (req, res) => {
  const { stake, clientSeed } = req.body;
  const stakeAmount = parseFloat(stake);
  if (isNaN(stakeAmount) || stakeAmount < WEB_MIN_STAKE) return res.status(400).json({ error: `Minimum stake is $${WEB_MIN_STAKE}` });

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  if (!bal || bal.usd_balance < stakeAmount) return res.status(400).json({ error: 'Insufficient USD balance' });

  const serverSeed = generateServerSeed();
  const cSeed = clientSeed || arcadeCrypto.randomBytes(8).toString('hex');
  const nonce = Date.now();
  const reels = [];
  for (let i = 0; i < 3; i++) {
    const roll = provablyFairResult(serverSeed, cSeed, nonce + i);
    reels.push(SLOT_SYMBOLS[Math.floor(roll * SLOT_SYMBOLS.length)]);
  }

  let multiplier = 0, result = 'lost';
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = SLOT_PAYOUTS[reels[0]] * (1 - HOUSE_EDGE);
    result = 'jackpot';
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = 1.5 * (1 - HOUSE_EDGE);
    result = 'won';
  }

  const payout = multiplier > 0 ? Math.floor(stakeAmount * multiplier * 100) / 100 : 0;
  await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ?, total_lost = total_lost + ? WHERE user_id = ?', [stakeAmount, stakeAmount, req.userId]);
  if (payout > 0) await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, req.userId]);

  await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, server_seed, client_seed, nonce) VALUES (?, 'slots', ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, stakeAmount, multiplier, payout, result, JSON.stringify({ reels }), serverSeed, cSeed, nonce]);

  res.json({ reels, multiplier, payout, result, stake: stakeAmount, newBalance: (bal.usd_balance - stakeAmount + payout) });
});

// ===== CASTLE CRASH =====
function generateCrashPoint(serverSeed, clientSeed, nonce) {
  const roll = provablyFairResult(serverSeed, clientSeed, nonce);
  if (roll < HOUSE_EDGE) return 1.00;
  const crash = 1 / (1 - roll);
  return Math.min(crash, 100);
}

app.post('/api/arcade/castle-crash/start', authenticateRequest, async (req, res) => {
  const { stake, clientSeed } = req.body;
  const stakeAmount = parseFloat(stake);
  if (isNaN(stakeAmount) || stakeAmount < WEB_MIN_STAKE) return res.status(400).json({ error: `Minimum stake is $${WEB_MIN_STAKE}` });

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  if (!bal || bal.usd_balance < stakeAmount) return res.status(400).json({ error: 'Insufficient USD balance' });

  const serverSeed = generateServerSeed();
  const cSeed = clientSeed || arcadeCrypto.randomBytes(8).toString('hex');
  const nonce = Date.now();
  const crashPoint = generateCrashPoint(serverSeed, cSeed, nonce);

  await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ? WHERE user_id = ?', [stakeAmount, req.userId]);

  res.json({ sessionId: nonce, stake: stakeAmount, crashPoint, newBalance: bal.usd_balance - stakeAmount });
});

app.post('/api/arcade/castle-crash/cashout', authenticateRequest, async (req, res) => {
  const { sessionId, multiplier, stake } = req.body;
  const stakeAmount = parseFloat(stake);
  const cashoutMult = parseFloat(multiplier);
  if (isNaN(stakeAmount) || isNaN(cashoutMult) || cashoutMult < 1) return res.status(400).json({ error: 'Invalid cashout' });

  const existing = await dbGet('SELECT id FROM game_bets WHERE user_id = ? AND game_type = ? AND nonce = ? AND result = ?', [req.userId, 'castle_crash', sessionId, 'cashed_out']);
  if (existing) return res.status(400).json({ error: 'Already cashed out' });

  const payout = Math.floor(stakeAmount * cashoutMult * 100) / 100;
  await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, req.userId]);
  await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, nonce) VALUES (?, 'castle_crash', ?, 'USD', ?, ?, 'cashed_out', ?, ?)`,
    [req.userId, stakeAmount, cashoutMult, payout, JSON.stringify({ cashoutMultiplier: cashoutMult }), sessionId]);

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  res.json({ cashedOut: true, multiplier: cashoutMult, payout, newBalance: bal?.usd_balance || 0 });
});

app.post('/api/arcade/castle-crash/crash', authenticateRequest, async (req, res) => {
  const { sessionId, stake, crashPoint, multiplierAtCrash } = req.body;
  const stakeAmount = parseFloat(stake);
  await dbRun('UPDATE user_balances SET total_lost = total_lost + ? WHERE user_id = ?', [stakeAmount, req.userId]);
  await dbRun(`INSERT INTO game_bets (user_id, game_type, stake_amount, stake_currency, multiplier, payout, result, game_data, nonce) VALUES (?, 'castle_crash', ?, 'USD', 0, 0, 'crashed', ?, ?)`,
    [req.userId, stakeAmount, JSON.stringify({ crashPoint, multiplierAtCrash }), sessionId]);

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  res.json({ crashed: true, newBalance: bal?.usd_balance || 0 });
});

// ===== PREDICTION MARKETS =====
app.get('/api/predictions', async (req, res) => {
  const markets = await dbAll('SELECT * FROM prediction_markets WHERE status = ? ORDER BY created_at DESC', ['open']);
  res.json(markets.map(m => ({ ...m, options: JSON.parse(m.options_json) })));
});

app.post('/api/predictions/:id/bet', authenticateRequest, async (req, res) => {
  const { chosen_option, stake } = req.body;
  const stakeAmount = parseFloat(stake);
  if (!chosen_option) return res.status(400).json({ error: 'Choose an option' });
  if (isNaN(stakeAmount) || stakeAmount < WEB_MIN_STAKE) return res.status(400).json({ error: `Minimum stake is $${WEB_MIN_STAKE}` });

  const market = await dbGet('SELECT * FROM prediction_markets WHERE id = ? AND status = ?', [req.params.id, 'open']);
  if (!market) return res.status(404).json({ error: 'Market not found or closed' });

  const options = JSON.parse(market.options_json);
  if (!options.includes(chosen_option)) return res.status(400).json({ error: 'Invalid option' });

  const bal = await dbGet('SELECT usd_balance FROM user_balances WHERE user_id = ?', [req.userId]);
  if (!bal || bal.usd_balance < stakeAmount) return res.status(400).json({ error: 'Insufficient USD balance' });

  await dbRun('UPDATE user_balances SET usd_balance = usd_balance - ? WHERE user_id = ?', [stakeAmount, req.userId]);
  await dbRun(`INSERT INTO prediction_bets (user_id, market_id, chosen_option, stake_amount, stake_currency) VALUES (?, ?, ?, ?, 'USD')`, [req.userId, market.id, chosen_option, stakeAmount]);

  res.json({ message: 'Bet placed', market: market.title, chosen_option, stake: stakeAmount });
});

app.get('/api/predictions/my-bets', authenticateRequest, async (req, res) => {
  const bets = await dbAll(`SELECT pb.*, pm.title as market_title, pm.status as market_status, pm.resolved_option FROM prediction_bets pb JOIN prediction_markets pm ON pb.market_id = pm.id WHERE pb.user_id = ? ORDER BY pb.created_at DESC`, [req.userId]);
  res.json(bets);
});

// API: Admin create prediction market
app.post('/api/admin/prediction-market', authenticateRequest, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { title, description, options, source_url, category, resolves_at } = req.body;
  if (!title || !options || !Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'title and options (array, min 2) required' });

  await dbRun(`INSERT INTO prediction_markets (title, description, options_json, source_url, category, resolves_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description || '', JSON.stringify(options), source_url || '', category || 'anime', resolves_at || null]);

  logSystemEvent('info', `Prediction market created`, `Title: ${title}, Options: ${options.join(', ')}`);
  res.json({ message: 'Market created' });
});

// API: Admin resolve prediction market
app.post('/api/admin/prediction-market/:id/resolve', authenticateRequest, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { resolved_option } = req.body;
  const market = await dbGet('SELECT * FROM prediction_markets WHERE id = ?', [req.params.id]);
  if (!market) return res.status(404).json({ error: 'Market not found' });

  const options = JSON.parse(market.options_json);
  if (!options.includes(resolved_option)) return res.status(400).json({ error: 'Invalid option' });

  await dbRun('UPDATE prediction_markets SET status = ?, resolved_option = ? WHERE id = ?', ['resolved', resolved_option, market.id]);

  // Payout winners — split pool proportionally
  const allBets = await dbAll('SELECT * FROM prediction_bets WHERE market_id = ? AND status = ?', [market.id, 'pending']);
  const winningBets = allBets.filter(b => b.chosen_option === resolved_option);
  const losingBets = allBets.filter(b => b.chosen_option !== resolved_option);
  const totalPool = allBets.reduce((sum, b) => sum + b.stake_amount, 0);
  const winningPool = winningBets.reduce((sum, b) => sum + b.stake_amount, 0);
  const houseCut = totalPool * HOUSE_EDGE;

  for (const bet of losingBets) {
    await dbRun('UPDATE prediction_bets SET status = ?, payout = 0 WHERE id = ?', ['lost', bet.id]);
  }
  for (const bet of winningBets) {
    const share = winningPool > 0 ? bet.stake_amount / winningPool : 0;
    const payout = Math.floor((totalPool - houseCut) * share * 100) / 100;
    await dbRun('UPDATE prediction_bets SET status = ?, payout = ? WHERE id = ?', ['won', payout, bet.id]);
    await dbRun('UPDATE user_balances SET usd_balance = usd_balance + ?, total_won = total_won + ? WHERE user_id = ?', [payout, payout, bet.user_id]);
  }

  logSystemEvent('info', `Prediction market resolved`, `Market: ${market.title}, Winner: ${resolved_option}`);
  res.json({ message: 'Market resolved', winners: winningBets.length, losers: losingBets.length });
});

// ============================================================
// REPUTATION & PENALTY SYSTEM
// ============================================================

async function ensureReputationRow(userId) {
  const existing = await dbGet('SELECT * FROM user_reputation WHERE user_id = ?', [userId]);
  if (existing) return existing;
  await dbRun('INSERT INTO user_reputation (user_id) VALUES (?)', [userId]);
  return await dbGet('SELECT * FROM user_reputation WHERE user_id = ?', [userId]);
}

async function recordDispute(userId, tradeId, reason) {
  const rep = await ensureReputationRow(userId);
  const newDisputeCount = rep.disputed_trades + 1;
  await dbRun('UPDATE user_reputation SET disputed_trades = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [newDisputeCount, userId]);

  // Record penalty entry
  await dbRun('INSERT INTO user_penalties (user_id, penalty_type, reason, dispute_trade_id) VALUES (?, ?, ?, ?)',
    [userId, 'dispute', reason || 'Trade dispute', tradeId]);

  // Auto-penalty: 3 disputes = 7-day ban, 5 disputes = permanent ban
  await checkAutoPenalty(userId, newDisputeCount);
}

async function recordCompletedTrade(userId) {
  const rep = await ensureReputationRow(userId);
  const newCompleted = rep.completed_trades + 1;
  const newTotal = rep.total_trades + 1;
  // Trust score: +10 per completed, -15 per dispute
  const newScore = newCompleted * 10 - rep.disputed_trades * 15;
  // Auto-trusted: 5+ completed trades, 0 disputes, trust_score >= 50
  const shouldTrust = newCompleted >= 5 && rep.disputed_trades === 0 && newScore >= 50;
  await dbRun('UPDATE user_reputation SET completed_trades = ?, total_trades = ?, trust_score = ?, is_trusted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [newCompleted, newTotal, newScore, shouldTrust ? 1 : 0, userId]);
}

async function checkAutoPenalty(userId, disputeCount) {
  if (disputeCount >= 5) {
    // Permanent ban
    await dbRun('UPDATE user_reputation SET is_banned = 1, ban_until = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      ['9999-12-31 23:59:59', userId]);
    await dbRun('INSERT INTO user_penalties (user_id, penalty_type, reason, ban_days) VALUES (?, ?, ?, ?)',
      [userId, 'permanent_ban', 'Automatic: 5+ trade disputes — flagged for scamming', 99999]);
    logSystemEvent('warning', `User permanently banned (auto)`, `User ID: ${userId}, Disputes: ${disputeCount}`);
  } else if (disputeCount >= 3) {
    // 7-day ban
    const banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await dbRun('UPDATE user_reputation SET is_banned = 1, ban_until = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [banUntil, userId]);
    await dbRun('INSERT INTO user_penalties (user_id, penalty_type, reason, ban_days, expires_at) VALUES (?, ?, ?, ?, ?)',
      [userId, 'temp_ban', `Automatic: ${disputeCount} trade disputes — 7-day ban`, 7, banUntil]);
    logSystemEvent('warning', `User temp-banned 7 days (auto)`, `User ID: ${userId}, Disputes: ${disputeCount}`);
  } else if (disputeCount >= 1) {
    // Flag as suspect
    await dbRun('UPDATE user_reputation SET is_flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [`${disputeCount} dispute(s) on record`, userId]);
  }
}

async function isUserBanned(userId) {
  const rep = await ensureReputationRow(userId);
  if (!rep.is_banned) return false;
  if (rep.ban_until && new Date(rep.ban_until) > new Date('9999-01-01')) return true; // permanent
  if (rep.ban_until && new Date(rep.ban_until) > new Date()) return true; // still active
  // Ban expired — lift it
  await dbRun('UPDATE user_reputation SET is_banned = 0, ban_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
  return false;
}

// API: Get a user's reputation (public — visible to other users)
app.get('/api/user/:id/reputation', async (req, res) => {
  const rep = await ensureReputationRow(req.params.id);
  const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.params.id]);
  res.json({
    username: user?.username || 'Unknown',
    total_trades: rep.total_trades,
    completed_trades: rep.completed_trades,
    disputed_trades: rep.disputed_trades,
    trust_score: rep.trust_score,
    is_trusted: !!rep.is_trusted,
    is_flagged: !!rep.is_flagged,
    flag_reason: rep.flag_reason || '',
    is_banned: !!rep.is_banned,
    badges: getReputationBadges(rep)
  });
});

function getReputationBadges(rep) {
  const badges = [];
  if (rep.is_banned) {
    badges.push({ icon: '🚫', label: 'BANNED', color: '#f44336', tooltip: rep.ban_until && new Date(rep.ban_until) > new Date('9999-01-01') ? 'Permanently banned for scamming' : 'Temporarily banned due to disputes' });
  }
  if (rep.is_flagged && !rep.is_banned) {
    badges.push({ icon: '⚠️', label: 'FLAGGED', color: '#ff9800', tooltip: rep.flag_reason || 'Flagged for suspicious activity' });
  }
  if (rep.is_trusted) {
    badges.push({ icon: '✅', label: 'TRUSTED', color: '#4caf50', tooltip: `Honest trader — ${rep.completed_trades} completed trades, 0 disputes` });
  }
  if (rep.completed_trades >= 10 && !rep.is_banned) {
    badges.push({ icon: '🏆', label: 'TOP TRADER', color: '#ffc107', tooltip: `${rep.completed_trades} completed trades — experienced trader` });
  }
  if (badges.length === 0 && rep.total_trades === 0) {
    badges.push({ icon: '🆕', label: 'NEW', color: '#2196f3', tooltip: 'New trader — no trade history yet' });
  }
  return badges;
}

// API: Admin flag a user manually
app.post('/api/admin/flag-user', authenticateRequest, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { user_id, flag_reason } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  await ensureReputationRow(user_id);
  await dbRun('UPDATE user_reputation SET is_flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [flag_reason || 'Flagged by admin', user_id]);
  await dbRun('INSERT INTO user_penalties (user_id, penalty_type, reason) VALUES (?, ?, ?)',
    [user_id, 'admin_flag', flag_reason || 'Flagged by admin']);

  logSystemEvent('warning', `User flagged by admin`, `User ID: ${user_id}, Reason: ${flag_reason}`);
  res.json({ message: 'User flagged successfully' });
});

// API: Admin lift a ban or flag
app.post('/api/admin/lift-penalty', authenticateRequest, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  await dbRun('UPDATE user_reputation SET is_banned = 0, ban_until = NULL, is_flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [user_id]);
  await dbRun('UPDATE user_penalties SET lifted_at = CURRENT_TIMESTAMP, lifted_by = ? WHERE user_id = ? AND lifted_at IS NULL',
    [req.userId, user_id]);

  logSystemEvent('info', `Penalties lifted by admin`, `User ID: ${user_id}, Admin: ${req.userId}`);
  res.json({ message: 'Penalties lifted successfully' });
});

// API: Admin get all penalized users
app.get('/api/admin/penalized-users', authenticateRequest, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const users = await dbAll(`
    SELECT r.*, u.username, u.email
    FROM user_reputation r
    JOIN users u ON r.user_id = u.id
    WHERE r.is_banned = 1 OR r.is_flagged = 1 OR r.disputed_trades > 0
    ORDER BY r.disputed_trades DESC, r.updated_at DESC
  `);
  res.json(users);
});

// ============================================================
// WISHLIST SYSTEM
// ============================================================

// API: Add item to wishlist
app.post('/api/wishlist/add', authenticateRequest, async (req, res) => {
  const { trade_type, trade_id, item_title, game_type, price_display, notes } = req.body;
  if (!trade_type || !item_title) {
    return res.status(400).json({ error: 'trade_type and item_title are required' });
  }

  // Check if already wishlisted
  const existing = await dbGet('SELECT id FROM wishlists WHERE user_id = ? AND trade_type = ? AND trade_id = ?',
    [req.userId, trade_type, trade_id || 0]);
  if (existing) {
    return res.status(409).json({ error: 'Already in your wishlist', wishlistId: existing.id });
  }

  const result = await dbRun(`
    INSERT INTO wishlists (user_id, trade_type, trade_id, item_title, game_type, price_display, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [req.userId, trade_type, trade_id || null, item_title, game_type || '', price_display || '', notes || '']);

  res.json({ id: result.lastID, message: 'Added to wishlist' });
});

// API: Remove item from wishlist
app.delete('/api/wishlist/:id', authenticateRequest, async (req, res) => {
  const item = await dbGet('SELECT * FROM wishlists WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });

  await dbRun('DELETE FROM wishlists WHERE id = ?', [req.params.id]);
  res.json({ message: 'Removed from wishlist' });
});

// API: Get user's wishlist
app.get('/api/wishlist', authenticateRequest, async (req, res) => {
  const items = await dbAll(`
    SELECT * FROM wishlists WHERE user_id = ? ORDER BY created_at DESC
  `, [req.userId]);
  res.json(items);
});

// API: Check if specific items are wishlisted (for rendering buttons)
app.get('/api/wishlist/check', authenticateRequest, async (req, res) => {
  const items = await dbAll('SELECT trade_type, trade_id FROM wishlists WHERE user_id = ?', [req.userId]);
  const wishlisted = {};
  for (const item of items) {
    const key = `${item.trade_type}:${item.trade_id || 0}`;
    wishlisted[key] = true;
  }
  res.json({ wishlisted });
});

// ============================================================
// STEAM BOT API ENDPOINTS (called by steam-bot.js)
// ============================================================

// API: Check if a trade offer is associated with an escrow trade
// SECURITY: Only matches a trade whose linked seller's Steam ID equals the offer sender,
// requires the offer to be giving exactly the expected number of items and nothing to the bot,
// and atomically claims the trade (steam_trade_offer_id IS NULL) to prevent double-matching/race abuse.
app.post('/api/steam/check-offer', async (req, res) => {
  const { offerId, senderSteamId, itemsToReceiveCount, itemsToGiveCount } = req.body;
  
  if (!offerId || !senderSteamId) {
    return res.json({ escrowTrade: null, reason: 'Missing offerId or senderSteamId' });
  }
  
  // Reject if the sender is asking the bot to give anything away, or isn't sending exactly 1 item
  if (Number(itemsToGiveCount) !== 0) {
    logSystemEvent('warn', 'Rejected Steam offer', `Offer ${offerId} from ${senderSteamId} requested items back from bot`);
    return res.json({ escrowTrade: null, reason: 'Offer requests items from bot' });
  }
  if (Number(itemsToReceiveCount) !== 1) {
    logSystemEvent('warn', 'Rejected Steam offer', `Offer ${offerId} from ${senderSteamId} had ${itemsToReceiveCount} items, expected 1`);
    return res.json({ escrowTrade: null, reason: 'Unexpected item count' });
  }
  
  const candidate = await dbGet(`
    SELECT et.*, s.skin_name, sa.steam_id as seller_steam_id
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    JOIN steam_accounts sa ON et.seller_id = sa.user_id
    WHERE et.status = 'pending'
      AND et.trade_type = 'steam_bot'
      AND et.steam_trade_offer_id IS NULL
      AND sa.steam_id = ?
    ORDER BY et.created_at ASC
    LIMIT 1
  `, [senderSteamId]);
  
  if (!candidate) {
    logSystemEvent('warn', 'Rejected Steam offer', `Offer ${offerId} from ${senderSteamId} matched no pending escrow trade for that seller`);
    return res.json({ escrowTrade: null, reason: 'No matching pending trade for this seller' });
  }
  
  // Atomic claim: only succeeds if still unclaimed, prevents race conditions from concurrent offers
  const claim = await dbRun(
    `UPDATE escrow_trades SET steam_trade_offer_id = ? WHERE id = ? AND steam_trade_offer_id IS NULL`,
    [offerId, candidate.id]
  );
  if (!claim.changes) {
    return res.json({ escrowTrade: null, reason: 'Trade already claimed by another offer' });
  }
  
  res.json({ escrowTrade: candidate });
});

// API: Get buyer trade URL for an escrow trade
app.get('/api/steam/buyer-trade-url', async (req, res) => {
  const { escrowId } = req.query;
  
  const buyerSteam = await dbGet(`
    SELECT trade_url FROM steam_accounts WHERE user_id = (
      SELECT buyer_id FROM escrow_trades WHERE id = ?
    )
  `, [escrowId]);
  
  if (!buyerSteam) {
    return res.json({ tradeUrl: null });
  }
  
  res.json({ tradeUrl: buyerSteam.trade_url });
});

// API: Notify server that offer was accepted
app.post('/api/steam/offer-accepted', async (req, res) => {
  const { offerId, escrowId } = req.body;
  
  await dbRun(`
    UPDATE escrow_trades 
    SET status = 'seller_sent', seller_confirmed = 1, seller_confirm_at = CURRENT_TIMESTAMP, steam_trade_offer_id = ?
    WHERE id = ?
  `, [offerId, escrowId]);
  
  logSystemEvent('info', `Steam offer accepted`, `Offer ID: ${offerId}, Escrow ID: ${escrowId}`);
  res.json({ success: true });
});

// API: Notify server that offer was sent to buyer
app.post('/api/steam/offer-sent', async (req, res) => {
  const { offerId, escrowId } = req.body;
  
  await dbRun('UPDATE escrow_trades SET steam_trade_offer_id = ? WHERE id = ?', [offerId, escrowId]);
  
  logSystemEvent('info', `Steam offer sent to buyer`, `Offer ID: ${offerId}, Escrow ID: ${escrowId}`);
  res.json({ success: true });
});

// API: Notify server of offer status change
app.post('/api/steam/offer-status', async (req, res) => {
  const { offerId, state } = req.body;
  
  const escrowTrade = await dbGet('SELECT * FROM escrow_trades WHERE steam_trade_offer_id = ?', [offerId]);
  if (!escrowTrade) {
    return res.json({ success: false });
  }
  
  // SteamTradeOfferManager.ETradeOfferState values: 3=Accepted, 6=Canceled, 7=Declined, 8=InvalidItems
  if (state === 3) { // Accepted
    logSystemEvent('info', `Buyer accepted Steam offer`, `Offer ID: ${offerId}`);
  } else if (state === 7) { // Declined
    await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?',
      ['disputed', 'Buyer declined the trade offer', escrowTrade.id]);
  } else if (state === 6) { // Canceled
    await dbRun('UPDATE escrow_trades SET status = ? WHERE id = ?', ['cancelled', escrowTrade.id]);
  } else if (state === 8) { // InvalidItems
    await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?',
      ['disputed', 'Trade offer items became invalid', escrowTrade.id]);
  }
  
  res.json({ success: true });
});

// API: Notify server of offer error
app.post('/api/steam/offer-error', async (req, res) => {
  const { offerId, error } = req.body;
  
  const escrowTrade = await dbGet('SELECT * FROM escrow_trades WHERE steam_trade_offer_id = ?', [offerId]);
  if (escrowTrade) {
    await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?',
      ['disputed', `Steam offer error: ${error}`, escrowTrade.id]);
  }
  
  logSystemEvent('error', `Steam offer error`, `Offer ID: ${offerId}, Error: ${error}`);
  res.json({ success: true });
});

// API: Notify server of escrow error
app.post('/api/steam/escrow-error', async (req, res) => {
  const { escrowId, error } = req.body;
  
  await dbRun('UPDATE escrow_trades SET status = ?, dispute_reason = ? WHERE id = ?',
    ['disputed', error, escrowId]);
  
  logSystemEvent('error', `Steam escrow error`, `Escrow ID: ${escrowId}, Error: ${error}`);
  res.json({ success: true });
});

// API: Get pending trades for bot polling
app.get('/api/steam/pending-trades', async (req, res) => {
  const trades = await dbAll(`
    SELECT et.*, s.skin_name, sa.trade_url as seller_trade_url, ba.trade_url as buyer_trade_url
    FROM escrow_trades et
    JOIN skins s ON et.skin_id = s.id
    LEFT JOIN steam_accounts sa ON et.seller_id = sa.user_id
    LEFT JOIN steam_accounts ba ON et.buyer_id = ba.user_id
    WHERE et.status = 'pending' AND et.trade_type = 'steam_bot'
  `);
  
  res.json(trades);
});

// API: BTCPay webhook handler
app.post('/webhook/btcpay', async (req, res) => {
  try {
    const { type, invoiceId } = req.body;
    
    if (type === 'InvoiceSettled') {
      // Get transaction by invoice ID
      const transaction = await dbGet('SELECT * FROM transactions WHERE tx_hash = ?', [invoiceId]);
      
      if (transaction && transaction.status === 'pending') {
        // Update transaction status
        await dbRun('UPDATE transactions SET status = ? WHERE id = ?', ['completed', transaction.id]);
        
        // Update user balance
        await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?',
          [transaction.amount, transaction.amount, transaction.user_id]);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// API: Resolve market (admin only)
app.post('/api/betting/markets/:id/resolve', async (req, res) => {
  const { resolution } = req.body;
  const marketId = req.params.id;
  
  // Update market status
  await dbRun('UPDATE betting_markets SET status = ?, resolution = ? WHERE id = ?', ['resolved', resolution, marketId]);
  
  // Process winning bets
  const winningBets = await dbAll('SELECT * FROM user_bets WHERE market_id = ? AND option = ? AND status = ?', [marketId, resolution, 'pending']);
  
  for (const bet of winningBets) {
    // Calculate payout (simplified - in production use proper parimutuel)
    const payout = bet.potential_payout;
    
    // Update user balance
    await dbRun('UPDATE user_balances SET btc_balance = btc_balance + ?, total_won = total_won + ? WHERE user_id = ?',
      [payout, payout, bet.user_id]);
    
    // Update bet status
    await dbRun('UPDATE user_bets SET status = ? WHERE id = ?', ['won', bet.id]);
    
    // Record win transaction
    await dbRun('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)',
      [bet.user_id, 'win', payout, 'completed']);
  }
  
  // Update losing bets
  await dbRun('UPDATE user_bets SET status = ? WHERE market_id = ? AND option != ? AND status = ?',
    ['lost', marketId, resolution, 'pending']);
  
  res.json({ success: true, winningBets: winningBets.length });
});

// ANALYTICS API ENDPOINTS

// API: Get news data
app.get('/api/analytics/news', (req, res) => {
  // Sample news data - in production, fetch from actual sources
  const news = [
    {
      title: 'One Piece Final Saga Announced',
      description: 'Eiichiro Oda confirms the final saga will begin next month with major revelations.',
      source: 'Crunchyroll News',
      date: new Date().toISOString(),
      category: 'announcements'
    },
    {
      title: 'Jujutsu Kaisen Season 3 Production Started',
      description: 'MAPPA confirms production has begun for the highly anticipated third season.',
      source: 'Anime Corner',
      date: new Date(Date.now() - 86400000).toISOString(),
      category: 'new adaptations'
    },
    {
      title: 'Demon Slayer Movie Breaks Records',
      description: 'The latest Demon Slayer movie has broken box office records in its opening weekend.',
      source: 'Anime News Network',
      date: new Date(Date.now() - 172800000).toISOString(),
      category: 'industry news'
    },
    {
      title: 'Attack on Titan Final Season Delayed',
      description: 'The final part of Attack on Titan has been delayed due to production issues.',
      source: 'MyAnimeList',
      date: new Date(Date.now() - 259200000).toISOString(),
      category: 'delays'
    }
  ];
  res.json(news);
});

// API: Get popularity metrics
app.get('/api/analytics/popularity', (req, res) => {
  // Sample popularity data - in production, fetch from MAL, AniList, etc.
  const popularity = [
    { title: 'One Piece', source: 'MAL', score: 9.2, change: 5.2 },
    { title: 'Jujutsu Kaisen', source: 'AniList', score: 8.9, change: 3.1 },
    { title: 'Demon Slayer', source: 'Anime Trending', score: 8.7, change: -1.2 },
    { title: 'Attack on Titan', source: 'MAL', score: 8.5, change: 2.8 },
    { title: 'Chainsaw Man', source: 'AniList', score: 8.4, change: 4.5 }
  ];
  res.json(popularity);
});

// API: Get ratings data
app.get('/api/analytics/ratings', (req, res) => {
  // Sample ratings data - in production, fetch from MAL, AniList, Kitsu
  const ratings = [
    { title: 'Fullmetal Alchemist: Brotherhood', mal_score: 9.1, anilist_score: 9.0, kitsu_score: 4.8 },
    { title: 'One Piece', mal_score: 8.9, anilist_score: 8.8, kitsu_score: 4.7 },
    { title: 'Steins;Gate', mal_score: 9.1, anilist_score: 8.9, kitsu_score: 4.8 },
    { title: 'Hunter x Hunter', mal_score: 9.0, anilist_score: 8.9, kitsu_score: 4.7 },
    { title: 'Gintama', mal_score: 9.0, anilist_score: 8.8, kitsu_score: 4.6 }
  ];
  res.json(ratings);
});

// API: Get release data
app.get('/api/analytics/releases', (req, res) => {
  // Sample release data - in production, fetch from official sources
  const releases = [
    { title: 'Solo Leveling Season 2', type: 'TV Series', release_date: new Date(Date.now() + 604800000).toISOString(), status: 'Coming Soon' },
    { title: 'Chainsaw Man Movie', type: 'Movie', release_date: new Date(Date.now() + 1209600000).toISOString(), status: 'In Production' },
    { title: 'Spy x Family Season 3', type: 'TV Series', release_date: new Date(Date.now() + 2592000000).toISOString(), status: 'Announced' },
    { title: 'Bleach: TYBW Part 3', type: 'TV Series', release_date: new Date(Date.now() + 5184000000).toISOString(), status: 'In Production' }
  ];
  res.json(releases);
});

// API: Get community signals
app.get('/api/analytics/community', (req, res) => {
  // Sample community data - in production, fetch from Reddit, social media
  const community = [
    { title: 'One Piece Chapter 1100', source: 'Reddit', discussions: 15420, mentions: 89300, trend_score: 95 },
    { title: 'Jujutsu Kaisen Chapter 250', source: 'Twitter/X', discussions: 12300, mentions: 67800, trend_score: 88 },
    { title: 'Demon Slayer Season 4', source: 'Reddit', discussions: 9800, mentions: 54200, trend_score: 82 },
    { title: 'Attack on Titan Finale', source: 'Twitter/X', discussions: 8900, mentions: 48900, trend_score: 79 },
    { title: 'Chainsaw Man Movie', source: 'Reddit', discussions: 7600, mentions: 41200, trend_score: 75 }
  ];
  res.json(community);
});

// API: Get platform analytics
app.get('/api/analytics', async (req, res) => {
  const totalUsers = (await dbGet('SELECT COUNT(*) as count FROM users')).count;
  const totalAnime = (await dbGet('SELECT COUNT(*) as count FROM anime')).count;
  const totalEpisodes = (await dbGet('SELECT COUNT(*) as count FROM episodes')).count;
  const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
  const totalMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets')).count;
  const totalBets = (await dbGet('SELECT COUNT(*) as count FROM user_bets')).count;
  const totalVolume = (await dbGet('SELECT SUM(total_volume) as volume FROM betting_markets')).volume || 0;
  const totalFees = (await dbGet('SELECT SUM(amount * fee_rate) as fees FROM betting_markets')).fees || 0;
  const totalDeposits = (await dbGet('SELECT SUM(amount) as deposits FROM transactions WHERE type = ? AND status = ?', ['deposit', 'completed'])).deposits || 0;
  const totalWithdrawals = (await dbGet('SELECT SUM(amount) as withdrawals FROM transactions WHERE type = ? AND status = ?', ['withdraw', 'completed'])).withdrawals || 0;
  
  const recentBets = await dbAll(`
    SELECT ub.*, bm.title as market_title, u.username
    FROM user_bets ub
    JOIN betting_markets bm ON ub.market_id = bm.id
    JOIN users u ON ub.user_id = u.id
    ORDER BY ub.created_at DESC
    LIMIT 10
  `);
  
  const topMarkets = await dbAll(`
    SELECT *, (SELECT COUNT(*) FROM user_bets WHERE market_id = betting_markets.id) as bet_count
    FROM betting_markets
    ORDER BY total_volume DESC
    LIMIT 5
  `);
  
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
app.get('/api/analytics/markets/:id', async (req, res) => {
  const marketId = req.params.id;
  
  const market = await dbGet('SELECT * FROM betting_markets WHERE id = ?', [marketId]);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const totalBets = (await dbGet('SELECT COUNT(*) as count FROM user_bets WHERE market_id = ?', [marketId])).count;
  const totalVolume = (await dbGet('SELECT SUM(amount) as volume FROM user_bets WHERE market_id = ?', [marketId])).volume || 0;
  
  const betsByOption = await dbAll(`
    SELECT option, COUNT(*) as count, SUM(amount) as volume
    FROM user_bets
    WHERE market_id = ?
    GROUP BY option
  `, [marketId]);
  
  const recentBets = await dbAll(`
    SELECT ub.*, u.username
    FROM user_bets ub
    JOIN users u ON ub.user_id = u.id
    WHERE ub.market_id = ?
    ORDER BY ub.created_at DESC
    LIMIT 10
  `, [marketId]);
  
  res.json({
    market,
    totalBets,
    totalVolume,
    betsByOption,
    recentBets
  });
});

// API: Check subscription status
app.get('/api/subscription/:telegramId', async (req, res) => {
  const user = await dbGet('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
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
    
    let user = await dbGet('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    if (!user) {
      const result = await dbRun('INSERT INTO users (telegram_id, username, subscription_status) VALUES (?, ?, ?)', [telegramId, 'user', 'free']);
      user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
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
      
      await dbRun(`
        UPDATE users 
        SET subscription_status = 'premium', subscription_end_date = ?
        WHERE telegram_id = ?
      `, [endDate.toISOString(), telegram_id]);
      
      const userId = (await dbGet('SELECT id FROM users WHERE telegram_id = ?', [telegram_id])).id;
      
      await dbRun(`
        INSERT INTO subscriptions (user_id, plan_type, amount_cents, status, start_date, end_date, stripe_subscription_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, plan, payment.amount, 'active', new Date().toISOString(), endDate.toISOString(), payment_id]);
      
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
app.post('/api/seed', async (req, res) => {
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

  for (const anime of sampleAnime) {
    const existing = await dbGet('SELECT * FROM anime WHERE title = ?', [anime.title]);
    if (!existing) {
      const result = await dbRun(`
        INSERT INTO anime (title, description, cover_image, genre, year, rating, free_tier)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [anime.title, anime.description, anime.cover_image, anime.genre, anime.year, anime.rating, anime.free_tier]);
      
      for (let i = 1; i <= 3; i++) {
        await dbRun(`
          INSERT INTO episodes (anime_id, episode_number, title, video_url, duration)
          VALUES (?, ?, ?, ?, ?)
        `, [result.lastID, i, `Episode ${i}`, `https://example.com/video${i}.mp4`, 1440]);
      }
    }
  }

  res.json({ message: 'Sample data added successfully' });
});

// BTC PAYOUT SYSTEM

// Sweep accumulated fees to wallet
async function sweepFeesToWallet() {
  const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
  if (!pool || pool.accumulated_btc < 0.001) {
    console.log('Fee sweep: Not enough accumulated BTC (minimum 0.001)');
    return;
  }
  
  const sweepAmount = pool.accumulated_btc;
  const walletAddress = pool.wallet_address || process.env.BTC_WALLET_ADDRESS;
  
  const result = await dbRun(`
    INSERT INTO payout_history (amount_btc, wallet_address, status)
    VALUES (?, ?, 'pending')
  `, [sweepAmount, walletAddress]);
  
  logSystemEvent('info', `BTC payout initiated`, `Amount: ${sweepAmount} BTC to ${walletAddress}. Payout ID: ${result.lastID}`);
  
  console.log(`BTC PAYOUT: ${sweepAmount} BTC queued for sweep to ${walletAddress}`);
  
  await dbRun('UPDATE platform_fee_pool SET accumulated_btc = 0, total_swept_btc = total_swept_btc + ?, last_sweep_at = CURRENT_TIMESTAMP WHERE id = 1', [sweepAmount]);
}

// API: Get platform fee pool status
app.get('/api/admin/fee-pool', checkAdminSession, async (req, res) => {
  const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
  const payouts = await dbAll('SELECT * FROM payout_history ORDER BY created_at DESC LIMIT 20');
  
  res.json({
    pool: pool || { accumulated_btc: 0, total_swept_btc: 0, wallet_address: process.env.BTC_WALLET_ADDRESS },
    recentPayouts: payouts
  });
});

// API: Manual trigger fee sweep
app.post('/api/admin/sweep-fees', checkAdminSession, async (req, res) => {
  const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
  if (!pool || pool.accumulated_btc <= 0) {
    return res.json({ message: 'No fees to sweep' });
  }
  
  sweepFeesToWallet()
    .then(() => res.json({ message: 'Fee sweep initiated', amount: pool.accumulated_btc }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// API: Confirm payout (mark as confirmed with tx hash)
app.post('/api/admin/confirm-payout', checkAdminSession, async (req, res) => {
  const { payoutId, txHash } = req.body;
  
  if (!payoutId || !txHash) {
    return res.status(400).json({ error: 'Payout ID and transaction hash required' });
  }
  
  await dbRun('UPDATE payout_history SET status = ?, tx_hash = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?', ['confirmed', txHash, payoutId]);
  
  logSystemEvent('info', `BTC payout confirmed`, `Payout ID: ${payoutId}, TX: ${txHash}`);
  
  res.json({ message: 'Payout confirmed successfully' });
});

// API: Get pending token conversion payouts (admin) - see /api/convert
app.get('/api/admin/token-conversions', checkAdminSession, async (req, res) => {
  const conversions = await dbAll(`
    SELECT tc.*, u.username
    FROM token_conversions tc
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.status = 'pending_payout'
    ORDER BY tc.created_at ASC
  `);
  res.json(conversions);
});

// API: Confirm a token conversion payout (mark as paid with tx hash)
app.post('/api/admin/confirm-conversion-payout', checkAdminSession, async (req, res) => {
  const { conversionId, txHash } = req.body;
  
  if (!conversionId || !txHash) {
    return res.status(400).json({ error: 'Conversion ID and transaction hash required' });
  }
  
  const conversion = await dbGet('SELECT * FROM token_conversions WHERE id = ?', [conversionId]);
  if (!conversion) return res.status(404).json({ error: 'Conversion not found' });
  if (conversion.status !== 'pending_payout') return res.status(400).json({ error: 'Conversion already processed' });
  
  await dbRun('UPDATE token_conversions SET status = ?, tx_hash = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?', ['paid', txHash, conversionId]);
  
  logSystemEvent('info', `Token conversion payout confirmed`, `Conversion ID: ${conversionId}, TX: ${txHash}`);
  
  res.json({ message: 'Conversion payout confirmed successfully' });
});

// ============================================================
// REFERRAL AGENT MANAGEMENT (Admin)
// ============================================================

// API: Create a referral agent
app.post('/api/admin/referrals/agents', checkAdminSession, async (req, res) => {
  const { agentName, agentEmail, commissionPercent, notes } = req.body;
  if (!agentName || String(agentName).trim().length < 2) {
    return res.status(400).json({ error: 'Agent name is required' });
  }
  const commission = parseFloat(commissionPercent) || 5;
  if (commission < 0 || commission > 50) {
    return res.status(400).json({ error: 'Commission must be between 0 and 50%' });
  }
  // Generate unique referral code
  const crypto = require('crypto');
  let code = '';
  let attempts = 0;
  while (attempts < 10) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existing = await dbGet('SELECT id FROM referral_agents WHERE referral_code = ?', [code]);
    if (!existing) break;
    attempts++;
  }
  const result = await dbRun(
    'INSERT INTO referral_agents (agent_name, agent_email, referral_code, commission_percent, notes) VALUES (?, ?, ?, ?, ?)',
    [String(agentName).trim(), agentEmail ? String(agentEmail).trim().toLowerCase() : null, code, commission, notes || null]
  );
  logSystemEvent('info', `Referral agent created`, `Agent: ${agentName}, Code: ${code}, Commission: ${commission}%`);
  res.json({ id: result.lastID, referralCode: code, message: 'Referral agent created successfully' });
});

// API: List all referral agents with stats
app.get('/api/admin/referrals/agents', checkAdminSession, async (req, res) => {
  const agents = await dbAll(`
    SELECT a.*,
      (SELECT COUNT(*) FROM referral_tracking t WHERE t.agent_id = a.id AND t.first_purchase_made = 1) as converted_referrals,
      (SELECT COUNT(*) FROM referral_tracking t WHERE t.agent_id = a.id AND t.first_purchase_made = 0) as pending_referrals
    FROM referral_agents a
    ORDER BY a.created_at DESC
  `);
  res.json(agents);
});

// API: Get agent details with referral list
app.get('/api/admin/referrals/agents/:id', checkAdminSession, async (req, res) => {
  const agentId = parseInt(req.params.id);
  const agent = await dbGet('SELECT * FROM referral_agents WHERE id = ?', [agentId]);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const referrals = await dbAll(`
    SELECT t.*, u.username, u.email, u.created_at as user_joined_at
    FROM referral_tracking t
    JOIN users u ON t.referred_user_id = u.id
    WHERE t.agent_id = ?
    ORDER BY t.created_at DESC
  `, [agentId]);

  const payouts = await dbAll('SELECT * FROM referral_payouts WHERE agent_id = ? ORDER BY created_at DESC', [agentId]);

  res.json({ agent, referrals, payouts });
});

// API: Update agent (commission, active status, notes)
app.put('/api/admin/referrals/agents/:id', checkAdminSession, async (req, res) => {
  const agentId = parseInt(req.params.id);
  const { commissionPercent, isActive, notes } = req.body;
  const agent = await dbGet('SELECT * FROM referral_agents WHERE id = ?', [agentId]);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const updates = [];
  const params = [];
  if (commissionPercent !== undefined) {
    const c = parseFloat(commissionPercent);
    if (c < 0 || c > 50) return res.status(400).json({ error: 'Commission must be between 0 and 50%' });
    updates.push('commission_percent = ?');
    params.push(c);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(agentId);
  await dbRun(`UPDATE referral_agents SET ${updates.join(', ')} WHERE id = ?`, params);
  logSystemEvent('info', `Referral agent updated`, `Agent ID: ${agentId}`);
  res.json({ message: 'Agent updated successfully' });
});

// API: Record a payout to an agent
app.post('/api/admin/referrals/agents/:id/payout', checkAdminSession, async (req, res) => {
  const agentId = parseInt(req.params.id);
  const { amountUsd, txHash, notes } = req.body;
  if (!amountUsd || parseFloat(amountUsd) <= 0) {
    return res.status(400).json({ error: 'Valid payout amount required' });
  }
  const agent = await dbGet('SELECT * FROM referral_agents WHERE id = ?', [agentId]);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const amt = parseFloat(amountUsd);
  const result = await dbRun(
    'INSERT INTO referral_payouts (agent_id, amount_usd, tx_hash, notes, status) VALUES (?, ?, ?, ?, ?)',
    [agentId, amt, txHash || null, notes || null, txHash ? 'confirmed' : 'pending']
  );

  if (txHash) {
    await dbRun('UPDATE referral_agents SET total_paid_out_usd = total_paid_out_usd + ? WHERE id = ?', [amt, agentId]);
  }

  logSystemEvent('info', `Referral payout recorded`, `Agent: ${agent.agent_name}, Amount: $${amt.toFixed(2)}, TX: ${txHash || 'pending'}`);
  res.json({ id: result.lastID, message: 'Payout recorded successfully' });
});

// API: Get referral overview stats
app.get('/api/admin/referrals/overview', checkAdminSession, async (req, res) => {
  const totalAgents = (await dbGet('SELECT COUNT(*) as count FROM referral_agents')).count;
  const activeAgents = (await dbGet('SELECT COUNT(*) as count FROM referral_agents WHERE is_active = 1')).count;
  const totalReferrals = (await dbGet('SELECT COUNT(*) as count FROM referral_tracking')).count;
  const convertedReferrals = (await dbGet('SELECT COUNT(*) as count FROM referral_tracking WHERE first_purchase_made = 1')).count;
  const totalCommission = (await dbGet('SELECT COALESCE(SUM(total_earned_usd), 0) as total FROM referral_agents')).total;
  const totalPaidOut = (await dbGet('SELECT COALESCE(SUM(total_paid_out_usd), 0) as total FROM referral_agents')).total;
  const pendingPayouts = (await dbGet('SELECT COALESCE(SUM(total_earned_usd - total_paid_out_usd), 0) as total FROM referral_agents')).total;

  res.json({
    totalAgents,
    activeAgents,
    totalReferrals,
    convertedReferrals,
    conversionRate: totalReferrals > 0 ? (convertedReferrals / totalReferrals * 100).toFixed(1) : 0,
    totalCommission,
    totalPaidOut,
    pendingPayouts
  });
});

// Start the HTTP server only after tables and default rates exist.
databaseInitialization.then(async () => {
  app.listen(PORT, () => {
    console.log(`PixelPulse server running on port ${PORT}`);
    console.log(`BTC wallet address: ${process.env.BTC_WALLET_ADDRESS}`);
  });
  
  const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
  if (!pool) {
    await dbRun('INSERT INTO platform_fee_pool (id, accumulated_btc, total_swept_btc, wallet_address) VALUES (1, 0, 0, ?)', [process.env.BTC_WALLET_ADDRESS]);
  } else if (pool.wallet_address !== process.env.BTC_WALLET_ADDRESS) {
    await dbRun('UPDATE platform_fee_pool SET wallet_address = ? WHERE id = 1', [process.env.BTC_WALLET_ADDRESS]);
  }
  
  // Schedule weekly BTC sweep to wallet
  const SWEEP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // Weekly
  setInterval(sweepFeesToWallet, SWEEP_INTERVAL);
  
  // Update crypto prices every 5 minutes
  setInterval(updateCryptoPrices, 5 * 60 * 1000);
  updateCryptoPrices(); // Initial update
}).catch(err => {
  console.error('Server startup aborted:', err);
  process.exit(1);
});

// TELEGRAM CHANNEL AUTO-UPDATE SYSTEM
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || null;

// Post message to Telegram channel
async function postToChannel(text, parseMode) {
  if (!TELEGRAM_CHANNEL_ID || !bot?.telegram) return;
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, text, parseMode ? { parse_mode: parseMode } : {});
    console.log('Posted update to Telegram channel');
  } catch (err) {
    console.error('Failed to post to channel:', err.message);
  }
}

// Post photo to Telegram channel
async function postPhotoToChannel(photoUrl, caption) {
  if (!TELEGRAM_CHANNEL_ID || !bot?.telegram) return;
  try {
    if (photoUrl) {
      await bot.telegram.sendPhoto(TELEGRAM_CHANNEL_ID, photoUrl, { caption: caption || '' });
    } else {
      await bot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, caption || '');
    }
    console.log('Posted photo update to Telegram channel');
  } catch (err) {
    console.error('Failed to post photo to channel:', err.message);
    // Fallback to text only
    if (caption) {
      try { await bot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, caption); } catch (e) {}
    }
  }
}

// --- Auto-update: New anime market created ---
async function notifyNewAnimeMarket(animeTitle, releaseDate, coverImage) {
  const msg = `🎬 NEW ANIME MARKET!\n\n📺 ${animeTitle}\n📅 Release: ${releaseDate || 'TBA'}\n\n🔮 Predict: Will it release on time or be delayed?\n🎮 Place your predictions now!\n\n🔗 https://pixelpulse.zentriva-clubsync.online`;
  await postPhotoToChannel(coverImage, msg);
}

// --- Auto-update: New esports market created ---
async function notifyNewEsportsMarket(matchTitle, league, game, scheduledAt) {
  const msg = `🎮 NEW ${game.toUpperCase()} MATCH!\n\n⚔️ ${matchTitle}\n🏆 ${league || 'Tournament'}\n⏰ ${scheduledAt ? new Date(scheduledAt).toLocaleString() : 'TBA'}\n\n🔮 Predict the winner now!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
  await postToChannel(msg);
}

// --- Auto-update: Market resolved with big win ---
async function notifyMarketResolved(marketTitle, winner, totalVolume, topPayout) {
  const msg = `🏁 MARKET RESOLVED!\n\n📊 ${marketTitle}\n🏆 Winner: ${winner}\n💰 Total Volume: ${totalVolume.toFixed(4)} BTC${topPayout ? `\n🤑 Biggest Win: ${topPayout.toFixed(4)} BTC` : ''}\n\n🎉 Congratulations to all winners!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
  await postToChannel(msg);
}

// --- Auto-update: Weekly big wins summary ---
async function postWeeklyBigWins() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const bigWins = await dbAll(`
      SELECT ub.*, bm.title as market_title, u.username
      FROM user_bets ub
      JOIN betting_markets bm ON ub.market_id = bm.id
      JOIN users u ON ub.user_id = u.id
      WHERE ub.status = 'won' AND ub.created_at >= ?
      ORDER BY ub.potential_payout DESC
      LIMIT 5
    `, [oneWeekAgo]);
    
    if (bigWins.length === 0) {
      await postToChannel('📊 WEEKLY SUMMARY\n\nNo predictions were resolved this week. New markets coming soon — stay tuned! 🔮');
      return;
    }
    
    let msg = '🏆 WEEKLY BIG WINS LEADERBOARD 🏆\n\n';
    bigWins.forEach((win, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      msg += `${medal} ${win.username || 'Anonymous'} — ${win.potential_payout.toFixed(4)} BTC\n   📊 ${win.market_title}\n\n`;
    });
    msg += `💰 Total payouts this week!\n🎮 Keep predicting, keep winning!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    
    await postToChannel(msg);
  } catch (err) {
    console.error('Error posting weekly big wins:', err);
  }
}

// --- Auto-update: Weekly clip/video of the week ---
async function postClipOfTheWeek() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const topClip = await dbGet(`
      SELECT c.*, u.username,
        (SELECT COUNT(*) FROM clip_votes WHERE clip_id = c.id AND vote_type = 1) as upvotes
      FROM clips c
      JOIN users u ON c.user_id = u.id
      WHERE c.created_at >= ?
      ORDER BY upvotes DESC
      LIMIT 1
    `, [oneWeekAgo]);
    
    if (!topClip) {
      await postToChannel('🎬 CLIP OF THE WEEK\n\nNo clips were submitted this week.\nBe the first to share your highlight! 🎥\n\n🔗 https://pixelpulse.zentriva-clubsync.online');
      return;
    }
    
    const msg = `🎬 CLIP OF THE WEEK! 🎬\n\n🎥 "${topClip.title}"\n🎮 Game: ${topClip.game_type}\n👤 ${topClip.username}\n👍 ${topClip.upvotes} upvotes\n\n🔥 Congrats to ${topClip.username} for the top clip this week!\n\nWatch and vote on more clips:\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    
    await postPhotoToChannel(topClip.thumbnail_url || null, msg);
  } catch (err) {
    console.error('Error posting clip of the week:', err);
  }
}

// --- Auto-update: Weekly platform stats ---
async function postWeeklyStats() {
  try {
    const totalClips = (await dbGet('SELECT COUNT(*) as count FROM clips')).count;
    const totalSkins = (await dbGet('SELECT COUNT(*) as count FROM skins WHERE status = ?', ['available'])).count;
    const activeMarkets = (await dbGet('SELECT COUNT(*) as count FROM betting_markets WHERE status = ?', ['active'])).count;
    const resolvedThisWeek = (await dbGet(`SELECT COUNT(*) as count FROM betting_markets WHERE status = 'resolved' AND updated_at >= ?`, [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()])).count;
    const totalVolume = (await dbGet('SELECT COALESCE(SUM(total_volume), 0) as volume FROM betting_markets')).volume;
    const pool = await dbGet('SELECT * FROM platform_fee_pool WHERE id = 1');
    
    const msg = `📊 WEEKLY PLATFORM STATS\n\n🎬 Clips: ${totalClips}\n💼 Skins Listed: ${totalSkins}\n🔮 Active Markets: ${activeMarkets}\n🏁 Resolved This Week: ${resolvedThisWeek}\n💰 Total Volume: ${totalVolume.toFixed(4)} BTC\n🏦 Platform Fee Pool: ${(pool?.accumulated_btc || 0).toFixed(6)} BTC\n\n📈 Growing every week!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    
    await postToChannel(msg);
  } catch (err) {
    console.error('Error posting weekly stats:', err);
  }
}

// --- Auto-update: Anime news from APIs ---
async function postAnimeNews() {
  try {
    const animeList = await fetchAnimeData();
    if (!animeList || animeList.length === 0) return;
    
    // Pick top 3 upcoming anime
    const topAnime = animeList.slice(0, 3);
    let msg = '📺 ANIME NEWS — UPCOMING RELEASES\n\n';
    
    for (const anime of topAnime) {
      const title = anime.title?.english || anime.title?.romaji || anime.title || 'Unknown';
      const date = anime.startDate || anime.airing_start || 'TBA';
      const genres = anime.genres ? (Array.isArray(anime.genres) ? anime.genres.join(', ') : anime.genres) : 'Unknown';
      const score = anime.averageScore || anime.score || 'N/A';
      
      msg += `🎬 ${title}\n📅 ${date}\n🎭 ${genres}\n⭐ Score: ${score}\n\n`;
    }
    
    msg += '🔮 Predict release dates on PixelPulse!\n🔗 https://pixelpulse.zentriva-clubsync.online';
    
    // Try to get cover image from first anime
    const coverImage = topAnime[0]?.coverImage || topAnime[0]?.images?.jpg?.large_image_url || null;
    await postPhotoToChannel(coverImage, msg);
  } catch (err) {
    console.error('Error posting anime news:', err);
  }
}

// --- Auto-update: Gaming news from RSS feeds ---
async function fetchGamingNews() {
  const feeds = [
    { url: 'https://feeds.ign.com/ign/all', source: 'IGN' },
    { url: 'https://www.gamespot.com/feeds/game-news/', source: 'GameSpot' },
    { url: 'https://www.pcgamer.com/rss/', source: 'PC Gamer' }
  ];

  const allItems = [];
  for (const feed of feeds) {
    try {
      const res = await new Promise((resolve, reject) => {
        https.get(feed.url, { headers: { 'User-Agent': 'PixelPulse/1.0' } }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
          response.on('error', reject);
        }).on('error', reject);
      });

      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(res)) !== null && items.length < 5) {
        const block = match[1];
        const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
        const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim();
        const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim();
        const descMatch = block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.trim();
        const desc = descMatch ? descMatch.replace(/<[^>]+>/g, '').substring(0, 200) : '';
        if (title && link) {
          items.push({ title, link, desc, source: feed.source, pubDate });
        }
      }
      allItems.push(...items);
    } catch (err) {
      console.error(`Failed to fetch ${feed.source} RSS:`, err.message);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return allItems.slice(0, 5);
}

async function postGamingNews() {
  try {
    const news = await fetchGamingNews();
    if (news.length === 0) {
      console.log('No gaming news fetched, skipping post');
      return;
    }

    let msg = '🎮 GAMING NEWS UPDATE\n\n';
    const newsItems = [];
    for (const item of news.slice(0, 4)) {
      msg += `📰 ${item.title}\n`;
      if (item.desc) msg += `${item.desc}...\n`;
      msg += `🔗 ${item.link}\n\n`;
      newsItems.push({ title: item.title, desc: item.desc, link: item.link, source: item.source });
    }
    msg += '💬 What do you think? Discuss below!\n🎮 Join the community: https://pixelpulse.zentriva-clubsync.online';

    await postToChannel(msg);

    await dbRun('INSERT INTO community_posts (post_type, title, content, source) VALUES (?, ?, ?, ?)',
      ['gaming_news', 'Gaming News Update', JSON.stringify(newsItems), 'RSS']);
  } catch (err) {
    console.error('Error posting gaming news:', err);
  }
}

// --- Auto-update: Daily quiz of the day ---
async function postQuizOfTheDay() {
  try {
    const quiz = await dbGet('SELECT id, title, description, reward_points, difficulty FROM quizzes ORDER BY RANDOM() LIMIT 1');
    if (!quiz) return;

    const diffEmoji = quiz.difficulty === 'easy' ? '🟢 Easy' : quiz.difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard';
    const msg = `🧠 QUIZ OF THE DAY\n\n❓ ${quiz.title}\n📝 ${quiz.description || ''}\n📊 Difficulty: ${diffEmoji}\n💰 Reward: ${quiz.reward_points} Royal Coins\n\nTake the quiz now and earn coins!\n🔗 https://pixelpulse.zentriva-clubsync.online`;

    await postToChannel(msg);

    await dbRun('INSERT INTO community_posts (post_type, title, content, link) VALUES (?, ?, ?, ?)',
      ['quiz', `Quiz of the Day: ${quiz.title}`, `${quiz.description || ''} | Difficulty: ${quiz.difficulty} | Reward: ${quiz.reward_points} Royal Coins`, 'https://pixelpulse.zentriva-clubsync.online']);
  } catch (err) {
    console.error('Error posting quiz of the day:', err);
  }
}

// --- Auto-update: Daily discussion prompt ---
const discussionPrompts = [
  'What\'s the best skin you\'ve ever owned in any game? Share a screenshot! 📸',
  'Which game has the best trading economy and why? 💰',
  'If you could trade one item from any game for real money, what would it be? 💸',
  'What\'s your hottest gaming take that nobody agrees with? 🔥',
  'Which game community is the most toxic, and which is the most wholesome? 🤔',
  'What\'s the most you\'ve ever spent on in-game items? Be honest! 💵',
  'If you could bring back one discontinued game item, what would it be? 🕹️',
  'What game do you think has the worst monetization? 🎮',
  'Which mobile game do you think has the best events? 📱',
  'What\'s your dream collab between two games? 🤝',
  'Have you ever been scammed in a game trade? Tell the story (no names)! ⚠️',
  'What\'s the most underrated game of 2025? 🏆',
  'Which game has the best Battle Pass value? 💎',
  'What\'s your favorite gaming memory of all time? 🎬',
  'If PixelPulse could support one more game, which should it be? 🎯'
];

async function postDiscussionPrompt() {
  try {
    const prompt = discussionPrompts[Math.floor(Math.random() * discussionPrompts.length)];
    const msg = `💬 DAILY DISCUSSION\n\n${prompt}\n\n👇 Reply with your thoughts!\n🎮 Trade safely at https://pixelpulse.zentriva-clubsync.online`;
    await postToChannel(msg);

    await dbRun('INSERT INTO community_posts (post_type, title, content) VALUES (?, ?, ?)',
      ['discussion', 'Daily Discussion', prompt]);
  } catch (err) {
    console.error('Error posting discussion prompt:', err);
  }
}

// --- Auto-update: Daily interactive poll with follow-up discussion ---
const dailyPolls = [
  {
    question: '🎮 Which game would you most likely trade items on?',
    options: ['CS2', 'Roblox', 'Fortnite', 'Free Fire', 'Valorant'],
    followUp: 'Why did you pick that game? Is it because you have items to trade, or because the trading community is better there? 👇'
  },
  {
    question: '📺 Best anime of 2025 so far?',
    options: ['Solo Leveling S2', 'Jujutsu Kaisen S2', 'One Piece', 'Frieren', 'Dandadan'],
    followUp: 'What makes your pick the best? Animation, story, or characters? Drop your reasoning below! 🎬'
  },
  {
    question: '💰 What\'s the most you\'d spend on a single in-game item?',
    options: ['Under $5', '$5-$20', '$20-$50', '$50-$100', 'Over $100'],
    followUp: 'What item did you (or would you) buy at that price? Was it worth it? 💸'
  },
  {
    question: '🏆 Best mobile game for trading?',
    options: ['Free Fire', 'PUBG Mobile', 'Clash of Clans', 'Genshin Impact', 'Roblox'],
    followUp: 'Have you ever traded in that game? How was the experience? Share below! 📱'
  },
  {
    question: '⚔️ CS2 vs Valorant — which has better skins?',
    options: ['CS2 all day', 'Valorant for sure', 'Both are equal', 'Don\'t care about skins'],
    followUp: 'What\'s your favorite skin from the game you picked? Drop a name! 🔫'
  },
  {
    question: '🤔 Would you buy a game account from another player?',
    options: ['Yes, if it\'s safe', 'Yes, but only from friends', 'No, too risky', 'Never thought about it'],
    followUp: 'What would make you trust an account trade? Escrow? Verification? Tell us below! 🔐'
  },
  {
    question: '🎬 Best anime villain of all time?',
    options: ['Sukuna (JJK)', 'Muzan (Demon Slayer)', 'Aizen (Bleach)', 'Shigaraki (MHA)', 'Hisoka (HxH)'],
    followUp: 'What makes them the best villain? Power, personality, or backstory? Discuss! 😈'
  },
  {
    question: '💎 What\'s more important in a game marketplace?',
    options: ['Security/Escrow', 'Low fees', 'Wide game support', 'Fast transactions', 'Active community'],
    followUp: 'Have you used PixelPulse yet? What\'s your experience been like? Let us know! 🏪'
  },
  {
    question: '🎮 Which platform do you game on most?',
    options: ['PC', 'Mobile', 'PlayStation', 'Xbox', 'Nintendo Switch'],
    followUp: 'Do you trade items on that platform? What\'s the trading scene like? 🕹️'
  },
  {
    question: '🔥 Most overrated game right now?',
    options: ['Fortnite', 'Genshin Impact', 'Roblox', 'Valorant', 'None of these'],
    followUp: 'Why do you think it\'s overrated? Or did you vote "none" — which game IS actually worth the hype? 👀'
  },
  {
    question: '📺 Which anime should get a game next?',
    options: ['Chainsaw Man', 'Spy x Family', 'Demon Slayer', 'Jujutsu Kaisen', 'Frieren'],
    followUp: 'What genre would the game be? RPG? Fighting? Gacha? Pitch your idea below! 🎮'
  },
  {
    question: '💸 Have you ever been scammed in a game trade?',
    options: ['Yes, lost money', 'Yes, lost items', 'Almost, but escaped', 'Never', 'What\'s trading?'],
    followUp: 'If you\'ve been scammed, what happened? (No names!) If not, how do you stay safe? ⚠️'
  },
  {
    question: '🥊 Free Fire vs PUBG Mobile — which is better?',
    options: ['Free Fire', 'PUBG Mobile', 'Both are equal', 'Neither, I prefer CoD'],
    followUp: 'What makes your pick better? Gameplay, community, or events? Argue your case! 📱'
  },
  {
    question: '🎯 If you had 1000 Robux right now, what would you do?',
    options: ['Buy a Limited', 'Trade for profit', 'Buy game passes', 'Save them', 'Convert to real money'],
    followUp: 'Have you ever traded Robux on PixelPulse? How did it go? Share below! 💰'
  },
  {
    question: '🌟 What keeps you coming back to a gaming community?',
    options: ['The people', 'Trading opportunities', 'Clips & content', 'Events & giveaways', 'Quizzes & games'],
    followUp: 'What would YOU like to see more of in our community? Be honest — we\'re listening! 📢'
  }
];

async function postDailyPoll() {
  try {
    if (!TELEGRAM_CHANNEL_ID || !bot?.telegram) return;
    const poll = dailyPolls[Math.floor(Math.random() * dailyPolls.length)];

    // Save poll to database
    const pollResult = await dbRun('INSERT INTO community_posts (post_type, title, content, poll_options, follow_up) VALUES (?, ?, ?, ?, ?)',
      ['poll', poll.question, poll.question, JSON.stringify(poll.options), poll.followUp]);

    // Send the poll
    await bot.telegram.sendPoll(
      TELEGRAM_CHANNEL_ID,
      poll.question,
      poll.options,
      { is_anonymous: false }
    );

    // Send follow-up discussion message 2 seconds later
    setTimeout(async () => {
      try {
        const msg = `💬 Tell us more!\n\n${poll.followUp}\n\n👇 Reply below — we read everything!\n🎮 https://pixelpulse.zentriva-clubsync.online`;
        await bot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, msg);
      } catch (e) {
        console.error('Error posting poll follow-up:', e.message);
      }
    }, 2000);

    console.log('Daily poll posted to Telegram');
  } catch (err) {
    console.error('Error posting daily poll:', err.message);
  }
}

// --- Auto-update: New clip posted on webapp → notify Telegram ---
async function notifyNewClip(clipTitle, gameType, username, videoUrl) {
  try {
    const msg = `🎬 NEW CLIP ALERT!\n\n🎥 "${clipTitle}"\n🎮 Game: ${gameType}\n👤 Shared by ${username}\n\nWatch and vote on PixelPulse!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    await postToChannel(msg);
  } catch (err) {
    console.error('Error posting new clip notification:', err);
  }
}

// --- Auto-update: New skin listed on marketplace → notify Telegram ---
async function notifyNewSkinListing(skinName, gameType, price, currency, username) {
  try {
    const priceStr = price > 0 ? `${price} ${currency}` : 'token trade';
    const msg = `💼 NEW LISTING\n\n📦 ${skinName}\n🎮 Game: ${gameType}\n💰 Price: ${priceStr}\n👤 Listed by ${username}\n\nCheck it out on PixelPulse!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    await postToChannel(msg);
  } catch (err) {
    console.error('Error posting skin listing notification:', err);
  }
}

// --- Auto-update: Token trade completed → notify Telegram ---
async function notifyTokenTrade(fromUser, toUser, tokenType, amount) {
  try {
    const msg = `🔄 TOKEN TRADE COMPLETED\n\n👤 ${fromUser} → ${toUser}\n💰 ${amount} ${tokenType}\n\n✅ Escrow-protected trade successful!\n🔗 https://pixelpulse.zentriva-clubsync.online`;
    await postToChannel(msg);
  } catch (err) {
    console.error('Error posting token trade notification:', err);
  }
}

// Schedule auto-updates
function scheduleChannelUpdates() {
  if (!TELEGRAM_CHANNEL_ID) {
    console.log('No TELEGRAM_CHANNEL_ID set, skipping channel auto-updates');
    return;
  }
  
  console.log('Telegram channel auto-updates enabled for channel:', TELEGRAM_CHANNEL_ID);
  
  // Weekly big wins summary — every Monday 6pm
  const now = new Date();
  const nextMonday = new Date(now);
  const daysUntilMonday = (1 - now.getDay() + 7) % 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(18, 0, 0, 0);
  const msUntilMonday = nextMonday - now;
  
  setTimeout(() => {
    postWeeklyBigWins();
    setInterval(postWeeklyBigWins, 7 * 24 * 60 * 60 * 1000);
  }, msUntilMonday);
  
  // Weekly clip of the week — every Friday 6pm
  const nextFriday = new Date(now);
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(18, 0, 0, 0);
  const msUntilFriday = nextFriday - now;
  
  setTimeout(() => {
    postClipOfTheWeek();
    setInterval(postClipOfTheWeek, 7 * 24 * 60 * 60 * 1000);
  }, msUntilFriday);
  
  // Weekly platform stats — every Sunday 8pm
  const nextSunday = new Date(now);
  const daysUntilSunday = (0 - now.getDay() + 7) % 7;
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(20, 0, 0, 0);
  const msUntilSunday = nextSunday - now;
  
  setTimeout(() => {
    postWeeklyStats();
    setInterval(postWeeklyStats, 7 * 24 * 60 * 60 * 1000);
  }, msUntilSunday);
  
  // Anime news — every Tuesday and Thursday at 2pm
  const nextTue = new Date(now);
  const daysUntilTue = (2 - now.getDay() + 7) % 7;
  nextTue.setDate(now.getDate() + daysUntilTue);
  nextTue.setHours(14, 0, 0, 0);
  const msUntilTue = nextTue - now;
  
  setTimeout(() => {
    postAnimeNews();
    setInterval(postAnimeNews, 2 * 24 * 60 * 60 * 1000); // Every 2 days
  }, msUntilTue);
  
  // Gaming news — every day at 10am
  const next10am = new Date(now);
  next10am.setHours(10, 0, 0, 0);
  if (next10am < now) next10am.setDate(next10am.getDate() + 1);
  const msUntil10am = next10am - now;
  
  setTimeout(() => {
    postGamingNews();
    setInterval(postGamingNews, 24 * 60 * 60 * 1000); // Daily
  }, msUntil10am);
  
  // Quiz of the day — every day at 12pm
  const next12pm = new Date(now);
  next12pm.setHours(12, 0, 0, 0);
  if (next12pm < now) next12pm.setDate(next12pm.getDate() + 1);
  const msUntil12pm = next12pm - now;
  
  setTimeout(() => {
    postQuizOfTheDay();
    setInterval(postQuizOfTheDay, 24 * 60 * 60 * 1000); // Daily
  }, msUntil12pm);
  
  // Daily interactive poll with follow-up discussion — every day at 6pm
  const next6pm = new Date(now);
  next6pm.setHours(18, 0, 0, 0);
  if (next6pm < now) next6pm.setDate(next6pm.getDate() + 1);
  const msUntil6pm = next6pm - now;
  
  setTimeout(() => {
    postDailyPoll();
    setInterval(postDailyPoll, 24 * 60 * 60 * 1000); // Daily
  }, msUntil6pm);
  
  // Discussion prompt — every day at 9pm (evening engagement)
  const next9pm = new Date(now);
  next9pm.setHours(21, 0, 0, 0);
  if (next9pm < now) next9pm.setDate(next9pm.getDate() + 1);
  const msUntil9pm = next9pm - now;
  
  setTimeout(() => {
    postDiscussionPrompt();
    setInterval(postDiscussionPrompt, 24 * 60 * 60 * 1000); // Daily
  }, msUntil9pm);
}

// Start Telegram bot
bot.launch().then(() => {
  console.log('Telegram bot started');
  scheduleChannelUpdates();
}).catch(err => {
  console.error('Failed to start bot:', err);
});
