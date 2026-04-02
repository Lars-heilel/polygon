import type { INestApplication } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CHAT_CLIENT_TOKEN, JwtGuard, USER_CLIENT_TOKEN } from '@org/core';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { of, throwError } from 'rxjs';
import request from 'supertest';

import { ChatSocketGateway } from '../gateways/chat.socket-gateway';
import { ChatGatewayController } from './chat.controller';

// ── helpers ───────────────────────────────────────────────────────────────────

const testUser = { sub: 'user-id', role: 'USER' as const, isVerified: true };

/** JwtGuard stub that always passes and injects testUser into req.user */
const jwtGuardMock = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: typeof testUser }>();
    req.user = testUser;
    return true;
  },
};

// ── setup ─────────────────────────────────────────────────────────────────────

describe('ChatGatewayController', () => {
  let app: INestApplication;
  let chatClient: Record<string, jest.Mock>;
  let mockSocketGateway: { broadcastMessage: jest.Mock };

  beforeAll(async () => {
    chatClient = {
      send: jest.fn().mockReturnValue(of({})),
      emit: jest.fn(),
    };
    mockSocketGateway = { broadcastMessage: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatGatewayController],
      providers: [
        { provide: CHAT_CLIENT_TOKEN, useValue: chatClient },
        { provide: USER_CLIENT_TOKEN, useValue: { send: jest.fn(), emit: jest.fn() } },
        { provide: ChatSocketGateway, useValue: mockSocketGateway },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue(jwtGuardMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    chatClient['send'].mockReset();
    mockSocketGateway.broadcastMessage.mockReset();
  });

  // ── GET /api/chats ────────────────────────────────────────────────

  describe('GET /api/chats', () => {
    it('returns 200 with chats array', async () => {
      chatClient['send'].mockReturnValue(of([{ id: 'chat-1' }]));

      const res = await request(app.getHttpServer()).get('/api/chats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'chat-1' }]);
    });

    it('forwards userId from JWT to chat service', async () => {
      chatClient['send'].mockReturnValue(of([]));

      await request(app.getHttpServer()).get('/api/chats');

      expect(chatClient['send']).toHaveBeenCalledWith(
        'chat.getChats',
        expect.objectContaining({ userId: testUser.sub }),
      );
    });
  });

  // ── POST /api/chats/direct ────────────────────────────────────────

  describe('POST /api/chats/direct', () => {
    const targetUserId = crypto.randomUUID();

    it('returns 201 with created chat', async () => {
      chatClient['send'].mockReturnValue(of({ id: 'chat-1', type: 'DIRECT' }));

      const res = await request(app.getHttpServer())
        .post('/api/chats/direct')
        .send({ targetUserId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'chat-1' });
    });

    it('returns 400 on missing targetUserId', async () => {
      const res = await request(app.getHttpServer()).post('/api/chats/direct').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 on non-UUID targetUserId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chats/direct')
        .send({ targetUserId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('forwards userId and targetUserId to chat service', async () => {
      chatClient['send'].mockReturnValue(of({ id: 'chat-1' }));

      await request(app.getHttpServer()).post('/api/chats/direct').send({ targetUserId });

      expect(chatClient['send']).toHaveBeenCalledWith(
        'chat.createDirect',
        expect.objectContaining({ userId: testUser.sub, targetUserId }),
      );
    });
  });

  // ── GET /api/chats/:id/messages ───────────────────────────────────

  describe('GET /api/chats/:id/messages', () => {
    it('returns 200 with messages array', async () => {
      chatClient['send'].mockReturnValue(of([{ id: 'msg-1', text: 'hello' }]));

      const res = await request(app.getHttpServer()).get('/api/chats/chat-1/messages');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'msg-1', text: 'hello' }]);
    });

    it('returns 403 when service throws forbidden', async () => {
      chatClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 403, message: 'Not a member' })),
      );

      const res = await request(app.getHttpServer()).get('/api/chats/chat-1/messages');
      expect(res.status).toBe(403);
    });

    it('passes skip and take query params to service', async () => {
      chatClient['send'].mockReturnValue(of([]));

      await request(app.getHttpServer()).get('/api/chats/chat-1/messages?skip=10&take=20');

      expect(chatClient['send']).toHaveBeenCalledWith(
        'chat.getMessages',
        expect.objectContaining({ skip: 10, take: 20, chatId: 'chat-1' }),
      );
    });
  });

  // ── POST /api/chats/:id/messages ──────────────────────────────────

  describe('POST /api/chats/:id/messages', () => {
    it('returns 201 with created message', async () => {
      const msg = { id: 'msg-1', text: 'hello', chatId: 'chat-1' };
      chatClient['send'].mockReturnValue(of(msg));

      const res = await request(app.getHttpServer())
        .post('/api/chats/chat-1/messages')
        .send({ text: 'hello' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'msg-1' });
    });

    it('broadcasts message via socket gateway', async () => {
      const msg = { id: 'msg-1', text: 'hello', chatId: 'chat-1' };
      chatClient['send'].mockReturnValue(of(msg));

      await request(app.getHttpServer()).post('/api/chats/chat-1/messages').send({ text: 'hello' });

      expect(mockSocketGateway.broadcastMessage).toHaveBeenCalledWith('chat-1', msg);
    });

    it('returns 403 when user is not a member', async () => {
      chatClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 403, message: 'Not a member' })),
      );

      const res = await request(app.getHttpServer())
        .post('/api/chats/chat-1/messages')
        .send({ text: 'hello' });

      expect(res.status).toBe(403);
    });
  });
});
