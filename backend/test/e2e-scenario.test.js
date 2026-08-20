// docs/4-user-scenari.md의 14개 사용자 시나리오를 순서대로 따라가는 E2E 테스트.
// 실제 API(회원가입→로그인→적립요청→적립확인→쿠폰받기→마이페이지, 관리자 흐름, 예외 케이스)를
// require('../src/app')로 가져온 전체 앱에 대해 순차 실행한다. 별도 개발 서버는 띄우지 않는다.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
  // 이 파일은 test.before()에서 서버 하나를 열어 20여 개 테스트가 순차로 재사용한다.
  // 그만큼 fetch()의 keep-alive 커넥션이 쌓여 있어 server.close()만 호출하면
  // 열린 소켓이 정리될 때까지 무기한 대기(행)한다 — closeAllConnections()로 강제 정리한다.
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
}

function uniqueEmail(tag) {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function parseRefreshCookie(setCookieHeader) {
  const m = /refreshToken=([^;]+)/.exec(setCookieHeader || '');
  return m ? m[1] : null;
}

const HOUR = 60 * 60 * 1000;

// 시나리오 전체에서 공유하는 상태
let app;
let server;
let base;

const createdEmails = [];
const createdMissionIds = [];
const createdRewardIds = [];

let actorAEmail;
let actorAPassword = 'password123';
let actorAUserId;
let actorAAccessToken;
let actorARefreshToken;

let adminUserId;
let adminToken;

let activeMissionId; // 시나리오 3~4용 (곧 종료되지 않는 ACTIVE 미션)
let activeParticipationId;

let curryRewardId; // 시나리오 5, 12, 13용 (양파2 + 당근1)

test.before(async () => {
  app = require('../src/app');
  ({ server, base } = await listen(app));

  // 관리자 B는 회원가입으로 만들 수 없으므로(항상 CUSTOMER) DB에 직접 생성
  const adminEmail = uniqueEmail('admin');
  createdEmails.push(adminEmail);
  const hashed = await bcrypt.hash('adminpass123', 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password, name, role) VALUES ($1,$2,'관리자B','ADMIN') RETURNING user_id",
    [adminEmail, hashed]
  );
  adminUserId = rows[0].user_id;
  adminToken = jwt.sign({ userId: adminUserId, role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
});

test.after(async () => {
  await pool.query('DELETE FROM stamp_transactions WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))', [createdEmails]);
  await pool.query('DELETE FROM reward_redemptions WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))', [createdEmails]);
  await pool.query('DELETE FROM mission_participations WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))', [createdEmails]);
  if (createdRewardIds.length > 0) {
    await pool.query('DELETE FROM rewards WHERE reward_id = ANY($1)', [createdRewardIds]);
  }
  if (createdMissionIds.length > 0) {
    await pool.query('DELETE FROM missions WHERE mission_id = ANY($1)', [createdMissionIds]);
  }
  await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))', [createdEmails]);
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [createdEmails]);
  await close(server);
});

// ── 시나리오 1: 회원가입 (거래처 담당자) ─────────────────────────────
test('시나리오 1: 회원가입 - A가 이메일/비밀번호/이름으로 CUSTOMER 계정을 생성한다', async () => {
  actorAEmail = uniqueEmail('actorA');
  createdEmails.push(actorAEmail);

  const res = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: actorAPassword, name: '거래처담당자A' }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.email, actorAEmail);
  assert.strictEqual(body.role, 'CUSTOMER');
  actorAUserId = body.userId;
});

// ── 시나리오 2: 로그인 / 로그아웃 ─────────────────────────────────
test('시나리오 2: 로그인 - A가 로그인하여 access/refresh token을 발급받는다', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: actorAPassword }),
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.accessToken);
  actorAAccessToken = body.accessToken;
  actorARefreshToken = parseRefreshCookie(res.headers.get('set-cookie'));
  assert.ok(actorARefreshToken);
});

test('시나리오 2: 로그아웃 - 로그아웃 후 refresh token이 폐기되어 재사용 시 401', async () => {
  const logoutRes = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `refreshToken=${actorARefreshToken}` },
  });
  assert.strictEqual(logoutRes.status, 204);

  const refreshRes = await fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `refreshToken=${actorARefreshToken}` },
  });
  assert.strictEqual(refreshRes.status, 401);

  // 이후 시나리오 진행을 위해 다시 로그인해서 유효한 토큰 확보
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: actorAPassword }),
  });
  const loginBody = await loginRes.json();
  actorAAccessToken = loginBody.accessToken;
  actorARefreshToken = parseRefreshCookie(loginRes.headers.get('set-cookie'));
});

