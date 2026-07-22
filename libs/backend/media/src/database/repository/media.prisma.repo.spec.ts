import type { PrismaService } from '../prisma/prisma.service';

jest.mock('@org/core', () => ({
  handlePrismaError: (error: unknown) => {
    throw error;
  },
}));

import { MediaPrismaRepository } from './media.prisma.repo';

describe('MediaPrismaRepository', () => {
  const mediaReference = {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
  const prisma = {
    mediaReference,
    $transaction: jest.fn(),
  };
  const repository = new MediaPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('does not pass optional fileId into the reference owner compound selector', async () => {
    const reference = {
      id: 'reference-1',
      fileId: 'file-1',
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-1',
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
    };
    mediaReference.findUnique.mockResolvedValue(reference);
    mediaReference.deleteMany.mockResolvedValue({ count: 1 });

    await expect(repository.deleteReference({
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-1',
      fileId: 'file-1',
    })).resolves.toEqual(reference);

    expect(mediaReference.findUnique).toHaveBeenCalledWith({
      where: {
        ownerType_ownerId: {
          ownerType: 'MESSAGE_ATTACHMENT',
          ownerId: 'attachment-1',
        },
      },
    });
    expect(mediaReference.deleteMany).toHaveBeenCalledWith({
      where: { id: 'reference-1' },
    });
  });
});
