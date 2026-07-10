import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';

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
    isUserOnline(userId: string): boolean;
    disconnectUser(userId: string): void;
  };
  const tokenService: TokenServiceMock = {
    verifyAccessToken: jest.fn(),
  };
  const chatClient = {
    send: jest.fn(() => of(true)),
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
      YANDEX_CLIENT_ID: 'yandex-client',
      YANDEX_CLIENT_SECRET: 'yandex-secret',
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
    (gateway as unknown as { server: { sockets: { sockets: Map<string, unknown> } } }).server = {
      sockets: { sockets: new Map() },
    };
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
});
