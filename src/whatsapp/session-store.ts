import {
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { db } from '../db/database.js';
import { encrypt, decrypt, isEncrypted } from '../security/crypto.js';

function serialize(value: unknown): string {
  return JSON.stringify(value, BufferJSON.replacer);
}

function deserialize<T>(value: string): T {
  return JSON.parse(value, BufferJSON.reviver) as T;
}

/**
 * Creates an encrypted SQLite-backed Baileys authentication state
 */
export async function createSqliteAuthState(
  instanceId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  let serializedCreds = db.getAuthCreds(instanceId);

  if (serializedCreds) {
    if (isEncrypted(serializedCreds)) {
      serializedCreds = decrypt(serializedCreds);
    } else {
      // Re-encrypt plaintext legacy creds
      db.saveAuthCreds(instanceId, encrypt(serializedCreds));
    }
  }

  const creds = serializedCreds
    ? deserialize<AuthenticationState['creds']>(serializedCreds)
    : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const stored = db.getAuthKeys(instanceId, type, ids);
          const values: { [id: string]: SignalDataTypeMap[T] } = {};

          for (const keyId of ids) {
            let serialized = stored.get(keyId);
            if (!serialized) continue;

            if (isEncrypted(serialized)) {
              serialized = decrypt(serialized);
            }

            let value = deserialize<SignalDataTypeMap[T]>(serialized);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as unknown as Record<string, unknown>
              ) as unknown as SignalDataTypeMap[T];
            }
            values[keyId] = value;
          }

          return values;
        },
        set: async (data) => {
          const updates: Array<{ keyType: string; keyId: string; data: string | null }> = [];

          for (const [keyType, entries] of Object.entries(data)) {
            for (const [keyId, value] of Object.entries(entries || {})) {
              updates.push({
                keyType,
                keyId,
                data: value ? encrypt(serialize(value)) : null,
              });
            }
          }

          db.saveAuthKeys(instanceId, updates);
        },
      },
    },
    saveCreds: async () => {
      db.saveAuthCreds(instanceId, encrypt(serialize(creds)));
    },
  };
}

/**
 * Checks if the instance already has registered credentials
 */
export function hasRegisteredAuthState(instanceId: string): boolean {
  const storedCreds = db.getAuthCreds(instanceId);
  if (!storedCreds) return false;

  try {
    const raw = isEncrypted(storedCreds) ? decrypt(storedCreds) : storedCreds;
    const creds = deserialize<AuthenticationState['creds']>(raw);
    return Boolean(creds?.me || creds?.account || creds?.registered);
  } catch {
    return false;
  }
}

/**
 * Clears the session auth state from SQLite
 */
export function clearSqliteAuthState(instanceId: string): void {
  db.clearAuthState(instanceId);
}
