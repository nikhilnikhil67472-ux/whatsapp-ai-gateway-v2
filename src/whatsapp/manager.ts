import makeWASocket, {
  Browsers,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import https from 'node:https';
import http from 'node:http';
import { db, WhatsAppInstance } from '../db/database.js';
import { bindWhatsAppEvents } from './events.js';
import {
  clearSqliteAuthState,
  createSqliteAuthState,
  hasRegisteredAuthState,
} from './session-store.js';
import { config } from '../config/index.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyCheckResult, CircuitBreakerState } from './types.js';

export function resolveProxyAgent(proxyUrl?: string | null): any {
  if (!proxyUrl) return undefined;
  const trimmed = proxyUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('socks')) {
    return new SocksProxyAgent(trimmed);
  }
  return new HttpsProxyAgent(trimmed);
}

type ProxyVerifierFn = (proxyUrl?: string | null) => Promise<ProxyCheckResult>;
let customProxyVerifier: ProxyVerifierFn | null = null;

export function setProxyVerifier(verifier: ProxyVerifierFn | null): void {
  customProxyVerifier = verifier;
}

type IpFetcherFn = (agent?: any, timeoutMs?: number) => Promise<string>;
let customIpFetcher: IpFetcherFn | null = null;

export function setIpFetcher(fetcher: IpFetcherFn | null): void {
  customIpFetcher = fetcher;
}

