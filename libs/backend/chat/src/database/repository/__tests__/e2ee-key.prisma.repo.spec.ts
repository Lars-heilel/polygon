import type { PrismaService } from '../../prisma/prisma.service';
import { E2eeKeyPrismaRepository } from '../e2ee-key.prisma.repo';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('E2eeKeyPrismaRepository one-time prekey claim', () => {
  const device = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const signedPrekey = {
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
  const prisma = { device, signedPrekey, oneTimePrekey };
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

  it('persists signed prekeys through Prisma so a fresh instance still finds them', async () => {
    signedPrekey.findUnique.mockResolvedValue({
      deviceId: 'device-1',
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
    });

    const writer = new E2eeKeyPrismaRepository(prisma as unknown as PrismaService);
    await writer.saveSignedPrekey('device-1', 'c3Bn', 'c2ln');

    expect(signedPrekey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deviceId: 'device-1' },
        create: expect.objectContaining({ signedPrekey: 'c3Bn' }),
        update: expect.objectContaining({ signedPrekey: 'c3Bn' }),
      }),
    );

    // Restart-equivalent: a fresh repository instance over the same database
    // still returns the signed material (no process-local map involved).
    const reader = new E2eeKeyPrismaRepository(prisma as unknown as PrismaService);
    await expect(reader.findSignedPrekey('device-1')).resolves.toEqual({
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
    });
    expect(signedPrekey.findUnique).toHaveBeenCalledWith({ where: { deviceId: 'device-1' } });
  });

  it('lists devices for every member user id', async () => {
    const rows = [
      { deviceId: 'd-1', userId: 'u-1', identityKey: 'a2V5', registrationId: 1 },
      { deviceId: 'd-2', userId: 'u-2', identityKey: 'a2V5', registrationId: 2 },
    ];
    device.findMany.mockResolvedValue(rows);

    await expect(repository.findDevicesByUserIds(['u-1', 'u-2'])).resolves.toEqual(rows);
    expect(device.findMany).toHaveBeenCalledWith({ where: { userId: { in: ['u-1', 'u-2'] } } });
    await expect(repository.findDevicesByUserIds([])).resolves.toEqual([]);
  });
});
