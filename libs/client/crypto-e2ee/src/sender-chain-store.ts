import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

/**
 * IndexedDB persistence for group sender-key chains.
 *
 * Received chains must survive reload (no re-fetch dependency), so every
 * chain registered in memory is mirrored to the `sender-chains` store.
 * `idb` is unavailable in unit tests (node/jsdom without IndexedDB), where
 * the module degrades to a memory fallback — the public functions in
 * `sender-keys.ts` keep their signatures and behavior either way.
 */

interface StoredChain {
  chainKeyId: string;
  chatId: string | null;
  chainKey: CryptoKey;
}

interface SenderChainSchema extends DBSchema {
  'sender-chains': { key: string; value: StoredChain };
  'sender-current': { key: string; value: { chatId: string; chainKeyId: string } };
}

const memoryFallback = new Map<string, StoredChain>();
const currentFallback = new Map<string, string>();

let dbPromise: Promise<IDBPDatabase<SenderChainSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<SenderChainSchema>> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<SenderChainSchema>('polygon-sender-chains', 1, {
      upgrade(db) {
        db.createObjectStore('sender-chains', { keyPath: 'chainKeyId' });
        db.createObjectStore('sender-current', { keyPath: 'chatId' });
      },
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function persistChain(chain: StoredChain): Promise<void> {
  memoryFallback.set(chain.chainKeyId, chain);
  const db = getDb();
  if (!db) return;
  try {
    await (await db).put('sender-chains', chain);
  } catch {
    // Memory fallback already holds the chain; IndexedDB is best-effort.
  }
}

export async function loadPersistedChain(chainKeyId: string): Promise<StoredChain | null> {
  const cached = memoryFallback.get(chainKeyId);
  if (cached) return cached;
  const db = getDb();
  if (!db) return null;
  try {
    const stored = await (await db).get('sender-chains', chainKeyId);
    if (stored) {
      memoryFallback.set(chainKeyId, stored);
      return stored;
    }
  } catch {
    // Fall through to null — caller throws E2EE_DECRYPT_FAILED.
  }
  return null;
}

export async function persistCurrentChain(chatId: string, chainKeyId: string): Promise<void> {
  currentFallback.set(chatId, chainKeyId);
  const db = getDb();
  if (!db) return;
  try {
    await (await db).put('sender-current', { chatId, chainKeyId });
  } catch {
    // Best-effort only.
  }
}

export async function loadPersistedCurrentChainId(chatId: string): Promise<string | null> {
  const cached = currentFallback.get(chatId);
  if (cached) return cached;
  const db = getDb();
  if (!db) return null;
  try {
    const stored = await (await db).get('sender-current', chatId);
    if (stored) {
      currentFallback.set(chatId, stored.chainKeyId);
      return stored.chainKeyId;
    }
  } catch {
    // Fall through to null.
  }
  return null;
}

/** Test-only reset for the memory fallback. */
export function clearPersistedChainsForTests(): void {
  memoryFallback.clear();
  currentFallback.clear();
}
