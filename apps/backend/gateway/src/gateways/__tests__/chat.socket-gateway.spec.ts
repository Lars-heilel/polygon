import type { ClientProxy } from '@nestjs/microservices';
import { of, type Observable } from 'rxjs';

function makeSocket(cookie = 'access_token=token') {
  return {
    id: `socket-${Math.random()}`,
    handshake: { headers: { cookie } },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };
}

describe('ChatSocketGateway ban enforcement', () => {
  type TokenServiceMock = {
    verifyAccessToken: jest.Mock;
  };
  type BanMarkersMock = {
    findActiveMarker: jest.Mock;
  };
  type ChatSocketGatewayUnderTest = {
    handleConnection(socket: never): Promise<void>;
    handleDisconnect(socket: never): Promise<void>;
    handleJoin(socket: never, payload: { chatId: string }): Promise<void>;
    isUserOnline(userId: string): Promise<boolean>;
    disconnectUser(userId: string): void;
    triggerPushForOfflineRecipients(
      chatId: string,
      senderId: string,
      message: { text?: string | null; [key: string]: unknown },
    ): Promise<string[]>;
    broadcastMessageUpdated(chatId: string, message: unknown): void;
    broadcastMessageDeleted(chatId: string, messageId: string): void;
    emitToUser(userId: string, event: string, payload: unknown): void;
    handleTypingStart(socket: never, payload: { chatId: string }): Promise<void>;
    handleTypingStop(socket: never, payload: { chatId: string }): Promise<void>;
    handleSendMessage(
      socket: never,
      payload: {
        chatId: string;
        text?: string;
        type?: string;
        fileName?: string;
        clientId?: string;
        attachments?: {
          mediaId: string;
          fileNameSnapshot: string | null;
          fileSizeSnapshot: number | null;
          mimeSnapshot: string | null;
          category: string;
        }[];
      },
    ): Promise<void>;
  };
  const tokenService: TokenServiceMock = {
    verifyAccessToken: jest.fn(),
  };
  type ChatClientResult = boolean | { userId: string }[] | { id: string; text?: string | null };
  const chatClient: { send: jest.Mock<Observable<ChatClientResult>, [string]> } = {
    send: jest.fn((_pattern: string) => of(true)),
  };
  const notificationClient = {
    emit: jest.fn(),
  };
  const userClient = {
    send: jest.fn(),
  };
  const banMarkers: BanMarkersMock = {
    findActiveMarker: jest.fn(),
  };

  type ChatSocketGatewayConstructor = new (
    tokenService: TokenServiceMock,
    chatClient: ClientProxy,
    notificationClient: ClientProxy,
    userClient: ClientProxy,
    banMarkers: BanMarkersMock,
    redis: unknown,
    chatCache: unknown,
  ) => ChatSocketGatewayUnderTest;

  let ChatSocketGateway: ChatSocketGatewayConstructor;

  function makeRedis() {
    const sets = new Map<string, Set<string>>();
    const strings = new Map<string, string>();
    return {
      sets,
      sadd: jest.fn(async (key: string, ...members: string[]) => {
        const set = sets.get(key) ?? new Set<string>();
        let added = 0;
        for (const member of members) {
          if (!set.has(member)) {
            set.add(member);
            added++;
          }
        }
        sets.set(key, set);
        return added;
      }),
      srem: jest.fn(async (key: string, ...members: string[]) => {
        const set = sets.get(key);
        if (!set) return 0;
        let removed = 0;
        for (const member of members) {
          if (set.delete(member)) removed++;
        }
        return removed;
      }),
      scard: jest.fn(async (key: string) => sets.get(key)?.size ?? 0),
      exists: jest.fn(async (key: string) => ((sets.get(key)?.size ?? 0) > 0 || strings.has(key) ? 1 : 0)),
      expire: jest.fn(async () => 1),
      set: jest.fn(async (key: string, value: string) => {
        strings.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => strings.get(key) ?? null),
      del: jest.fn(async (...keys: string[]) => {
        let removed = 0;
        for (const key of keys) {
          if (sets.delete(key)) removed++;
          if (strings.delete(key)) removed++;
        }
        return removed;
      }),
    };
  }

  type RedisMock = ReturnType<typeof makeRedis>;

  function makeChatCache() {
    return {
      getChatList: jest.fn(async () => null),
      setChatList: jest.fn(async () => undefined),
      invalidateChatList: jest.fn(async () => undefined),
      getMessagesPage: jest.fn(async () => null),
      setMessagesPage: jest.fn(async () => undefined),
      invalidateChatPages: jest.fn(async () => undefined),
    };
  }

  type ChatCacheMock = ReturnType<typeof makeChatCache>;

  let gateway: ChatSocketGatewayUnderTest;
  let redis: RedisMock;
  let chatCache: ChatCacheMock;
  let logger: {
    debug: jest.Mock;
    error: jest.Mock;
    log: jest.Mock;
    warn: jest.Mock;
  };

  beforeAll(async () => {
    Object.assign(process.env, {
      AUTH_DATABASE_URL: 'postgres://user:pass@localhost:5432/auth',
      USER_DATABASE_URL: 'postgres://user:pass@localhost:5432/user',
      CHAT_DATABASE_URL: 'postgres://user:pass@localhost:5432/chat',
      NOTIFICATION_DATABASE_URL: 'postgres://user:pass@localhost:5432/notification',
      MEDIA_DATABASE_URL: 'postgres://user:pass@localhost:5432/media',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'minio',
      MINIO_SECRET_KEY: 'minio-secret',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-refresh-secret',
      JWT_ACCESS_TOKEN_EXPIRES: '900',
      JWT_REFRESH_TOKEN_EXPIRES: '604800',
      RABBITMQ_URL: 'amqp://localhost',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: '',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VAPID_SUBJECT: 'mailto:test@example.com',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_USER: 'smtp',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'test@example.com',
      MEILISEARCH_URL: 'http://localhost:7700',
      MEILISEARCH_MASTER_KEY: 'master-key',
      SEARCH_PORT: '3006',
      GATEWAY_PORT: '3000',
      AUTH_PORT: '3002',
      USER_PORT: '3001',
      CHAT_PORT: '3003',
      MEDIA_PORT: '3004',
      NOTIFICATION_PORT: '3005',
      APP_URL: 'http://localhost:3000',
      CLIENT_URL: 'http://localhost:4200',
      GITHUB_CLIENT_ID: 'github-client',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    ({ ChatSocketGateway } = jest.requireActual('../chat.socket-gateway') as {
      ChatSocketGateway: ChatSocketGatewayConstructor;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis = makeRedis();
    chatCache = makeChatCache();
    gateway = new ChatSocketGateway(
      tokenService,
      chatClient as unknown as ClientProxy,
      notificationClient as unknown as ClientProxy,
      userClient as unknown as ClientProxy,
      banMarkers,
      redis,
      chatCache,
    );
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> }; to: jest.Mock } }).server = {
      sockets: { sockets: new Map() },
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    Object.defineProperty(gateway, 'logger', { value: logger });
    tokenService.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    banMarkers.findActiveMarker.mockResolvedValue(null);
  });

  it('checks the ban marker after JWT verification before registering a socket', async () => {
    const socket = makeSocket();

    await gateway.handleConnection(socket as never);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('token');
    expect(banMarkers.findActiveMarker).toHaveBeenCalledWith('user-1');
    expect(await gateway.isUserOnline('user-1')).toBe(true);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('emits a structured ACCOUNT_BANNED error and disconnects banned sockets', async () => {
    const socket = makeSocket();
    banMarkers.findActiveMarker.mockResolvedValue({
      reason: 'Spam',
      bannedUntil: '2026-07-09T10:00:00.000Z',
    });

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith('auth:error', {
      code: 'ACCOUNT_BANNED',
      reason: 'Spam',
      bannedUntil: '2026-07-09T10:00:00.000Z',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(await gateway.isUserOnline('user-1')).toBe(false);
  });

  it('fails closed when the ban marker repository cannot parse Redis state', async () => {
    const socket = makeSocket();
    banMarkers.findActiveMarker.mockRejectedValue(new Error('Invalid ban marker'));

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith('auth:error', {
      code: 'ACCOUNT_BAN_CHECK_UNAVAILABLE',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(await gateway.isUserOnline('user-1')).toBe(false);
  });

  it('disconnectUser disconnects every registered socket and removes the map entry', async () => {
    const firstSocket = makeSocket();
    firstSocket.id = 'socket-1';
    const secondSocket = makeSocket();
    secondSocket.id = 'socket-2';
    const serverSockets = new Map<string, unknown>([
      [firstSocket.id, firstSocket],
      [secondSocket.id, secondSocket],
    ]);
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> } } }).server = {
      sockets: { sockets: serverSockets },
    };

    await gateway.handleConnection(firstSocket as never);
    await gateway.handleConnection(secondSocket as never);

    gateway.disconnectUser('user-1');

    expect(firstSocket.disconnect).toHaveBeenCalledWith(true);
    expect(secondSocket.disconnect).toHaveBeenCalledWith(true);
    expect(await gateway.isUserOnline('user-1')).toBe(false);
  });

  it('does not write raw websocket auth identifiers to diagnostic logs', async () => {
    tokenService.verifyAccessToken.mockReturnValue({ sub: 'user-secret-id' });
    const socket = makeSocket('access_token=access-secret-token');
    socket.id = 'socket-secret-id';

    await gateway.handleConnection(socket as never);
    await gateway.handleDisconnect(socket as never);

    banMarkers.findActiveMarker.mockRejectedValueOnce(
      new Error('Invalid ban marker for user@example.com token=secret'),
    );
    const rejectedSocket = makeSocket('access_token=another-access-secret-token');
    await gateway.handleConnection(rejectedSocket as never);

    const diagnosticPayload = JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
      logger.debug.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('socket-secret-id');
    expect(diagnosticPayload).not.toContain('access-secret-token');
    expect(diagnosticPayload).not.toContain('another-access-secret-token');
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('token=secret');
  });

  it('does not write raw chat or push identifiers to diagnostic logs', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'sender-secret-id';
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(true);
      if (pattern === 'chat.getMembers') {
        return of([{ userId: 'sender-secret-id' }, { userId: 'recipient-secret-id' }]);
      }
      return of(true);
    });
    userClient.send.mockReturnValue(of({ name: 'Secret Sender', displayName: 'Secret Display' }));

    await gateway.handleJoin(socket as never, { chatId: 'chat-secret-id' });
    await gateway.triggerPushForOfflineRecipients('chat-secret-id', 'sender-secret-id', {
      id: 'message-secret-id',
      text: 'hello',
    });

    const diagnosticPayload = JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
      logger.debug.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('sender-secret-id');
    expect(diagnosticPayload).not.toContain('recipient-secret-id');
    expect(diagnosticPayload).not.toContain('chat-secret-id');
    expect(diagnosticPayload).not.toContain('message-secret-id');
    expect(diagnosticPayload).not.toContain('Secret Sender');
    expect(diagnosticPayload).not.toContain('Secret Display');
  });

  it('does not write raw socket message contents or file names to diagnostic logs', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-secret-id';
    chatClient.send.mockReturnValue(of({ id: 'message-secret-id', text: 'message text token=secret' }));

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-secret-id',
      type: 'FILE',
      text: 'message text token=secret',
      fileName: 'file.png',
    });

    const diagnosticPayload = JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
      logger.debug.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('chat-secret-id');
    expect(diagnosticPayload).not.toContain('message text');
    expect(diagnosticPayload).not.toContain('file.png');
    expect(diagnosticPayload).not.toContain('token=secret');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'socket_message_send_requested', hasChatId: true, hasUserId: true }),
    );
  });

  it('passes clientId through socket send and broadcasts it with the message', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> }; to: jest.Mock } }).server = {
      sockets: { sockets: new Map() },
      to,
    };
    const message = {
      id: 'server-message-1',
      clientId: '44444444-4444-4444-8444-444444444444',
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'TEXT',
      text: 'hello',
    };
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(true);
      if (pattern === 'chat.sendMessage') return of(message);
      if (pattern === 'chat.getMembers') return of([{ userId: 'user-1' }]);
      return of(true);
    });

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      text: 'hello',
      clientId: '44444444-4444-4444-8444-444444444444',
    });

    expect(chatClient.send).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'hello',
      clientId: '44444444-4444-4444-8444-444444444444',
    }));
    expect(to).toHaveBeenCalledWith('chat:chat-1');
    expect(emit).toHaveBeenCalledWith('message:new', expect.objectContaining({
      id: 'server-message-1',
      clientId: '44444444-4444-4444-8444-444444444444',
    }));
  });

  it('passes attachment payloads through socket media sends', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    const attachments = [
      {
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'image.png',
        fileSizeSnapshot: 4096,
        mimeSnapshot: 'image/png',
        category: 'IMAGE',
      },
    ];
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(true);
      if (pattern === 'chat.getMembers') return of([{ userId: 'user-1' }]);
      return of({
        id: 'message-1',
        chatId: 'chat-1',
        type: 'IMAGE',
        attachments,
      });
    });

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      clientId: '44444444-4444-4444-8444-444444444444',
      type: 'IMAGE',
      attachments,
    });

    expect(chatClient.send).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      chatId: 'chat-1',
      senderId: 'user-1',
      type: 'IMAGE',
      attachments,
    }));
  });

  it('broadcasts updated and deleted message events to a chat room', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> }; to: jest.Mock } }).server = {
      sockets: { sockets: new Map() },
      to,
    };

    gateway.broadcastMessageUpdated('chat-1', { id: 'message-1' });
    gateway.broadcastMessageDeleted('chat-1', 'message-1');

    expect(to).toHaveBeenCalledWith('chat:chat-1');
    expect(emit).toHaveBeenCalledWith('message:updated', { id: 'message-1' });
    expect(emit).toHaveBeenCalledWith('message:deleted', {
      chatId: 'chat-1',
      messageId: 'message-1',
    });
  });

  it('tracks presence in Redis with a 120s TTL instead of a local map', async () => {
    const socket = makeSocket();

    await gateway.handleConnection(socket as never);

    expect(redis.sadd).toHaveBeenCalledWith('presence:user-1', socket.id);
    expect(redis.expire).toHaveBeenCalledWith('presence:user-1', 120);
    expect(await gateway.isUserOnline('user-1')).toBe(true);

    await gateway.handleDisconnect(socket as never);

    expect(await gateway.isUserOnline('user-1')).toBe(false);
  });

  it('falls back to offline when Redis presence checks fail', async () => {
    redis.exists.mockRejectedValueOnce(new Error('redis down'));

    await expect(gateway.isUserOnline('user-1')).resolves.toBe(false);
  });

  it('stores typing state with a short TTL and relays it to the room', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gateway as unknown as { server: { to: jest.Mock } }).server = {
      ...(gateway as unknown as { server: object }).server,
      to,
    };

    await gateway.handleTypingStart(socket as never, { chatId: 'chat-1' });

    expect(redis.set).toHaveBeenCalledWith('typing:chat-1:user-1', '1', 'EX', 3);
    expect(to).toHaveBeenCalledWith('chat:chat-1');
    expect(emit).toHaveBeenCalledWith('user:typing', {
      userId: 'user-1',
      chatId: 'chat-1',
      isTyping: true,
    });

    await gateway.handleTypingStop(socket as never, { chatId: 'chat-1' });

    expect(redis.del).toHaveBeenCalledWith('typing:chat-1:user-1');
    expect(emit).toHaveBeenCalledWith('user:typing', {
      userId: 'user-1',
      chatId: 'chat-1',
      isTyping: false,
    });
  });

  it('rejects invalid socket message payloads with a structured error', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      text: '',
    });

    expect(chatClient.send).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'message:send:error',
      expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.any(String) }),
    );
  });

  it('rejects socket sends from non-members with a structured error', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(false);
      return of(true);
    });

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      text: 'hello',
    });

    expect(socket.emit).toHaveBeenCalledWith(
      'message:send:error',
      expect.objectContaining({ code: 'FORBIDDEN', message: expect.any(String) }),
    );
    expect(socket.emit).not.toHaveBeenCalledWith(
      'message:new',
      expect.anything(),
    );
  });

  it('invalidates chat cache pages and lists after a socket send', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(true);
      if (pattern === 'chat.getMembers') return of([{ userId: 'user-1' }, { userId: 'user-2' }]);
      return of({ id: 'message-1', chatId: 'chat-1', text: 'hello' });
    });
    userClient.send.mockReturnValue(of({ name: 'Sender', displayName: null }));

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      text: 'hello',
    });

    expect(chatCache.invalidateChatPages).toHaveBeenCalledWith('chat-1');
    expect(chatCache.invalidateChatList).toHaveBeenCalledWith('user-1');
    expect(chatCache.invalidateChatList).toHaveBeenCalledWith('user-2');
  });

  it('falls back to GET_MEMBERS for invalidation when push fails', async () => {
    const socket = makeSocket();
    (socket.data as Record<string, string>)['userId'] = 'user-1';
    chatClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'chat.checkMembership') return of(true);
      if (pattern === 'chat.getMembers') return of([{ userId: 'user-1' }, { userId: 'user-2' }]);
      return of({ id: 'message-1', chatId: 'chat-1', text: 'hello' });
    });
    userClient.send.mockReturnValue(of({ name: 'Sender', displayName: null }));
    notificationClient.emit.mockImplementation(() => {
      throw new Error('push down');
    });

    await gateway.handleSendMessage(socket as never, {
      chatId: 'chat-1',
      text: 'hello',
    });

    expect(chatClient.send).toHaveBeenCalledWith('chat.getMembers', { chatId: 'chat-1' });
    expect(chatCache.invalidateChatPages).toHaveBeenCalledWith('chat-1');
    expect(chatCache.invalidateChatList).toHaveBeenCalledWith('user-1');
    expect(chatCache.invalidateChatList).toHaveBeenCalledWith('user-2');
  });

  it('emits targeted events to every socket for one user', async () => {
    const firstSocket = makeSocket();
    firstSocket.id = 'socket-1';
    const secondSocket = makeSocket();
    secondSocket.id = 'socket-2';
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> }; to: jest.Mock } }).server = {
      sockets: { sockets: new Map() },
      to,
    };

    await gateway.handleConnection(firstSocket as never);
    await gateway.handleConnection(secondSocket as never);
    gateway.emitToUser('user-1', 'message:hidden', { chatId: 'chat-1', messageId: 'message-1' });

    expect(to).toHaveBeenCalledWith('socket-1');
    expect(to).toHaveBeenCalledWith('socket-2');
    expect(emit).toHaveBeenCalledWith('message:hidden', {
      chatId: 'chat-1',
      messageId: 'message-1',
    });
  });
});
