import { RpcException } from '@nestjs/microservices';

import type { IAuthRepository } from '../../interfaces/auth.interface';
import { AdminBanService } from '../admin-ban.service';

const NOW = new Date('2026-07-08T12:00:00.000Z');

const rpcPayload = async (operation: Promise<unknown>): Promise<unknown> => {
  try {
    await operation;
    throw new Error('Expected operation to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError();
  }
};

const account = (
  id: string,
  overrides: Partial<NonNullable<Awaited<ReturnType<IAuthRepository['findAdminAccount']>>>> = {},
): NonNullable<Awaited<ReturnType<IAuthRepository['findAdminAccount']>>> => ({
  id,
  email: `${id}@example.com`,
  role: 'USER',
  oauthAccounts: [],
  isBanned: false,
  bannedUntil: null,
  banReason: null,
  bannedAt: null,
  bannedBy: null,
  ...overrides,
});

describe('AdminBanService', () => {
  let repo: jest.Mocked<IAuthRepository>;
  let service: AdminBanService;
  let logger: { error: jest.Mock };

  beforeEach(() => {
    repo = {
      findAdminAccount: jest.fn(),
      normalizeExpiredBan: jest.fn(),
    } as unknown as jest.Mocked<IAuthRepository>;
    service = new AdminBanService(repo, () => new Date(NOW));
    logger = { error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it('allows non-banned accounts through', async () => {
    repo.findAdminAccount.mockResolvedValue(account('target'));

    await service.assertAccountActive('target');

    expect(repo.normalizeExpiredBan).not.toHaveBeenCalled();
  });

  it('rejects missing accounts as serializable RPC errors', async () => {
    repo.findAdminAccount.mockResolvedValue(null);

    await expect(rpcPayload(service.assertAccountActive('target'))).resolves.toEqual({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('rejects permanently banned accounts with ban context', async () => {
    repo.findAdminAccount.mockResolvedValue(
      account('target', { isBanned: true, bannedUntil: null, banReason: 'Spam' }),
    );

    await expect(rpcPayload(service.assertAccountActive('target'))).resolves.toEqual({
      statusCode: 403,
      code: 'ACCOUNT_BANNED',
      message: 'Account is banned',
      reason: 'Spam',
      bannedUntil: null,
    });
  });

  it.each([
    [null, true],
    [new Date('2026-07-08T12:00:00.001Z'), true],
    [new Date('2026-07-08T12:00:00.000Z'), false],
  ] as const)(
    'classifies bannedUntil %s and normalizes expiry boundaries',
    async (bannedUntil, active) => {
      repo.findAdminAccount.mockResolvedValue(
        account('target', { isBanned: true, bannedUntil, banReason: 'Spam' }),
      );
      if (active) {
        const rejection = service.assertAccountActive('target');
        await expect(rejection).rejects.toBeInstanceOf(RpcException);
        await expect(rejection).rejects.toMatchObject({
          error: {
            statusCode: 403,
            code: 'ACCOUNT_BANNED',
            message: 'Account is banned',
            reason: 'Spam',
            bannedUntil: bannedUntil?.toISOString() ?? null,
          },
        });
        expect(repo.normalizeExpiredBan).not.toHaveBeenCalled();
      } else {
        await service.assertAccountActive('target');
        expect(repo.normalizeExpiredBan).toHaveBeenCalledWith('target', NOW);
      }
    },
  );

  it('wraps repository failures as serializable operational errors', async () => {
    repo.findAdminAccount.mockRejectedValue(new Error('db down'));

    await expect(rpcPayload(service.assertAccountActive('target'))).resolves.toEqual({
      statusCode: 503,
      message: 'Unable to check account state',
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
