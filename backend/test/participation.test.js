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
  app.use('/participations', require('../src/routes/participation.routes'));
  app.use(require('../src/middleware/errorHandler'));
  return app;
}

const HOUR = 60 * 60 * 1000;

let adminUserId;
let adminToken;
let customerUserId;
let customerToken;
let otherCustomerUserId;
let otherCustomerToken;
const createdMissionIds = [];
const MISSION_STAMP_COUNT = 5;
const MISSION_INGREDIENT_TYPE = 'STAMP';

let activeMissionId;
let pendingMissionId;
let endedMissionId;
let otherActiveMissionId;

async function insertMission({ title, startAt, endAt, status }) {
  const { rows } = await pool.query(
    `INSERT INTO missions (title, start_at, end_at, ingredient_type, stamp_count, status, created_by)
     VALUES ($1,$2,$3,'STAMP',5,$4,$5) RETURNING mission_id`,
    [title, startAt, endAt, status, adminUserId]
  );
  const missionId = rows[0].mission_id;
  createdMissionIds.push(missionId);
  return missionId;
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

  activeMissionId = await insertMission({
    title: '진행중 미션',
    startAt: new Date(Date.now() - HOUR),
    endAt: new Date(Date.now() + HOUR),
    status: 'ACTIVE',
  });
  pendingMissionId = await insertMission({
    title: '대기중 미션',
    startAt: new Date(Date.now() + HOUR),
    endAt: new Date(Date.now() + 2 * HOUR),
    status: 'PENDING',
  });
  endedMissionId = await insertMission({
    title: '종료된 미션',
    startAt: new Date(Date.now() - 2 * HOUR),
    endAt: new Date(Date.now() - HOUR),
    status: 'ENDED',
  });
  otherActiveMissionId = await insertMission({
    title: '다른 고객용 진행중 미션',
    startAt: new Date(Date.now() - HOUR),
    endAt: new Date(Date.now() + HOUR),
    status: 'ACTIVE',
  });
});

test.after(async () => {
  const userIds = [customerUserId, otherCustomerUserId].filter(Boolean);
  // FK 순서: stamp_transactions(missions 참조) → mission_participations(missions/users 참조) → missions → users
  if (createdMissionIds.length > 0) {
    await pool.query('DELETE FROM stamp_transactions WHERE related_mission_id = ANY($1)', [createdMissionIds]);
  }
  if (userIds.length > 0 && createdMissionIds.length > 0) {
    await pool.query('DELETE FROM mission_participations WHERE user_id = ANY($1) AND mission_id = ANY($2)', [
      userIds,
      createdMissionIds,
    ]);
  }
  if (createdMissionIds.length > 0) {
    await pool.query('DELETE FROM missions WHERE mission_id = ANY($1)', [createdMissionIds]);
  }
  for (const userId of [adminUserId, customerUserId, otherCustomerUserId]) {
    if (userId) {
      await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    }
  }
});

let firstParticipationId;

test('POST /participations - ACTIVE 미션 참여 시 201, status=JOINED', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ missionId: activeMissionId }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.missionId, activeMissionId);
    assert.strictEqual(body.userId, customerUserId);
    assert.strictEqual(body.status, 'JOINED');
    assert.strictEqual(body.completedAt, null);
    assert.ok(body.joinedAt);
    firstParticipationId = body.participationId;

    const { rows } = await pool.query(
      'SELECT * FROM mission_participations WHERE mission_id = $1 AND user_id = $2',
      [activeMissionId, customerUserId]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});

test('POST /participations - 동일 미션 재참여 시 409', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ missionId: activeMissionId }),
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.ok(body.message);

    const { rows } = await pool.query(
      'SELECT * FROM mission_participations WHERE mission_id = $1 AND user_id = $2',
      [activeMissionId, customerUserId]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});

test('POST /participations - ENDED 미션 참여 시 400', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ missionId: endedMissionId }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.message);

    const { rows } = await pool.query(
      'SELECT * FROM mission_participations WHERE mission_id = $1 AND user_id = $2',
      [endedMissionId, otherCustomerUserId]
    );
    assert.strictEqual(rows.length, 0);
  } finally {
    await close(server);
  }
});

test('POST /participations - PENDING 미션 참여 시 400', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ missionId: pendingMissionId }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.message);

    const { rows } = await pool.query(
      'SELECT * FROM mission_participations WHERE mission_id = $1 AND user_id = $2',
      [pendingMissionId, otherCustomerUserId]
    );
    assert.strictEqual(rows.length, 0);
  } finally {
    await close(server);
  }
});

test('POST /participations - 존재하지 않는 missionId면 404', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ missionId: 999999999 }),
    });
    assert.strictEqual(res.status, 404);
  } finally {
    await close(server);
  }
});

test('GET /participations/me - 본인 참여 이력만 조회되고 필드 포함', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const otherJoinRes = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ missionId: otherActiveMissionId }),
    });
    assert.strictEqual(otherJoinRes.status, 201);
    const otherJoinBody = await otherJoinRes.json();

    const res = await fetch(`${base}/participations/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));

    const mine = body.find((p) => p.participationId === firstParticipationId);
    assert.ok(mine, '본인 참여 이력이 포함되어야 함');
    assert.strictEqual(mine.missionId, activeMissionId);
    assert.strictEqual(mine.userId, customerUserId);
    assert.ok(mine.missionTitle);
    assert.ok(mine.status);
    assert.ok(mine.joinedAt);
    assert.ok('completedAt' in mine);

    const othersEntry = body.find((p) => p.participationId === otherJoinBody.participationId);
    assert.strictEqual(othersEntry, undefined, '다른 사용자 참여 이력은 포함되면 안 됨');
  } finally {
    await close(server);
  }
});

test('POST /participations - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId: activeMissionId }),
    });
    assert.strictEqual(res.status, 401);
  } finally {
    await close(server);
  }
});

test('GET /participations/me - 토큰 없이 호출 시 401', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations/me`);
    assert.strictEqual(res.status, 401);
  } finally {
    await close(server);
  }
});

