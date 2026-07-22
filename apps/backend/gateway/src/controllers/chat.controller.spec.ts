import type { ClientProxy } from '@nestjs/microservices';
import { CHAT_PATTERNS } from '@org/core';
import { of } from 'rxjs';

import { ChatGatewayController } from './chat.controller';

describe('ChatGatewayController', () => {
  function controller() {
    const chatClient = { send: jest.fn(() => of({ id: 'message-1' })) };
    const userClient = { send: jest.fn(() => of([])) };
    const socketGateway = {
      broadcastMessage: jest.fn(),
      broadcastMessageUpdated: jest.fn(),
      broadcastMessageDeleted: jest.fn(),
      emitToUser: jest.fn(),
      triggerPushForOfflineRecipients: jest.fn(),
    };
    return {
      chatClient,
      userClient,
      socketGateway,
      controller: new ChatGatewayController(
        chatClient as unknown as ClientProxy,
        userClient as unknown as ClientProxy,
        socketGateway as never,
      ),
    };
  }

  it('passes fileCategory when sending a file message over HTTP', async () => {
    const ctx = controller();

    await ctx.controller.sendMessage(
      { sub: 'user-1' } as never,
      'chat-1',
      {
        type: 'IMAGE',
        text: null,
        fileId: '11111111-1111-4111-8111-111111111111',
        fileBucket: 'media',
        fileKey: 'chat/file.png',
        fileName: 'file.png',
        fileSize: 123,
        fileMime: 'image/png',
        fileCategory: 'IMAGE',
      } as never,
    );

    expect(ctx.chatClient.send).toHaveBeenCalledWith(
      CHAT_PATTERNS.SEND_MESSAGE,
      expect.objectContaining({ fileCategory: 'IMAGE' }),
    );
  });

  it('uses an explicit self-chat RPC pattern', async () => {
    const ctx = controller();

    await ctx.controller.createSelf({ sub: 'user-1' } as never);

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.CREATE_SELF, { userId: 'user-1' });
  });

  it('uses an explicit mark-read RPC pattern', async () => {
    const ctx = controller();

    await ctx.controller.markRead({ sub: 'user-1' } as never, 'chat-1', {
      messageId: 'message-1',
    } as never);

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.MARK_READ, {
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: 'message-1',
    });
  });

  it('patches a message and broadcasts message:updated', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockReturnValue(of({ id: 'message-1', chatId: 'chat-1', text: 'after' }));

    await expect(
      ctx.controller.editMessage({ sub: 'user-1' } as never, 'chat-1', 'message-1', {
        text: 'after',
      } as never),
    ).resolves.toEqual(expect.objectContaining({ id: 'message-1', text: 'after' }));

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.EDIT_MESSAGE, {
      chatId: 'chat-1',
      messageId: 'message-1',
      userId: 'user-1',
      text: 'after',
    });
    expect(ctx.socketGateway.broadcastMessageUpdated).toHaveBeenCalledWith(
      'chat-1',
      expect.objectContaining({ id: 'message-1' }),
    );
  });

  it('deletes a message for the current user and emits message:hidden to that user', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockReturnValue(of({ id: 'message-1', chatId: 'chat-1' }));

    await expect(
      ctx.controller.deleteMessage({ sub: 'user-1' } as never, 'chat-1', 'message-1', {
        mode: 'ME',
      } as never),
    ).resolves.toEqual({ id: 'message-1', chatId: 'chat-1' });

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.DELETE_MESSAGE, {
      chatId: 'chat-1',
      messageId: 'message-1',
      userId: 'user-1',
      mode: 'ME',
    });
    expect(ctx.socketGateway.emitToUser).toHaveBeenCalledWith('user-1', 'message:hidden', {
      chatId: 'chat-1',
      messageId: 'message-1',
    });
    expect(ctx.socketGateway.broadcastMessageDeleted).not.toHaveBeenCalled();
  });

  it('deletes a message for everyone and broadcasts message:deleted', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockReturnValue(of({ id: 'message-1', chatId: 'chat-1' }));

    await ctx.controller.deleteMessage({ sub: 'user-1' } as never, 'chat-1', 'message-1', {
      mode: 'EVERYONE',
    } as never);

    expect(ctx.socketGateway.broadcastMessageDeleted).toHaveBeenCalledWith('chat-1', 'message-1');
    expect(ctx.socketGateway.emitToUser).not.toHaveBeenCalled();
  });

  it('enriches forwarded messages with their original sender profile before broadcasting', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockReturnValue(of([
      {
        id: '11111111-1111-4111-8111-111111111111',
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        forwardedFromId: '44444444-4444-4444-8444-444444444444',
        forwardedFromSenderId: '55555555-5555-4555-8555-555555555555',
        forwardedFromCreatedAt: '2026-07-21T10:15:00.000Z',
      },
    ]));
    ctx.userClient.send.mockReturnValue(of([
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Alice',
        displayName: 'Alice A.',
        avatarUrl: null,
        bio: null,
      },
    ]));

    await expect(
      ctx.controller.forwardMessages({ sub: '33333333-3333-4333-8333-333333333333' } as never, 'target-chat', {
        sourceChatId: 'source-chat',
        messageIds: ['44444444-4444-4444-8444-444444444444'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        forwardedFromSender: expect.objectContaining({
          id: '55555555-5555-4555-8555-555555555555',
          displayName: 'Alice A.',
        }),
      }),
    ]);

    expect(ctx.socketGateway.broadcastMessage).toHaveBeenCalledWith(
      'target-chat',
      expect.objectContaining({
        forwardedFromSender: expect.objectContaining({ id: '55555555-5555-4555-8555-555555555555' }),
      }),
    );
  });

  it('logs forwarded sender enrichment misses without raw ids or message text', async () => {
    const ctx = controller();
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(ctx.controller, 'logger', { value: logger });
    ctx.chatClient.send.mockReturnValue(of([
      {
        id: '11111111-1111-4111-8111-111111111111',
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        text: 'secret forwarded text',
        forwardedFromId: '44444444-4444-4444-8444-444444444444',
        forwardedFromSenderId: '55555555-5555-4555-8555-555555555555',
        forwardedFromCreatedAt: '2026-07-21T10:15:00.000Z',
      },
    ]));
    ctx.userClient.send.mockReturnValue(of([]));

    await ctx.controller.forwardMessages(
      { sub: '33333333-3333-4333-8333-333333333333' } as never,
      '22222222-2222-4222-8222-222222222222',
      {
        sourceChatId: '66666666-6666-4666-8666-666666666666',
        messageIds: ['44444444-4444-4444-8444-444444444444'],
      },
    );

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'message_forward_requested',
      hasTargetChatId: true,
      hasSourceChatId: true,
      hasUserId: true,
      messageCount: 1,
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'forwarded_message_sender_profiles_missing',
      senderCount: 1,
      profileCount: 0,
      missingCount: 1,
    }));

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('33333333-3333-4333-8333-333333333333');
    expect(diagnosticPayload).not.toContain('55555555-5555-4555-8555-555555555555');
    expect(diagnosticPayload).not.toContain('secret forwarded text');
  });

  it('does not write raw HTTP chat request data to diagnostic logs', async () => {
    const ctx = controller();
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(ctx.controller, 'logger', { value: logger });

    await ctx.controller.createSelf({ sub: 'user-secret-id' } as never);
    await ctx.controller.sendMessage(
      { sub: 'user-secret-id' } as never,
      'chat-secret-id',
      {
        type: 'FILE',
        text: 'message text token=secret',
        fileName: 'file.png',
      } as never,
    );
    await ctx.controller.markRead(
      { sub: 'user-secret-id' } as never,
      'chat-secret-id',
      { messageId: 'message-secret-id' } as never,
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
      expect.objectContaining({ eventType: 'message_send_requested', hasChatId: true, hasUserId: true }),
    );
  });
});
