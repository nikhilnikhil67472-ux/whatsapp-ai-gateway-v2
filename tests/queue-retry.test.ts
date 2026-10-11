import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GatewayDatabase } from '../src/db/database.js';

test('Queue & Retry: Reclaiming stale processing commands works with ISO cutoff', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-test-reclaim-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({ instance_name: 'reclaim-inst' });
    const cmdId = db.enqueueWorkerCommand(inst.id, 'start');
    db.markWorkerCommandProcessing(cmdId);

    // Timeout 0 minutes means anything created up to now should be reclaimed
    const reclaimed = db.reclaimStaleWorkerCommands(0);
    assert.equal(reclaimed, 1);

    const pending = db.listPendingWorkerCommands();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, cmdId);
    assert.equal(pending[0].status, 'pending');
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Queue & Retry: Outbound message retry scheduling and backoff', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-test-msg-retry-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({ instance_name: 'retry-inst' });
    const msgId = db.enqueueOutboundMessage({
      instance_id: inst.id,
      remote_jid: '919876543210@s.whatsapp.net',
      reply_type: 'text',
      text_content: 'Test retry message',
    });

    // Mark as retry scheduled in the future (10 seconds from now)
    const futureTime = new Date(Date.now() + 10000).toISOString();
    db.markOutboundMessageStatus(msgId, 'retry', 'Rate limited', futureTime);

    // Should NOT be returned while next_attempt_at is in future
    const pendingFuture = db.listPendingOutboundMessages();
    assert.equal(pendingFuture.length, 0);

    // Now mark as retry scheduled in the past (already due)
    const pastTime = new Date(Date.now() - 5000).toISOString();
    db.markOutboundMessageStatus(msgId, 'retry', 'Rate limited past', pastTime);

    // Should NOW be picked up
    const pendingDue = db.listPendingOutboundMessages();
    assert.equal(pendingDue.length, 1);
    assert.equal(pendingDue[0].id, msgId);
    assert.equal(pendingDue[0].attempts, 2); // Incremented twice
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Queue & Retry: Webhook delivery retry scheduling', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-test-wh-retry-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new GatewayDatabase(dbPath);

  try {
    const inst = db.createInstance({ instance_name: 'wh-retry-inst' });
    const whId = db.enqueueWebhookDelivery({
      instance_id: inst.id,
      event_type: 'message.received',
      target_url: 'https://example.com/webhook',
      payload: { hello: 'world' },
    });

    // Mark failed (attempt 1) -> schedules next attempt in future
    db.markWebhookFailed(whId, 'Internal Server Error', 500);

    // In future -> not picked up
    const pendingFuture = db.listPendingWebhookDeliveries();
    assert.equal(pendingFuture.length, 0);

    // Simulate clock advancing: manually update next_attempt_at to past
    db.getRawDb().prepare("UPDATE webhook_deliveries SET next_attempt_at = ? WHERE id = ?")
      .run(new Date(Date.now() - 1000).toISOString(), whId);

    // Now it should be picked up
    const pendingPast = db.listPendingWebhookDeliveries();
    assert.equal(pendingPast.length, 1);
    assert.equal(pendingPast[0].id, whId);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
