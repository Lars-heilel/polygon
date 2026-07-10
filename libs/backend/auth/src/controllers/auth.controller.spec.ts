import { AUTH_PATTERNS } from '@org/core';

import type { IAdminBanService, IAuthService } from '../interfaces/auth.interface';
import { AuthController } from './auth.controller';

describe('AuthController administrative RPCs', () => {
  const account = { id: 'target' };
  const sessions = [{ id: 'session' }];
  let admin: jest.Mocked<IAdminBanService>;
  let controller: AuthController;

  beforeEach(() => {
    admin = {
      getAccount: jest.fn().mockResolvedValue(account),
      listSessions: jest.fn().mockResolvedValue(sessions),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      ban: jest.fn(),
      unban: jest.fn(),
      assertAccountActive: jest.fn(),
    } as unknown as jest.Mocked<IAdminBanService>;
    controller = new AuthController({} as IAuthService, admin as never);
  });

  it('defines stable administrative commands', () => {
    expect(AUTH_PATTERNS).toMatchObject({
      GET_ADMIN_ACCOUNT: 'auth.admin.get-account',
      LIST_ADMIN_SESSIONS: 'auth.admin.list-sessions',
      REVOKE_ADMIN_SESSION: 'auth.admin.revoke-session',
      REVOKE_ALL_ADMIN_SESSIONS: 'auth.admin.revoke-all-sessions',
      BAN_ACCOUNT: 'auth.admin.ban-account',
      UNBAN_ACCOUNT: 'auth.admin.unban-account',
    });
  });

  it('delegates account detail with actor identity', async () => {
    await expect(
      controller.getAdminAccount({ actorId: 'actor', targetId: 'target' }),
    ).resolves.toBe(account);
    expect(admin.getAccount).toHaveBeenCalledWith('actor', 'target');
  });

  it('delegates session listing with actor identity', async () => {
    await expect(
      controller.listAdminSessions({ actorId: 'actor', targetId: 'target' }),
    ).resolves.toBe(sessions);
    expect(admin.listSessions).toHaveBeenCalledWith('actor', 'target');
  });

  it('delegates one-session revocation without forwarding actorRole', async () => {
    await expect(
      controller.revokeAdminSession({
        actorId: 'actor',
        targetId: 'target',
        sessionId: 'session',
        actorRole: 'CREATOR',
      } as never),
    ).resolves.toBeNull();
    expect(admin.revokeSession).toHaveBeenCalledWith('actor', 'target', 'session');
  });

  it('delegates all-session revocation', async () => {
    await expect(
      controller.revokeAllAdminSessions({ actorId: 'actor', targetId: 'target' }),
    ).resolves.toBeNull();
    expect(admin.revokeAllSessions).toHaveBeenCalledWith('actor', 'target');
  });

  it('delegates ban input without forwarding actorRole', async () => {
    const input = { duration: 'ONE_DAY', reason: 'SPAM' };
    await expect(
      controller.banAccount({
        actorId: 'actor',
        targetId: 'target',
        input,
        actorRole: 'CREATOR',
      } as never),
    ).resolves.toBeNull();
    expect(admin.ban).toHaveBeenCalledWith('actor', 'target', input);
  });

  it('delegates unban identities', async () => {
    await expect(
      controller.unbanAccount({ actorId: 'actor', targetId: 'target' }),
    ).resolves.toBeNull();
    expect(admin.unban).toHaveBeenCalledWith('actor', 'target');
  });
});
