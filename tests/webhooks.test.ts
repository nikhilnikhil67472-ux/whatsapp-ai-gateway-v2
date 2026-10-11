import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';

test('Webhooks: URL persistence in PATCH, GET, and /status endpoints', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wag_admin_secret_key_12345',
    };

    // 1. Create an instance without webhook URLs
    const createRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_name: 'webhook-persist-test',
        ai_provider: 'openai',
      }),
    });
    assert.equal(createRes.status, 201);
    const inst = await createRes.json() as any;
    assert.equal(inst.webhook_url, null);
    assert.equal(inst.n8n_webhook_url, null);

    // 2. PATCH instance with both webhook_url and n8n_webhook_url (including whitespace to test trimming)
    const patchRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        webhook_url: '  https://webhook.site/abc-123  ',
        n8n_webhook_url: 'https://n8n.example.com/webhook/my-flow',
        webhook_secret: 'whsec_test_secret_123',
      }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json() as any;
    assert.equal(patched.webhook_url, 'https://webhook.site/abc-123');
    assert.equal(patched.n8n_webhook_url, 'https://n8n.example.com/webhook/my-flow');
    assert.equal(patched.webhook_secret, 'whsec_test_secret_123');

    // 3. GET /instances/:id returns saved URLs
    const getRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}`, {
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json() as any;
    assert.equal(fetched.webhook_url, 'https://webhook.site/abc-123');
    assert.equal(fetched.n8n_webhook_url, 'https://n8n.example.com/webhook/my-flow');
    assert.equal(fetched.webhook_secret, 'whsec_test_secret_123');

    // 4. GET /instances/:id/status returns saved URLs and all settings (preventing UI disappearance)
    const statusRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/status`, {
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json() as any;
    assert.equal(statusData.webhook_url, 'https://webhook.site/abc-123');
    assert.equal(statusData.n8n_webhook_url, 'https://n8n.example.com/webhook/my-flow');
    assert.equal(statusData.webhook_secret, 'whsec_test_secret_123');

    // 5. Updating with empty string clears them cleanly
    const clearRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        webhook_url: '',
        n8n_webhook_url: '',
      }),
    });
    assert.equal(clearRes.status, 200);
    const cleared = await clearRes.json() as any;
    assert.equal(cleared.webhook_url, null);
    assert.equal(cleared.n8n_webhook_url, null);

    // Clean up
    db.deleteInstance(inst.id);
  } finally {
    server.close();
  }
});

