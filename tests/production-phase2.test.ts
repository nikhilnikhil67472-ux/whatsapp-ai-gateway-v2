import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { transcribeAudioFile } from '../src/ai/transcription.js';
import { processOutboundMessagesQueue } from '../src/queue/sqlite-queue.js';

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

test('Production Phase 2: Split Warm-Up Engine & Known Contacts Memory', async () => {
  const instance = db.createInstance({
    instance_name: `split-warmup-${Date.now()}`,
    sandbox_mode: false,
  });

  try {
    const warmJid = '919800000001@s.whatsapp.net';
    const coldJid1 = '919800000002@s.whatsapp.net';
    const coldJid2 = '919800000003@s.whatsapp.net';

    // 1. Initial State: No contacts in known_contacts
    assert.equal(db.isContactWarm(instance.id, warmJid), false);
    assert.equal(db.isContactWarm(instance.id, coldJid1), false);
    assert.equal(db.getKnownContact(instance.id, warmJid), null);

    // 2. Inbound Message records known contact as warm
    db.recordInboundContact(instance.id, warmJid);
    assert.equal(db.isContactWarm(instance.id, warmJid), true);
    assert.equal(db.isContactWarm(instance.id, coldJid1), false);

    const contact = db.getKnownContact(instance.id, warmJid);
    assert.ok(contact);
    assert.equal(contact.jid, warmJid);
    assert.equal(contact.is_warm, true);
    assert.ok(contact.last_inbound_at);

    // 3. Normalized JID matching works (device suffix, pure digits, international +, spaces)
    assert.equal(db.isContactWarm(instance.id, '919800000001:1@s.whatsapp.net'), true);
    assert.equal(db.isContactWarm(instance.id, '919800000001'), true);
    assert.equal(db.isContactWarm(instance.id, '+919800000001'), true);
    assert.equal(db.isContactWarm(instance.id, '+91 98000-00001'), true);
    assert.equal(db.isContactWarm(instance.id, '+919800000001@s.whatsapp.net'), true);

    // 3b. System and broadcast JIDs are never recorded as warm contacts
    db.recordInboundContact(instance.id, 'status@broadcast');
    db.recordInboundContact(instance.id, '0@s.whatsapp.net');
    db.recordInboundContact(instance.id, 'news@newsletter');
    db.recordInboundContact(instance.id, 'announcements@broadcast');
    assert.equal(db.isContactWarm(instance.id, 'status@broadcast'), false);
    assert.equal(db.isContactWarm(instance.id, '0@s.whatsapp.net'), false);
    assert.equal(db.isContactWarm(instance.id, 'news@newsletter'), false);
    assert.equal(db.isContactWarm(instance.id, 'announcements@broadcast'), false);

    // 4. Day 1 Cold Quota Enforcement (Limit is 8)
    for (let i = 1; i <= 8; i++) {
      const res = db.checkAndIncrementWarmupLimit(instance.id, `91990000000${i}@s.whatsapp.net`);
      assert.equal(res.allowed, true);
      assert.equal(res.limit, 8);
      assert.equal(res.current, i);
      assert.equal(res.tier, 'cold');
    }

    // 9th cold message must be rejected with COLD_WARMUP_LIMIT_REACHED
    const coldBlocked = db.checkAndIncrementWarmupLimit(instance.id, coldJid2);
    assert.equal(coldBlocked.allowed, false);
    assert.equal(coldBlocked.limit, 8);
    assert.equal(coldBlocked.current, 8);
    assert.equal(coldBlocked.tier, 'cold');
    assert.equal(coldBlocked.errorCode, 'COLD_WARMUP_LIMIT_REACHED');

    // 4b. Decrement rollback restores quota slot on send failures
    db.decrementWarmupLimit(instance.id, 'cold');
    const retryColdCheck = db.checkWarmupLimit(instance.id, 'cold');
    assert.equal(retryColdCheck.current, 7);
    assert.equal(retryColdCheck.allowed, true);
    // Re-fill the slot
    db.checkAndIncrementWarmupLimit(instance.id, 'cold');

    // 5. Warm Reply is allowed even when Cold Limit is reached (Day 1 Warm Limit is 50)
    const warmAllowed = db.checkAndIncrementWarmupLimit(instance.id, warmJid);
    assert.equal(warmAllowed.allowed, true);
    assert.equal(warmAllowed.limit, 50);
    assert.equal(warmAllowed.current, 1);
    assert.equal(warmAllowed.tier, 'warm');

    // 6. When an inbound message arrives from a previously cold contact, it transitions to warm
    assert.equal(db.isContactWarm(instance.id, coldJid2), false);
    db.addMessage({
      instance_id: instance.id,
      remote_jid: coldJid2,
      whatsapp_message_id: `wam_in_${Date.now()}`,
      from_me: false,
      direction: 'inbound',
      text_content: 'Hey there!',
    });
    // Now coldJid2 is recognized as warm!
    assert.equal(db.isContactWarm(instance.id, coldJid2), true);
    const nowWarmCheck = db.checkAndIncrementWarmupLimit(instance.id, coldJid2);
    assert.equal(nowWarmCheck.allowed, true);
    assert.equal(nowWarmCheck.limit, 50);
    assert.equal(nowWarmCheck.tier, 'warm');

    // 7. Advancing Day: resets daily cold and warm counters, advances limits (Day 2: cold 15, warm 100)
    const yesterday = '2026-10-08';
    db.updateInstance(instance.id, {
      last_sent_date: yesterday,
      daily_sent_count: 50,
      daily_warm_sent_count: 50,
      daily_cold_sent_count: 8,
      warmup_day: 1,
    });

    // Read-only checkWarmupLimit must report Day 2 limits (15 cold, 100 warm) without desync
    const preCheckCold = db.checkWarmupLimit(instance.id, 'cold');
    assert.equal(preCheckCold.warmupDay, 2);
    assert.equal(preCheckCold.limit, 15);
    assert.equal(preCheckCold.allowed, true);

    const preCheckWarm = db.checkWarmupLimit(instance.id, 'warm');
    assert.equal(preCheckWarm.warmupDay, 2);
    assert.equal(preCheckWarm.limit, 100);
    assert.equal(preCheckWarm.allowed, true);

    const day2ColdCheck = db.checkAndIncrementWarmupLimit(instance.id, '919999000001@s.whatsapp.net');
    assert.equal(day2ColdCheck.allowed, true);
    assert.equal(day2ColdCheck.warmupDay, 2);
    assert.equal(day2ColdCheck.limit, 15); // Day 2 cold limit is 15
    assert.equal(day2ColdCheck.current, 1);
    assert.equal(day2ColdCheck.tier, 'cold');

    const day2WarmCheck = db.checkAndIncrementWarmupLimit(instance.id, warmJid);
    assert.equal(day2WarmCheck.allowed, true);
    assert.equal(day2WarmCheck.warmupDay, 2);
    assert.equal(day2WarmCheck.limit, 100); // Day 2 warm limit is 100
    assert.equal(day2WarmCheck.tier, 'warm');

    // 8. Queue Worker: Defer cold job gracefully when cold quota exceeded
    db.updateInstance(instance.id, { daily_cold_sent_count: 15 });
    const coldMsgId = db.enqueueOutboundMessage({
      instance_id: instance.id,
      remote_jid: '919999000099@s.whatsapp.net', // cold JID
      reply_type: 'text',
      text_content: 'Outreach cold text',
    });

    const processedCount = await processOutboundMessagesQueue();
    assert.equal(processedCount, 0); // Not dispatched, deferred to retry
    const deferredMsg = db.getOutboundMessage(coldMsgId);
    assert.ok(deferredMsg);
    assert.equal(deferredMsg.status, 'retry');
    assert.ok(deferredMsg.error_message?.includes('COLD_WARMUP_LIMIT_REACHED'));
  } finally {
    db.deleteInstance(instance.id);
    // 9. Cascading delete verifies known_contacts are removed
    assert.equal(db.listKnownContacts(instance.id).length, 0);
  }
});
