import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { IncomingHttpHeaders } from 'http';
import request from 'supertest';
import { of, throwError } from 'rxjs';

import { LocalStrategy } from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_PATTERNS,
  BanMarkerRepository,
  SESSION_CACHE_REPOSITORY_TOKEN,
  TokenService,
  type Env,
} from '@org/core';

import { AuthGatewayController } from '../auth.controller';
import { GatewayHttpExceptionFilter } from '../../filters/gateway-http-exception.filter';
import { ZodValidationExceptionFilter } from '../../filters/zod-validation-exception.filter';

type MockClient = {
  send: jest.Mock;
};

const tokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

const currentSessionId = '11111111-1111-4111-8111-111111111111';
const otherSessionId = '22222222-2222-4222-8222-222222222222';

const getSetCookieHeaders = (headers: IncomingHttpHeaders): string[] => {
  const setCookie = headers['set-cookie'];

  if (!Array.isArray(setCookie)) {
    throw new Error('Expected set-cookie response headers');
  }

  return setCookie;
};

const expectErrorBody = (
  body: unknown,
  expected: { statusCode: number; error: string; message: string; path: string },
) => {
  expect(body).toEqual({
    ...expected,
    timestamp: expect.any(String),
  });
};

const config = {
  getOrThrow: jest.fn((key: keyof Env) => {
    if (key === 'NODE_ENV') return 'production';
    if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
    if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
    if (key === 'CLIENT_URL') return 'http://localhost:4200';
    throw new Error(`Unexpected config key: ${String(key)}`);
  }),
  get: jest.fn((key: keyof Env) => {
    if (key === 'APP_URL') return 'http://localhost:3000';
    if (key === 'GITHUB_CLIENT_ID') return 'github-client';
    if (key === 'GITHUB_CLIENT_SECRET') return 'github-secret';
    if (key === 'GOOGLE_CLIENT_ID') return 'google-client';
    if (key === 'GOOGLE_CLIENT_SECRET') return 'google-secret';
    return undefined;
  }),
};

