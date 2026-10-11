import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { resolveProxyAgent } from '../src/whatsapp/manager.js';
import { hashPassword, verifyPassword, createJwtToken, verifyJwtToken } from '../src/security/auth.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

test('Production Phase 1: Security & Strict Authentication', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Unauthenticated request without headers MUST return 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/instances`);
    assert.equal(unauthRes.status, 401);
    const unauthData = (await unauthRes.json()) as any;
    assert.match(unauthData.error, /Unauthorized/);

    // 2. Request with malformed Bearer token returns 401
    const malformedRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: 'Bearer this_is_not_a_valid_token' },
    });
    assert.equal(malformedRes.status, 401);

    // 3. Demo login returns token for default admin
    const demoRes = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
    });
    assert.equal(demoRes.status, 200);
    const demoData = (await demoRes.json()) as any;
    assert.ok(demoData.token);
    assert.equal(demoData.user.email, 'admin@gateway.local');
    assert.equal(demoData.organization.id, db.getDefaultOrgId());

    // 4. Authenticated request using Demo JWT succeeds
    const authedRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: `Bearer ${demoData.token}` },
    });
    assert.equal(authedRes.status, 200);

    // 5. Auth /me endpoint returns user and organization profile
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${demoData.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = (await meRes.json()) as any;
    assert.equal(meData.user.email, 'admin@gateway.local');
    assert.ok(meData.organization);
  } finally {
    server.close();
  }
});

test('Production Phase 1: Multi-Tenant Workspace & Account Isolation', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const runId = Math.random().toString(36).slice(2, 8);
  const emailA = `tenant.alpha.${runId}@example.com`;
  const emailB = `tenant.beta.${runId}@example.com`;

  try {
    // 1. Register Tenant A
    const regResA = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailA,
        password: 'password123',
        name: 'Alpha User',
        organization_name: 'Alpha Corp',
      }),
    });
    assert.equal(regResA.status, 201);
    const authA = (await regResA.json()) as any;
    assert.ok(authA.token);

    // 2. Register Tenant B
    const regResB = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailB,
        password: 'password456',
        name: 'Beta User',
        organization_name: 'Beta LLC',
      }),
    });
    assert.equal(regResB.status, 201);
    const authB = (await regResB.json()) as any;
    assert.ok(authB.token);

    // 3. Tenant A creates an instance with proxy configuration
    const createResA = await fetch(`${baseUrl}/api/v1/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authA.token}`,
      },
      body: JSON.stringify({
        instance_name: 'alpha-sales-wa',
        proxy_url: 'socks5://127.0.0.1:9050',
        sandbox_mode: true,
      }),
    });
    assert.equal(createResA.status, 201);
    const instA = (await createResA.json()) as any;
    assert.equal(instA.org_id, authA.organization.id);
    assert.equal(instA.proxy_url, 'socks5://127.0.0.1:9050');

    // 4. Tenant B lists instances -> MUST NOT see Tenant A's instance!
    const listResB = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: `Bearer ${authB.token}` },
    });
    assert.equal(listResB.status, 200);
    const listB = (await listResB.json()) as any[];
    const hasInstA = listB.some((i) => i.id === instA.id || i.instance_name === 'alpha-sales-wa');
    assert.equal(hasInstA, false, 'Tenant B must not see Tenant A instances');

    // 5. Tenant B attempts to access Tenant A's instance directly by ID -> MUST return 404
    const crossAccessRes = await fetch(`${baseUrl}/api/v1/instances/${instA.id}`, {
      headers: { Authorization: `Bearer ${authB.token}` },
    });
    assert.equal(crossAccessRes.status, 404, 'Cross-tenant instance access must return 404');

    // 6. Tenant A generates a scoped API Key
    const keyRes = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authA.token}`,
      },
      body: JSON.stringify({
        name: 'Alpha Production CRM Key',
        scopes: ['messages:send', 'instances:read'],
      }),
    });
    assert.equal(keyRes.status, 201);
    const keyData = (await keyRes.json()) as any;
    assert.ok(keyData.api_key.startsWith('wag_'));

    // 7. Use Tenant A's API Key to fetch instances
    const keyAuthRes = await fetch(`${baseUrl}/api/v1/instances`, {
      headers: { Authorization: `Bearer ${keyData.api_key}` },
    });
    assert.equal(keyAuthRes.status, 200);
    const keyInstList = (await keyAuthRes.json()) as any[];
    assert.ok(keyInstList.some((i) => i.id === instA.id));

    // Clean up
    db.deleteInstance(instA.id);
  } finally {
    server.close();
  }
});

test('Production Phase 1: Baileys v7 Proxy Agent Resolution', () => {
  const socksAgent = resolveProxyAgent('socks5://user:pass@127.0.0.1:1080');
  assert.ok(socksAgent instanceof SocksProxyAgent);

  const socksOldAgent = resolveProxyAgent('socks://127.0.0.1:1080');
  assert.ok(socksOldAgent instanceof SocksProxyAgent);

  const httpAgent = resolveProxyAgent('http://corporate.proxy.net:8080');
  assert.ok(httpAgent instanceof HttpsProxyAgent);

  const httpsAgent = resolveProxyAgent('https://corporate.proxy.net:8443');
  assert.ok(httpsAgent instanceof HttpsProxyAgent);

  const emptyAgent = resolveProxyAgent('');
  assert.equal(emptyAgent, undefined);

  const nullAgent = resolveProxyAgent(null);
  assert.equal(nullAgent, undefined);
});

test('Production Phase 1: Password Hashing & JWT Security', () => {
  const password = 'SuperSecretEnterprisePassword#2026';
  const hash = hashPassword(password);

  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword('WrongPassword123', hash), false);

  const token = createJwtToken({
    userId: 'usr_test_123',
    orgId: 'org_test_abc',
    role: 'owner',
    email: 'test@example.com',
  });

  const verified = verifyJwtToken(token);
  assert.ok(verified);
  assert.equal(verified?.userId, 'usr_test_123');
  assert.equal(verified?.orgId, 'org_test_abc');
  assert.equal(verified?.role, 'owner');
  assert.equal(verified?.email, 'test@example.com');

  assert.equal(verifyJwtToken('invalid.token.payload'), null);
});
