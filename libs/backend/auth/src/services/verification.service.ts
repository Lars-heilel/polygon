import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_CACHE_REPOSITORY_TOKEN,
  AUTH_PRISMA_REPOSITORY_TOKEN,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_EVENTS,
} from '@org/core';
import { randomBytes } from 'crypto';

import type { IAuthCacheRepository } from '../cache/auth.cache.interface';
import type { IAuthRepository, IVerificationService } from '../interfaces/auth.interface';

@Injectable()
export class VerificationService implements IVerificationService {
  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN)
    private readonly repo: IAuthRepository,
    @Inject(AUTH_CACHE_REPOSITORY_TOKEN)
    private readonly cache: IAuthCacheRepository,
    @Inject(NOTIFICATION_CLIENT_TOKEN)
    private readonly notificationClient: ClientProxy,
  ) {}

  async generateAndSend(credentialsId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.cache.setVerificationToken(token, credentialsId);
    this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL, { to: email, token });
  }

  async verify(token: string): Promise<string> {
    const credentialsId = await this.cache.getCredentialsIdByVerificationToken(token);
    if (!credentialsId) throw new BadRequestException('Invalid or expired verification token');
    await this.repo.verifyCredentials(credentialsId);
    await this.cache.deleteVerificationTokens(token, credentialsId);
    return credentialsId;
  }

  async resend(email: string): Promise<void> {
    const credentials = await this.repo.findByEmail(email);
    if (!credentials) throw new NotFoundException('User not found');
    if (credentials.isVerified) throw new BadRequestException('Account already verified');

    const cooldown = await this.cache.getResendCooldown(email);
    if (cooldown)
      throw new HttpException(
        'Please wait before requesting another verification email',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const oldToken = await this.cache.getVerificationTokenByCredentialsId(credentials.id);
    if (oldToken) await this.cache.deleteVerificationTokens(oldToken, credentials.id);

    await this.generateAndSend(credentials.id, credentials.email);
    await this.cache.setResendCooldown(email);
  }

  async generatePasswordReset(credentialsId: string, email: string): Promise<void> {
    const cooldown = await this.cache.getResetCooldown(email);
    if (cooldown)
      throw new HttpException(
        'Please wait before requesting another password reset email',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const oldToken = await this.cache.getResetTokenByCredentialsId(credentialsId);
    if (oldToken) await this.cache.deletePasswordResetTokens(oldToken, credentialsId);

    const token = randomBytes(32).toString('base64url');
    await this.cache.setPasswordResetToken(token, credentialsId);
    this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, { to: email, token });
    await this.cache.setResetCooldown(email);
  }

  async consumePasswordResetToken(token: string): Promise<string> {
    const credentialsId = await this.cache.getCredentialsIdByResetToken(token);
    if (!credentialsId) throw new BadRequestException('Invalid or expired password reset token');
    await this.cache.deletePasswordResetTokens(token, credentialsId);
    return credentialsId;
  }
}
