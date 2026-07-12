import { Logger } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

import { AuthPrismaRepository } from './auth.prisma.repo';

describe('AuthPrismaRepository admin persistence', () => {
  const credentials = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const session = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const oAuthAccount = {
    create: jest.fn(),
  };
  const prisma = { credentials, oAuthAccount, session, $transaction: jest.fn() };
  const repository = new AuthPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('does not write token hashes, provider ids, or client metadata to diagnostic logs', async () => {
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const verboseSpy = jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    credentials.findUnique.mockResolvedValue({
      id: 'credentials-secret',
      email: 'secret@example.com',
      passwordHash: 'password-hash-secret',
    });
    session.create.mockResolvedValue(undefined);
    session.findUnique.mockResolvedValue({
      id: 'session-secret',
      tokenHash: 'refresh-token-hash-secret',
      credentialsId: 'credentials-secret',
    });
    session.update.mockResolvedValue(undefined);
    oAuthAccount.create.mockResolvedValue(undefined);

    await repository.findById('credentials-secret');
    await repository.createOAuthAccount({
      provider: 'google',
      providerId: 'provider-id-secret',
      credentialsId: 'credentials-secret',
    });
    await repository.saveSession({
      id: 'session-secret',
      tokenHash: 'refresh-token-hash-secret',
      credentialsId: 'credentials-secret',
      expiresAt: new Date('2026-07-11T12:00:00.000Z'),
      ip: '203.0.113.10',
      country: 'Secret Country',
      os: 'Linux',
      browser: 'Chrome',
      device: 'Desktop',
      userAgent: 'Secret User Agent',
    });
    await repository.findSessionByTokenHash('refresh-token-hash-secret');
    await repository.updateSessionTokenHash('session-secret', 'new-refresh-token-hash-secret');

    const logPayload = JSON.stringify([
      debugSpy.mock.calls,
      verboseSpy.mock.calls,
      logSpy.mock.calls,
    ]);
    expect(logPayload).not.toContain('secret@example.com');
    expect(logPayload).not.toContain('credentials-secret');
    expect(logPayload).not.toContain('session-secret');
    expect(logPayload).not.toContain('password-hash-secret');
    expect(logPayload).not.toContain('provider-id-secret');
    expect(logPayload).not.toContain('refresh-token-hash-secret');
    expect(logPayload).not.toContain('new-refresh-token-hash-secret');
    expect(logPayload).not.toContain('203.0.113.10');
    expect(logPayload).not.toContain('Secret Country');
    expect(logPayload).not.toContain('Secret User Agent');
  });

  it('does not write raw Prisma error details to diagnostic logs', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    credentials.create.mockRejectedValue(
      new Error('Prisma failed for secret@example.com token=secret-token'),
    );

    await expect(
      repository.createCredentials({
        email: 'secret@example.com',
        passwordHash: 'password-hash-secret',
      }),
    ).rejects.toThrow('Prisma failed');

    const logPayload = JSON.stringify(errorSpy.mock.calls);
    expect(logPayload).not.toContain('secret@example.com');
    expect(logPayload).not.toContain('secret-token');
    expect(logPayload).not.toContain('password-hash-secret');
    expect(logPayload).not.toContain('Prisma failed for');
    expect(logPayload).toContain('credentials_create_failed');
    expect(logPayload).toContain('hasError');
  });

  it('atomically persists the ban and revokes every active SQL session', async () => {
    const ban = {
      isBanned: true,
      bannedUntil: new Date('2026-07-09T12:00:00.000Z'),
      banReason: 'Spam',
      bannedAt: new Date('2026-07-08T12:00:00.000Z'),
      bannedBy: 'actor',
    };
    credentials.update.mockReturnValueOnce('credentials-update');
    session.updateMany.mockReturnValueOnce('sessions-update');

    await repository.banAndRevokeAllSessions('target', ban);

    expect(credentials.update).toHaveBeenCalledWith({
      where: { id: 'target' },
      data: ban,
    });
    expect(session.updateMany).toHaveBeenCalledWith({
      where: { credentialsId: 'target', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['credentials-update', 'sessions-update']);
  });

  it('clears the active flag and all ban metadata', async () => {
    await repository.clearBan('target');

    expect(credentials.update).toHaveBeenCalledWith({
      where: { id: 'target' },
      data: {
        isBanned: false,
        bannedUntil: null,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      },
    });
  });

  it('normalizes only an expired, currently flagged temporary ban', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    credentials.updateMany.mockResolvedValue({ count: 1 });

    await expect(repository.normalizeExpiredBan('target', now)).resolves.toBe(true);

    expect(credentials.updateMany).toHaveBeenCalledWith({
      where: { id: 'target', isBanned: true, bannedUntil: { not: null, lte: now } },
      data: {
        isBanned: false,
        bannedUntil: null,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      },
    });
  });

  it('finds an admin account using a projection that excludes secrets', async () => {
    await repository.findAdminAccount('target');

    expect(credentials.findUnique).toHaveBeenCalledWith({
      where: { id: 'target' },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
        bannedUntil: true,
        banReason: true,
        bannedAt: true,
        bannedBy: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
  });

  it('lists active sessions with a safe DTO-compatible projection', async () => {
    session.findMany.mockResolvedValue([]);

    await repository.listAdminSessions('target');

    expect(session.findMany).toHaveBeenCalledWith({
      where: { credentialsId: 'target', revokedAt: null },
      select: {
        id: true,
        device: true,
        os: true,
        browser: true,
        ip: true,
        country: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('revokes by session ID only for the target credentials and active session', async () => {
    session.updateMany.mockResolvedValue({ count: 1 });

    await expect(repository.revokeSessionById('session', 'target')).resolves.toBe(true);

    expect(session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session', credentialsId: 'target', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes all sessions only for the target credentials and active rows', async () => {
    session.updateMany.mockResolvedValue({ count: 2 });

    await repository.revokeAllSessions('target');

    expect(session.updateMany).toHaveBeenCalledWith({
      where: { credentialsId: 'target', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
