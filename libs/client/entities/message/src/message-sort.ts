import type { Message } from './message.types.js';

export type MessageSortKey = Pick<Message, 'createdAt' | 'id'>;

/**
 * Shared `createdAt,id` ordering: newest-message cursor (`pickNewestSync`),
 * the IndexedDB read/evict paths, and the in-memory mirror must all agree
 * on the same total order or delta cursors can regress.
 */
export function compareMessagesByCreatedAt(a: MessageSortKey, b: MessageSortKey): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
