import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  EncryptionService,
  RedisService,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  VERIFICATION_SERVICE_TOKEN,
} from '@org/core';
import { AUTH_SERVICE_TOKEN } from '@org/core';

import { AuthService } from './auth.service';

const mockRepo = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  createCredentials: jest.fn(),
  verifyCredentials: jest.fn(),
  revokeAllRefreshTokens: jest.fn(),
  saveRefreshToken: jest.fn(),
  findRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  updatePasswordHash: jest.fn(),
  findOAuthAccount: jest.fn(),
  createOAuthAccount: jest.fn(),
  deleteUnverifiedOlderThan: jest.fn(),
};

const mockEncryption = {
  hash: jest.fn(),
  compare: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
};

const mockVerification = {
  generateAndSend: jest.fn(),
  verify: jest.fn(),
  resend: jest.fn(),
  generatePasswordReset: jest.fn(),
  consumePasswordResetToken: jest.fn(),
};

const mockUserClient = {
  emit: jest.fn(),
  send: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
    if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
    return undefined;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        { provide: AUTH_SERVICE_TOKEN, useClass: AuthService },
        { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useValue: mockRepo },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: TokenService, useValue: mockTokenService },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: VERIFICATION_SERVICE_TOKEN, useValue: mockVerification },
        { provide: USER_CLIENT_TOKEN, useValue: mockUserClient },
      ],
    }).compile();

    service = module.get<AuthService>(AUTH_SERVICE_TOKEN);
  });

  describe('register', () => {
    const dto = {
      email: 'test@example.com',
      password: 'Password1!',
      username: 'testuser',
    };

    const credentials = {
      id: 'cred-id',
      email: dto.email,
      role: 'USER' as const,
      isVerified: false,
      passwordHash: 'hashed',
    };

    it('creates credentials and emits REGISTERED event', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockEncryption.hash.mockResolvedValue('hashed');
      mockRepo.createCredentials.mockResolvedValue(credentials);
      mockVerification.generateAndSend.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockRepo.createCredentials).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed',
      });

      expect(mockUserClient.emit).toHaveBeenCalledWith(USER_EVENTS.REGISTERED, {
        id: credentials.id,
        email: credentials.email,
        name: dto.username,
      });
    });

    it('sends verification email after registration', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockEncryption.hash.mockResolvedValue('hashed');
      mockRepo.createCredentials.mockResolvedValue(credentials);
      mockVerification.generateAndSend.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockVerification.generateAndSend).toHaveBeenCalledWith(
        credentials.id,
        credentials.email,
      );
    });

    it('does not issue tokens on registration', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockEncryption.hash.mockResolvedValue('hashed');
      mockRepo.createCredentials.mockResolvedValue(credentials);
      mockVerification.generateAndSend.mockResolvedValue(undefined);

      const result = await service.register(dto);

      expect(result).toBeUndefined();
      expect(mockTokenService.generateAccessToken).not.toHaveBeenCalled();
      expect(mockTokenService.generateRefreshToken).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email is already registered', async () => {
      mockRepo.findByEmail.mockResolvedValue(credentials);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(mockRepo.createCredentials).not.toHaveBeenCalled();
      expect(mockUserClient.emit).not.toHaveBeenCalled();
      expect(mockVerification.generateAndSend).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    const email = 'user@example.com';
    const password = 'Password1!';
    const credentials = {
      id: 'cred-id',
      email,
      role: 'USER' as const,
      isVerified: true,
      passwordHash: 'hashed',
    };

    beforeEach(() => {
      mockRedis.incr.mockResolvedValue(1);
      mockRepo.findByEmail.mockResolvedValue(credentials);
      mockEncryption.compare.mockResolvedValue(true);
      mockRedis.del.mockResolvedValue(undefined);
    });

    it('returns CredentialsPayload on valid credentials', async () => {
      const result = await service.validateCredentials(email, password);

      expect(result).toEqual({
        id: credentials.id,
        role: credentials.role,
        isVerified: credentials.isVerified,
      });
    });

    it('clears the attempt counter on success', async () => {
      await service.validateCredentials(email, password);

      expect(mockRedis.del).toHaveBeenCalledWith(`login_attempts:${email}`);
    });

    it('throws UnauthorizedException when email is not found', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(service.validateCredentials(email, password)).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockEncryption.compare.mockResolvedValue(false);

      await expect(service.validateCredentials(email, password)).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when account is not verified', async () => {
      mockRepo.findByEmail.mockResolvedValue({ ...credentials, isVerified: false });

      await expect(service.validateCredentials(email, password)).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('throws 429 on the 6th attempt (limit is 5)', async () => {
      mockRedis.incr.mockResolvedValue(6);

      await expect(service.validateCredentials(email, password)).rejects.toThrow(
        expect.objectContaining({ status: 429 }),
      );
      // Should not even touch the DB when rate-limited
      expect(mockRepo.findByEmail).not.toHaveBeenCalled();
    });

    it('allows the 5th attempt (exactly at limit)', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await service.validateCredentials(email, password);

      expect(result.id).toBe(credentials.id);
    });

    it('increments attempt counter on every call', async () => {
      await service.validateCredentials(email, password);

      expect(mockRedis.incr).toHaveBeenCalledWith(`login_attempts:${email}`, 900);
    });
  });

  describe('login', () => {
    const credentials = {
      id: 'cred-id',
      email: 'user@example.com',
      role: 'USER' as const,
      isVerified: true,
      passwordHash: 'hashed',
    };

    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(credentials);
      mockTokenService.generateAccessToken.mockReturnValue('access-token');
      mockTokenService.generateRefreshToken.mockReturnValue('refresh-token');
      mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    });

    it('returns a TokenPair', async () => {
      const result = await service.login(credentials.id);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('saves the hashed refresh token to DB', async () => {
      await service.login(credentials.id);

      expect(mockRepo.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialsId: credentials.id,
          expiresAt: expect.any(Date) as Date,
          tokenHash: expect.any(String) as string,
        }),
      );
    });

    it('throws UnauthorizedException when credentials not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.login('unknown-id')).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });
  });

  describe('refresh', () => {
    const credentials = {
      id: 'cred-id',
      email: 'user@example.com',
      role: 'USER' as const,
      isVerified: true,
      passwordHash: 'hashed',
    };

    const jwtPayload = { sub: credentials.id, role: 'USER' as const, isVerified: true };

    const storedToken = {
      tokenHash: 'some-hash',
      credentialsId: credentials.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    beforeEach(() => {
      mockTokenService.verifyRefreshToken.mockReturnValue(jwtPayload);
      mockRepo.findRefreshToken.mockResolvedValue(storedToken);
      mockRepo.revokeRefreshToken.mockResolvedValue(undefined);
      mockRepo.findById.mockResolvedValue(credentials);
      mockTokenService.generateAccessToken.mockReturnValue('new-access-token');
      mockTokenService.generateRefreshToken.mockReturnValue('new-refresh-token');
      mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    });

    it('returns a new TokenPair on valid token', async () => {
      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('revokes the old token before issuing new one', async () => {
      await service.refresh('valid-refresh-token');

      expect(mockRepo.revokeRefreshToken).toHaveBeenCalledTimes(1);
      expect(mockRepo.saveRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException when JWT signature is invalid', async () => {
      mockTokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('throws UnauthorizedException when token hash is not in DB', async () => {
      mockRepo.findRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('throws UnauthorizedException when token is already revoked', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({ ...storedToken, revokedAt: new Date() });

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('throws UnauthorizedException when token is expired in DB', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        expect.objectContaining({ status: 401 }),
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({
        tokenHash: 'some-hash',
        credentialsId: 'cred-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockRepo.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout('valid-refresh-token');

      expect(mockRepo.revokeRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('does nothing when token is not found in DB', async () => {
      mockRepo.findRefreshToken.mockResolvedValue(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
      expect(mockRepo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('does nothing when token is already revoked', async () => {
      mockRepo.findRefreshToken.mockResolvedValue({
        tokenHash: 'some-hash',
        credentialsId: 'cred-id',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.logout('already-revoked-token')).resolves.toBeUndefined();
      expect(mockRepo.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('delegates to verification service', async () => {
      mockVerification.resend.mockResolvedValue(undefined);

      await service.resendVerification('test@example.com');

      expect(mockVerification.resend).toHaveBeenCalledWith('test@example.com');
    });
  });
});
