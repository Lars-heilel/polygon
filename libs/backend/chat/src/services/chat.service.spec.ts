import { ForbiddenException } from '@nestjs/common';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

import type { IChatRepository } from '../interfaces/chat.interface';
import { ChatService } from './chat.service';

function repoMock(): jest.Mocked<IChatRepository> {
  return {
    findChatById: jest.fn(),
    findDirectChatBetween: jest.fn(),
    findSelfChat: jest.fn(),
    createSelfChat: jest.fn(),
    findChatsForUser: jest.fn(),
    createChat: jest.fn(),
    deleteChat: jest.fn(),
    findChatMember: jest.fn(),
    findMembersByChat: jest.fn(),
    addChatMember: jest.fn(),
    removeChatMember: jest.fn(),
    findMessagesByChat: jest.fn(),
    findMediaMessagesByChat: jest.fn(),
    findMessageById: jest.fn(),
    createMessage: jest.fn(),
    createMessagesMany: jest.fn(),
    countUnreadMessages: jest.fn(),
    markChatRead: jest.fn(),
  };
}

describe('ChatService', () => {
  it('does not write raw chat request data to diagnostic logs', async () => {
    const repo = repoMock();
    repo.findChatsForUser.mockResolvedValue([]);
    repo.findSelfChat.mockResolvedValue(null);
    repo.findChatMember.mockResolvedValue(null);
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await service.getChats('user-secret-id');
    await service.createSelfChat('user-secret-id');
    await expect(
      service.sendMessage('chat-secret-id', 'user-secret-id', {
        type: 'FILE',
        text: 'message text token=secret',
        fileName: 'file.png',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.markRead('chat-secret-id', 'user-secret-id', 'message-secret-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('chat-secret-id');
    expect(diagnosticPayload).not.toContain('message text');
    expect(diagnosticPayload).not.toContain('file.png');
    expect(diagnosticPayload).not.toContain('token=secret');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'message_send_requested', hasChatId: true, hasSenderId: true }),
    );
  });

  it('gets chats without creating a self chat as a side effect', async () => {
    const repo = repoMock();
    repo.findChatsForUser.mockResolvedValue([]);
    const service = new ChatService(repo);

    await expect(service.getChats('user-1')).resolves.toEqual([]);

    expect(repo.createChat).not.toHaveBeenCalled();
    expect(repo.addChatMember).not.toHaveBeenCalled();
    expect(repo.findChatsForUser).toHaveBeenCalledWith('user-1');
  });

  it('creates a self chat explicitly and idempotently', async () => {
    const repo = repoMock();
    const existing = {
      id: 'chat-self',
      type: 'DIRECT',
      name: 'Личное',
      avatarUrl: null,
      createdAt: new Date('2026-07-14T10:00:00.000Z'),
      updatedAt: new Date('2026-07-14T10:00:00.000Z'),
    } as const;
    repo.findSelfChat.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    repo.createSelfChat.mockResolvedValue(existing);
    const service = new ChatService(repo);

    await expect(service.createSelfChat('user-1')).resolves.toEqual(existing);
    await expect(service.createSelfChat('user-1')).resolves.toEqual(existing);

    expect(repo.createSelfChat).toHaveBeenCalledTimes(1);
    expect(repo.createSelfChat).toHaveBeenCalledWith('user-1');
    expect(repo.createChat).not.toHaveBeenCalled();
    expect(repo.addChatMember).not.toHaveBeenCalled();
  });

  it('marks a chat read only for chat members', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValueOnce(null);
    const service = new ChatService(repo);

    await expect(service.markRead('chat-1', 'user-1', 'message-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.markChatRead).not.toHaveBeenCalled();
  });

  it('updates the read marker for a chat member', async () => {
    const repo = repoMock();
    const member = {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER' as const,
      joinedAt: new Date('2026-07-14T10:00:00.000Z'),
      lastReadMessageId: 'message-1',
      lastReadAt: new Date('2026-07-14T10:01:00.000Z'),
    };
    repo.findChatMember.mockResolvedValue(member);
    repo.markChatRead.mockResolvedValue(member);
    const service = new ChatService(repo);

    await expect(service.markRead('chat-1', 'user-1', 'message-1')).resolves.toEqual(member);
    expect(repo.markChatRead).toHaveBeenCalledWith('chat-1', 'user-1', 'message-1');
  });
});
