import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { API_ROUTES } from '@org/common';
import type { JwtPayload } from '@org/core';

type MockClient = {
  send: jest.Mock;
};

const adminJwt: JwtPayload = {
  sub: 'creator-id',
  role: 'CREATOR',
  isVerified: true,
  sessionId: 'session-id',
  jti: 'jti',
};

const userProfile = {
  id: 'target-id',
  email: 'target@example.com',
  name: 'Target',
  displayName: 'Target User',
  avatarUrl: null,
  bio: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const authDetail = {
  id: 'target-id',
  email: 'target@example.com',
  role: 'USER',
  oauthProviders: ['github'],
  ban: {
    isBanned: false,
    bannedUntil: null,
    banReason: null,
    bannedAt: null,
    bannedBy: null,
  },
};

const sessions = [
  {
    id: 'session-a',
    device: 'Desktop',
    os: 'Linux',
    browser: 'Firefox',
    ip: '127.0.0.1',
    country: null,
    lastActiveAt: new Date('2026-01-03T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    isCurrent: false,
  },
];

const avatarHistory = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    bucket: 'avatars',
    key: 'avatars/target-id/a.png',
    originalName: 'a.png',
    mimeType: 'image/png',
    size: 10,
    url: 'https://cdn.example/a.png',
    uploaderId: 'target-id',
    status: 'READY',
    chatId: null,
    category: 'AVATAR',
    createdAt: new Date('2026-01-04T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
  },
];

describe('AdminController', () => {
  let app: INestApplication;
  let authClient: MockClient;
  let userClient: MockClient;
  let searchClient: MockClient;
  let mediaClient: MockClient;
  let tokenService: { verifyAccessToken: jest.Mock };
  let chatGateway: { disconnectUser: jest.Mock };
  let AdminController: typeof import('./admin.controller').AdminController;
  let AUTH_CLIENT_TOKEN: typeof import('@org/core').AUTH_CLIENT_TOKEN;
  let AUTH_PATTERNS: typeof import('@org/core').AUTH_PATTERNS;
  let ActiveAccountGuard: typeof import('@org/core').ActiveAccountGuard;
  let BanMarkerRepository: typeof import('@org/core').BanMarkerRepository;
  let JwtGuard: typeof import('@org/core').JwtGuard;
  let MEDIA_CLIENT_TOKEN: typeof import('@org/core').MEDIA_CLIENT_TOKEN;
  let MEDIA_PATTERNS: typeof import('@org/core').MEDIA_PATTERNS;
  let RolesGuard: typeof import('@org/core').RolesGuard;
  let SEARCH_CLIENT_TOKEN: typeof import('@org/core').SEARCH_CLIENT_TOKEN;
  let SEARCH_PATTERNS: typeof import('@org/core').SEARCH_PATTERNS;
  let TokenService: typeof import('@org/core').TokenService;
  let USER_CLIENT_TOKEN: typeof import('@org/core').USER_CLIENT_TOKEN;
  let USER_PATTERNS: typeof import('@org/core').USER_PATTERNS;
  let ChatSocketGateway: typeof import('../gateways/chat.socket-gateway').ChatSocketGateway;

  beforeAll(() => {
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

    ({
      AUTH_CLIENT_TOKEN,
      AUTH_PATTERNS,
      ActiveAccountGuard,
      BanMarkerRepository,
      JwtGuard,
      MEDIA_CLIENT_TOKEN,
      MEDIA_PATTERNS,
      RolesGuard,
      SEARCH_CLIENT_TOKEN,
      SEARCH_PATTERNS,
      TokenService,
      USER_CLIENT_TOKEN,
      USER_PATTERNS,
    } = jest.requireActual('@org/core') as typeof import('@org/core'));
    ({ AdminController } = jest.requireActual('./admin.controller') as typeof import('./admin.controller'));
    ({ ChatSocketGateway } = jest.requireActual('../gateways/chat.socket-gateway') as typeof import('../gateways/chat.socket-gateway'));
  });

  beforeEach(async () => {
    authClient = { send: jest.fn() };
    userClient = { send: jest.fn() };
    searchClient = { send: jest.fn() };
    mediaClient = { send: jest.fn() };
    tokenService = { verifyAccessToken: jest.fn(() => adminJwt) };
    chatGateway = { disconnectUser: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        JwtGuard,
        RolesGuard,
        Reflector,
        { provide: ActiveAccountGuard, useValue: { canActivate: jest.fn(() => true) } },
        { provide: BanMarkerRepository, useValue: { findActiveMarker: jest.fn() } },
        { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
        { provide: USER_CLIENT_TOKEN, useValue: userClient },
        { provide: SEARCH_CLIENT_TOKEN, useValue: searchClient },
        { provide: MEDIA_CLIENT_TOKEN, useValue: mediaClient },
        { provide: ChatSocketGateway, useValue: chatGateway },
        { provide: TokenService, useValue: tokenService },
        { provide: JwtGuard, useFactory: () => new JwtGuard(tokenService as never) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = () => {
    const server = app.getHttpServer();
    return {
      get: (url: string) => request(server).get(url).set('Cookie', ['access_token=valid-token']),
      post: (url: string) => request(server).post(url).set('Cookie', ['access_token=valid-token']),
      delete: (url: string) =>
        request(server).delete(url).set('Cookie', ['access_token=valid-token']),
    };
  };

  it('returns 401 when unauthenticated', async () => {
    await request(app.getHttpServer()).get(`/${API_ROUTES.admin.users}?query=target`).expect(401);
  });

  it.each(['USER', 'MODERATOR'] as const)('returns 403 for %s users', async (role) => {
    tokenService.verifyAccessToken.mockReturnValueOnce({ ...adminJwt, role });

    await http().get(`/${API_ROUTES.admin.users}?query=target`).expect(403);
  });

  it.each(['CREATOR', 'ADMIN'] as const)('allows %s users to search', async (role) => {
    tokenService.verifyAccessToken.mockReturnValueOnce({ ...adminJwt, role });
    const results = [
      {
        id: 'target-id',
        name: 'Target',
        displayName: 'Target User',
        avatarUrl: null,
      },
    ];
    searchClient.send.mockReturnValueOnce(of(results));
    authClient.send.mockReturnValueOnce(of(authDetail));

    const response = await http().get(`/${API_ROUTES.admin.users}?query=target`).expect(200);

    expect(response.body).toMatchObject([
      {
        id: 'target-id',
        role: 'USER',
        name: 'Target',
        ban: { isBanned: false },
      },
    ]);

    expect(searchClient.send).toHaveBeenCalledWith(SEARCH_PATTERNS.SEARCH_USERS, {
      q: 'target',
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.GET_ADMIN_ACCOUNT, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
    });
  });

  it('returns 400 for invalid search query', async () => {
    await http().get(`/${API_ROUTES.admin.users}?query=`).expect(400);
  });

  it('propagates ADMIN-to-ADMIN and self-management denial from Auth RPC without disconnecting sockets', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 403, message: 'Insufficient administrative authority' })),
    );

    await http()
      .post(`/${API_ROUTES.admin.ban('target-id')}`)
      .send({ duration: 'ONE_DAY', reason: 'SPAM' })
      .expect(403);

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.BAN_ACCOUNT, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
      input: { duration: 'ONE_DAY', reason: 'SPAM' },
    });
    expect(chatGateway.disconnectUser).not.toHaveBeenCalled();
  });

  it('propagates target 404 from domain services', async () => {
    userClient.send.mockReturnValueOnce(throwError(() => ({ statusCode: 404, message: 'User not found' })));
    authClient.send.mockReturnValueOnce(of(authDetail));

    await http().get(`/${API_ROUTES.admin.user('missing-id')}`).expect(404);
  });

  it('aggregates profile, auth detail, avatar history, and session summary', async () => {
    userClient.send.mockReturnValueOnce(of(userProfile));
    authClient.send
      .mockReturnValueOnce(of(authDetail))
      .mockReturnValueOnce(of(sessions));
    mediaClient.send.mockReturnValueOnce(of(avatarHistory));

    const response = await http().get(`/${API_ROUTES.admin.user('target-id')}`).expect(200);

    expect(response.body).toMatchObject({
      id: 'target-id',
      email: 'target@example.com',
      role: 'USER',
      profile: { id: 'target-id', name: 'Target' },
      oauthProviders: ['github'],
      sessionSummary: { activeCount: 1, totalCount: 1 },
      ban: { isBanned: false },
    });
    expect(response.body.avatarHistory).toHaveLength(1);
    expect(userClient.send).toHaveBeenCalledWith(USER_PATTERNS.GET_BY_ID, { id: 'target-id' });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.GET_ADMIN_ACCOUNT, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
    });
    expect(mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.GET_ADMIN_AVATAR_HISTORY, {
      targetId: 'target-id',
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.LIST_ADMIN_SESSIONS, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
    });
  });

  it('deletes one session and revokes all sessions through Auth RPC', async () => {
    authClient.send.mockReturnValue(of({ success: true }));

    await http().delete(`/${API_ROUTES.admin.session('target-id', 'session-a')}`).expect(200).expect({
      message: 'Session revoked',
    });
    await http().delete(`/${API_ROUTES.admin.sessions('target-id')}`).expect(200).expect({
      message: 'All sessions revoked',
    });

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REVOKE_ADMIN_SESSION, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
      sessionId: 'session-a',
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REVOKE_ALL_ADMIN_SESSIONS, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
    });
  });

  it('treats ban and unban as idempotent Auth mutations', async () => {
    authClient.send.mockReturnValue(of({ success: true }));

    await http()
      .post(`/${API_ROUTES.admin.ban('target-id')}`)
      .send({ duration: 'ONE_DAY', reason: 'SPAM' })
      .expect(201)
      .expect({ message: 'Account banned' });
    await http()
      .delete(`/${API_ROUTES.admin.ban('target-id')}`)
      .expect(200)
      .expect({ message: 'Account unbanned' });

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.BAN_ACCOUNT, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
      input: { duration: 'ONE_DAY', reason: 'SPAM' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.UNBAN_ACCOUNT, {
      actorId: adminJwt.sub,
      targetId: 'target-id',
    });
  });

  it('disconnects target sockets only after a successful ban', async () => {
    authClient.send.mockReturnValueOnce(throwError(() => ({ statusCode: 503, message: 'Redis unavailable' })));

    await http()
      .post(`/${API_ROUTES.admin.ban('target-id')}`)
      .send({ duration: 'ONE_DAY', reason: 'SPAM' })
      .expect(503);
    expect(chatGateway.disconnectUser).not.toHaveBeenCalled();

    authClient.send.mockReturnValueOnce(of({ success: true }));

    await http()
      .post(`/${API_ROUTES.admin.ban('target-id')}`)
      .send({ duration: 'ONE_DAY', reason: 'SPAM' })
      .expect(201);
    expect(chatGateway.disconnectUser).toHaveBeenCalledWith('target-id');
  });

  it('returns 400 for invalid ban payload without calling Auth RPC', async () => {
    await http()
      .post(`/${API_ROUTES.admin.ban('target-id')}`)
      .send({ duration: 'ONE_DAY', reason: 'CUSTOM', customReason: ' no ' })
      .expect(400);

    expect(authClient.send).not.toHaveBeenCalled();
    expect(chatGateway.disconnectUser).not.toHaveBeenCalled();
  });
});