export async function fetchPublicIp(agent?: any, timeoutMs = 5000): Promise<string> {
  if (customIpFetcher) {
    return await customIpFetcher(agent, timeoutMs);
  }

  const url = config.proxyCheckUrl || 'https://api.ipify.org?format=json';
  const isHttps = url.startsWith('https://');
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        agent,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'WhatsAppAiGateway/2.0 (+curl/7.88.1)',
          Accept: 'application/json, text/plain',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`Proxy check HTTP status ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const ip = parsed.ip || parsed.query || parsed.origin || parsed.ip_address;
            if (ip) {
              return resolve(String(ip).trim());
            }
          } catch {
            const trimmed = data.trim();
            if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed)) {
              return resolve(trimmed);
            }
          }
          if (data.trim()) return resolve(data.trim());
          reject(new Error('Proxy check response did not return a valid IP address'));
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Proxy check timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

export async function verifyProxyConnection(proxyUrl?: string | null): Promise<ProxyCheckResult> {
  const checkedAt = new Date().toISOString();

  // Fail-closed if proxy is required globally but none is configured
  if (!proxyUrl || !proxyUrl.trim()) {
    if (config.requireProxy) {
      throw new Error('Egress proxy is required by configuration (REQUIRE_PROXY=true), but no proxy is configured.');
    }
    return { ok: true, proxyUrl: null, checkedAt };
  }

  const trimmed = proxyUrl.trim();

  // Custom injected verifier for unit testing
  if (customProxyVerifier) {
    return await customProxyVerifier(trimmed);
  }

  let agent: any;
  try {
    agent = resolveProxyAgent(trimmed);
  } catch (err: any) {
    throw new Error(`Invalid proxy configuration: ${err?.message || trimmed}`);
  }

  if (!agent) {
    throw new Error(`Failed to initialize proxy agent for: ${trimmed}`);
  }

  // 1. Fetch direct host public IP (best-effort, ignoring errors if direct egress is firewalled)
  let hostIp: string | null = null;
  try {
    hostIp = await fetchPublicIp(undefined, 3000);
  } catch {
    hostIp = null;
  }

  // 2. Fetch egress IP through proxy agent (strict requirement)
  let egressIp: string;
  try {
    egressIp = await fetchPublicIp(agent, 6000);
  } catch (err: any) {
    throw new Error(`Proxy connection unreachable or timed out: ${err?.message || 'unknown error'}`);
  }

  // 3. Fail-Closed Leak Detection: If egress IP matches host datacenter IP
  if (hostIp && egressIp) {
    const normHost = hostIp.trim().toLowerCase();
    const normEgress = egressIp.trim().toLowerCase();
    if (normHost === normEgress) {
      throw new Error(
        `Egress IP leak detected: proxy egress IP (${egressIp}) matches host datacenter IP (${hostIp}). Fail-closed proxy guard aborted connection.`
      );
    }
  }

  return {
    ok: true,
    proxyUrl: trimmed,
    hostIp: hostIp || undefined,
    egressIp,
    checkedAt,
  };
}

interface EngineState {
  sockets: Map<string, WASocket>;
  starting: Set<string>;
  intentionalSockets: WeakSet<WASocket>;
  reconnectAttempts: Map<string, number>;
  reconnectTimers: Map<string, NodeJS.Timeout>;
  deleting: Set<string>;
  circuitBreakers: Map<string, CircuitBreakerState>;
}

const engineState: EngineState = {
  sockets: new Map(),
  starting: new Set(),
  intentionalSockets: new WeakSet(),
  reconnectAttempts: new Map(),
  reconnectTimers: new Map(),
  deleting: new Set(),
  circuitBreakers: new Map(),
};

const MAX_RECONNECT_ATTEMPTS = 5;

export function calculateReconnectDelay(attempt: number): number {
  // Enforce exponential backoff with randomized jitter: 5s -> 15s -> 45s + jitter
  const baseSeconds = 5 * Math.pow(3, Math.max(0, attempt - 1));
  const cappedBase = Math.min(baseSeconds, 60);
  const jitterMs = Math.floor(Math.random() * 2000);
  return (cappedBase * 1000) + jitterMs;
}

export function getSocketConfig(state: any, logger: any, agent?: any): any {
  return {
    auth: state,
    printQRInTerminal: false,
    logger,
    agent,
    fetchAgent: agent,
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
  };
}

export function getDisconnectStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as any;
  return err.output?.statusCode || err.statusCode || err.data?.statusCode || null;
}

function clearReconnectTimer(instanceId: string): void {
  const timer = engineState.reconnectTimers.get(instanceId);
  if (timer) {
    clearTimeout(timer);
    engineState.reconnectTimers.delete(instanceId);
  }
}

export function shouldReconnect(statusCode: number | null): boolean {
  if (!statusCode) return true;
  return ![
    DisconnectReason.loggedOut,
    DisconnectReason.badSession,
    DisconnectReason.forbidden,
    DisconnectReason.multideviceMismatch,
    401,
    403,
    411,
    500,
  ].includes(statusCode as any);
}

function scheduleReconnect(instanceId: string): void {
  const instance = db.getInstance(instanceId);
  if (!instance || engineState.deleting.has(instanceId)) return;
  if (engineState.reconnectTimers.has(instanceId)) return;
  if (WhatsAppEngineManager.isCircuitBreakerTripped(instanceId)) {
    console.warn(`[WhatsApp Engine] Suppressing reconnect for ${instance.instance_name}: Circuit breaker active.`);
    return;
  }

  const attempt = (engineState.reconnectAttempts.get(instanceId) || 0) + 1;
  if (attempt > MAX_RECONNECT_ATTEMPTS) {
    console.warn(`[WhatsApp Engine] Max reconnect attempts reached for ${instance.instance_name} (${instanceId}). Marking disconnected.`);
    engineState.reconnectAttempts.delete(instanceId);
    clearReconnectTimer(instanceId);
    db.updateInstance(instanceId, { status: 'disconnected', qr_base64: null });
    db.addEventLog(instanceId, 'connection.max_retries_reached', { attempts: attempt });
    return;
  }

  engineState.reconnectAttempts.set(instanceId, attempt);
  const delay = calculateReconnectDelay(attempt);

  db.updateInstance(instanceId, { status: 'reconnecting' });
  console.log(`[WhatsApp Engine] Scheduling reconnect for ${instance.instance_name} in ${delay}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);

  const timer = setTimeout(() => {
    engineState.reconnectTimers.delete(instanceId);
    WhatsAppEngineManager.startInstance(instanceId).catch((err) => {
      console.error(`[WhatsApp Engine] Reconnect execution failed for ${instanceId}:`, err?.message);
      scheduleReconnect(instanceId);
    });
  }, delay);

  engineState.reconnectTimers.set(instanceId, timer);
}

export class WhatsAppEngineManager {
  public static verifyProxy = verifyProxyConnection;

  public static isCircuitBreakerTripped(instanceId: string): boolean {
    if (engineState.circuitBreakers.has(instanceId)) return true;
    const instance = db.getInstance(instanceId);
    return instance?.status === 'flagged';
  }

  public static getCircuitBreaker(instanceId: string): CircuitBreakerState | undefined {
    const memory = engineState.circuitBreakers.get(instanceId);
    if (memory) return memory;
    const instance = db.getInstance(instanceId);
    if (instance?.status === 'flagged') {
      return {
        tripped: true,
        reason: DisconnectReason.forbidden,
        code: 'forbidden',
        trippedAt: instance.last_disconnection_at || instance.logged_out_at || new Date().toISOString(),
      };
    }
    return undefined;
  }

