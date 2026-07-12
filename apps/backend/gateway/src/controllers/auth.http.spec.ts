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

import { AuthGatewayController } from './auth.controller';
import { ZodValidationExceptionFilter } from '../filters/zod-validation-exception.filter';

type MockClient = {
  send: jest.Mock;
};

const tokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

const getSetCookieHeaders = (headers: IncomingHttpHeaders): string[] => {
  const setCookie = headers['set-cookie'];

  if (!Array.isArray(setCookie)) {
    throw new Error('Expected set-cookie response headers');
  }

  return setCookie;
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
    if (key === 'YANDEX_CLIENT_ID') return 'yandex-client';
    if (key === 'YANDEX_CLIENT_SECRET') return 'yandex-secret';
    return undefined;
  }),
};

describe('AuthGatewayController HTTP', () => {
  let app: INestApplication;
  let authClient: MockClient;

  beforeEach(async () => {
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
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
        { provide: SESSION_CACHE_REPOSITORY_TOKEN, useValue: { exists: jest.fn() } },
        { provide: BanMarkerRepository, useValue: { findActiveMarker: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new ZodValidationExceptionFilter());
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

    expect({ status: response.status, body: response.body }).toEqual({
      status: 409,
      body: { statusCode: 409, message: 'Email already in use' },
    });
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

    expect({ status: response.status, body: response.body }).toEqual({
      status: 429,
      body: {
        statusCode: 429,
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
      },
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

    expect({ status: response.status, body: response.body }).toEqual({
      status: 401,
      body: {
        statusCode: 401,
        message: 'Refresh token missing',
        error: 'Unauthorized',
      },
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
});
