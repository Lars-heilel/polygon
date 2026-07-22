import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Chat } from '@org/entities-chat';
import { MessageActionsMenu, useDeleteMessageMutation, useEditMessageMutation } from '@org/entities-message';
import type { Message } from '@org/entities-message';
import { authedFetch, queryClient } from '@org/shared';
import { ChatFooter } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter';
import { DeleteMessageModal } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/delete-message-modal';
import { ForwardMessageModal } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/forward-message-modal';

jest.mock('@org/entities-user', () => ({
  useMeSuspenseQuery: () => ({ data: { id: 'user-1' } }),
  useSearchUsersQuery: () => ({ data: [] }),
}));

jest.mock('@org/features-emoji', () => ({
  EmojiPicker: () => <button type="button" aria-label="Emoji picker" />,
}));

jest.mock('@org/features-send-message', () => {
  const recorder = {
    isRecording: false,
    duration: 0,
    start: jest.fn(),
    stop: jest.fn(),
    formatDuration: () => '0:00',
  };

  return {
    confirmChatFileUpload: jest.fn(),
    getCategoryFromMime: jest.fn(() => 'FILE'),
    initChatFileUpload: jest.fn(),
    uploadFileToMinio: jest.fn(),
    useCircleRecorder: () => recorder,
    useSendMessage: () => ({
      messageText: '',
      setMessageText: jest.fn(),
      handleSend: jest.fn(),
      setFileAttachment: jest.fn(),
    }),
    useVoiceRecorder: () => recorder,
  };
});

const baseMessage: Message = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text: 'hello',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  media: null,
  linkPreview: null,
  attachments: [],
  forwardContext: null,
};

