import type { PrismaService } from '../prisma/prisma.service';

import { AuthPrismaRepository } from './auth.prisma.repo';

describe('AuthPrismaRepository admin persistence', () => {
  const credentials = {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const session = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { credentials, session, $transaction: jest.fn() };
  const repository = new AuthPrismaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
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
