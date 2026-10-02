import type { PrismaService } from '../../prisma/prisma.service';
import { ChatPrismaRepository } from '../chat.prisma.repo';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('countUnreadForChats', () => {
  it('batches unread counts in a single queryRaw', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ chatId: 'c1', unread: 3 }]) };
    const repo = new ChatPrismaRepository(prisma as never);
    const out = await repo.countUnreadForChats(
      [{ chatId: 'c1', lastReadAt: null, lastReadMessageId: null }],
      'u1',
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out).toEqual(new Map([['c1', 3]]));
  });

  it('defaults missing chats to 0', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repo = new ChatPrismaRepository(prisma as never);
    const out = await repo.countUnreadForChats(
      [{ chatId: 'c1', lastReadAt: null, lastReadMessageId: null }],
      'u1',
    );
    expect(out.get('c1')).toBe(0);
  });
});