  public static tripCircuitBreaker(instanceId: string, reason: number): void {
    engineState.circuitBreakers.set(instanceId, {
      tripped: true,
      reason,
      code: (DisconnectReason as any)[reason] || String(reason),
      trippedAt: new Date().toISOString(),
    });
    if (
      reason === DisconnectReason.forbidden ||
      reason === DisconnectReason.multideviceMismatch ||
      reason === 403 ||
      reason === 411
    ) {
      db.updateInstance(instanceId, {
        status: 'flagged',
        last_disconnection_at: db.now(),
      });
    }
  }

  public static resetCircuitBreaker(instanceId: string): void {
    engineState.circuitBreakers.delete(instanceId);
    const instance = db.getInstance(instanceId);
    if (instance?.status === 'flagged') {
      db.updateInstance(instanceId, { status: 'disconnected' });
    }
  }

  public static getSocket(instanceId: string): WASocket | undefined {
    return engineState.sockets.get(instanceId);
  }

  public static setSocket(instanceId: string, socket: WASocket): void {
    engineState.sockets.set(instanceId, socket);
  }

  public static removeSocket(instanceId: string): void {
    engineState.sockets.delete(instanceId);
  }

  public static isStarting(instanceId: string): boolean {
    return engineState.starting.has(instanceId);
  }

  public static getRuntimeState(instanceId: string) {
    const socket = engineState.sockets.get(instanceId);
    return {
      hasSocket: Boolean(socket),
      socketOpen: Boolean(socket?.ws?.isOpen),
      starting: engineState.starting.has(instanceId),
      reconnectScheduled: engineState.reconnectTimers.has(instanceId),
      reconnectAttempts: engineState.reconnectAttempts.get(instanceId) || 0,
      deleting: engineState.deleting.has(instanceId),
      circuitBreakerTripped: this.isCircuitBreakerTripped(instanceId),
      circuitBreaker: this.getCircuitBreaker(instanceId) || null,
    };
  }

  public static async startInstance(instanceId: string, purgeStaleSession = false): Promise<void> {
    if (
      engineState.sockets.has(instanceId) ||
      engineState.starting.has(instanceId) ||
      engineState.deleting.has(instanceId)
    ) {
      return;
    }

    const instance = db.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }

    // Guard against re-starting a tripped circuit breaker instance unless explicitly resetting
    if (this.isCircuitBreakerTripped(instanceId) && !purgeStaleSession) {
      const breaker = this.getCircuitBreaker(instanceId);
      const msg = `Circuit breaker active for instance ${instance.instance_name} (${instanceId}) due to terminal disconnect reason: ${breaker?.reason || breaker?.code || 'terminal'}. Auto-reconnect aborted.`;
      console.warn(`[WhatsApp Engine] ${msg}`);
      throw new Error(msg);
    }

    if (purgeStaleSession) {
      this.resetCircuitBreaker(instanceId);
    }

    clearReconnectTimer(instanceId);
    engineState.starting.add(instanceId);

    // Fail-Closed Proxy Verification
    if (instance.proxy_url || config.requireProxy) {
      try {
        await WhatsAppEngineManager.verifyProxy(instance.proxy_url);
        db.addEventLog(instanceId, 'proxy.verified', {
          proxy_url: instance.proxy_url ? instance.proxy_url.replace(/:[^:@]+@/, ':***@') : null,
        });
      } catch (proxyErr: any) {
        const errorMsg = `Fail-Closed Proxy Guard: ${proxyErr.message}`;
        console.error(`[WhatsApp Engine] ${errorMsg} for instance ${instance.instance_name} (${instanceId})`);
        db.updateInstance(instanceId, {
          status: 'failed',
          qr_base64: null,
          last_disconnection_at: db.now(),
        });
        db.addEventLog(instanceId, 'proxy.verification_failed', {
          error: proxyErr.message,
          proxy_url: instance.proxy_url ? instance.proxy_url.replace(/:[^:@]+@/, ':***@') : null,
          action: 'startInstance',
        });
        throw new Error(errorMsg);
      }
    }

    if (purgeStaleSession) {
      clearSqliteAuthState(instanceId);
    }

    db.updateInstance(instanceId, {
      status: 'connecting',
      ...(purgeStaleSession ? { qr_base64: null, qr_updated_at: null } : {}),
    });

