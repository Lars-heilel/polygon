import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MessagePage } from '@org/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';

import type { ChatWithPreview } from '../interfaces/chat.interface';
import { chatListKey, chatMsgsKey, chatUnreadKey, idemKey } from './chat-cache.keys';

@Injectable()
export class ChatCacheService {
  private readonly logger = new Logger(ChatCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getChatList(userId: string): Promise<ChatWithPreview[] | null> {
    const hasUserId = Boolean(userId);
    try {
      const raw = await this.redis.get(chatListKey(userId));
      if (!raw) {
        this.logger.debug(`chat_cache_miss hasUserId=${hasUserId}`);
        return null;
      }
      this.logger.debug(`chat_cache_hit hasUserId=${hasUserId}`);
      return JSON.parse(raw) as ChatWithPreview[];
    } catch {
      return null;
    }
  }

  async setChatList(userId: string, chats: ChatWithPreview[], ttlSec = 30): Promise<void> {
    try {
      await this.redis.set(chatListKey(userId), JSON.stringify(chats), 'EX', ttlSec);
    } catch {
      /* Redis unavailable — caller falls back to Postgres */
    }
  }

  async invalidateChatList(userId: string): Promise<void> {
    try {
      await this.redis.del(chatListKey(userId));
      this.logger.debug(`chat_cache_invalidated hasUserId=${Boolean(userId)}`);
    } catch {
      /* skip */
    }
  }

  async getMessagesPage(chatId: string, cursor: string): Promise<MessagePage | null> {
    const hasChatId = Boolean(chatId);
    try {
      const raw = await this.redis.get(chatMsgsKey(chatId, cursor));
      if (!raw) {
        this.logger.debug(`chat_cache_miss hasChatId=${hasChatId}`);
        return null;
      }
      this.logger.debug(`chat_cache_hit hasChatId=${hasChatId}`);
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
  ): Promise<void> {
    try {
      await this.redis.set(chatMsgsKey(chatId, cursor), JSON.stringify(page), 'EX', ttlSec);
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
      this.logger.debug(`chat_cache_invalidated hasChatId=${Boolean(chatId)}`);
    } catch {
      /* skip */
    }
  }

  async incrUnread(chatId: string, userId: string): Promise<number> {
    try {
      return await this.redis.incr(chatUnreadKey(chatId, userId));
    } catch {
      this.logger.warn(
        `chat_cache_incr_failed hasChatId=${Boolean(chatId)} hasUserId=${Boolean(userId)}`,
      );
      return 0;
    }
  }

  async resetUnread(chatId: string, userId: string): Promise<void> {
    try {
      await this.redis.del(chatUnreadKey(chatId, userId));
    } catch {
      /* skip */
    }
  }

  async getUnread(chatId: string, userId: string): Promise<number | null> {
    try {
      const raw = await this.redis.get(chatUnreadKey(chatId, userId));
      return raw === null ? null : Number(raw);
    } catch {
      return null;
    }
  }

  async claimClientId(
    chatId: string,
    senderId: string,
    clientId: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      const res = await this.redis.set(idemKey(senderId, clientId), messageId, 'EX', 86400, 'NX');
      return res === 'OK';
    } catch {
      this.logger.warn(
        `chat_cache_claim_failed hasChatId=${Boolean(chatId)} hasSender=${Boolean(senderId)}`,
      );
      return false;
    }
  }
}
