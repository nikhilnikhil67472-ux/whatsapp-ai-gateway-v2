import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GatewayDatabase } from '../src/db/database.js';

test('Database: Instance CRUD and identifier lookup', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-test-db-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({
      instance_name: 'test-instance-1',
      ai_enabled: true,
      ai_provider: 'openai',
      ai_model: 'gpt-4o-mini',
    });

    assert.ok(inst.id);
    assert.equal(inst.instance_name, 'test-instance-1');
    assert.equal(inst.status, 'created');
    assert.equal(inst.ai_enabled, true);

    // Test UUID lookup
    const byId = db.getInstance(inst.id);
    assert.ok(byId);
    assert.equal(byId.instance_name, 'test-instance-1');

    // Test identifier lookup (by name)
    const byName = db.getInstanceByIdentifier('test-instance-1');
    assert.ok(byName);
    assert.equal(byName.id, inst.id);

    // Update instance
    db.updateInstance(inst.id, {
      status: 'connected',
      phone_number: '919876543210',
      push_name: 'John Doe',
    });

    const updated = db.getInstance(inst.id);
    assert.equal(updated?.status, 'connected');
    assert.equal(updated?.phone_number, '919876543210');
    assert.equal(updated?.push_name, 'John Doe');

    // List instances
    const all = db.listInstances();
    assert.equal(all.length, 1);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Database: Cascading delete cleans all related records', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-cascade-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({ instance_name: 'cascade-test' });
    const remoteJid = '919999999999@s.whatsapp.net';

    db.addMessage({
      instance_id: inst.id,
      remote_jid: remoteJid,
      whatsapp_message_id: 'wam_1',
      from_me: false,
      direction: 'inbound',
      text_content: 'hello',
    });

    db.enqueueOutboundMessage({
      instance_id: inst.id,
      remote_jid: remoteJid,
      reply_type: 'text',
      text_content: 'world',
    });

    db.enqueueWorkerCommand(inst.id, 'restart');
    db.saveAuthCreds(inst.id, 'dummy_creds');
    db.saveAuthKeys(inst.id, [{ keyType: 'session', keyId: 'k1', data: 'd1' }]);
    db.createAutoReplyRule({
      instance_id: inst.id,
      name: 'Welcome',
      match_value: 'hi',
      reply_text: 'Hello!',
    });

    assert.equal(db.listMessages(inst.id).length, 1);
    assert.equal(db.listConversations(inst.id).length, 1);
    assert.equal(db.listAutoReplyRules(inst.id).length, 1);
    assert.ok(db.getAuthCreds(inst.id));

    // Delete instance
    const deleted = db.deleteInstance(inst.id);
    assert.equal(deleted, true);

    // Verify everything was cascaded
    assert.equal(db.getInstance(inst.id), null);
    assert.equal(db.listMessages(inst.id).length, 0);
    assert.equal(db.listConversations(inst.id).length, 0);
    assert.equal(db.listAutoReplyRules(inst.id).length, 0);
    assert.equal(db.getAuthCreds(inst.id), null);
    assert.equal(db.listAuthKeys(inst.id).length, 0);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Database: Worker command lifecycle and reclaiming', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-cmd-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({ instance_name: 'cmd-test' });
    const cmdId = db.enqueueWorkerCommand(inst.id, 'restart', { purgeSession: true });

    const pending = db.listPendingWorkerCommands();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, cmdId);

    const marked = db.markWorkerCommandProcessing(cmdId);
    assert.equal(marked, true);

    // Should no longer be in pending
    assert.equal(db.listPendingWorkerCommands().length, 0);

    const completed = db.completeWorkerCommand(cmdId);
    assert.equal(completed, true);

    const finishedCmd = db.getWorkerCommand(cmdId);
    assert.equal(finishedCmd?.status, 'completed');
    assert.ok(finishedCmd?.completed_at);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Database: Two-Tier Cold vs. Warm message quota enforcement across all schedule days', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-quota-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst1 = db.createInstance({ instance_name: 'quota-inst-1', sandbox_mode: false });
    const inst2 = db.createInstance({ instance_name: 'quota-inst-2', sandbox_mode: false });

    // 1. Day 1: Cold limit = 8, Warm limit = 50
    assert.equal(inst1.warmup_day, 1);
    const warmJid = '919876543210@s.whatsapp.net';
    db.recordInboundContact(inst1.id, warmJid);
    assert.equal(db.isContactWarm(inst1.id, warmJid), true);

    // Send 8 cold messages to inst1
    for (let i = 1; i <= 8; i++) {
      const coldJid = `91990000000${i}@s.whatsapp.net`;
      const res = db.checkAndIncrementWarmupLimit(inst1.id, coldJid);
      assert.equal(res.allowed, true);
      assert.equal(res.limit, 8);
      assert.equal(res.current, i);
      assert.equal(res.tier, 'cold');
    }

    // 9th cold message on inst1 must be rejected with COLD_WARMUP_LIMIT_REACHED
    const blockedCold = db.checkAndIncrementWarmupLimit(inst1.id, '919900000099@s.whatsapp.net');
    assert.equal(blockedCold.allowed, false);
    assert.equal(blockedCold.limit, 8);
    assert.equal(blockedCold.current, 8);
    assert.equal(blockedCold.errorCode, 'COLD_WARMUP_LIMIT_REACHED');

    // Multi-instance isolation: inst2 is unaffected and still has 8 cold messages available
    const inst2Check = db.checkAndIncrementWarmupLimit(inst2.id, '919900000099@s.whatsapp.net');
    assert.equal(inst2Check.allowed, true);
    assert.equal(inst2Check.current, 1);
    assert.equal(inst2Check.limit, 8);

    // Warm messages on inst1 are allowed even though cold cap is reached
    const warmCheck1 = db.checkAndIncrementWarmupLimit(inst1.id, warmJid);
    assert.equal(warmCheck1.allowed, true);
    assert.equal(warmCheck1.limit, 50);
    assert.equal(warmCheck1.current, 1);
    assert.equal(warmCheck1.tier, 'warm');

    // Decrement quota rollback
    db.decrementWarmupLimit(inst1.id, 'cold');
    const rolledBack = db.checkWarmupLimit(inst1.id, 'cold');
    assert.equal(rolledBack.current, 7);
    assert.equal(rolledBack.allowed, true);

    // Re-fill the cold slot
    db.checkAndIncrementWarmupLimit(inst1.id, 'cold');
    assert.equal(db.checkWarmupLimit(inst1.id, 'cold').allowed, false);

    // Warm decrement rollback
    db.decrementWarmupLimit(inst1.id, warmJid);
    const rolledBackWarm = db.checkWarmupLimit(inst1.id, warmJid);
    assert.equal(rolledBackWarm.current, 0);
    assert.equal(rolledBackWarm.allowed, true);

    // 2. Schedule boundary verification across Days 2, 3, 4, 5, and 10+
    const scheduleExpectations = [
      { day: 2, coldLimit: 15, warmLimit: 100 },
      { day: 3, coldLimit: 25, warmLimit: 200 },
      { day: 4, coldLimit: 40, warmLimit: 350 },
      { day: 5, coldLimit: 60, warmLimit: 500 },
      { day: 10, coldLimit: 60, warmLimit: 500 }, // Day 5+ cap
    ];

    for (const sched of scheduleExpectations) {
      db.updateInstance(inst1.id, {
        warmup_day: sched.day,
        daily_cold_sent_count: 0,
        daily_warm_sent_count: 0,
        daily_sent_count: 0,
        last_sent_date: new Date().toISOString().slice(0, 10),
      });

      const coldCheck = db.checkWarmupLimit(inst1.id, 'cold');
      assert.equal(coldCheck.warmupDay, sched.day);
      assert.equal(coldCheck.limit, sched.coldLimit, `Day ${sched.day} cold limit must be ${sched.coldLimit}`);
      assert.equal(coldCheck.allowed, true);

      const warmCheck = db.checkWarmupLimit(inst1.id, 'warm');
      assert.equal(warmCheck.warmupDay, sched.day);
      assert.equal(warmCheck.limit, sched.warmLimit, `Day ${sched.day} warm limit must be ${sched.warmLimit}`);
      assert.equal(warmCheck.allowed, true);

      // Verify warm limit cap behavior
      db.updateInstance(inst1.id, { daily_warm_sent_count: sched.warmLimit });
      const warmCapHit = db.checkAndIncrementWarmupLimit(inst1.id, 'warm');
      assert.equal(warmCapHit.allowed, false);
      assert.equal(warmCapHit.errorCode, 'WARMUP_LIMIT_REACHED');

      // Verify cold limit cap behavior
      db.updateInstance(inst1.id, { daily_cold_sent_count: sched.coldLimit });
      const coldCapHit = db.checkAndIncrementWarmupLimit(inst1.id, 'cold');
      assert.equal(coldCapHit.allowed, false);
      assert.equal(coldCapHit.errorCode, 'COLD_WARMUP_LIMIT_REACHED');
    }

    // 3. Sandbox mode bypasses all warm-up limits
    db.updateInstance(inst1.id, { sandbox_mode: true });
    const sandboxCheck = db.checkAndIncrementWarmupLimit(inst1.id, 'cold');
    assert.equal(sandboxCheck.allowed, true);
    assert.equal(sandboxCheck.limit, 9999);

    // 4. Cascading delete removes known contacts
    db.deleteInstance(inst1.id);
    assert.equal(db.listKnownContacts(inst1.id).length, 0);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

