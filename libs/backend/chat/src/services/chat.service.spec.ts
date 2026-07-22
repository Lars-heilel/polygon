import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
    updateMessageText: jest.fn(),
    deleteMessageForEveryone: jest.fn(),
    hideMessageForUser: jest.fn(),
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

  it('logs forward lifecycle without raw ids or message text', async () => {
    const repo = repoMock();
    repo.findChatMember
      .mockResolvedValueOnce({
        chatId: 'source-secret-chat',
        userId: 'user-secret-id',
        role: 'MEMBER',
        joinedAt: new Date('2026-07-22T00:00:00.000Z'),
        lastReadMessageId: null,
        lastReadAt: null,
      })
      .mockResolvedValueOnce({
        chatId: 'target-secret-chat',
        userId: 'user-secret-id',
        role: 'MEMBER',
        joinedAt: new Date('2026-07-22T00:00:00.000Z'),
        lastReadMessageId: null,
        lastReadAt: null,
      });
    repo.findMessageById.mockResolvedValue(null);
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await service.forwardMessages({
      sourceChatId: 'source-secret-chat',
      targetChatId: 'target-secret-chat',
      messageIds: ['message-secret-id'],
      userId: 'user-secret-id',
    });

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_requested',
      hasSourceChatId: true,
      hasTargetChatId: true,
      hasUserId: true,
      messageCount: 1,
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_source_missing',
      hasSourceChatId: true,
      missingCount: 1,
    }));
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'messages_forwarded',
      requestedCount: 1,
      createdCount: 0,
    }));

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('source-secret-chat');
    expect(diagnosticPayload).not.toContain('target-secret-chat');
    expect(diagnosticPayload).not.toContain('message-secret-id');
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
      selfOwnerId: 'user-1',
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

  it('preserves forwarded source sender and original creation time', async () => {
    const repo = repoMock();
    const sourceMember = {
      chatId: 'source-chat',
      userId: 'forwarder',
      role: 'MEMBER' as const,
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    };
    const targetMember = { ...sourceMember, chatId: 'target-chat' };
    const originalCreatedAt = new Date('2026-07-21T10:15:00.000Z');
    const original = {
      id: 'original-message',
      clientId: null,
      chatId: 'source-chat',
      senderId: 'original-sender',
      type: 'TEXT' as const,
      text: 'original text',
      fileId: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };

    repo.findChatMember
      .mockResolvedValueOnce(sourceMember)
      .mockResolvedValueOnce(targetMember);
    repo.findMessageById.mockResolvedValue(original);
    repo.createMessage.mockResolvedValue({
      ...original,
      id: 'forwarded-message',
      chatId: 'target-chat',
      senderId: 'forwarder',
      forwardedFromId: 'original-message',
      forwardedFromSenderId: 'original-sender',
      forwardedFromCreatedAt: originalCreatedAt,
      forwardedFromType: 'TEXT',
      forwardedFromText: 'original text',
      forwardedFromFileName: null,
    });
    const service = new ChatService(repo);

    await service.forwardMessages({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['original-message'],
      userId: 'forwarder',
    });

    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      forwardedFromId: 'original-message',
      forwardedFromSenderId: 'original-sender',
      forwardedFromCreatedAt: originalCreatedAt,
      forwardedFromType: 'TEXT',
      forwardedFromText: 'original text',
      forwardedFromFileName: null,
    }));
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

  it('edits only own text messages without files', async () => {
    const repo = repoMock();
    const message = {
      id: 'message-1',
      clientId: null,
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT' as const,
      text: 'before',
      fileId: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    };
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageById.mockResolvedValue(message);
    repo.updateMessageText.mockResolvedValue({ ...message, text: 'after', editedAt: new Date() });
    const service = new ChatService(repo);

    await expect(service.editMessage('chat-1', 'message-1', 'user-1', 'after')).resolves.toMatchObject({
      id: 'message-1',
      text: 'after',
    });

    expect(repo.updateMessageText).toHaveBeenCalledWith('message-1', 'after');
  });

  it('rejects editing file-backed messages', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageById.mockResolvedValue({
      id: 'message-1',
      clientId: null,
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'caption',
      fileId: '11111111-1111-4111-8111-111111111111',
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    });
    const service = new ChatService(repo);

    await expect(service.editMessage('chat-1', 'message-1', 'user-1', 'after')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.updateMessageText).not.toHaveBeenCalled();
  });

  it('allows any member to delete a visible message for themselves', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-2',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageById.mockResolvedValue({
      id: 'message-1',
      clientId: null,
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      fileId: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    });
    const service = new ChatService(repo);

    await expect(service.deleteMessage('chat-1', 'message-1', 'user-2', 'ME')).resolves.toEqual({
      id: 'message-1',
      chatId: 'chat-1',
    });

    expect(repo.hideMessageForUser).toHaveBeenCalledWith('message-1', 'user-2');
  });

  it('rejects delete-for-everyone when the requester is not the sender', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-2',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageById.mockResolvedValue({
      id: 'message-1',
      clientId: null,
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      fileId: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    });
    const service = new ChatService(repo);

    await expect(service.deleteMessage('chat-1', 'message-1', 'user-2', 'EVERYONE')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.deleteMessageForEveryone).not.toHaveBeenCalled();
  });

  it('returns not found for messages outside the requested chat', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageById.mockResolvedValue({
      id: 'message-1',
      clientId: null,
      chatId: 'chat-2',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
      fileId: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      fileMime: null,
      fileCategory: null,
      forwardedFromId: null,
      forwardedFromSenderId: null,
      forwardedFromCreatedAt: null,
      forwardedFromType: null,
      forwardedFromText: null,
      forwardedFromFileName: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    });
    const service = new ChatService(repo);

    await expect(service.editMessage('chat-1', 'message-1', 'user-1', 'after')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
