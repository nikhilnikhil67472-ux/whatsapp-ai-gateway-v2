import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveMediaBuffer,
  resolveMediaWithMeta,
  detectMimeType,
  isHtmlBuffer,
  normalizeImageForWhatsApp,
} from '../src/whatsapp/media.js';

test('Media: Resolve buffer from base64 string', async () => {
  const original = 'Hello WhatsApp Media!';
  const base64 = Buffer.from(original).toString('base64');
  const buffer = await resolveMediaBuffer(undefined, `data:text/plain;base64,${base64}`);

  assert.equal(buffer.toString('utf8'), original);
});

test('Media: Resolve buffer from local filesystem path', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wag-media-test-'));
  const testFile = path.join(tmpDir, 'test.txt');
  fs.writeFileSync(testFile, 'Disk media payload');

  try {
    const buffer = await resolveMediaBuffer(testFile);
    assert.equal(buffer.toString('utf8'), 'Disk media payload');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Media: Missing URL and base64 throws descriptive error', async () => {
  await assert.rejects(
    async () => resolveMediaBuffer(undefined, undefined),
    /Either mediaUrl or base64 must be provided/
  );
});

test('Media: detectMimeType detects magic bytes accurately', () => {
  // JPEG magic bytes: FF D8 FF
  const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectMimeType(jpegBuf), 'image/jpeg');

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectMimeType(pngBuf), 'image/png');

  // WebP magic bytes: RIFF....WEBP
  const webpBuf = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
  assert.equal(detectMimeType(webpBuf), 'image/webp');

  // PDF magic bytes: %PDF
  const pdfBuf = Buffer.from('%PDF-1.4');
  assert.equal(detectMimeType(pdfBuf), 'application/pdf');
});

test('Media: isHtmlBuffer flags HTML webpages and error payloads', () => {
  assert.equal(isHtmlBuffer(Buffer.from('<!DOCTYPE html><html><body>Error</body></html>')), true);
  assert.equal(isHtmlBuffer(Buffer.from('<html><head><title>Cloudflare</title></head></html>')), true);
  assert.equal(isHtmlBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), false);
  assert.equal(isHtmlBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47])), false);
});

test('Media: normalizeImageForWhatsApp converts WebP to standard JPEG and matches magic bytes', async () => {
  const sharpModule = await import('sharp');
  const sharp = sharpModule.default || sharpModule;

  // Create a 64x64 WebP image buffer
  const webpBuffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 100, b: 50 } },
  }).webp().toBuffer();

  const normalized = await normalizeImageForWhatsApp(webpBuffer);
  assert.equal(normalized.mimeType, 'image/jpeg');
  assert.equal(detectMimeType(normalized.buffer), 'image/jpeg');
  assert.ok(normalized.buffer.length > 0);
});

test('Media: resolveMediaWithMeta auto-normalizes images and synchronizes MIME type', async () => {
  const sharpModule = await import('sharp');
  const sharp = sharpModule.default || sharpModule;

  const pngBuffer = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 200, b: 0 } },
  }).png().toBuffer();

  const base64 = pngBuffer.toString('base64');
  const resolved = await resolveMediaWithMeta({
    base64: `data:image/png;base64,${base64}`,
    mediaType: 'image',
    requestedMimeType: 'image/jpeg', // caller gave conflicting mime
  });

  assert.equal(resolved.isNormalized, true);
  // Magic bytes must match returned mimeType exactly
  assert.equal(detectMimeType(resolved.buffer), resolved.mimeType);
});
