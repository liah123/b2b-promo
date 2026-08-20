const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

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
  app.use(express.json());
  app.use('/stamps', require('../src/routes/stamp.routes'));
  app.use(require('../src/middleware/errorHandler'));
  return app;
}

let meUserId;
let meToken;
let otherUserId;
let otherToken;
let emptyUserId;
let emptyToken;

const OTHER_USER_REASON = '타인 전용 사유_고유문자열';

test.before(async () => {
  const hashed = await bcrypt.hash('password123', 10);

  const { rows: meRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객','CUSTOMER') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  meUserId = meRows[0].user_id;
  meToken = jwt.sign({ userId: meUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const { rows: otherRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객2','CUSTOMER') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  otherUserId = otherRows[0].user_id;
  otherToken = jwt.sign({ userId: otherUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const { rows: emptyRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객3','CUSTOMER') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  emptyUserId = emptyRows[0].user_id;
  emptyToken = jwt.sign({ userId: emptyUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  // meUserId 거래: 양파 EARN 3, 양파 USE 1, 당근 EARN 1 (created_at 순서대로 다르게 지정)
  await pool.query(
    `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, created_at)
     VALUES ($1, '양파', 'EARN', 3, '테스트 적립', now() - interval '2 minutes')`,
    [meUserId]
  );
  await pool.query(
    `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, created_at)
     VALUES ($1, '양파', 'USE', 1, '테스트 사용', now() - interval '1 minute')`,
    [meUserId]
  );
  await pool.query(
    `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, created_at)
     VALUES ($1, '당근', 'EARN', 1, '테스트 적립', now())`,
    [meUserId]
  );

  // otherUserId 거래 (격리 검증용)
  await pool.query(
    `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, created_at)
     VALUES ($1, '양파', 'EARN', 5, $2, now())`,
    [otherUserId, OTHER_USER_REASON]
  );
});

test.after(async () => {
  const userIds = [meUserId, otherUserId, emptyUserId].filter(Boolean);
  if (userIds.length > 0) {
    await pool.query('DELETE FROM stamp_transactions WHERE user_id = ANY($1)', [userIds]);
  }
  if (userIds.length > 0) {
    await pool.query('DELETE FROM users WHERE user_id = ANY($1)', [userIds]);
  }
});

test('GET /stamps/balance - 재료별 잔액 정상 조회', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/stamps/balance`, {
      headers: { Authorization: `Bearer ${meToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));

    const onion = body.find((b) => b.ingredientType === '양파');
    const carrot = body.find((b) => b.ingredientType === '당근');
    assert.ok(onion);
    assert.ok(carrot);
    assert.strictEqual(typeof onion.balance, 'number');
    assert.strictEqual(typeof carrot.balance, 'number');
    assert.strictEqual(onion.balance, 2);
    assert.strictEqual(carrot.balance, 1);
  } finally {
    await close(server);
  }
});

test('GET /stamps/balance - 거래 없는 사용자는 빈 배열', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/stamps/balance`, {
      headers: { Authorization: `Bearer ${emptyToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 0);
  } finally {
    await close(server);
  }
});

test('GET /stamps/history - 본인 이력 조회, created_at 내림차순', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/stamps/history`, {
      headers: { Authorization: `Bearer ${meToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 3);

    for (let i = 0; i < body.length - 1; i += 1) {
      const current = new Date(body[i].createdAt).getTime();
      const next = new Date(body[i + 1].createdAt).getTime();
      assert.ok(current >= next, 'created_at 내림차순이어야 함');
    }

    for (const row of body) {
      assert.ok(['EARN', 'USE'].includes(row.type));
      assert.ok(row.reason);
    }
  } finally {
    await close(server);
  }
});

test('GET /stamps/history - 다른 사용자 이력은 노출되지 않음', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/stamps/history`, {
      headers: { Authorization: `Bearer ${meToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const leaked = body.find((row) => row.reason === OTHER_USER_REASON);
    assert.strictEqual(leaked, undefined, '다른 사용자 거래 이력은 포함되면 안 됨');
  } finally {
    await close(server);
  }
});

test('GET /stamps/balance, /stamps/history - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const balanceRes = await fetch(`${base}/stamps/balance`);
    assert.strictEqual(balanceRes.status, 401);

    const historyRes = await fetch(`${base}/stamps/history`);
    assert.strictEqual(historyRes.status, 401);
  } finally {
    await close(server);
  }
});
