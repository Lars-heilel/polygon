import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.token';

export type BanMarker = {
  reason: string;
  bannedUntil: string | null;
};

@Injectable()
export class BanMarkerRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async findActiveMarker(userId: string): Promise<BanMarker | null> {
    const value = await this.redis.get(`ban:${userId}`);
    if (!value) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error(`Invalid ban marker JSON for user ${userId}: ${(error as Error).message}`);
    }

    if (!isBanMarker(parsed)) {
      throw new Error(`Invalid ban marker shape for user ${userId}`);
    }

    return parsed;
  }
}

function isBanMarker(value: unknown): value is BanMarker {
  if (!value || typeof value !== 'object') return false;

  const marker = value as Record<string, unknown>;
  return (
    typeof marker.reason === 'string' &&
    marker.reason.length > 0 &&
    (typeof marker.bannedUntil === 'string' || marker.bannedUntil === null)
  );
}
