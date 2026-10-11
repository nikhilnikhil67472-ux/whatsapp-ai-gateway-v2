import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { transcribeAudioFile } from '../src/ai/transcription.js';

test('Production Phase 2: SIM Anti-Ban Warm-Up Schedule Engine', async () => {
  const instance = db.createInstance({
    instance_name: `warmup-test-${Date.now()}`,
    sandbox_mode: false, // Enforce real warm-up throttling
  });

  try {
    // 1. Initial state should be Day 1 with 0 sent
    assert.equal(instance.warmup_day, 1);
    assert.equal(instance.daily_sent_count, 0);

    // 2. Check warmup limit for Day 1 (Limit is 30)
    const check1 = db.checkAndIncrementWarmupLimit(instance.id);
    assert.equal(check1.allowed, true);
    assert.equal(check1.limit, 30);
    assert.equal(check1.current, 1);
    assert.equal(check1.warmupDay, 1);

    // 3. Manually simulate hitting the limit (30 messages)
    db.updateInstance(instance.id, { daily_sent_count: 30 });
    const checkLimitHit = db.checkAndIncrementWarmupLimit(instance.id);
    assert.equal(checkLimitHit.allowed, false);
    assert.equal(checkLimitHit.limit, 30);
    assert.equal(checkLimitHit.current, 30);

    // 4. Simulate advancing to next day (date changes from yesterday to today)
    const yesterday = '2026-10-08';
    db.updateInstance(instance.id, {
      last_sent_date: yesterday,
      daily_sent_count: 30,
      warmup_day: 1,
    });

    // When check runs on a new day, warmup_day advances to 2 and daily_sent_count resets
    const checkDay2 = db.checkAndIncrementWarmupLimit(instance.id);
    assert.equal(checkDay2.allowed, true);
    assert.equal(checkDay2.limit, 60); // Day 2 limit is 60 msgs
    assert.equal(checkDay2.warmupDay, 2);
    assert.equal(checkDay2.current, 1);

    // 5. Sandbox mode should bypass warmup throttling
    db.updateInstance(instance.id, { sandbox_mode: 1 });
    const checkSandbox = db.checkAndIncrementWarmupLimit(instance.id);
    assert.equal(checkSandbox.allowed, true);
  } finally {
    db.deleteInstance(instance.id);
  }
});

test('Production Phase 2: Voice AI Transcription Handler', async () => {
  // Non-existent file safely returns null
  const missingResult = await transcribeAudioFile('non_existent_file.ogg');
  assert.equal(missingResult, null);
});

test('Production Phase 2: 8-Digit Pairing Code API Validation', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const instance = db.createInstance({
    instance_name: `pairing-api-test-${Date.now()}`,
    sandbox_mode: true,
  });

  try {
    // 1. Get auth token
    const demoRes = await fetch(`${baseUrl}/api/v1/auth/demo-login`, { method: 'POST' });
    const demoData = (await demoRes.json()) as any;
    const token = demoData.token;

    // 2. Reject invalid/short phone number
    const invalidPhoneRes = await fetch(`${baseUrl}/api/v1/instances/${instance.id}/pairing-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone_number: '123' }),
    });
    assert.equal(invalidPhoneRes.status, 400);

    // 3. Reject non-existent instance
    const notFoundRes = await fetch(`${baseUrl}/api/v1/instances/non-existent-inst-id/pairing-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone_number: '919876543210' }),
    });
    assert.equal(notFoundRes.status, 404);
  } finally {
    server.close();
    db.deleteInstance(instance.id);
  }
});
