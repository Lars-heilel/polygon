import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';

import type { IAuthCacheRepository } from './auth.cache.interface';

const TTL = {
  VERIFICATION: 86_400, // 24 hours
  PASSWORD_RESET: 3_600, // 1 hour
  RESEND_COOLDOWN: 60,
  RESET_COOLDOWN: 60,
  LOGIN_ATTEMPTS: 900, // 15 minutes
} as const;

const KEY = {
  verificationByToken: (token: string) => `email_verification:${token}`,
  verificationById: (credentialsId: string) => `email_verification_id:${credentialsId}`,
  resetByToken: (token: string) => `password_reset:${token}`,
  resetById: (credentialsId: string) => `password_reset_id:${credentialsId}`,
  resendCooldown: (email: string) => `resend_cooldown:${email}`,
  resetCooldown: (email: string) => `reset_cooldown:${email}`,
  loginAttempts: (email: string) => `login_attempts:${email}`,
} as const;

@Injectable()
export class AuthRedisCacheRepository implements IAuthCacheRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Email verification ──────────────────────────────────────────────

  async setVerificationToken(token: string, credentialsId: string): Promise<void> {
    await this.redis
      .multi()
      .set(KEY.verificationByToken(token), credentialsId, 'EX', TTL.VERIFICATION)
      .set(KEY.verificationById(credentialsId), token, 'EX', TTL.VERIFICATION)
      .exec();
  }

  async getCredentialsIdByVerificationToken(token: string): Promise<string | null> {
    return this.redis.get(KEY.verificationByToken(token));
  }

  async getVerificationTokenByCredentialsId(credentialsId: string): Promise<string | null> {
    return this.redis.get(KEY.verificationById(credentialsId));
  }

  async deleteVerificationTokens(token: string, credentialsId: string): Promise<void> {
    await this.redis.del(KEY.verificationByToken(token), KEY.verificationById(credentialsId));
  }

  async setResendCooldown(email: string): Promise<void> {
    await this.redis.set(KEY.resendCooldown(email), '1', 'EX', TTL.RESEND_COOLDOWN);
  }

  async getResendCooldown(email: string): Promise<string | null> {
    return this.redis.get(KEY.resendCooldown(email));
  }

  // ── Password reset ──────────────────────────────────────────────────

  async setPasswordResetToken(token: string, credentialsId: string): Promise<void> {
    await this.redis
      .multi()
      .set(KEY.resetByToken(token), credentialsId, 'EX', TTL.PASSWORD_RESET)
      .set(KEY.resetById(credentialsId), token, 'EX', TTL.PASSWORD_RESET)
      .exec();
  }

  async getCredentialsIdByResetToken(token: string): Promise<string | null> {
    return this.redis.get(KEY.resetByToken(token));
  }

  async getResetTokenByCredentialsId(credentialsId: string): Promise<string | null> {
    return this.redis.get(KEY.resetById(credentialsId));
  }

  async deletePasswordResetTokens(token: string, credentialsId: string): Promise<void> {
    await this.redis.del(KEY.resetByToken(token), KEY.resetById(credentialsId));
  }

  async setResetCooldown(email: string): Promise<void> {
    await this.redis.set(KEY.resetCooldown(email), '1', 'EX', TTL.RESET_COOLDOWN);
  }

  async getResetCooldown(email: string): Promise<string | null> {
    return this.redis.get(KEY.resetCooldown(email));
  }

  // ── Login attempts ──────────────────────────────────────────────────

  async incrementLoginAttempts(email: string): Promise<number> {
    const key = KEY.loginAttempts(email);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, TTL.LOGIN_ATTEMPTS);
    return count;
  }

  async clearLoginAttempts(email: string): Promise<void> {
    await this.redis.del(KEY.loginAttempts(email));
  }
}
