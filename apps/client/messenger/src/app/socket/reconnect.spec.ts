import { renderHook } from '@testing-library/react';

import { chatApi, useChatStore } from '@org/entities-chat';
import { useChatSocket } from '@org/features-chat-socket';
import { queryClient, socket } from '@org/shared';

import { initSocketMiddleware, rejoinAllChats } from './socket-middleware';

describe('socket reconnect rejoin', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    useChatStore.getState().reset();
    jest.restoreAllMocks();
    jest.spyOn(socket, 'emit');
    jest.spyOn(socket, 'on');
    jest.spyOn(socket, 'off');
  });

  it('rejoins all chats on socket connect', () => {
    queryClient.setQueryData(['chats'], [{ id: 'c1' }, { id: 'c2' }]);
    useChatStore.getState().setActiveChat('c1');

    const cleanup = initSocketMiddleware();

    const onMock = socket.on as unknown as jest.Mock;
    const handler = onMock.mock.calls.find(([event]) => event === 'connect')?.[1] as
      | (() => void)
      | undefined;
    expect(handler).toBeDefined();

    handler?.();

    expect(socket.emit).toHaveBeenCalledWith('chat:join', { chatId: 'c1' });
    expect(socket.emit).toHaveBeenCalledWith('chat:join', { chatId: 'c2' });
    expect(socket.emit).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('rejoinAllChats emits nothing when there are no chats', () => {
    rejoinAllChats();

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('unsubscribes the connect listener on cleanup', () => {
    const cleanup = initSocketMiddleware();
    cleanup();

    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('re-emits chat:join for the active chat when the socket reconnects', () => {
    jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);

    const { unmount } = renderHook(() => useChatSocket('chat-9'));

    const onMock = socket.on as unknown as jest.Mock;
    const retry = onMock.mock.calls.find(
      ([event]) => event === 'connect',
    )?.[1] as (() => void) | undefined;
    expect(retry).toBeDefined();

    (socket.emit as unknown as jest.Mock).mockClear();
    retry?.();

    expect(socket.emit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-9' });

    unmount();
  });
});
