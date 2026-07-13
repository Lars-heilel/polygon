jest.mock('geoip-lite', () => ({ lookup: jest.fn() }));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';

import { EncryptionService, TokenService } from '@org/core';

import { AdminBanService } from '../admin/admin-ban.service';
import type { IAuthRepository, IVerificationService } from '../interfaces/auth.interface';
import { AuthService } from './auth.service';

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
    if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
    return undefined;
  }),
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
    if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
    throw new Error(`Missing config: ${key}`);
  }),
};

const mockCredentials = {
  id: 'creds-1',
  email: 'test@test.com',
  role: 'USER' as const,
  isVerified: true,
  passwordHash: 'hashed-password',
  lockedAt: null,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRefreshToken = 'valid-refresh-token';
const mockAccessToken = 'valid-access-token';

const mockSession = {
  id: 'session-1',
  tokenHash: 'hashed-refresh-token',
  credentialsId: 'creds-1',
  expiresAt: new Date(Date.now() + 604800000),
  revokedAt: null,
  lastActiveAt: null,
  ip: '127.0.0.1',
  country: 'Test Country',
  os: 'Linux',
  browser: 'Chrome',
  device: 'Desktop',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let repo: jest.Mocked<IAuthRepository>;
  let logger: {
    debug: jest.Mock;
    error: jest.Mock;
    log: jest.Mock;
    verbose: jest.Mock;
    warn: jest.Mock;
  };
  let sessionCache: jest.Mocked<{
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
    addToUserSessions: jest.Mock;
    getUserSessionIds: jest.Mock;
    removeFromUserSessions: jest.Mock;
    removeAllForUser: jest.Mock;
    exists: jest.Mock;
  }>;
  let tokenService: { generateTokenPair: jest.Mock; verifyRefreshToken: jest.Mock };
  let adminBans: { assertAccountActive: jest.Mock };
  let authCache: { incrementLoginAttempts: jest.Mock; clearLoginAttempts: jest.Mock };
  let encryption: { hash: jest.Mock; compare: jest.Mock };
  let verification: jest.Mocked<IVerificationService>;

  beforeEach(async () => {
    sessionCache = {
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      addToUserSessions: jest.fn(),
      getUserSessionIds: jest.fn().mockResolvedValue(['session-1', 'session-2']),
      removeFromUserSessions: jest.fn(),
      removeAllForUser: jest.fn(),
      exists: jest.fn(),
    };

    tokenService = {
      generateTokenPair: jest.fn().mockReturnValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      }),
      verifyRefreshToken: jest.fn().mockReturnValue({
        sub: 'creds-1',
        role: 'USER',
        isVerified: true,
        sessionId: 'session-1',
        jti: 'jti-1',
      }),
    };
    adminBans = { assertAccountActive: jest.fn() };
    authCache = {
      incrementLoginAttempts: jest.fn().mockResolvedValue(0),
      clearLoginAttempts: jest.fn(),
    };
    encryption = { hash: jest.fn(), compare: jest.fn().mockResolvedValue(true) };
    verification = {
      verify: jest.fn().mockResolvedValue('creds-1'),
      generateAndSend: jest.fn(),
      resend: jest.fn(),
      generatePasswordReset: jest.fn(),
      consumePasswordResetToken: jest.fn().mockResolvedValue('creds-1'),
    } as unknown as jest.Mocked<IVerificationService>;
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn(),
    };

    repo = {
      findById: jest.fn().mockResolvedValue(mockCredentials),
      findByEmail: jest.fn(),
      findSessionByTokenHash: jest.fn().mockResolvedValue(mockSession),
      findSessionById: jest.fn().mockResolvedValue(mockSession),
      findActiveSessions: jest.fn().mockResolvedValue([mockSession]),
      saveSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      updateSessionLastActive: jest.fn(),
      updateSessionTokenHash: jest.fn(),
      createCredentials: jest.fn(),
      updatePasswordHash: jest.fn(),
      findOAuthAccount: jest.fn(),
      createOAuthAccount: jest.fn(),
      verifyCredentials: jest.fn(),
      deleteUnverifiedOlderThan: jest.fn(),
    } as unknown as jest.Mocked<IAuthRepository>;

    (mockConfig.getOrThrow as jest.Mock).mockClear();
    (mockConfig.get as jest.Mock).mockClear();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AdminBanService, useValue: adminBans },
        {
          provide: 'AUTH_PRISMA_REPOSITORY_TOKEN',
          useValue: repo,
        },
        {
          provide: 'AUTH_CACHE_REPOSITORY_TOKEN',
          useValue: authCache,
        },
        {
          provide: 'SESSION_CACHE_REPOSITORY_TOKEN',
          useValue: sessionCache,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: EncryptionService,
          useValue: encryption,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: 'VERIFICATION_SERVICE_TOKEN',
          useValue: verification,
        },
        {
          provide: 'USER_CLIENT',
          useValue: { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() },
        },
        {
          provide: 'SEARCH_CLIENT',
          useValue: { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it.each([
    ['credential validation', async () => {
      repo.findByEmail.mockResolvedValue(mockCredentials);
      await service.validateCredentials(mockCredentials.email, 'password');
    }],
    ['login', async () => service.login('creds-1')],
    ['OAuth login', async () => {
      repo.findOAuthAccount.mockResolvedValue({ credentials: mockCredentials });
      await service.oauthLogin({
        provider: 'google',
        providerId: 'provider-1',
        email: mockCredentials.email,
        name: 'Test',
      });
    }],
    ['refresh', async () => service.refresh(mockRefreshToken)],
  ] as const)('normalizes/rejects bans on %s', async (_name, invoke) => {
    await invoke();
    expect(adminBans.assertAccountActive).toHaveBeenCalledWith('creds-1');
  });

  it('stops login before session creation when the account is actively banned', async () => {
    adminBans.assertAccountActive.mockRejectedValue(
      new Error('ACCOUNT_BANNED'),
    );
    await expect(service.login('creds-1')).rejects.toThrow('ACCOUNT_BANNED');
    expect(repo.saveSession).not.toHaveBeenCalled();
  });

  it('returns ACCOUNT_BANNED before 429 and password side effects for an over-limit banned account', async () => {
    repo.findByEmail.mockResolvedValue(mockCredentials);
    authCache.incrementLoginAttempts.mockResolvedValue(6);
    adminBans.assertAccountActive.mockRejectedValue(
      Object.assign(new Error('ACCOUNT_BANNED'), {
        response: { code: 'ACCOUNT_BANNED', reason: 'Spam', bannedUntil: null },
      }),
    );

    await expect(service.validateCredentials(mockCredentials.email, 'password')).rejects.toMatchObject({
      response: { code: 'ACCOUNT_BANNED', reason: 'Spam', bannedUntil: null },
    });
    expect(encryption.compare).not.toHaveBeenCalled();
  });

  it.each([
    ['non-banned', mockCredentials],
    ['unknown', null],
  ] as const)('preserves the 429 response for an over-limit %s account', async (_name, credentials) => {
    repo.findByEmail.mockResolvedValue(credentials);
    authCache.incrementLoginAttempts.mockResolvedValue(6);

    await expect(service.validateCredentials(mockCredentials.email, 'password')).rejects.toMatchObject({
      status: 429,
    });
    expect(authCache.incrementLoginAttempts).toHaveBeenCalledWith(mockCredentials.email);
    expect(encryption.compare).not.toHaveBeenCalled();
  });

  it('allows password validation on the fourth failed login attempt', async () => {
    repo.findByEmail.mockResolvedValue(mockCredentials);
    authCache.incrementLoginAttempts.mockResolvedValue(4);
    encryption.compare.mockResolvedValue(false);

    await expect(service.validateCredentials(mockCredentials.email, 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(encryption.compare).toHaveBeenCalledWith('wrong-password', mockCredentials.passwordHash);
  });

  it('rate limits on the fifth failed login attempt before password validation', async () => {
    repo.findByEmail.mockResolvedValue(mockCredentials);
    authCache.incrementLoginAttempts.mockResolvedValue(5);

    await expect(service.validateCredentials(mockCredentials.email, 'password')).rejects.toMatchObject({
      status: 429,
    });

    expect(encryption.compare).not.toHaveBeenCalled();
  });

  it('checks a linked-by-email OAuth account before creating the provider binding', async () => {
    repo.findOAuthAccount.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(mockCredentials);
    adminBans.assertAccountActive.mockRejectedValue(new Error('ACCOUNT_BANNED'));

    await expect(
      service.oauthLogin({
        provider: 'google',
        providerId: 'new-provider-id',
        email: mockCredentials.email,
        name: 'Test',
      }),
    ).rejects.toThrow('ACCOUNT_BANNED');
    expect(repo.createOAuthAccount).not.toHaveBeenCalled();
  });

  it('clears login attempts after a successful password reset', async () => {
    repo.findById.mockResolvedValue(mockCredentials);
    encryption.hash.mockResolvedValue('new-password-hash');

    await service.resetPassword('reset-token', 'new-password');

    expect(verification.consumePasswordResetToken).toHaveBeenCalledWith('reset-token');
    expect(repo.updatePasswordHash).toHaveBeenCalledWith('creds-1', 'new-password-hash');
    expect(authCache.clearLoginAttempts).toHaveBeenCalledWith(mockCredentials.email);
  });

  it('does not write OAuth email, provider id, or client metadata to diagnostic logs', async () => {
    repo.findOAuthAccount.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(mockCredentials);

    await service.oauthLogin(
      {
        provider: 'google',
        providerId: 'sensitive-provider-id',
        email: 'oauth-user@example.com',
        name: 'OAuth User',
      },
      {
        ip: '203.0.113.30',
        userAgent: 'OAuth Service User Agent',
        country: 'Secret Country',
        os: 'Linux',
        browser: 'Chrome',
        device: 'Desktop',
        loginTime: new Date().toISOString(),
      },
    );

    const logPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.verbose.mock.calls,
      logger.log.mock.calls,
    ]);
    expect(logPayload).not.toContain('oauth-user@example.com');
    expect(logPayload).not.toContain('sensitive-provider-id');
    expect(logPayload).not.toContain('203.0.113.30');
    expect(logPayload).not.toContain('OAuth Service User Agent');
    expect(logPayload).not.toContain('Secret Country');
  });

  describe('login', () => {
    it('creates a session and returns a token pair', async () => {
      const result = await service.login('creds-1', {
        ip: '127.0.0.1',
        country: 'Test Country',
        os: 'Linux',
        browser: 'Chrome',
        device: 'Desktop',
        userAgent: 'Mozilla/5.0',
        loginTime: new Date().toISOString(),
      });

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(repo.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialsId: 'creds-1',
          ip: '127.0.0.1',
          country: 'Test Country',
          os: 'Linux',
          browser: 'Chrome',
          device: 'Desktop',
        }),
      );
      expect(sessionCache.save).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentialsId: 'creds-1',
          device: 'Desktop',
        }),
        expect.any(Number),
      );
      expect(sessionCache.addToUserSessions).toHaveBeenCalledWith('creds-1', expect.any(String));
    });

    it('generates different jti for access and refresh tokens', async () => {
      tokenService.generateTokenPair = jest.fn().mockImplementation((_payload, sessionId) => {
        return {
          accessToken: `access-${sessionId}`,
          refreshToken: `refresh-${sessionId}`,
        };
      });

      const result = await service.login('creds-1');
      expect(result.accessToken).toContain('access-');
      expect(result.refreshToken).toContain('refresh-');
    });

    it('throws UnauthorizedException when credentials not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.login('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates tokens and keeps the same sessionId', async () => {
      const result = await service.refresh(mockRefreshToken);

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(repo.findSessionByTokenHash).toHaveBeenCalled();
      expect(repo.updateSessionTokenHash).toHaveBeenCalled();
      expect(repo.updateSessionLastActive).toHaveBeenCalled();
      expect(sessionCache.save).toHaveBeenCalled();
    });

    it('throws on invalid token', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('does not write raw invalid refresh token errors to diagnostic logs', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('jwt expired for token=refresh-secret user@example.com');
      });

      await expect(service.refresh('refresh-secret')).rejects.toThrow(UnauthorizedException);

      const logPayload = JSON.stringify([logger.debug.mock.calls, logger.warn.mock.calls]);
      expect(logPayload).not.toContain('refresh-secret');
      expect(logPayload).not.toContain('user@example.com');
      expect(logPayload).not.toContain('jwt expired for token');
      expect(logPayload).toContain('hasError');
    });

    it('throws on revoked session (replay attack)', async () => {
      repo.findSessionByTokenHash.mockResolvedValue({ ...mockSession, revokedAt: new Date() });
      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
      expect(repo.revokeAllSessions).toHaveBeenCalledWith('creds-1');
    });

    it('removes every cached session when a revoked refresh token is replayed', async () => {
      repo.findSessionByTokenHash.mockResolvedValue({ ...mockSession, revokedAt: new Date() });

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);

      expect(sessionCache.getUserSessionIds).toHaveBeenCalledWith('creds-1');
      expect(sessionCache.remove).toHaveBeenCalledWith('session-1');
      expect(sessionCache.remove).toHaveBeenCalledWith('session-2');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-1');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-2');
    });

    it('does not write raw credentials or session ids when a revoked refresh token is replayed', async () => {
      repo.findSessionByTokenHash.mockResolvedValue({ ...mockSession, revokedAt: new Date() });

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);

      const logPayload = JSON.stringify([
        logger.debug.mock.calls,
        logger.warn.mock.calls,
        logger.log.mock.calls,
      ]);
      expect(logPayload).not.toContain('creds-1');
      expect(logPayload).not.toContain('session-1');
      expect(logPayload).not.toContain('session-2');
    });

    it('throws on expired session', async () => {
      repo.findSessionByTokenHash.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when session not found in DB', async () => {
      repo.findSessionByTokenHash.mockResolvedValue(null);
      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the session and removes from Redis', async () => {
      await service.logout(mockRefreshToken);

      expect(repo.revokeSession).toHaveBeenCalled();
      expect(sessionCache.remove).toHaveBeenCalledWith('session-1');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-1');
    });

    it('does nothing on invalid token', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error();
      });
      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(repo.revokeSession).not.toHaveBeenCalled();
    });

    it('does not write raw invalid logout token errors to diagnostic logs', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('invalid logout token=logout-secret user@example.com');
      });

      await expect(service.logout('logout-secret')).resolves.toBeUndefined();

      const logPayload = JSON.stringify([logger.debug.mock.calls, logger.warn.mock.calls]);
      expect(logPayload).not.toContain('logout-secret');
      expect(logPayload).not.toContain('user@example.com');
      expect(logPayload).not.toContain('invalid logout token');
      expect(logPayload).toContain('hasError');
    });
  });

  it('does not write credentials or session ids in session-management logs', async () => {
    await service.logout(mockRefreshToken);
    await service.refresh(mockRefreshToken);
    await service.listSessions('creds-1', 'session-1');
    await service.revokeSession('session-1', 'creds-1');
    await service.revokeAllSessions('creds-1');

    const logPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.verbose.mock.calls,
      logger.warn.mock.calls,
      logger.log.mock.calls,
    ]);
    expect(logPayload).not.toContain('creds-1');
    expect(logPayload).not.toContain('session-1');
    expect(logPayload).not.toContain('session-2');
  });

  describe('listSessions', () => {
    it('returns active sessions with isCurrent flag', async () => {
      const result = await service.listSessions('creds-1', 'session-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
      expect(result[0].isCurrent).toBe(true);
      expect(result[0].device).toBe('Desktop');
      expect(result[0].browser).toBe('Chrome');
    });

    it('marks non-matching sessions as not current', async () => {
      const result = await service.listSessions('creds-1', 'other-session');
      expect(result[0].isCurrent).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('revokes the session if it belongs to the user', async () => {
      await service.revokeSession('session-1', 'creds-1');

      expect(repo.revokeSession).toHaveBeenCalledWith(mockSession.tokenHash);
      expect(sessionCache.remove).toHaveBeenCalledWith('session-1');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-1');
    });

    it('throws if session not found', async () => {
      repo.findSessionById.mockResolvedValue(null);
      await expect(service.revokeSession('nonexistent', 'creds-1')).rejects.toThrow(UnauthorizedException);
    });

    it('throws if session belongs to another user', async () => {
      repo.findSessionById.mockResolvedValue({ ...mockSession, credentialsId: 'other-user' });
      await expect(service.revokeSession('session-1', 'creds-1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeAllSessions', () => {
    it('removes all sessions from Redis and revokes in PG', async () => {
      await service.revokeAllSessions('creds-1');

      expect(sessionCache.getUserSessionIds).toHaveBeenCalledWith('creds-1');
      expect(sessionCache.remove).toHaveBeenCalledTimes(2);
      expect(sessionCache.remove).toHaveBeenCalledWith('session-1');
      expect(sessionCache.remove).toHaveBeenCalledWith('session-2');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-1');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-2');
      expect(repo.revokeAllSessions).toHaveBeenCalledWith('creds-1');
    });

    it('preserves the current session when revoking other sessions', async () => {
      repo.findActiveSessions.mockResolvedValue([
        mockSession,
        { ...mockSession, id: 'session-2', tokenHash: 'hashed-refresh-token-2' },
      ]);

      await service.revokeAllSessions('creds-1', 'session-1');

      expect(repo.revokeSession).toHaveBeenCalledWith('hashed-refresh-token-2');
      expect(repo.revokeAllSessions).not.toHaveBeenCalled();
      expect(sessionCache.remove).not.toHaveBeenCalledWith('session-1');
      expect(sessionCache.removeFromUserSessions).not.toHaveBeenCalledWith('creds-1', 'session-1');
      expect(sessionCache.remove).toHaveBeenCalledWith('session-2');
      expect(sessionCache.removeFromUserSessions).toHaveBeenCalledWith('creds-1', 'session-2');
    });
  });
});
