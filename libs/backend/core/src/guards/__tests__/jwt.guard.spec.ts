import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { JwtPayload } from '../../token/token.service';
import { TokenService } from '../../token/token.service';
import { JwtGuard } from '../jwt.guard';

const mockTokenService = {
  verifyAccessToken: jest.fn(),
};

function makeContext(cookies: Record<string, string>): ExecutionContext {
  const request = { cookies, user: undefined as unknown };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtGuard', () => {
  let guard: JwtGuard;

  const validPayload: JwtPayload = {
    sub: 'user-id-123',
    role: 'USER',
    isVerified: true,
    sessionId: 'test-session-id',
    jti: 'test-jti',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtGuard(mockTokenService as unknown as TokenService);
  });

  it('returns true and sets req.user when access_token cookie is valid', () => {
    mockTokenService.verifyAccessToken.mockReturnValue(validPayload);
    const ctx = makeContext({ access_token: 'valid-token' });

    const result = guard.canActivate(ctx);
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();

    expect(result).toBe(true);
    expect(request.user).toEqual(validPayload);
  });

  it('throws UnauthorizedException when access_token cookie is absent', () => {
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(mockTokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when token verification fails', () => {
    mockTokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const ctx = makeContext({ access_token: 'bad-token' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is expired', () => {
    mockTokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const ctx = makeContext({ access_token: 'expired-token' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('calls verifyAccessToken with the cookie value', () => {
    mockTokenService.verifyAccessToken.mockReturnValue(validPayload);
    const ctx = makeContext({ access_token: 'my-token' });

    guard.canActivate(ctx);

    expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('my-token');
  });
});
