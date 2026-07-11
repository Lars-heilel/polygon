import { RpcException } from '@nestjs/microservices';
import type { Role } from '@org/common';

import type { IBanCacheRepository } from '../cache/ban.cache.interface';
import type { ISessionCacheRepository } from '../cache/session.cache.interface';
import type { AuthAdminAccount, IAuthRepository } from '../interfaces/auth.interface';
import { AdminBanService } from './admin-ban.service';
import { canManage } from './admin-policy';

const NOW = new Date('2026-07-08T12:00:00.000Z');
const roles: Role[] = ['CREATOR', 'ADMIN', 'MODERATOR', 'USER'];

const rpcPayload = async (operation: Promise<unknown>): Promise<unknown> => {
  try {
    await operation;
    throw new Error('Expected operation to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError();
  }
};

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const account = (
  id: string,
  role: Role,
  overrides: Partial<AuthAdminAccount> = {},
): AuthAdminAccount => ({
  id,
  email: `${id}@example.com`,
  role,
  oauthAccounts: [],
  isBanned: false,
  bannedUntil: null,
  banReason: null,
  bannedAt: null,
  bannedBy: null,
  ...overrides,
});

describe('canManage', () => {
  it.each(roles.flatMap((actor) => roles.map((target) => [actor, target] as const)))(
    '%s managing %s follows the hierarchy',
    (actor, target) => {
      const expected =
        actor === 'CREATOR'
          ? target !== 'CREATOR'
          : actor === 'ADMIN' && ['MODERATOR', 'USER'].includes(target);
      expect(canManage(actor, target, false)).toBe(expected);
    },
  );

  it.each(roles)('denies self-management for %s', (role) => {
    expect(canManage(role, role, true)).toBe(false);
  });
});

describe('AdminBanService', () => {
  let repo: jest.Mocked<IAuthRepository>;
  let sessions: jest.Mocked<ISessionCacheRepository>;
  let bans: jest.Mocked<IBanCacheRepository>;
  let service: AdminBanService;
  let logger: { error: jest.Mock };

  beforeEach(() => {
    repo = {
      findAdminAccount: jest.fn(),
      listAdminSessions: jest.fn(),
      findSessionById: jest.fn(),
      revokeSessionById: jest.fn(),
      banAndRevokeAllSessions: jest.fn(),
      clearBan: jest.fn(),
      normalizeExpiredBan: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as unknown as jest.Mocked<IAuthRepository>;
    sessions = {
      remove: jest.fn(),
      removeFromUserSessions: jest.fn(),
      removeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<ISessionCacheRepository>;
    bans = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      acquireLock: jest.fn().mockResolvedValue('lock-token'),
      renewAdminLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    service = new AdminBanService(repo, sessions, bans, () => new Date(NOW), {
      leaseMs: 30_000,
      renewIntervalMs: 10_000,
    });
    logger = { error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER'),
    );
  });

  afterEach(() => jest.useRealTimers());

  it('authorizes account and session reads from persisted actor and target roles', async () => {
    const target = account('target', 'USER');
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'ADMIN') : target,
    );
    repo.listAdminSessions.mockResolvedValue([]);

    await expect(service.getAccount('actor', 'target')).resolves.toBe(target);
    await expect(service.listSessions('actor', 'target')).resolves.toEqual([]);
    expect(repo.listAdminSessions).toHaveBeenCalledWith('target');
  });

  it('denies an ADMIN inspecting an ADMIN and preserves a serializable error', async () => {
    repo.findAdminAccount.mockImplementation(async (id) => account(id, 'ADMIN'));
    await expect(rpcPayload(service.getAccount('actor', 'target'))).resolves.toEqual({
      statusCode: 403,
      message: 'Insufficient role hierarchy',
    });
    expect(repo.listAdminSessions).not.toHaveBeenCalled();
  });

  it('authorizes and revokes a target session in SQL and Redis', async () => {
    repo.findSessionById.mockResolvedValue({ credentialsId: 'target', revokedAt: null } as never);
    repo.revokeSessionById.mockResolvedValue(true);
    await service.revokeSession('actor', 'target', 'session');
    expect(repo.revokeSessionById).toHaveBeenCalledWith('session', 'target');
    expect(sessions.remove).toHaveBeenCalledWith('session');
    expect(sessions.removeFromUserSessions).toHaveBeenCalledWith('target', 'session');
  });

  it('returns a serializable not-found error for an unknown target session', async () => {
    repo.findSessionById.mockResolvedValue(null);
    await expect(rpcPayload(service.revokeSession('actor', 'target', 'missing'))).resolves.toEqual({
      statusCode: 404,
      message: 'Session not found',
    });
    expect(sessions.remove).not.toHaveBeenCalled();
  });

  it('does not clear caches when the session belongs to another target', async () => {
    repo.findSessionById.mockResolvedValue({
      credentialsId: 'someone-else',
      revokedAt: null,
    } as never);
    await expect(rpcPayload(service.revokeSession('actor', 'target', 'session'))).resolves.toEqual({
      statusCode: 404,
      message: 'Session not found',
    });
    expect(repo.revokeSessionById).not.toHaveBeenCalled();
    expect(sessions.remove).not.toHaveBeenCalled();
  });

  it('retries cache reconciliation for an already-revoked owned session', async () => {
    repo.findSessionById.mockResolvedValue({ credentialsId: 'target', revokedAt: NOW } as never);
    await service.revokeSession('actor', 'target', 'session');
    expect(repo.revokeSessionById).not.toHaveBeenCalled();
    expect(sessions.remove).toHaveBeenCalledWith('session');
    expect(sessions.removeFromUserSessions).toHaveBeenCalledWith('target', 'session');
  });

  it('reconciles caches when a concurrent revoke wins the SQL race', async () => {
    repo.findSessionById.mockResolvedValue({ credentialsId: 'target', revokedAt: null } as never);
    repo.revokeSessionById.mockResolvedValue(false);
    await service.revokeSession('actor', 'target', 'session');
    expect(sessions.remove).toHaveBeenCalledWith('session');
    expect(sessions.removeFromUserSessions).toHaveBeenCalledWith('target', 'session');
  });

  it('repairs both cache keys on retry after the first cache attempt failed', async () => {
    repo.findSessionById
      .mockResolvedValueOnce({ credentialsId: 'target', revokedAt: null } as never)
      .mockResolvedValueOnce({ credentialsId: 'target', revokedAt: NOW } as never);
    repo.revokeSessionById.mockResolvedValue(true);
    sessions.remove.mockRejectedValueOnce(new Error('redis down'));

    await expect(rpcPayload(service.revokeSession('actor', 'target', 'session'))).resolves.toEqual({
      statusCode: 503,
      message: 'Unable to revoke session',
    });
    await service.revokeSession('actor', 'target', 'session');
    expect(sessions.remove).toHaveBeenCalledTimes(2);
    expect(sessions.removeFromUserSessions).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'account lookup',
      () => {
        repo.findAdminAccount.mockRejectedValue(new Error('db down'));
        return service.getAccount('actor', 'target');
      },
    ],
    [
      'session list',
      () => {
        repo.listAdminSessions.mockRejectedValue(new Error('db down'));
        return service.listSessions('actor', 'target');
      },
    ],
    [
      'session lookup',
      () => {
        repo.findSessionById.mockRejectedValue(new Error('db down'));
        return service.revokeSession('actor', 'target', 'session');
      },
    ],
  ])('maps unexpected %s failure to a flat 503 RPC payload', async (_label, operation) => {
    await expect(rpcPayload(operation())).resolves.toEqual({
      statusCode: 503,
      message: expect.any(String),
    });
  });

  it('does not write raw operational error details to diagnostic logs', async () => {
    repo.findAdminAccount.mockRejectedValueOnce(
      new Error('database down for user@example.com token=secret'),
    );

    await expect(
      rpcPayload(service.getAccount('actor-secret-id', 'target-secret-id')),
    ).resolves.toEqual({
      statusCode: 503,
      message: 'Unable to get account',
    });

    bans.acquireLock.mockRejectedValueOnce(new Error('redis lock failed owner=lock-secret-token'));
    await expect(
      rpcPayload(
        service.ban('actor-secret-id', 'target-secret-id', {
          duration: 'ONE_DAY',
          reason: 'SPAM',
        }),
      ),
    ).resolves.toEqual({
      statusCode: 503,
      message: 'Unable to acquire admin operation lock',
    });

    const diagnosticPayload = JSON.stringify(logger.error.mock.calls);
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('token=secret');
    expect(diagnosticPayload).not.toContain('actor-secret-id');
    expect(diagnosticPayload).not.toContain('target-secret-id');
    expect(diagnosticPayload).not.toContain('lock-secret-token');
    expect(diagnosticPayload).not.toContain('database down for');
    expect(diagnosticPayload).not.toContain('redis lock failed');
    expect(diagnosticPayload).not.toContain('Error:');
    expect(diagnosticPayload).toContain('admin_operation_failed');
    expect(diagnosticPayload).toContain('admin_operation_lock_acquire_failed');
  });

  it('authorizes and revokes all target sessions in SQL and Redis', async () => {
    await service.revokeAllSessions('actor', 'target');
    expect(repo.revokeAllSessions).toHaveBeenCalledWith('target');
    expect(sessions.removeAllForUser).toHaveBeenCalledWith('target');
  });

  it.each([
    ['ONE_HOUR', '2026-07-08T13:00:00.000Z'],
    ['ONE_DAY', '2026-07-09T12:00:00.000Z'],
    ['SEVEN_DAYS', '2026-07-15T12:00:00.000Z'],
    ['THIRTY_DAYS', '2026-08-07T12:00:00.000Z'],
    ['PERMANENT', null],
  ] as const)('calculates %s from injected server time', async (duration, iso) => {
    await service.ban('actor', 'target', { duration, reason: 'SPAM' });

    expect(repo.banAndRevokeAllSessions).toHaveBeenCalledWith(
      'target',
      expect.objectContaining({ bannedAt: NOW, bannedUntil: iso === null ? null : new Date(iso) }),
    );
  });

  it.each([
    ['SPAM', 'Spam'],
    ['BULLYING', 'Bullying'],
    ['UNACCEPTABLE_CONTENT', 'Unacceptable content'],
    ['SUSPICIOUS_ACTIVITY', 'Suspicious activity'],
  ] as const)('stores stable display text for %s', async (reason, display) => {
    await service.ban('actor', 'target', { duration: 'ONE_DAY', reason });
    expect(repo.banAndRevokeAllSessions).toHaveBeenCalledWith(
      'target',
      expect.objectContaining({ banReason: display }),
    );
  });

  it('parses unknown input and stores a trimmed custom reason', async () => {
    await service.ban('actor', 'target', {
      duration: 'ONE_DAY',
      reason: 'CUSTOM',
      customReason: '  repeated abuse  ',
    });
    expect(repo.banAndRevokeAllSessions).toHaveBeenCalledWith(
      'target',
      expect.objectContaining({ banReason: 'repeated abuse' }),
    );
    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'CUSTOM' }),
    ).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 400 }),
    });
  });

  it('reports missing actor and target coherently', async () => {
    repo.findAdminAccount.mockResolvedValue(null);
    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 404, message: 'Actor not found' },
    });
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : null,
    );
    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 404, message: 'Target not found' },
    });
  });

  it('enforces hierarchy and self-management', async () => {
    repo.findAdminAccount.mockImplementation(async (id) => account(id, 'ADMIN'));
    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 403, message: 'Insufficient role hierarchy' },
    });
    await expect(service.unban('actor', 'actor')).rejects.toMatchObject({
      error: { statusCode: 403, message: 'Insufficient role hierarchy' },
    });
  });

  it('forbids an ADMIN from targeting an already-banned ADMIN before idempotence', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      account(id, 'ADMIN', id === 'target' ? { isBanned: true, bannedUntil: null } : {}),
    );

    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(repo.banAndRevokeAllSessions).not.toHaveBeenCalled();
    expect(bans.set).not.toHaveBeenCalled();
  });

  it('does not touch Redis when the atomic SQL ban transaction fails', async () => {
    repo.banAndRevokeAllSessions.mockRejectedValue(new Error('transaction failed'));

    await expect(
      rpcPayload(service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' })),
    ).resolves.toEqual({ statusCode: 503, message: 'Unable to establish ban state' });
    expect(sessions.removeAllForUser).not.toHaveBeenCalled();
    expect(bans.set).not.toHaveBeenCalled();
    expect(bans.releaseLock).toHaveBeenCalledWith('target', 'lock-token');
  });

  it('returns serializable 409 before DB access when the target lock is owned', async () => {
    bans.acquireLock.mockResolvedValue(null);

    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 409, message: 'Another admin operation is in progress' },
    });
    expect(repo.findAdminAccount).not.toHaveBeenCalled();
    expect(repo.banAndRevokeAllSessions).not.toHaveBeenCalled();
  });

  it('denies a second operation while the first cross-store workflow is in progress', async () => {
    const transaction = deferred<void>();
    bans.acquireLock.mockResolvedValueOnce('first-owner').mockResolvedValueOnce(null);
    repo.banAndRevokeAllSessions.mockReturnValueOnce(transaction.promise);

    const first = service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' });
    await Promise.resolve();
    await expect(service.unban('actor', 'target')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 409 }),
    });
    expect(repo.banAndRevokeAllSessions).toHaveBeenCalledTimes(1);

    transaction.resolve();
    await expect(first).resolves.toBeUndefined();
    expect(bans.releaseLock).toHaveBeenCalledWith('target', 'first-owner');
  });

  it('renews ownership while deferred DB work exceeds the initial lease window', async () => {
    jest.useFakeTimers();
    const transaction = deferred<void>();
    bans.acquireLock.mockResolvedValueOnce('first-owner').mockResolvedValueOnce(null);
    repo.banAndRevokeAllSessions.mockReturnValueOnce(transaction.promise);

    const first = service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' });
    await jest.advanceTimersByTimeAsync(31_000);

    expect(bans.renewAdminLock).toHaveBeenCalledTimes(3);
    expect(bans.renewAdminLock).toHaveBeenLastCalledWith('target', 'first-owner', 30_000);
    await expect(service.unban('actor', 'target')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 409 }),
    });

    transaction.resolve();
    await expect(first).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it.each([
    ['lost ownership', false],
    ['renewal error', new Error('redis renewal failed')],
  ] as const)('returns 503 after %s and never reports workflow success', async (_name, outcome) => {
    jest.useFakeTimers();
    const transaction = deferred<void>();
    repo.banAndRevokeAllSessions.mockReturnValueOnce(transaction.promise);
    if (outcome === false) bans.renewAdminLock.mockResolvedValueOnce(false);
    else bans.renewAdminLock.mockRejectedValueOnce(outcome);

    const operation = service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' });
    await jest.advanceTimersByTimeAsync(10_000);
    transaction.resolve();

    await expect(operation).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Admin operation lock renewal failed' },
    });
    expect(bans.releaseLock).toHaveBeenCalledWith('target', 'lock-token');
    jest.useRealTimers();
  });

  it('releases the target lock after successful ban and unban', async () => {
    await service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' });
    await service.unban('actor', 'target');

    expect(bans.releaseLock).toHaveBeenNthCalledWith(1, 'target', 'lock-token');
    expect(bans.releaseLock).toHaveBeenNthCalledWith(2, 'target', 'lock-token');
  });

  it('never reports success when lock ownership cannot be safely released', async () => {
    bans.releaseLock.mockResolvedValue(false);

    await expect(
      service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Unable to release admin operation lock' },
    });
  });

  it('persists the ban, revokes SQL and Redis sessions, then establishes the marker', async () => {
    await service.ban('actor', 'target', { duration: 'ONE_HOUR', reason: 'SPAM' });
    expect(repo.banAndRevokeAllSessions).toHaveBeenCalled();
    expect(sessions.removeAllForUser).toHaveBeenCalledWith('target');
    expect(bans.set).toHaveBeenCalledWith('target', {
      reason: 'Spam',
      bannedUntil: '2026-07-08T13:00:00.000Z',
    });
    expect(repo.banAndRevokeAllSessions.mock.invocationCallOrder[0]).toBeLessThan(
      bans.set.mock.invocationCallOrder[0],
    );
  });

  it('reconciles Redis sessions and a missing marker for an already-active ban', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor'
        ? account(id, 'CREATOR')
        : account(id, 'USER', {
            isBanned: true,
            bannedUntil: new Date('2026-07-09T00:00:00Z'),
            banReason: 'Persisted reason',
          }),
    );
    await service.ban('actor', 'target', { duration: 'ONE_HOUR', reason: 'SPAM' });
    expect(repo.banAndRevokeAllSessions).not.toHaveBeenCalled();
    expect(sessions.removeAllForUser).toHaveBeenCalledWith('target');
    expect(bans.set).toHaveBeenCalledWith('target', {
      reason: 'Persisted reason',
      bannedUntil: '2026-07-09T00:00:00.000Z',
    });
  });

  it('returns serializable 503 when active-ban reconciliation fails', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor'
        ? account(id, 'CREATOR')
        : account(id, 'USER', { isBanned: true, bannedUntil: null, banReason: 'Spam' }),
    );
    bans.set.mockRejectedValue(new Error('redis down'));

    await expect(
      service.ban('actor', 'target', { duration: 'ONE_HOUR', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Unable to establish ban state' },
    });
    expect(repo.clearBan).not.toHaveBeenCalled();
  });

  it('compensates Redis marker failure and returns 503 without swallowing compensation errors', async () => {
    bans.set.mockRejectedValue(new Error('redis down'));
    bans.clear.mockRejectedValue(new Error('clear marker failed'));
    await expect(
      service.ban('actor', 'target', { duration: 'ONE_HOUR', reason: 'SPAM' }),
    ).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Unable to establish ban state' },
    });
    expect(repo.clearBan).toHaveBeenCalledWith('target');
    expect(bans.clear).toHaveBeenCalledWith('target');
    // SQL/Redis session revocation cannot be rolled back after the marker write fails.
    expect(sessions.removeAllForUser).toHaveBeenCalledWith('target');
    expect(bans.releaseLock).toHaveBeenCalledWith('target', 'lock-token');
  });

  it('preserves the primary operation error if lock release also fails', async () => {
    repo.banAndRevokeAllSessions.mockRejectedValue(new Error('transaction failed'));
    bans.releaseLock.mockRejectedValue(new Error('redis release failed'));

    await expect(
      rpcPayload(service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' })),
    ).resolves.toEqual({ statusCode: 503, message: 'Unable to establish ban state' });
  });

  it('unbans DB-first, clears the marker, and retries marker cleanup idempotently', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER', { isBanned: true }),
    );
    await service.unban('actor', 'target');
    expect(repo.clearBan).toHaveBeenCalledWith('target');
    expect(bans.clear).toHaveBeenCalledWith('target');
    expect(repo.clearBan.mock.invocationCallOrder[0]).toBeLessThan(
      bans.clear.mock.invocationCallOrder[0],
    );

    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER'),
    );
    await service.unban('actor', 'target');
    expect(repo.clearBan).toHaveBeenCalledTimes(1);
    expect(bans.clear).toHaveBeenCalledTimes(2);
  });

  it('leaves the marker untouched when DB clear fails', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER', { isBanned: true }),
    );
    repo.clearBan.mockRejectedValue(new Error('database down'));

    await expect(service.unban('actor', 'target')).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Unable to clear ban state' },
    });
    expect(bans.clear).not.toHaveBeenCalled();
    expect(bans.releaseLock).toHaveBeenCalledWith('target', 'lock-token');
  });

  it('does not report success when marker clear fails after DB clear', async () => {
    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER', { isBanned: true }),
    );
    bans.clear.mockRejectedValue(new Error('redis down'));
    await expect(service.unban('actor', 'target')).rejects.toMatchObject({
      error: { statusCode: 503, message: 'Unable to clear ban state' },
    });
    expect(repo.clearBan).toHaveBeenCalledWith('target');
  });

  it('exposes hierarchy, missing-user, Redis, and active-ban fields as RMQ payloads', async () => {
    repo.findAdminAccount.mockImplementation(async (id) => account(id, 'ADMIN'));
    await expect(
      rpcPayload(service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' })),
    ).resolves.toEqual({ statusCode: 403, message: 'Insufficient role hierarchy' });

    repo.findAdminAccount.mockResolvedValue(null);
    await expect(
      rpcPayload(service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' })),
    ).resolves.toEqual({ statusCode: 404, message: 'Actor not found' });

    repo.findAdminAccount.mockImplementation(async (id) =>
      id === 'actor' ? account(id, 'CREATOR') : account(id, 'USER'),
    );
    bans.set.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      rpcPayload(service.ban('actor', 'target', { duration: 'ONE_DAY', reason: 'SPAM' })),
    ).resolves.toEqual({ statusCode: 503, message: 'Unable to establish ban state' });

    repo.findAdminAccount.mockResolvedValue(
      account('target', 'USER', { isBanned: true, bannedUntil: null, banReason: 'Spam' }),
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
        account('target', 'USER', { isBanned: true, bannedUntil, banReason: 'Spam' }),
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
});
