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
  app.use('/redemptions', require('../src/routes/redemption.routes'));
  app.use('/rewards', require('../src/routes/reward.routes'));
  app.use('/stamps', require('../src/routes/stamp.routes'));
  app.use(require('../src/middleware/errorHandler'));
  return app;
}

let adminUserId;
let adminToken;
let customerUserId;
let customerToken;
let otherCustomerUserId;
let otherCustomerToken;
const createdRewardIds = [];

let sufficientRewardId;
let insufficientRewardId;
let inactiveRewardId;

function rewardPayload(overrides = {}) {
  return {
    name: '테스트 리워드',
    description: '테스트용 리워드 설명',
    recipe: [{ ingredientType: 'STAMP', quantity: 1 }],
    ...overrides,
  };
}

test.before(async () => {
  const hashed = await bcrypt.hash('password123', 10);

  const { rows: adminRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시관리자','ADMIN') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  adminUserId = adminRows[0].user_id;
  adminToken = jwt.sign({ userId: adminUserId, role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const { rows: customerRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객','CUSTOMER') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  customerUserId = customerRows[0].user_id;
  customerToken = jwt.sign({ userId: customerUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const { rows: otherRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객2','CUSTOMER') RETURNING user_id",
    [uniqueEmail(), hashed]
  );
  otherCustomerUserId = otherRows[0].user_id;
  otherCustomerToken = jwt.sign({ userId: otherCustomerUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const app = buildApp();
  const { server, base } = await listen(app);
  try {
    const sufficientRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        rewardPayload({ name: '충분한 리워드', recipe: [{ ingredientType: 'STAMP', quantity: 3 }] })
      ),
    });
    assert.strictEqual(sufficientRes.status, 201);
    sufficientRewardId = (await sufficientRes.json()).rewardId;
    createdRewardIds.push(sufficientRewardId);

    const insufficientRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        rewardPayload({ name: '부족한 리워드', recipe: [{ ingredientType: 'STAMP', quantity: 100 }] })
      ),
    });
    assert.strictEqual(insufficientRes.status, 201);
    insufficientRewardId = (await insufficientRes.json()).rewardId;
    createdRewardIds.push(insufficientRewardId);

    const inactiveCreateRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        rewardPayload({ name: '비활성 리워드', recipe: [{ ingredientType: 'STAMP', quantity: 1 }] })
      ),
    });
    assert.strictEqual(inactiveCreateRes.status, 201);
    inactiveRewardId = (await inactiveCreateRes.json()).rewardId;
    createdRewardIds.push(inactiveRewardId);

    const inactiveStatusRes = await fetch(`${base}/rewards/${inactiveRewardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert.strictEqual(inactiveStatusRes.status, 200);
  } finally {
    await close(server);
  }

  await pool.query(
    "INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, related_mission_id) VALUES ($1,'STAMP','EARN',5,'테스트 적립',NULL)",
    [customerUserId]
  );
});

test.after(async () => {
  // FK 순서: stamp_transactions → reward_redemptions → rewards → users
  const userIds = [customerUserId, otherCustomerUserId].filter(Boolean);
  if (userIds.length > 0) {
    await pool.query('DELETE FROM stamp_transactions WHERE user_id = ANY($1)', [userIds]);
  }
  if (customerUserId) {
    await pool.query('DELETE FROM reward_redemptions WHERE user_id = $1', [customerUserId]);
  }
  if (createdRewardIds.length > 0) {
    await pool.query('DELETE FROM rewards WHERE reward_id = ANY($1)', [createdRewardIds]);
  }
  for (const userId of [adminUserId, customerUserId, otherCustomerUserId]) {
    if (userId) {
      await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    }
  }
});

let redemptionId;

test('POST /redemptions - 재료 충분한 리워드 교환 시 201', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ rewardId: sufficientRewardId }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.redemptionId);
    assert.strictEqual(body.rewardId, sufficientRewardId);
    assert.strictEqual(body.userId, customerUserId);
    assert.ok(body.rewardName);
    assert.ok(body.redeemedAt);
    redemptionId = body.redemptionId;
  } finally {
    await close(server);
  }
});

test('POST /redemptions - 성공 시 stamp_transactions에 USE 1건 생성 (재료 1종류 * quantity 3)', async () => {
  const { rows } = await pool.query(
    "SELECT * FROM stamp_transactions WHERE related_redemption_id = $1 AND type = 'USE'",
    [redemptionId]
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(Number(rows[0].amount), 3);
  assert.strictEqual(rows[0].ingredient_type, 'STAMP');
  assert.strictEqual(rows[0].reason, '쿠폰 사용');
});

test('POST /redemptions - 성공 후 STAMP 잔액이 5에서 3 차감되어 2', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/stamps/balance`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const stamp = body.find((b) => b.ingredientType === 'STAMP');
    assert.ok(stamp);
    assert.strictEqual(stamp.balance, 2);
  } finally {
    await close(server);
  }
});

