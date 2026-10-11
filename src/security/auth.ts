import crypto from 'crypto';
import { config } from '../config/index.js';

export interface TokenPayload {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  exp?: number;
}

/**
 * Hash password securely with scrypt + random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored scrypt hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(keyHex, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Create a signed JSON Web Token (HS256)
 */
export function createJwtToken(payload: TokenPayload, expiresInSeconds = 7 * 86400): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const secret = config.encryptionKey || 'default-gateway-secret-key-32chars';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token (HS256)
 */
export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const secret = config.encryptionKey || 'default-gateway-secret-key-32chars';

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) return null;

    const payload: TokenPayload & { exp?: number } = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Checks if a set of scopes satisfies a required action scope
 * e.g. ["*"] satisfies everything; ["instances:*"] satisfies "instances:read"
 */
export function hasScope(grantedScopes: string[], requiredScope: string): boolean {
  if (grantedScopes.includes('*')) return true;
  if (grantedScopes.includes(requiredScope)) return true;

  const [domain] = requiredScope.split(':');
  if (domain && grantedScopes.includes(`${domain}:*`)) return true;

  return false;
}
