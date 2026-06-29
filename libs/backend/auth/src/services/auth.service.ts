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
  import type {
    CredentialsPayload,
    OAuthLoginDto,
    SessionInfo,
    TokenPair,
    UserPublic,
  } from '@org/common';
  import {
    AUTH_CACHE_REPOSITORY_TOKEN,
    AUTH_PRISMA_REPOSITORY_TOKEN,
    SESSION_CACHE_REPOSITORY_TOKEN,
    EncryptionService,
    type Env,
    type JwtPayload,
    type ClientMetadata,
    SEARCH_CLIENT_TOKEN,
    TokenService,
    USER_CLIENT_TOKEN,
    USER_EVENTS,
    USER_PATTERNS,
    VERIFICATION_SERVICE_TOKEN,
  } from '@org/core';
  import { randomUUID, createHash } from 'crypto';
  import { lastValueFrom } from 'rxjs';

  import type { IAuthCacheRepository } from '../cache/auth.cache.interface';
  import type { ISessionCacheRepository } from '../cache/session.cache.interface';
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
      const existing = await this.repo.findByEmail(dto.email);
      if (existing) throw new ConflictException('Email already in use');

      const passwordHash = await this.encryption.hash(dto.password);
      const credentials = await this.repo.createCredentials({
        email: dto.email,
        passwordHash,
      });
      const userPayload = { id: credentials.id, email: credentials.email, name: dto.username };
      this.userClient.emit(USER_EVENTS.REGISTERED, userPayload);
      this.searchClient.emit(USER_EVENTS.REGISTERED, userPayload);

      try {
        await this.verification.generateAndSend(credentials.id, credentials.email);
      } catch (err) {
        this.logger.error(
          'Failed to send verification email',
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    async validateCredentials(email: string, password: string): Promise<CredentialsPayload> {
      const attempts = await this.cache.incrementLoginAttempts(email);
      if (attempts > AuthService.LOGIN_ATTEMPTS_LIMIT) {
        this.logger.warn({ email, attempts }, 'Login blocked — too many attempts');
        throw new HttpException(
          'Too many failed login attempts. Please try again in 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const credentials = await this.repo.findByEmail(email);
      if (!credentials || !credentials.passwordHash) {
        this.logger.warn({ email }, 'Login failed — email not found');
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await this.encryption.compare(password, credentials.passwordHash);
      if (!valid) {
        this.logger.warn({ email }, 'Login failed — wrong password');
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!credentials.isVerified) {
        this.logger.warn({ email }, 'Login blocked — email not verified');
        throw new UnauthorizedException('Please verify your email before signing in');
      }

      await this.cache.clearLoginAttempts(email);

      return {
        id: credentials.id,
        role: credentials.role,
        isVerified: credentials.isVerified,
      };
    }

    async login(id: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
      const credentials = await this.repo.findById(id);
      if (!credentials) throw new UnauthorizedException();

      const expiresAt = new Date(
        Date.now() + this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }) * 1000,
      );
      const ttlSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });

      const sessionId = randomUUID();

      const jwtPayload = {
        sub: credentials.id,
        role: credentials.role as JwtPayload['role'],
        isVerified: credentials.isVerified,
      };
      const tokens = this.tokenService.generateTokenPair(jwtPayload, sessionId);
      const tokenHash = this.hashToken(tokens.refreshToken);

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

      await this.sessionCache.save(sessionId, {
        credentialsId: credentials.id,
        device: clientMetadata?.device ?? 'Unknown',
        expiresAt: expiresAt.toISOString(),
      }, ttlSec);
      await this.sessionCache.addToUserSessions(credentials.id, sessionId);

      return tokens;
    }

    async verifyEmail(token: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
      const credentialsId = await this.verification.verify(token);
      const credentials = await this.repo.findById(credentialsId);
      if (!credentials) throw new UnauthorizedException();
      return this.login(credentials.id, clientMetadata);
    }

    async resendVerification(email: string): Promise<void> {
      await this.verification.resend(email);
    }

    async forgotPassword(email: string): Promise<void> {
      const credentials = await this.repo.findByEmail(email);
      if (!credentials || !credentials.passwordHash) return;
      await this.verification.generatePasswordReset(credentials.id, credentials.email);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
      const credentialsId = await this.verification.consumePasswordResetToken(token);
      const credentials = await this.repo.findById(credentialsId);
      if (!credentials) throw new NotFoundException('User not found');

      const passwordHash = await this.encryption.hash(newPassword);
      await this.repo.updatePasswordHash(credentialsId, passwordHash);
      await this.revokeAllSessions(credentialsId);
    }

    async oauthLogin(dto: OAuthLoginDto, clientMetadata?: ClientMetadata): Promise<TokenPair> {
      const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);
      if (existing) return this.login(existing.credentials.id, clientMetadata);

      let credentials = await this.repo.findByEmail(dto.email);

      if (!credentials) {
        credentials = await this.repo.createCredentials({ email: dto.email });
        const payload = { id: credentials.id, email: credentials.email, name: dto.name };
        await lastValueFrom(this.userClient.send<UserPublic>(USER_PATTERNS.CREATE, payload));
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

      return this.login(credentials.id, clientMetadata);
    }

    async logout(refreshToken: string): Promise<void> {
      let payload: JwtPayload;
      try {
        payload = this.tokenService.verifyRefreshToken(refreshToken);
      } catch {
        return;
      }

      const tokenHash = this.hashToken(refreshToken);
      await this.repo.revokeSession(tokenHash);
      await this.sessionCache.remove(payload.sessionId);
      await this.sessionCache.removeFromUserSessions(payload.sub, payload.sessionId);
    }

    async refresh(refreshToken: string): Promise<TokenPair> {
      let payload: JwtPayload;
      try {
        payload = this.tokenService.verifyRefreshToken(refreshToken);
      } catch {
        throw new UnauthorizedException();
      }

      const tokenHash = this.hashToken(refreshToken);
      const stored = await this.repo.findSessionByTokenHash(tokenHash);
      if (!stored) throw new UnauthorizedException();

      if (stored.revokedAt) {
        await this.repo.revokeAllSessions(stored.credentialsId);
        throw new UnauthorizedException();
      }
      if (stored.expiresAt < new Date()) throw new UnauthorizedException();

      const jwtPayload = {
        sub: payload.sub,
        role: payload.role,
        isVerified: payload.isVerified,
      };
      const newTokens = this.tokenService.generateTokenPair(jwtPayload, stored.id);
      const newTokenHash = this.hashToken(newTokens.refreshToken);

      await this.repo.updateSessionTokenHash(stored.id, newTokenHash);

      const ttlSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });
      await this.sessionCache.save(stored.id, {
        credentialsId: stored.credentialsId,
        device: stored.device ?? 'Unknown',
        expiresAt: stored.expiresAt.toISOString(),
      }, ttlSec);
      await this.repo.updateSessionLastActive(stored.id);

      return newTokens;
    }

    async listSessions(credentialsId: string, currentSessionId: string): Promise<SessionInfo[]> {
      const sessions = await this.repo.findActiveSessions(credentialsId);
      return sessions.map((s) => ({
        id: s.id,
        device: s.device,
        os: s.os,
        browser: s.browser,
        ip: s.ip,
        country: s.country,
        isCurrent: s.id === currentSessionId,
        lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }));
    }

    async revokeSession(sessionId: string, credentialsId: string): Promise<void> {
      const session = await this.repo.findSessionById(sessionId);
      if (!session || session.credentialsId !== credentialsId) {
        throw new UnauthorizedException();
      }
      await this.repo.revokeSession(session.tokenHash);
      await this.sessionCache.remove(sessionId);
      await this.sessionCache.removeFromUserSessions(credentialsId, sessionId);
    }

    async revokeAllSessions(credentialsId: string): Promise<void> {
      const sessionIds = await this.sessionCache.getUserSessionIds(credentialsId);
      for (const sid of sessionIds) {
        await this.sessionCache.remove(sid);
      }
      await this.repo.revokeAllSessions(credentialsId);
    }

    private hashToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }
  }
