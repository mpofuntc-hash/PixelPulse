require('dotenv').config();
const SteamUser = require('steam-user');
const SteamTradeOfferManager = require('steam-tradeoffer-manager');
const SteamCommunity = require('steamcommunity');
const readline = require('readline');

// Main server API endpoint
const API_BASE = `http://localhost:${process.env.PORT || 3000}`;

// CS2 app ID - the only game this bot handles skins for
const CS2_APP_ID = 730;

// Telegram alerting (no shared/identity secret means confirmations require
// manually opening the Steam mobile app - alert the admin the instant one is needed)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

async function alertAdmin(message) {
  console.log('[ADMIN ALERT]', message);
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text: message })
    });
  } catch (error) {
    console.error('Failed to send Telegram admin alert:', error.message);
  }
}

// Steam bot configuration
const botConfig = {
  accountName: process.env.STEAM_BOT_USERNAME,
  password: process.env.STEAM_BOT_PASSWORD,
  sharedSecret: process.env.STEAM_BOT_SHARED_SECRET,
  identitySecret: process.env.STEAM_BOT_IDENTITY_SECRET
};

// Initialize Steam clients
const user = new SteamUser();
const community = new SteamCommunity();
const manager = new SteamTradeOfferManager({
  steam: user,
  community: community,
  language: 'en'
});

// Readline interface for manual 2FA input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Log in to Steam
function loginSteam() {
  if (!botConfig.accountName || !botConfig.password) {
    console.error('STEAM_BOT_USERNAME and STEAM_BOT_PASSWORD must be set in .env');
    process.exit(1);
  }

  const logOnOptions = {
    accountName: botConfig.accountName,
    password: botConfig.password
  };

  if (botConfig.sharedSecret) {
    // Automatic 2FA using shared secret
    logOnOptions.twoFactorCode = SteamUser.generateAuthCode(botConfig.sharedSecret);
    console.log('Using shared secret for automatic 2FA');
    user.logOn(logOnOptions);
  } else {
    // Manual 2FA - prompt user for code
    console.log('=========================================');
    console.log('STEAM BOT - MANUAL 2FA MODE');
    console.log('=========================================');
    console.log('Note: Without shared secrets, trades will have a 7-day hold.');
    console.log('For instant trades, extract secrets using Steam Desktop Authenticator.');
    console.log('=========================================\n');
    
    rl.question('Enter 2FA code from your Steam mobile app: ', (code) => {
      logOnOptions.twoFactorCode = code.trim();
      console.log('Attempting login with manual 2FA...');
      user.logOn(logOnOptions);
    });
  }
}

// Handle successful login
user.on('loggedOn', () => {
  console.log('Steam bot logged in successfully');
  user.setPersona(SteamUser.EPersonaState.Online);
  user.gamesPlayed([730]); // Show as playing CS2 (app ID 730)
});

// Handle authentication errors
user.on('error', (err) => {
  console.error('Steam login error:', err);
  if (err.message.includes('InvalidPassword')) {
    console.error('Check your STEAM_BOT_USERNAME and STEAM_BOT_PASSWORD in .env');
  } else if (err.message.includes('TwoFactor')) {
    console.error('Two-factor authentication required. Set STEAM_BOT_SHARED_SECRET in .env');
  }
});

// Handle session tickets for trade offers
user.on('webSession', (sessionID, cookies) => {
  console.log('Got web session');
  community.setCookies(cookies);
  manager.setCookies(cookies);
  
  // Save cookies for re-use
  manager.api._http.options.headers.Cookie = cookies.join('; ');
});

