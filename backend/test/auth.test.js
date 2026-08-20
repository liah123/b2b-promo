const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
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

function parseRefreshCookie(setCookieHeader) {
  const m = /refreshToken=([^;]+)/.exec(setCookieHeader || '');
  return m ? m[1] : null;
}

const createdEmails = [];

test.after(async () => {
  if (createdEmails.length === 0) return;
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))',
    [createdEmails]
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [createdEmails]);
});

test('POST /auth/signup - 신규 이메일로 가입 성공 (201)', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  createdEmails.push(email);
  try {
    const res = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: '홍길동', role: 'ADMIN' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.email, email);
    assert.strictEqual(body.name, '홍길동');
    assert.strictEqual(body.role, 'CUSTOMER'); // role은 무시되고 CUSTOMER 고정
    assert.ok(body.userId);
    assert.ok(body.createdAt);
    assert.strictEqual('password' in body, false);
  } finally {
    await close(server);
  }
});

test('POST /auth/signup - 이메일 중복 시 409', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  createdEmails.push(email);
  try {
    const payload = { email, password: 'password123', name: '중복테스트' };
    const first = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(first.status, 201);

    const { rows: beforeRows } = await pool.query('SELECT COUNT(*) FROM users WHERE email = $1', [email]);
    const countBefore = Number(beforeRows[0].count);

    const second = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(second.status, 409);
    const body = await second.json();
    assert.ok(body.message.includes('이미 가입된 이메일'));

    const { rows: afterRows } = await pool.query('SELECT COUNT(*) FROM users WHERE email = $1', [email]);
    assert.strictEqual(Number(afterRows[0].count), countBefore);
  } finally {
    await close(server);
  }
});

test('POST /auth/login - 로그인 성공 시 accessToken, HttpOnly 쿠키, refresh_tokens 행 생성', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    const signup = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: '로그인테스트' }),
    });
    assert.strictEqual(signup.status, 201);

    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.ok(body.accessToken);
    assert.strictEqual(body.user.email, email);

    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('refreshToken='));
    assert.ok(/httponly/i.test(setCookie));

    const { rows } = await pool.query(
      "SELECT * FROM refresh_tokens WHERE user_id = (SELECT user_id FROM users WHERE email = $1) AND revoked_at IS NULL",
      [email]
    );
    assert.strictEqual(rows.length, 1);
  } finally {
    await close(server);
  }
});

test('POST /auth/login - 비밀번호 불일치 시 401', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  createdEmails.push(email);
  try {
    const signup = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: '실패테스트' }),
    });
    assert.strictEqual(signup.status, 201);

    const { rows: beforeRows } = await pool.query(
      "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = (SELECT user_id FROM users WHERE email = $1)",
      [email]
    );
    const countBefore = Number(beforeRows[0].count);

    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.accessToken, undefined);

    const { rows: afterRows } = await pool.query(
      "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = (SELECT user_id FROM users WHERE email = $1)",
      [email]
    );
    assert.strictEqual(Number(afterRows[0].count), countBefore);
  } finally {
    await close(server);
  }
});

test('POST /auth/refresh - 유효한 refreshToken 쿠키로 accessToken 재발급 (200)', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: '재발급테스트' }),
    });
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const refreshToken = parseRefreshCookie(login.headers.get('set-cookie'));
    assert.ok(refreshToken);

    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${refreshToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.accessToken);
  } finally {
    await close(server);
  }
});

test('POST /auth/logout - 로그아웃 성공(204) 후 동일 refreshToken으로 재발급 시도하면 401, DB revoked_at 세팅', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: '로그아웃테스트' }),
    });
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const refreshToken = parseRefreshCookie(login.headers.get('set-cookie'));
    assert.ok(refreshToken);

    const logout = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${refreshToken}` },
    });
    assert.strictEqual(logout.status, 204);

    const { rows } = await pool.query(
      "SELECT revoked_at FROM refresh_tokens WHERE user_id = (SELECT user_id FROM users WHERE email = $1)",
      [email]
    );
    assert.strictEqual(rows.length, 1);
    assert.notStrictEqual(rows[0].revoked_at, null);

    const refresh = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${refreshToken}` },
    });
    assert.strictEqual(refresh.status, 401);
  } finally {
    await close(server);
  }
});

test('쿠키 없이 /auth/refresh, /auth/logout 호출 시 401', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  try {
    const refresh = await fetch(`${base}/auth/refresh`, { method: 'POST' });
    assert.strictEqual(refresh.status, 401);
    const refreshBody = await refresh.json();
    assert.ok(refreshBody.message);

    const logout = await fetch(`${base}/auth/logout`, { method: 'POST' });
    assert.strictEqual(logout.status, 401);
    const logoutBody = await logout.json();
    assert.ok(logoutBody.message);
  } finally {
    await close(server);
  }
});
