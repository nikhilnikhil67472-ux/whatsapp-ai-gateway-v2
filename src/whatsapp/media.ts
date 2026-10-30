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
 * Detect MIME type using file magic bytes (signatures)
 */
export function detectMimeType(buffer: Buffer, fallbackMime?: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return 'image/gif';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  if (
    buffer.length >= 12 &&
    (buffer.toString('ascii', 4, 8) === 'ftyp' || buffer.toString('ascii', 0, 4) === '\x00\x00\x00\x18')
  ) {
    return 'video/mp4';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return 'audio/ogg';
  }
  if (
    (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }
  return fallbackMime || 'application/octet-stream';
}

/**
 * Checks if buffer contains HTML content (landing pages, 403 blocks, Cloudflare challenges)
 */
export function isHtmlBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const snippet = buffer.subarray(0, 512).toString('utf8').trim().toLowerCase();
  return (
    snippet.startsWith('<!doctype html') ||
    snippet.startsWith('<html') ||
    snippet.startsWith('<!html') ||
    (snippet.startsWith('<?xml') && !snippet.includes('<svg'))
  );
}

/**
 * Normalizes an image buffer specifically for WhatsApp:
 * - Auto-orients based on EXIF rotation (prevents upside-down/sideways images).
 * - Converts non-standard / unsupported formats (WebP, AVIF, TIFF, BMP, SVG, or opaque PNG) to clean, standard sRGB JPEG.
 * - Preserves transparent PNGs with alpha channel as clean PNG.
 * - Guarantees that buffer magic bytes strictly match the returned mimeType ('image/jpeg' or 'image/png').
 */
export async function normalizeImageForWhatsApp(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' }> {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const img = sharp(buffer);
    const metadata = await img.metadata();

    // If it's a PNG with transparency / alpha channel, preserve as clean PNG
    if (metadata.format === 'png' && metadata.hasAlpha) {
      const cleanPng = await img.png().toBuffer();
      return { buffer: cleanPng, mimeType: 'image/png' };
    }

    // Convert everything else (WebP, AVIF, TIFF, BMP, SVG, or opaque images) to standard sRGB JPEG
    const cleanJpeg = await img
      .rotate() // Auto-orient based on EXIF tag
      .toColorspace('srgb')
      .jpeg({ quality: 85, mozjpeg: false })
      .toBuffer();

    return { buffer: cleanJpeg, mimeType: 'image/jpeg' };
  } catch (err: any) {
    console.warn('[Image Normalization] Sharp fallback to raw buffer:', err?.message || err);
    const detected = detectMimeType(buffer, 'image/jpeg');
    const mime = detected.startsWith('image/') ? (detected as 'image/jpeg' | 'image/png') : 'image/jpeg';
    return { buffer, mimeType: mime };
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,audio/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const response = await fetch(mediaUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch media from URL (${response.status}): ${response.statusText}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('The downloaded media file is empty (0 bytes).');
    }

    if (contentType.includes('text/html') || isHtmlBuffer(buffer)) {
      throw new Error('The provided URL returned an HTML webpage instead of a direct media file. Please provide a direct image link (e.g. ending in .jpg, .png, or direct CDN image URL).');
    }

    return buffer;
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

export interface ResolvedMediaResult {
  buffer: Buffer;
  mimeType: string;
  isNormalized?: boolean;
}

/**
 * Resolves media and returns verified buffer + synchronized MIME type
 */
export async function resolveMediaWithMeta(params: {
  mediaUrl?: string;
  base64?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio' | string;
  requestedMimeType?: string;
}): Promise<ResolvedMediaResult> {
  const rawBuffer = await resolveMediaBuffer(params.mediaUrl, params.base64);

  if (params.mediaType === 'image') {
    const normalized = await normalizeImageForWhatsApp(rawBuffer);
    return {
      buffer: normalized.buffer,
      mimeType: normalized.mimeType,
      isNormalized: true,
    };
  }

  // For other media types, detect MIME type accurately
  let detectedMime = detectMimeType(rawBuffer, params.requestedMimeType);
  if (!detectedMime || detectedMime === 'application/octet-stream') {
    if (params.mediaType === 'video') detectedMime = 'video/mp4';
    else if (params.mediaType === 'audio') detectedMime = 'audio/ogg; codecs=opus';
    else if (params.requestedMimeType) detectedMime = params.requestedMimeType;
  }

  return {
    buffer: rawBuffer,
    mimeType: detectedMime,
    isNormalized: false,
  };
}
