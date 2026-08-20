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

const createdEmails = [];

test.after(async () => {
  if (createdEmails.length === 0) return;
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))',
    [createdEmails]
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [createdEmails]);
});

async function signupAndLogin(base, email, password) {
  await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: '유저정보테스트' }),
  });
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await login.json();
  return body.accessToken;
}

test('GET /users/me - 조회 성공 (200), password 필드 없음', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    const accessToken = await signupAndLogin(base, email, password);
    const res = await fetch(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.email, email);
    assert.ok(body.name);
    assert.strictEqual(body.role, 'CUSTOMER');
    assert.strictEqual('password' in body, false);
  } finally {
    await close(server);
  }
});

test('PATCH /users/me - 이름 변경 성공 및 DB 반영', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    const accessToken = await signupAndLogin(base, email, password);
    const res = await fetch(`${base}/users/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새이름' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.name, '새이름');

    const { rows } = await pool.query('SELECT name FROM users WHERE user_id = $1', [body.userId]);
    assert.strictEqual(rows[0].name, '새이름');
  } finally {
    await close(server);
  }
});

test('PATCH /users/me - email/role 변조 시도는 무시됨', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    const accessToken = await signupAndLogin(base, email, password);
    const res = await fetch(`${base}/users/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새이름2', email: '변조시도@example.com', role: 'ADMIN' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.email, email);
    assert.strictEqual(body.role, 'CUSTOMER');

    const { rows } = await pool.query('SELECT email, role FROM users WHERE user_id = $1', [body.userId]);
    assert.strictEqual(rows[0].email, email);
    assert.strictEqual(rows[0].role, 'CUSTOMER');
  } finally {
    await close(server);
  }
});

test('PATCH /users/me/password - 현재 비밀번호 불일치 시 401', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  createdEmails.push(email);
  try {
    const accessToken = await signupAndLogin(base, email, password);
    const res = await fetch(`${base}/users/me/password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'newpassword456' }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.ok(body.message);
  } finally {
    await close(server);
  }
});

test('PATCH /users/me/password - 변경 성공 (204) 후 기존 비밀번호 로그인 실패, 새 비밀번호 로그인 성공', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  const email = uniqueEmail();
  const password = 'password123';
  const newPassword = 'newpassword456';
  createdEmails.push(email);
  try {
    const accessToken = await signupAndLogin(base, email, password);
    const res = await fetch(`${base}/users/me/password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: password, newPassword }),
    });
    assert.strictEqual(res.status, 204);

    const oldLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.strictEqual(oldLogin.status, 401);

    const newLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    assert.strictEqual(newLogin.status, 200);
    const body = await newLogin.json();
    assert.ok(body.accessToken);
  } finally {
    await close(server);
  }
});

test('인증 토큰 없이 /users/me 관련 엔드포인트 호출 시 401', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  try {
    const get = await fetch(`${base}/users/me`);
    assert.strictEqual(get.status, 401);

    const patch = await fetch(`${base}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '이름' }),
    });
    assert.strictEqual(patch.status, 401);

    const patchPassword = await fetch(`${base}/users/me/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'a', newPassword: 'b' }),
    });
    assert.strictEqual(patchPassword.status, 401);
  } finally {
    await close(server);
  }
});
