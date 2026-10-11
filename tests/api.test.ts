import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';

test('REST API: Health check and docs endpoint', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json() as any;
    assert.equal(healthData.status, 'healthy');
    assert.equal(healthData.database, 'connected');

    // 2. OpenAPI Spec
    const docsRes = await fetch(`${baseUrl}/api-docs`);
    assert.equal(docsRes.status, 200);
    const docsData = await docsRes.json() as any;
    assert.equal(docsData.openapi, '3.0.3');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wag_admin_secret_key_12345',
    };

    // 3. Create Instance
    const instRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_name: 'api-test-instance',
        ai_provider: 'openai',
        sandbox_mode: true,
      }),
    });
    assert.equal(instRes.status, 201);
    const createdInst = await instRes.json() as any;
    assert.ok(createdInst.id);
    assert.equal(createdInst.instance_name, 'api-test-instance');

    // 4. Duplicate name returns 409
    const dupRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_name: 'api-test-instance',
      }),
    });
    assert.equal(dupRes.status, 409);

    // 5. Status endpoint
    const statusRes = await fetch(`${baseUrl}/api/v1/instances/${createdInst.id}/status`, {
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json() as any;
    assert.equal(statusData.id, createdInst.id);
    assert.equal(statusData.instance_name, 'api-test-instance');

    // 6. Send message in sandbox mode
    const sendRes = await fetch(`${baseUrl}/api/v1/whatsapp/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: createdInst.id,
        remote_jid: '919876543210',
        text: 'Hello test!',
      }),
    });
    assert.equal(sendRes.status, 202);
    const sendData = await sendRes.json() as any;
    assert.equal(sendData.success, true);
    assert.ok(sendData.message_id);

    // 7. API Key generation
    const keyRes = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Integration Test Key' }),
    });
    assert.equal(keyRes.status, 201);
    const keyData = await keyRes.json() as any;
    assert.ok(keyData.api_key.startsWith('wag_'));

    // Clean up created instance
    db.deleteInstance(createdInst.id);
  } finally {
    server.close();
  }
});
