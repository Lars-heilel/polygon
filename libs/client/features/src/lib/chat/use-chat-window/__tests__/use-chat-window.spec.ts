import { act, renderHook } from '@testing-library/react';

import { createWrapper } from '../../../../test/test-utils';
import { useChatWindow } from '../use-chat-window';

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseGetMessagesQuery = vi.hoisted(() => vi.fn());
const mockUseMeQuery = vi.hoisted(() => vi.fn());
const mockUseSendMessageMutation = vi.hoisted(() => vi.fn());

vi.mock('@org/entities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/entities')>();
  return {
    ...actual,
    useGetMessagesQuery: mockUseGetMessagesQuery,
    useMeQuery: mockUseMeQuery,
    useSendMessageMutation: mockUseSendMessageMutation,
  };
});

const messages = [{ id: 'msg-1', chatId: 'chat-1', text: 'Hello', createdAt: '', updatedAt: '' }];

describe('useChatWindow', () => {
  beforeEach(() => {
    mockUseGetMessagesQuery.mockReturnValue({ data: messages, isLoading: false });
    mockUseMeQuery.mockReturnValue({ data: { id: 'me-id' } });
    mockUseSendMessageMutation.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockMutate.mockClear();
  });

  it('returns messages from query', () => {
    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    expect(result.current.messages).toEqual(messages);
  });

  it('returns empty array when messages are undefined', () => {
    mockUseGetMessagesQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    expect(result.current.messages).toEqual([]);
  });

  it('returns currentUserId from me query', () => {
    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    expect(result.current.currentUserId).toBe('me-id');
  });

  it('handleSend does nothing when messageText is empty', () => {
    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.handleSend());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleSend does nothing when messageText is only whitespace', () => {
    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.setMessageText('   '));
    act(() => result.current.handleSend());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleSend does nothing when chatId is null', () => {
    const { result } = renderHook(() => useChatWindow(null), { wrapper: createWrapper() });

    act(() => result.current.setMessageText('Hello'));
    act(() => result.current.handleSend());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleSend calls mutation with trimmed text when chatId and text are set', () => {
    const { result } = renderHook(() => useChatWindow('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.setMessageText('  Hello  '));
    act(() => result.current.handleSend());

    expect(mockMutate).toHaveBeenCalledWith('Hello', expect.any(Object));
  });
});
