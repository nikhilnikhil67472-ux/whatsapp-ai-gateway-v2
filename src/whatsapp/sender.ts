import {
  AnyMessageContent,
  MiscMessageGenerationOptions,
  WASocket,
} from '@whiskeysockets/baileys';
import { WhatsAppEngineManager } from './manager.js';
import {
  SendTextParams,
  SendMediaParams,
  SendAudioParams,
  SendLocationParams,
  SendContactParams,
  SendStickerParams,
  SendPollParams,
  EditMessageParams,
  DeleteMessageParams,
  ReadMessagesParams,
} from './types.js';
import { config } from '../config/index.js';
import { db } from '../db/database.js';
import { resolveMediaBuffer, resolveMediaWithMeta, detectMimeType } from './media.js';

function getSocket(instanceId: string): WASocket {
  const socket = WhatsAppEngineManager.getSocket(instanceId);
  if (!socket) {
    throw new Error(`WhatsApp instance '${instanceId}' is not connected`);
  }
  return socket;
}

function quoteOptions(remoteJid: string, quotedMessageId?: string | null): MiscMessageGenerationOptions {
  if (!quotedMessageId) return {};
  return {
    quoted: {
      key: { id: quotedMessageId, remoteJid },
      message: { conversation: '' },
    },
  };
}

// --- Inactivity Presence Management (30s offline transition) ---
const inactivityTimers = new Map<string, NodeJS.Timeout>();

export function cancelInactivityTimer(instanceId: string): void {
  const existing = inactivityTimers.get(instanceId);
  if (existing) {
    clearTimeout(existing);
    inactivityTimers.delete(instanceId);
  }
}

export function resetInactivityTimer(instanceId: string): void {
  cancelInactivityTimer(instanceId);

  const timer = setTimeout(async () => {
    try {
      const socket = WhatsAppEngineManager.getSocket(instanceId);
      if (socket) {
        await socket.sendPresenceUpdate('unavailable').catch(() => undefined);
      }
    } catch {
      // Ignored if socket closed or instance removed
    } finally {
      inactivityTimers.delete(instanceId);
    }
  }, 30000);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  inactivityTimers.set(instanceId, timer);
}

export function clearAllInactivityTimers(): void {
  for (const [, timer] of inactivityTimers.entries()) {
    clearTimeout(timer);
  }
  inactivityTimers.clear();
}

export function hasActiveInactivityTimer(instanceId: string): boolean {
  return inactivityTimers.has(instanceId);
}

export interface HumanizedPresenceOptions {
  instanceId: string;
  remoteJid: string;
  type: 'composing' | 'recording';
  textLength?: number;
  quotedMessageId?: string | null;
}

export async function executeHumanizedPreSend(
  socket: WASocket,
  options: HumanizedPresenceOptions
): Promise<void> {
  const { instanceId, remoteJid, type, textLength = 0, quotedMessageId } = options;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(config.testingMode);

  // 0. Reset inactivity timer
  resetInactivityTimer(instanceId);

  // 1. Send 'available' presence
  try {
    await socket.presenceSubscribe(remoteJid).catch(() => undefined);
    await socket.sendPresenceUpdate('available', remoteJid).catch(() => undefined);
  } catch {
    // Non-fatal if presence subscription fails
  }

  // 2. If replying to an unread inbound message (quotedMessageId or unread conversation)
  let inboundMessageId = quotedMessageId;
  if (!inboundMessageId) {
    try {
      const recent = db.getRecentMessages(instanceId, remoteJid, 1);
      if (recent.length > 0 && !recent[0].from_me) {
        inboundMessageId = recent[0].whatsapp_message_id;
      }
    } catch {
      // Non-fatal if db lookup fails
    }
  }

  if (inboundMessageId) {
    if (!isTest) {
      // 1.0s - 2.5s reading delay
      const readingDelay = 1000 + Math.floor(Math.random() * 1500);
      await new Promise((resolve) => setTimeout(resolve, readingDelay));
    }
    if (typeof socket.readMessages === 'function') {
      try {
        await socket.readMessages([{
          id: inboundMessageId,
          remoteJid,
          fromMe: false,
        }]);
      } catch {
        // Non-fatal
      }
    }
  }

  // 3. Send 'composing' or 'recording' presence
  try {
    await socket.sendPresenceUpdate(type, remoteJid).catch(() => undefined);
  } catch {
    // Non-fatal
  }

  // Wait proportional human typing delay: Math.min(Math.max(text.length * 55, 2200), 12000) + jitter
  if (!isTest) {
    const jitter = Math.floor(Math.random() * 800);
    const typingDelay = Math.min(Math.max(textLength * 55, 2200), 12000) + jitter;
    await new Promise((resolve) => setTimeout(resolve, typingDelay));
  }
}

