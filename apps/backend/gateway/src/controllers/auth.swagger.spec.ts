import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { of } from 'rxjs';

import {
  AUTH_CLIENT_TOKEN,
  BanMarkerRepository,
  SESSION_CACHE_REPOSITORY_TOKEN,
  TokenService,
  type Env,
} from '@org/core';

import { AuthGatewayController } from './auth.controller';

type PathItem = NonNullable<OpenAPIObject['paths'][string]>;
type OperationMethod = 'get' | 'post' | 'delete';
type Operation = NonNullable<PathItem[OperationMethod]>;

const getOperation = (
  document: OpenAPIObject,
  path: string,
  method: OperationMethod,
): Operation => {
  const operation = document.paths[path]?.[method];
  if (!operation) throw new Error(`Missing OpenAPI operation: ${method.toUpperCase()} ${path}`);
  return operation;
};

const getResponse = (operation: Operation, status: string) => {
  const response = operation.responses?.[status];
  if (!response || '$ref' in response) {
    throw new Error(`Missing OpenAPI response ${status}`);
  }
  return response;
};

const messageSchema = (example: string) => ({
  type: 'object',
  properties: { message: { type: 'string', example } },
  required: ['message'],
});

const errorSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 409 },
    error: { type: 'string', example: 'Conflict' },
    message: { type: 'string', example: 'Email already in use' },
    path: { type: 'string', example: '/auth/register' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['statusCode', 'error', 'message', 'path', 'timestamp'],
};

const tokenCookieHeader = {
  description: 'HttpOnly access_token and refresh_token cookies',
  schema: { type: 'string' },
};

describe('AuthGatewayController Swagger', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthGatewayController],
      providers: [
        { provide: AUTH_CLIENT_TOKEN, useValue: { send: jest.fn(() => of(null)) } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: keyof Env) => {
              if (key === 'NODE_ENV') return 'production';
              if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
              if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
              if (key === 'CLIENT_URL') return 'http://localhost:4200';
              throw new Error(`Unexpected config key: ${String(key)}`);
            }),
          },
        },
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
        { provide: SESSION_CACHE_REPOSITORY_TOKEN, useValue: { exists: jest.fn() } },
        { provide: BanMarkerRepository, useValue: { findActiveMarker: jest.fn() } },
      ],
    }).compile();

    const config = new DocumentBuilder()
      .setTitle('test')
      .setVersion('1.0.0')
      .addCookieAuth('access_token', undefined, 'access_token')
      .addCookieAuth('refresh_token', undefined, 'refresh_token')
      .build();

    document = SwaggerModule.createDocument(moduleRef.createNestApplication(), config);
  });

  it('documents auth cookie security schemes', () => {
    expect(document.components?.securitySchemes).toEqual(
      expect.objectContaining({
        access_token: expect.objectContaining({
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
        }),
        refresh_token: expect.objectContaining({
          type: 'apiKey',
          in: 'cookie',
          name: 'refresh_token',
        }),
      }),
    );
  });

  it('documents auth message response bodies', () => {
    const register = getResponse(getOperation(document, '/auth/register', 'post'), '201');
    const login = getResponse(getOperation(document, '/auth/login', 'post'), '201');
    const resend = getResponse(
      getOperation(document, '/auth/resend-verification', 'post'),
      '201',
    );
    const forgot = getResponse(getOperation(document, '/auth/forgot-password', 'post'), '201');
    const reset = getResponse(getOperation(document, '/auth/reset-password', 'post'), '201');

    expect(register.content?.['application/json']?.schema).toEqual(
      messageSchema('Registered successfully'),
    );
    expect(login.content?.['application/json']?.schema).toEqual(
      messageSchema('Logged in successfully'),
    );
    expect(resend.content?.['application/json']?.schema).toEqual(
      messageSchema('Verification email sent'),
    );
    expect(forgot.content?.['application/json']?.schema).toEqual(
      messageSchema('If this email is registered, a reset link has been sent'),
    );
    expect(reset.content?.['application/json']?.schema).toEqual(
      messageSchema('Password reset successfully'),
    );
  });

  it('documents auth token cookie response headers and refresh credential use', () => {
    const login = getOperation(document, '/auth/login', 'post');
    const refresh = getOperation(document, '/auth/refresh', 'post');
    const logout = getOperation(document, '/auth/logout', 'post');

    expect(login.security).toBeUndefined();
    expect(getResponse(login, '201').headers).toEqual({ 'Set-Cookie': tokenCookieHeader });

    expect(refresh.security).toEqual([{ refresh_token: [] }]);
    expect(getResponse(refresh, '201').headers).toEqual({ 'Set-Cookie': tokenCookieHeader });

    expect(logout.security).toBeUndefined();
    expect(getResponse(logout, '201').headers).toEqual({ 'Set-Cookie': tokenCookieHeader });
  });

  it('documents normalized auth error envelopes', () => {
    const registerConflict = getResponse(getOperation(document, '/auth/register', 'post'), '409');
    const refreshUnauthorized = getResponse(getOperation(document, '/auth/refresh', 'post'), '401');

    expect(registerConflict.content?.['application/json']?.schema).toEqual(errorSchema);
    expect(refreshUnauthorized.content?.['application/json']?.schema).toEqual({
      ...errorSchema,
      properties: {
        ...errorSchema.properties,
        statusCode: { type: 'number', example: 401 },
        error: { type: 'string', example: 'Unauthorized' },
        message: { type: 'string', example: 'Refresh token missing' },
        path: { type: 'string', example: '/auth/refresh' },
      },
    });
  });

  it('documents verify-email redirect headers without cookie auth', () => {
    const verifyEmail = getOperation(document, '/auth/verify-email', 'get');
    const redirect = getResponse(verifyEmail, '302');

    expect(verifyEmail.security).toBeUndefined();
    expect(redirect.headers).toEqual({
      Location: {
        description: 'Client email verification success page',
        schema: { type: 'string', example: 'http://localhost:4200/auth/email-verified' },
      },
      'Set-Cookie': tokenCookieHeader,
    });
  });

  it('documents session response bodies', () => {
    const listSessions = getResponse(getOperation(document, '/auth/sessions', 'get'), '200');
    const revokeSession = getResponse(
      getOperation(document, '/auth/sessions/{id}', 'delete'),
      '200',
    );
    const revokeOtherSessions = getResponse(
      getOperation(document, '/auth/sessions', 'delete'),
      '200',
    );

    expect(listSessions.content?.['application/json']?.schema).toEqual(
      expect.objectContaining({
        type: 'array',
        items: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            id: { type: 'string', format: 'uuid' },
            lastActiveAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            isCurrent: { type: 'boolean' },
          }),
        }),
      }),
    );
    expect(revokeSession.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: { message: { type: 'string', example: 'Session revoked' } },
      required: ['message'],
    });
    expect(revokeOtherSessions.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: { message: { type: 'string', example: 'Other sessions revoked' } },
      required: ['message'],
    });
  });
});
