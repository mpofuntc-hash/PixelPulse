const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const dbPath = './data/pixelpulse.db';

const adminEmail = process.env.ADMIN_EMAIL || 'chester.nt@zentriva.online';
const suppliedPassword = process.env.ADMIN_PASSWORD;
const passwordValue = suppliedPassword && suppliedPassword.length > 0 ? suppliedPassword : crypto.randomBytes(12).toString('hex');
const passwordHash = bcrypt.hashSync(passwordValue, 10);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }

  db.run('UPDATE admin_users SET password_hash = ?, is_one_time_password = 1 WHERE email = ?', [passwordHash, adminEmail], function (err) {
    if (err) {
      console.error('Failed to update admin:', err);
      db.close();
      process.exit(1);
    }

    if (this.changes === 0) {
      console.error('No admin user found with that email. Create the admin user first or check the email.');
      db.close();
      process.exit(1);
    }

    console.log('Admin password set to:', suppliedPassword ? '(supplied via ADMIN_PASSWORD)' : passwordValue);
    db.get('SELECT email, is_one_time_password FROM admin_users WHERE email = ?', [adminEmail], (readErr, row) => {
      if (readErr) {
        console.error('Read verification failed:', readErr);
      } else {
        console.log('Admin user:', JSON.stringify(row));
      }
      db.close();
    });
  });
});
