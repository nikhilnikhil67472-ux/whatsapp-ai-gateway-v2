import assert from 'node:assert/strict';
import test from 'node:test';
import {
  encrypt,
  decrypt,
  isEncrypted,
  hashApiKey,
  generateApiKey,
  signHmacSha256,
} from '../src/security/crypto.js';

test('Security & Crypto: AES-256-GCM encryption and decryption roundtrip', () => {
  const secretData = 'super_secret_credentials_12345!@#$%';
  const ciphertext = encrypt(secretData);

  assert.ok(isEncrypted(ciphertext), 'Ciphertext should have encryption prefix');
  assert.notEqual(ciphertext, secretData);

  const decrypted = decrypt(ciphertext);
  assert.equal(decrypted, secretData, 'Decrypted text must match original plaintext');
});

test('Security & Crypto: Decryption handles unencrypted fallback cleanly', () => {
  const plain = 'regular_unencrypted_text';
  assert.equal(decrypt(plain), plain);
});

test('Security & Crypto: Malformed ciphertext throws meaningful error', () => {
  assert.throws(() => {
    decrypt('enc:v1:corrupted');
  }, /Malformed encrypted payload/);
});

test('Security & Crypto: API Key generation and hashing', () => {
  const { key, hash } = generateApiKey();
  assert.ok(key.startsWith('wag_'));
  assert.equal(hashApiKey(key), hash);
  assert.notEqual(key, hash);
});

test('Security & Crypto: HMAC-SHA256 webhook signature', () => {
  const payload = JSON.stringify({ event: 'test', timestamp: 123456 });
  const secret = 'webhook_secret_key';
  const sig1 = signHmacSha256(payload, secret);
  const sig2 = signHmacSha256(payload, secret);

  assert.equal(sig1, sig2);
  assert.equal(typeof sig1, 'string');
  assert.equal(sig1.length, 64); // 32-byte hex = 64 chars
});
