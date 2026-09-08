import type Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

import { ChatCacheService } from './chat-cache.service';

function createCache(): ChatCacheService {
  const redis = new RedisMock() as unknown as Redis;
  return new ChatCacheService(redis);
}

describe('ChatCacheService', () => {
  it('returns null on miss and hits after set', async () => {
    const cache = createCache();
    await expect(cache.getChatList('u1')).resolves.toBeNull();
    await cache.setChatList('u1', [{ id: 'c1' }] as never);
    await expect(cache.getChatList('u1')).resolves.toEqual([{ id: 'c1' }]);
  });

  it('claimClientId is single-winner', async () => {
    const cache = createCache();
    await expect(cache.claimClientId('c1', 'u1', 'k1', 'm1')).resolves.toBe(true);
    await expect(cache.claimClientId('c1', 'u1', 'k1', 'm2')).resolves.toBe(false);
  });

  it('caches messages pages and invalidates them by chat', async () => {
    const cache = createCache();
    await expect(cache.getMessagesPage('c1', 'HEAD')).resolves.toBeNull();
    await cache.setMessagesPage('c1', 'HEAD', { messages: [], nextCursor: null } as never);
    await cache.setMessagesPage('c1', 'cursor-2', { messages: [], nextCursor: null } as never);
    await expect(cache.getMessagesPage('c1', 'HEAD')).resolves.toEqual({
      messages: [],
      nextCursor: null,
    });
    await cache.invalidateChatPages('c1');
    await expect(cache.getMessagesPage('c1', 'HEAD')).resolves.toBeNull();
    await expect(cache.getMessagesPage('c1', 'cursor-2')).resolves.toBeNull();
  });

  it('tracks unread counters with reset', async () => {
    const cache = createCache();
    await expect(cache.getUnread('c1', 'u1')).resolves.toBeNull();
    await expect(cache.incrUnread('c1', 'u1')).resolves.toBe(1);
    await expect(cache.incrUnread('c1', 'u1')).resolves.toBe(2);
    await expect(cache.getUnread('c1', 'u1')).resolves.toBe(2);
    await cache.resetUnread('c1', 'u1');
    await expect(cache.getUnread('c1', 'u1')).resolves.toBeNull();
  });

  it('invalidates chat list', async () => {
    const cache = createCache();
    await cache.setChatList('u1', [{ id: 'c1' }] as never);
    await cache.invalidateChatList('u1');
    await expect(cache.getChatList('u1')).resolves.toBeNull();
  });

  it('falls back on redis errors', async () => {
    const failing = {
      get: async (): Promise<never> => {
        throw new Error('redis down');
      },
      set: async (): Promise<never> => {
        throw new Error('redis down');
      },
      del: async (): Promise<never> => {
        throw new Error('redis down');
      },
      incr: async (): Promise<never> => {
        throw new Error('redis down');
      },
      scanStream: (): never => {
        throw new Error('redis down');
      },
    } as unknown as Redis;
    const cache = new ChatCacheService(failing);
    await expect(cache.getChatList('u1')).resolves.toBeNull();
    await expect(cache.getMessagesPage('c1', 'HEAD')).resolves.toBeNull();
    await expect(cache.getUnread('c1', 'u1')).resolves.toBeNull();
    await expect(cache.incrUnread('c1', 'u1')).resolves.toBe(0);
    await expect(cache.claimClientId('c1', 'u1', 'k1', 'm1')).resolves.toBe(false);
    await expect(cache.setChatList('u1', [])).resolves.toBeUndefined();
    await expect(cache.invalidateChatList('u1')).resolves.toBeUndefined();
    await expect(cache.invalidateChatPages('c1')).resolves.toBeUndefined();
    await expect(cache.resetUnread('c1', 'u1')).resolves.toBeUndefined();
  });
});
