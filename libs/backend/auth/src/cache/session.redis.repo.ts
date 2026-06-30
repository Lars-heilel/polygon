import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';
import type { ISessionCacheRepository, SessionCacheData } from './session.cache.interface';

const KEY = {
  session: (id: string) => `session:${id}`,
  userSessions: (userId: string) => `user_sessions:${userId}`,
};

@Injectable()
export class SessionRedisRepository implements ISessionCacheRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async save(sessionId: string, data: SessionCacheData, ttlSec: number): Promise<void> {
    await this.redis.set(KEY.session(sessionId), JSON.stringify(data), 'EX', ttlSec);
  }

  async find(sessionId: string): Promise<SessionCacheData | null> {
    const raw = await this.redis.get(KEY.session(sessionId));
    return raw ? JSON.parse(raw) : null;
  }

  async remove(sessionId: string): Promise<void> {
    await this.redis.del(KEY.session(sessionId));
  }

  async addToUserSessions(userId: string, sessionId: string): Promise<void> {
    await this.redis.sadd(KEY.userSessions(userId), sessionId);
  }

  async getUserSessionIds(userId: string): Promise<string[]> {
    return this.redis.smembers(KEY.userSessions(userId));
  }

  async removeFromUserSessions(userId: string, sessionId: string): Promise<void> {
    await this.redis.srem(KEY.userSessions(userId), sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    const result = await this.redis.exists(KEY.session(sessionId));
    return result === 1;
  }
}
