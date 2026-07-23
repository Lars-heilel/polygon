import { HttpException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { of, throwError } from 'rxjs';

import { SessionGuard } from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  ActiveAccountGuard,
  BanMarkerRepository,
  SEARCH_CLIENT_TOKEN,
  SEARCH_PATTERNS,
  SESSION_CACHE_REPOSITORY_TOKEN,
  TokenService,
  USER_CLIENT_TOKEN,
} from '@org/core';

import { UserGatewayController } from './user.controller';

describe('UserGatewayController', () => {
  it('does not write raw RPC error details to diagnostic logs', async () => {
    const authClient = { send: jest.fn() };
    const userClient = { send: jest.fn() };
    const searchClient = {
      send: jest.fn(() =>
        throwError(() =>
          Object.assign(new Error('User user@example.com failed with token=secret-token'), {
            statusCode: 404,
            response: {
              message: 'User user@example.com failed with token=secret-token',
              userAgent: 'Sensitive User Agent',
            },
          }),
        ),
      ),
      emit: jest.fn(),
    };
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn(),
    };
    const controller = new UserGatewayController(
      authClient as unknown as ClientProxy,
      userClient as unknown as ClientProxy,
      searchClient as unknown as ClientProxy,
    );
    Object.defineProperty(controller, 'logger', { value: logger });

    let thrown: unknown;
    try {
      await controller.getById('user-1');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);

    expect(searchClient.send).toHaveBeenCalledWith(SEARCH_PATTERNS.GET_USER_BY_ID, { id: 'user-1' });
    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('secret-token');
    expect(diagnosticPayload).not.toContain('Sensitive User Agent');
  });

  it('rejects a normal private endpoint when the Redis session was revoked', async () => {
    const authClient = { send: jest.fn(() => of(null)) };
    const userClient = { send: jest.fn(() => of({ id: 'user-1' })) };
    const searchClient = { send: jest.fn(() => of(null)), emit: jest.fn() };
    const tokenService = {
      verifyAccessToken: jest.fn(() => ({
        sub: 'user-1',
        sessionId: 'revoked-session',
        role: 'USER',
        isVerified: true,
      })),
    };
    const sessionCache = { exists: jest.fn().mockResolvedValue(false) };
    const banMarkers = { findActiveMarker: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserGatewayController],
      providers: [
        SessionGuard,
        ActiveAccountGuard,
        { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
        { provide: USER_CLIENT_TOKEN, useValue: userClient },
        { provide: SEARCH_CLIENT_TOKEN, useValue: searchClient },
        { provide: TokenService, useValue: tokenService },
        { provide: SESSION_CACHE_REPOSITORY_TOKEN, useValue: sessionCache },
        { provide: BanMarkerRepository, useValue: banMarkers },
      ],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    try {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', ['access_token=access-token'])
        .expect(401);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('access-token');
      expect(sessionCache.exists).toHaveBeenCalledWith('revoked-session');
      expect(banMarkers.findActiveMarker).not.toHaveBeenCalled();
      expect(userClient.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
