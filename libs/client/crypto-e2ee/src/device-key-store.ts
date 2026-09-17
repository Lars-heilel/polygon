import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { OwnDeviceKeyRefs } from './device-keys.js';

/**
 * IndexedDB persistence for the device's own private keys.
 *
 * Identity/signed/one-time private halves live in module memory
 * (`ownDeviceKeys`), which a page reload wipes. Without them the client can
 * never decrypt again — the server record verifies fine, so enrollment is
 * skipped and every envelope ends as `E2EE_NO_OWN_KEYS`. Every registration
 * is therefore mirrored here; restore re-registers the refs into memory.
 * Non-extractable keys survive structured clone usable-but-not-exportable,
 * so the threat model is unchanged. Unit tests (node, no IndexedDB) use the
 * memory fallback.
 */

interface StoredDeviceKeys {
  id: 'own';
  deviceId: string;
  identityPrivate: CryptoKey;
  signedPrekeyPrivate: CryptoKey;
  oneTimePrivates: Array<[string, CryptoKey]>;
}

interface DeviceKeySchema extends DBSchema {
  'device-keys': { key: string; value: StoredDeviceKeys };
}

let memoryFallback: StoredDeviceKeys | null = null;
let dbPromise: Promise<IDBPDatabase<DeviceKeySchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DeviceKeySchema>> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<DeviceKeySchema>('polygon-device-keys', 1, {
      upgrade(db) {
        db.createObjectStore('device-keys', { keyPath: 'id' });
      },
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function persistOwnDeviceKeys(keys: OwnDeviceKeyRefs): Promise<void> {
  const stored: StoredDeviceKeys = {
    id: 'own',
    deviceId: keys.deviceId,
    identityPrivate: keys.identityPrivate,
    signedPrekeyPrivate: keys.signedPrekeyPrivate,
    oneTimePrivates: [...(keys.oneTimePrivates?.entries() ?? [])],
  };
  memoryFallback = stored;
  const db = getDb();
  if (!db) return;
  try {
    await (await db).put('device-keys', stored);
  } catch {
    // Memory fallback already holds the keys; IndexedDB is best-effort.
  }
}

export async function loadPersistedDeviceKeys(): Promise<OwnDeviceKeyRefs | null> {
  const cached = memoryFallback ?? (await readStored());
  if (!cached) return null;
  memoryFallback = cached;
  return {
    deviceId: cached.deviceId,
    identityPrivate: cached.identityPrivate,
    signedPrekeyPrivate: cached.signedPrekeyPrivate,
    oneTimePrivates: new Map(cached.oneTimePrivates),
  };
}

async function readStored(): Promise<StoredDeviceKeys | null> {
  const db = getDb();
  if (!db) return null;
  try {
    return (await (await db).get('device-keys', 'own')) ?? null;
  } catch {
    return null;
  }
}

export async function clearPersistedDeviceKeys(): Promise<void> {
  memoryFallback = null;
  const db = getDb();
  if (!db) return;
  try {
    await (await db).delete('device-keys', 'own');
  } catch {
    // Best-effort only.
  }
}

/** Test-only reset for the memory fallback. */
export function clearPersistedDeviceKeysForTests(): void {
  memoryFallback = null;
}
