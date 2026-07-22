import { act, renderHook } from '@testing-library/react';
import type { InfiniteData } from '@tanstack/react-query';

import type { MessagePage } from '@org/entities-message';
import { useSendMessage } from '@org/features-send-message';
import { queryClient, socket } from '@org/shared';

describe('useSendMessage optimistic socket send', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('inserts an optimistic message with clientId before emitting the socket event', () => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1'], {
      pages: [{ messages: [], nextCursor: null }],
      pageParams: [undefined],
    });
    const emit = jest.spyOn(socket, 'emit');

    const { result } = renderHook(() => useSendMessage('chat-1', 'user-1'));

    act(() => {
      result.current.setMessageText('hello');
    });
    act(() => {
      result.current.handleSend();
    });

    const cached = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1']);
    expect(cached?.pages[0].messages).toHaveLength(1);
    expect(cached?.pages[0].messages[0]).toEqual(expect.objectContaining({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'hello',
      clientId: expect.any(String),
      localStatus: 'sending',
      kind: 'text',
    }));
    expect(emit).toHaveBeenCalledWith('message:send', expect.objectContaining({
      chatId: 'chat-1',
      text: 'hello',
      clientId: cached?.pages[0].messages[0].clientId,
    }));
  });
});
