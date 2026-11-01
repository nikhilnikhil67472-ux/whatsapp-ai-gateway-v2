import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../src/db/database.js';
import {
  WhatsAppEngineManager,
  calculateReconnectDelay,
  getDisconnectStatusCode,
  getSocketConfig,
  resolveProxyAgent,
  setIpFetcher,
  setProxyVerifier,
  shouldReconnect,
  verifyProxyConnection,
} from '../src/whatsapp/manager.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../src/config/index.js';

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

test('Baileys Socket Hardening: Fingerprint & Socket Options Contract', () => {
  const fakeState = { creds: { registered: false }, keys: {} };
  const fakeLogger = { info: () => {}, warn: () => {}, error: () => {} };
  const fakeAgent = new HttpsProxyAgent('http://127.0.0.1:8080');

  const options = getSocketConfig(fakeState, fakeLogger, fakeAgent);

  // 1. Desktop Browser signature matching Browsers.macOS('Desktop')
  assert.deepEqual(options.browser, ['Mac OS', 'Desktop', '14.4.1']);

  // 2. Anti-detection fingerprint flags
  assert.equal(options.markOnlineOnConnect, false, 'markOnlineOnConnect must be false to avoid perpetual online tell');
  assert.equal(options.syncFullHistory, false, 'syncFullHistory must be false to prevent bulk history sync triggers');
  assert.equal(options.generateHighQualityLinkPreview, true, 'generateHighQualityLinkPreview must be true');

  // 3. Agent assignment
  assert.equal(options.agent, fakeAgent);
  assert.equal(options.fetchAgent, fakeAgent);

  // 4. Proxy Agent resolution across protocols
  assert.ok(resolveProxyAgent('socks5://127.0.0.1:9050') instanceof SocksProxyAgent);
  assert.ok(resolveProxyAgent('socks4://127.0.0.1:9050') instanceof SocksProxyAgent);
  assert.ok(resolveProxyAgent('socks5h://127.0.0.1:9050') instanceof SocksProxyAgent);
  assert.ok(resolveProxyAgent('http://127.0.0.1:8080') instanceof HttpsProxyAgent);
  assert.ok(resolveProxyAgent('https://127.0.0.1:8443') instanceof HttpsProxyAgent);
  assert.equal(resolveProxyAgent(null), undefined);
  assert.equal(resolveProxyAgent(''), undefined);
});

test('Baileys Socket Hardening: Exponential backoff with randomized jitter (5s -> 15s -> 45s)', () => {
  // Attempt 1: 5s + jitter (0 - 2000ms)
  const delay1 = calculateReconnectDelay(1);
  assert.ok(delay1 >= 5000 && delay1 <= 7000, `Delay 1 (${delay1}ms) should be in [5000, 7000]`);

  // Attempt 2: 15s + jitter (0 - 2000ms)
  const delay2 = calculateReconnectDelay(2);
  assert.ok(delay2 >= 15000 && delay2 <= 17000, `Delay 2 (${delay2}ms) should be in [15000, 17000]`);

  // Attempt 3: 45s + jitter (0 - 2000ms)
  const delay3 = calculateReconnectDelay(3);
  assert.ok(delay3 >= 45000 && delay3 <= 47000, `Delay 3 (${delay3}ms) should be in [45000, 47000]`);
});

