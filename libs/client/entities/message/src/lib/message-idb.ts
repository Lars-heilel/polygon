import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { Message } from '../message.types.js';

interface ChatCacheSchema extends DBSchema {
  messages: { key: string; value: Message & { chatId: string }; indexes: { 'by-chat': string } };
  meta: { key: string; value: { chatId: string; since: string; sinceId?: string } };
}

let lazyDb: Promise<IDBPDatabase<ChatCacheSchema>> | null = null;

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
  const db = await getDb();
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(messages.map((m) => tx.store.put({ ...m, chatId })));
  await tx.done;
}

export async function readCachedMessages(chatId: string, limit = 200): Promise<Message[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('messages', 'by-chat', chatId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit);
}

export async function deleteCachedMessage(chatId: string, messageId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('messages', messageId);
  if (!existing || existing.chatId !== chatId) return;
  await db.delete('messages', messageId);
}

export async function evictOldMessages(chatId: string, keep = 200): Promise<void> {
  const db = await getDb();
  const all = await db.getAllFromIndex('messages', 'by-chat', chatId);
  if (all.length <= keep) return;
  const sorted = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
