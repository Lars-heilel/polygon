import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import type { Credentials, CredentialsPayload, OAuthLoginDto, TokenPair } from '@org/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';
import {
  AUTH_CACHE_REPOSITORY_TOKEN,
  AUTH_PRISMA_REPOSITORY_TOKEN,
  EncryptionService,
  type Env,
  type JwtPayload,
  SEARCH_CLIENT_TOKEN,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  VERIFICATION_SERVICE_TOKEN,
} from '@org/core';
import { createHash } from 'crypto';

import type { IAuthCacheRepository } from '../cache/auth.cache.interface';
import type { RegisterDto } from '../dto/register.dto';
import type {
  IAuthRepository,
  IAuthService,
  IVerificationService,
} from '../interfaces/auth.interface';

@Injectable()
export class AuthService implements IAuthService {
  private static readonly LOGIN_ATTEMPTS_LIMIT = 5;

  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN)
    private readonly repo: IAuthRepository,
    @Inject(AUTH_CACHE_REPOSITORY_TOKEN)
    private readonly cache: IAuthCacheRepository,
    private readonly encryption: EncryptionService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService<Env>,
    @Inject(VERIFICATION_SERVICE_TOKEN)
    private readonly verification: IVerificationService,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    @Inject(SEARCH_CLIENT_TOKEN) private readonly searchClient: ClientProxy,
    @InjectMetric('auth_events_total') private readonly authCounter: Counter<string>,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await this.encryption.hash(dto.password);
    const credentials = await this.repo.createCredentials({
      email: dto.email,
      passwordHash,
    });
    this.authCounter.inc({ event: 'register' });

    const userPayload = { id: credentials.id, email: credentials.email, name: dto.username };
    this.userClient.emit(USER_EVENTS.REGISTERED, userPayload);
    this.searchClient.emit(USER_EVENTS.REGISTERED, userPayload);

    await this.verification.generateAndSend(credentials.id, credentials.email);
  }

  async validateCredentials(email: string, password: string): Promise<CredentialsPayload> {
    const attempts = await this.cache.incrementLoginAttempts(email);
    if (attempts > AuthService.LOGIN_ATTEMPTS_LIMIT) {
      throw new HttpException(
        'Too many failed login attempts. Please try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.encryption.compare(password, credentials.passwordHash);
    if (!valid) {
      this.authCounter.inc({ event: 'login_failure' });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!credentials.isVerified) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    await this.cache.clearLoginAttempts(email);
    this.authCounter.inc({ event: 'login_success' });

    return {
      id: credentials.id,
      role: credentials.role,
      isVerified: credentials.isVerified,
    };
  }

  async login(id: string): Promise<TokenPair> {
    const credentials = await this.repo.findById(id);
    if (!credentials) throw new UnauthorizedException();
    return this.issueTokenPair(credentials);
  }

  async verifyEmail(token: string): Promise<TokenPair> {
    const credentialsId = await this.verification.verify(token);
    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) throw new UnauthorizedException();
    return this.issueTokenPair(credentials);
  }

  async resendVerification(email: string): Promise<void> {
    await this.verification.resend(email);
  }

  async forgotPassword(email: string): Promise<void> {
    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash) return;
    await this.verification.generatePasswordReset(credentials.id, credentials.email);
    this.authCounter.inc({ event: 'password_reset' });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const credentialsId = await this.verification.consumePasswordResetToken(token);
    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) throw new NotFoundException('User not found');

    const passwordHash = await this.encryption.hash(newPassword);
    await this.repo.updatePasswordHash(credentialsId, passwordHash);
    await this.repo.revokeAllRefreshTokens(credentialsId);
  }

  async oauthLogin(dto: OAuthLoginDto): Promise<TokenPair> {
    const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);
    if (existing) return this.issueTokenPair(existing.credentials);

    let credentials = await this.repo.findByEmail(dto.email);

    if (!credentials) {
      credentials = await this.repo.createCredentials({ email: dto.email });
      const payload = { id: credentials.id, email: credentials.email, name: dto.name };
      this.userClient.emit(USER_EVENTS.REGISTERED, payload);
      this.searchClient.emit(USER_EVENTS.REGISTERED, payload);
    }

    await this.repo.createOAuthAccount({
      provider: dto.provider,
      providerId: dto.providerId,
      credentialsId: credentials.id,
    });

    if (!credentials.isVerified) {
      await this.repo.verifyCredentials(credentials.id);
      credentials = { ...credentials, isVerified: true };
    }

    return this.issueTokenPair(credentials);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);
    if (!stored || stored.revokedAt) return;
    await this.repo.revokeRefreshToken(tokenHash);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);

    if (!stored) throw new UnauthorizedException();

    // Replay attack: revoked token reused → invalidate entire token family
    if (stored.revokedAt) {
      await this.repo.revokeAllRefreshTokens(stored.credentialsId);
      throw new UnauthorizedException();
    }

    if (stored.expiresAt < new Date()) throw new UnauthorizedException();

    await this.repo.revokeRefreshToken(tokenHash);

    const credentials = await this.repo.findById(payload.sub);
    if (!credentials) throw new UnauthorizedException();

    return this.issueTokenPair(credentials);
  }

  private async issueTokenPair(
    credentials: Pick<Credentials, 'id' | 'role' | 'isVerified'>,
  ): Promise<TokenPair> {
    const jwtPayload: JwtPayload = {
      sub: credentials.id,
      role: credentials.role as JwtPayload['role'],
      isVerified: credentials.isVerified,
    };

    const accessToken = this.tokenService.generateAccessToken(jwtPayload);
    const refreshToken = this.tokenService.generateRefreshToken(jwtPayload);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }) * 1000,
    );

    await this.repo.saveRefreshToken({
      tokenHash,
      credentialsId: credentials.id,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