test('Fail-Closed Proxy Guard: Connectivity, Egress Leak Protection, and Abort Behavior', async () => {
  const prevRequireProxy = config.requireProxy;

  try {
    // 1. Fail-closed when REQUIRE_PROXY=true but no proxy configured
    config.requireProxy = true;
    await assert.rejects(
      async () => verifyProxyConnection(null),
      /Egress proxy is required by configuration/
    );

    // 2. Reject invalid proxy URL syntax
    config.requireProxy = false;
    await assert.rejects(
      async () => verifyProxyConnection('invalid-protocol://foo:bar'),
      /Invalid proxy configuration/
    );

    // 3. Reject when proxy leaks host datacenter IP (simulated via IP fetcher)
    setIpFetcher(async (agent) => {
      // Direct egress and proxy egress return the same IP
      return '203.0.113.1';
    });
    await assert.rejects(
      async () => verifyProxyConnection('http://proxy.internal:8080'),
      /Egress IP leak detected/
    );

    // 4. Reject when proxy leaks IPv6 address despite casing differences
    setIpFetcher(async (agent) => {
      return agent ? '2001:0DB8::FF00:0042:8329' : '2001:0db8::ff00:0042:8329';
    });
    await assert.rejects(
      async () => verifyProxyConnection('http://proxy.internal:8080'),
      /Egress IP leak detected/
    );

    // 5. Reject when proxy is offline / unreachable
    setIpFetcher(async (agent) => {
      if (!agent) return '203.0.113.1';
      throw new Error('connect ECONNREFUSED 198.51.100.2:8080');
    });
    await assert.rejects(
      async () => verifyProxyConnection('http://offline.proxy:8080'),
      /Proxy connection unreachable or timed out/
    );

    // 6. Pass when proxy provides distinct egress IP without leak
    setIpFetcher(async (agent) => {
      return agent ? '198.51.100.1' : '203.0.113.1';
    });
    const result = await verifyProxyConnection('http://clean.proxy:8080');
    assert.equal(result.ok, true);
    assert.equal(result.egressIp, '198.51.100.1');
    assert.equal(result.hostIp, '203.0.113.1');

    // 7. Test startInstance fail-closed abort with failing proxy
    setIpFetcher(async (agent) => {
      return '203.0.113.1'; // leak
    });
    const failInst = db.createInstance({
      instance_name: `proxy-fail-test-${Date.now()}`,
      proxy_url: 'http://leaking.proxy:8080',
    });

    try {
      await assert.rejects(
        async () => WhatsAppEngineManager.startInstance(failInst.id),
        /Fail-Closed Proxy Guard/
      );

      const updated = db.getInstance(failInst.id);
      assert.equal(updated?.status, 'failed');

      // Also ensure pairing code fails closed on proxy error
      await assert.rejects(
        async () => WhatsAppEngineManager.requestPairingCode(failInst.id, '1234567890'),
        /Fail-Closed Proxy Guard/
      );
    } finally {
      await WhatsAppEngineManager.deleteInstance(failInst.id);
    }
  } finally {
    config.requireProxy = prevRequireProxy;
    setIpFetcher(null);
    setProxyVerifier(null);
  }
});