// ── 시나리오 7: 적립 항목 등록 (관리자) — 3번 시나리오의 전제 준비 ──────
test('시나리오 7: 적립 항목 등록 - B가 ACTIVE 상태 적립 항목을 등록한다', async () => {
  const res = await fetch(`${base}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: '방문 적립 (E2E)',
      description: '매장 방문 확인 시 스탬프가 적립됩니다.',
      startAt: new Date(Date.now() - HOUR).toISOString(),
      endAt: new Date(Date.now() + 24 * HOUR).toISOString(),
      completionCondition: '직원 확인 후 적립',
      ingredientType: '양파',
      stampCount: 2,
    }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.status, 'ACTIVE');
  activeMissionId = body.missionId;
  createdMissionIds.push(activeMissionId);
});

// ── 시나리오 3: 스탬프 적립 안내 확인 및 적립 요청 ───────────────────
test('시나리오 3: 적립 안내 확인 - A가 목록/상세에서 진행중 항목을 확인한다', async () => {
  const listRes = await fetch(`${base}/missions`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(listRes.status, 200);
  const list = await listRes.json();
  const mine = list.find((m) => m.missionId === activeMissionId);
  assert.ok(mine, '진행중 항목이 목록에 있어야 함');
  assert.strictEqual(mine.participationStatus, null);

  const detailRes = await fetch(`${base}/missions/${activeMissionId}`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.strictEqual(detail.ingredientType, '양파');
  assert.strictEqual(detail.stampCount, 2);
});

test('시나리오 3: 적립 요청 - A가 참여하면 JOINED 상태의 참여건이 생성된다', async () => {
  const res = await fetch(`${base}/participations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ missionId: activeMissionId }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.status, 'JOINED');
  activeParticipationId = body.participationId;

  const mineRes = await fetch(`${base}/participations/me`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const mine = await mineRes.json();
  const found = mine.find((p) => p.participationId === activeParticipationId);
  assert.ok(found, '적립 진행 현황(직원 확인 대기)에 표시되어야 함');
  assert.strictEqual(found.status, 'JOINED');
});

// ── 시나리오 4: 적립 확인 및 스탬프 적립 ─────────────────────────────
test('시나리오 4: 적립 확인 - 확인 요청 시 COMPLETED 전이 및 스탬프 EARN 지급', async () => {
  const res = await fetch(`${base}/participations/${activeParticipationId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'COMPLETED');
  assert.ok(body.completedAt);

  const balanceRes = await fetch(`${base}/stamps/balance`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const balances = await balanceRes.json();
  const onion = balances.find((b) => b.ingredientType === '양파');
  assert.ok(onion, '양파 스탬프 보유량이 있어야 함');
  assert.strictEqual(onion.balance, 2);

  const historyRes = await fetch(`${base}/stamps/history`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const history = await historyRes.json();
  const earnEntry = history.find((h) => h.type === 'EARN' && h.ingredientType === '양파');
  assert.ok(earnEntry, '적립 이력이 존재해야 함');
  assert.strictEqual(earnEntry.reason, '적립 확인');
});

// 시나리오 5(쿠폰 받기)를 위해 당근도 1개 이상 확보 — 별도 적립 항목으로 진행
test('보조: 당근 적립용 항목 등록·참여·확인 (시나리오 5 전제 준비)', async () => {
  const carrotMissionRes = await fetch(`${base}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: '당근 적립 (E2E)',
      startAt: new Date(Date.now() - HOUR).toISOString(),
      endAt: new Date(Date.now() + 24 * HOUR).toISOString(),
      completionCondition: '직원 확인 후 적립',
      ingredientType: '당근',
      stampCount: 1,
    }),
  });
  const carrotMission = await carrotMissionRes.json();
  createdMissionIds.push(carrotMission.missionId);

  const joinRes = await fetch(`${base}/participations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ missionId: carrotMission.missionId }),
  });
  const join = await joinRes.json();

  const completeRes = await fetch(`${base}/participations/${join.participationId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(completeRes.status, 200);
});

