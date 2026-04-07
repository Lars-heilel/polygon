import { Test } from '@nestjs/testing';
import { CoreConfigModule, USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { PrismaService, UserPrismaRepository } from '../../database';
import type { IUserRepository } from '../../interfaces/user.interface';
import { mockUserInput, mockUserInput2 } from '../fixtures/user.fixtures';

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

  // Каждый тест начинается с чистой таблицы — тесты не зависят друг от друга
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  // ─────────────────────────────────────────────
  // upsert — создаёт пользователя из события регистрации
  // ─────────────────────────────────────────────
  describe('upsert', () => {
    it('creates a new user', async () => {
      await repo.upsert(mockUserInput);

      // upsert возвращает void — проверяем через round-trip: записали → прочитали
      const user = await repo.findById(mockUserInput.id);
      expect(user).not.toBeNull();
      expect(user!.name).toBe(mockUserInput.name);
      expect(user!.email).toBe(mockUserInput.email);
    });

    it('is idempotent — repeated call does not duplicate the record', async () => {
      await repo.upsert(mockUserInput);
      // Второй вызов с теми же данными не должен падать и не должен дублировать
      await repo.upsert(mockUserInput);

      const all = await repo.findAllPublic();
      // Ровно одна запись несмотря на два вызова
      expect(all.filter((u) => u.id === mockUserInput.id)).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // findById — полный User с email (сервер/внутренний)
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('returns null when user does not exist', async () => {
      const result = await repo.findById(mockUserInput.id);
      expect(result).toBeNull();
    });

    it('returns full User with email and timestamps', async () => {
      await repo.upsert(mockUserInput);

      const result = await repo.findById(mockUserInput.id);

      expect(result).not.toBeNull();
      // Полный User содержит email
      expect(result).toHaveProperty('email', mockUserInput.email);
      // И служебные поля
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  // ─────────────────────────────────────────────
  // findPublicById — UserPublic без email (для чужого профиля)
  // ─────────────────────────────────────────────
  describe('findPublicById', () => {
    it('returns null when user does not exist', async () => {
      const result = await repo.findPublicById(mockUserInput.id);
      expect(result).toBeNull();
    });

    it('returns UserPublic without email and timestamps', async () => {
      await repo.upsert(mockUserInput);

      const result = await repo.findPublicById(mockUserInput.id);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('id', mockUserInput.id);
      expect(result).toHaveProperty('name', mockUserInput.name);
      // email и timestamps НЕ должны утекать наружу
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  // ─────────────────────────────────────────────
  // findAllPublic — список всех публичных профилей
  // ─────────────────────────────────────────────
  describe('findAllPublic', () => {
    it('returns empty array when no users exist', async () => {
      const result = await repo.findAllPublic();
      expect(result).toEqual([]);
    });

    it('returns all users without email', async () => {
      await repo.upsert(mockUserInput);
      await repo.upsert(mockUserInput2);

      const result = await repo.findAllPublic();

      expect(result).toHaveLength(2);
      // Ни один элемент не должен содержать email
      result.forEach((u) => {
        expect(u).not.toHaveProperty('email');
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('name');
      });
    });
  });

  // ─────────────────────────────────────────────
  // update — обновляет поля профиля
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('returns null when user does not exist', async () => {
      // Не бросает исключение — возвращает null (Prisma P2025 поглощается в репо)
      const result = await repo.update(mockUserInput.id, { displayName: 'Ghost' });
      expect(result).toBeNull();
    });

    it('updates fields and returns updated User', async () => {
      await repo.upsert(mockUserInput);

      const result = await repo.update(mockUserInput.id, { displayName: 'Alice Updated' });

      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('Alice Updated');
      // Остальные поля не затронуты
      expect(result!.email).toBe(mockUserInput.email);
      expect(result!.name).toBe(mockUserInput.name);
    });
  });

  // ─────────────────────────────────────────────
  // delete — хард делит (временно, до реализации soft delete)
  // ─────────────────────────────────────────────
  describe('delete', () => {
    it('removes the user so findById returns null', async () => {
      await repo.upsert(mockUserInput);

      await repo.delete(mockUserInput.id);

      const result = await repo.findById(mockUserInput.id);
      expect(result).toBeNull();
    });
  });
});
