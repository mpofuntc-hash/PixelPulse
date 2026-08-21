const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./data/pixelpulse.db');

const adminEmail = 'chester.nt@zentriva.online';
const adminPassword = '123tryme';
const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

// Reset to one-time password
db.prepare('UPDATE admin_users SET password_hash = ?, is_one_time_password = 1 WHERE email = ?').run(passwordHash, adminEmail);
console.log('Admin password reset to one-time password: 123tryme');

// Verify
const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(adminEmail);
console.log('Admin user:', JSON.stringify({ email: admin.email, is_one_time: admin.is_one_time_password }));