// ── 시나리오 9: 혜택 등록 및 상태 관리 (관리자) — 5번 전제 준비 ────────
test('시나리오 9: 혜택 등록 - B가 카레(양파2+당근1) 혜택을 ACTIVE로 등록한다', async () => {
  const res = await fetch(`${base}/rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: '카레',
      description: '양파와 당근으로 만드는 카레',
      recipe: [
        { ingredientType: '양파', quantity: 2 },
        { ingredientType: '당근', quantity: 1 },
      ],
    }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.status, 'ACTIVE');
  curryRewardId = body.rewardId;
  createdRewardIds.push(curryRewardId);
});

// ── 시나리오 5: 쿠폰(혜택) 받기 ───────────────────────────────────
test('시나리오 5: 쿠폰 받기 - 재료를 모두 충족한 A가 카레를 교환한다', async () => {
  const listRes = await fetch(`${base}/rewards`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const list = await listRes.json();
  const curry = list.find((r) => r.rewardId === curryRewardId);
  assert.ok(curry);
  assert.strictEqual(curry.canRedeem, true, '양파2+당근1을 모두 보유하므로 받을 수 있어야 함');

  const redeemRes = await fetch(`${base}/redemptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ rewardId: curryRewardId }),
  });
  assert.strictEqual(redeemRes.status, 201);
  const redemption = await redeemRes.json();
  assert.ok(redemption.redemptionId);

  const balanceRes = await fetch(`${base}/stamps/balance`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const balances = await balanceRes.json();
  assert.strictEqual(balances.find((b) => b.ingredientType === '양파').balance, 0);
  assert.strictEqual(balances.find((b) => b.ingredientType === '당근').balance, 0);

  const myRedemptionsRes = await fetch(`${base}/redemptions/me`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  const myRedemptions = await myRedemptionsRes.json();
  const found = myRedemptions.find((r) => r.redemptionId === redemption.redemptionId);
  assert.ok(found, '쿠폰 사용 내역에 방금 받은 카레가 있어야 함');
  assert.strictEqual(found.rewardName, '카레');
});

// ── 시나리오 6: 마이페이지 ────────────────────────────────────────
test('시나리오 6: 마이페이지 - 이름 수정 및 비밀번호 변경', async () => {
  const meRes = await fetch(`${base}/users/me`, {
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(meRes.status, 200);
  const me = await meRes.json();
  assert.strictEqual(me.email, actorAEmail);
  assert.strictEqual('password' in me, false);

  const updateRes = await fetch(`${base}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ name: '거래처담당자A(수정)' }),
  });
  assert.strictEqual(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.strictEqual(updated.name, '거래처담당자A(수정)');

  const newPassword = 'newpassword456';
  const pwRes = await fetch(`${base}/users/me/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ currentPassword: actorAPassword, newPassword }),
  });
  assert.strictEqual(pwRes.status, 204);

  const oldLoginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: actorAPassword }),
  });
  assert.strictEqual(oldLoginRes.status, 401);

  const newLoginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: newPassword }),
  });
  assert.strictEqual(newLoginRes.status, 200);
  const newLoginBody = await newLoginRes.json();
  actorAAccessToken = newLoginBody.accessToken; // 이후 시나리오를 위해 갱신
  actorAPassword = newPassword;
});

// ── 시나리오 7(계속): 적립 항목 상태 관리 (수동 종료) ─────────────────
test('시나리오 7: 적립 항목 상태 관리 - B가 진행중 항목을 수동 종료한다', async () => {
  const endRes = await fetch(`${base}/missions/${activeMissionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ENDED' }),
  });
  assert.strictEqual(endRes.status, 200);
  const body = await endRes.json();
  assert.strictEqual(body.status, 'ENDED');
});

// ── 시나리오 8: 적립 확인 처리 (관리자) ───────────────────────────────
test('시나리오 8: 적립 확인 처리(ADMIN) - B가 다른 참여자의 확인 처리를 대행한다', async () => {
  // 이번 시나리오 전용 참여자 D와 새 ACTIVE 미션 준비
  const dEmail = uniqueEmail('actorD');
  createdEmails.push(dEmail);
  const signupRes = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: dEmail, password: 'password123', name: '거래처담당자D' }),
  });
  const dUser = await signupRes.json();

  const missionRes = await fetch(`${base}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: '감자 적립 (E2E, 관리자 확인용)',
      startAt: new Date(Date.now() - HOUR).toISOString(),
      endAt: new Date(Date.now() + 24 * HOUR).toISOString(),
      completionCondition: '직원 확인 후 적립',
      ingredientType: '감자',
      stampCount: 1,
    }),
  });
  const mission = await missionRes.json();
  createdMissionIds.push(mission.missionId);

  const loginDRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: dEmail, password: 'password123' }),
  });
  const dToken = (await loginDRes.json()).accessToken;

  const joinRes = await fetch(`${base}/participations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dToken}` },
    body: JSON.stringify({ missionId: mission.missionId }),
  });
  const participation = await joinRes.json();

  // 관리자 B가 D 대신 확인 처리
  const confirmRes = await fetch(`${base}/participations/${participation.participationId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(confirmRes.status, 200);
  const confirmed = await confirmRes.json();
  assert.strictEqual(confirmed.status, 'COMPLETED');

  const dBalanceRes = await fetch(`${base}/stamps/balance`, {
    headers: { Authorization: `Bearer ${dToken}` },
  });
  const dBalances = await dBalanceRes.json();
  assert.strictEqual(dBalances.find((b) => b.ingredientType === '감자').balance, 1, '스탬프는 D 본인에게 지급되어야 함');
});

// ── 시나리오 9(계속): 혜택 상태 관리 (비활성 전환) ─────────────────────
test('시나리오 9: 혜택 상태 관리 - B가 카레를 비활성화한다', async () => {
  const res = await fetch(`${base}/rewards/${curryRewardId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'INACTIVE' }),
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'INACTIVE');
});

