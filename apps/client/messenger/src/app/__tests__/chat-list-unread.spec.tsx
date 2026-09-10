import { renderHook } from '@testing-library/react';

function makeServerChat(unreadCount?: number) {
  return {
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
    ...(unreadCount === undefined ? {} : { unreadCount }),
  };
}

let mockServerChats: ReturnType<typeof makeServerChat>[] = [];

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useSuspenseQuery: jest.fn(() => ({ data: mockServerChats })),
  };
});

describe('chat list single-source unread', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockServerChats = [];
    const { useChatStore } =
      jest.requireActual<typeof import('@org/entities-chat')>('@org/entities-chat');
    useChatStore.getState().reset();
  });

  it('ignores local unreadByChatId when server count is 0', () => {
    mockServerChats = [makeServerChat(0)];
    const { useChatList, useChatStore } =
      jest.requireActual<typeof import('@org/entities-chat')>('@org/entities-chat');
    useChatStore.getState().incrementUnread('chat-1');
    useChatStore.getState().incrementUnread('chat-1');

    const { result } = renderHook(() => useChatList('me'));

    expect(result.current.chats[0]).toEqual(expect.objectContaining({ id: 'chat-1', unread: 0 }));
  });

  it('falls back to 0 (not local cache) when server count is missing', () => {
    mockServerChats = [makeServerChat(undefined)];
    const { useChatList, useChatStore } =
      jest.requireActual<typeof import('@org/entities-chat')>('@org/entities-chat');
    for (let i = 0; i < 5; i += 1) useChatStore.getState().incrementUnread('chat-1');

    const { result } = renderHook(() => useChatList('me'));

    expect(result.current.chats[0]).toEqual(expect.objectContaining({ id: 'chat-1', unread: 0 }));
  });
});
