import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomBytes } from 'crypto';
import {
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_EVENTS,
  RedisService,
} from '@org/core';
import { AuthPrismaRepository } from '../database/repository/auth.prisma.repo';

const VERIFICATION_TTL = 86_400; // 24 hours
const KEY_BY_TOKEN = (token: string) => `email_verification:${token}`;
const KEY_BY_ID = (id: string) => `email_verification_id:${id}`;

const PASSWORD_RESET_TTL = 3_600; // 1 hour
const RESET_KEY_BY_TOKEN = (token: string) => `password_reset:${token}`;
const RESET_KEY_BY_ID = (id: string) => `password_reset_id:${id}`;

@Injectable()
export class VerificationService {
  constructor(
    private readonly repo: AuthPrismaRepository,
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_CLIENT_TOKEN) private readonly notificationClient: ClientProxy,
  ) {}

  async generateAndSend(credentialsId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');

    await this.redis.set(KEY_BY_TOKEN(token), VERIFICATION_TTL, credentialsId);
    await this.redis.set(KEY_BY_ID(credentialsId), VERIFICATION_TTL, token);

    this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL, {
      to: email,
      token,
    });
  }

  async verify(token: string): Promise<void> {
    const credentialsId = await this.redis.get(KEY_BY_TOKEN(token));
    if (!credentialsId) throw new BadRequestException('Invalid or expired verification token');

    await this.repo.verifyCredentials(credentialsId);
    await this.redis.del(KEY_BY_TOKEN(token), KEY_BY_ID(credentialsId));
  }

  async resend(email: string): Promise<void> {
    const credentials = await this.repo.findByEmail(email);
    if (!credentials) throw new NotFoundException('User not found');
    if (credentials.isVerified) throw new BadRequestException('Account already verified');

    const oldToken = await this.redis.get(KEY_BY_ID(credentials.id));
    if (oldToken) {
      await this.redis.del(KEY_BY_TOKEN(oldToken), KEY_BY_ID(credentials.id));
    }

    await this.generateAndSend(credentials.id, credentials.email);
  }

  async generatePasswordReset(credentialsId: string, email: string): Promise<void> {
    const oldToken = await this.redis.get(RESET_KEY_BY_ID(credentialsId));
    if (oldToken) {
      await this.redis.del(RESET_KEY_BY_TOKEN(oldToken), RESET_KEY_BY_ID(credentialsId));
    }

    const token = randomBytes(32).toString('base64url');
    await this.redis.set(RESET_KEY_BY_TOKEN(token), PASSWORD_RESET_TTL, credentialsId);
    await this.redis.set(RESET_KEY_BY_ID(credentialsId), PASSWORD_RESET_TTL, token);

    this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, {
      to: email,
      token,
    });
  }

  async consumePasswordResetToken(token: string): Promise<string> {
    const credentialsId = await this.redis.get(RESET_KEY_BY_TOKEN(token));
    if (!credentialsId) throw new BadRequestException('Invalid or expired password reset token');

    await this.redis.del(RESET_KEY_BY_TOKEN(token), RESET_KEY_BY_ID(credentialsId));
    return credentialsId;
  }
}
