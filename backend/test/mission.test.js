const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');
const { calcMissionStatus } = require('../src/services/mission.service');

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
  app.use('/missions', require('../src/routes/mission.routes'));
  app.use(require('../src/middleware/errorHandler'));
  return app;
}

const HOUR = 60 * 60 * 1000;

let adminUserId;
let adminToken;
let customerUserId;
let customerToken;
const createdMissionIds = [];

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
  if (customerUserId && createdMissionIds.length > 0) {
    await pool.query('DELETE FROM mission_participations WHERE user_id = $1 AND mission_id = ANY($2)', [
      customerUserId,
      createdMissionIds,
    ]);
  }
  if (createdMissionIds.length > 0) {
    await pool.query('DELETE FROM missions WHERE mission_id = ANY($1)', [createdMissionIds]);
  }
  if (adminUserId) {
    await pool.query('DELETE FROM users WHERE user_id = $1', [adminUserId]);
  }
  if (customerUserId) {
    await pool.query('DELETE FROM users WHERE user_id = $1', [customerUserId]);
  }
});

function missionPayload(overrides = {}) {
  return {
    title: '테스트 미션',
    ingredientType: 'STAMP',
    stampCount: 5,
    startAt: new Date(Date.now() + HOUR).toISOString(),
    endAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    ...overrides,
  };
}

test('POST /missions - startAt이 미래인 미션 생성 시 201, status=PENDING', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() + HOUR).toISOString(),
          endAt: new Date(Date.now() + 2 * HOUR).toISOString(),
        })
      ),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'PENDING');
    assert.strictEqual(body.createdBy, adminUserId);
    createdMissionIds.push(body.missionId);

    const { rows } = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [body.missionId]);
    assert.strictEqual(rows[0].status, 'PENDING');
  } finally {
    await close(server);
  }
});

let activeMissionId;

test('POST /missions - startAt 과거·endAt 미래인 미션 생성 시 201, status=ACTIVE', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - HOUR).toISOString(),
          endAt: new Date(Date.now() + HOUR).toISOString(),
        })
      ),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'ACTIVE');
    assert.strictEqual(body.createdBy, adminUserId);
    activeMissionId = body.missionId;
    createdMissionIds.push(body.missionId);

    const { rows } = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [body.missionId]);
    assert.strictEqual(rows[0].status, 'ACTIVE');
  } finally {
    await close(server);
  }
});

test('POST /missions - endAt이 과거인 미션 생성 시 201, status=ENDED', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - 2 * HOUR).toISOString(),
          endAt: new Date(Date.now() - HOUR).toISOString(),
        })
      ),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'ENDED');
    assert.strictEqual(body.createdBy, adminUserId);
    createdMissionIds.push(body.missionId);

    const { rows } = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [body.missionId]);
    assert.strictEqual(rows[0].status, 'ENDED');
  } finally {
    await close(server);
  }
});

test('PATCH /missions/:missionId/status - ACTIVE 미션을 ENDED로 수동 종료', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(activeMissionId, '앞선 ACTIVE 미션 생성 테스트가 선행되어야 함');
    const res = await fetch(`${base}/missions/${activeMissionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ENDED' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ENDED');

    const { rows } = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [activeMissionId]);
    assert.strictEqual(rows[0].status, 'ENDED');
  } finally {
    await close(server);
  }
});

test('POST /missions - CUSTOMER 토큰으로 호출 시 403', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(missionPayload()),
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.ok(body.message);
  } finally {
    await close(server);
  }
});

test('POST /missions - endAt <= startAt 이면 400, stampCount <= 0 이면 400', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const now = Date.now();
    const invalidDateRange = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(now + HOUR).toISOString(),
          endAt: new Date(now).toISOString(),
        })
      ),
    });
    assert.strictEqual(invalidDateRange.status, 400);
    const body1 = await invalidDateRange.json();
    assert.ok(body1.message);

    const invalidStampCount = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(missionPayload({ stampCount: 0 })),
    });
    assert.strictEqual(invalidStampCount.status, 400);
    const body2 = await invalidStampCount.json();
    assert.ok(body2.message);
  } finally {
    await close(server);
  }
});

let pendingMissionId;
let endedMissionId;
let joinedMissionId;
let completedMissionId;

test('GET /missions - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions`);
    assert.strictEqual(res.status, 401);
  } finally {
    await close(server);
  }
});

test('GET /missions/:missionId - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions/${activeMissionId}`);
    assert.strictEqual(res.status, 401);
  } finally {
    await close(server);
  }
});

