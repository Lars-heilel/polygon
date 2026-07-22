import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Chat } from '@org/entities-chat';
import { MessageActionsMenu } from '@org/entities-message';
import type { Message } from '@org/entities-message';
import { authedFetch, queryClient } from '@org/shared';
import { DeleteMessageModal } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/delete-message-modal';
import { ForwardMessageModal } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/forward-message-modal';

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
  fileId: null,
  fileBucket: null,
  fileKey: null,
  fileName: null,
  fileSize: null,
  fileMime: null,
  fileCategory: null,
  forwardedFromId: null,
};

describe('message actions ui', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('shows edit only for own text messages without files', () => {
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
    expect(screen.getByRole('button', { name: 'Message actions' }).className).toContain('h-9');
  });

  it('hides edit for file messages and keeps forward copy delete', () => {
    render(
      <MessageActionsMenu
        message={{ ...baseMessage, fileId: 'file-1' }}
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
});