async function simulatePresence(
  socket: WASocket,
  remoteJid: string,
  type: 'composing' | 'recording',
  contentLength = 0,
  instanceId?: string,
  quotedMessageId?: string | null
): Promise<void> {
  if (instanceId) {
    await executeHumanizedPreSend(socket, {
      instanceId,
      remoteJid,
      type,
      textLength: contentLength,
      quotedMessageId,
    });
  } else {
    try {
      await socket.presenceSubscribe(remoteJid).catch(() => undefined);
      await socket.sendPresenceUpdate('available', remoteJid).catch(() => undefined);
      await socket.sendPresenceUpdate(type, remoteJid).catch(() => undefined);
      if (process.env.NODE_ENV !== 'test' && !config.testingMode) {
        const baseDelay = Math.max(200, config.outboundPresenceDelayMs || 400);
        const calculatedDelay = Math.min(2500, Math.max(baseDelay, contentLength * 15 + Math.floor(Math.random() * 300)));
        await new Promise((resolve) => setTimeout(resolve, calculatedDelay));
      }
    } catch {
      // Non-fatal
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000, errorMsg = 'WhatsApp socket send timed out (15s)'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    promise.then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function sendText(params: SendTextParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: (params.text || '').length,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        { text: params.text },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      15000,
      `Text message send timed out (15s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendMedia(params: SendMediaParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const resolved = await resolveMediaWithMeta({
    mediaUrl: params.mediaUrl,
    base64: params.base64,
    mediaType: params.mediaType,
    requestedMimeType: params.mimeType,
  });
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: (params.caption || '').length,
    quotedMessageId: params.quotedMessageId,
  });

  const content: AnyMessageContent =
    params.mediaType === 'image'
      ? { image: resolved.buffer, caption: params.caption, mimetype: resolved.mimeType }
      : params.mediaType === 'video'
      ? { video: resolved.buffer, caption: params.caption, mimetype: resolved.mimeType, ptv: Boolean(params.isPtv) }
      : {
          document: resolved.buffer,
          caption: params.caption,
          mimetype: resolved.mimeType,
          fileName: params.fileName || 'attachment',
        };

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        content,
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      20000,
      `Media message send timed out (20s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendAudio(params: SendAudioParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const resolved = await resolveMediaWithMeta({
    mediaUrl: params.audioUrl,
    base64: params.base64,
    mediaType: 'audio',
    requestedMimeType: params.mimeType,
  });
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'recording',
    textLength: 40,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        {
          audio: resolved.buffer,
          ptt: params.isVoiceNote !== false, // Default to voice note (PTT)
          mimetype: resolved.mimeType || 'audio/ogg; codecs=opus',
        },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      20000,
      `Audio message send timed out (20s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendLocation(params: SendLocationParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: (params.name || '').length,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        {
          location: {
            degreesLatitude: params.latitude,
            degreesLongitude: params.longitude,
            name: params.name,
            address: params.address,
          },
        },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      15000,
      `Location message send timed out (15s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendContact(params: SendContactParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: (params.displayName || '').length,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        {
          contacts: {
            displayName: params.displayName,
            contacts: [{ vcard: params.vcard }],
          },
        },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      15000,
      `Contact message send timed out (15s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendReaction(params: {
  instanceId: string;
  remoteJid: string;
  messageId: string;
  emoji: string;
}): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.sendMessage(params.remoteJid, {
      react: {
        text: params.emoji,
        key: { id: params.messageId, remoteJid: params.remoteJid },
      },
    }),
    10000,
    `Reaction send timed out to ${params.remoteJid}`
  );
}

export async function sendPresence(params: {
  instanceId: string;
  remoteJid?: string;
  presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
}): Promise<any> {
  const socket = getSocket(params.instanceId);
  if (params.presence === 'unavailable') {
    cancelInactivityTimer(params.instanceId);
  } else if (params.presence === 'available') {
    resetInactivityTimer(params.instanceId);
  }

  if (params.remoteJid) {
    await socket.presenceSubscribe(params.remoteJid).catch(() => undefined);
    return await socket.sendPresenceUpdate(params.presence, params.remoteJid);
  }
  return await socket.sendPresenceUpdate(params.presence);
}

export async function checkWhatsAppNumber(instanceId: string, phone: string): Promise<any> {
  const socket = getSocket(instanceId);
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const result = await socket.onWhatsApp(cleanPhone);
  if (result && result.length > 0) {
    return {
      exists: Boolean(result[0].exists),
      jid: result[0].jid,
      phone: cleanPhone,
    };
  }
  return {
    exists: false,
    jid: `${cleanPhone}@s.whatsapp.net`,
    phone: cleanPhone,
  };
}

function createStickerExif(packName = 'WhatsApp AI Gateway', authorName = 'Antigravity'): Buffer {
  const json = {
    'sticker-pack-id': 'com.whatsapp.ai.gateway',
    'sticker-pack-name': packName,
    'sticker-pack-publisher': authorName,
    'emojis': ['🤖', '⚡'],
  };
  const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
  const exifHeader = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  exifHeader.writeUInt32LE(jsonBuff.length, 14);
  return Buffer.concat([exifHeader, jsonBuff]);
}

async function injectWebpExif(webpBuffer: Buffer, packName?: string, authorName?: string): Promise<Buffer> {
  try {
    const webpmuxModule = await import('node-webpmux');
    const webpmux = (webpmuxModule as any).default || webpmuxModule;
    const img = new webpmux.Image();
    await img.load(webpBuffer);
    const exifData = createStickerExif(packName, authorName);
    img.exif = exifData;
    return await img.save(null);
  } catch {
    return webpBuffer;
  }
}

export async function sendSticker(params: SendStickerParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const buffer = await resolveMediaBuffer(params.stickerUrl, params.base64);

  // Auto-convert non-WebP inputs (PNG/JPEG) to WhatsApp 512x512 WebP sticker format
  let webpBuffer = buffer;
  const detectedMime = detectMimeType(buffer);
  if (detectedMime !== 'image/webp') {
    try {
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default || sharpModule;
      webpBuffer = await sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (err: any) {
      console.warn('[Sticker WebP Conversion] Sharp fallback to raw buffer:', err?.message || err);
    }
  }

  const finalBuffer = await injectWebpExif(webpBuffer, params.packName, params.authorName);
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: 10,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        { sticker: finalBuffer },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      15000,
      `Sticker message send timed out (15s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function sendPoll(params: SendPollParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  await executeHumanizedPreSend(socket, {
    instanceId: params.instanceId,
    remoteJid: params.remoteJid,
    type: 'composing',
    textLength: params.name.length,
    quotedMessageId: params.quotedMessageId,
  });

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        {
          poll: {
            name: params.name,
            values: params.values,
            selectableCount: params.selectableCount || 1,
          },
        },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      15000,
      `Poll send timed out (15s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
    resetInactivityTimer(params.instanceId);
  }
}

export async function editMessage(params: EditMessageParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.sendMessage(params.remoteJid, {
      text: params.newText,
      edit: {
        id: params.messageId,
        remoteJid: params.remoteJid,
        fromMe: true,
      },
    }),
    15000,
    `Message edit timed out (15s) for ${params.messageId}`
  );
}

export async function deleteMessage(params: DeleteMessageParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.sendMessage(params.remoteJid, {
      delete: {
        id: params.messageId,
        remoteJid: params.remoteJid,
        fromMe: true,
      },
    }),
    15000,
    `Message delete timed out (15s) for ${params.messageId}`
  );
}

export async function readMessages(params: ReadMessagesParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const keys = params.messageIds.map((id) => ({
    id,
    remoteJid: params.remoteJid,
    fromMe: false,
  }));
  return await withTimeout(
    socket.readMessages(keys),
    10000,
    `Read receipts timed out (10s) for ${params.remoteJid}`
  );
}
