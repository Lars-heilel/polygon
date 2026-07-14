import { appendMessageToPages, updateChatListLastMessage } from './chat-cache-updaters';

describe('chat socket cache updaters', () => {
  const msg = {
    id: 'message-2',
    chatId: 'chat-2',
    createdAt: '2026-07-14T10:00:00.000Z',
  };

  it('appends an incoming message to the first message page once', () => {
    const page = {
      pages: [
        { messages: [{ id: 'message-1', chatId: 'chat-2', createdAt: '2026-07-14T09:00:00.000Z' }] },
      ],
    };

    const next = appendMessageToPages(page, msg);
    const duplicate = appendMessageToPages(next, msg);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(duplicate?.pages[0].messages).toHaveLength(2);
  });

  it('updates lastMessage and sorts the changed chat by newest message time', () => {
    const chats = [
      {
        id: 'chat-1',
        updatedAt: '2026-07-14T09:30:00.000Z',
        lastMessage: { id: 'old-1', chatId: 'chat-1', createdAt: '2026-07-14T09:30:00.000Z' },
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
});
