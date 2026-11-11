import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

let server;
let baseUrl;
const testEmail = `test_runner_${Date.now()}@lifeos.app`;
const testPhone = `+9199${String(Date.now()).slice(-8)}`;
const testPassword = 'Password123!';
let createdUserId = null;
let secondUserId = null;
let authToken = null;
let refreshToken = null;

test.before(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  for (const uid of [secondUserId, createdUserId]) {
    if (uid) {
      try {
        await pool.execute('DELETE FROM users WHERE id = ?', [uid]);
      } catch (_) {}
    }
  }
  if (server) server.close();
  await pool.end();
});

test('GET /health returns 200 and healthy status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.status, 'UP');
});

test('POST /api/v1/auth/register creates a new user and returns tokens', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration Tester',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      termsAccepted: true,
      deviceName: 'Integration Test Runner',
    }),
  });

  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(json.data.user.id);
  assert.strictEqual(json.data.user.email, testEmail);
  assert.ok(json.data.tokens.accessToken);
  assert.ok(json.data.tokens.refreshToken);

  createdUserId = json.data.user.id;
  authToken = json.data.tokens.accessToken;
  refreshToken = json.data.tokens.refreshToken;
});

test('POST /api/v1/auth/login successfully logs in created user', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.user.email, testEmail);
  assert.ok(json.data.tokens.accessToken);
  assert.ok(json.data.tokens.refreshToken);
});

test('POST /api/v1/auth/login fails on invalid credentials', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: 'wrongpassword',
    }),
  });

  assert.strictEqual(res.status, 401);
  const json = await res.json();
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'INVALID_CREDENTIALS');
});

test('GET /api/v1/auth/profile requires valid Bearer token', async () => {
  // 1. Without token -> 401
  const resNoAuth = await fetch(`${baseUrl}/api/v1/auth/profile`);
  assert.strictEqual(resNoAuth.status, 401);

  // 2. With token -> 200
  const profileRes = await fetch(`${baseUrl}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(profileRes.status, 200);
  const profileJson = await profileRes.json();
  assert.strictEqual(profileJson.data.email, testEmail);
});

test('POST /api/v1/auth/register rejects duplicate phone numbers with spaces', async () => {
  const spacedPhone = `${testPhone.slice(0, 3)} ${testPhone.slice(3)}`;
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Phone Tester',
      email: `dup_${testEmail}`,
      phone: spacedPhone,
      password: testPassword,
      termsAccepted: true,
    }),
  });

  assert.strictEqual(res.status, 409);
  const json = await res.json();
  assert.strictEqual(json.error.code, 'PHONE_ALREADY_EXISTS');
});

test('PUT /api/v1/auth/profile validates payloads and rejects duplicate phone with 409', async () => {
  const emptyRes = await fetch(`${baseUrl}/api/v1/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(emptyRes.status, 400);

  const validRes = await fetch(`${baseUrl}/api/v1/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name: 'Updated Integration Tester' }),
  });
  assert.strictEqual(validRes.status, 200);
  const validJson = await validRes.json();
  assert.strictEqual(validJson.data.name, 'Updated Integration Tester');

  // Create second user to verify duplicate phone conflict handling
  const secondEmail = `second_${testEmail}`;
  const secondPhone = `+9177${String(Date.now()).slice(-8)}`;
  const reg2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Second User',
      email: secondEmail,
      phone: secondPhone,
      password: testPassword,
      termsAccepted: true,
    }),
  });
  assert.strictEqual(reg2.status, 201);
  const reg2Json = await reg2.json();
  secondUserId = reg2Json.data.user.id;

  const dupPhoneRes = await fetch(`${baseUrl}/api/v1/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ phone: secondPhone }),
  });
  assert.strictEqual(dupPhoneRes.status, 409);
  const dupPhoneJson = await dupPhoneRes.json();
  assert.strictEqual(dupPhoneJson.error.code, 'PHONE_ALREADY_EXISTS');
});

test('Refresh token cannot be used as access token and rotates atomically once', async () => {
  const wrongUseRes = await fetch(`${baseUrl}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  assert.strictEqual(wrongUseRes.status, 401);

  const rotateRes = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.strictEqual(rotateRes.status, 200);
  const rotateJson = await rotateRes.json();
  assert.ok(rotateJson.data.accessToken);
  assert.ok(rotateJson.data.refreshToken);

  const reuseOldRes = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.strictEqual(reuseOldRes.status, 401);
});
