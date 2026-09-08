import { act, renderHook, waitFor } from '@testing-library/react';

import { chatApi } from '@org/entities-chat';
import { useChatSocket } from '@org/features-chat-socket';
import { queryClient, socket } from '@org/shared';

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

describe('chat socket read state', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('marks the chat read on the server when joining a chat', async () => {
    const markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
    const emit = jest.spyOn(socket, 'emit');

    renderHook(() => useChatSocket('chat-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('chat-1'));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-1' }));
  });

  it('optimistically clears cached unread count when joining a chat', async () => {
    jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
    queryClient.setQueryData(['chats'], [
      {
        id: 'chat-1',
        unreadCount: 5,
      },
      {
        id: 'chat-2',
        unreadCount: 2,
      },
    ]);

    renderHook(() => useChatSocket('chat-1'));

    await waitFor(() => {
      expect(queryClient.getQueryData<Array<{ id: string; unreadCount: number }>>(['chats'])).toEqual([
        expect.objectContaining({ id: 'chat-1', unreadCount: 0 }),
        expect.objectContaining({ id: 'chat-2', unreadCount: 2 }),
      ]);
    });
  });

  it('marks the chat read when the tab becomes visible again', async () => {
    const markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
    setVisibilityState('visible');

    renderHook(() => useChatSocket('chat-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('chat-1'));
    markRead.mockClear();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('chat-1'));
  });

  it('debounces markRead for foreign messages arriving in the active chat', () => {
    jest.useFakeTimers();
    try {
      const markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
      const onSpy = jest.spyOn(socket, 'on');
      setVisibilityState('visible');
      queryClient.setQueryData(['me'], { id: 'me' });

      const { unmount } = renderHook(() => useChatSocket('chat-1'));
      expect(markRead).toHaveBeenCalledTimes(1);
      markRead.mockClear();

      const handler = onSpy.mock.calls.find(([event]) => event === 'message:new')?.[1] as
        | ((msg: { chatId: string; senderId: string; id: string }) => void)
        | undefined;
      expect(handler).toBeDefined();

      act(() => {
        handler?.({ chatId: 'chat-1', senderId: 'other', id: 'm-1' });
      });
      expect(markRead).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(markRead).toHaveBeenCalledTimes(1);
      expect(markRead).toHaveBeenLastCalledWith('chat-1');

      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores own messages and other chats in the debounced markRead', () => {
    jest.useFakeTimers();
    try {
      const markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
      const onSpy = jest.spyOn(socket, 'on');
      setVisibilityState('visible');
      queryClient.setQueryData(['me'], { id: 'me' });

      const { unmount } = renderHook(() => useChatSocket('chat-1'));
      markRead.mockClear();

      const handler = onSpy.mock.calls.find(([event]) => event === 'message:new')?.[1] as
        | ((msg: { chatId: string; senderId: string; id: string }) => void)
        | undefined;

      act(() => {
        handler?.({ chatId: 'chat-1', senderId: 'me', id: 'm-own' });
        handler?.({ chatId: 'chat-2', senderId: 'other', id: 'm-other-chat' });
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(markRead).not.toHaveBeenCalled();

      unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
