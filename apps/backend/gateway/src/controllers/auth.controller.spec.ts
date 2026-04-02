import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { of, throwError } from 'rxjs';
import request from 'supertest';

import { createTestApp } from '../test/create-test-app';

function makeAccessToken(payload = { sub: 'user-id', role: 'USER', isVerified: true }) {
  const jwt = new JwtService();
  return jwt.sign(payload, { secret: 'test-access-secret', expiresIn: 900 });
}

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
    it('returns 201 with message on valid payload', async () => {
      authClient['send'].mockReturnValue(of(null));

      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'user@example.com',
        password: 'Password1!',
        username: 'user',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'Registered successfully' });
    });

    it('does not set auth cookies on register', async () => {
      authClient['send'].mockReturnValue(of(null));

      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'user@example.com',
        password: 'Password1!',
        username: 'user',
      });

      const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(false);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(false);
    });

    it('returns 400 on invalid email', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'Password1!',
        username: 'user',
      });

      expect(res.status).toBe(400);
    });

    it('returns 409 when auth service throws conflict', async () => {
      authClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 409, message: 'Email already in use' })),
      );

      const res = await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'user@example.com',
        password: 'Password1!',
        username: 'user',
      });

      expect(res.status).toBe(409);
    });
  });

  // ── POST /api/auth/login ──────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const validCredentials = { email: 'user@example.com', password: 'Password1!' };

    it('sets access_token and refresh_token cookies on success', async () => {
      authClient['send'].mockReturnValue(
        of({ accessToken: 'access-jwt', refreshToken: 'refresh-jwt' }),
      );

      const accessToken = makeAccessToken();
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Cookie', `access_token=${accessToken}`)
        .send(validCredentials);

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token=access-jwt'))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('refresh_token=refresh-jwt'))).toBe(true);
    });

    it('cookies are httpOnly', async () => {
      authClient['send'].mockReturnValue(
        of({ accessToken: 'access-jwt', refreshToken: 'refresh-jwt' }),
      );

      const accessToken = makeAccessToken();
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Cookie', `access_token=${accessToken}`)
        .send(validCredentials);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.every((c: string) => c.includes('HttpOnly'))).toBe(true);
    });

    it('returns 401 on wrong credentials', async () => {
      authClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 401, message: 'Invalid credentials' })),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when email is missing (Passport rejects before strategy)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ password: 'Password1!' });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/refresh ────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('sets new cookies on valid refresh token', async () => {
      authClient['send'].mockReturnValue(
        of({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=valid-refresh-token');

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token=new-access'))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('refresh_token=new-refresh'))).toBe(true);
    });

    it('returns 401 when auth service rejects the refresh token', async () => {
      authClient['send'].mockReturnValue(
        throwError(() => ({ statusCode: 401, message: 'Unauthorized' })),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=expired-token');

      expect(res.status).toBe(401);
    });

    it('does not require a valid access_token cookie (no JwtGuard)', async () => {
      authClient['send'].mockReturnValue(
        of({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      );

      // No access_token cookie at all — refresh should still work
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=some-token');

      expect(res.status).toBe(201);
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
      const cookies = res.headers['set-cookie'] as unknown as string[];
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
      const res = await request(app.getHttpServer()).post('/api/auth/reset-password').send({});

      expect(res.status).toBe(400);
    });
  });
});
