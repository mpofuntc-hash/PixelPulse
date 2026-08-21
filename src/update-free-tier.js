const Database = require('better-sqlite3');

// Update all anime to free tier
const db = new Database('./data/pixelpulse.db');

// First check current state
const before = db.prepare('SELECT COUNT(*) as count FROM anime').get();
console.log(`Total anime in database: ${before.count}`);

const update = db.prepare('UPDATE anime SET free_tier = 1');
const result = update.run();

console.log(`Updated ${result.changes} anime to free tier`);

// Verify the update
const check = db.prepare('SELECT COUNT(*) as count FROM anime WHERE free_tier = 1').get();
console.log(`Total free tier anime: ${check.count}`);

db.close();
