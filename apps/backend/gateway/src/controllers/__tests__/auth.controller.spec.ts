import type { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

import { AUTH_PATTERNS, type Env } from '@org/core';

import { AuthGatewayController } from '../auth.controller';

const tokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('AuthGatewayController', () => {
  let authClient: { send: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let controller: AuthGatewayController;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };
  let logger: {
    debug: jest.Mock;
    error: jest.Mock;
    log: jest.Mock;
    verbose: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(() => {
    authClient = {
      send: jest.fn(() => of(tokenPair)),
    };
    config = {
      getOrThrow: jest.fn((key: keyof Env) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return 900;
        if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return 604800;
        if (key === 'CLIENT_URL') return 'http://localhost:4200';
        throw new Error(`Unexpected config key: ${String(key)}`);
      }),
    };
    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn(),
    };

    controller = new AuthGatewayController(
      authClient as unknown as ClientProxy,
      config as unknown as ConfigService<Env, true>,
    );
    Object.defineProperty(controller, 'logger', { value: logger });
  });

  it('refresh rotates both HttpOnly token cookies from the refresh cookie', async () => {
    const result = await controller.refresh(
      { cookies: { refresh_token: 'old-refresh-token' } } as never,
      res as never,
    );

    expect(result).toEqual({ message: 'Tokens refreshed' });
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.REFRESH, {
      refreshToken: 'old-refresh-token',
    });
    expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      maxAge: 900000,
    });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      maxAge: 604800000,
    });
  });

  it('logout clears token cookies without auth RPC when refresh cookie is absent', async () => {
    const result = await controller.logout({ cookies: {} } as never, res as never);

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(authClient.send).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
    });
  });

  it('does not write raw login credentials or client metadata to diagnostic logs', async () => {
    await controller.login(
      {} as never,
      {
        user: {
          id: 'creds-1',
          role: 'USER',
          isVerified: true,
        },
      } as never,
      res as never,
      {
        ip: '203.0.113.10',
        country: 'Secret Country',
        os: 'Linux',
        browser: 'Chrome',
        device: 'Desktop',
        userAgent: 'Sensitive User Agent',
        loginTime: new Date().toISOString(),
      },
    );

    const debugPayload = JSON.stringify(logger.debug.mock.calls);
    expect(debugPayload).not.toContain('203.0.113.10');
    expect(debugPayload).not.toContain('Sensitive User Agent');
    expect(debugPayload).not.toContain('Secret Country');
    expect(debugPayload).not.toContain('"id":"creds-1"');
  });

  it('does not write OAuth token pairs or client metadata to diagnostic logs', () => {
    controller.googleCallback(
      { user: { accessToken: 'oauth-access-token', refreshToken: 'oauth-refresh-token' } } as never,
      {
        ip: '203.0.113.20',
        country: 'Secret Country',
        os: 'Linux',
        browser: 'Chrome',
        device: 'Desktop',
        userAgent: 'OAuth User Agent',
        loginTime: new Date().toISOString(),
      },
      { ...res, redirect: jest.fn() } as never,
    );

    const debugPayload = JSON.stringify(logger.debug.mock.calls);
    expect(debugPayload).not.toContain('oauth-access-token');
    expect(debugPayload).not.toContain('oauth-refresh-token');
    expect(debugPayload).not.toContain('203.0.113.20');
    expect(debugPayload).not.toContain('OAuth User Agent');
  });

  it('does not write raw downstream RPC messages to diagnostic logs', async () => {
    authClient.send.mockReturnValueOnce(
      throwError(() => ({
        statusCode: 503,
        message: 'Auth failed for user@example.com with token=secret-token',
        response: {
          statusCode: 503,
          message: 'Auth failed for user@example.com with token=secret-token',
        },
      })),
    );

    await expect(
      controller.refresh({ cookies: { refresh_token: 'refresh-token' } } as never, res as never),
    ).rejects.toMatchObject({
      status: 503,
      response: 'Auth failed for user@example.com with token=secret-token',
    });

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('secret-token');
    expect(diagnosticPayload).toContain('hasMessage');
  });
});
