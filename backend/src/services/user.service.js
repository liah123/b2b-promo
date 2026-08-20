const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { mapRow } = require('./mapRow');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function getMe(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, email, name, role, created_at FROM users WHERE user_id = $1`,
    [userId]
  );
  return mapRow(rows[0]);
}

async function updateName(userId, name) {
  if (!name || !name.trim()) {
    throw httpError(400, '이름은 필수입니다');
  }
  const { rows } = await pool.query(
    `UPDATE users SET name = $1 WHERE user_id = $2
     RETURNING user_id, email, name, role, created_at`,
    [name, userId]
  );
  console.log('user updateName success: userId=' + userId);
  return mapRow(rows[0]);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw httpError(400, '현재 비밀번호, 새 비밀번호는 필수입니다');
  }
  const { rows } = await pool.query(
    `SELECT password FROM users WHERE user_id = $1`,
    [userId]
  );
  const matched = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password));
  if (!matched) {
    throw httpError(401, '현재 비밀번호가 일치하지 않습니다');
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query(`UPDATE users SET password = $1 WHERE user_id = $2`, [hashed, userId]);
  console.log('user changePassword success: userId=' + userId);
}

module.exports = { getMe, updateName, changePassword };
