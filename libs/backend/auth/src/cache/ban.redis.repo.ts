import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { BanCacheMarker, IBanCacheRepository } from './ban.cache.interface';

const key = (credentialsId: string) => `ban:${credentialsId}`;
const lockKey = (credentialsId: string) => `admin_lock:${credentialsId}`;
const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;
const RENEW_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

function isBanCacheMarker(value: unknown): value is BanCacheMarker {
  if (typeof value !== 'object' || value === null) return false;
  const marker = value as Record<string, unknown>;
  const hasValidExpiry =
    marker.bannedUntil === null ||
    (typeof marker.bannedUntil === 'string' &&
      Number.isFinite(Date.parse(marker.bannedUntil)) &&
      new Date(marker.bannedUntil).toISOString() === marker.bannedUntil);
  return (
    typeof marker.reason === 'string' &&
    hasValidExpiry
  );
}

@Injectable()
export class BanRedisRepository implements IBanCacheRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(credentialsId: string): Promise<BanCacheMarker | null> {
    const raw = await this.redis.get(key(credentialsId));
    if (raw === null) return null;

    try {
      const marker: unknown = JSON.parse(raw);
      return isBanCacheMarker(marker) ? marker : null;
    } catch {
      return null;
    }
  }

  async set(credentialsId: string, marker: BanCacheMarker): Promise<void> {
    const serialized = JSON.stringify(marker);
    if (marker.bannedUntil === null) {
      await this.redis.set(key(credentialsId), serialized);
      return;
    }

    const ttlMs = Date.parse(marker.bannedUntil) - Date.now();
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('bannedUntil must be in the future');
    }
    await this.redis.set(key(credentialsId), serialized, 'PX', ttlMs);
  }

  async clear(credentialsId: string): Promise<void> {
    await this.redis.del(key(credentialsId));
  }

  async acquireLock(credentialsId: string, leaseMs: number): Promise<string | null> {
    const ownershipToken = randomUUID();
    const result = await this.redis.set(
      lockKey(credentialsId),
      ownershipToken,
      'PX',
      leaseMs,
      'NX',
    );
    return result === 'OK' ? ownershipToken : null;
  }

  async releaseLock(credentialsId: string, ownershipToken: string): Promise<boolean> {
    const result = await this.redis.eval(
      RELEASE_LOCK_SCRIPT,
      1,
      lockKey(credentialsId),
      ownershipToken,
    );
    return result === 1;
  }

  async renewAdminLock(
    credentialsId: string,
    ownershipToken: string,
    leaseMs: number,
  ): Promise<boolean> {
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) {
      throw new RangeError('lock lease must be a positive integer');
    }
    const result = await this.redis.eval(
      RENEW_LOCK_SCRIPT,
      1,
      lockKey(credentialsId),
      ownershipToken,
      leaseMs,
    );
    return result === 1;
  }
}