// ── 시나리오 10: [예외] 종료된 항목에 신규 참여 시도 ───────────────────
test('시나리오 10: [예외] 종료된 항목 참여 시도 - 신규 참여가 거부된다', async () => {
  const res = await fetch(`${base}/participations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ missionId: activeMissionId }), // 시나리오 7에서 이미 ENDED로 전환됨
  });
  assert.strictEqual(res.status, 400);
});

// ── 시나리오 11: [예외] 이미 완료한 항목 재확인 시도 ───────────────────
test('시나리오 11: [예외] 완료된 참여건 재확인 시도 - 재지급이 거부된다', async () => {
  const before = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE related_mission_id = $1 AND type = 'EARN'",
    [activeMissionId]
  );
  const res = await fetch(`${base}/participations/${activeParticipationId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actorAAccessToken}` },
  });
  assert.strictEqual(res.status, 409);
  const after = await pool.query(
    "SELECT count(*) FROM stamp_transactions WHERE related_mission_id = $1 AND type = 'EARN'",
    [activeMissionId]
  );
  assert.strictEqual(after.rows[0].count, before.rows[0].count, '스탬프가 중복 지급되지 않아야 함');
});

// ── 시나리오 12: [예외] 스탬프 부족 시 쿠폰 받기 시도 ──────────────────
test('시나리오 12: [예외] 스탬프 부족 시 쿠폰 받기 시도 - 400, 부작용 없음', async () => {
  // A는 시나리오 5에서 카레를 이미 교환해 양파/당근이 0인 상태 — 재교환 시도
  const before = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [curryRewardId]);

  // 카레가 INACTIVE라 400이 나겠지만, "재료 부족" 자체도 검증하기 위해 별도 ACTIVE 리워드로 확인
  const expensiveRewardRes = await fetch(`${base}/rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: '재료부족테스트용 리워드',
      recipe: [{ ingredientType: '양파', quantity: 999 }],
    }),
  });
  const expensiveReward = await expensiveRewardRes.json();
  createdRewardIds.push(expensiveReward.rewardId);

  const res = await fetch(`${base}/redemptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ rewardId: expensiveReward.rewardId }),
  });
  assert.strictEqual(res.status, 400);

  const after = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [curryRewardId]);
  assert.strictEqual(after.rows[0].count, before.rows[0].count);
});

// ── 시나리오 13: [예외] 비활성 혜택 사용 시도 ──────────────────────────
test('시나리오 13: [예외] 비활성 혜택(카레) 사용 시도 - 400, 부작용 없음', async () => {
  const before = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [curryRewardId]);
  const res = await fetch(`${base}/redemptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actorAAccessToken}` },
    body: JSON.stringify({ rewardId: curryRewardId }),
  });
  assert.strictEqual(res.status, 400);
  const after = await pool.query('SELECT count(*) FROM reward_redemptions WHERE reward_id = $1', [curryRewardId]);
  assert.strictEqual(after.rows[0].count, before.rows[0].count);
});

// ── 시나리오 14: [예외] 이메일 중복 가입 시도 ──────────────────────────
test('시나리오 14: [예외] 이메일 중복 가입 시도 - 409, 계정 미생성', async () => {
  const before = await pool.query('SELECT count(*) FROM users WHERE email = $1', [actorAEmail]);

  const res = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actorAEmail, password: 'anotherpassword', name: '중복시도' }),
  });
  assert.strictEqual(res.status, 409);
  const body = await res.json();
  assert.ok(body.message.includes('이미 가입된 이메일'));

  const after = await pool.query('SELECT count(*) FROM users WHERE email = $1', [actorAEmail]);
  assert.strictEqual(after.rows[0].count, before.rows[0].count);
});
