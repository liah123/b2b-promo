const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

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

test('GET /health returns 200 {status:"ok"}', async () => {
  const app = require('../src/app');
  const { server, base } = await listen(app);
  try {
    const res = await fetch(`${base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  } finally {
    await close(server);
  }
});

test('CORS allows front origin with credentials', async () => {
  const app = require('../src/app');
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  const { server, base } = await listen(app);
  try {
    const res = await fetch(`${base}/health`, { headers: { Origin: origin } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), origin);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  } finally {
    await close(server);
  }
});

test('errorHandler returns 500 {message} and server keeps serving', async () => {
  const express = require('express');
  const errorHandler = require('../src/middleware/errorHandler');

  const mini = express();
  mini.get('/__test-error', () => {
    throw new Error('boom');
  });
  mini.get('/health', (req, res) => res.json({ status: 'ok' }));
  mini.use(errorHandler);

  const { server, base } = await listen(mini);
  try {
    const errRes = await fetch(`${base}/__test-error`);
    assert.strictEqual(errRes.status, 500);
    assert.deepStrictEqual(await errRes.json(), { message: 'boom' });

    // 에러 이후에도 프로세스/서버가 살아있어야 한다
    const okRes = await fetch(`${base}/health`);
    assert.strictEqual(okRes.status, 200);
    assert.deepStrictEqual(await okRes.json(), { status: 'ok' });
  } finally {
    await close(server);
  }
});