    try {
      const { state, saveCreds } = await createSqliteAuthState(instanceId);
      const logger = pino({ level: config.baileysLogLevel });

      const agent = instance.proxy_url ? resolveProxyAgent(instance.proxy_url) : undefined;
      const sock = makeWASocket(getSocketConfig(state, logger, agent));

      engineState.sockets.set(instanceId, sock);
      sock.ev.on('creds.update', saveCreds);
      bindWhatsAppEvents(instanceId, sock);

      if (instance.pairing_phone && !sock.authState.creds.registered) {
        setTimeout(async () => {
          try {
            const currentSock = engineState.sockets.get(instanceId);
            if (currentSock && !currentSock.authState.creds.registered) {
              const code = await currentSock.requestPairingCode(instance.pairing_phone!);
              const formatted = code?.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
              db.addEventLog(instanceId, 'connection.pairing_code_ready', {
                phone: instance.pairing_phone,
                pairing_code: formatted,
              });
              console.log(`[WhatsApp Engine] Pairing code ready for ${instance.instance_name}: ${formatted}`);
            }
          } catch (err: any) {
            console.error(`[WhatsApp Engine] Auto-pairing code error for ${instanceId}:`, err?.message);
          }
        }, 3000);
      }

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (engineState.deleting.has(instanceId) && connection !== 'close') return;
        const currentInstance = db.getInstance(instanceId);
        if (!currentInstance) {
          try { sock.end(undefined); } catch {}
          return;
        }

        // QR Code generation
        if (qr) {
          try {
            const qrBase64 = await QRCode.toDataURL(qr, { margin: 1, width: 360 });
            db.updateInstance(instanceId, {
              status: 'waiting_qr',
              qr_base64: qrBase64,
              qr_updated_at: db.now(),
            });
            db.addEventLog(instanceId, 'connection.qr_ready', { generated_at: db.now() });
          } catch (err: any) {
            console.error(`[WhatsApp Engine] QR rendering error for ${instanceId}:`, err?.message);
          }
        }

        // Connection opened successfully
        if (connection === 'open') {
          engineState.reconnectAttempts.delete(instanceId);
          clearReconnectTimer(instanceId);

          const phoneNumber = sock.user?.id?.split(':')[0] || null;
          const pushName = sock.user?.name || null;

          db.updateInstance(instanceId, {
            status: 'connected',
            qr_base64: null,
            qr_updated_at: null,
            phone_number: phoneNumber,
            push_name: pushName,
            last_connection_at: db.now(),
          });

          db.addEventLog(instanceId, 'connection.opened', { phone_number: phoneNumber, push_name: pushName });
          console.log(`[WhatsApp Engine] Instance connected: ${instance.instance_name} (${phoneNumber || 'No Phone'})`);
          return;
        }

        // Connection closed
        if (connection === 'close') {
          const isCurrentSocket = engineState.sockets.get(instanceId) === sock;
          if (isCurrentSocket) {
            engineState.sockets.delete(instanceId);
          }

          const statusCode = getDisconnectStatusCode(lastDisconnect?.error);
          const intentional = engineState.intentionalSockets.delete(sock);

          if (engineState.deleting.has(instanceId)) return;
          if (!isCurrentSocket && intentional) return;

          // DisconnectReason Circuit Breaker:
          // Immediately trip circuit breaker on loggedOut, forbidden (403), or multideviceMismatch (411)
          const codeNum = statusCode !== null ? (statusCode as number) : null;
          const isCircuitBreaker = codeNum !== null && (
            codeNum === DisconnectReason.loggedOut ||
            codeNum === DisconnectReason.forbidden ||
            codeNum === DisconnectReason.multideviceMismatch ||
            codeNum === DisconnectReason.badSession
          );

          if (isCircuitBreaker && !intentional) {
            WhatsAppEngineManager.tripCircuitBreaker(instanceId, statusCode!);
            clearReconnectTimer(instanceId);
            engineState.reconnectAttempts.delete(instanceId);
            clearSqliteAuthState(instanceId);

            const isFlagged = codeNum === DisconnectReason.forbidden || codeNum === DisconnectReason.multideviceMismatch;
            const newStatus: WhatsAppInstance['status'] = isFlagged ? 'flagged' : 'disconnected';

            db.updateInstance(instanceId, {
              status: newStatus,
              qr_base64: null,
              last_disconnection_at: db.now(),
              logged_out_at: db.now(),
            });

            db.addEventLog(instanceId, 'circuit_breaker.tripped', {
              code: statusCode,
              reason: (DisconnectReason as any)[statusCode!] || String(statusCode),
              status: newStatus,
              at: db.now(),
            });

            console.warn(`[WhatsApp Engine] Circuit breaker TRIPPED for ${instance.instance_name} (${instanceId}) on DisconnectReason: ${statusCode}. Marked '${newStatus}'. Auto-reconnect permanently aborted.`);
            return;
          }

          const reconnect = !intentional && shouldReconnect(statusCode);

          console.log(`[WhatsApp Engine] Connection closed for ${instance.instance_name}. Code: ${statusCode}, Intentional: ${intentional}, Reconnect: ${reconnect}`);

          db.updateInstance(instanceId, {
            status: intentional ? 'stopped' : reconnect ? 'disconnected' : 'logged_out',
            qr_base64: null,
            last_disconnection_at: db.now(),
            logged_out_at: reconnect || intentional ? null : db.now(),
          });

          db.addEventLog(instanceId, 'connection.closed', {
            code: statusCode,
            intentional,
            will_reconnect: reconnect,
          });

          if (!reconnect) {
            clearReconnectTimer(instanceId);
            engineState.reconnectAttempts.delete(instanceId);
            if (!intentional) {
              clearSqliteAuthState(instanceId);
            }
            return;
          }

          // Code 515 (restartRequired) is sent by WhatsApp right after QR scan to complete pairing handshake.
          // Reconnect immediately with the newly saved credentials without exponential backoff delay.
          if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
            console.log(`[WhatsApp Engine] Code 515 (restartRequired) received for ${instance.instance_name}. Finalizing pairing with immediate reconnect...`);
            clearReconnectTimer(instanceId);
            engineState.reconnectAttempts.delete(instanceId);
            setTimeout(() => {
              WhatsAppEngineManager.startInstance(instanceId, false).catch((err) => {
                console.error(`[WhatsApp Engine] Error in 515 reconnect:`, err?.message);
              });
            }, 300);
            return;
          }

          // Trigger anti-loop exponential reconnect with jitter (5s -> 15s -> 45s + jitter)
          scheduleReconnect(instanceId);
        }
      });
    } catch (error: any) {
      db.updateInstance(instanceId, {
        status: 'failed',
        last_disconnection_at: db.now(),
      });
      throw error;
    } finally {
      engineState.starting.delete(instanceId);
    }
  }

  public static async stopInstance(instanceId: string): Promise<void> {
    clearReconnectTimer(instanceId);
    engineState.reconnectAttempts.delete(instanceId);
    const sock = engineState.sockets.get(instanceId);
    engineState.sockets.delete(instanceId);

    if (sock) {
      engineState.intentionalSockets.add(sock);
      sock.end?.(new Error('Stopped intentionally by user command'));
    }

    db.updateInstance(instanceId, { status: 'stopped', qr_base64: null });
    db.addEventLog(instanceId, 'instance.stopped', { at: db.now() });
  }

  public static async logoutInstance(instanceId: string): Promise<void> {
    clearReconnectTimer(instanceId);
    engineState.reconnectAttempts.delete(instanceId);
    this.resetCircuitBreaker(instanceId);
    const sock = engineState.sockets.get(instanceId);
    engineState.sockets.delete(instanceId);

    if (sock) {
      engineState.intentionalSockets.add(sock);
      try {
        await sock.logout();
      } catch {
        sock.end?.(new Error('Logout force close'));
      }
    }

    clearSqliteAuthState(instanceId);
    db.updateInstance(instanceId, {
      status: 'logged_out',
      qr_base64: null,
      logged_out_at: db.now(),
      phone_number: null,
      push_name: null,
    });
    db.addEventLog(instanceId, 'instance.logged_out', { at: db.now() });
  }

  public static async restartInstance(instanceId: string, purgeStaleSession = false): Promise<void> {
    await this.stopInstance(instanceId);
    if (purgeStaleSession) {
      this.resetCircuitBreaker(instanceId);
    }
    await this.startInstance(instanceId, purgeStaleSession);
  }

  public static async deleteInstance(instanceId: string): Promise<void> {
    engineState.deleting.add(instanceId);
    clearReconnectTimer(instanceId);
    engineState.reconnectAttempts.delete(instanceId);
    this.resetCircuitBreaker(instanceId);

    const sock = engineState.sockets.get(instanceId);
    engineState.sockets.delete(instanceId);
    if (sock) {
      engineState.intentionalSockets.add(sock);
      try {
        await sock.logout();
      } catch {
        sock.end?.(new Error('Deleted by user'));
      }
    }

    clearSqliteAuthState(instanceId);
    db.deleteInstance(instanceId);
    engineState.deleting.delete(instanceId);
  }

  public static async shutdownAll(): Promise<void> {
    for (const [instanceId, timer] of engineState.reconnectTimers.entries()) {
      clearTimeout(timer);
    }
    engineState.reconnectTimers.clear();
    engineState.circuitBreakers.clear();

    const promises = [...engineState.sockets.entries()].map(async ([instanceId, sock]) => {
      engineState.intentionalSockets.add(sock);
      sock.end?.(new Error('Gateway shutdown'));
      db.updateInstance(instanceId, { status: 'disconnected', qr_base64: null });
    });

    await Promise.allSettled(promises);
    engineState.sockets.clear();
  }

  public static async runHealthCheck(): Promise<void> {
    const instances = db.listInstances();
    for (const instance of instances) {
      if (['stopped', 'logged_out', 'failed', 'flagged'].includes(instance.status) || this.isCircuitBreakerTripped(instance.id)) {
        continue;
      }
      const runtime = this.getRuntimeState(instance.id);
      // If DB thinks it is connected, but socket is missing or closed:
      if (instance.status === 'connected' && (!runtime.hasSocket || !runtime.socketOpen)) {
        if (!runtime.starting && !runtime.reconnectScheduled) {
          console.warn(`[Health Check] Zombie socket detected for instance ${instance.instance_name}. Triggering auto-restart.`);
          await this.restartInstance(instance.id);
        }
      } else if (['connecting', 'reconnecting'].includes(instance.status) && !runtime.hasSocket && !runtime.starting && !runtime.reconnectScheduled) {
        console.warn(`[Health Check] Stalled reconnect detected for instance ${instance.instance_name}. Triggering restart.`);
        await this.startInstance(instance.id).catch(() => undefined);
      }
    }
  }

  public static async requestPairingCode(instanceId: string, phoneNumber: string): Promise<string> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const instance = db.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }

    if (this.isCircuitBreakerTripped(instanceId)) {
      const breaker = this.getCircuitBreaker(instanceId);
      const msg = `Circuit breaker active for instance ${instance.instance_name} (${instanceId}) due to terminal disconnect reason: ${breaker?.reason || breaker?.code || 'terminal'}. Request pairing code aborted.`;
      console.warn(`[WhatsApp Engine] ${msg}`);
      throw new Error(msg);
    }

    // Fail-Closed Proxy Verification before requesting pairing code
    if (instance.proxy_url || config.requireProxy) {
      try {
        await WhatsAppEngineManager.verifyProxy(instance.proxy_url);
      } catch (proxyErr: any) {
        const errorMsg = `Fail-Closed Proxy Guard: ${proxyErr.message}`;
        console.error(`[WhatsApp Engine] ${errorMsg} before requesting pairing code for ${instance.instance_name}`);
        const existingSock = engineState.sockets.get(instanceId);
        if (existingSock) {
          engineState.sockets.delete(instanceId);
          try { existingSock.end(new Error('Proxy verification failed')); } catch {}
        }
        db.updateInstance(instanceId, { status: 'failed' });
        db.addEventLog(instanceId, 'proxy.verification_failed', {
          error: proxyErr.message,
          proxy_url: instance.proxy_url ? instance.proxy_url.replace(/:[^:@]+@/, ':***@') : null,
          action: 'requestPairingCode',
        });
        throw new Error(errorMsg);
      }
    }

    let socket = engineState.sockets.get(instanceId);

    if (!socket) {
      await WhatsAppEngineManager.startInstance(instanceId);
      let attempts = 0;
      while (!socket && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        socket = engineState.sockets.get(instanceId);
        attempts++;
      }
    }

    if (!socket) {
      throw new Error(`Failed to initialize WhatsApp connection for instance ${instanceId}`);
    }

    if (socket.authState?.creds?.registered) {
      throw new Error('This instance is already registered and connected to WhatsApp.');
    }

    const code = await socket.requestPairingCode(cleanPhone);
    const formatted = code?.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
    db.addEventLog(instanceId, 'connection.pairing_code_ready', {
      phone: cleanPhone,
      pairing_code: formatted,
      requested_at: db.now(),
    });
    return formatted;
  }
}
