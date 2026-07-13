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
import type { CredentialsPayload, OAuthLoginDto, Role, TokenPair, UserPublic } from '@org/common';
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
import { AdminBanService } from '../admin/admin-ban.service';
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
    private readonly adminBans: AdminBanService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    this.logger.log('Service: Initiating registration');

    const { password: _password, ...safeDto } = dto;
    this.logger.debug(
      { hasEmail: !!safeDto.email, hasUsername: !!safeDto.username },
      'Service: Register DTO state',
    );

    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      this.logger.warn('Service: Registration failed. Email already in use');
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.encryption.hash(dto.password);
    const credentials = await this.repo.createCredentials({
      email: dto.email,
      passwordHash,
    });
    this.logger.verbose(
      { hasCredentialsId: !!credentials.id },
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
        'Service: Failed to send verification email',
        err instanceof Error ? err.stack : String(err),
      );
    }
    this.logger.log('Service: Registration completed successfully');
  }

  async getRoleById(id: string): Promise<Role> {
    const credentials = await this.repo.findById(id);
    if (!credentials) {
      this.logger.warn(`Service: Role lookup failed. User ID not found: ${id}`);
      throw new NotFoundException('User not found');
    }

    return credentials.role as Role;
  }

  async validateCredentials(email: string, password: string): Promise<CredentialsPayload> {
    this.logger.log('Service: Validating credentials');

    const credentials = await this.repo.findByEmail(email);
    if (credentials) await this.adminBans.assertAccountActive(credentials.id);

    const attempts = await this.cache.incrementLoginAttempts(email);
    this.logger.debug({ attempts }, 'Service: Login attempts counter incremented');

    if (attempts >= AuthService.LOGIN_ATTEMPTS_LIMIT) {
      this.logger.warn('Service: Login blocked due to rate-limiting');
      throw new HttpException(
        'Too many failed login attempts. Please try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!credentials?.passwordHash) {
      this.logger.warn('Service: Validation failed. Email not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.encryption.compare(password, credentials.passwordHash);
    if (!valid) {
      this.logger.warn('Service: Validation failed. Password mismatch');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!credentials.isVerified) {
      this.logger.warn('Service: Validation blocked. Email unverified');
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    await this.cache.clearLoginAttempts(email);
    this.logger.verbose('Service: Rate-limiting attempts cleared');

    return {
      id: credentials.id,
      role: credentials.role,
      isVerified: credentials.isVerified,
    };
  }

  async login(id: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log('Service: Establishing new session');

    this.logger.debug(
      { hasCredentialsId: !!id, clientMetadata: this.clientMetadataSummary(clientMetadata) },
      'Service: Initial session payload and metadata',
    );

    const credentials = await this.repo.findById(id);
    if (!credentials) {
      this.logger.error(`Service: Failed to establish session. User ID not found: ${id}`);
      throw new UnauthorizedException();
    }

    await this.adminBans.assertAccountActive(credentials.id);

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
      { hasSessionId: !!sessionId, tokenHashLength: tokenHash.length, refreshExpiresSec },
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
    this.logger.log('Service: Session successfully registered');

    return tokens;
  }

  async verifyEmail(token: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log('Service: Processing email verification transition state');
    this.logger.debug(
      { hasToken: !!token, clientMetadata: this.clientMetadataSummary(clientMetadata) },
      'Service: Verification token validation and metadata propagation',
    );

    const credentialsId = await this.verification.verify(token);
    this.logger.verbose(
      { hasCredentialsId: !!credentialsId },
      'Service: Verification token consumed successfully',
    );

    return this.login(credentialsId, clientMetadata);
  }

  async resendVerification(email: string): Promise<void> {
    this.logger.log('Service: Requesting verification email regeneration');
    await this.verification.resend(email);
    this.logger.log('Service: Resend operation successfully dispatched to verification manager');
  }

  async forgotPassword(email: string): Promise<void> {
    this.logger.log('Service: Processing forgot password request');

    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash) {
      this.logger.warn('Service: Forgot password aborted. Email is not registered or lacks password');
      return;
    }

    await this.verification.generatePasswordReset(credentials.id, credentials.email);
    this.logger.log('Service: Password reset request successfully dispatched');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.log('Service: Processing password reset consumption');

    const credentialsId = await this.verification.consumePasswordResetToken(token);
    this.logger.verbose(
      { hasCredentialsId: !!credentialsId },
      'Service: Verification token validated and consumed',
    );

    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) {
      this.logger.error('Service: User target not found during reset');
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.encryption.hash(newPassword);
    await this.repo.updatePasswordHash(credentialsId, passwordHash);
    this.logger.verbose(
      { hasCredentialsId: !!credentialsId },
      'Service: Database password hash updated',
    );

    this.logger.log('Service: Revoking all active sessions for credentials');
    await this.revokeAllSessions(credentialsId);
  }

  async oauthLogin(dto: OAuthLoginDto, clientMetadata?: ClientMetadata): Promise<TokenPair> {
    this.logger.log(`Service: Processing OAuth pipeline for provider: ${dto.provider}`);
    this.logger.debug(
      {
        provider: dto.provider,
        hasProviderId: !!dto.providerId,
        hasEmail: !!dto.email,
        hasName: !!dto.name,
        clientMetadata: this.clientMetadataSummary(clientMetadata),
      },
      'Service: OAuth dto parameters and metadata context',
    );

    const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);
    if (existing) {
      this.logger.verbose(
        { hasCredentialsId: !!existing.credentials.id },
        'Service: Existing OAuth link found in database',
      );
      return this.login(existing.credentials.id, clientMetadata);
    }

    this.logger.verbose(
      { hasEmail: !!dto.email },
      'Service: No existing OAuth link. Checking credentials mapping by email',
    );
    let credentials = await this.repo.findByEmail(dto.email);
    let isNewCredentials = false;

    if (!credentials) {
      this.logger.verbose(
        { hasEmail: !!dto.email },
        'Service: User does not exist. Creating new federated credentials record',
      );
      credentials = await this.repo.createCredentials({ email: dto.email });
      isNewCredentials = true;
    }

    await this.adminBans.assertAccountActive(credentials.id);

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
        { hasCredentialsId: !!credentials.id },
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
      this.logger.debug(this.errorDiagnostic(err), 'Service: Invalid token trace');
      return;
    }

    const tokenHash = this.hashToken(refreshToken);
    this.logger.debug(
      {
        hasSubject: !!payload.sub,
        hasSessionId: !!payload.sessionId,
        tokenHashLength: tokenHash.length,
      },
      'Service: Session parameters decrypted',
    );

    await this.repo.revokeSession(tokenHash);
    this.logger.verbose('Service: Session revoked in database (Prisma)');

    await this.sessionCache.remove(payload.sessionId);
    await this.sessionCache.removeFromUserSessions(payload.sub, payload.sessionId);
    this.logger.verbose('Service: Session revoked and cleaned up in cache (Redis)');

    this.logger.log('Service: Logout flow successfully executed');
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    this.logger.log('Service: Processing token refresh rotation');

    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (err) {
      this.logger.warn('Service: Refresh failed. Token is invalid or expired');
      this.logger.debug(this.errorDiagnostic(err), 'Service: Invalid refresh token signature context');
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findSessionByTokenHash(tokenHash);

    if (!stored) {
      this.logger.warn('Service: Refresh failed. Session record not found in database');
      throw new UnauthorizedException();
    }

    await this.adminBans.assertAccountActive(stored.credentialsId);

    if (stored.revokedAt) {
      this.logger.warn(
        'Service: Security warning. Revoked session reuse attempt. Revoking all sessions.',
      );
      await this.clearCachedSessions(stored.credentialsId);
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
    this.logger.log('Service: Token rotation successfully completed');

    return newTokens;
  }

  async listSessions(credentialsId: string, currentSessionId: string): Promise<SessionResponse[]> {
    this.logger.log('Service: Querying active sessions for credentials');

    const sessions = await this.repo.findActiveSessions(credentialsId);
    this.logger.debug(
      { hasCredentialsId: !!credentialsId, count: sessions.length },
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
    this.logger.log('Service: Revocation command received for session');

    const session = await this.repo.findSessionById(sessionId);
    if (!session || session.credentialsId !== credentialsId) {
      this.logger.warn(
        'Service: Unauthorized revocation attempt of session by user',
      );
      throw new UnauthorizedException();
    }

    await this.repo.revokeSession(session.tokenHash);
    this.logger.verbose('Service: Session revoked in database');

    await this.sessionCache.remove(sessionId);
    await this.sessionCache.removeFromUserSessions(credentialsId, sessionId);
    this.logger.verbose('Service: Session removed from cache layer');

    this.logger.log('Service: Session successfully revoked');
  }

  async revokeAllSessions(credentialsId: string, currentSessionId?: string): Promise<void> {
    this.logger.log('Service: Executing session revocation for user');

    if (currentSessionId) {
      const sessions = await this.repo.findActiveSessions(credentialsId);
      const otherSessions = sessions.filter((session) => session.id !== currentSessionId);
      this.logger.debug(
        { hasCredentialsId: !!credentialsId, otherSessionCount: otherSessions.length },
        'Service: Other active sessions to revoke',
      );

      for (const session of otherSessions) {
        await this.repo.revokeSession(session.tokenHash);
      }

      await this.clearCachedSessions(credentialsId, currentSessionId);
      this.logger.log('Service: Other sessions terminated for user');
      return;
    }

    await this.clearCachedSessions(credentialsId);
    await this.repo.revokeAllSessions(credentialsId);
    this.logger.log('Service: All sessions terminated for user');
  }

  private async clearCachedSessions(credentialsId: string, preserveSessionId?: string): Promise<void> {
    const sessionIds = await this.sessionCache.getUserSessionIds(credentialsId);
    const sessionIdsToClear = preserveSessionId
      ? sessionIds.filter((sessionId) => sessionId !== preserveSessionId)
      : sessionIds;
    this.logger.debug(
      { hasCredentialsId: !!credentialsId, sessionCount: sessionIdsToClear.length },
      'Service: Cached sessions to clear',
    );

    for (const sid of sessionIdsToClear) {
      await this.sessionCache.remove(sid);
      await this.sessionCache.removeFromUserSessions(credentialsId, sid);
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private clientMetadataSummary(metadata?: Partial<ClientMetadata>) {
    return {
      hasIp: !!metadata?.ip,
      hasCountry: !!metadata?.country,
      hasOs: !!metadata?.os,
      hasBrowser: !!metadata?.browser,
      hasDevice: !!metadata?.device,
      hasUserAgent: !!metadata?.userAgent,
      hasLoginTime: !!metadata?.loginTime,
    };
  }

  private errorDiagnostic(error: unknown) {
    return {
      hasError: error !== undefined && error !== null,
      errorType: error instanceof Error ? error.name : typeof error,
    };
  }
}