test('Webhooks: Live delivery log, ping test, inspection, and retry management', async () => {
  // Set up a mock destination webhook server
  let mockReceivedCount = 0;
  let lastMockHeaderSignature: string | null = null;
  const mockWebhookServer = http.createServer((req, res) => {
    mockReceivedCount++;
    lastMockHeaderSignature = req.headers['x-hub-signature-256'] as string || null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', received: true }));
  });
  await new Promise<void>((resolve) => mockWebhookServer.listen(0, resolve));
  const mockAddress = mockWebhookServer.address() as any;
  const mockWebhookUrl = `http://127.0.0.1:${mockAddress.port}/webhook-endpoint`;

  // Main app server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wag_admin_secret_key_12345',
    };

    // 1. Create an instance pointing to mock webhook server
    const createRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_name: 'webhook-inspector-test',
        webhook_url: mockWebhookUrl,
        webhook_secret: 'whsec_supersecret_signature_key',
      }),
    });
    assert.equal(createRes.status, 201);
    const inst = await createRes.json() as any;

    // 2. Dispatch a test webhook ping
    const testPingRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/test`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(testPingRes.status, 200);
    const pingData = await testPingRes.json() as any;
    assert.equal(pingData.success, true);
    assert.ok(pingData.delivery);
    assert.equal(pingData.delivery.event_type, 'webhook.test');
    assert.equal(pingData.delivery.status, 'delivered');
    assert.equal(pingData.delivery.response_status, 200);
    assert.ok(typeof pingData.delivery.duration_ms === 'number');
    assert.equal(mockReceivedCount, 1);
    assert.ok(lastMockHeaderSignature?.startsWith('sha256='));

    // 3. Query webhook deliveries list & statistics
    const deliveriesRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/deliveries`, {
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(deliveriesRes.status, 200);
    const listData = await deliveriesRes.json() as any;
    assert.equal(listData.instance_id, inst.id);
    assert.equal(listData.stats.total, 1);
    assert.equal(listData.stats.delivered, 1);
    assert.equal(listData.stats.failed, 0);
    assert.equal(listData.deliveries.length, 1);
    assert.equal(listData.deliveries[0].event_type, 'webhook.test');
    assert.equal(listData.deliveries[0].status, 'delivered');

    // 4. Retry webhook delivery endpoint
    const retryRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/deliveries/${listData.deliveries[0].id}/retry`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(retryRes.status, 200);
    const retryData = await retryRes.json() as any;
    assert.equal(retryData.success, true);
    assert.equal(mockReceivedCount, 2);

    // 5. Clear delivery history
    const deleteRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/deliveries`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    assert.equal(deleteRes.status, 200);

    const emptyDeliveriesRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/deliveries`, {
      headers: { Authorization: 'Bearer wag_admin_secret_key_12345' },
    });
    const emptyListData = await emptyDeliveriesRes.json() as any;
    assert.equal(emptyListData.deliveries.length, 0);
    assert.equal(emptyListData.stats.total, 0);

    // Clean up
    db.deleteInstance(inst.id);
  } finally {
    server.close();
    mockWebhookServer.close();
  }
});

test('Messages: Filtering empty notifications from conversation message feed', async () => {
  const inst = db.createInstance({ instance_name: 'msg-filter-test' });
  try {
    const remoteJid = '919876543210@s.whatsapp.net';

    // 1. Add valid text chat message
    db.addMessage({
      instance_id: inst.id,
      remote_jid: remoteJid,
      whatsapp_message_id: 'real_msg_1',
      from_me: false,
      direction: 'inbound',
      text_content: 'Hello, this is a real user chat!',
    });

    // 2. Add valid media chat message
    db.addMessage({
      instance_id: inst.id,
      remote_jid: remoteJid,
      whatsapp_message_id: 'real_msg_2',
      from_me: true,
      direction: 'outbound',
      media_url: 'https://example.com/photo.jpg',
      message_type: 'image',
      caption: 'Invoice attachment',
    });

    // 3. Add system notification / empty message artifact
    db.addMessage({
      instance_id: inst.id,
      remote_jid: remoteJid,
      whatsapp_message_id: 'empty_stub_1',
      from_me: false,
      direction: 'inbound',
      message_type: 'other',
      text_content: '   ',
      caption: null,
      media_url: null,
    });

    // Verify listMessages filters out the empty stub
    const messages = db.listMessages(inst.id);
    assert.equal(messages.length, 2);
    assert.equal(messages.some((m) => m.whatsapp_message_id === 'empty_stub_1'), false);
    assert.equal(messages.some((m) => m.whatsapp_message_id === 'real_msg_1'), true);
    assert.equal(messages.some((m) => m.whatsapp_message_id === 'real_msg_2'), true);

    // Verify getRecentMessages also filters out empty stubs
    const recent = db.getRecentMessages(inst.id, remoteJid);
    assert.equal(recent.length, 2);
    assert.equal(recent.some((m) => m.whatsapp_message_id === 'empty_stub_1'), false);
  } finally {
    db.deleteInstance(inst.id);
  }
});

test('Webhooks: Auto-normalization, test ping persistence, atomic claiming, and failure recording', async () => {
  // Set up a mock endpoint that returns a 500 server error
  let failServerHit = 0;
  const failServer = http.createServer((req, res) => {
    failServerHit++;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal destination error occurred' }));
  });
  await new Promise<void>((resolve) => failServer.listen(0, resolve));
  const failAddress = failServer.address() as any;
  const failServerUrl = `http://127.0.0.1:${failAddress.port}/error-endpoint`;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wag_admin_secret_key_12345',
    };

    // 1. Create instance with domain URL missing https:// protocol prefix
    const createRes = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_name: 'url-norm-test',
        webhook_url: 'webhook.site/my-inbound-hook',
        n8n_webhook_url: '192.168.1.55:5678/webhook/test',
      }),
    });
    assert.equal(createRes.status, 201);
    const inst = await createRes.json() as any;
    assert.equal(inst.webhook_url, 'https://webhook.site/my-inbound-hook');
    assert.equal(inst.n8n_webhook_url, 'http://192.168.1.55:5678/webhook/test');

    // 2. Test ping with save: true updating n8n URL to failServerUrl
    const testPingRes = await fetch(`${baseUrl}/api/v1/instances/${inst.id}/webhooks/test`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        target_type: 'n8n',
        target_url: failServerUrl,
        save: true,
      }),
    });
    assert.equal(testPingRes.status, 200);
    const pingResult = await testPingRes.json() as any;
    assert.equal(pingResult.success, false);
    assert.ok(pingResult.delivery);
    assert.equal(pingResult.delivery.response_status, 500);
    assert.ok(pingResult.delivery.duration_ms >= 0);
    assert.ok(pingResult.delivery.error_message?.includes('HTTP 500'));
    assert.ok(pingResult.delivery.response_body?.includes('Internal destination error'));

    // Check that save: true persisted the URL to the instance
    const freshInst = db.getInstance(inst.id);
    assert.equal(freshInst?.n8n_webhook_url, failServerUrl);

    // 3. Test atomic delivery claiming to prevent double-dispatch races
    const deliveryId = db.enqueueWebhookDelivery({
      instance_id: inst.id,
      event_type: 'message.received',
      target_url: 'https://example.com/webhook',
      payload: { hello: 'world' },
    });

    // First claim should succeed
    const claimedFirst = db.claimWebhookDeliveryForSending(deliveryId);
    assert.equal(claimedFirst, true);

    // Second simultaneous claim must fail (atomic state transition)
    const claimedSecond = db.claimWebhookDeliveryForSending(deliveryId);
    assert.equal(claimedSecond, false);

    // Cleanup
    db.deleteInstance(inst.id);
  } finally {
    server.close();
    failServer.close();
  }
});

