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
      triggerPushForOfflineRecipients: jest.fn(),
    };
    return {
      chatClient,
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
