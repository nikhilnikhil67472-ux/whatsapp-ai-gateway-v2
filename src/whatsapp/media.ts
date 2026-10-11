import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export interface DownloadedMediaResult {
  localPath: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function getExtensionFromMime(mimeType?: string | null): string {
  if (!mimeType) return 'bin';
  const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
  switch (cleanMime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'audio/ogg':
    case 'audio/ogg; codecs=opus':
      return 'ogg';
    case 'audio/mp4':
    case 'audio/aac':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'application/pdf':
      return 'pdf';
    default:
      return cleanMime.split('/')[1] || 'bin';
  }
}

/**
 * Downloads, decrypts, and saves inbound WhatsApp media locally into data/media
 * Generates an accessible public URL for webhooks and AI consumers
 */
export async function downloadInboundMedia(params: {
  instanceId: string;
  messageId: string;
  remoteJid: string;
  mediaType: string;
  raw: any;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<DownloadedMediaResult | null> {
  if (!['image', 'video', 'audio', 'document', 'sticker'].includes(params.mediaType)) {
    return null;
  }

  try {
    const rawMsg = params.raw as WAMessage;
    if (!rawMsg?.message) return null;

    const buffer = await downloadMediaMessage(
      rawMsg,
      'buffer',
      {},
      {
        logger: {
          level: 'silent',
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          child: () => ({} as any),
        } as any,
        reuploadRequest: () => Promise.resolve(rawMsg),
      }
    ) as Buffer;

    if (!buffer || buffer.length === 0) {
      return null;
    }

    const ext = getExtensionFromMime(params.mimeType);
    const sanitizedFileName = params.fileName
      ? params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      : `${params.mediaType}_${Date.now()}.${ext}`;

    const safeRemote = params.remoteJid.replace(/[^a-zA-Z0-9._-]/g, '_');
    const mediaDir = path.join(config.mediaStoragePath, params.instanceId, safeRemote, params.messageId);

    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const localFilePath = path.join(mediaDir, sanitizedFileName);
    await fs.promises.writeFile(localFilePath, buffer);

    const relativeUrl = `/media/${params.instanceId}/${safeRemote}/${params.messageId}/${encodeURIComponent(sanitizedFileName)}`;
    const base = config.appBaseUrl.replace(/\/$/, '');
    const publicUrl = `${base}${relativeUrl}`;

    return {
      localPath: localFilePath,
      publicUrl,
      fileName: sanitizedFileName,
      mimeType: params.mimeType || 'application/octet-stream',
      sizeBytes: buffer.length,
    };
  } catch (err: any) {
    console.warn(`[Media Download] Failed for message ${params.messageId}:`, err?.message || err);
    return null;
  }
}

/**
 * Resolves media buffer from base64 string, HTTP/HTTPS URL, or local disk path
 */
export async function resolveMediaBuffer(mediaUrl?: string, base64?: string): Promise<Buffer> {
  if (base64) {
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
    return Buffer.from(cleanBase64, 'base64');
  }

  if (!mediaUrl) {
    throw new Error('Either mediaUrl or base64 must be provided');
  }

  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from URL (${response.status}): ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Handle local filesystem path or /media/... relative path
  let candidatePath = mediaUrl;
  if (candidatePath.startsWith('/media/')) {
    candidatePath = path.join(process.cwd(), 'data', candidatePath);
  }

  if (fs.existsSync(candidatePath)) {
    return await fs.promises.readFile(candidatePath);
  }

  throw new Error(`Media not found at URL or filesystem path: ${mediaUrl}`);
}
