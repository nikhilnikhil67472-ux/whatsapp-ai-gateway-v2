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
import { resolveMediaBuffer } from './media.js';

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

async function simulatePresence(
  socket: WASocket,
  remoteJid: string,
  type: 'composing' | 'recording',
  contentLength = 0
): Promise<void> {
  try {
    await socket.presenceSubscribe(remoteJid);
    await socket.sendPresenceUpdate(type, remoteJid);
    const baseDelay = Math.max(200, config.outboundPresenceDelayMs || 400);
    const calculatedDelay = Math.min(2500, Math.max(baseDelay, contentLength * 15 + Math.floor(Math.random() * 300)));
    await new Promise((resolve) => setTimeout(resolve, calculatedDelay));
  } catch {
    // Non-fatal if presence subscription fails
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
  await simulatePresence(socket, params.remoteJid, 'composing', (params.text || '').length);

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
  }
}

export async function sendMedia(params: SendMediaParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const buffer = await resolveMediaBuffer(params.mediaUrl, params.base64);
  await simulatePresence(socket, params.remoteJid, 'composing', (params.caption || '').length);

  const content: AnyMessageContent =
    params.mediaType === 'image'
      ? { image: buffer, caption: params.caption, mimetype: params.mimeType }
      : params.mediaType === 'video'
      ? { video: buffer, caption: params.caption, mimetype: params.mimeType, ptv: Boolean(params.isPtv) }
      : {
          document: buffer,
          caption: params.caption,
          mimetype: params.mimeType,
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
  }
}

export async function sendAudio(params: SendAudioParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const buffer = await resolveMediaBuffer(params.audioUrl, params.base64);
  await simulatePresence(socket, params.remoteJid, 'recording', 40);

  try {
    return await withTimeout(
      socket.sendMessage(
        params.remoteJid,
        {
          audio: buffer,
          ptt: params.isVoiceNote !== false, // Default to voice note (PTT)
          mimetype: params.mimeType || 'audio/ogg; codecs=opus',
        },
        quoteOptions(params.remoteJid, params.quotedMessageId)
      ),
      20000,
      `Audio message send timed out (20s) to ${params.remoteJid}`
    );
  } finally {
    await socket.sendPresenceUpdate('paused', params.remoteJid).catch(() => undefined);
  }
}

export async function sendLocation(params: SendLocationParams): Promise<any> {
  const socket = getSocket(params.instanceId);
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
}

export async function sendContact(params: SendContactParams): Promise<any> {
  const socket = getSocket(params.instanceId);
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
  const finalBuffer = await injectWebpExif(buffer, params.packName, params.authorName);
  await simulatePresence(socket, params.remoteJid, 'composing', 10);

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
  }
}

export async function sendPoll(params: SendPollParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  await simulatePresence(socket, params.remoteJid, 'composing', params.name.length);

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
