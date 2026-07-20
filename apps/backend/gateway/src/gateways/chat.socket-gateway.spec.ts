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
    handleDisconnect(socket: never): void;
    handleJoin(socket: never, payload: { chatId: string }): Promise<void>;
    isUserOnline(userId: string): boolean;
    disconnectUser(userId: string): void;
    triggerPushForOfflineRecipients(
      chatId: string,
      senderId: string,
      message: { text?: string | null; [key: string]: unknown },
    ): Promise<void>;
    handleSendMessage(
      socket: never,
      payload: { chatId: string; text?: string; type?: string; fileName?: string },
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
  ) => ChatSocketGatewayUnderTest;

  let ChatSocketGateway: ChatSocketGatewayConstructor;

  let gateway: ChatSocketGatewayUnderTest;
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

    ({ ChatSocketGateway } = jest.requireActual('./chat.socket-gateway') as {
      ChatSocketGateway: ChatSocketGatewayConstructor;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChatSocketGateway(
      tokenService,
      chatClient as unknown as ClientProxy,
      notificationClient as unknown as ClientProxy,
      userClient as unknown as ClientProxy,
      banMarkers,
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
    expect(gateway.isUserOnline('user-1')).toBe(true);
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
    expect(gateway.isUserOnline('user-1')).toBe(false);
  });

  it('fails closed when the ban marker repository cannot parse Redis state', async () => {
    const socket = makeSocket();
    banMarkers.findActiveMarker.mockRejectedValue(new Error('Invalid ban marker'));

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith('auth:error', {
      code: 'ACCOUNT_BAN_CHECK_UNAVAILABLE',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.isUserOnline('user-1')).toBe(false);
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
    expect(gateway.isUserOnline('user-1')).toBe(false);
  });

  it('does not write raw websocket auth identifiers to diagnostic logs', async () => {
    tokenService.verifyAccessToken.mockReturnValue({ sub: 'user-secret-id' });
    const socket = makeSocket('access_token=access-secret-token');
    socket.id = 'socket-secret-id';

    await gateway.handleConnection(socket as never);
    gateway.handleDisconnect(socket as never);

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
});
