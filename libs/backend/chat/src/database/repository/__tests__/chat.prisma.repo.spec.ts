import type { PrismaService } from '../../prisma/prisma.service';
import { ChatPrismaRepository } from '../chat.prisma.repo';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('ChatPrismaRepository', () => {
  const chat = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
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
    findMany: jest.fn(),
  };
  const messageEnvelope = {
    createMany: jest.fn(),
    findMany: jest.fn(),
  };
  type RepositoryPrismaMock = {
    chat: typeof chat;
    chatMember: typeof chatMember;
    message: typeof message;
    messageDeletion: typeof messageDeletion;
    messageEnvelope: typeof messageEnvelope;
    $transaction: jest.Mock;
  };
  const transaction = jest.fn();
  const repositoryPrisma = {
    chat,
    chatMember,
    message,
    messageDeletion,
    messageEnvelope,
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
          e2eeEnabled: true,
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
        members: [{ userId: 'user-1', lastReadAt, lastReadMessageId: '101' }],
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
        deletedAt: null,
        deletions: { none: { userId: 'user-1' } },
        OR: [{ createdAt: { gt: lastReadAt } }, { createdAt: lastReadAt, id: { gt: 101n } }],
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
        deletedAt: null,
        deletions: { none: { userId: 'user-1' } },
      },
    });
  });

  it('counts unread messages from other members after the read marker with a deterministic tie-breaker', async () => {
    const lastReadAt = new Date('2026-07-14T10:00:00.000Z');
    message.count.mockResolvedValue(2);

    await expect(
      repository.countUnreadMessages('chat-1', 'user-1', lastReadAt, '101'),
    ).resolves.toBe(2);

    expect(message.count).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: 'user-1' },
        deletedAt: null,
        deletions: { none: { userId: 'user-1' } },
        OR: [{ createdAt: { gt: lastReadAt } }, { createdAt: lastReadAt, id: { gt: 101n } }],
      },
    });
  });

  it('persists the supplied message as the server read marker', async () => {
    const readAt = new Date('2026-07-14T10:01:00.000Z');
    message.findUnique.mockResolvedValue({ id: 101n, chatId: 'chat-1', createdAt: readAt });
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

    await repository.markChatRead('chat-1', 'user-1', '101');

    expect(message.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 101n } }),
    );
    expect(chatMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ chatId: 'chat-1', userId: 'user-1' }),
        data: { lastReadMessageId: 101n, lastReadAt: readAt },
      }),
    );
  });

  it('does not move the read marker backwards for delayed read requests', async () => {
    const currentReadAt = new Date('2026-07-14T10:02:00.000Z');
    message.findUnique.mockResolvedValue({
      id: 101n,
      chatId: 'chat-1',
      createdAt: new Date('2026-07-14T10:01:00.000Z'),
    });
    const currentMember = {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-14T09:00:00.000Z'),
      lastReadMessageId: '102',
      lastReadAt: currentReadAt,
    };
    chatMember.findUnique.mockResolvedValue(currentMember);

    await expect(repository.markChatRead('chat-1', 'user-1', '101')).resolves.toEqual(
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
      id: 102n,
      chatId: 'chat-2',
      createdAt: new Date('2026-07-14T10:01:00.000Z'),
    });

    await expect(repository.markChatRead('chat-1', 'user-1', '102')).rejects.toThrow(
      'Message does not belong to chat',
    );

    expect(chatMember.updateMany).not.toHaveBeenCalled();
  });

  it('uses a stable cursor query and returns messages in chronological order', async () => {
    const newer = { id: 102n };
    const older = { id: 101n };
    message.findMany.mockResolvedValue([newer, older]);

    await expect(repository.findMessagesByChat('chat-1', '103', 2, 'user-1')).resolves.toEqual({
      messages: [{ id: '101' }, { id: '102' }],
      nextCursor: '101',
    });

    expect(message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 'chat-1',
          deletedAt: null,
          deletions: { none: { userId: 'user-1' } },
        },
        cursor: { id: 103n },
        skip: 1,
        take: 2,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('returns persisted media messages with attachments from chat history', async () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    const mediaMessage = {
      id: 104n,
      clientId: '44444444-4444-4444-8444-444444444444',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'IMAGE',
      text: null,
      attachments: [
        {
          id: 'attachment-1',
          messageId: 104n,
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

    await expect(repository.findMessagesByChat('chat-1', undefined, 50, 'user-1')).resolves.toEqual(
      {
        messages: [
          {
            ...mediaMessage,
            id: '104',
            attachments: [{ ...mediaMessage.attachments[0], messageId: '104' }],
          },
        ],
        nextCursor: null,
      },
    );

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
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    const originalMessageCreatedAt = new Date('2026-07-22T09:00:00.000Z');
    const createdMessage = {
      id: 105n,
      chatId: 'target-chat',
      senderId: 'user-1',
      type: 'VOICE',
      text: null,
      attachments: [
        {
          id: 'attachment-1',
          messageId: 105n,
          mediaId: 'media-1',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
          createdAt,
        },
      ],
      forwardContext: {
        messageId: 105n,
        originalMessageId: 106n,
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
          originalMessageId: '106',
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
    ).resolves.toEqual({
      ...createdMessage,
      id: '105',
      attachments: [{ ...createdMessage.attachments[0], messageId: '105' }],
      forwardContext: {
        ...createdMessage.forwardContext,
        messageId: '105',
        originalMessageId: '106',
      },
    });

    expect(message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachments: {
            create: [
              {
                mediaId: 'media-1',
                fileNameSnapshot: 'voice.ogg',
                fileSizeSnapshot: 33000n,
                mimeSnapshot: 'audio/ogg',
                category: 'VOICE',
              },
            ],
          },
          forwardContext: {
            create: {
              originalMessageId: 106n,
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
      id: 101n,
      text: 'after',
      editedAt: new Date('2026-07-22T00:00:00.000Z'),
    });

    await expect(repository.updateMessageText('101', 'after', false)).resolves.toEqual(
      expect.objectContaining({ id: '101', text: 'after' }),
    );

    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101n },
        data: {
          text: 'after',
          hasLink: false,
          editedAt: expect.any(Date),
        },
      }),
    );
  });

  it('marks a message globally deleted with actor metadata', async () => {
    message.update.mockResolvedValue({
      id: 101n,
      chatId: 'chat-1',
      deletedById: 'user-1',
      deletedAt: new Date('2026-07-22T00:00:00.000Z'),
    });

    await expect(repository.deleteMessageForEveryone('101', 'user-1')).resolves.toEqual(
      expect.objectContaining({ id: '101', deletedById: 'user-1' }),
    );

    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101n },
        data: {
          deletedAt: expect.any(Date),
          deletedById: 'user-1',
        },
      }),
    );
  });

  it('stores per-user hidden message state idempotently', async () => {
    messageDeletion.upsert.mockResolvedValue({
      messageId: 101n,
      userId: 'user-1',
    });

    await expect(repository.hideMessageForUser('101', 'user-1')).resolves.toBeUndefined();

    expect(messageDeletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId_userId: { messageId: 101n, userId: 'user-1' } },
        create: { messageId: 101n, userId: 'user-1' },
        update: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('creates a message and touches chat lastMessage plus sender lastRead in one transaction', async () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    message.create.mockResolvedValue({ id: 101n, chatId: 'chat-1', createdAt });
    chat.update.mockResolvedValue({ id: 'chat-1' });
    chatMember.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.createMessageWithTouch({
        chatId: 'chat-1',
        clientId: 'c-1',
        senderId: 'user-1',
        type: 'TEXT',
        text: 'hi',
        attachments: [],
      }),
    ).resolves.toEqual({ id: '101', chatId: 'chat-1', createdAt });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'chat-1' },
        data: { lastMessageId: 101n, lastMessageAt: createdAt, updatedAt: createdAt },
      }),
    );
    expect(chatMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: 'chat-1', userId: 'user-1' },
        data: { lastReadMessageId: 101n, lastReadAt: createdAt },
      }),
    );
  });

  it('touches chat lastMessage marker', async () => {
    const at = new Date('2026-07-22T00:00:00.000Z');
    chat.update.mockResolvedValue({ id: 'chat-1' });

    await expect(repository.touchChatLastMessage('chat-1', '101', at)).resolves.toBeUndefined();

    expect(chat.update).toHaveBeenCalledWith({
      where: { id: 'chat-1' },
      data: { lastMessageId: 101n, lastMessageAt: at, updatedAt: at },
    });
  });

  it('persists forwardContext and touches chat lastMessage on forward clone', async () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    message.create.mockResolvedValue({ id: 108n, chatId: 'target-chat', createdAt });
    chat.update.mockResolvedValue({ id: 'target-chat' });
    chatMember.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.createMessageWithTouch({
        chatId: 'target-chat',
        clientId: null,
        senderId: 'forwarder',
        type: 'TEXT',
        text: 'forwarded',
        attachments: [],
        forwardContext: {
          originalMessageId: '107',
          originalChatId: 'source-chat',
          originalAuthorId: 'author-1',
          originalAuthorNameSnapshot: 'Alice',
          originalAuthorDisplayNameSnapshot: null,
          originalMessageCreatedAt: createdAt,
          originalMessageType: 'TEXT',
          originalTextPreview: 'forwarded',
          originalFileNamePreview: null,
        },
      }),
    ).resolves.toEqual({ id: '108', chatId: 'target-chat', createdAt });

    expect(message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chatId: 'target-chat',
          forwardContext: expect.objectContaining({
            create: expect.objectContaining({
              originalMessageId: 107n,
              originalAuthorId: 'author-1',
            }),
          }),
        }),
      }),
    );
    expect(chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-chat' },
        data: { lastMessageId: 108n, lastMessageAt: createdAt, updatedAt: createdAt },
      }),
    );
  });

  it('findMessageByClientId returns message by scoped clientId', async () => {
    message.findFirst.mockResolvedValue({ id: 109n });

    const found = await repository.findMessageByClientId('chat-1', 'c-1');

    expect(found?.id).toBe('109');
    expect(message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { chatId: 'chat-1', clientId: 'c-1' } }),
    );
  });

  it('finds a direct chat by deterministic key', async () => {
    chat.findUnique.mockResolvedValue({ id: 'chat-1', directKey: 'direct:a:b' });

    await expect(repository.findDirectChatByKey('direct:a:b')).resolves.toEqual({
      id: 'chat-1',
      directKey: 'direct:a:b',
    });
    expect(chat.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { directKey: 'direct:a:b' } }),
    );
  });

  it('returns changed messages and deleted ids for delta sync', async () => {
    const since = new Date('2026-09-13T00:00:00.000Z');
    message.findMany.mockResolvedValue([{ id: 110n, updatedAt: since }]);
    messageDeletion.findMany.mockResolvedValue([{ messageId: 111n }]);

    await expect(
      repository.findMessagesDelta('chat-1', 'user-1', since, '109', 50),
    ).resolves.toEqual({ messages: [{ id: '110', updatedAt: since }], deletedIds: ['111'] });

    expect(message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ updatedAt: { gt: since } }, { updatedAt: since, id: { gt: 109n } }],
        }),
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    );
    expect(messageDeletion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', deletedAt: { gt: since } } }),
    );
  });

  it('persists envelope rows with BIGINT message ids', async () => {
    messageEnvelope.createMany.mockResolvedValue({ count: 2 });

    await repository.createMessageEnvelopes([
      { messageId: '101', recipientDeviceId: 'device-a', envelopeJson: '{"ciphertext":"eA=="}' },
      { messageId: '101', recipientDeviceId: 'device-b', envelopeJson: '{"ciphertext":"eA=="}' },
    ]);

    expect(messageEnvelope.createMany).toHaveBeenCalledWith({
      data: [
        {
          messageId: 101n,
          recipientDeviceId: 'device-a',
          envelopeJson: '{"ciphertext":"eA=="}',
        },
        {
          messageId: 101n,
          recipientDeviceId: 'device-b',
          envelopeJson: '{"ciphertext":"eA=="}',
        },
      ],
    });

    await repository.createMessageEnvelopes([]);
    expect(messageEnvelope.createMany).toHaveBeenCalledTimes(1);
  });

  it('reads envelopes for the requesting devices with string message ids', async () => {
    messageEnvelope.findMany.mockResolvedValue([
      { messageId: 101n, recipientDeviceId: 'device-a', envelopeJson: '{"ciphertext":"eA=="}' },
    ]);

    await expect(
      repository.findEnvelopesForMessages(['101', '102'], ['device-a']),
    ).resolves.toEqual([
      { messageId: '101', recipientDeviceId: 'device-a', envelopeJson: '{"ciphertext":"eA=="}' },
    ]);
    expect(messageEnvelope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId: { in: [101n, 102n] }, recipientDeviceId: { in: ['device-a'] } },
      }),
    );

    await expect(repository.findEnvelopesForMessages([], ['device-a'])).resolves.toEqual([]);
    await expect(repository.findEnvelopesForMessages(['101'], [])).resolves.toEqual([]);
    expect(messageEnvelope.findMany).toHaveBeenCalledTimes(1);
  });
});
