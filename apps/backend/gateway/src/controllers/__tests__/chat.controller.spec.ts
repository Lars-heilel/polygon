import type { ClientProxy } from '@nestjs/microservices';
import { CHAT_PATTERNS, USER_PATTERNS } from '@org/core';
import { of, type Observable } from 'rxjs';

import { ChatGatewayController } from '../chat.controller';

describe('ChatGatewayController', () => {
  function controller() {
    const chatClient = { send: jest.fn<Observable<unknown>, [string, unknown?]>(() => of({ id: 'message-1' })) };
    const userClient = { send: jest.fn<Observable<unknown>, [string, unknown?]>(() => of([])) };
    const socketGateway = {
      broadcastMessage: jest.fn(),
      broadcastMessageUpdated: jest.fn(),
      broadcastMessageDeleted: jest.fn(),
      emitToUser: jest.fn(),
      triggerPushForOfflineRecipients: jest.fn<Promise<string[]>, []>().mockResolvedValue([]),
    };
    const store = new Map<string, string>();
    const chatCache = {
      getChatList: jest.fn(async (userId: string) => {
        const raw = store.get(`chat:list:${userId}`);
        return raw ? (JSON.parse(raw) as unknown) : null;
      }),
      setChatList: jest.fn(async (userId: string, chats: unknown) => {
        store.set(`chat:list:${userId}`, JSON.stringify(chats));
      }),
      invalidateChatList: jest.fn(async (userId: string) => {
        store.delete(`chat:list:${userId}`);
      }),
      getMessagesPage: jest.fn(async (chatId: string, cursor: string, userId?: string, take?: number) => {
        const raw = store.get(`chat:msgs:${chatId}:${userId ?? '-'}:${cursor}:${take ?? '-'}`);
        return raw ? (JSON.parse(raw) as unknown) : null;
      }),
      setMessagesPage: jest.fn(async (chatId: string, cursor: string, page: unknown, _ttlSec = 60, userId?: string, take?: number) => {
        store.set(`chat:msgs:${chatId}:${userId ?? '-'}:${cursor}:${take ?? '-'}`, JSON.stringify(page));
      }),
      invalidateChatPages: jest.fn(async (chatId: string) => {
        for (const key of [...store.keys()]) {
          if (key.startsWith(`chat:msgs:${chatId}:`)) store.delete(key);
        }
      }),
    };
    return {
      chatClient,
      userClient,
      socketGateway,
      chatCache,
      res: () => ({ setHeader: jest.fn() }),
      controller: new ChatGatewayController(
        chatClient as unknown as ClientProxy,
        userClient as unknown as ClientProxy,
        socketGateway as never,
        chatCache as never,
      ),
    };
  }

  it('GET /chats serves from cache on second call', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockReturnValueOnce(of([{ id: 'c1' }]));
    const firstRes = ctx.res();
    const secondRes = ctx.res();

    await ctx.controller.getChats({ sub: 'user-1' } as never, firstRes as never);
    await ctx.controller.getChats({ sub: 'user-1' } as never, secondRes as never);

    expect(ctx.chatClient.send).toHaveBeenCalledTimes(1);
    expect(firstRes.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(secondRes.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
  });

  it('GET /chats/:id/messages serves from cache on second call', async () => {
    const ctx = controller();
    const page = { messages: [], nextCursor: null };
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(true);
      return of(page);
    });
    const firstRes = ctx.res();
    const secondRes = ctx.res();

    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, undefined, firstRes as never);
    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, undefined, secondRes as never);

    expect(ctx.chatClient.send).toHaveBeenCalledWith(
      CHAT_PATTERNS.GET_MESSAGES,
      expect.objectContaining({ chatId: 'chat-1', userId: 'user-1' }),
    );
    expect(
      ctx.chatClient.send.mock.calls.filter(([pattern]) => pattern === CHAT_PATTERNS.GET_MESSAGES),
    ).toHaveLength(1);
    expect(firstRes.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(secondRes.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
  });

  it('GET /chats/:id/messages misses for a different user (per-user pages)', async () => {
    const ctx = controller();
    const page = { messages: [], nextCursor: null };
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(true);
      return of(page);
    });

    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, undefined, ctx.res() as never);
    const secondRes = ctx.res();
    await ctx.controller.getMessages({ sub: 'user-2' } as never, 'chat-1', undefined, undefined, secondRes as never);

    expect(secondRes.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(
      ctx.chatClient.send.mock.calls.filter(([pattern]) => pattern === CHAT_PATTERNS.GET_MESSAGES),
    ).toHaveLength(2);
  });

  it('GET /chats/:id/messages rejects non-members without touching the cache', async () => {
    const ctx = controller();
    const page = { messages: [], nextCursor: null };
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(true);
      return of(page);
    });

    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, undefined, ctx.res() as never);
    expect(ctx.chatCache.getMessagesPage).toHaveBeenCalled();

    ctx.chatCache.getMessagesPage.mockClear();
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(false);
      return of(page);
    });

    await expect(
      ctx.controller.getMessages({ sub: 'intruder' } as never, 'chat-1', undefined, undefined, ctx.res() as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(ctx.chatCache.getMessagesPage).not.toHaveBeenCalled();
  });

  it('GET /chats/:id/messages keys pages by take', async () => {
    const ctx = controller();
    const page = { messages: [], nextCursor: null };
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(true);
      return of(page);
    });

    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, '5', ctx.res() as never);
    const secondRes = ctx.res();
    await ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1', undefined, '50', secondRes as never);

    expect(secondRes.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(ctx.chatCache.setMessagesPage).toHaveBeenCalledWith(
      'chat-1',
      'HEAD',
      expect.anything(),
      expect.anything(),
      'user-1',
      5,
    );
    expect(ctx.chatCache.setMessagesPage).toHaveBeenCalledWith(
      'chat-1',
      'HEAD',
      expect.anything(),
      expect.anything(),
      'user-1',
      50,
    );
  });

  it('sendMessage invalidates chat pages and member lists', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.SEND_MESSAGE) return of({ id: 'message-1', chatId: 'chat-1' });
      return of([{ userId: 'user-1' }, { userId: 'user-2' }]);
    });
    ctx.socketGateway.triggerPushForOfflineRecipients.mockResolvedValue(['user-1', 'user-2']);

    await ctx.controller.sendMessage({ sub: 'user-1' } as never, 'chat-1', {
      text: 'hello',
    } as never);

    expect(ctx.chatCache.invalidateChatPages).toHaveBeenCalledWith('chat-1');
    expect(ctx.chatCache.invalidateChatList).toHaveBeenCalledWith('user-1');
    expect(ctx.chatCache.invalidateChatList).toHaveBeenCalledWith('user-2');
  });

  it('falls back to GET_MEMBERS when push returns no member ids', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.SEND_MESSAGE) return of({ id: 'message-1', chatId: 'chat-1' });
      if (pattern === CHAT_PATTERNS.GET_MEMBERS) return of([{ userId: 'user-1' }, { userId: 'user-2' }]);
      return of([]);
    });
    ctx.socketGateway.triggerPushForOfflineRecipients.mockResolvedValue([]);

    await ctx.controller.sendMessage({ sub: 'user-1' } as never, 'chat-1', {
      text: 'hello',
    } as never);

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.GET_MEMBERS, { chatId: 'chat-1' });
    expect(ctx.chatCache.invalidateChatPages).toHaveBeenCalledWith('chat-1');
    expect(ctx.chatCache.invalidateChatList).toHaveBeenCalledWith('user-1');
    expect(ctx.chatCache.invalidateChatList).toHaveBeenCalledWith('user-2');
  });

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

  it('loads messages and enriches forwarded author snapshots for display', async () => {
    const ctx = controller();
    ctx.chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === CHAT_PATTERNS.CHECK_MEMBERSHIP) return of(true);
      return of({
        messages: [{
          id: 'message-1',
          chatId: 'chat-1',
          senderId: 'sender-1',
          type: 'TEXT',
          text: 'forwarded text',
          attachments: [],
          forwardContext: {
            originalAuthorId: 'author-1',
            originalAuthorNameSnapshot: 'author-1',
            originalAuthorDisplayNameSnapshot: null,
          },
        }],
        nextCursor: null,
      });
    });
    ctx.userClient.send.mockReturnValue(of([{
      id: 'author-1',
      name: 'Alice',
      displayName: 'Alice A.',
      avatarUrl: null,
      bio: null,
    }]));

    await expect(
      ctx.controller.getMessages({ sub: 'user-1' } as never, 'chat-1'),
    ).resolves.toEqual({
      messages: [expect.objectContaining({
        id: 'message-1',
        forwardContext: expect.objectContaining({
          originalAuthorId: 'author-1',
          originalAuthorNameSnapshot: 'Alice',
          originalAuthorDisplayNameSnapshot: 'Alice A.',
        }),
      })],
      nextCursor: null,
    });

    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.GET_MESSAGES, {
      chatId: 'chat-1',
      userId: 'user-1',
      cursor: undefined,
      take: undefined,
    });
    expect(ctx.userClient.send).toHaveBeenCalledWith(USER_PATTERNS.GET_MANY_BY_IDS, {
      ids: ['author-1'],
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

  it('prepares source messages, snapshots original authors, and sends clone command', async () => {
    const ctx = controller();
    ctx.chatClient.send
      .mockReturnValueOnce(of([{
        messageId: '11111111-1111-4111-8111-111111111111',
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'VOICE',
        text: null,
        createdAt: new Date('2026-07-22T10:00:00.000Z'),
        attachments: [{
          mediaId: '44444444-4444-4444-8444-444444444444',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
        }],
        forwardContext: null,
      }]))
      .mockReturnValueOnce(of([{
        id: 'cloned-message',
        chatId: 'target-chat',
        senderId: 'forwarder',
        type: 'VOICE',
        text: null,
        attachments: [],
        forwardContext: null,
      }]));
    ctx.userClient.send.mockReturnValue(of([{
      id: '33333333-3333-4333-8333-333333333333',
      name: 'tamilka',
      displayName: 'Тамилка:3',
      avatarUrl: null,
      bio: null,
    }]));

    await ctx.controller.forwardMessages({ sub: 'forwarder' } as never, 'target-chat', {
      sourceChatId: 'source-chat',
      messageIds: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(ctx.chatClient.send).toHaveBeenNthCalledWith(
      1,
      CHAT_PATTERNS.PREPARE_FORWARD_MESSAGES,
      expect.any(Object),
    );
    expect(ctx.userClient.send).toHaveBeenCalled();
    expect(ctx.chatClient.send).toHaveBeenNthCalledWith(
      2,
      CHAT_PATTERNS.CLONE_FORWARD_MESSAGES,
      expect.objectContaining({
        messages: [expect.objectContaining({
          originalAuthorNameSnapshot: 'tamilka',
          originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        })],
      }),
    );
  });

  it('preserves an existing root forward context when cloning', async () => {
    const ctx = controller();
    ctx.chatClient.send
      .mockReturnValueOnce(of([{
        messageId: '11111111-1111-4111-8111-111111111111',
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'TEXT',
        text: 'visible copy',
        createdAt: new Date('2026-07-21T10:15:00.000Z'),
        attachments: [],
        forwardContext: {
          originalMessageId: '44444444-4444-4444-8444-444444444444',
          originalChatId: 'source-chat',
          originalAuthorId: '55555555-5555-4555-8555-555555555555',
          originalAuthorNameSnapshot: 'Saved Alice',
          originalAuthorDisplayNameSnapshot: 'Saved A.',
          originalMessageCreatedAt: new Date('2026-07-20T10:15:00.000Z'),
          originalMessageType: 'TEXT',
          originalTextPreview: 'original visible copy',
          originalFileNamePreview: null,
        },
      }]))
      .mockReturnValueOnce(of([{
        id: 'cloned-message',
        chatId: 'target-chat',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'TEXT',
        text: 'visible copy',
        attachments: [],
        forwardContext: null,
      }]));
    ctx.userClient.send.mockReturnValue(of([
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Updated Alice',
        displayName: 'Updated A.',
        avatarUrl: null,
        bio: null,
      },
    ]));

    await expect(
      ctx.controller.forwardMessages({ sub: '33333333-3333-4333-8333-333333333333' } as never, 'target-chat', {
        sourceChatId: 'source-chat',
        messageIds: ['44444444-4444-4444-8444-444444444444'],
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'cloned-message' })]);

    expect(ctx.chatClient.send).toHaveBeenNthCalledWith(
      2,
      CHAT_PATTERNS.CLONE_FORWARD_MESSAGES,
      expect.objectContaining({
        messages: [expect.objectContaining({
          forwardContext: expect.objectContaining({
            originalAuthorNameSnapshot: 'Saved Alice',
            originalAuthorDisplayNameSnapshot: 'Saved A.',
          }),
        })],
      }),
    );
    expect(ctx.socketGateway.broadcastMessage).toHaveBeenCalledWith(
      'target-chat',
      expect.objectContaining({ id: 'cloned-message' }),
    );
  });

  it('logs forwarded sender enrichment misses without raw ids or message text', async () => {
    const ctx = controller();
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(ctx.controller, 'logger', { value: logger });
    ctx.chatClient.send
      .mockReturnValueOnce(of([{
        messageId: '11111111-1111-4111-8111-111111111111',
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        text: 'secret forwarded text',
        type: 'TEXT',
        createdAt: new Date('2026-07-21T10:15:00.000Z'),
        attachments: [],
        forwardContext: null,
      }]))
      .mockReturnValueOnce(of([]));
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
      eventType: 'message_forward_author_snapshot_missing',
      authorCount: 1,
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
