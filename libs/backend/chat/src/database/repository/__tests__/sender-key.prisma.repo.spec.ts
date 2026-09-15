import type { PrismaService } from '../../prisma/prisma.service';
import { SenderKeyPrismaRepository } from '../sender-key.prisma.repo';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

const SHARE = {
  chatId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
  chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
  senderDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
  recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
  wrappedChainKey: 'd3JhcHBlZA==',
};

describe('SenderKeyPrismaRepository', () => {
  const senderKeyShare = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { senderKeyShare };
  const repository = new SenderKeyPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('upserts a share and clears revocation on re-distribute', async () => {
    senderKeyShare.upsert.mockResolvedValue({ ...SHARE, revoked: false });

    await expect(repository.upsertShare({ ...SHARE })).resolves.toMatchObject({
      ...SHARE,
      revoked: false,
    });
    expect(senderKeyShare.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId_chainKeyId_recipientDeviceId: {
            chatId: SHARE.chatId,
            chainKeyId: SHARE.chainKeyId,
            recipientDeviceId: SHARE.recipientDeviceId,
          },
        },
        update: expect.objectContaining({ revoked: false }),
      }),
    );
  });

  it('returns null for missing or revoked shares', async () => {
    senderKeyShare.findUnique.mockResolvedValueOnce(null);
    await expect(
      repository.findShare(SHARE.chatId, SHARE.chainKeyId, SHARE.recipientDeviceId),
    ).resolves.toBeNull();

    senderKeyShare.findUnique.mockResolvedValueOnce({ ...SHARE, revoked: true });
    await expect(
      repository.findShare(SHARE.chatId, SHARE.chainKeyId, SHARE.recipientDeviceId),
    ).resolves.toBeNull();

    senderKeyShare.findUnique.mockResolvedValueOnce({ ...SHARE, revoked: false });
    await expect(
      repository.findShare(SHARE.chatId, SHARE.chainKeyId, SHARE.recipientDeviceId),
    ).resolves.toMatchObject({ wrappedChainKey: SHARE.wrappedChainKey, revoked: false });
  });

  it('discovers the latest live chain for a sender', async () => {
    senderKeyShare.findFirst.mockResolvedValueOnce({ chainKeyId: SHARE.chainKeyId });
    await expect(repository.findLatestChainId(SHARE.chatId, SHARE.senderDeviceId)).resolves.toBe(
      SHARE.chainKeyId,
    );
    expect(senderKeyShare.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: SHARE.chatId, senderDeviceId: SHARE.senderDeviceId, revoked: false },
        orderBy: { createdAt: 'desc' },
      }),
    );

    senderKeyShare.findFirst.mockResolvedValueOnce(null);
    await expect(repository.findLatestChainId(SHARE.chatId, 'unknown')).resolves.toBeNull();
  });

  it('revokes shares for listed devices only and skips empty lists', async () => {
    senderKeyShare.updateMany.mockResolvedValue({ count: 1 });

    await repository.revokeShares(SHARE.chatId, [SHARE.recipientDeviceId]);
    expect(senderKeyShare.updateMany).toHaveBeenCalledWith({
      where: { chatId: SHARE.chatId, recipientDeviceId: { in: [SHARE.recipientDeviceId] } },
      data: { revoked: true },
    });

    await repository.revokeShares(SHARE.chatId, []);
    expect(senderKeyShare.updateMany).toHaveBeenCalledTimes(1);
  });
});
