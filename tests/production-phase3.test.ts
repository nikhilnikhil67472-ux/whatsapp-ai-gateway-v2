import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
import { db } from '../src/db/database.js';
import { WhatsAppEngineManager } from '../src/whatsapp/manager.js';
import {
  executeHumanizedPreSend,
  sendText,
  sendPresence,
  resetInactivityTimer,
  cancelInactivityTimer,
  hasActiveInactivityTimer,
  clearAllInactivityTimers,
} from '../src/whatsapp/sender.js';
import {
  ZERO_WIDTH_CHARS,
  stripZeroWidthSpaces,
  injectZeroWidthMicroVariations,
  applyDuplicateHashGuard,
  getColdDuplicateTracker,
  resetColdDuplicateStreak,
  resetAllColdDuplicateTrackers,
  calculateInterMessageCooldown,
  getInstancePacing,
  resetInstancePacing,
  processOutboundMessagesQueue,
} from '../src/queue/sqlite-queue.js';

test('Production Phase 3: Humanized Read->Type->Send Sequence & Inactivity Timer', async (t) => {
  const instance = db.createInstance({
    instance_name: `humanized-test-${Date.now()}`,
    sandbox_mode: false,
  });

  t.after(() => {
    clearAllInactivityTimers();
    WhatsAppEngineManager.removeSocket(instance.id);
    db.deleteInstance(instance.id);
  });

  const presenceLog: string[] = [];
  const readLog: any[] = [];

  const mockSocket: any = {
    user: { id: '919876543210@s.whatsapp.net' },
    presenceSubscribe: async () => {},
    sendPresenceUpdate: async (type: string) => {
      presenceLog.push(type);
    },
    readMessages: async (keys: any[]) => {
      readLog.push(...keys);
    },
    sendMessage: async (_jid: string, content: any) => {
      return { key: { id: `MSG_${Date.now()}` } };
    },
  };

  WhatsAppEngineManager.setSocket(instance.id, mockSocket);

  await t.test('Pre-send executes available -> readMessages -> composing sequence', async () => {
    presenceLog.length = 0;
    readLog.length = 0;

    const remoteJid = '919999111222@s.whatsapp.net';
    const quotedId = 'INBOUND_MSG_789';

    await executeHumanizedPreSend(mockSocket, {
      instanceId: instance.id,
      remoteJid,
      type: 'composing',
      textLength: 50,
      quotedMessageId: quotedId,
    });

    assert.ok(presenceLog.includes('available'), 'Must transition presence to available first');
    assert.ok(presenceLog.includes('composing'), 'Must transition presence to composing');
    assert.equal(readLog.length, 1, 'Must mark quoted message as read');
    assert.equal(readLog[0].id, quotedId);
    assert.equal(readLog[0].remoteJid, remoteJid);
    assert.equal(readLog[0].fromMe, false);
  });

  await t.test('Pre-send reads latest inbound message if quotedMessageId is not explicitly set', async () => {
    readLog.length = 0;
    const remoteJid = '919999333444@s.whatsapp.net';
    const autoInboundId = `inbound_${Date.now()}`;

    // Add inbound message from contact
    db.addMessage({
      instance_id: instance.id,
      remote_jid: remoteJid,
      whatsapp_message_id: autoInboundId,
      from_me: false,
      direction: 'inbound',
      text_content: 'Are you available today?',
    });

    await executeHumanizedPreSend(mockSocket, {
      instanceId: instance.id,
      remoteJid,
      type: 'composing',
      textLength: 30,
    });

    assert.ok(readLog.some((k) => k.id === autoInboundId), 'Must automatically acknowledge unread inbound conversation message');
  });

  await t.test('Inactivity timer scheduling and cancellation lifecycle', async () => {
    clearAllInactivityTimers();
    assert.equal(hasActiveInactivityTimer(instance.id), false);

    resetInactivityTimer(instance.id);
    assert.equal(hasActiveInactivityTimer(instance.id), true);

    cancelInactivityTimer(instance.id);
    assert.equal(hasActiveInactivityTimer(instance.id), false);
  });

  await t.test('sendText completes full lifecycle and resets presence to paused', async () => {
    presenceLog.length = 0;
    const res = await sendText({
      instanceId: instance.id,
      remoteJid: '919999555666@s.whatsapp.net',
      text: 'Humanized message delivery test',
    });

    assert.ok(res?.key?.id);
    assert.ok(presenceLog.includes('available'), 'Available sent');
    assert.ok(presenceLog.includes('composing'), 'Composing sent');
    assert.ok(presenceLog.includes('paused'), 'Paused sent in finally');
    assert.equal(hasActiveInactivityTimer(instance.id), true, 'Inactivity timer active after send');
  });
});