// Handle new trade offers
manager.on('newOffer', async (offer) => {
  console.log('New trade offer received:', offer.id);

  // --- Basic order screening (defense in depth, server re-validates all of this) ---
  const itemsToGive = offer.itemsToGive || [];
  const itemsToReceive = offer.itemsToReceive || [];
  const senderSteamId = offer.partner.getSteamID64();

  if (itemsToGive.length !== 0) {
    console.log(`Rejecting offer ${offer.id}: sender ${senderSteamId} is requesting items from the bot`);
    await alertAdmin(`⚠️ Rejected suspicious Steam offer ${offer.id} from ${senderSteamId}: requested ${itemsToGive.length} item(s) FROM the bot.`);
    offer.decline(err => { if (err) console.error('Error declining offer:', err); });
    return;
  }
  if (itemsToReceive.length !== 1) {
    console.log(`Rejecting offer ${offer.id}: expected exactly 1 item, got ${itemsToReceive.length}`);
    offer.decline(err => { if (err) console.error('Error declining offer:', err); });
    return;
  }
  const item = itemsToReceive[0];
  if (String(item.appid) !== String(CS2_APP_ID)) {
    console.log(`Rejecting offer ${offer.id}: item is not from CS2 (appid ${item.appid})`);
    offer.decline(err => { if (err) console.error('Error declining offer:', err); });
    return;
  }

  try {
    // Check if this offer is related to an escrow trade via API.
    // The server independently verifies senderSteamId matches the seller on file
    // and atomically claims the trade to prevent race conditions / mismatched items.
    const response = await fetch(`${API_BASE}/api/steam/check-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId: offer.id,
        senderSteamId,
        itemsToGiveCount: itemsToGive.length,
        itemsToReceiveCount: itemsToReceive.length
      })
    });
    const data = await response.json();
    
    if (!data.escrowTrade) {
      console.log('Offer not associated with any escrow trade, ignoring:', data.reason || 'no reason given');
      offer.decline(err => {
        if (err) console.error('Error declining offer:', err);
      });
      return;
    }

    const escrowTrade = data.escrowTrade;
    console.log('Valid trade offer from seller, accepting...');

    // Accept the offer
    offer.accept((err) => {
      if (err) {
        console.error('Error accepting offer:', err);
        // Notify server of error
        fetch(`${API_BASE}/api/steam/offer-error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId: offer.id, error: err.message })
        });
        return;
      }

      console.log('Offer accepted successfully');

      // Notify server that offer was accepted
      fetch(`${API_BASE}/api/steam/offer-accepted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, escrowId: escrowTrade.id })
      });

      // Forward the skin to the buyer
      forwardSkinToBuyer(escrowTrade, offer);
    });
  } catch (error) {
    console.error('Error checking offer with server:', error);
    offer.decline(err => {
      if (err) console.error('Error declining offer:', err);
    });
  }
});

// Forward skin to buyer
async function forwardSkinToBuyer(escrowTrade, originalOffer) {
  try {
    // Get buyer trade URL from server
    const response = await fetch(`${API_BASE}/api/steam/buyer-trade-url?escrowId=${escrowTrade.id}`);
    const data = await response.json();
    
    if (!data.tradeUrl) {
      console.error('Buyer trade URL not found');
      await fetch(`${API_BASE}/api/steam/escrow-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrowId: escrowTrade.id, error: 'Buyer trade URL not found' })
      });
      return;
    }

    console.log('Forwarding skin to buyer...');

    // Create a new offer to the buyer
    const offer = manager.createOffer(data.tradeUrl);

    // Add the skin from the original offer
    originalOffer.getExchangeDetails((err, details) => {
      if (err) {
        console.error('Error getting exchange details:', err);
        return;
      }

      // Add the received items to the new offer
      const receivedItems = details.receivedItems || [];
      receivedItems.forEach(item => {
        offer.addMyItem({
          assetid: item.assetid,
          appid: item.appid,
          contextid: item.contextid,
          amount: item.amount
        });
      });

      // Send the offer
      offer.send((err) => {
        if (err) {
          console.error('Error sending offer to buyer:', err);
          fetch(`${API_BASE}/api/steam/escrow-error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ escrowId: escrowTrade.id, error: 'Failed to forward skin to buyer' })
          });
          return;
        }

        console.log('Offer sent to buyer:', offer.id);

        // Notify server of the new offer ID
        fetch(`${API_BASE}/api/steam/offer-sent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId: offer.id, escrowId: escrowTrade.id })
        });

        // Without an identity_secret the bot can't auto-confirm; the 'sentOfferChanged'
        // handler below alerts the admin if this offer needs manual confirmation.
        console.log('Waiting for buyer to confirm receipt in the web UI');
      });
    });
  } catch (error) {
    console.error('Error in forwardSkinToBuyer:', error);
  }
}

// Monitor trade offer status
manager.on('sentOfferChanged', async (offer, oldState) => {
  console.log('Sent offer changed:', offer.id, 'State:', offer.state, '(was', oldState + ')');

  if (offer.state === SteamTradeOfferManager.ETradeOfferState.CreatedNeedsConfirmation
      && oldState !== SteamTradeOfferManager.ETradeOfferState.CreatedNeedsConfirmation) {
    await alertAdmin(`📱 Steam trade offer ${offer.id} needs manual confirmation in the Steam mobile app.`);
  } else if (offer.state === SteamTradeOfferManager.ETradeOfferState.Declined) {
    await alertAdmin(`❌ Steam trade offer ${offer.id} was declined by the buyer.`);
  } else if (offer.state === SteamTradeOfferManager.ETradeOfferState.Canceled) {
    await alertAdmin(`🚫 Steam trade offer ${offer.id} was cancelled.`);
  } else if (offer.state === SteamTradeOfferManager.ETradeOfferState.InvalidItems) {
    await alertAdmin(`⚠️ Steam trade offer ${offer.id} became invalid (item no longer available).`);
  } else if (offer.state === SteamTradeOfferManager.ETradeOfferState.Accepted) {
    await alertAdmin(`✅ Steam trade offer ${offer.id} was accepted by the buyer.`);
  }

  // Notify server of offer status change
  try {
    await fetch(`${API_BASE}/api/steam/offer-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: offer.id, state: offer.state })
    });
  } catch (error) {
    console.error('Error notifying server of offer status:', error);
  }
});

// Poll for pending escrow trades that need bot action
async function pollPendingTrades() {
  console.log('Polling for pending escrow trades...');

  try {
    const response = await fetch(`${API_BASE}/api/steam/pending-trades`);
    const trades = await response.json();
    
    if (trades.length > 0) {
      console.log(`Found ${trades.length} pending trades`);
      trades.forEach(trade => {
        console.log(`Pending trade: ${trade.id}, Skin: ${trade.skin_id}`);
      });
    }
  } catch (error) {
    console.error('Error polling for pending trades:', error);
  }
}

// Start the bot
console.log('Starting Steam bot...');
loginSteam();

// Poll for pending trades every 30 seconds
setInterval(pollPendingTrades, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Steam bot...');
  user.logOff();
  process.exit(0);
});
