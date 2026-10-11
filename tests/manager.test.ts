import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../src/db/database.js';
import { WhatsAppEngineManager } from '../src/whatsapp/manager.js';

test('WhatsApp Engine Manager: State lifecycle and runtime state queries', async () => {
  const inst = db.createInstance({ instance_name: 'manager-test-instance' });

  try {
    const runtime = WhatsAppEngineManager.getRuntimeState(inst.id);
    assert.equal(runtime.hasSocket, false);
    assert.equal(runtime.starting, false);
    assert.equal(runtime.reconnectScheduled, false);

    // Stop instance
    await WhatsAppEngineManager.stopInstance(inst.id);
    const stopped = db.getInstance(inst.id);
    assert.equal(stopped?.status, 'stopped');

    // Logout instance
    await WhatsAppEngineManager.logoutInstance(inst.id);
    const loggedOut = db.getInstance(inst.id);
    assert.equal(loggedOut?.status, 'logged_out');
  } finally {
    await WhatsAppEngineManager.deleteInstance(inst.id);
    assert.equal(db.getInstance(inst.id), null);
  }
});
