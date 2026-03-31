import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_EVENTS,
  RedisService,
} from '@org/core';
import { VerificationService } from './verification.service';

const mockRepo = {
  findByEmail: jest.fn(),
  verifyCredentials: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockNotificationClient = {
  emit: jest.fn(),
};

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useValue: mockRepo },
        { provide: RedisService, useValue: mockRedis },
        { provide: NOTIFICATION_CLIENT_TOKEN, useValue: mockNotificationClient },
      ],
    }).compile();

    service = module.get(VerificationService);
  });

  // ── generateAndSend ────────────────────────────────────────────────

  describe('generateAndSend', () => {
    it('stores token in Redis and emits notification event', async () => {
      mockRedis.set.mockResolvedValue(undefined);

      await service.generateAndSend('cred-id', 'user@example.com');

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockNotificationClient.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL,
        expect.objectContaining({ to: 'user@example.com', token: expect.any(String) })
      );
    });
  });

  // ── verify ─────────────────────────────────────────────────────────

  describe('verify', () => {
    it('marks credentials as verified, deletes Redis keys, returns credentialsId', async () => {
      mockRedis.get.mockResolvedValue('cred-id');
      mockRepo.verifyCredentials.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(undefined);

      const result = await service.verify('valid-token');

      expect(mockRepo.verifyCredentials).toHaveBeenCalledWith('cred-id');
      expect(mockRedis.del).toHaveBeenCalled();
      expect(result).toBe('cred-id');
    });

    it('throws BadRequestException on invalid or expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verify('bad-token')).rejects.toThrow(
        BadRequestException
      );

      expect(mockRepo.verifyCredentials).not.toHaveBeenCalled();
    });
  });

  // ── resend ─────────────────────────────────────────────────────────

  describe('resend', () => {
    const credentials = {
      id: 'cred-id',
      email: 'user@example.com',
      isVerified: false,
    };

    it('deletes old token, generates new one, sets cooldown', async () => {
      mockRepo.findByEmail.mockResolvedValue(credentials);
      mockRedis.get
        .mockResolvedValueOnce(null)   // cooldown key → not set
        .mockResolvedValueOnce('old-token'); // old token by id
      mockRedis.del.mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue(undefined);

      await service.resend('user@example.com');

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockNotificationClient.emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL,
        expect.objectContaining({ to: 'user@example.com' })
      );
      // cooldown key set
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('resend_cooldown'),
        expect.any(Number),
        '1'
      );
    });

    it('throws 429 when cooldown is active', async () => {
      mockRepo.findByEmail.mockResolvedValue(credentials);
      mockRedis.get.mockResolvedValueOnce('1'); // cooldown key exists

      await expect(service.resend('user@example.com')).rejects.toThrow(
        HttpException
      );

      expect(mockNotificationClient.emit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when email is not registered', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(service.resend('unknown@example.com')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws BadRequestException when account is already verified', async () => {
      mockRepo.findByEmail.mockResolvedValue({ ...credentials, isVerified: true });

      await expect(service.resend('user@example.com')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
