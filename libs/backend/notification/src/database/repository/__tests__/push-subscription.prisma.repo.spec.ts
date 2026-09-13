jest.mock('@org/core', () => ({
  handlePrismaError: (error: unknown) => {
    throw error;
  },
}));

import type { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionPrismaRepository } from '../push-subscription.prisma.repo';

describe('PushSubscriptionPrismaRepository', () => {
  const pushSubscription = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const prisma = { pushSubscription };
  const repository = new PushSubscriptionPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('looks up endpoint with findUnique on the unique key', async () => {
    pushSubscription.findUnique.mockResolvedValue(null);
    await repository.findByEndpoint('https://push.example.test/a');
    expect(pushSubscription.findUnique).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
    });
    expect(pushSubscription.findFirst).toBeUndefined();
  });

  it('upserts on endpoint so redelivery never duplicates', async () => {
    const record = {
      id: 'sub-1',
      userId: 'user-1',
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
      createdAt: new Date('2026-09-13T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    };
    pushSubscription.upsert.mockResolvedValue(record);
    await expect(
      repository.upsertByEndpoint({
        userId: 'user-1',
        endpoint: 'https://push.example.test/a',
        p256dh: 'k',
        auth: 'a',
      }),
    ).resolves.toEqual(record);
    expect(pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
      update: { userId: 'user-1', p256dh: 'k', auth: 'a' },
      create: {
        userId: 'user-1',
        endpoint: 'https://push.example.test/a',
        p256dh: 'k',
        auth: 'a',
      },
    });
  });

  it('deletes by endpoint with a single deleteMany', async () => {
    pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    await repository.deleteByEndpoint('https://push.example.test/a');
    expect(pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
    });
  });
});
