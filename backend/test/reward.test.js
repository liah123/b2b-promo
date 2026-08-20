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
  app.use('/rewards', require('../src/routes/reward.routes'));
  app.use(require('../src/middleware/errorHandler'));
  return app;
}

let adminUserId;
let adminToken;
let customerUserId;
let customerToken;
const createdRewardIds = [];

test.before(async () => {
  const email = uniqueEmail();
  const hashed = await bcrypt.hash('password123', 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시관리자','ADMIN') RETURNING user_id",
    [email, hashed]
  );
  adminUserId = rows[0].user_id;
  adminToken = jwt.sign({ userId: adminUserId, role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  const customerEmail = uniqueEmail();
  const { rows: customerRows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'임시고객','CUSTOMER') RETURNING user_id",
    [customerEmail, hashed]
  );
  customerUserId = customerRows[0].user_id;
  customerToken = jwt.sign({ userId: customerUserId, role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
});

test.after(async () => {
  if (customerUserId) {
    await pool.query('DELETE FROM stamp_transactions WHERE user_id = $1', [customerUserId]);
  }
  if (createdRewardIds.length > 0) {
    await pool.query('DELETE FROM rewards WHERE reward_id = ANY($1)', [createdRewardIds]);
  }
  if (adminUserId || customerUserId) {
    await pool.query('DELETE FROM users WHERE user_id = ANY($1)', [[adminUserId, customerUserId]]);
  }
});

function rewardPayload(overrides = {}) {
  return {
    name: '테스트 리워드',
    description: '테스트용 리워드 설명',
    recipe: [
      { ingredientType: '양파', quantity: 2 },
      { ingredientType: '당근', quantity: 1 },
    ],
    ...overrides,
  };
}

let rewardId;

test('POST /rewards - ADMIN 토큰 + 정상 recipe로 생성 시 201, status=ACTIVE', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const payload = rewardPayload();
    const res = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'ACTIVE');
    assert.deepStrictEqual(body.recipe, payload.recipe);
    rewardId = body.rewardId;
    createdRewardIds.push(rewardId);

    const { rows } = await pool.query('SELECT status, recipe FROM rewards WHERE reward_id = $1', [rewardId]);
    assert.strictEqual(rows[0].status, 'ACTIVE');
    assert.deepStrictEqual(rows[0].recipe, payload.recipe);
  } finally {
    await close(server);
  }
});

test('POST /rewards - recipe가 빈 배열이면 400', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(rewardPayload({ recipe: [] })),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    await close(server);
  }
});

test('POST /rewards - recipe의 quantity가 0 이하이면 400', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const zeroRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(rewardPayload({ recipe: [{ ingredientType: '양파', quantity: 0 }] })),
    });
    assert.strictEqual(zeroRes.status, 400);

    const negativeRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(rewardPayload({ recipe: [{ ingredientType: '양파', quantity: -1 }] })),
    });
    assert.strictEqual(negativeRes.status, 400);
  } finally {
    await close(server);
  }
});

test('PATCH /rewards/:rewardId/status - ACTIVE -> INACTIVE 전환', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(rewardId, '앞선 리워드 생성 테스트가 선행되어야 함');
    const res = await fetch(`${base}/rewards/${rewardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'INACTIVE');

    const { rows } = await pool.query('SELECT status FROM rewards WHERE reward_id = $1', [rewardId]);
    assert.strictEqual(rows[0].status, 'INACTIVE');
  } finally {
    await close(server);
  }
});

test('PATCH /rewards/:rewardId/status - INACTIVE -> ACTIVE 양방향 토글 가능 (미션의 단방향 종료와 다름)', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(rewardId, '앞선 리워드 생성 테스트가 선행되어야 함');
    const res = await fetch(`${base}/rewards/${rewardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ACTIVE');

    const { rows } = await pool.query('SELECT status FROM rewards WHERE reward_id = $1', [rewardId]);
    assert.strictEqual(rows[0].status, 'ACTIVE');
  } finally {
    await close(server);
  }
});

test('CUSTOMER 토큰으로 리워드 생성/수정/상태변경 호출 시 403', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(rewardId, '앞선 리워드 생성 테스트가 선행되어야 함');

    const postRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(rewardPayload()),
    });
    assert.strictEqual(postRes.status, 403);

    const patchRes = await fetch(`${base}/rewards/${rewardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ name: '변경 시도' }),
    });
    assert.strictEqual(patchRes.status, 403);

    const statusRes = await fetch(`${base}/rewards/${rewardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert.strictEqual(statusRes.status, 403);
  } finally {
    await close(server);
  }
});

