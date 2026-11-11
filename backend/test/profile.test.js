import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/database/migrate.js';

let server;
let baseUrl;
const testEmail = `profile_tester_${Date.now()}@lifeos.app`;
const testPhone = `+9165${String(Date.now()).slice(-8)}`;
const initialPassword = 'Password123!';
const updatedPassword = 'NewPassword456!';
let userId = null;
let secondUserId = null;
let accessToken = null;
let refreshToken = null;
let secondSessionId = null;

test.before(async () => {
  await runMigrations();
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  for (const uid of [secondUserId, userId]) {
    if (uid) {
      try {
        await pool.execute('DELETE FROM users WHERE id = ?', [uid]);
      } catch (_) {}
    }
  }
  if (server) server.close();
  await pool.end();
});

test('Register user and verify GET /api/v1/profile requires auth', async () => {
  const unauthRes = await fetch(`${baseUrl}/api/v1/profile`);
  assert.strictEqual(unauthRes.status, 401);

  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Profile Tester',
      email: testEmail,
      phone: testPhone,
      password: initialPassword,
      termsAccepted: true,
      deviceName: 'Primary Device',
    }),
  });

  assert.strictEqual(regRes.status, 201);
  const regJson = await regRes.json();
  userId = regJson.data.user.id;
  accessToken = regJson.data.tokens.accessToken;
  refreshToken = regJson.data.tokens.refreshToken;
  assert.strictEqual(regJson.data.user.dailyFocusGoal, 8);
  assert.strictEqual(regJson.data.user.dailyStepsGoal, 8000);
});

test('GET /api/v1/profile returns user details, aggregated My Day stats, and active sessions', async () => {
  // Log an activity and metrics so profile stats reflect real DB rows
  const actRes = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-11',
      title: 'Profile Stats Check',
      category: 'focus',
      meta: '1.5 hrs',
    }),
  });
  assert.strictEqual(actRes.status, 201);

  // Create a second session via login
  const login2 = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: initialPassword,
      deviceName: 'Secondary Tablet',
    }),
  });
  assert.strictEqual(login2.status, 200);

  const res = await fetch(`${baseUrl}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.user.email, testEmail);
  assert.strictEqual(json.data.stats.totalActivities, 1);
  assert.strictEqual(json.data.stats.totalStudyHours, 1.5);
  assert.ok(json.data.stats.daysTracked >= 1);
  assert.strictEqual(json.data.sessions.length, 2);

  const tabletSession = json.data.sessions.find((s) => s.deviceName === 'Secondary Tablet');
  assert.ok(tabletSession);
  secondSessionId = tabletSession.id;
});

test('PUT /api/v1/profile updates extended profile fields and goals cleanly', async () => {
  const badGoalRes = await fetch(`${baseUrl}/api/v1/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ dailyFocusGoal: 99 }),
  });
  assert.strictEqual(badGoalRes.status, 400);

  const updateRes = await fetch(`${baseUrl}/api/v1/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Rahul Updated',
      headline: 'Full-Stack Builder',
      bio: 'Building LIFE OS mobile and backend.',
      location: 'Bengaluru, IN',
      profileImage: 'avatar:🚀:#6D28D9',
      dailyFocusGoal: 6.5,
      dailyStepsGoal: 10000,
    }),
  });
  assert.strictEqual(updateRes.status, 200);
  const json = await updateRes.json();
  assert.strictEqual(json.data.name, 'Rahul Updated');
  assert.strictEqual(json.data.headline, 'Full-Stack Builder');
  assert.strictEqual(json.data.bio, 'Building LIFE OS mobile and backend.');
  assert.strictEqual(json.data.location, 'Bengaluru, IN');
  assert.strictEqual(json.data.profileImage, 'avatar:🚀:#6D28D9');
  assert.strictEqual(json.data.dailyFocusGoal, 6.5);
  assert.strictEqual(json.data.dailyStepsGoal, 10000);
});

test('PUT /api/v1/profile rejects duplicate phone from another user with 409', async () => {
  const otherPhone = `+9164${String(Date.now()).slice(-8)}`;
  const reg2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Other User',
      email: `other_${testEmail}`,
      phone: otherPhone,
      password: initialPassword,
      termsAccepted: true,
    }),
  });
  assert.strictEqual(reg2.status, 201);
  secondUserId = (await reg2.json()).data.user.id;

  const dupRes = await fetch(`${baseUrl}/api/v1/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phone: otherPhone }),
  });
  assert.strictEqual(dupRes.status, 409);
});

test('DELETE /api/v1/profile/sessions/:sessionId revokes targeted device session', async () => {
  const delRes = await fetch(`${baseUrl}/api/v1/profile/sessions/${secondSessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(delRes.status, 200);

  const notFoundRes = await fetch(`${baseUrl}/api/v1/profile/sessions/non-existent-id`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(notFoundRes.status, 404);
});

test('PUT /api/v1/profile/password validates current password and updates hash while keeping current session', async () => {
  const wrongPwRes = await fetch(`${baseUrl}/api/v1/profile/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'WrongPassword!',
      newPassword: updatedPassword,
    }),
  });
  assert.strictEqual(wrongPwRes.status, 401);

  const okRes = await fetch(`${baseUrl}/api/v1/profile/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword: updatedPassword,
      currentRefreshToken: refreshToken,
    }),
  });
  assert.strictEqual(okRes.status, 200);

  // Verify new password logs in successfully
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: updatedPassword,
    }),
  });
  assert.strictEqual(loginRes.status, 200);
});
