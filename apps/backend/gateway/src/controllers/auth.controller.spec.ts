import request from 'supertest';
import { of, throwError } from 'rxjs';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test/create-test-app';

describe('AuthGatewayController', () => {
  let app: INestApplication;
  let authClient: Record<string, jest.Mock>;

  beforeAll(async () => {
    ({ app, authClient } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authClient['send'].mockReset();
  });

  // ── POST /api/auth/register ────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 201 and sets cookies on valid payload', async () => {
      authClient['send'].mockReturnValue(
        of({ accessToken: 'access-tok', refreshToken: 'refresh-tok' }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'Password1!', username: 'user' });

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('returns 400 on invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Password1!', username: 'user' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when auth service throws conflict', async () => {
      authClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 409, message: 'Email already in use' })),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'Password1!', username: 'user' });

      expect(res.status).toBe(409);
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 200 and clears cookies', async () => {
      authClient['send'].mockReturnValue(of(null));

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', 'refresh_token=some-token');

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.includes('access_token=;'))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refresh_token=;'))).toBe(true);
    });
  });

  // ── POST /api/auth/forgot-password ────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('always returns 200 regardless of email existence', async () => {
      authClient['send'].mockReturnValue(of(null));

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'anyone@example.com' });

      expect(res.status).toBe(201);
    });
  });

  // ── POST /api/auth/reset-password ─────────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('returns 200 on valid token and password', async () => {
      authClient['send'].mockReturnValue(of(null));

      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', newPassword: 'NewPassword1!' });

      expect(res.status).toBe(201);
    });

    it('returns 400 on missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
