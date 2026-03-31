import { ConflictException } from '@nestjs/common';
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
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AUTH_SERVICE_TOKEN } from '@org/core';

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
        credentials.email
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

  describe('resendVerification', () => {
    it('delegates to verification service', async () => {
      mockVerification.resend.mockResolvedValue(undefined);

      await service.resendVerification('test@example.com');

      expect(mockVerification.resend).toHaveBeenCalledWith('test@example.com');
    });
  });
});
