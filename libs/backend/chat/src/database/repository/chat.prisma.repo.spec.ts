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
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const messageDeletion = {
    upsert: jest.fn(),
  };
  type RepositoryPrismaMock = {
    chat: typeof chat;
    chatMember: typeof chatMember;
    message: typeof message;
    messageDeletion: typeof messageDeletion;
    $transaction: jest.Mock;
  };
  const transaction = jest.fn();
  const repositoryPrisma = {
    chat,
    chatMember,
    message,
    messageDeletion,
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

    await expect(repository.findMessagesByChat('chat-1', 'message-3', 2, 'user-1')).resolves.toEqual({
      messages: [older, newer],
      nextCursor: 'message-1',
    });

    expect(message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 'chat-1',
          deletedAt: null,
          deletions: { none: { userId: 'user-1' } },
        },
        cursor: { id: 'message-3' },
        skip: 1,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns persisted media messages with attachments from chat history', async () => {
    const createdAt = new Date('2026-07-22T10:00:00.000Z');
    const mediaMessage = {
      id: 'message-media',
      clientId: '44444444-4444-4444-8444-444444444444',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'IMAGE',
      text: null,
      attachments: [
        {
          id: 'attachment-1',
          messageId: 'message-media',
          mediaId: '55555555-5555-4555-8555-555555555555',
          fileNameSnapshot: 'image.png',
          fileSizeSnapshot: 4096,
          mimeSnapshot: 'image/png',
          category: 'IMAGE',
          createdAt,
        },
      ],
      forwardContext: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt,
      updatedAt: createdAt,
    };
    message.findMany.mockResolvedValue([mediaMessage]);

    await expect(repository.findMessagesByChat('chat-1', undefined, 50, 'user-1')).resolves.toEqual({
      messages: [mediaMessage],
      nextCursor: null,
    });

    expect(message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 'chat-1',
          deletedAt: null,
          deletions: { none: { userId: 'user-1' } },
        },
        select: expect.objectContaining({
          attachments: expect.any(Object),
        }),
      }),
    );
  });

  it('creates a message with attachments and forward context in one repository call', async () => {
    const createdAt = new Date('2026-07-22T10:00:00.000Z');
    const originalMessageCreatedAt = new Date('2026-07-22T09:00:00.000Z');
    const createdMessage = {
      id: 'message-1',
      chatId: 'target-chat',
      senderId: 'user-1',
      type: 'VOICE',
      text: null,
      attachments: [
        {
          id: 'attachment-1',
          messageId: 'message-1',
          mediaId: 'media-1',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
          createdAt,
        },
      ],
      forwardContext: {
        messageId: 'message-1',
        originalMessageId: 'source-message-1',
        originalChatId: 'source-chat',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'tamilka',
        originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        originalMessageCreatedAt,
        originalMessageType: 'VOICE',
        originalTextPreview: null,
        originalFileNamePreview: 'voice.ogg',
        snapshotVersion: 1,
        createdAt,
      },
    };
    message.create.mockResolvedValue(createdMessage);

    await expect(
      repository.createMessageWithRelations({
        chatId: 'target-chat',
        senderId: 'user-1',
        type: 'VOICE',
        text: null,
        attachments: [
          {
            mediaId: 'media-1',
            fileNameSnapshot: 'voice.ogg',
            fileSizeSnapshot: 33000,
            mimeSnapshot: 'audio/ogg',
            category: 'VOICE',
          },
        ],
        forwardContext: {
          originalMessageId: 'source-message-1',
          originalChatId: 'source-chat',
          originalAuthorId: 'author-1',
          originalAuthorNameSnapshot: 'tamilka',
          originalAuthorDisplayNameSnapshot: 'Тамилка:3',
          originalMessageCreatedAt,
          originalMessageType: 'VOICE',
          originalTextPreview: null,
          originalFileNamePreview: 'voice.ogg',
        },
      }),
    ).resolves.toEqual(createdMessage);

    expect(message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachments: {
            create: [
              {
                mediaId: 'media-1',
                fileNameSnapshot: 'voice.ogg',
                fileSizeSnapshot: 33000,
                mimeSnapshot: 'audio/ogg',
                category: 'VOICE',
              },
            ],
          },
          forwardContext: {
            create: {
              originalMessageId: 'source-message-1',
              originalChatId: 'source-chat',
              originalAuthorId: 'author-1',
              originalAuthorNameSnapshot: 'tamilka',
              originalAuthorDisplayNameSnapshot: 'Тамилка:3',
              originalMessageCreatedAt,
              originalMessageType: 'VOICE',
              originalTextPreview: null,
              originalFileNamePreview: 'voice.ogg',
            },
          },
        }),
        select: expect.objectContaining({
          attachments: expect.any(Object),
          forwardContext: expect.any(Object),
        }),
      }),
    );
  });

  it('updates message text and editedAt', async () => {
    message.update.mockResolvedValue({
      id: 'message-1',
      text: 'after',
      editedAt: new Date('2026-07-22T00:00:00.000Z'),
    });

    await expect(repository.updateMessageText('message-1', 'after')).resolves.toEqual(
      expect.objectContaining({ id: 'message-1', text: 'after' }),
    );

    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'message-1' },
        data: {
          text: 'after',
          editedAt: expect.any(Date),
        },
      }),
    );
  });

  it('marks a message globally deleted with actor metadata', async () => {
    message.update.mockResolvedValue({
      id: 'message-1',
      chatId: 'chat-1',
      deletedById: 'user-1',
      deletedAt: new Date('2026-07-22T00:00:00.000Z'),
    });

    await expect(repository.deleteMessageForEveryone('message-1', 'user-1')).resolves.toEqual(
      expect.objectContaining({ id: 'message-1', deletedById: 'user-1' }),
    );

    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'message-1' },
        data: {
          deletedAt: expect.any(Date),
          deletedById: 'user-1',
        },
      }),
    );
  });

  it('stores per-user hidden message state idempotently', async () => {    messageDeletion.upsert.mockResolvedValue({
      messageId: 'message-1',
      userId: 'user-1',
    });

    await expect(repository.hideMessageForUser('message-1', 'user-1')).resolves.toBeUndefined();

    expect(messageDeletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId_userId: { messageId: 'message-1', userId: 'user-1' } },
        create: { messageId: 'message-1', userId: 'user-1' },
        update: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('findMessageByClientId returns message by scoped clientId', async () => {
    message.findFirst.mockResolvedValue({ id: 'msg-1' });

    const found = await repository.findMessageByClientId('chat-1', 'c-1');

    expect(found?.id).toBe('msg-1');
    expect(message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { chatId: 'chat-1', clientId: 'c-1' } }),
    );
  });
});
