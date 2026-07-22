import { removeMessageFromPages, updateMessageInPages } from '@org/entities-message';

describe('message action cache helpers', () => {
  const old = {
    pageParams: [undefined],
    pages: [
      {
        nextCursor: null,
        messages: [
          {
            id: 'message-1',
            chatId: 'chat-1',
            text: 'before',
            updatedAt: '2026-07-22T00:00:00.000Z',
          },
          {
            id: 'message-2',
            chatId: 'chat-1',
            text: 'keep',
            updatedAt: '2026-07-22T00:00:00.000Z',
          },
        ],
      },
    ],
  };

  it('updates a message in infinite pages', () => {
    const next = updateMessageInPages(old, {
      id: 'message-1',
      chatId: 'chat-1',
      text: 'after',
      updatedAt: '2026-07-22T00:01:00.000Z',
    });

    expect(next?.pages[0].messages[0]).toMatchObject({ id: 'message-1', text: 'after' });
  });

  it('removes a message from infinite pages', () => {
    const next = removeMessageFromPages(old, 'message-1');

    expect(next?.pages[0].messages.map((message) => message.id)).toEqual(['message-2']);
  });
});
