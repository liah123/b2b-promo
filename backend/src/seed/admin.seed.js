require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD 환경변수가 필요합니다.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, 'Admin', 'ADMIN')
     ON CONFLICT (email) DO NOTHING
     RETURNING user_id`,
    [email, passwordHash]
  );

  if (result.rowCount > 0) {
    console.log(`admin seeded: ${email} (user_id=${result.rows[0].user_id})`);
  } else {
    console.log(`admin already exists: ${email}`);
  }

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('admin seed failed:', err.message);
  process.exit(1);
});
