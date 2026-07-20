import type { PrismaService } from '../prisma/prisma.service';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

import { ChatPrismaRepository } from './chat.prisma.repo';

describe('ChatPrismaRepository', () => {
  const chat = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const chatMember = {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const message = {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  type RepositoryPrismaMock = {
    chat: typeof chat;
    chatMember: typeof chatMember;
    message: typeof message;
    $transaction: jest.Mock;
  };
  const transaction = jest.fn();
  const repositoryPrisma = {
    chat,
    chatMember,
    message,
    $transaction: transaction,
  } satisfies RepositoryPrismaMock;
  const repository = new ChatPrismaRepository(repositoryPrisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation(async (callback: (tx: RepositoryPrismaMock) => unknown) =>
      callback(repositoryPrisma),
    );
  });

  it('finds a self chat containing only the requested user', async () => {
    chat.findFirst.mockResolvedValue({ id: 'chat-self' });

    await expect(repository.findSelfChat('user-1')).resolves.toEqual({ id: 'chat-self' });

    expect(chat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'DIRECT',
          selfOwnerId: 'user-1',
          members: {
            some: { userId: 'user-1' },
            every: { userId: 'user-1' },
          },
        },
      }),
    );
  });

  it('creates a self chat and member in one transaction', async () => {
    chat.create.mockResolvedValue({ id: 'chat-self' });

    await expect(repository.createSelfChat('user-1')).resolves.toEqual({ id: 'chat-self' });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          type: 'DIRECT',
          name: 'Личное',
          selfOwnerId: 'user-1',
          members: { create: { userId: 'user-1' } },
        },
      }),
    );
  });

  it('recovers an existing self chat after a unique race without requiring a member lookup', async () => {
    chat.create.mockRejectedValue(new Error('Unique constraint failed'));
    chat.findUnique.mockResolvedValue({ id: 'chat-self' });

    await expect(repository.createSelfChat('user-1')).resolves.toEqual({ id: 'chat-self' });

    expect(chat.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { selfOwnerId: 'user-1' } }),
    );
  });

  it('exposes the unread count after the requesting member read marker', async () => {
    const lastReadAt = new Date('2026-07-14T10:00:00.000Z');
    chat.findMany.mockResolvedValue([
      {
        id: 'chat-1',
        members: [{ userId: 'user-1', lastReadAt, lastReadMessageId: 'message-1' }],
        messages: [],
      },
    ]);
    message.count.mockResolvedValue(2);

    await expect(repository.findChatsForUser('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'chat-1', lastMessage: null, unreadCount: 2 }),
    ]);

    expect(message.count).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: 'user-1' },
        OR: [
          { createdAt: { gt: lastReadAt } },
          { createdAt: lastReadAt, id: { gt: 'message-1' } },
        ],
      },
    });
  });

  it('exposes the unread count without a date filter when the requesting member has no read marker', async () => {
    chat.findMany.mockResolvedValue([
      {
        id: 'chat-1',
        members: [{ userId: 'user-1', lastReadAt: null, lastReadMessageId: null }],
        messages: [],
      },
    ]);
    message.count.mockResolvedValue(3);

    await expect(repository.findChatsForUser('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'chat-1', lastMessage: null, unreadCount: 3 }),
    ]);

    expect(message.count).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: 'user-1' },
      },
    });
  });

  it('counts unread messages from other members after the read marker with a deterministic tie-breaker', async () => {
    const lastReadAt = new Date('2026-07-14T10:00:00.000Z');
    message.count.mockResolvedValue(2);

    await expect(repository.countUnreadMessages('chat-1', 'user-1', lastReadAt, 'message-1')).resolves.toBe(2);

    expect(message.count).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: 'user-1' },
        OR: [
          { createdAt: { gt: lastReadAt } },
          { createdAt: lastReadAt, id: { gt: 'message-1' } },
        ],
      },
    });
  });

  it('persists the supplied message as the server read marker', async () => {
    const readAt = new Date('2026-07-14T10:01:00.000Z');
    message.findUnique.mockResolvedValue({ id: 'message-1', chatId: 'chat-1', createdAt: readAt });
    chatMember.findUnique.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-14T09:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    chatMember.updateMany.mockResolvedValue({ count: 1 });
    chatMember.findUnique.mockResolvedValue({ chatId: 'chat-1', userId: 'user-1' });

    await repository.markChatRead('chat-1', 'user-1', 'message-1');

    expect(message.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'message-1' } }),
    );
    expect(chatMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ chatId: 'chat-1', userId: 'user-1' }),
        data: { lastReadMessageId: 'message-1', lastReadAt: readAt },
      }),
    );
  });

  it('does not move the read marker backwards for delayed read requests', async () => {
    const currentReadAt = new Date('2026-07-14T10:02:00.000Z');
    message.findUnique.mockResolvedValue({
      id: 'message-1',
      chatId: 'chat-1',
      createdAt: new Date('2026-07-14T10:01:00.000Z'),
    });
    const currentMember = {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-14T09:00:00.000Z'),
      lastReadMessageId: 'message-2',
      lastReadAt: currentReadAt,
    };
    chatMember.findUnique.mockResolvedValue(currentMember);

    await expect(repository.markChatRead('chat-1', 'user-1', 'message-1')).resolves.toEqual(
      currentMember,
    );

    expect(chatMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chatId: 'chat-1',
          userId: 'user-1',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('rejects a read marker from another chat without updating the member', async () => {
    message.findUnique.mockResolvedValue({
      id: 'message-2',
      chatId: 'chat-2',
      createdAt: new Date('2026-07-14T10:01:00.000Z'),
    });

    await expect(repository.markChatRead('chat-1', 'user-1', 'message-2')).rejects.toThrow(
      'Message does not belong to chat',
    );

    expect(chatMember.updateMany).not.toHaveBeenCalled();
  });

  it('uses a stable cursor query and returns messages in chronological order', async () => {
    const newer = { id: 'message-2' };
    const older = { id: 'message-1' };
    message.findMany.mockResolvedValue([newer, older]);

    await expect(repository.findMessagesByChat('chat-1', 'message-3', 2)).resolves.toEqual({
      messages: [older, newer],
      nextCursor: 'message-1',
    });

    expect(message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: 'chat-1' },
        cursor: { id: 'message-3' },
        skip: 1,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
