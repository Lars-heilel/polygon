import { renderHook } from '@testing-library/react';

const mockServerChats = [
  {
    id: 'chat-1',
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    members: [
      {
        chatId: 'chat-1',
        userId: 'me',
        role: 'MEMBER',
        joinedAt: '2026-07-14T10:00:00.000Z',
        lastReadMessageId: null,
        lastReadAt: null,
        profile: { id: 'me', name: 'Me', displayName: null, avatarUrl: null, bio: null },
      },
      {
        chatId: 'chat-1',
        userId: 'other',
        role: 'MEMBER',
        joinedAt: '2026-07-14T10:00:00.000Z',
        lastReadMessageId: null,
        lastReadAt: null,
        profile: { id: 'other', name: 'Other', displayName: null, avatarUrl: null, bio: null },
      },
    ],
    lastMessage: null,
    unreadCount: 3,
  },
];

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useSuspenseQuery: jest.fn(() => ({ data: mockServerChats })),
  };
});

describe('chat server unread integration', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('uses the server unread count before the local unread cache', () => {
    const { useChatList, useChatStore } =
      jest.requireActual<typeof import('@org/entities-chat')>('@org/entities-chat');
    useChatStore.getState().incrementUnread('chat-1');

    const { result } = renderHook(() => useChatList('me'));

    expect(result.current.chats[0]).toEqual(expect.objectContaining({ id: 'chat-1', unread: 3 }));
  });
});
