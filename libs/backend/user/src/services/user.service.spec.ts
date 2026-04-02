import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { UserService } from './user.service';

const mockRepo = {
  findById: jest.fn(),
  findPublicById: jest.fn(),
  exists: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
};

const user = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'testuser',
  displayName: null,
  avatarUrl: null,
  bio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publicUser = {
  id: 'user-1',
  name: 'testuser',
  displayName: null,
  avatarUrl: null,
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [UserService, { provide: USER_PRISMA_REPOSITORY_TOKEN, useValue: mockRepo }],
    }).compile();

    service = module.get(UserService);
  });

  // ── getById ───────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns user when found', async () => {
      mockRepo.findById.mockResolvedValue(user);

      const result = await service.getById('user-1');

      expect(result).toBe(user);
      expect(mockRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPublicById ─────────────────────────────────────────────────

  describe('getPublicById', () => {
    it('returns public user when found', async () => {
      mockRepo.findPublicById.mockResolvedValue(publicUser);

      const result = await service.getPublicById('user-1');

      expect(result).toBe(publicUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockRepo.findPublicById.mockResolvedValue(null);

      await expect(service.getPublicById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns user when user exists', async () => {
      const updated = { ...user, displayName: 'New Name' };
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update('user-1', { displayName: 'New Name' });

      expect(result).toBe(updated);
      expect(mockRepo.update).toHaveBeenCalledWith('user-1', { displayName: 'New Name' });
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockRepo.exists.mockResolvedValue(false);

      await expect(service.update('unknown', { displayName: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // ── createFromEvent ───────────────────────────────────────────────

  describe('createFromEvent', () => {
    it('delegates to repo.upsert', async () => {
      mockRepo.upsert.mockResolvedValue(undefined);

      await service.createFromEvent({ id: 'user-1', email: 'user@example.com', name: 'testuser' });

      expect(mockRepo.upsert).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'user@example.com',
        name: 'testuser',
      });
    });
  });
});
