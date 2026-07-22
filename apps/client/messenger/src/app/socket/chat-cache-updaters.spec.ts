import {
  appendMessageToPages,
  markMessageSendError,
  removeMessageFromPages,
  updateChatListLastMessage,
  updateMessageInPages,
  upsertMessageIntoPages,
} from './chat-cache-updaters';

describe('chat socket cache updaters', () => {
  const msg = {
    id: 'message-2',
    clientId: null,
    chatId: 'chat-2',
    createdAt: '2026-07-14T10:00:00.000Z',
  };

  it('appends an incoming message to the first message page once', () => {
    const page = {
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

    const next = upsertMessageIntoPages({ pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'server-message-1',
      clientId: 'client-1',
      localStatus: 'sent',
    }));
  });

  it('replaces an optimistic text message when the server echo loses clientId', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      fileId: null,
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
      fileId: null,
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'server-message-1',
      clientId: 'client-1',
      localStatus: 'sent',
    }));
  });

  it('replaces an optimistic file message when the server echo loses clientId', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'VIDEO',
      text: null,
      fileId: 'file-1',
      fileCategory: 'VIDEO',
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
      fileId: 'file-1',
      fileCategory: 'VIDEO',
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'server-message-1',
      clientId: 'client-1',
      localStatus: 'sent',
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

    const next = markMessageSendError({ pages: [{ messages: [optimistic] }] }, 'client-1');

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

  it('updates existing messages from socket edits', () => {
    const page = {
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

  it('removes deleted and hidden messages from pages', () => {
    const page = {
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

    expect(next?.pages[0].messages.map((message) => message.id)).toEqual(['message-2']);
  });
});
