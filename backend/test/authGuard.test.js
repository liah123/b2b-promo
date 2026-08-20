const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');
const authGuard = require('../src/middleware/authGuard');
const roleGuard = require('../src/middleware/roleGuard');

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function buildApp() {
  const app = express();
  app.get('/protected', authGuard, (req, res) => res.json({ userId: req.user.userId }));
  app.get('/admin-only', authGuard, roleGuard, (req, res) => res.json({ ok: true }));
  return app;
}

let adminUserId;

test.after(async () => {
  if (adminUserId) {
    await pool.query('DELETE FROM users WHERE user_id = $1', [adminUserId]);
  }
});

test('authGuard - 토큰 없이 /protected 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/protected`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.ok(body.message);
  } finally {
    await close(server);
  }
});

test('authGuard - 만료된 access token으로 /protected 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const expiredToken = jwt.sign({ userId: 1, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: -1,
    });
    const res = await fetch(`${base}/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
  } finally {
    await close(server);
  }
});

test('roleGuard - CUSTOMER 토큰으로 /admin-only 호출 시 403, ADMIN 토큰으로 200', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const customerToken = jwt.sign({ userId: 999999, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const forbidden = await fetch(`${base}/admin-only`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(forbidden.status, 403);

    const email = uniqueEmail();
    const hashed = await bcrypt.hash('password123', 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시관리자','ADMIN') RETURNING user_id",
      [email, hashed]
    );
    adminUserId = rows[0].user_id;

    const adminToken = jwt.sign({ userId: adminUserId, role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const ok = await fetch(`${base}/admin-only`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(ok.status, 200);
    const body = await ok.json();
    assert.deepStrictEqual(body, { ok: true });
  } finally {
    await close(server);
  }
});
