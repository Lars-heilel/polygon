import {
  appendMessageToPages,
  markMessageSendError,
  removeMessageFromPages,
  updateChatListLastMessage,
  updateChatListUnreadCount,
  updateMessageInPages,
  upsertMessageIntoPages,
} from './chat-cache-updaters';

describe('chat socket cache updaters', () => {
  type ChatCacheItem = {
    id: string;
    updatedAt: string;
    lastMessage: { createdAt: string } | null;
    unreadCount: number;
  };

  const msg = {
    id: 'message-2',
    clientId: null,
    chatId: 'chat-2',
    createdAt: '2026-07-14T10:00:00.000Z',
  };

  it('appends an incoming message to the first message page once', () => {
    const page = {
      pageParams: [undefined],
      pages: [
        { messages: [{ id: 'message-1', clientId: null, chatId: 'chat-2', createdAt: '2026-07-14T09:00:00.000Z' }] },
      ],
    };

    const next = appendMessageToPages(page, msg);
    const duplicate = appendMessageToPages(next, msg);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(duplicate?.pages[0].messages).toHaveLength(2);
  });

  it('replaces an optimistic message by clientId without appending a duplicate', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending' as const,
    };
    const serverMessage = {
      id: 'server-message-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pageParams: [undefined], pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'server-message-1',
      clientId: 'client-1',
      localStatus: 'sent',
    }));
  });

  it('normalizes raw forwarded socket messages before inserting them', () => {
    const page = {
      pageParams: [undefined],
      pages: [{ messages: [] }],
    };
    const rawForwardedMessage = {
      id: 'message-forwarded',
      clientId: null,
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'forwarded copy',
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
      attachments: [],
      forwardContext: {
        messageId: 'message-forwarded',
        originalMessageId: 'source-message',
        originalChatId: 'source-chat',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'alice',
        originalAuthorDisplayNameSnapshot: 'Alice A.',
        originalMessageCreatedAt: '2026-07-21T10:15:00.000Z',
        originalMessageType: 'TEXT',
        originalTextPreview: 'source text',
        originalFileNamePreview: null,
        snapshotVersion: 1,
        createdAt: '2026-07-22T10:00:00.000Z',
      },
    };

    const next = upsertMessageIntoPages(page, rawForwardedMessage);

    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      forwardContext: expect.objectContaining({
        originalAuthor: expect.objectContaining({ displayNameSnapshot: 'Alice A.' }),
        preview: expect.objectContaining({ text: 'source text' }),
      }),
    }));
  });

  it('does NOT absorb foreign message with same text into pending', () => {
    const old = { pageParams: [undefined], pages: [{ messages: [{ id: 'client:k1', clientId: 'k1', chatId: 'c1', senderId: 'me', type: 'TEXT', text: 'hello', createdAt: 't0', localStatus: 'sending' as const }] }] };
    const foreign = { id: 'srv-9', clientId: null, chatId: 'c1', senderId: 'other', type: 'TEXT', text: 'hello', createdAt: 't1' };
    const next = upsertMessageIntoPages(old, foreign);
    expect(next?.pages[0].messages).toHaveLength(2);
    expect(next?.pages[0].messages[0].localStatus).toBe('sending');
  });

  it('does NOT absorb a server echo that lost clientId into pending (echo must carry clientId)', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      media: null,
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending' as const,
    };
    const serverMessage = {
      id: 'server-message-1',
      clientId: null,
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      media: null,
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pageParams: [undefined], pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      clientId: 'client-1',
      localStatus: 'sending',
    }));
  });

  it('does NOT absorb a file server echo that lost clientId into pending', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      media: null,
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending' as const,
    };
    const serverMessage = {
      id: 'server-message-1',
      clientId: null,
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      media: null,
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pageParams: [undefined], pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      clientId: 'client-1',
      localStatus: 'sending',
    }));
  });

  it('does NOT absorb a file server echo that lost clientId into pending', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'VIDEO',
      text: null,
      media: { fileId: 'file-1' },
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending' as const,
    };
    const serverMessage = {
      id: 'server-message-1',
      clientId: null,
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'VIDEO',
      text: null,
      media: { fileId: 'file-1' },
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pageParams: [undefined], pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      clientId: 'client-1',
      localStatus: 'sending',
    }));
  });

  it('marks a matching optimistic message as failed by clientId', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending' as const,
    };

    const next = markMessageSendError({ pageParams: [undefined], pages: [{ messages: [optimistic] }] }, 'client-1');

    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      clientId: 'client-1',
      localStatus: 'error',
    }));
  });

  it('updates lastMessage and sorts the changed chat by newest message time', () => {
    const chats = [
      {
        id: 'chat-1',
        updatedAt: '2026-07-14T09:30:00.000Z',
        lastMessage: { id: 'old-1', clientId: null, chatId: 'chat-1', createdAt: '2026-07-14T09:30:00.000Z' },
      },
      {
        id: 'chat-2',
        updatedAt: '2026-07-14T09:00:00.000Z',
        lastMessage: null,
      },
    ];

    const next = updateChatListLastMessage(chats, msg);

    expect(next[0].id).toBe('chat-2');
    expect(next[0].lastMessage).toBe(msg);
    expect(next[0]).not.toHaveProperty('messages');
  });

  it('does not roll back lastMessage on out-of-order event', () => {
    const chats = [
      {
        id: 'chat-1',
        updatedAt: '2026-09-07T09:00:00.000Z',
        lastMessage: { id: 'new-1', clientId: null, chatId: 'chat-1', createdAt: '2026-09-07T10:00:00.000Z' },
      },
    ];
    const stale = { id: 'old-1', clientId: null, chatId: 'chat-1', createdAt: '2026-09-07T09:00:00.000Z' };

    const next = updateChatListLastMessage(chats, stale);

    expect(next[0].lastMessage).toEqual(
      expect.objectContaining({ id: 'new-1', createdAt: '2026-09-07T10:00:00.000Z' }),
    );
  });

  it('replaces lastMessage when the incoming message is newer', () => {
    const chats = [
      {
        id: 'chat-1',
        updatedAt: '2026-09-07T09:00:00.000Z',
        lastMessage: { id: 'old-1', clientId: null, chatId: 'chat-1', createdAt: '2026-09-07T09:00:00.000Z' },
      },
    ];
    const fresh = { id: 'new-1', clientId: null, chatId: 'chat-1', createdAt: '2026-09-07T10:00:00.000Z' };

    const next = updateChatListLastMessage(chats, fresh);

    expect(next[0].lastMessage).toEqual(expect.objectContaining({ id: 'new-1' }));
  });

  it('optimistically increments unread count for the changed chat', () => {
    const chats: ChatCacheItem[] = [
      {
        id: 'chat-1',
        updatedAt: '2026-07-14T09:30:00.000Z',
        lastMessage: null,
        unreadCount: 2,
      },
      {
        id: 'chat-2',
        updatedAt: '2026-07-14T09:00:00.000Z',
        lastMessage: null,
        unreadCount: 0,
      },
    ];

    const next = updateChatListUnreadCount(chats, 'chat-1', 1);

    expect(next.find((chat) => chat.id === 'chat-1')?.unreadCount).toBe(3);
    expect(next.find((chat) => chat.id === 'chat-2')?.unreadCount).toBe(0);
  });

  it('updates existing messages from socket edits', () => {
    const page = {
      pageParams: [undefined],
      pages: [
        {
          messages: [
            { id: 'message-1', clientId: null, chatId: 'chat-1', createdAt: '2026-07-22T10:00:00.000Z', text: 'before' },
            { id: 'message-2', clientId: null, chatId: 'chat-1', createdAt: '2026-07-22T10:01:00.000Z', text: 'keep' },
          ],
        },
      ],
    };

    const next = updateMessageInPages(page, {
      id: 'message-1',
      chatId: 'chat-1',
      createdAt: '2026-07-22T10:00:00.000Z',
      text: 'edited',
    });

    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({ text: 'edited' }));
    expect(next?.pages[0].messages[1]).toEqual(expect.objectContaining({ text: 'keep' }));
  });

  it('normalizes raw forwarded socket messages before updating them', () => {
    const page = {
      pageParams: [undefined],
      pages: [
        {
          messages: [
            {
              id: 'message-1',
              clientId: null,
              chatId: 'chat-1',
              createdAt: '2026-07-22T10:00:00.000Z',
              text: 'before',
            },
          ],
        },
      ],
    };

    const next = updateMessageInPages(page, {
      id: 'message-1',
      clientId: null,
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'edited forwarded copy',
      editedAt: '2026-07-22T10:10:00.000Z',
      deletedAt: null,
      deletedById: null,
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:10:00.000Z',
      attachments: [],
      forwardContext: {
        messageId: 'message-1',
        originalMessageId: 'source-message',
        originalChatId: 'source-chat',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'alice',
        originalAuthorDisplayNameSnapshot: 'Alice A.',
        originalMessageCreatedAt: '2026-07-21T10:15:00.000Z',
        originalMessageType: 'TEXT',
        originalTextPreview: 'source text',
        originalFileNamePreview: null,
        snapshotVersion: 1,
        createdAt: '2026-07-22T10:00:00.000Z',
      },
    });

    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      text: 'edited forwarded copy',
      forwardContext: expect.objectContaining({
        originalAuthor: expect.objectContaining({ displayNameSnapshot: 'Alice A.' }),
        preview: expect.objectContaining({ text: 'source text' }),
      }),
    }));
  });

  it('removes deleted and hidden messages from pages', () => {
    const page = {
      pageParams: [undefined],
      pages: [
        {
          messages: [
            { id: 'message-1', clientId: null, chatId: 'chat-1', createdAt: '2026-07-22T10:00:00.000Z' },
            { id: 'message-2', clientId: null, chatId: 'chat-1', createdAt: '2026-07-22T10:01:00.000Z' },
          ],
        },
      ],
    };

    const next = removeMessageFromPages(page, 'message-1');

    expect(next?.pages[0].messages.map((message: { id: string }) => message.id)).toEqual(['message-2']);
  });
});
