import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../src/db/database.js';
import {
  createSqliteAuthState,
  hasRegisteredAuthState,
  clearSqliteAuthState,
} from '../src/whatsapp/session-store.js';

test('Session Store: SQLite Auth State lifecycle and key management', async () => {
  const inst = db.createInstance({ instance_name: 'session-store-test' });

  try {
    assert.equal(hasRegisteredAuthState(inst.id), false);

    const { state, saveCreds } = await createSqliteAuthState(inst.id);
    assert.ok(state.creds);
    assert.ok(state.keys);

    // Update registration state and save
    state.creds.registered = true;
    await saveCreds();

    assert.equal(hasRegisteredAuthState(inst.id), true);

    // Save and retrieve signal keys
    const dummyKey = { keyId: 1, secret: 'signal_secret_bytes' };
    await state.keys.set({
      'pre-key': {
        '1': dummyKey as any,
      },
    });

    const retrieved = await state.keys.get('pre-key', ['1']);
    assert.deepEqual(retrieved['1'], dummyKey);

    // Clear auth state
    clearSqliteAuthState(inst.id);
    assert.equal(hasRegisteredAuthState(inst.id), false);
  } finally {
    db.deleteInstance(inst.id);
  }
});