test('DisconnectReason Circuit Breaker: Immediate Tripping, SQLite Persistence & Cross-Restart Resistance', async () => {
  const { DisconnectReason } = await import('@whiskeysockets/baileys');

  const testInst = db.createInstance({ instance_name: `breaker-test-${Date.now()}` });

  try {
    // 1. Initial state: circuit breaker is not tripped
    assert.equal(WhatsAppEngineManager.isCircuitBreakerTripped(testInst.id), false);

    // 2. Trip on 403 (forbidden / ban)
    WhatsAppEngineManager.tripCircuitBreaker(testInst.id, DisconnectReason.forbidden);
    assert.equal(WhatsAppEngineManager.isCircuitBreakerTripped(testInst.id), true);
    const breakerState = WhatsAppEngineManager.getCircuitBreaker(testInst.id);
    assert.equal(breakerState?.reason, 403);
    assert.equal(breakerState?.code, 'forbidden');

    // Verify status was persisted in SQLite as 'flagged'
    const flaggedDbInst = db.getInstance(testInst.id);
    assert.equal(flaggedDbInst?.status, 'flagged');

    // 3. Simulate process restart / memory loss:
    // Calling tripCircuitBreaker set memory state, but even if memory Map is cleared,
    // SQLite 'flagged' status must maintain the circuit breaker trip!
    WhatsAppEngineManager.resetCircuitBreaker(testInst.id);
    // Artificially simulate an instance loaded from SQLite with status 'flagged'
    db.updateInstance(testInst.id, { status: 'flagged' });
    assert.equal(WhatsAppEngineManager.isCircuitBreakerTripped(testInst.id), true, 'Must remain tripped from SQLite flagged status');

    // 4. startInstance must refuse to run while circuit breaker is active (even after restart)
    await assert.rejects(
      async () => WhatsAppEngineManager.startInstance(testInst.id),
      /Circuit breaker active/
    );

    // 5. requestPairingCode must also refuse to run while circuit breaker is active
    await assert.rejects(
      async () => WhatsAppEngineManager.requestPairingCode(testInst.id, '1234567890'),
      /Circuit breaker active/
    );

    // 6. Reset circuit breaker allows operation again and resets SQLite status
    WhatsAppEngineManager.resetCircuitBreaker(testInst.id);
    assert.equal(WhatsAppEngineManager.isCircuitBreakerTripped(testInst.id), false);
    const unflaggedDbInst = db.getInstance(testInst.id);
    assert.equal(unflaggedDbInst?.status, 'disconnected');

    // 7. Verify runtime state reports circuit breaker on loggedOut
    WhatsAppEngineManager.tripCircuitBreaker(testInst.id, DisconnectReason.loggedOut);
    const runtime = WhatsAppEngineManager.getRuntimeState(testInst.id);
    assert.equal(runtime.circuitBreakerTripped, true);
    assert.equal(runtime.circuitBreaker?.reason, 401);
    assert.equal(runtime.reconnectScheduled, false, 'Reconnect timer must never be scheduled when circuit breaker is active');

    // 8. Verify multideviceMismatch trips circuit breaker and flags instance
    WhatsAppEngineManager.tripCircuitBreaker(testInst.id, DisconnectReason.multideviceMismatch);
    const mdmState = WhatsAppEngineManager.getCircuitBreaker(testInst.id);
    assert.equal(mdmState?.reason, 411);
    assert.equal(mdmState?.code, 'multideviceMismatch');
    assert.equal(db.getInstance(testInst.id)?.status, 'flagged');

    // 9. Verify badSession trips circuit breaker
    WhatsAppEngineManager.tripCircuitBreaker(testInst.id, DisconnectReason.badSession);
    const badState = WhatsAppEngineManager.getCircuitBreaker(testInst.id);
    assert.equal(badState?.reason, 500);
    assert.equal(badState?.code, 'badSession');
  } finally {
    await WhatsAppEngineManager.deleteInstance(testInst.id);
  }
});

test('DisconnectReason: Terminal vs. Transient error classification and Boom unwrapping', async () => {
  const { DisconnectReason } = await import('@whiskeysockets/baileys');

  // 1. Terminal Disconnect Reasons must NEVER auto-reconnect (shouldReconnect === false)
  const terminalCodes = [
    DisconnectReason.loggedOut, // 401
    DisconnectReason.forbidden, // 403
    DisconnectReason.multideviceMismatch, // 411
    DisconnectReason.badSession, // 500
    401,
    403,
    411,
    500,
  ];

  for (const code of terminalCodes) {
    assert.equal(
      shouldReconnect(code),
      false,
      `DisconnectReason / status code ${code} is terminal and must NOT trigger auto-reconnect`
    );
  }

  // 2. Transient Disconnect Reasons SHOULD trigger auto-reconnect (shouldReconnect === true)
  const transientCodes = [
    DisconnectReason.connectionClosed, // 428
    DisconnectReason.connectionLost, // 408
    DisconnectReason.timedOut, // 408
    DisconnectReason.restartRequired, // 515
    503, // Service Unavailable
    null, // Unexpected closure without status code
  ];

  for (const code of transientCodes) {
    assert.equal(
      shouldReconnect(code),
      true,
      `DisconnectReason / status code ${code} is transient and MUST permit auto-reconnect`
    );
  }

  // 3. getDisconnectStatusCode unwraps Boom error structures correctly
  assert.equal(getDisconnectStatusCode({ output: { statusCode: 403 } }), 403);
  assert.equal(getDisconnectStatusCode({ statusCode: 401 }), 401);
  assert.equal(getDisconnectStatusCode({ data: { statusCode: 411 } }), 411);
  assert.equal(getDisconnectStatusCode(new Error('raw error')), null);
  assert.equal(getDisconnectStatusCode(null), null);
  assert.equal(getDisconnectStatusCode(undefined), null);
});

