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

  it('keeps the text setter stable while typing in edit mode', () => {
    const { result } = renderHook(() => useSendMessage('chat-1', 'user-1'));
    const setMessageText = result.current.setMessageText;

    act(() => {
      result.current.setMessageText('old text');
    });

    expect(result.current.setMessageText).toBe(setMessageText);

    act(() => {
      result.current.setMessageText('new text');
    });

    expect(result.current.messageText).toBe('new text');
    expect(result.current.setMessageText).toBe(setMessageText);
  });

  it('inserts optimistic media without a stable content URL and emits attachment payload', () => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1'], {
      pages: [{ messages: [], nextCursor: null }],
      pageParams: [undefined],
    });
    const emit = jest.spyOn(socket, 'emit');

    const { result } = renderHook(() => useSendMessage('chat-1', 'user-1'));

    act(() => {
      result.current.setFileAttachment({
        fileId: '55555555-5555-4555-8555-555555555555',
        fileBucket: 'media',
        fileKey: 'chat/image.png',
        fileName: 'image.png',
        fileSize: 4096,
        fileMime: 'image/png',
        fileCategory: 'IMAGE',
      });
    });
    act(() => {
      result.current.handleSend();
    });

    const cached = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1']);
    expect(cached?.pages[0].messages[0]).toEqual(expect.objectContaining({
      kind: 'image',
      media: expect.objectContaining({
        fileId: '55555555-5555-4555-8555-555555555555',
        contentUrl: '',
      }),
      attachments: [expect.objectContaining({
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
        category: 'IMAGE',
      })],
    }));
    expect(emit).toHaveBeenCalledWith('message:send', expect.objectContaining({
      chatId: 'chat-1',
      type: 'IMAGE',
      attachments: [expect.objectContaining({
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
      })],
    }));
  });
});
