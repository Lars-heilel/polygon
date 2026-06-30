import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import type { CredentialsPayload, OAuthLoginDto, TokenPair, UserPublic } from '@org/common';
import {
  AUTH_CACHE_REPOSITORY_TOKEN,
  AUTH_PRISMA_REPOSITORY_TOKEN,
  type ClientMetadata,
  EncryptionService,
  type Env,
  type JwtPayload,
  SEARCH_CLIENT_TOKEN,
  SESSION_CACHE_REPOSITORY_TOKEN,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  USER_PATTERNS,
  VERIFICATION_SERVICE_TOKEN,
} from '@org/core';
import { createHash, randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';

import type { IAuthCacheRepository } from '../cache/auth.cache.interface';
import type { ISessionCacheRepository } from '../cache/session.cache.interface';
import { SessionResponse } from '../dto';
import type { RegisterDto } from '../dto/register.dto';
import type {
  IAuthRepository,
  IAuthService,
  IVerificationService,
} from '../interfaces/auth.interface';

@Injectable()
export class AuthService implements IAuthService {
  private static readonly LOGIN_ATTEMPTS_LIMIT = 5;
  private readonly logger = new Logger(AuthService.name);

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
    @Inject(SESSION_CACHE_REPOSITORY_TOKEN)
    private readonly sessionCache: ISessionCacheRepository,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    @Inject(SEARCH_CLIENT_TOKEN) private readonly searchClient: ClientProxy,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    this.logger.log(`Service: Initiating registration for email: ${dto.email}`);

    const { password: _password, ...safeDto } = dto;
    this.logger.debug({ safeDto }, 'Service: Register DTO state');

    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      this.logger.warn(`Service: Registration failed. Email already in use: ${dto.email}`);
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.encryption.hash(dto.password);
    const credentials = await this.repo.createCredentials({
      email: dto.email,
      passwordHash,
    });
    this.logger.verbose(
      { credentialsId: credentials.id },
      'Service: Credentials record created in DB',
    );

    const userPayload = { id: credentials.id, email: credentials.email, name: dto.username };

    this.logger.verbose('Service: Sending USER_PATTERNS.CREATE to User microservice');
    await lastValueFrom(this.userClient.send<UserPublic>(USER_PATTERNS.CREATE, userPayload));

    this.logger.verbose('Service: Emitting USER_EVENTS.REGISTERED to Search microservice');
    this.searchClient.emit(USER_EVENTS.REGISTERED, userPayload);

    try {
      this.logger.verbose('Service: Triggering verification email routine');
      await this.verification.generateAndSend(credentials.id, credentials.email);
    } catch (err) {
      this.logger.error(
        `Service: Failed to send verification email to: ${credentials.email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    this.logger.log(`Service: Registration completed successfully for: ${dto.email}`);
  }

  async validateCredentials(email: string, password: string): Promise<CredentialsPayload> {
    this.logger.log(`Service: Validating credentials for: ${email}`);

    const attempts = await this.cache.incrementLoginAttempts(email);
    this.logger.debug({ email, attempts }, 'Service: Login attempts counter incremented');

    if (attempts > AuthService.LOGIN_ATTEMPTS_LIMIT) {
      this.logger.warn(`Service: Login blocked due to rate-limiting for: ${email}`);
      throw new HttpException(
        'Too many failed login attempts. Please try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash) {
      this.logger.warn(`Service: Validation failed. Email not found: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.encryption.compare(password, credentials.passwordHash);
    if (!valid) {
      this.logger.warn(`Service: Validation failed. Password mismatch for: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!credentials.isVerified) {
      this.logger.warn(`Service: Validation blocked. Email unverified: ${email}`);
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    await this.cache.clearLoginAttempts(email);
    this.logger.verbose({ email }, 'Service: Rate-limiting attempts cleared');

    return {
      id: credentials.id,
      role: credentials.role,
      isVerified: credentials.isVerified,
    };
  }

  async login(id: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log(`Service: Establishing new session for user credentials ID: ${id}`);

    this.logger.debug(
      { credentialsId: id, clientMetadata },
      'Service: Initial session payload and metadata',
    );

    const credentials = await this.repo.findById(id);
    if (!credentials) {
      this.logger.error(`Service: Failed to establish session. User ID not found: ${id}`);
      throw new UnauthorizedException();
    }

    const refreshExpiresSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });
    const expiresAt = new Date(Date.now() + refreshExpiresSec * 1000);

    const sessionId = randomUUID();
    const jwtPayload = {
      sub: credentials.id,
      role: credentials.role as JwtPayload['role'],
      isVerified: credentials.isVerified,
    };

    const tokens = this.tokenService.generateTokenPair(jwtPayload, sessionId);
    const tokenHash = this.hashToken(tokens.refreshToken);

    this.logger.verbose(
      { sessionId, tokenHashLength: tokenHash.length, refreshExpiresSec },
      'Service: Internal session parameters prepared',
    );

    this.logger.verbose('Service: Saving session record to relational database (Prisma)');
    await this.repo.saveSession({
      id: sessionId,
      tokenHash,
      credentialsId: credentials.id,
      expiresAt,
      ip: clientMetadata?.ip,
      country: clientMetadata?.country,
      os: clientMetadata?.os,
      browser: clientMetadata?.browser,
      device: clientMetadata?.device,
      userAgent: clientMetadata?.userAgent,
    });
    this.logger.verbose('Service: Saving active session pointer to cache layer (Redis)');
    await this.sessionCache.save(
      sessionId,
      {
        credentialsId: credentials.id,
        device: clientMetadata?.device ?? 'Unknown',
        expiresAt: expiresAt.toISOString(),
      },
      refreshExpiresSec,
    );

    await this.sessionCache.addToUserSessions(credentials.id, sessionId);
    this.logger.log(`Service: Session ${sessionId} successfully registered for ID: ${id}`);

    return tokens;
  }

  async verifyEmail(token: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log('Service: Processing email verification transition state');
    this.logger.debug(
      { token, clientMetadata },
      'Service: Verification token validation and metadata propagation',
    );

    const credentialsId = await this.verification.verify(token);
    this.logger.verbose({ credentialsId }, 'Service: Verification token consumed successfully');

    return this.login(credentialsId, clientMetadata);
  }

  async resendVerification(email: string): Promise<void> {
    this.logger.log(`Service: Requesting verification email regeneration for: ${email}`);
    await this.verification.resend(email);
    this.logger.log(
      `Service: Resend operation successfully dispatched to verification manager: ${email}`,
    );
  }

  async forgotPassword(email: string): Promise<void> {
    this.logger.log(`Service: Processing forgot password request for: ${email}`);

    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash) {
      this.logger.warn(
        `Service: Forgot password aborted. Email is not registered or lacks password: ${email}`,
      );
      return;
    }

    await this.verification.generatePasswordReset(credentials.id, credentials.email);
    this.logger.log(`Service: Password reset request successfully dispatched for: ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.log('Service: Processing password reset consumption');

    const credentialsId = await this.verification.consumePasswordResetToken(token);
    this.logger.verbose({ credentialsId }, 'Service: Verification token validated and consumed');

    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) {
      this.logger.error(`Service: User target not found during reset: ${credentialsId}`);
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.encryption.hash(newPassword);
    await this.repo.updatePasswordHash(credentialsId, passwordHash);
    this.logger.verbose({ credentialsId }, 'Service: Database password hash updated');

    this.logger.log(`Service: Revoking all active sessions for credentialsId: ${credentialsId}`);
    await this.revokeAllSessions(credentialsId);
  }

  async oauthLogin(dto: OAuthLoginDto, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log(`Service: Processing OAuth pipeline for provider: ${dto.provider}`);
    this.logger.debug(
      { dto, clientMetadata },
      'Service: OAuth dto parameters and metadata context',
    );

    const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);
    if (existing) {
      this.logger.verbose(
        { credentialsId: existing.credentials.id },
        'Service: Existing OAuth link found in database',
      );
      return this.login(existing.credentials.id, clientMetadata);
    }

    this.logger.verbose(
      { email: dto.email },
      'Service: No existing OAuth link. Checking credentials mapping by email',
    );
    let credentials = await this.repo.findByEmail(dto.email);
    let isNewCredentials = false;

    if (!credentials) {
      this.logger.verbose(
        { email: dto.email },
        'Service: User does not exist. Creating new federated credentials record',
      );
      credentials = await this.repo.createCredentials({ email: dto.email });
      isNewCredentials = true;
    }

    const payload = { id: credentials.id, email: credentials.email, name: dto.name };
    this.logger.verbose(
      'Service: Emitting profile creation request for OAuth user to User microservice',
    );
    await lastValueFrom(this.userClient.send<UserPublic>(USER_PATTERNS.CREATE, payload));

    if (isNewCredentials) {
      this.logger.verbose('Service: Emitting USER_EVENTS.REGISTERED to Search microservice');
      this.searchClient.emit(USER_EVENTS.REGISTERED, payload);
    }

    this.logger.verbose('Service: Creating OAuth identity binding');
    await this.repo.createOAuthAccount({
      provider: dto.provider,
      providerId: dto.providerId,
      credentialsId: credentials.id,
    });

    if (!credentials.isVerified) {
      this.logger.verbose(
        { credentialsId: credentials.id },
        'Service: Unverified credentials found, forcing auto-verification',
      );
      await this.repo.verifyCredentials(credentials.id);
      credentials = { ...credentials, isVerified: true };
    }

    return this.login(credentials.id, clientMetadata);
  }

  async logout(refreshToken: string): Promise<void> {
    this.logger.log('Service: Processing logout flow');

    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (err) {
      this.logger.warn('Service: Logout failed. Invalid refresh token signature or expiration');
      this.logger.debug({ err }, 'Service: Invalid token trace');
      return;
    }

    const tokenHash = this.hashToken(refreshToken);
    this.logger.debug(
      { sub: payload.sub, sessionId: payload.sessionId, tokenHashLength: tokenHash.length },
      'Service: Session parameters decrypted',
    );

    await this.repo.revokeSession(tokenHash);
    this.logger.verbose('Service: Session revoked in database (Prisma)');

    await this.sessionCache.remove(payload.sessionId);
    await this.sessionCache.removeFromUserSessions(payload.sub, payload.sessionId);
    this.logger.verbose('Service: Session revoked and cleaned up in cache (Redis)');

    this.logger.log(`Service: Logout flow successfully executed for session: ${payload.sessionId}`);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    this.logger.log('Service: Processing token refresh rotation');

    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (err) {
      this.logger.warn('Service: Refresh failed. Token is invalid or expired');
      this.logger.debug({ err }, 'Service: Invalid refresh token signature context');
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findSessionByTokenHash(tokenHash);

    if (!stored) {
      this.logger.warn('Service: Refresh failed. Session record not found in database');
      throw new UnauthorizedException();
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Service: Security warning. Revoked session reuse attempt for user: ${stored.credentialsId}. Revoking all sessions.`,
      );
      await this.repo.revokeAllSessions(stored.credentialsId);
      throw new UnauthorizedException();
    }

    if (stored.expiresAt < new Date()) {
      this.logger.warn('Service: Refresh failed. Session database record has expired');
      throw new UnauthorizedException();
    }

    const jwtPayload = {
      sub: payload.sub,
      role: payload.role,
      isVerified: payload.isVerified,
    };

    const newTokens = this.tokenService.generateTokenPair(jwtPayload, stored.id);
    const newTokenHash = this.hashToken(newTokens.refreshToken);

    this.logger.verbose('Service: Registering new session refresh token hash in database');
    await this.repo.updateSessionTokenHash(stored.id, newTokenHash);

    const ttlSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });

    this.logger.verbose('Service: Extending session expiration in Redis');
    await this.sessionCache.save(
      stored.id,
      {
        credentialsId: stored.credentialsId,
        device: stored.device ?? 'Unknown',
        expiresAt: stored.expiresAt.toISOString(),
      },
      ttlSec,
    );

    await this.repo.updateSessionLastActive(stored.id);
    this.logger.log(`Service: Token rotation successfully completed for session: ${stored.id}`);

    return newTokens;
  }

  async listSessions(credentialsId: string, currentSessionId: string): Promise<SessionResponse[]> {
    this.logger.log(`Service: Querying active sessions for credentialsId: ${credentialsId}`);

    const sessions = await this.repo.findActiveSessions(credentialsId);
    this.logger.debug(
      { credentialsId, count: sessions.length },
      'Service: DB session search result',
    );

    return sessions.map((s) => ({
      id: s.id,
      device: s.device,
      os: s.os,
      browser: s.browser,
      ip: s.ip,
      country: s.country,
      isCurrent: s.id === currentSessionId,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(sessionId: string, credentialsId: string): Promise<void> {
    this.logger.log(`Service: Revocation command received for session: ${sessionId}`);

    const session = await this.repo.findSessionById(sessionId);
    if (!session || session.credentialsId !== credentialsId) {
      this.logger.warn(
        `Service: Unauthorized revocation attempt of session ${sessionId} by user: ${credentialsId}`,
      );
      throw new UnauthorizedException();
    }

    await this.repo.revokeSession(session.tokenHash);
    this.logger.verbose('Service: Session revoked in database');

    await this.sessionCache.remove(sessionId);
    await this.sessionCache.removeFromUserSessions(credentialsId, sessionId);
    this.logger.verbose('Service: Session removed from cache layer');

    this.logger.log(`Service: Session: ${sessionId} successfully revoked`);
  }

  async revokeAllSessions(credentialsId: string): Promise<void> {
    this.logger.log(`Service: Executing global session revocation for user: ${credentialsId}`);

    const sessionIds = await this.sessionCache.getUserSessionIds(credentialsId);
    this.logger.debug({ credentialsId, sessionIds }, 'Service: Cached sessions to clear');

    for (const sid of sessionIds) {
      await this.sessionCache.remove(sid);
    }

    await this.repo.revokeAllSessions(credentialsId);
    this.logger.log(`Service: All sessions terminated for user: ${credentialsId}`);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
