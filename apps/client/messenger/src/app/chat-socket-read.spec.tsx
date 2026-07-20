import { renderHook, waitFor } from '@testing-library/react';

import { chatApi } from '@org/entities-chat';
import { useChatSocket } from '@org/features-chat-socket';
import { socket } from '@org/shared';

describe('chat socket read state', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('marks the chat read on the server when joining a chat', async () => {
    const markRead = jest.spyOn(chatApi, 'markRead').mockResolvedValue(undefined as never);
    const emit = jest.spyOn(socket, 'emit');

    renderHook(() => useChatSocket('chat-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('chat-1'));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-1' }));
  });
});
