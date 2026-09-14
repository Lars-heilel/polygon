import type { PrismaService } from '../../prisma/prisma.service';
import { E2eeKeyPrismaRepository } from '../e2ee-key.prisma.repo';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('E2eeKeyPrismaRepository one-time prekey claim', () => {
  const device = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  };
  const oneTimePrekey = {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { device, oneTimePrekey };
  const repository = new E2eeKeyPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('claims distinct keys when two initiations race for the same prekey', async () => {
    const keyA = { id: BigInt(1), prekey: 'otp-A' };
    const keyB = { id: BigInt(2), prekey: 'otp-B' };
    oneTimePrekey.findFirst
      .mockResolvedValueOnce(keyA)
      .mockResolvedValueOnce(keyA)
      .mockResolvedValueOnce(keyB);
    oneTimePrekey.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const [first, second] = await Promise.all([
      repository.consumeOneTimePrekey('device-1'),
      repository.consumeOneTimePrekey('device-1'),
    ]);

    expect([first, second].sort()).toEqual(['otp-A', 'otp-B']);
    expect(oneTimePrekey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consumed: false }),
        data: { consumed: true },
      }),
    );
  });

  it('falls back to null for the loser when no keys remain', async () => {
    const keyA = { id: BigInt(1), prekey: 'otp-A' };
    oneTimePrekey.findFirst
      .mockResolvedValueOnce(keyA)
      .mockResolvedValueOnce(keyA)
      .mockResolvedValueOnce(null);
    oneTimePrekey.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([
      repository.consumeOneTimePrekey('device-1'),
      repository.consumeOneTimePrekey('device-1'),
    ]);

    expect([first, second].sort()).toEqual([null, 'otp-A']);
  });
});
