#!/bin/bash
cd ~/PixelPulse
node -e "
require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, '🔔 PixelPulse channel auto-updates are now LIVE!\n\nScheduled updates:\n🏆 Monday 6pm — Weekly Big Wins\n🎬 Friday 6pm — Clip of the Week\n📊 Sunday 8pm — Platform Stats\n📺 Tue/Thu 2pm — Anime News\n\nPlus real-time alerts for new markets and resolutions!').then(() => {
  console.log('Test message sent to channel successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Failed to send test message:', err.message);
  process.exit(1);
});
"
