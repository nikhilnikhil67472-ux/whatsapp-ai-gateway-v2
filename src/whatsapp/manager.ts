import makeWASocket, {
  Browsers,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { db } from '../db/database.js';
import { bindWhatsAppEvents } from './events.js';
import {
  clearSqliteAuthState,
  createSqliteAuthState,
  hasRegisteredAuthState,
} from './session-store.js';
import { config } from '../config/index.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export function resolveProxyAgent(proxyUrl?: string | null): any {
  if (!proxyUrl) return undefined;
  const trimmed = proxyUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('socks://') || trimmed.startsWith('socks5://')) {
    return new SocksProxyAgent(trimmed);
  }
  return new HttpsProxyAgent(trimmed);
}

interface EngineState {
  sockets: Map<string, WASocket>;
  starting: Set<string>;
  intentionalSockets: WeakSet<WASocket>;
  reconnectAttempts: Map<string, number>;
  reconnectTimers: Map<string, NodeJS.Timeout>;
  deleting: Set<string>;
}

const engineState: EngineState = {
  sockets: new Map(),
  starting: new Set(),
  intentionalSockets: new WeakSet(),
  reconnectAttempts: new Map(),
  reconnectTimers: new Map(),
  deleting: new Set(),
};

const MAX_RECONNECT_ATTEMPTS = 5;

function getDisconnectStatusCode(error: unknown): number | null {
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

function shouldReconnect(statusCode: number | null): boolean {
  if (!statusCode) return true;
  return ![
    DisconnectReason.loggedOut,
    DisconnectReason.badSession,
    DisconnectReason.forbidden,
    DisconnectReason.multideviceMismatch,
  ].includes(statusCode as DisconnectReason);
}

function scheduleReconnect(instanceId: string): void {
  const instance = db.getInstance(instanceId);
  if (!instance || engineState.deleting.has(instanceId)) return;
  if (engineState.reconnectTimers.has(instanceId)) return;

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
  const delay = Math.min(30000, Math.pow(2, attempt - 1) * 2000) + Math.floor(Math.random() * 1000);

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

    clearReconnectTimer(instanceId);
    engineState.starting.add(instanceId);

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

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger,
        agent,
        fetchAgent: agent,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

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

          // Trigger anti-loop exponential reconnect
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
    await this.startInstance(instanceId, purgeStaleSession);
  }

  public static async deleteInstance(instanceId: string): Promise<void> {
    engineState.deleting.add(instanceId);
    clearReconnectTimer(instanceId);
    engineState.reconnectAttempts.delete(instanceId);

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
      if (['stopped', 'logged_out', 'failed'].includes(instance.status)) {
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