describe('AuthGatewayController HTTP', () => {
  let app: INestApplication;
  let authClient: MockClient;
  let tokenService: { verifyAccessToken: jest.Mock };
  let sessionCache: { exists: jest.Mock };
  let banMarkers: { findActiveMarker: jest.Mock };

  beforeEach(async () => {
    tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({
        sub: 'creds-1',
        sessionId: currentSessionId,
        role: 'USER',
        isVerified: true,
      }),
    };
    sessionCache = { exists: jest.fn().mockResolvedValue(true) };
    banMarkers = { findActiveMarker: jest.fn().mockResolvedValue(null) };
    authClient = {
      send: jest.fn((pattern: string) => {
        if (pattern === AUTH_PATTERNS.VALIDATE_CREDENTIALS) {
          return of({ id: 'creds-1', role: 'USER', isVerified: true });
        }
        if (pattern === AUTH_PATTERNS.LOGIN || pattern === AUTH_PATTERNS.REFRESH) {
          return of(tokenPair);
        }
        return of(null);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthGatewayController],
      providers: [
        LocalStrategy,
        { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
        { provide: ConfigService, useValue: config },
        { provide: TokenService, useValue: tokenService },
        { provide: SESSION_CACHE_REPOSITORY_TOKEN, useValue: sessionCache },
        { provide: BanMarkerRepository, useValue: banMarkers },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new GatewayHttpExceptionFilter(), new ZodValidationExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('rejects invalid register payloads before auth RPC', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', username: 'u', password: 'weak' })
      .expect(400);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/auth/register',
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'email', code: expect.any(String) }),
          expect.objectContaining({ path: 'username', code: expect.any(String) }),
          expect.objectContaining({ path: 'password', code: expect.any(String) }),
        ]),
      }),
      'Zod validation failed',
    );
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('forwards valid register payloads to auth service', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new@example.com', username: 'tester', password: 'Aa1!aaaa' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { message: 'Registered successfully' },
    });

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REGISTER, {
      email: 'new@example.com',
      username: 'tester',
      password: 'Aa1!aaaa',
    });
  });

  it('returns auth service registration conflicts without converting them to 500', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 409, message: 'Email already in use' })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'taken@example.com', username: 'tester', password: 'Aa1!aaaa' });

    expect(response.status).toBe(409);
    expectErrorBody(response.body, {
      statusCode: 409,
      error: 'Conflict',
      message: 'Email already in use',
      path: '/auth/register',
    });
  });

  it('normalizes unsafe auth RPC failures without exposing downstream details', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({
        statusCode: 503,
        message: 'Auth failed for user@example.com with token=secret-token',
      })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new@example.com', username: 'tester', password: 'Aa1!aaaa' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service temporarily unavailable',
      path: '/auth/register',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('user@example.com');
    expect(JSON.stringify(response.body)).not.toContain('secret-token');
  });

  it('sets secure HttpOnly cookies after login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { message: 'Logged in successfully' },
    });
    const setCookie = getSetCookieHeaders(response.headers);
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=access-token'),
        expect.stringContaining('refresh_token=refresh-token'),
      ]),
    );
    expect(setCookie.join(';')).toContain('HttpOnly');
    expect(setCookie.join(';')).toContain('SameSite=Strict');
    expect(setCookie.join(';')).toContain('Secure');

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.VALIDATE_CREDENTIALS, {
      email: 'user@example.com',
      password: 'password',
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.LOGIN, {
      id: 'creds-1',
      clientMetadata: expect.objectContaining({
        userAgent: expect.any(String),
      }),
    });
  });

  it('returns auth service login rate limits without creating a session', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({
        statusCode: 429,
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
      })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    expect(response.status).toBe(429);
    expectErrorBody(response.body, {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many failed login attempts. Please try again in 15 minutes.',
      path: '/auth/login',
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.VALIDATE_CREDENTIALS, {
      email: 'user@example.com',
      password: 'password',
    });
    expect(authClient.send).not.toHaveBeenCalledWith(
      AUTH_PATTERNS.LOGIN,
      expect.anything(),
    );
  });

  it('rotates refresh cookies through the auth service', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=old-refresh'])
      .expect(201)
      .expect(({ headers }) => {
        expect(getSetCookieHeaders(headers)).toEqual(
          expect.arrayContaining([
            expect.stringContaining('access_token=access-token'),
            expect.stringContaining('refresh_token=refresh-token'),
          ]),
        );
      });

    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REFRESH, {
      refreshToken: 'old-refresh',
    });
  });

  it('rejects refresh without a refresh cookie before auth RPC', async () => {
    const response = await request(app.getHttpServer()).post('/auth/refresh');

    expect(response.status).toBe(401);
    expectErrorBody(response.body, {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Refresh token missing',
      path: '/auth/refresh',
    });
    expect(authClient.send).not.toHaveBeenCalled();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('clears cookies on logout without refresh cookie', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(201)
      .expect(({ headers }) => {
        expect(getSetCookieHeaders(headers)).toEqual(
          expect.arrayContaining([
            expect.stringContaining('access_token=;'),
            expect.stringContaining('refresh_token=;'),
          ]),
        );
      });

    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('does not expose a Yandex OAuth entrypoint', async () => {
    await request(app.getHttpServer()).get('/auth/yandex').expect(404);
  });

  it('resends verification email through auth RPC', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: 'pending@example.com' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { message: 'Verification email sent' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.RESEND_VERIFICATION, {
      email: 'pending@example.com',
    });
  });

  it('returns resend verification cooldowns without converting them to 500', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 429, message: 'Please wait before requesting again' })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: 'pending@example.com' });

    expect(response.status).toBe(429);
    expectErrorBody(response.body, {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Please wait before requesting again',
      path: '/auth/resend-verification',
    });
  });

  it('rejects invalid forgot-password payloads before auth RPC', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);

    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('requests password reset through auth RPC', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'recover@example.com' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { message: 'If this email is registered, a reset link has been sent' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.FORGOT_PASSWORD, {
      email: 'recover@example.com',
    });
  });

  it('returns forgot-password cooldowns without converting them to 500', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 429, message: 'Please wait before requesting again' })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'recover@example.com' });

    expect(response.status).toBe(429);
    expectErrorBody(response.body, {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Please wait before requesting again',
      path: '/auth/forgot-password',
    });
  });

  it('rejects invalid reset-password payloads before auth RPC', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: '', newPassword: 'weak' })
      .expect(400);

    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('resets password through auth RPC', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'reset-token', newPassword: 'Aa1!aaaa' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { message: 'Password reset successfully' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.RESET_PASSWORD, {
      token: 'reset-token',
      newPassword: 'Aa1!aaaa',
    });
  });

  it('returns invalid reset tokens without converting them to 500', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 400, message: 'Invalid or expired token' })),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'reset-token', newPassword: 'Aa1!aaaa' });

    expect(response.status).toBe(400);
    expectErrorBody(response.body, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid or expired token',
      path: '/auth/reset-password',
    });
  });

  it('rejects missing verify-email tokens before auth RPC', async () => {
    await request(app.getHttpServer()).get('/auth/verify-email').expect(400);

    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('rejects empty verify-email tokens before auth RPC', async () => {
    await request(app.getHttpServer()).get('/auth/verify-email?token=').expect(400);

    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('lists current-user sessions through auth RPC', async () => {
    const sessions = [
      {
        id: currentSessionId,
        device: 'Desktop',
        browser: 'Chrome',
        os: 'Linux',
        ip: '127.0.0.1',
        country: 'Test Country',
        lastActiveAt: '2026-07-12T17:00:00.000Z',
        createdAt: '2026-07-12T16:00:00.000Z',
        isCurrent: true,
      },
    ];
    authClient.send.mockReturnValueOnce(of(sessions));

    const response = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Cookie', ['access_token=access-token']);

    expect({ status: response.status, body: response.body }).toEqual({
      status: 200,
      body: sessions,
    });
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(sessionCache.exists).toHaveBeenCalledWith(currentSessionId);
    expect(banMarkers.findActiveMarker).toHaveBeenCalledWith('creds-1');
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.LIST_SESSIONS, {
      credentialsId: 'creds-1',
      currentSessionId,
    });
  });

  it('clears cookies when revoking the current session', async () => {
    authClient.send.mockReturnValueOnce(of(null));

    const response = await request(app.getHttpServer())
      .delete(`/auth/sessions/${currentSessionId}`)
      .set('Cookie', ['access_token=access-token']);

    expect({ status: response.status, body: response.body }).toEqual({
      status: 200,
      body: { message: 'Session revoked' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REVOKE_SESSION, {
      sessionId: currentSessionId,
      credentialsId: 'creds-1',
    });
    expect(getSetCookieHeaders(response.headers)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
      ]),
    );
  });

  it('rejects invalid session ids before auth RPC', async () => {
    await request(app.getHttpServer())
      .delete('/auth/sessions/not-a-uuid')
      .set('Cookie', ['access_token=access-token'])
      .expect(400);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(authClient.send).not.toHaveBeenCalledWith(
      AUTH_PATTERNS.REVOKE_SESSION,
      expect.anything(),
    );
  });

  it('keeps cookies when revoking another session', async () => {
    authClient.send.mockReturnValueOnce(of(null));

    const response = await request(app.getHttpServer())
      .delete(`/auth/sessions/${otherSessionId}`)
      .set('Cookie', ['access_token=access-token']);

    expect({ status: response.status, body: response.body }).toEqual({
      status: 200,
      body: { message: 'Session revoked' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REVOKE_SESSION, {
      sessionId: otherSessionId,
      credentialsId: 'creds-1',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('keeps cookies when revoking other sessions', async () => {
    authClient.send.mockReturnValueOnce(of(null));

    const response = await request(app.getHttpServer())
      .delete('/auth/sessions')
      .set('Cookie', ['access_token=access-token']);

    expect({ status: response.status, body: response.body }).toEqual({
      status: 200,
      body: { message: 'Other sessions revoked' },
    });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REVOKE_ALL_SESSIONS, {
      credentialsId: 'creds-1',
      currentSessionId,
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
