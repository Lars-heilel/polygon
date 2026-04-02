import type { INestApplication } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtGuard, USER_CLIENT_TOKEN } from '@org/core';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { of, throwError } from 'rxjs';
import request from 'supertest';

import { UserGatewayController } from './user.controller';

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

const userProfile = {
  id: 'user-id',
  email: 'user@example.com',
  name: 'testuser',
  displayName: null,
  avatarUrl: null,
  bio: null,
};

// ── setup ─────────────────────────────────────────────────────────────────────

describe('UserGatewayController', () => {
  let app: INestApplication;
  let userClient: Record<string, jest.Mock>;

  beforeAll(async () => {
    userClient = {
      send: jest.fn().mockReturnValue(of({})),
      emit: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserGatewayController],
      providers: [{ provide: USER_CLIENT_TOKEN, useValue: userClient }],
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
    userClient['send'].mockReset();
  });

  // ── GET /api/users/me ─────────────────────────────────────────────

  describe('GET /api/users/me', () => {
    it('returns 200 with current user profile', async () => {
      userClient['send'].mockReturnValue(of(userProfile));

      const res = await request(app.getHttpServer()).get('/api/users/me');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'user-id', email: 'user@example.com' });
    });

    it('forwards userId from JWT to user service', async () => {
      userClient['send'].mockReturnValue(of(userProfile));

      await request(app.getHttpServer()).get('/api/users/me');

      expect(userClient['send']).toHaveBeenCalledWith(
        'user.getById',
        expect.objectContaining({ id: testUser.sub }),
      );
    });
  });

  // ── GET /api/users/:id ────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('returns 200 with user profile', async () => {
      userClient['send'].mockReturnValue(of(userProfile));

      const res = await request(app.getHttpServer()).get('/api/users/user-id');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'user-id' });
    });

    it('passes the id param to user service', async () => {
      userClient['send'].mockReturnValue(of(userProfile));

      await request(app.getHttpServer()).get('/api/users/some-other-id');

      expect(userClient['send']).toHaveBeenCalledWith(
        'user.getById',
        expect.objectContaining({ id: 'some-other-id' }),
      );
    });

    it('returns 404 when user service throws not found', async () => {
      userClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 404, message: 'User not found' })),
      );

      const res = await request(app.getHttpServer()).get('/api/users/unknown-id');

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/users/me ───────────────────────────────────────────

  describe('PATCH /api/users/me', () => {
    it('returns 200 with updated profile', async () => {
      const updated = { ...userProfile, displayName: 'New Name' };
      userClient['send'].mockReturnValue(of(updated));

      const res = await request(app.getHttpServer())
        .patch('/api/users/me')
        .send({ displayName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ displayName: 'New Name' });
    });

    it('forwards userId from JWT in the update payload', async () => {
      userClient['send'].mockReturnValue(of(userProfile));

      await request(app.getHttpServer()).patch('/api/users/me').send({ bio: 'hello' });

      expect(userClient['send']).toHaveBeenCalledWith(
        'user.update',
        expect.objectContaining({ id: testUser.sub }),
      );
    });
  });
});
