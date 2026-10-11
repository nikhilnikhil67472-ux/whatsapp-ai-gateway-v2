import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { generateApiKey } from '../src/security/crypto.js';
import { normalizeBaileysMessage, instanceEventStream } from '../src/whatsapp/events.js';

let server: http.Server;
let port: number;
let baseUrl: string;
let testInstanceId: string;
let testApiKey: string;

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; rawText: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed, rawText: data });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

test('Setup Test Server & Test Instance', async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Ensure default instance
  let inst = db.getInstanceByIdentifier('test_mcp_instance');
  if (!inst) {
    inst = db.createInstance({
      instance_name: 'test_mcp_instance',
      pairing_phone: '919876543210',
    });
  }
  testInstanceId = inst.id;

  const { key, hash } = generateApiKey();
  db.createApiKeyRecord('Test MCP Key', hash, key.slice(0, 8));
  testApiKey = key;
});

test('Advanced Messaging: Inbound Poll Creation Normalization', () => {
  const pollRaw = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'POLL_MSG_001',
      fromMe: false,
    },
    message: {
      pollCreationMessage: {
        name: 'Which WhatsApp Gateway is best?',
        options: [
          { optionName: 'WhatsApp AI Gateway v2' },
          { optionName: 'Evolution API' },
          { optionName: 'Open-WA' },
        ],
        selectableOptionsCount: 1,
      },
    },
    messageTimestamp: 1700000000,
  } as any;

  const norm = normalizeBaileysMessage(pollRaw);
  assert.ok(norm, 'Poll message must not be dropped');
  assert.strictEqual(norm.type, 'poll');
  assert.strictEqual(norm.text, 'Which WhatsApp Gateway is best?');
  assert.ok(norm.poll);
  assert.strictEqual(norm.poll.question, 'Which WhatsApp Gateway is best?');
  assert.strictEqual(norm.poll.options.length, 3);
  assert.strictEqual(norm.poll.selectableCount, 1);
});

test('Advanced Messaging: REST API Endpoints Validation', async () => {
  // 1. Send Sticker Validation (missing required fields)
  const resSticker = await makeRequest(
    'POST',
    '/api/v1/whatsapp/send-sticker',
    { 'x-api-key': testApiKey },
    { instance_id: testInstanceId }
  );
  assert.strictEqual(resSticker.status, 400);

  // 2. Send Poll Validation (requires minimum 2 options)
  const resPoll = await makeRequest(
    'POST',
    '/api/v1/whatsapp/send-poll',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      remote_jid: '919876543210@s.whatsapp.net',
      name: 'Single Option Poll',
      values: ['Only One'],
    }
  );
  assert.strictEqual(resPoll.status, 400);
  assert.ok(resPoll.body.error.includes('minimum 2 options'));

  // 3. Message Edit Validation
  const resEdit = await makeRequest(
    'POST',
    '/api/v1/whatsapp/messages/edit',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      remote_jid: '919876543210@s.whatsapp.net',
      message_id: 'MSG_1',
    }
  );
  assert.strictEqual(resEdit.status, 400);

  // 4. Message Delete Validation
  const resDel = await makeRequest(
    'POST',
    '/api/v1/whatsapp/messages/delete',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      remote_jid: '919876543210@s.whatsapp.net',
    }
  );
  assert.strictEqual(resDel.status, 400);

  // 5. Message Read Receipts Validation
  const resRead = await makeRequest(
    'POST',
    '/api/v1/whatsapp/messages/read',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      remote_jid: '919876543210@s.whatsapp.net',
      message_ids: [],
    }
  );
  assert.strictEqual(resRead.status, 400);
});

test('Group Administration: REST API Validation', async () => {
  // 1. Create Group Validation (requires subject and participants)
  const resCreate = await makeRequest(
    'POST',
    '/api/v1/whatsapp/groups',
    { 'x-api-key': testApiKey },
    { instance_id: testInstanceId, subject: '' }
  );
  assert.strictEqual(resCreate.status, 400);

  // 2. Manage Participants Validation (requires valid action)
  const resParts = await makeRequest(
    'POST',
    '/api/v1/whatsapp/groups/12345@g.us/participants',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      participants: ['919876543210'],
      action: 'invalid_action',
    }
  );
  assert.strictEqual(resParts.status, 400);

  // 3. Update Settings Validation
  const resSetting = await makeRequest(
    'PATCH',
    '/api/v1/whatsapp/groups/12345@g.us/settings',
    { 'x-api-key': testApiKey },
    {
      instance_id: testInstanceId,
      setting: 'invalid_setting',
    }
  );
  assert.strictEqual(resSetting.status, 400);
});

test('Model Context Protocol (MCP): initialize and tools/list', async () => {
  // 1. initialize
  const initRes = await makeRequest(
    'POST',
    '/api/v1/mcp',
    { 'x-api-key': testApiKey },
    { jsonrpc: '2.0', id: 1, method: 'initialize' }
  );
  assert.strictEqual(initRes.status, 200);
  assert.strictEqual(initRes.body.result.serverInfo.name, 'whatsapp-ai-gateway-mcp');
  assert.strictEqual(initRes.body.result.serverInfo.version, '2.0.0');

  // 2. tools/list
  const listRes = await makeRequest(
    'POST',
    '/api/v1/mcp',
    { 'x-api-key': testApiKey },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' }
  );
  assert.strictEqual(listRes.status, 200);
  const tools = listRes.body.result.tools;
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 7, 'Should provide at least 7 MCP tools');

  const toolNames = tools.map((t: any) => t.name);
  assert.ok(toolNames.includes('wag_list_instances'));
  assert.ok(toolNames.includes('wag_check_number'));
  assert.ok(toolNames.includes('wag_send_text'));
  assert.ok(toolNames.includes('wag_send_media'));
  assert.ok(toolNames.includes('wag_send_sticker'));
  assert.ok(toolNames.includes('wag_send_poll'));
  assert.ok(toolNames.includes('wag_manage_group'));
});

test('Model Context Protocol (MCP): tools/call execution', async () => {
  // Call wag_list_instances
  const callRes = await makeRequest(
    'POST',
    '/api/v1/mcp',
    { 'x-api-key': testApiKey },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'wag_list_instances',
        arguments: {},
      },
    }
  );
  assert.strictEqual(callRes.status, 200);
  assert.ok(callRes.body.result.content);
  assert.strictEqual(callRes.body.result.content[0].type, 'text');

  const parsedContent = JSON.parse(callRes.body.result.content[0].text);
  assert.ok(Array.isArray(parsedContent.instances));
  assert.ok(parsedContent.instances.some((i: any) => i.id === testInstanceId));
});

test('Real-Time Streaming: Server-Sent Events (SSE) Endpoint', async () => {
  // Connect to SSE stream
  let receivedData = '';
  const ssePromise = new Promise<void>((resolve, reject) => {
    const url = new URL(`/api/v1/instances/${testInstanceId}/events/stream`, baseUrl);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: {
          'x-api-key': testApiKey,
          Accept: 'text/event-stream',
        },
      },
      (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.headers['content-type']?.includes('text/event-stream'));

        res.on('data', (chunk) => {
          receivedData += chunk.toString();
          if (receivedData.includes('stream.connected')) {
            req.destroy();
            resolve();
          }
        });
      }
    );
    req.on('error', (err) => {
      if ((err as any).code === 'ECONNRESET') {
        resolve();
      } else {
        reject(err);
      }
    });
    req.end();
  });

  await ssePromise;
  assert.ok(receivedData.includes('stream.connected'), 'Must receive stream.connected initial event');
});

test('Teardown Test Server', async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});