test('GET /missions - CUSTOMER 토큰으로 호출 시 PENDING/ACTIVE만 포함, ENDED 미포함, participationStatus 필드 포함', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const pendingRes = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() + HOUR).toISOString(),
          endAt: new Date(Date.now() + 2 * HOUR).toISOString(),
        })
      ),
    });
    const pendingBody = await pendingRes.json();
    pendingMissionId = pendingBody.missionId;
    createdMissionIds.push(pendingMissionId);

    const endedRes = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - 2 * HOUR).toISOString(),
          endAt: new Date(Date.now() - HOUR).toISOString(),
        })
      ),
    });
    const endedBody = await endedRes.json();
    endedMissionId = endedBody.missionId;
    createdMissionIds.push(endedMissionId);

    // activeMissionId는 앞선 "수동 종료" 테스트에서 이미 ENDED로 전환됐으므로 재사용하지 않고
    // 이 테스트 전용으로 새 ACTIVE 미션을 만든다 (테스트 간 상태 공유로 인한 순서 의존성 방지).
    const freshActiveRes = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - HOUR).toISOString(),
          endAt: new Date(Date.now() + HOUR).toISOString(),
        })
      ),
    });
    const freshActiveBody = await freshActiveRes.json();
    const freshActiveMissionId = freshActiveBody.missionId;
    createdMissionIds.push(freshActiveMissionId);

    const res = await fetch(`${base}/missions`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const ids = body.map((m) => m.missionId);

    assert.ok(ids.includes(pendingMissionId));
    assert.ok(ids.includes(freshActiveMissionId));
    assert.ok(!ids.includes(endedMissionId));

    const pendingInList = body.find((m) => m.missionId === pendingMissionId);
    assert.strictEqual(pendingInList.participationStatus, null);
  } finally {
    await close(server);
  }
});

test('GET /missions - 참여 이력(JOINED/COMPLETED)이 있으면 participationStatus에 반영', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const joinedRes = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - HOUR).toISOString(),
          endAt: new Date(Date.now() + HOUR).toISOString(),
        })
      ),
    });
    joinedMissionId = (await joinedRes.json()).missionId;
    createdMissionIds.push(joinedMissionId);

    const completedRes = await fetch(`${base}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(
        missionPayload({
          startAt: new Date(Date.now() - HOUR).toISOString(),
          endAt: new Date(Date.now() + HOUR).toISOString(),
        })
      ),
    });
    completedMissionId = (await completedRes.json()).missionId;
    createdMissionIds.push(completedMissionId);

    await pool.query(
      "INSERT INTO mission_participations (mission_id, user_id, status) VALUES ($1,$2,'JOINED')",
      [joinedMissionId, customerUserId]
    );
    await pool.query(
      "INSERT INTO mission_participations (mission_id, user_id, status, completed_at) VALUES ($1,$2,'COMPLETED', now())",
      [completedMissionId, customerUserId]
    );

    const res = await fetch(`${base}/missions`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    const joined = body.find((m) => m.missionId === joinedMissionId);
    const completed = body.find((m) => m.missionId === completedMissionId);
    assert.strictEqual(joined.participationStatus, 'JOINED');
    assert.strictEqual(completed.participationStatus, 'COMPLETED');
  } finally {
    await close(server);
  }
});

test('GET /missions - ADMIN 토큰으로 호출 시 ENDED 미션도 여전히 포함 (BE-04 회귀 검증)', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(endedMissionId, '앞선 ENDED 미션 생성 테스트가 선행되어야 함');
    const res = await fetch(`${base}/missions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const ids = body.map((m) => m.missionId);
    assert.ok(ids.includes(endedMissionId));

    const endedInList = body.find((m) => m.missionId === endedMissionId);
    assert.strictEqual(endedInList.participationStatus, undefined);
  } finally {
    await close(server);
  }
});

test('GET /missions/:missionId - CUSTOMER 토큰으로 상세 조회 시 completionCondition/ingredientType/stampCount 포함', async () => {
  const { server, base } = await listen(buildApp());
  try {
    assert.ok(pendingMissionId, '앞선 PENDING 미션 생성 테스트가 선행되어야 함');
    const res = await fetch(`${base}/missions/${pendingMissionId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.missionId, pendingMissionId);
    assert.ok('completionCondition' in body);
    assert.ok('ingredientType' in body);
    assert.ok('stampCount' in body);
    assert.strictEqual(body.participationStatus, null);
  } finally {
    await close(server);
  }
});

test('GET /missions/:missionId - 존재하지 않는 missionId면 404', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/missions/999999999`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 404);
  } finally {
    await close(server);
  }
});

test('calcMissionStatus - 경계값 검증 (PENDING/ACTIVE/ENDED)', () => {
  const startAt = new Date('2026-01-01T00:00:00Z');
  const endAt = new Date('2026-01-02T00:00:00Z');

  assert.strictEqual(calcMissionStatus(startAt, endAt, new Date('2025-12-31T23:59:59Z')), 'PENDING');
  assert.strictEqual(calcMissionStatus(startAt, endAt, new Date('2026-01-01T00:00:00Z')), 'ACTIVE');
  assert.strictEqual(calcMissionStatus(startAt, endAt, new Date('2026-01-02T00:00:00Z')), 'ACTIVE');
  assert.strictEqual(calcMissionStatus(startAt, endAt, new Date('2026-01-02T00:00:01Z')), 'ENDED');
});
