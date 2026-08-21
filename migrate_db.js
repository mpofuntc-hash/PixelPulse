const Database = require('better-sqlite3');
const db = new Database('./data/pixelpulse.db');

function addColumnIfMissing(table, column, definition) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = cols.some(c => c.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Added column ${column} to ${table}`);
    } else {
      console.log(`Column ${column} already exists in ${table}`);
    }
  } catch(e) {
    console.log(`Error adding ${column} to ${table}: ${e.message}`);
  }
}

// Users table - add missing columns
addColumnIfMissing('users', 'email', 'TEXT');
addColumnIfMissing('users', 'password', 'TEXT');
addColumnIfMissing('users', 'is_adult', 'INTEGER DEFAULT 0');
addColumnIfMissing('users', 'game_points', 'INTEGER DEFAULT 0');

// Betting markets - add missing columns
addColumnIfMissing('betting_markets', 'api_source', 'TEXT');
addColumnIfMissing('betting_markets', 'api_event_id', 'TEXT');
addColumnIfMissing('betting_markets', 'bet_type', "TEXT DEFAULT 'simple'");
addColumnIfMissing('betting_markets', 'parent_market_id', 'INTEGER');
addColumnIfMissing('betting_markets', 'layer_depth', 'INTEGER DEFAULT 0');
addColumnIfMissing('betting_markets', 'condition_logic', 'TEXT');
addColumnIfMissing('betting_markets', 'resolution_value', 'TEXT');

// User bets - add missing columns
addColumnIfMissing('user_bets', 'status', "TEXT DEFAULT 'pending'");

// User balances - check if exists
try {
  const balCols = db.prepare("PRAGMA table_info(user_balances)").all();
  console.log('user_balances columns:', balCols.map(c => c.name).join(', '));
} catch(e) { console.log('No user_balances table:', e.message); }

// Create user_balances if missing columns
addColumnIfMissing('user_balances', 'btc_balance', 'REAL DEFAULT 0');

console.log('\nMigration complete!');

// Verify
const userCols = db.prepare("PRAGMA table_info(users)").all();
console.log('users columns now:', userCols.map(c => c.name).join(', '));
const bmCols = db.prepare("PRAGMA table_info(betting_markets)").all();
console.log('betting_markets columns now:', bmCols.map(c => c.name).join(', '));
