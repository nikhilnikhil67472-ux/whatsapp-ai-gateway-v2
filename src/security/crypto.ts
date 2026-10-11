import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getDerivedKey(keyString?: string): Buffer {
  const secret = keyString || config.encryptionKey;
  // Deterministically create 32-byte key via SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string, keyString?: string): string {
  if (!plaintext) return '';
  const key = getDerivedKey(keyString);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${PREFIX}${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt a ciphertext string using AES-256-GCM
 */
export function decrypt(encryptedText: string, keyString?: string): string {
  if (!encryptedText) return '';
  if (!isEncrypted(encryptedText)) {
    return encryptedText; // Return plaintext fallback if unencrypted
  }

  const parts = encryptedText.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getDerivedKey(keyString);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(cipherHex, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

/**
 * Checks if a value was encrypted with our AES-256-GCM prefix
 */
export function isEncrypted(val: string): boolean {
  return typeof val === 'string' && val.startsWith(PREFIX);
}

/**
 * Hash an API key with SHA-256 for secure DB storage
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Generate a new random API key with 'wag_' prefix
 */
export function generateApiKey(): { key: string; hash: string } {
  const rawSecret = crypto.randomBytes(24).toString('hex');
  const key = `wag_${rawSecret}`;
  const hash = hashApiKey(key);
  return { key, hash };
}

/**
 * Generate HMAC SHA-256 signature for webhooks
 */
export function signHmacSha256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
