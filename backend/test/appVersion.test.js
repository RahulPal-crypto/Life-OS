import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { parseGitHubRelease } from '../src/modules/app/app.service.js';

let server;
let baseUrl;

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
  if (server) server.close();
  await pool.end();
});

test('parseGitHubRelease extracts versionCode, apkUrl, forceUpdate, and strips HTML markers', () => {
  const parsed = parseGitHubRelease({
    tag_name: 'v1.2.0',
    published_at: '2026-11-12T00:00:00Z',
    body: '<!-- versionCode:5 -->\n<!-- forceUpdate:true -->\nAdded dark mode and bug fixes.',
    assets: [
      {
        name: 'LifeOS-v1.2.0-c5.apk',
        size: 28000000,
        browser_download_url: 'https://github.com/RahulPal-crypto/Life-OS/releases/download/v1.2.0/LifeOS-v1.2.0-c5.apk',
      },
    ],
  });

  assert.strictEqual(parsed.latestVersionCode, 5);
  assert.strictEqual(parsed.latestVersionName, '1.2.0');
  assert.strictEqual(parsed.forceUpdate, true);
  assert.strictEqual(parsed.releaseNotes, 'Added dark mode and bug fixes.');
  assert.strictEqual(parsed.apkSizeBytes, 28000000);
  assert.ok(parsed.apkUrl?.endsWith('.apk'));
});

test('GET /api/v1/app/version returns valid update metadata structure', async () => {
  const res = await fetch(`${baseUrl}/api/v1/app/version`);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(typeof json.data.latestVersionCode, 'number');
  assert.strictEqual(typeof json.data.latestVersionName, 'string');
  assert.strictEqual(typeof json.data.forceUpdate, 'boolean');
  assert.ok('apkUrl' in json.data);
  assert.ok('releaseNotes' in json.data);
});
