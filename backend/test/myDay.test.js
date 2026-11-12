import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

let server;
let baseUrl;
const testEmail = `myday_tester_${Date.now()}@lifeos.app`;
const testPhone = `+9188${String(Date.now()).slice(-8)}`;
const testPassword = 'Password123!';
let userId = null;
let authToken = null;
let createdActivityId = null;

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
  if (userId) {
    try {
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    } catch (_) {}
  }
  if (server) server.close();
  await pool.end();
});

test('Register test user for My Day backend tests', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'MyDay Tester',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      termsAccepted: true,
      deviceName: 'My Day Test Runner',
    }),
  });

  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  userId = json.data.user.id;
  authToken = json.data.tokens.accessToken;
});

test('GET /api/v1/my-day requires authentication (401 without token)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day`);
  assert.strictEqual(res.status, 401);
  const json = await res.json();
  assert.strictEqual(json.success, false);
});

test('GET /api/v1/my-day returns initialized day snapshot for authenticated user', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day?date=2026-11-08`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.date, '2026-11-08');
  assert.ok(json.data.metrics);
  assert.ok(json.data.todayAtAGlance);
  assert.ok(Array.isArray(json.data.timeline));
});

test('POST /api/v1/my-day/activities creates an activity and returns 201', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-08',
      title: 'Studied Node Architecture',
      category: 'focus',
      details: 'Built complete My Day backend module and tested endpoints.',
      meta: '2.0 hrs',
      timeString: '09:00 AM',
    }),
  });

  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(json.data.id);
  assert.strictEqual(json.data.title, 'Studied Node Architecture');
  assert.strictEqual(json.data.category, 'focus');
  assert.strictEqual(json.data.icon, '📖');

  createdActivityId = json.data.id;
});

test('PUT /api/v1/my-day/metrics updates daily metrics and returns 200', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day/metrics`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-08',
      studyHours: 4.5,
      workHours: 2.0,
      activeSteps: 6842,
      sleepHours: 7.2,
      mood: 'Productive',
    }),
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.date, '2026-11-08');
  assert.strictEqual(json.data.studyHours, 4.5);
  assert.strictEqual(json.data.activeSteps, 6842);
  assert.strictEqual(json.data.mood, 'Productive');
});

test('GET /api/v1/my-day reflects the created activity and metrics', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day?date=2026-11-08`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.metrics.activeSteps, 6842);
  assert.strictEqual(json.data.timeline.length, 1);
  assert.strictEqual(json.data.timeline[0].title, 'Studied Node Architecture');
});

test('PUT /api/v1/my-day/activities/:id sanitizes uppercase/padded category and updates cleanly', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day/activities/${createdActivityId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ category: ' WORKOUT ', title: '  Updated Workout  ' }),
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.category, 'workout');
  assert.strictEqual(json.data.title, 'Updated Workout');
});

test('DELETE /api/v1/my-day/activities/:id deletes the activity', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day/activities/${createdActivityId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.id, createdActivityId);
});

test('POST /api/v1/my-day/activities auto-initializes summary and adds studyHours on a fresh date', async () => {
  const freshDate = '2026-11-09';
  const createRes = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: freshDate,
      title: 'Deep Focus Session',
      category: 'focus',
      meta: '2.5 hrs',
    }),
  });
  assert.strictEqual(createRes.status, 201);

  const snapRes = await fetch(`${baseUrl}/api/v1/my-day?date=${freshDate}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(snapRes.status, 200);
  const snapJson = await snapRes.json();
  assert.strictEqual(snapJson.data.metrics.studyHours, 2.5);
});

test('GET /api/v1/my-day/history returns YYYY-MM-DD dates, readable labels, and rejects invalid days with 400', async () => {
  const res = await fetch(`${baseUrl}/api/v1/my-day/history?days=7`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data) && json.data.length >= 2);
  for (const entry of json.data) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.notStrictEqual(entry.formattedDate, 'Invalid Date');
  }

  const badRes = await fetch(`${baseUrl}/api/v1/my-day/history?days=abc`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(badRes.status, 400);
});

test('Validation rejects invalid calendar dates, oversized activity strings, and coerced metric nulls/booleans', async () => {
  const badDateRes = await fetch(`${baseUrl}/api/v1/my-day?date=2026-02-31`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(badDateRes.status, 400);

  const longTimeRes = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-08',
      title: 'Valid Title',
      timeString: '123456789012345678901234567890',
    }),
  });
  assert.strictEqual(longTimeRes.status, 400);

  const badMetricsRes = await fetch(`${baseUrl}/api/v1/my-day/metrics`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-08',
      sleepHours: null,
      activeSteps: true,
      studyHours: '',
    }),
  });
  assert.strictEqual(badMetricsRes.status, 400);
  const badMetricsJson = await badMetricsRes.json();
  assert.ok(badMetricsJson.error.details.sleepHours);
  assert.ok(badMetricsJson.error.details.activeSteps);
  assert.ok(badMetricsJson.error.details.studyHours);
});

test('Timed activity auto-computes endsAt, keeps time slot visible, and stops cleanly', async () => {
  const startedAt = Date.now();
  const createRes = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-12',
      category: 'meal',
      title: 'Lunch Break',
      durationMinutes: 15,
      timestamp: startedAt,
    }),
  });

  assert.strictEqual(createRes.status, 201);
  const createdJson = await createRes.json();
  assert.strictEqual(createdJson.data.durationMinutes, 15);
  assert.strictEqual(createdJson.data.timerStatus, 'active');
  assert.strictEqual(createdJson.data.endsAt, startedAt + 15 * 60_000);
  assert.ok(createdJson.data.endTime);
  assert.ok(createdJson.data.meta.includes('15 min'));

  const stopRes = await fetch(`${baseUrl}/api/v1/my-day/activities/${createdJson.data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      timerStatus: 'completed',
      endsAt: startedAt + 10 * 60_000,
    }),
  });

  assert.strictEqual(stopRes.status, 200);
  const stopJson = await stopRes.json();
  assert.strictEqual(stopJson.data.timerStatus, 'completed');
  assert.strictEqual(stopJson.data.durationMinutes, 10);
  assert.ok(stopJson.data.meta.includes('10 min'));

  // Past-ended timed activity auto-completes immediately on creation/snapshot
  const pastRes = await fetch(`${baseUrl}/api/v1/my-day/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      logDate: '2026-11-12',
      category: 'meal',
      title: 'Past Coffee Break',
      durationMinutes: 15,
      timestamp: startedAt - 20 * 60_000,
    }),
  });
  assert.strictEqual(pastRes.status, 201);
  const pastJson = await pastRes.json();
  assert.strictEqual(pastJson.data.timerStatus, 'completed');
});
