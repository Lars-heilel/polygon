import { AUTH_PATTERNS } from '@org/core';

import type { IAdminBanService, IAuthService } from '../interfaces/auth.interface';
import { AuthController } from './auth.controller';

describe('AuthController administrative RPCs', () => {
  const account = { id: 'target' };
  const sessions = [{ id: 'session' }];
  const tokenPair = { accessToken: 'access-token', refreshToken: 'refresh-token' };
  let auth: jest.Mocked<IAuthService>;
  let admin: jest.Mocked<IAdminBanService>;
  let controller: AuthController;
  let logger: {
    debug: jest.Mock;
    log: jest.Mock;
    verbose: jest.Mock;
  };

  beforeEach(() => {
    auth = {
      register: jest.fn(),
      getRoleById: jest.fn().mockResolvedValue('USER'),
      validateCredentials: jest.fn().mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        role: 'USER',
        isVerified: true,
      }),
      login: jest.fn().mockResolvedValue(tokenPair),
      logout: jest.fn(),
      refresh: jest.fn().mockResolvedValue(tokenPair),
      verifyEmail: jest.fn().mockResolvedValue(tokenPair),
      resendVerification: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      oauthLogin: jest.fn().mockResolvedValue(tokenPair),
      listSessions: jest.fn().mockResolvedValue([]),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
    };
    admin = {
      getAccount: jest.fn().mockResolvedValue(account),
      listSessions: jest.fn().mockResolvedValue(sessions),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      ban: jest.fn(),
      unban: jest.fn(),
      assertAccountActive: jest.fn(),
    } as unknown as jest.Mocked<IAdminBanService>;
    logger = {
      debug: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
    };
    controller = new AuthController(auth, admin as never);
    Object.defineProperty(controller, 'logger', { value: logger });
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

  it('does not write raw RPC payload identifiers or secrets to diagnostic logs', async () => {
    await controller.getRoleById({ id: 'credentials-secret-id' });
    await controller.login({
      id: 'login-secret-id',
      clientMetadata: {
        ip: '203.0.113.10',
        country: 'Secret Country',
        os: 'Linux',
        browser: 'Chrome',
        device: 'Desktop',
        userAgent: 'Sensitive User Agent',
        loginTime: '2026-07-11T12:00:00.000Z',
      },
    });
    await controller.listSessions({
      credentialsId: 'credentials-secret-id',
      currentSessionId: 'current-session-secret-id',
    });
    await controller.revokeSession({
      sessionId: 'session-secret-id',
      credentialsId: 'credentials-secret-id',
    });
    await controller.revokeAllSessions({ credentialsId: 'credentials-secret-id' });
    await controller.validateCredentials({
      email: 'user@example.com',
      password: 'plain-password-secret',
    });
    await controller.resetPassword({
      token: 'reset-token-secret',
      newPassword: 'new-password-secret',
    });
    await controller.oauthLogin({
      provider: 'github',
      providerId: 'provider-secret-id',
      email: 'oauth@example.com',
      name: 'OAuth Secret Name',
      clientMetadata: {
        ip: '203.0.113.20',
        country: 'OAuth Country',
        os: 'Linux',
        browser: 'Firefox',
        device: 'Desktop',
        userAgent: 'OAuth Sensitive User Agent',
        loginTime: '2026-07-11T12:05:00.000Z',
      },
    });

    expect(auth.login).toHaveBeenCalledWith(
      'login-secret-id',
      expect.objectContaining({ userAgent: 'Sensitive User Agent' }),
    );
    expect(auth.validateCredentials).toHaveBeenCalledWith(
      'user@example.com',
      'plain-password-secret',
    );
    expect(auth.resetPassword).toHaveBeenCalledWith('reset-token-secret', 'new-password-secret');

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.log.mock.calls,
      logger.verbose.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('credentials-secret-id');
    expect(diagnosticPayload).not.toContain('login-secret-id');
    expect(diagnosticPayload).not.toContain('current-session-secret-id');
    expect(diagnosticPayload).not.toContain('session-secret-id');
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('plain-password-secret');
    expect(diagnosticPayload).not.toContain('reset-token-secret');
    expect(diagnosticPayload).not.toContain('new-password-secret');
    expect(diagnosticPayload).not.toContain('provider-secret-id');
    expect(diagnosticPayload).not.toContain('oauth@example.com');
    expect(diagnosticPayload).not.toContain('OAuth Secret Name');
    expect(diagnosticPayload).not.toContain('Sensitive User Agent');
    expect(diagnosticPayload).not.toContain('OAuth Sensitive User Agent');
  });
});
