import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import { compareMessagesByCreatedAt } from '../message-sort.js';
import type { Message } from '../message.types.js';

interface ChatCacheSchema extends DBSchema {
  messages: { key: string; value: Message & { chatId: string }; indexes: { 'by-chat': string } };
  meta: { key: string; value: { chatId: string; since: string; sinceId?: string } };
}

let lazyDb: Promise<IDBPDatabase<ChatCacheSchema>> | null = null;

/**
 * Synchronous in-memory mirror of the IndexedDB cache. `initialData` for
 * suspense queries must be sync, so `useInfiniteMessagesQuery` seeds from
 * here (instant render when the mirror is warm); the async IndexedDB read in
 * `syncChatDelta` remains the cold-start fallback after reload.
 */
const memoryMirror = new Map<string, Message[]>();
const MIRROR_KEEP = 200;

function mirrorWrite(chatId: string, messages: Message[]): void {
  const byId = new Map((memoryMirror.get(chatId) ?? []).map((m) => [m.id, m]));
  for (const message of messages) byId.set(message.id, message);
  memoryMirror.set(chatId, [...byId.values()].sort(compareMessagesByCreatedAt).slice(-MIRROR_KEEP));
}

function mirrorDelete(chatId: string, messageId: string): void {
  const cached = memoryMirror.get(chatId);
  if (cached)
    memoryMirror.set(
      chatId,
      cached.filter((m) => m.id !== messageId),
    );
}

/** Sync peek for `initialData`; `undefined` when the mirror is cold. */
export function peekCachedMessages(chatId: string): Message[] | undefined {
  const cached = memoryMirror.get(chatId);
  return cached && cached.length > 0 ? [...cached] : undefined;
}

/**
 * Lazy `openDB`: module import must stay safe in unit tests (node/jsdom
 * without IndexedDB) — the connection opens on first cache use only.
 */
function getDb(): Promise<IDBPDatabase<ChatCacheSchema>> {
  if (!lazyDb) {
    lazyDb = openDB<ChatCacheSchema>('polygon-chat-cache', 1, {
      upgrade(db) {
        const messages = db.createObjectStore('messages', { keyPath: 'id' });
        messages.createIndex('by-chat', 'chatId');
        db.createObjectStore('meta', { keyPath: 'chatId' });
      },
    });
    lazyDb.catch(() => {
      lazyDb = null;
    });
  }
  return lazyDb;
}

export async function writeMessagesToCache(chatId: string, messages: Message[]): Promise<void> {
  // Placeholders must never poison the cache: they carry no text and would
  // overwrite readable entries (same id) in both the mirror and IndexedDB,
  // sticking until the next cold start. Retry/decrypt recovers them through
  // the query cache and delta sync instead.
  const cacheable = messages.filter((m) => !m.undecryptable);
  mirrorWrite(chatId, cacheable);
  if (cacheable.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(cacheable.map((m) => tx.store.put({ ...m, chatId })));
  await tx.done;
}

export async function readCachedMessages(chatId: string, limit = 200): Promise<Message[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('messages', 'by-chat', chatId);
  const sorted = all.sort(compareMessagesByCreatedAt).slice(-limit);
  mirrorWrite(chatId, sorted);
  return sorted;
}

export async function deleteCachedMessage(chatId: string, messageId: string): Promise<void> {
  mirrorDelete(chatId, messageId);
  const db = await getDb();
  const existing = await db.get('messages', messageId);
  if (!existing || existing.chatId !== chatId) return;
  await db.delete('messages', messageId);
}

export async function evictOldMessages(chatId: string, keep = 200): Promise<void> {
  const mirrored = memoryMirror.get(chatId);
  if (mirrored && mirrored.length > keep) {
    memoryMirror.set(chatId, [...mirrored].sort(compareMessagesByCreatedAt).slice(-keep));
  }
  const db = await getDb();
  const all = await db.getAllFromIndex('messages', 'by-chat', chatId);
  if (all.length <= keep) return;
  const sorted = all.sort(compareMessagesByCreatedAt);
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(sorted.slice(0, all.length - keep).map((m) => tx.store.delete(m.id)));
  await tx.done;
}

export async function getLastSync(
  chatId: string,
): Promise<{ since: string; sinceId?: string } | null> {
  const db = await getDb();
  const meta = await db.get('meta', chatId);
  return meta ? { since: meta.since, sinceId: meta.sinceId } : null;
}

export async function setLastSync(
  chatId: string,
  sync: { since: string; sinceId?: string },
): Promise<void> {
  const db = await getDb();
  await db.put('meta', { chatId, ...sync });
}
