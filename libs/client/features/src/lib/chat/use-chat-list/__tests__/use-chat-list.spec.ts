import { act, renderHook } from '@testing-library/react';

import { createWrapper } from '../../../../test/test-utils';
import { useChatList } from '../use-chat-list';

const mockUseGetChatsQuery = vi.hoisted(() => vi.fn());
const mockUseMeQuery = vi.hoisted(() => vi.fn());

vi.mock('@org/entities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/entities')>();
  return {
    ...actual,
    useGetChatsQuery: mockUseGetChatsQuery,
    useMeQuery: mockUseMeQuery,
  };
});

const me = { id: 'me-id', email: 'me@example.com', name: 'Me' };

const chats = [
  {
    id: 'chat-1',
    name: null,
    members: [
      { userId: 'me-id', joinedAt: '' },
      { userId: 'other-id', joinedAt: '' },
    ],
    messages: [{ id: 'msg-1', text: 'Hello', createdAt: '2024-01-01T00:00:00Z', updatedAt: '' }],
  },
  {
    id: 'chat-2',
    name: 'Group',
    members: [{ userId: 'me-id', joinedAt: '' }],
    messages: [],
  },
];

describe('useChatList', () => {
  beforeEach(() => {
    mockUseGetChatsQuery.mockReturnValue({ data: chats, isLoading: false });
    mockUseMeQuery.mockReturnValue({ data: me });
  });

  it('returns mapped chats list', () => {
    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    expect(result.current.chats).toHaveLength(2);
    expect(result.current.chats[0]).toMatchObject({ id: 'chat-1', lastMessage: 'Hello' });
    expect(result.current.chats[1]).toMatchObject({ id: 'chat-2', lastMessage: 'No messages yet' });
  });

  it('excludes current user from member display name', () => {
    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    // chat-1 has two members; the "other" member should be shown, not "me-id"
    const chat1 = result.current.chats.find((c) => c.id === 'chat-1')!;
    expect(chat1.name).toBe('other-id'.slice(0, 8));
  });

  it('filters chats by searchQuery (case-insensitive)', async () => {
    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    act(() => result.current.setSearchQuery('Group'));

    expect(result.current.chats).toHaveLength(1);
    expect(result.current.chats[0].id).toBe('chat-2');
  });

  it('returns empty array when no chats match search', async () => {
    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    act(() => result.current.setSearchQuery('zzz-no-match'));

    expect(result.current.chats).toHaveLength(0);
  });

  it('returns isLoading=true while chats are loading', () => {
    mockUseGetChatsQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.chats).toHaveLength(0);
  });

  it('selectedChatId is null by default, setSelectedChatId updates it', () => {
    const { result } = renderHook(() => useChatList(), { wrapper: createWrapper() });

    expect(result.current.selectedChatId).toBeNull();

    act(() => result.current.setSelectedChatId('chat-1'));

    expect(result.current.selectedChatId).toBe('chat-1');
  });
});
