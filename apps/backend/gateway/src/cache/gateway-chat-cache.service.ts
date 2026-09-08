import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MessagePage } from '@org/common';
import { REDIS_CLIENT } from '@org/core';
import { chatListKey, chatMsgsKey } from '@org/chat';
import type Redis from 'ioredis';

/**
 * Gateway-side read-through cache for chat lists and message pages.
 * Uses the same Redis key builders as ChatCacheService (Task 3) so both
 * sides stay consistent. All Redis failures fall back silently — the
 * caller always revalidates against the chat service over RabbitMQ.
 */
@Injectable()
export class GatewayChatCacheService {
  private readonly logger = new Logger(GatewayChatCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getChatList<T>(userId: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(chatListKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setChatList<T>(userId: string, chats: T, ttlSec = 30): Promise<void> {
    try {
      await this.redis.set(chatListKey(userId), JSON.stringify(chats), 'EX', ttlSec);
    } catch {
      /* Redis unavailable — gateway falls back to RPC */
    }
  }

  async invalidateChatList(userId: string): Promise<void> {
    try {
      await this.redis.del(chatListKey(userId));
      this.logger.debug('gateway_chat_list_invalidated hasUserId=true');
    } catch {
      /* skip */
    }
  }

  async getMessagesPage(
    chatId: string,
    cursor: string,
    userId?: string,
    take?: number | string,
  ): Promise<MessagePage | null> {
    try {
      const raw = await this.redis.get(chatMsgsKey(chatId, cursor, userId, take));
      if (!raw) return null;
      return JSON.parse(raw) as MessagePage;
    } catch {
      return null;
    }
  }

  async setMessagesPage(
    chatId: string,
    cursor: string,
    page: MessagePage,
    ttlSec = 60,
    userId?: string,
    take?: number | string,
  ): Promise<void> {
    try {
      await this.redis.set(
        chatMsgsKey(chatId, cursor, userId, take),
        JSON.stringify(page),
        'EX',
        ttlSec,
      );
    } catch {
      /* skip */
    }
  }

  async invalidateChatPages(chatId: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: `chat:msgs:${chatId}:*`, count: 100 });
      const keys: string[] = [];
      for await (const batch of stream as unknown as AsyncIterable<unknown>) {
        if (!Array.isArray(batch)) continue;
        for (const key of batch) {
          if (typeof key === 'string') keys.push(key);
        }
      }
      if (keys.length > 0) await this.redis.del(...keys);
      this.logger.debug('gateway_chat_pages_invalidated hasChatId=true');
    } catch {
      /* skip */
    }
  }
}
