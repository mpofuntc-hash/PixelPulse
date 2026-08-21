const Database = require('better-sqlite3');
const db = new Database('./data/pixelpulse.db');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Check users table schema
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  console.log('\nusers columns:', userCols.map(c => c.name).join(', '));
} catch(e) { console.log('No users table:', e.message); }

// Check betting_markets table schema
try {
  const bmCols = db.prepare("PRAGMA table_info(betting_markets)").all();
  console.log('betting_markets columns:', bmCols.map(c => c.name).join(', '));
} catch(e) { console.log('No betting_markets table:', e.message); }

// Check admin_users table
try {
  const adminCols = db.prepare("PRAGMA table_info(admin_users)").all();
  console.log('admin_users columns:', adminCols.map(c => c.name).join(', '));
} catch(e) { console.log('No admin_users table:', e.message); }
