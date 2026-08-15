import { renderHook, waitFor } from '@testing-library/react';

import { chatApi } from '@org/entities-chat';
import { useChatSocket } from '@org/features-chat-socket';
import { queryClient, socket } from '@org/shared';

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
});
