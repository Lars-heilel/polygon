import type { IChatService } from '../../interfaces/chat.interface';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

import { ChatController } from '../chat.controller';

describe('ChatController', () => {
  let service: jest.Mocked<IChatService>;
  let controller: ChatController;

  beforeEach(() => {
    service = {
      createDirectChat: jest.fn(),
      getChats: jest.fn(),
      getMessages: jest.fn(),
      getMediaMessages: jest.fn(),
      sendMessage: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      forwardMessages: jest.fn(),
      checkMembership: jest.fn(),
      getMembers: jest.fn(),
      createSelfChat: jest.fn(),
      markRead: jest.fn(),
      prepareForwardMessages: jest.fn(),
      cloneForwardMessages: jest.fn(),
      getMessageAttachmentForAccess: jest.fn(),
    };
    controller = new ChatController(service);
  });

  it('delegates explicit self-chat creation to the service', async () => {
    const chat = { id: 'chat-self' };
    service.createSelfChat.mockResolvedValue(chat as never);

    await expect(controller.createSelf({ userId: 'user-1' })).resolves.toEqual(chat);

    expect(service.createSelfChat).toHaveBeenCalledWith('user-1');
  });

  it('delegates a read marker to the service', async () => {
    const member = { chatId: 'chat-1', userId: 'user-1' };
    service.markRead.mockResolvedValue(member as never);

    await expect(
      controller.markRead({ chatId: 'chat-1', userId: 'user-1', messageId: 'message-1' }),
    ).resolves.toEqual(member);

    expect(service.markRead).toHaveBeenCalledWith('chat-1', 'user-1', 'message-1');
  });

  it('does not write raw RPC payloads to diagnostic logs', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(controller, 'logger', { value: logger });
    service.sendMessage.mockResolvedValue({ id: 'message-1' } as never);
    service.markRead.mockResolvedValue({ chatId: 'chat-secret-id' } as never);

    await controller.sendMessage({
      chatId: 'chat-secret-id',
      senderId: 'user-secret-id',
      type: 'FILE',
      text: 'message text token=secret',
      fileName: 'file.png',
    });
    await controller.markRead({
      chatId: 'chat-secret-id',
      userId: 'user-secret-id',
      messageId: 'message-secret-id',
    });

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

  it('delegates attachment access to the service', async () => {
    service.getMessageAttachmentForAccess.mockResolvedValue({ mediaId: 'media-1' } as never);

    await expect(controller.getMessageAttachmentForAccess({
      chatId: 'chat-1',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      userId: 'user-1',
    })).resolves.toEqual({ mediaId: 'media-1' });

    expect(service.getMessageAttachmentForAccess).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      userId: 'user-1',
    });
  });

  it('delegates forward preparation and cloning to the service', async () => {
    service.prepareForwardMessages.mockResolvedValue([{ messageId: 'message-1' }] as never);
    service.cloneForwardMessages.mockResolvedValue([{ id: 'cloned-message' }] as never);

    await expect(controller.prepareForwardMessages({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['message-1'],
      userId: 'user-1',
    })).resolves.toEqual([{ messageId: 'message-1' }]);
    await expect(controller.cloneForwardMessages({
      targetChatId: 'target-chat',
      userId: 'user-1',
      messages: [{ messageId: 'message-1' } as never],
    })).resolves.toEqual([{ id: 'cloned-message' }]);

    expect(service.prepareForwardMessages).toHaveBeenCalledWith({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['message-1'],
      userId: 'user-1',
    });
    expect(service.cloneForwardMessages).toHaveBeenCalledWith({
      targetChatId: 'target-chat',
      userId: 'user-1',
      messages: [{ messageId: 'message-1' }],
    });
  });
});
