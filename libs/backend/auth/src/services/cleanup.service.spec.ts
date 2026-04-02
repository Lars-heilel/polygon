import { Test } from '@nestjs/testing';
import { AUTH_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { CleanupService } from './cleanup.service';

const mockRepo = {
  deleteUnverifiedOlderThan: jest.fn(),
};

describe('CleanupService', () => {
  let service: CleanupService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [CleanupService, { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useValue: mockRepo }],
    }).compile();

    service = module.get(CleanupService);
  });

  describe('deleteStaleUnverifiedCredentials', () => {
    it('calls repo with a cutoff 24h in the past', async () => {
      mockRepo.deleteUnverifiedOlderThan.mockResolvedValue(0);
      const before = Date.now();

      await service.deleteStaleUnverifiedCredentials();

      const after = Date.now();
      const cutoff: Date = mockRepo.deleteUnverifiedOlderThan.mock.calls[0][0];
      const cutoffMs = cutoff.getTime();

      expect(cutoffMs).toBeLessThanOrEqual(before - 24 * 60 * 60 * 1000);
      expect(cutoffMs).toBeGreaterThanOrEqual(after - 24 * 60 * 60 * 1000 - 100);
    });

    it('does not throw when no stale credentials exist', async () => {
      mockRepo.deleteUnverifiedOlderThan.mockResolvedValue(0);

      await expect(service.deleteStaleUnverifiedCredentials()).resolves.toBeUndefined();
    });

    it('does not throw when stale credentials are deleted', async () => {
      mockRepo.deleteUnverifiedOlderThan.mockResolvedValue(5);

      await expect(service.deleteStaleUnverifiedCredentials()).resolves.toBeUndefined();
    });
  });
});
