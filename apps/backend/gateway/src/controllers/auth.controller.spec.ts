import type { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';

import { AUTH_PATTERNS, type Env } from '@org/core';

import { AuthGatewayController } from './auth.controller';

const tokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('AuthGatewayController', () => {
  let authClient: { send: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let controller: AuthGatewayController;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

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

    controller = new AuthGatewayController(
      authClient as unknown as ClientProxy,
      config as unknown as ConfigService<Env, true>,
    );
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
});