test('POST /redemptions - 재료 부족한 리워드는 400, 부작용 없음', async () => {
  const before = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [
    insufficientRewardId,
  ]);
  const beforeStampUse = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE reason = '쿠폰 사용' AND user_id = $1",
    [customerUserId]
  );

  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ rewardId: insufficientRewardId }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.message);
  } finally {
    await close(server);
  }

  const after = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [
    insufficientRewardId,
  ]);
  const afterStampUse = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE reason = '쿠폰 사용' AND user_id = $1",
    [customerUserId]
  );
  assert.strictEqual(after.rows[0].count, before.rows[0].count);
  assert.strictEqual(afterStampUse.rows[0].count, beforeStampUse.rows[0].count);
});

test('POST /redemptions - 비활성 리워드는 400, 부작용 없음', async () => {
  const before = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [
    inactiveRewardId,
  ]);
  const beforeStampUse = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE reason = '쿠폰 사용' AND user_id = $1",
    [customerUserId]
  );

  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ rewardId: inactiveRewardId }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.message);
  } finally {
    await close(server);
  }

  const after = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [
    inactiveRewardId,
  ]);
  const afterStampUse = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE reason = '쿠폰 사용' AND user_id = $1",
    [customerUserId]
  );
  assert.strictEqual(after.rows[0].count, before.rows[0].count);
  assert.strictEqual(afterStampUse.rows[0].count, beforeStampUse.rows[0].count);
});

test('POST /redemptions - 존재하지 않는 rewardId면 404', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ rewardId: 999999999 }),
    });
    assert.strictEqual(res.status, 404);
  } finally {
    await close(server);
  }
});

test('GET /redemptions/me - 본인 교환 이력만 조회되고 필드 포함', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));

    const mine = body.find((r) => r.redemptionId === redemptionId);
    assert.ok(mine, '본인 교환 이력이 포함되어야 함');
    assert.strictEqual(mine.rewardId, sufficientRewardId);
    assert.ok(mine.rewardName);
    assert.ok(mine.redeemedAt);
    assert.deepStrictEqual(mine.usedIngredients, [{ ingredientType: 'STAMP', quantity: 3 }]);
  } finally {
    await close(server);
  }
});

test('GET /redemptions/me - 다른 사용자 교환 이력은 노출되지 않음(격리)', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/redemptions/me`, {
      headers: { Authorization: `Bearer ${otherCustomerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const leaked = body.find((r) => r.redemptionId === redemptionId);
    assert.strictEqual(leaked, undefined, '다른 사용자 교환 이력은 포함되면 안 됨');
  } finally {
    await close(server);
  }
});

test('POST /redemptions, GET /redemptions/me - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const postRes = await fetch(`${base}/redemptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId: sufficientRewardId }),
    });
    assert.strictEqual(postRes.status, 401);

    const getRes = await fetch(`${base}/redemptions/me`);
    assert.strictEqual(getRes.status, 401);
  } finally {
    await close(server);
  }
});
