import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomBytes } from 'crypto';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_EVENTS,
  RedisService,
} from '@org/core';
import type {
  IAuthRepository,
  IVerificationService,
} from '../interfaces/auth.interface';

const VERIFICATION_TTL = 86_400; // 24 hours
const KEY_BY_TOKEN = (token: string) => `email_verification:${token}`;
const KEY_BY_ID = (id: string) => `email_verification_id:${id}`;

const PASSWORD_RESET_TTL = 3_600; // 1 hour
const RESET_KEY_BY_TOKEN = (token: string) => `password_reset:${token}`;
const RESET_KEY_BY_ID = (id: string) => `password_reset_id:${id}`;

const RESEND_COOLDOWN_TTL = 60; // 1 minute
const KEY_RESEND_COOLDOWN = (email: string) => `resend_cooldown:${email}`;
const RESET_COOLDOWN_TTL = 60; // 1 minute
const KEY_RESET_COOLDOWN = (email: string) => `reset_cooldown:${email}`;

@Injectable()
export class VerificationService implements IVerificationService {
  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN)
    private readonly repo: IAuthRepository,
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_CLIENT_TOKEN)
    private readonly notificationClient: ClientProxy
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

  async verify(token: string): Promise<string> {
    const credentialsId = await this.redis.get(KEY_BY_TOKEN(token));
    if (!credentialsId)
      throw new BadRequestException('Invalid or expired verification token');
    await this.repo.verifyCredentials(credentialsId);
    await this.redis.del(KEY_BY_TOKEN(token), KEY_BY_ID(credentialsId));
    return credentialsId;
  }

  async resend(email: string): Promise<void> {
    const credentials = await this.repo.findByEmail(email);
    if (!credentials) throw new NotFoundException('User not found');
    if (credentials.isVerified)
      throw new BadRequestException('Account already verified');

    const cooldown = await this.redis.get(KEY_RESEND_COOLDOWN(email));
    if (cooldown)
      throw new HttpException(
        'Please wait before requesting another verification email',
        HttpStatus.TOO_MANY_REQUESTS
      );

    const oldToken = await this.redis.get(KEY_BY_ID(credentials.id));
    if (oldToken)
      await this.redis.del(KEY_BY_TOKEN(oldToken), KEY_BY_ID(credentials.id));

    await this.generateAndSend(credentials.id, credentials.email);
    await this.redis.set(KEY_RESEND_COOLDOWN(email), RESEND_COOLDOWN_TTL, '1');
  }

  async generatePasswordReset(
    credentialsId: string,
    email: string
  ): Promise<void> {
    const cooldown = await this.redis.get(KEY_RESET_COOLDOWN(email));
    if (cooldown)
      throw new HttpException(
        'Please wait before requesting another password reset email',
        HttpStatus.TOO_MANY_REQUESTS
      );

    const oldToken = await this.redis.get(RESET_KEY_BY_ID(credentialsId));
    if (oldToken)
      await this.redis.del(
        RESET_KEY_BY_TOKEN(oldToken),
        RESET_KEY_BY_ID(credentialsId)
      );

    const token = randomBytes(32).toString('base64url');
    await this.redis.set(
      RESET_KEY_BY_TOKEN(token),
      PASSWORD_RESET_TTL,
      credentialsId
    );
    await this.redis.set(
      RESET_KEY_BY_ID(credentialsId),
      PASSWORD_RESET_TTL,
      token
    );
    this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, {
      to: email,
      token,
    });
    await this.redis.set(KEY_RESET_COOLDOWN(email), RESET_COOLDOWN_TTL, '1');
  }

  async consumePasswordResetToken(token: string): Promise<string> {
    const credentialsId = await this.redis.get(RESET_KEY_BY_TOKEN(token));
    if (!credentialsId)
      throw new BadRequestException('Invalid or expired password reset token');
    await this.redis.del(
      RESET_KEY_BY_TOKEN(token),
      RESET_KEY_BY_ID(credentialsId)
    );
    return credentialsId;
  }
}
