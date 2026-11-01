require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'dellner_pm',
  });
  const hash = await bcrypt.hash('Dellner@PM', 10);
  const name = process.argv[2];
  const [r] = name
    ? await db.query('UPDATE users SET password_hash=? WHERE username=?', [hash, name])
    : await db.query('UPDATE users SET password_hash=?', [hash]);
  console.log('Password set to Dellner@PM for', r.affectedRows, 'user(s)');
  process.exit();
})();
