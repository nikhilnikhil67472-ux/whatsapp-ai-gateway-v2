import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveMediaBuffer } from '../src/whatsapp/media.js';

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
