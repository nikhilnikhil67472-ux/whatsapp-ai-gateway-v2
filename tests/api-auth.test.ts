import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { generateApiKey } from '../src/security/crypto.js';

test('REST API Auth & Validation: API Key verification and schema empty string sanitization', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Create a valid API Key in DB
    const { key, hash } = generateApiKey();
    db.createApiKeyRecord('Test Client Key', hash, key.slice(0, 8));

    // 2. Request with invalid API key should return 401
    const badRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: 'Bearer wag_invalid_fake_key_12345' },
    });
    assert.equal(badRes.status, 401);
    const badData = await badRes.json() as any;
    assert.match(badData.error, /Unauthorized/);

    // 3. Request with valid API key in Bearer format should succeed
    const validRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    assert.equal(validRes.status, 200);

    // 4. Request with valid API key in x-api-key header should succeed
    const headerRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { 'x-api-key': key },
    });
    assert.equal(headerRes.status, 200);

    // 5. Create instance with empty string webhook URLs (form submissions often send "")
    const formRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        instance_name: 'empty-url-test',
        webhook_url: '',
        n8n_webhook_url: '',
        ai_model: '',
      }),
    });
    assert.equal(formRes.status, 201);
    const created = await formRes.json() as any;
    assert.equal(created.instance_name, 'empty-url-test');
    assert.equal(created.webhook_url, null);
    assert.equal(created.n8n_webhook_url, null);

    // Clean up
    db.deleteInstance(created.id);
  } finally {
    server.close();
  }
});
