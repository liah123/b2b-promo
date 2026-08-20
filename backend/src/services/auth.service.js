const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const { mapRow } = require('./mapRow');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function signup({ email, password, name }) {
  if (!email || !password || !name) {
    throw httpError(400, '이메일, 비밀번호, 이름은 필수입니다');
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password, name, role)
       VALUES ($1, $2, $3, 'CUSTOMER')
       RETURNING user_id, email, name, role, created_at`,
      [email, hashed, name]
    );
    console.log('signup success: ' + email);
    return mapRow(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, '이미 가입된 이메일입니다');
    }
    throw err;
  }
}

async function login({ email, password }) {
  if (!email || !password) {
    throw httpError(400, '이메일, 비밀번호는 필수입니다');
  }

  const { rows } = await pool.query(
    `SELECT user_id, email, password, name, role, created_at FROM users WHERE email = $1`,
    [email]
  );

  const row = rows[0];
  const matched = row && (await bcrypt.compare(password, row.password));
  if (!matched) {
    throw httpError(401, '이메일 또는 비밀번호가 일치하지 않습니다');
  }

  const accessToken = jwt.sign(
    { userId: row.user_id, role: row.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { userId: row.user_id },
    process.env.JWT_REFRESH_SECRET,
    // jwtid: 같은 유저가 1초 내 재로그인해도 토큰 문자열이 겹치지 않도록 유니크 클레임 부여
    // (refresh_tokens.token UNIQUE 제약 위반 방지 — iat는 초 단위라 payload만으론 충돌 가능)
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );

  const expiresAt = new Date(jwt.decode(refreshToken).exp * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [row.user_id, refreshToken, expiresAt]
  );

  console.log('login success: userId=' + row.user_id);

  const { password: _password, ...userWithoutPassword } = row;
  return { accessToken, refreshToken, user: mapRow(userWithoutPassword) };
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw httpError(401, '리프레시 토큰이 없습니다');

  try {
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw httpError(401, '유효하지 않은 리프레시 토큰입니다');
  }

  const { rows } = await pool.query(
    `SELECT rt.token, u.user_id, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.user_id = rt.user_id
     WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [refreshToken]
  );
  if (rows.length === 0) {
    throw httpError(401, '만료되었거나 폐기된 리프레시 토큰입니다');
  }

  const accessToken = jwt.sign(
    { userId: rows[0].user_id, role: rows[0].role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
  );

  console.log('refresh success: userId=' + rows[0].user_id);
  return { accessToken };
}

async function logout(refreshToken) {
  if (!refreshToken) throw httpError(401, '리프레시 토큰이 없습니다');

  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE token = $1 AND revoked_at IS NULL`,
    [refreshToken]
  );
  console.log('logout success');
}

module.exports = { signup, login, refreshAccessToken, logout };