test('존재하지 않는 rewardId면 PATCH /rewards/:rewardId, /status 모두 404', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const patchRes = await fetch(`${base}/rewards/999999999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: '없는 리워드' }),
    });
    assert.strictEqual(patchRes.status, 404);

    const statusRes = await fetch(`${base}/rewards/999999999/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert.strictEqual(statusRes.status, 404);
  } finally {
    await close(server);
  }
});

const { canRedeem } = require('../src/services/reward.service');

test('canRedeem - 보유량이 recipe 요구량 이상이면 true', () => {
  const balances = [
    { ingredientType: '양파', balance: 3 },
    { ingredientType: '당근', balance: 2 },
  ];
  const recipe = [
    { ingredientType: '양파', quantity: 2 },
    { ingredientType: '당근', quantity: 1 },
  ];
  assert.strictEqual(canRedeem(balances, recipe), true);
});

test('canRedeem - balance가 0이면 false', () => {
  const balances = [
    { ingredientType: '양파', balance: 3 },
    { ingredientType: '당근', balance: 0 },
  ];
  const recipe = [
    { ingredientType: '양파', quantity: 2 },
    { ingredientType: '당근', quantity: 1 },
  ];
  assert.strictEqual(canRedeem(balances, recipe), false);
});

test('canRedeem - balances에 해당 재료 항목 자체가 없으면 0으로 간주하여 false', () => {
  const balances = [{ ingredientType: '양파', balance: 3 }];
  const recipe = [
    { ingredientType: '양파', quantity: 2 },
    { ingredientType: '당근', quantity: 1 },
  ];
  assert.strictEqual(canRedeem(balances, recipe), false);
});

test('GET /rewards - CUSTOMER 토큰으로 조회 시 ACTIVE 리워드만 반환하고 canRedeem 판정 포함', async () => {
  const { server, base } = await listen(buildApp());
  try {
    // ACTIVE 리워드 준비: 카레(양파2+당근1), 감자탕(감자5)
    const curryRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        rewardPayload({
          name: '카레',
          recipe: [
            { ingredientType: '양파', quantity: 2 },
            { ingredientType: '당근', quantity: 1 },
          ],
        })
      ),
    });
    assert.strictEqual(curryRes.status, 201);
    const curry = await curryRes.json();
    createdRewardIds.push(curry.rewardId);

    const stewRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        rewardPayload({
          name: '감자탕',
          recipe: [{ ingredientType: '감자', quantity: 5 }],
        })
      ),
    });
    assert.strictEqual(stewRes.status, 201);
    const stew = await stewRes.json();
    createdRewardIds.push(stew.rewardId);

    // INACTIVE 리워드 준비
    const inactiveCreateRes = await fetch(`${base}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(rewardPayload({ name: '비활성 리워드' })),
    });
    assert.strictEqual(inactiveCreateRes.status, 201);
    const inactiveReward = await inactiveCreateRes.json();
    createdRewardIds.push(inactiveReward.rewardId);

    const inactiveStatusRes = await fetch(`${base}/rewards/${inactiveReward.rewardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert.strictEqual(inactiveStatusRes.status, 200);

    // customerUserId 앞으로 EARN 트랜잭션: 양파 3, 당근 2
    await pool.query(
      "INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, related_mission_id) VALUES ($1,'양파','EARN',3,'테스트 적립',NULL), ($1,'당근','EARN',2,'테스트 적립',NULL)",
      [customerUserId]
    );

    const res = await fetch(`${base}/rewards`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));

    assert.strictEqual(
      body.some((r) => r.rewardId === inactiveReward.rewardId),
      false
    );

    const curryItem = body.find((r) => r.rewardId === curry.rewardId);
    assert.ok(curryItem);
    assert.strictEqual(curryItem.canRedeem, true);

    const stewItem = body.find((r) => r.rewardId === stew.rewardId);
    assert.ok(stewItem);
    assert.strictEqual(stewItem.canRedeem, false);

    for (const item of body) {
      assert.strictEqual(typeof item.canRedeem, 'boolean');
    }
  } finally {
    await close(server);
  }
});
