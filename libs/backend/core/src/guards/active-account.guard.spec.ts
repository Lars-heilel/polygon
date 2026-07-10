import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { BanMarkerRepository } from '../ban/ban-marker.repository';
import { ActiveAccountGuard } from './active-account.guard';

function makeContext(user?: { sub?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('ActiveAccountGuard', () => {
  const banMarkers = {
    findActiveMarker: jest.fn(),
  };

  let guard: ActiveAccountGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ActiveAccountGuard(banMarkers as unknown as BanMarkerRepository);
  });

  it('allows requests when the authenticated user has no ban marker', async () => {
    banMarkers.findActiveMarker.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext({ sub: 'user-1' }))).resolves.toBe(true);

    expect(banMarkers.findActiveMarker).toHaveBeenCalledWith('user-1');
  });

  it('throws a structured 403 when a ban marker exists', async () => {
    banMarkers.findActiveMarker.mockResolvedValue({
      reason: 'Spam',
      bannedUntil: '2026-07-09T10:00:00.000Z',
    });

    await expect(guard.canActivate(makeContext({ sub: 'user-1' }))).rejects.toMatchObject({
      constructor: ForbiddenException,
      response: {
        code: 'ACCOUNT_BANNED',
        reason: 'Spam',
        bannedUntil: '2026-07-09T10:00:00.000Z',
      },
    });
  });

  it('fails closed as 503 when the ban marker repository cannot parse Redis state', async () => {
    banMarkers.findActiveMarker.mockRejectedValue(new Error('Invalid ban marker'));

    await expect(guard.canActivate(makeContext({ sub: 'user-1' }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('denies safely when the JWT guard has not attached a subject', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(banMarkers.findActiveMarker).not.toHaveBeenCalled();
  });
});