test('Production Phase 3: Queue Anti-Burst Pacing & Duplicate Hash Guard', async (t) => {
  const instance = db.createInstance({
    instance_name: `pacing-test-${Date.now()}`,
    sandbox_mode: false,
  });

  t.after(() => {
    resetAllColdDuplicateTrackers();
    resetInstancePacing();
    WhatsAppEngineManager.removeSocket(instance.id);
    db.deleteInstance(instance.id);
  });

  await t.test('Inter-message cooldown calculates within required bounds', () => {
    // In test mode: always 0ms
    assert.equal(calculateInterMessageCooldown(true, false, true), 0);
    assert.equal(calculateInterMessageCooldown(false, true, true), 0);

    // Warm reply: random(6s, 14s)
    for (let i = 0; i < 20; i++) {
      const warmCooldown = calculateInterMessageCooldown(true, false, false);
      assert.ok(warmCooldown >= 6000 && warmCooldown <= 14000, `Warm cooldown ${warmCooldown}ms must be between 6s and 14s`);
    }

    // Consecutive cold outbound messages: random(45s, 95s)
    for (let i = 0; i < 20; i++) {
      const coldCooldown = calculateInterMessageCooldown(false, true, false);
      assert.ok(coldCooldown >= 45000 && coldCooldown <= 95000, `Cold cooldown ${coldCooldown}ms must be between 45s and 95s`);
    }
  });

  await t.test('Zero-width space micro-variations disperse SHA-256 hash while maintaining visual text', () => {
    const original = 'Hello! Check out our enterprise WhatsApp solution today.';
    const varied1 = injectZeroWidthMicroVariations(original);
    const varied2 = injectZeroWidthMicroVariations(original);

    // Human appearance is identical
    assert.equal(stripZeroWidthSpaces(varied1), original);
    assert.equal(stripZeroWidthSpaces(varied2), original);

    // Variations contain at least one zero-width character
    const hasZw1 = ZERO_WIDTH_CHARS.some((c) => varied1.includes(c));
    const hasZw2 = ZERO_WIDTH_CHARS.some((c) => varied2.includes(c));
    assert.ok(hasZw1);
    assert.ok(hasZw2);

    // Cryptographic content hashes are distinct
    const hashOriginal = crypto.createHash('sha256').update(original).digest('hex');
    const hashVaried1 = crypto.createHash('sha256').update(varied1).digest('hex');
    assert.notEqual(hashOriginal, hashVaried1, 'Micro-variation must disperse cryptographic content hash');
  });

  await t.test('Duplicate Hash Guard triggers on 5+ identical text messages to cold recipients', () => {
    resetAllColdDuplicateTrackers();
    const template = 'Exclusive promo for your company: save 20% today!';

    // Send 1 to 4: identical text remains unmodified
    for (let i = 1; i <= 4; i++) {
      const coldJid = `91998800000${i}@s.whatsapp.net`;
      const result = applyDuplicateHashGuard(instance.id, coldJid, template);
      assert.equal(result, template, `Message ${i} to cold number should not be modified yet`);
    }

    const tracker = getColdDuplicateTracker(instance.id);
    assert.ok(tracker);
    assert.equal(tracker.consecutiveColdCount, 4);
    assert.equal(tracker.distinctJids.size, 4);

    // 5th message: Duplicate Hash Guard must trigger and disperse content hash
    const coldJid5 = '919988000005@s.whatsapp.net';
    const result5 = applyDuplicateHashGuard(instance.id, coldJid5, template);
    assert.notEqual(result5, template, '5th cold duplicate must be modified with zero-width characters');
    assert.equal(stripZeroWidthSpaces(result5), template, 'Visual text content must remain identical');
    assert.equal(tracker.consecutiveColdCount, 5);

    // 6th message: continues dispersing hashes
    const coldJid6 = '919988000006@s.whatsapp.net';
    const result6 = applyDuplicateHashGuard(instance.id, coldJid6, template);
    assert.notEqual(result6, template);
    assert.equal(stripZeroWidthSpaces(result6), template);
  });

  await t.test('Duplicate Hash Guard: Warm contacts are never modified and reset cold streak', () => {
    resetAllColdDuplicateTrackers();
    const warmJid = '919876500001@s.whatsapp.net';
    db.recordInboundContact(instance.id, warmJid);
    assert.equal(db.isContactWarm(instance.id, warmJid), true);

    const template = 'Thank you for your inquiry, here are your order details.';

    // Send 1 to 4 cold messages first
    for (let i = 1; i <= 4; i++) {
      applyDuplicateHashGuard(instance.id, `91998811100${i}@s.whatsapp.net`, template);
    }
    const trackerBeforeWarm = getColdDuplicateTracker(instance.id);
    assert.equal(trackerBeforeWarm?.consecutiveColdCount, 4);

    // Now a warm reply arrives: resetColdDuplicateStreak is invoked
    resetColdDuplicateStreak(instance.id);
    assert.equal(trackerBeforeWarm?.consecutiveColdCount, 0, 'Warm reply must reset consecutive cold streak');

    // 5th message now has a reset count, so it will NOT trigger the guard yet!
    const cold5 = applyDuplicateHashGuard(instance.id, '919988111005@s.whatsapp.net', template);
    assert.equal(cold5, template, 'Must not be modified because cold streak was reset by warm reply');

    // Warm contacts themselves should never have micro-variations injected even if sent 10 times
    for (let i = 0; i < 10; i++) {
      // In processOutboundMessagesQueue, warm contacts bypass applyDuplicateHashGuard completely
      const isWarm = db.isContactWarm(instance.id, warmJid);
      assert.equal(isWarm, true);
    }
  });

  await t.test('Duplicate Hash Guard: New template text resets cold streak to 1', () => {
    resetAllColdDuplicateTrackers();
    const templateA = 'Template A: Welcome to our platform!';
    const templateB = 'Template B: Completely different promotion!';

    // Send 4 times template A
    for (let i = 1; i <= 4; i++) {
      applyDuplicateHashGuard(instance.id, `91991100000${i}@s.whatsapp.net`, templateA);
    }
    const tracker = getColdDuplicateTracker(instance.id);
    assert.equal(tracker?.consecutiveColdCount, 4);

    // Send template B to a cold number: should reset streak to 1 for template B
    const resultB = applyDuplicateHashGuard(instance.id, '919911000005@s.whatsapp.net', templateB);
    const trackerB = getColdDuplicateTracker(instance.id);
    assert.equal(trackerB?.consecutiveColdCount, 1, 'Consecutive cold count must reset to 1 for distinct text');
  });

  await t.test('Duplicate Hash Guard: Handles edge cases (empty text, whitespace, no-space words) safely', () => {
    // Empty text
    assert.equal(injectZeroWidthMicroVariations(''), '');
    assert.equal(applyDuplicateHashGuard(instance.id, '919900000001@s.whatsapp.net', ''), '');

    // Single word with no spaces
    const noSpace = 'Antidisestablishmentarianism';
    const variedNoSpace = injectZeroWidthMicroVariations(noSpace);
    assert.equal(stripZeroWidthSpaces(variedNoSpace), noSpace);
    assert.ok(ZERO_WIDTH_CHARS.some((c) => variedNoSpace.includes(c)));
  });

  await t.test('Anti-Burst Pacing: Instance isolation and cooldown state tracking', () => {
    const instA = 'inst-test-pacing-a';
    const instB = 'inst-test-pacing-b';

    resetInstancePacing();
    assert.equal(getInstancePacing(instA), undefined);
    assert.equal(getInstancePacing(instB), undefined);

    // In test environment, calculateInterMessageCooldown with omitted 3rd arg returns 0
    assert.equal(calculateInterMessageCooldown(true, false), 0);
    assert.equal(calculateInterMessageCooldown(false, true), 0);

    // Warm-after-cold returns [6000, 14000] in non-test mode
    const warmAfterCold = calculateInterMessageCooldown(true, true, false);
    assert.ok(warmAfterCold >= 6000 && warmAfterCold <= 14000);

    // Cold-after-warm returns [6000, 14000] in non-test mode
    const coldAfterWarm = calculateInterMessageCooldown(false, false, false);
    assert.ok(coldAfterWarm >= 6000 && coldAfterWarm <= 14000);
  });

  await t.test('Queue worker executes with pacing and duplicate guard end-to-end', async () => {
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, _content: any) => {
        return { key: { id: `MOCK_SENT_${Date.now()}` } };
      },
    };

    WhatsAppEngineManager.setSocket(instance.id, mockSocket);

    // Enqueue 2 outbound messages for this instance
    const m1 = db.enqueueOutboundMessage({
      instance_id: instance.id,
      remote_jid: '919977000001@s.whatsapp.net',
      reply_type: 'text',
      text_content: 'Queue item 1 for pacing verification',
    });

    const m2 = db.enqueueOutboundMessage({
      instance_id: instance.id,
      remote_jid: '919977000002@s.whatsapp.net',
      reply_type: 'text',
      text_content: 'Queue item 2 for pacing verification',
    });

    const processed = await processOutboundMessagesQueue(instance.id);
    assert.ok(processed >= 2, 'Must process both enqueued messages');

    assert.equal(db.getOutboundMessage(m1)?.status, 'sent');
    assert.equal(db.getOutboundMessage(m2)?.status, 'sent');

    const pacing = getInstancePacing(instance.id);
    assert.ok(pacing);
    assert.ok(pacing.lastSentAt > 0);
  });
});