describe('message actions ui', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('shows edit only for own text messages without files', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    render(
      <MessageActionsMenu
        message={baseMessage}
        isMine
        onEdit={jest.fn()}
        onForward={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Message actions'));

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('menu').className).toContain('fixed');
    expect(screen.getByRole('button', { name: 'Message actions' }).className).toContain('h-8');
    expect(screen.getByRole('button', { name: 'Message actions' }).className).not.toContain('shadow-[');
    expect(screen.getByRole('menuitem', { name: 'Edit' }).className).toContain('h-9');
    expect(screen.getByRole('menu').getAttribute('style')).toContain('bottom: 12px');
  });

  it('hides edit for file messages and keeps forward copy delete', () => {
    render(
      <MessageActionsMenu
        message={{
          ...baseMessage,
          media: {
            fileId: 'file-1',
            contentUrl: '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
            thumbUrl: null,
            fileName: 'file.bin',
            mime: 'application/octet-stream',
            size: 2048,
            category: 'FILE',
            width: null,
            height: null,
            durationMs: null,
            waveform: null,
          },
        }}
        isMine
        onEdit={jest.fn()}
        onForward={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Message actions'));

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
  });

  it('keeps circle video recording hidden on desktop', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatFooter chatId="chat-1" />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: 'Circle video' }).className).toContain('lg:hidden');
  });

  it('defaults own message delete confirmation to delete for everyone', () => {
    render(
      <DeleteMessageModal
        isOpen
        message={baseMessage}
        isMine
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Delete for everyone' }).checked).toBe(true);
  });

  it('saves edited text through the message mutation and updates message cache', async () => {
    queryClient.setQueryData(['messages', 'chat-1'], {
      pageParams: [undefined],
      pages: [{ messages: [baseMessage], nextCursor: null }],
    });
    (authedFetch as jest.Mock).mockResolvedValueOnce({
      ...baseMessage,
      text: 'updated text',
      editedAt: '2026-07-22T00:10:00.000Z',
    });

    function EditHarness() {
      const editMessage = useEditMessageMutation('chat-1');

      return (
        <button
          type="button"
          onClick={() => editMessage.mutate({ messageId: baseMessage.id, text: 'updated text' })}
        >
          Save edit
        </button>
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <EditHarness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }));

    await waitFor(() => {
      expect(authedFetch).toHaveBeenCalledWith('chats/chat-1/messages/message-1', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ text: 'updated text' }),
      }));
    });

    expect(queryClient.getQueryData<{ pages: Array<{ messages: Message[] }> }>(['messages', 'chat-1'])
      ?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'message-1',
      text: 'updated text',
      editedAt: '2026-07-22T00:10:00.000Z',
    }));
  });

  it('confirms delete-for-me when the checkbox is cleared', () => {
    const onConfirm = jest.fn();
    render(
      <DeleteMessageModal
        isOpen
        message={baseMessage}
        isMine
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Delete for everyone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledWith('ME');
  });

  it('deletes a message through the mutation and removes it from message cache', async () => {
    queryClient.setQueryData(['messages', 'chat-1'], {
      pageParams: [undefined],
      pages: [{ messages: [baseMessage], nextCursor: null }],
    });
    (authedFetch as jest.Mock).mockResolvedValueOnce({ id: 'message-1', chatId: 'chat-1' });

    function DeleteHarness() {
      const deleteMessage = useDeleteMessageMutation('chat-1');

      return (
        <DeleteMessageModal
          isOpen
          message={baseMessage}
          isMine
          onClose={jest.fn()}
          onConfirm={(mode) => deleteMessage.mutate({ messageId: baseMessage.id, mode })}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <DeleteHarness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(authedFetch).toHaveBeenCalledWith('chats/chat-1/messages/message-1', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ mode: 'EVERYONE' }),
      }));
    });

    expect(queryClient.getQueryData<{ pages: Array<{ messages: Message[] }> }>(['messages', 'chat-1'])
      ?.pages[0].messages).toEqual([]);
  });

  it('opens a Forward to modal with Saved Messages first', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ForwardMessageModal
          isOpen
          sourceChatId="chat-1"
          currentUserId="user-1"
          message={baseMessage}
          senderName="Alice"
          sourceChatTitle="General"
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Forward to...' })).toBeTruthy();
    expect(screen.getByText('Forwarding from You in General')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getAllByTestId('forward-target-row')[0].textContent).toContain('Saved Messages');
  });

  it('searches existing chats in the forward modal', async () => {
    const activeChat: Chat = {
      id: 'chat-2',
      type: 'GROUP',
      name: 'Cake Chat',
      avatarUrl: null,
      selfOwnerId: null,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      unreadCount: 0,
      lastMessage: null,
      members: [],
    };

    (authedFetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === 'chats') return [activeChat];
      if (url.startsWith('search/users')) return [];
      return [];
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ForwardMessageModal
          isOpen
          sourceChatId="chat-1"
          currentUserId="user-1"
          message={baseMessage}
          senderName="Alice"
          sourceChatTitle="General"
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Search forward targets'), {
      target: { value: 'cake' },
    });

    await waitFor(() => {
      expect(screen.getByText('Cake Chat')).toBeTruthy();
    });
  });

  it('forwards to saved messages by creating self chat first', async () => {
    (authedFetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === 'chats/self') return { id: 'self-chat-id' };
      if (url === 'chats/self-chat-id/forward') return [];
      if (url === 'chats') return [];
      return [];
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ForwardMessageModal
          isOpen
          sourceChatId="chat-1"
          currentUserId="user-1"
          message={baseMessage}
          senderName="Alice"
          sourceChatTitle="General"
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText('Saved Messages'));

    await waitFor(() => {
      expect(authedFetch).toHaveBeenCalledWith('chats/self', expect.objectContaining({ method: 'POST' }));
      expect(authedFetch).toHaveBeenCalledWith('chats/self-chat-id/forward', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('uses the existing self chat as Saved Messages without showing a duplicate personal chat', async () => {
    const selfChat: Chat = {
      id: 'existing-self-chat-id',
      type: 'DIRECT',
      name: 'Личное',
      avatarUrl: null,
      selfOwnerId: 'user-1',
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      unreadCount: 0,
      lastMessage: null,
      members: [
        {
          chatId: 'existing-self-chat-id',
          userId: 'user-1',
          role: 'MEMBER',
          joinedAt: '2026-07-22T00:00:00.000Z',
          lastReadMessageId: null,
          lastReadAt: null,
          profile: null,
        },
      ],
    };

    queryClient.setQueryData(['chats'], [selfChat]);
    (authedFetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === 'chats') return [selfChat];
      if (url === 'chats/existing-self-chat-id/forward') return [];
      return [];
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ForwardMessageModal
          isOpen
          sourceChatId="chat-1"
          currentUserId="user-1"
          message={baseMessage}
          senderName="Alice"
          sourceChatTitle="General"
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByText('Личное')).toBeNull();

    fireEvent.click(screen.getByText('Saved Messages'));

    await waitFor(() => {
      expect(authedFetch).not.toHaveBeenCalledWith('chats/self', expect.anything());
      expect(authedFetch).toHaveBeenCalledWith('chats/existing-self-chat-id/forward', expect.objectContaining({ method: 'POST' }));
    });
  });
});
