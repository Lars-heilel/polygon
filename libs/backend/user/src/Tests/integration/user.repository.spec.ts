import { Test } from '@nestjs/testing';
import { CoreConfigModule, USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { PrismaService, UserPrismaRepository } from '../../database';
import type { IUserRepository } from '../../interfaces/user.interface';
import { mockUserInput } from '../fixtures/user.fixtures';

describe('UserPrismaRepository (integration)', () => {
  let repo: IUserRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreConfigModule],
      providers: [
        PrismaService,
        { provide: USER_PRISMA_REPOSITORY_TOKEN, useClass: UserPrismaRepository },
      ],
    }).compile();

    prisma = module.get(PrismaService);
    repo = module.get(USER_PRISMA_REPOSITORY_TOKEN);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  describe('upsert', () => {
    it('creates a new user', async () => {
      await repo.upsert(mockUserInput);

      const user = await repo.findById(mockUserInput.id);
      expect(user).not.toBeNull();
      expect(user!.name).toBe(mockUserInput.name);
      expect(user!.email).toBe(mockUserInput.email);
    });

    it('is idempotent — repeated call does not duplicate the record', async () => {
      await repo.upsert(mockUserInput);
      await repo.upsert(mockUserInput);
      const user = await repo.findById(mockUserInput.id);
      expect(user).not.toBeNull();
      expect(user!.id).toBe(mockUserInput.id);
    });
  });
  describe('findById', () => {
    it('returns null when user does not exist', async () => {
      const result = await repo.findById(mockUserInput.id);
      expect(result).toBeNull();
    });

    it('returns full User with email and timestamps', async () => {
      await repo.upsert(mockUserInput);

      const result = await repo.findById(mockUserInput.id);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        id: mockUserInput.id,
        email: mockUserInput.email,
        name: mockUserInput.name,
        displayName: null,
        avatarUrl: null,
        bio: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('update', () => {
    it('throws when user does not exist', async () => {
      await expect(repo.update(mockUserInput.id, { displayName: 'Ghost' })).rejects.toThrow();
    });

    it('updates fields and returns updated User', async () => {
      await repo.upsert(mockUserInput);

      const result = await repo.update(mockUserInput.id, { displayName: 'Alice Updated' });

      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('Alice Updated');

      expect(result).not.toHaveProperty('email');
      expect(result!.name).toBe(mockUserInput.name);
    });
  });
});