let completeParticipationId;

test('POST /participations/:id/complete - 정상 완료 처리 시 200, status=COMPLETED', async () => {
  const { server, base } = await listen(buildApp());
  try {
    // activeMissionId는 앞선 BE-06 테스트("ACTIVE 미션 참여 시 201")에서 customerToken으로 이미
    // JOINED 상태로 참여되어 firstParticipationId에 저장돼 있다 — (mission_id, user_id) UNIQUE 제약상
    // 재참여를 시도하면 409가 나므로, 새로 join하지 않고 그 participationId를 그대로 재사용한다.
    completeParticipationId = firstParticipationId;

    const res = await fetch(`${base}/participations/${completeParticipationId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.participationId, completeParticipationId);
    assert.strictEqual(body.missionId, activeMissionId);
    assert.strictEqual(body.userId, customerUserId);
    assert.strictEqual(body.status, 'COMPLETED');
    assert.ok(body.joinedAt);
    assert.ok(body.completedAt);
  } finally {
    await close(server);
  }
});

test('POST /participations/:id/complete - 완료 처리 시 stamp_transactions 1건 생성', async () => {
  const { rows } = await pool.query(
    'SELECT * FROM stamp_transactions WHERE related_mission_id = $1 AND user_id = $2',
    [activeMissionId, customerUserId]
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].type, 'EARN');
  assert.strictEqual(Number(rows[0].amount), MISSION_STAMP_COUNT);
  assert.strictEqual(rows[0].ingredient_type, MISSION_INGREDIENT_TYPE);
});

test('POST /participations/:id/complete - 이미 완료된 참여건 재요청 시 409, 중복 지급 없음', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations/${completeParticipationId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 409);

    const { rows } = await pool.query(
      'SELECT * FROM stamp_transactions WHERE related_mission_id = $1 AND user_id = $2',
      [activeMissionId, customerUserId]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});

test('POST /participations/:id/complete - 타인 소유 참여건 접근 시 403', async () => {
  const { server, base } = await listen(buildApp());
  try {
    // otherActiveMissionId는 이미 앞선 테스트에서 otherCustomerToken으로 참여되어 있으므로(UNIQUE 제약),
    // 재참여 충돌을 피하기 위해 이 테스트 전용 새 ACTIVE 미션을 만들어 참여시킨다.
    const forbiddenTestMissionId = await insertMission({
      title: `403 테스트용 미션 ${Date.now()}`,
      startAt: new Date(Date.now() - HOUR),
      endAt: new Date(Date.now() + HOUR),
      status: 'ACTIVE',
    });
    createdMissionIds.push(forbiddenTestMissionId);

    const joinRes = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ missionId: forbiddenTestMissionId }),
    });
    assert.strictEqual(joinRes.status, 201);
    const joinBody = await joinRes.json();

    const res = await fetch(`${base}/participations/${joinBody.participationId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 403);
  } finally {
    await close(server);
  }
});

test('POST /participations/:id/complete - 존재하지 않는 participationId면 404', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const res = await fetch(`${base}/participations/999999999/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 404);
  } finally {
    await close(server);
  }
});

test('POST /participations/:id/confirm - ADMIN 확인 처리 시 200, 스탬프는 참여자 본인에게 지급', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const confirmMissionId = await insertMission({
      title: 'ADMIN 확인용 미션',
      startAt: new Date(Date.now() - HOUR),
      endAt: new Date(Date.now() + HOUR),
      status: 'ACTIVE',
    });

    const joinRes = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ missionId: confirmMissionId }),
    });
    assert.strictEqual(joinRes.status, 201);
    const joinBody = await joinRes.json();

    const res = await fetch(`${base}/participations/${joinBody.participationId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'COMPLETED');

    const { rows } = await pool.query(
      'SELECT * FROM stamp_transactions WHERE related_mission_id = $1 AND user_id = $2',
      [confirmMissionId, otherCustomerUserId]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});

test('POST /participations/:id/complete - 동시 요청 시 하나만 성공하고 스탬프는 1건만 지급', async () => {
  const { server, base } = await listen(buildApp());
  try {
    const raceMissionId = await insertMission({
      title: '동시요청 검증용 미션',
      startAt: new Date(Date.now() - HOUR),
      endAt: new Date(Date.now() + HOUR),
      status: 'ACTIVE',
    });

    const joinRes = await fetch(`${base}/participations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ missionId: raceMissionId }),
    });
    assert.strictEqual(joinRes.status, 201);
    const joinBody = await joinRes.json();

    const call = () =>
      fetch(`${base}/participations/${joinBody.participationId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

    const [res1, res2] = await Promise.all([call(), call()]);
    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 409]);

    const { rows } = await pool.query(
      'SELECT * FROM stamp_transactions WHERE related_mission_id = $1 AND user_id = $2',
      [raceMissionId, customerUserId]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});
