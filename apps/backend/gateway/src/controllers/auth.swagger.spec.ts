import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
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

    document = SwaggerModule.createDocument(moduleRef.createNestApplication(), {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    });
  });

  it('documents auth message response bodies', () => {
    const resend = getResponse(
      getOperation(document, '/auth/resend-verification', 'post'),
      '201',
    );
    const forgot = getResponse(getOperation(document, '/auth/forgot-password', 'post'), '201');

    expect(resend.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: { message: { type: 'string', example: 'Verification email sent' } },
      required: ['message'],
    });
    expect(forgot.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'If this email is registered, a reset link has been sent',
        },
      },
      required: ['message'],
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
      'Set-Cookie': {
        description: 'HttpOnly access_token and refresh_token cookies',
        schema: { type: 'string' },
      },
    });
  });
});
