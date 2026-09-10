import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Message } from '@org/common';
import { MEDIA_PATTERNS } from '@org/core';
import { of, throwError } from 'rxjs';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

import type { IChatRepository } from '../../interfaces/chat.interface';
import { ChatService } from '../chat.service';

const messageRelations: Pick<Message, 'attachments' | 'forwardContext'> = {
  attachments: [],
  forwardContext: null,
};

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
    findMessageByClientId: jest.fn(),
    findVisibleMessagesByIds: jest.fn(),
    findMessageAttachmentForAccess: jest.fn(),
    createMessageWithRelations: jest.fn(),
    createMessageWithTouch: jest.fn(),
    touchChatLastMessage: jest.fn(),
    deleteCreatedMessage: jest.fn(),
    updateMessageText: jest.fn(),
    deleteMessageForEveryone: jest.fn(),
    hideMessageForUser: jest.fn(),
    countUnreadMessages: jest.fn(),
    markChatRead: jest.fn(),
  };
}

describe('ChatService', () => {
  it('creates an attachment when sending a legacy file message', async () => {
    const repo = repoMock();
    const member = {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER' as const,
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    };
    const messageWithAttachment = {
      id: 'message-1',
      attachments: [
        {
          id: 'attachment-1',
          messageId: 'message-1',
          mediaId: '55555555-5555-4555-8555-555555555555',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
          createdAt: new Date('2026-07-22T00:00:00.000Z'),
        },
      ],
    } as Message;
    const mediaClient = { send: jest.fn(() => of({ id: 'reference-1' })) };
    repo.findChatMember.mockResolvedValue(member);
    repo.createMessageWithTouch.mockResolvedValue(messageWithAttachment);
    const service = new ChatService(repo, mediaClient as never);

    await service.sendMessage('chat-1', 'user-1', {
      type: 'VOICE',
      fileId: '55555555-5555-4555-8555-555555555555',
      fileName: 'voice.ogg',
      fileSize: 33000,
      fileMime: 'audio/ogg',
      fileCategory: 'VOICE',
    });

    expect(repo.createMessageWithTouch).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [expect.objectContaining({
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'voice.ogg',
        category: 'VOICE',
      })],
    }));
  });

  it('creates a media reference for every attachment after sending a file message', async () => {
    const repo = repoMock();
    const mediaClient = { send: jest.fn(() => of({ id: 'reference-1' })) };
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch.mockResolvedValue({
      id: 'message-1',
      attachments: [{
        id: 'attachment-1',
        messageId: 'message-1',
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
    } as Message);
    const service = new ChatService(repo);
    Object.defineProperty(service, 'mediaClient', { value: mediaClient });

    await service.sendMessage('chat-1', 'user-1', {
      type: 'VOICE',
      fileId: '55555555-5555-4555-8555-555555555555',
      fileName: 'voice.ogg',
      fileSize: 33000,
      fileMime: 'audio/ogg',
      fileCategory: 'VOICE',
    });

    expect(mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.CREATE_REFERENCE, {
      fileId: '55555555-5555-4555-8555-555555555555',
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-1',
    });
  });

  it('saves and protects media messages sent with attachment payloads only', async () => {
    const repo = repoMock();
    const mediaClient = { send: jest.fn(() => of({ id: 'reference-1' })) };
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch.mockResolvedValue({
      id: 'message-1',
      clientId: '44444444-4444-4444-8444-444444444444',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'IMAGE',
      text: null,
      attachments: [{
        id: 'attachment-1',
        messageId: 'message-1',
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
        fileSizeSnapshot: 4096,
        mimeSnapshot: 'image/png',
        category: 'IMAGE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
    } as Message);
    const service = new ChatService(repo, mediaClient as never);

    await expect(service.sendMessage('chat-1', 'user-1', {
      clientId: '44444444-4444-4444-8444-444444444444',
      type: 'IMAGE',
      text: null,
      attachments: [{
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
        fileSizeSnapshot: 4096,
        mimeSnapshot: 'image/png',
        category: 'IMAGE',
      }],
    })).resolves.toEqual(expect.objectContaining({
      id: 'message-1',
      attachments: [expect.objectContaining({ id: 'attachment-1' })],
    }));

    expect(repo.createMessageWithTouch).toHaveBeenCalledWith(expect.objectContaining({
      clientId: '44444444-4444-4444-8444-444444444444',
      attachments: [expect.objectContaining({
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
        category: 'IMAGE',
      })],
    }));
    expect(mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.CREATE_REFERENCE, {
      fileId: '55555555-5555-4555-8555-555555555555',
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-1',
    });
  });

  it('removes the created message when media reference creation fails', async () => {
    const repo = repoMock() as jest.Mocked<IChatRepository> & { deleteCreatedMessage: jest.Mock };
    const mediaClient = { send: jest.fn(() => throwError(() => new Error('media unavailable'))) };
    repo.deleteCreatedMessage = jest.fn().mockResolvedValue(undefined);
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch.mockResolvedValue({
      id: 'message-1',
      attachments: [{
        id: 'attachment-1',
        messageId: 'message-1',
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
    } as Message);
    const service = new ChatService(repo);
    Object.defineProperty(service, 'mediaClient', { value: mediaClient });
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.sendMessage('chat-1', 'user-1', {
      type: 'VOICE',
      fileId: '55555555-5555-4555-8555-555555555555',
      fileName: 'voice.ogg',
      fileSize: 33000,
      fileMime: 'audio/ogg',
      fileCategory: 'VOICE',
    })).rejects.toThrow('media unavailable');

    expect(repo.deleteCreatedMessage).toHaveBeenCalledWith('message-1');
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_create_failed',
      attachmentCount: 1,
    }));
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_send_failed',
      hasMessageId: true,
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_send_compensated',
      hasMessageId: true,
    }));
  });

  it('returns same message on retry with same clientId without duplicate', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    const created = {
      id: 'message-1',
      clientId: 'c-1',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hi',
      attachments: [],
      forwardContext: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    } as Message;
    repo.findMessageByClientId.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
    repo.createMessageWithTouch.mockResolvedValue(created);

    const first = await service_send(repo, 'c-1', 'hi');
    const second = await service_send(repo, 'c-1', 'hi');

    expect(second.id).toBe(first.id);
    expect(repo.createMessageWithTouch).toHaveBeenCalledTimes(1);
  });

  it('touches chat lastMessage and sender lastRead in same flow', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    const created = {
      id: 'message-2',
      clientId: 'c-2',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'yo',
      attachments: [],
      forwardContext: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt,
      updatedAt: createdAt,
    } as Message;
    repo.findMessageByClientId.mockResolvedValue(null);
    repo.createMessageWithTouch.mockResolvedValue(created);
    const service = new ChatService(repo);

    const msg = await service.sendMessage('chat-1', 'user-1', { clientId: 'c-2', type: 'TEXT', text: 'yo' });

    expect(msg.id).toBeDefined();
    expect(repo.createMessageWithTouch).toHaveBeenCalledTimes(1);
    expect(repo.touchChatLastMessage).not.toHaveBeenCalled();
  });

  it('returns winner on P2002 race without duplicate', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    const winner = {
      id: 'message-winner',
      clientId: 'c-race',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hi',
      attachments: [],
      forwardContext: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    } as Message;
    repo.findMessageByClientId.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    repo.createMessageWithTouch.mockRejectedValue({ code: 'P2002' });
    const service = new ChatService(repo);

    await expect(
      service.sendMessage('chat-1', 'user-1', { clientId: 'c-race', type: 'TEXT', text: 'hi' }),
    ).resolves.toEqual(winner);
    expect(repo.touchChatLastMessage).not.toHaveBeenCalled();
  });

  function service_send(
    repo: jest.Mocked<IChatRepository>,
    clientId: string,
    text: string,
  ): Promise<Message> {
    const service = new ChatService(repo);
    return service.sendMessage('chat-1', 'user-1', { clientId, type: 'TEXT', text });
  }

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

  it('prepares only visible messages for forwarding using the visibility-aware repository query', async () => {
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
    const visibleMessage = {
      id: 'visible-message',
      clientId: null,
      chatId: 'source-chat',
      senderId: 'original-sender',
      type: 'VOICE' as const,
      text: null,
      attachments: [{
        id: 'attachment-1',
        messageId: 'visible-message',
        mediaId: 'file-1',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: new Date('2026-07-21T10:15:00.000Z'),
      }],
      forwardContext: null,
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-07-21T10:15:00.000Z'),
      updatedAt: new Date('2026-07-21T10:15:00.000Z'),
    };
    repo.findChatMember.mockResolvedValueOnce(sourceMember).mockResolvedValueOnce(targetMember);
    repo.findVisibleMessagesByIds.mockResolvedValue([visibleMessage]);
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.prepareForwardMessages({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['visible-message', 'hidden-message'],
      userId: 'forwarder',
    })).resolves.toEqual([
      expect.objectContaining({
        messageId: 'visible-message',
        chatId: 'source-chat',
        senderId: 'original-sender',
        attachments: [expect.objectContaining({ mediaId: 'file-1', category: 'VOICE' })],
        forwardContext: null,
      }),
    ]);

    expect(repo.findVisibleMessagesByIds).toHaveBeenCalledWith(
      'source-chat',
      ['visible-message', 'hidden-message'],
      'forwarder',
    );
    expect(repo.findMessageById).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_prepare_skipped',
      messageCount: 2,
      skippedCount: 1,
    }));
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_prepare_completed',
      messageCount: 2,
      preparedCount: 1,
      skippedCount: 1,
    }));
  });

  it('clones prepared forwarded messages with preserved root context and attachment references', async () => {
    const repo = repoMock();
    const mediaClient = { send: jest.fn(() => of({ id: 'reference-1' })) };
    repo.findChatMember.mockResolvedValue({
      chatId: 'target-chat',
      userId: 'forwarder',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch.mockResolvedValue({
      id: 'cloned-message',
      attachments: [{
        id: 'attachment-1',
        messageId: 'cloned-message',
        mediaId: 'media-1',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
      forwardContext: {
        messageId: 'cloned-message',
        originalMessageId: 'root-message',
        originalChatId: 'root-chat',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'tamilka',
        originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        originalMessageCreatedAt: new Date('2026-07-21T10:15:00.000Z'),
        originalMessageType: 'VOICE',
        originalTextPreview: null,
        originalFileNamePreview: 'voice.ogg',
        snapshotVersion: 1,
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      },
    } as Message);
    const service = new ChatService(repo, mediaClient as never);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.cloneForwardMessages({
      targetChatId: 'target-chat',
      userId: 'forwarder',
      messages: [{
        messageId: 'source-message',
        chatId: 'source-chat',
        senderId: 'original-sender',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'tamilka',
        originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        type: 'VOICE',
        text: null,
        createdAt: new Date('2026-07-21T10:15:00.000Z'),
        attachments: [{
          mediaId: 'media-1',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
        }],
        forwardContext: {
          originalMessageId: 'root-message',
          originalChatId: 'root-chat',
          originalAuthorId: 'author-1',
          originalAuthorNameSnapshot: 'tamilka',
          originalAuthorDisplayNameSnapshot: 'Тамилка:3',
          originalMessageCreatedAt: new Date('2026-07-20T10:15:00.000Z'),
          originalMessageType: 'VOICE',
          originalTextPreview: null,
          originalFileNamePreview: 'voice.ogg',
        },
      }],
    })).resolves.toEqual([
      expect.objectContaining({
        id: 'cloned-message',
        attachments: expect.arrayContaining([
          expect.objectContaining({ mediaId: 'media-1', category: 'VOICE' }),
        ]),
      }),
    ]);

    expect(repo.createMessageWithTouch).toHaveBeenCalledWith(expect.objectContaining({
      chatId: 'target-chat',
      senderId: 'forwarder',
      attachments: [expect.objectContaining({ mediaId: 'media-1' })],
      forwardContext: expect.objectContaining({
        originalMessageId: 'root-message',
        originalAuthorNameSnapshot: 'tamilka',
      }),
    }));
    expect(mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.CREATE_REFERENCE, {
      fileId: 'media-1',
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-1',
    });
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_clone_created',
      hasTargetChatId: true,
      messageCount: 1,
      createdCount: 1,
      attachmentCount: 1,
    }));
  });

  it('touches target chat lastMessage on forward clone via transactional create', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'target-chat',
      userId: 'forwarder',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch
      .mockResolvedValueOnce({ id: 'cloned-1', chatId: 'target-chat' } as Message)
      .mockResolvedValueOnce({ id: 'cloned-2', chatId: 'target-chat' } as Message);
    const service = new ChatService(repo);

    const baseInput = {
      chatId: 'source-chat',
      senderId: 'original-sender',
      originalAuthorId: 'author-1',
      originalAuthorNameSnapshot: 'Alice',
      originalAuthorDisplayNameSnapshot: null,
      type: 'TEXT' as const,
      text: 'forwarded',
      createdAt: new Date('2026-07-21T10:15:00.000Z'),
      attachments: [],
      forwardContext: null,
    };

    const cloned = await service.cloneForwardMessages({
      targetChatId: 'target-chat',
      userId: 'forwarder',
      messages: [
        { ...baseInput, messageId: 'source-1' },
        { ...baseInput, messageId: 'source-2' },
      ],
    });

    expect(cloned.map((message) => message.id)).toEqual(['cloned-1', 'cloned-2']);
    expect(repo.createMessageWithTouch).toHaveBeenCalledTimes(2);
    expect(repo.createMessageWithTouch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        chatId: 'target-chat',
        forwardContext: expect.objectContaining({ originalAuthorId: 'author-1' }),
      }),
    );
    expect(repo.createMessageWithRelations).not.toHaveBeenCalled();
    expect(repo.touchChatLastMessage).not.toHaveBeenCalled();
  });

  it('compensates forwarded clones when media reference protection fails', async () => {
    const repo = repoMock();
    const mediaClient = { send: jest.fn(() => throwError(() => new Error('media unavailable'))) };
    repo.findChatMember.mockResolvedValue({
      chatId: 'target-chat',
      userId: 'forwarder',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.createMessageWithTouch.mockResolvedValue({
      id: 'cloned-message',
      attachments: [{
        id: 'attachment-1',
        messageId: 'cloned-message',
        mediaId: 'media-1',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
    } as Message);
    repo.deleteCreatedMessage.mockResolvedValue(undefined);
    const service = new ChatService(repo, mediaClient as never);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.cloneForwardMessages({
      targetChatId: 'target-chat',
      userId: 'forwarder',
      messages: [{
        messageId: 'source-message',
        chatId: 'source-chat',
        senderId: 'original-sender',
        originalAuthorId: 'author-1',
        originalAuthorNameSnapshot: 'tamilka',
        originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        type: 'VOICE',
        text: null,
        createdAt: new Date('2026-07-21T10:15:00.000Z'),
        attachments: [{
          mediaId: 'media-1',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
        }],
        forwardContext: null,
      }],
    })).rejects.toThrow('media unavailable');

    expect(repo.deleteCreatedMessage).toHaveBeenCalledWith('cloned-message');
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_clone_failed',
      hasTargetChatId: true,
      hasUserId: true,
      messageCount: 1,
      createdCount: 0,
      hasError: true,
    }));
  });

  it('returns attachment media access only for chat members and logs the redacted lifecycle', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-secret-id',
      userId: 'user-secret-id',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageAttachmentForAccess.mockResolvedValue({ mediaId: 'media-secret-id' });
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.getMessageAttachmentForAccess({
      chatId: 'chat-secret-id',
      messageId: 'message-secret-id',
      attachmentId: 'attachment-secret-id',
      userId: 'user-secret-id',
    })).resolves.toEqual({ mediaId: 'media-secret-id' });

    expect(repo.findMessageAttachmentForAccess).toHaveBeenCalledWith({
      chatId: 'chat-secret-id',
      messageId: 'message-secret-id',
      attachmentId: 'attachment-secret-id',
      userId: 'user-secret-id',
    });
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_attachment_access_success',
      hasChatId: true,
      hasMessageId: true,
      hasAttachmentId: true,
      hasUserId: true,
      hasMediaId: true,
    }));
  });

  it('denies attachment access when the user is not a chat member', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue(null);
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.getMessageAttachmentForAccess({
      chatId: 'chat-secret-id',
      messageId: 'message-secret-id',
      attachmentId: 'attachment-secret-id',
      userId: 'user-secret-id',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(repo.findMessageAttachmentForAccess).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_attachment_access_denied',
      hasChatId: true,
      hasMessageId: true,
      hasAttachmentId: true,
      hasUserId: true,
      reason: 'not_chat_member',
    }));
  });

  it('rejects when the attachment does not belong to the requested chat message', async () => {
    const repo = repoMock();
    repo.findChatMember.mockResolvedValue({
      chatId: 'chat-secret-id',
      userId: 'user-secret-id',
      role: 'MEMBER',
      joinedAt: new Date('2026-07-22T00:00:00.000Z'),
      lastReadMessageId: null,
      lastReadAt: null,
    });
    repo.findMessageAttachmentForAccess.mockResolvedValue(null);
    const service = new ChatService(repo);
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.getMessageAttachmentForAccess({
      chatId: 'chat-secret-id',
      messageId: 'message-secret-id',
      attachmentId: 'attachment-secret-id',
      userId: 'user-secret-id',
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_attachment_access_denied',
      reason: 'attachment_not_in_message_chat',
    }));
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
      lastMessageId: null,
      lastMessageAt: null,
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
      ...messageRelations,
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
    repo.createMessageWithRelations.mockResolvedValue({
      ...original,
      id: 'forwarded-message',
      chatId: 'target-chat',
      senderId: 'forwarder',
      forwardContext: {
        messageId: 'forwarded-message',
        originalMessageId: 'original-message',
        originalChatId: 'source-chat',
        originalAuthorId: 'original-sender',
        originalAuthorNameSnapshot: 'Deleted user',
        originalAuthorDisplayNameSnapshot: null,
        originalMessageCreatedAt: originalCreatedAt,
        originalMessageType: 'TEXT',
        originalTextPreview: 'original text',
        originalFileNamePreview: null,
        snapshotVersion: 1,
        createdAt: originalCreatedAt,
      },
    });
    const service = new ChatService(repo);

    await service.forwardMessages({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['original-message'],
      userId: 'forwarder',
    });

    expect(repo.createMessageWithRelations).toHaveBeenCalledWith(expect.objectContaining({
      forwardContext: expect.objectContaining({
        originalMessageId: 'original-message',
        originalChatId: 'source-chat',
        originalAuthorId: 'original-sender',
        originalMessageCreatedAt: originalCreatedAt,
        originalMessageType: 'TEXT',
        originalTextPreview: 'original text',
        originalFileNamePreview: null,
      }),
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
      ...messageRelations,
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
      attachments: [{
        id: 'attachment-1',
        messageId: 'message-1',
        mediaId: '11111111-1111-4111-8111-111111111111',
        fileNameSnapshot: null,
        fileSizeSnapshot: null,
        mimeSnapshot: null,
        category: 'FILE',
        createdAt: new Date('2026-07-22T00:00:00.000Z'),
      }],
      forwardContext: null,
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
      ...messageRelations,
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
      ...messageRelations,
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
      ...messageRelations,
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
