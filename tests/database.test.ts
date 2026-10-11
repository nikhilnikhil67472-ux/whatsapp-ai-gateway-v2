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
