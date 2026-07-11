import { Injectable, Logger } from '@nestjs/common';
// Все бэкенд и системные типы/DTO импортируются из @org/common
import {
  type AdminBanState,
  type AdminSessionsResponse,
  type CreateCredentialsInput,
  type Credentials,
  DatabaseSession,
} from '@org/common';
import { handlePrismaError } from '@org/core';

import type { AuthAdminAccount, IAuthRepository } from '../../interfaces/auth.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthPrismaRepository implements IAuthRepository {
  private readonly logger = new Logger(AuthPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Credentials | null> {
    this.logger.log('Database [Prisma]: Querying credentials by email');

    const result = await this.prisma.credentials.findUnique({
      where: { email },
    });

    this.logger.verbose(
      { found: !!result, credentialsId: result?.id },
      'Database [Prisma]: findByEmail query result',
    );
    return result;
  }

  async findById(id: string): Promise<Credentials | null> {
    this.logger.log(`Database [Prisma]: Querying credentials by ID: ${id}`);

    const result = await this.prisma.credentials.findUnique({
      where: { id },
    });

    this.logger.verbose({ result }, 'Database [Prisma]: findById query result');
    return result;
  }

  async createCredentials(data: CreateCredentialsInput): Promise<Credentials> {
    this.logger.log('Database [Prisma]: Inserting new credentials record');
    this.logger.debug(
      { hasEmail: !!data.email, hasPasswordHash: !!data.passwordHash },
      'Database [Prisma]: createCredentials payload parameters',
    );

    try {
      const result = await this.prisma.credentials.create({
        data,
      });
      this.logger.log(
        `Database [Prisma]: Successfully created credentials record with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Database [Prisma]: Failure during credentials creation', error);
      handlePrismaError(error);
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    this.logger.log(`Database [Prisma]: Updating password hash for credentials ID: ${id}`);
    this.logger.verbose(
      { id, passwordHashLength: passwordHash.length },
      'Database [Prisma]: updatePasswordHash parameters',
    );

    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { passwordHash },
      });
      this.logger.log(`Database [Prisma]: Password hash updated successfully for ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure updating password hash for credentials ID: ${id}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async findOAuthAccount(
    provider: string,
    providerId: string,
  ): Promise<{ credentials: Credentials } | null> {
    this.logger.log(
      `Database [Prisma]: Querying OAuth account for provider: ${provider}, providerId: ${providerId}`,
    );

    const result = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      select: { credentials: true },
    });

    this.logger.verbose({ result }, 'Database [Prisma]: findOAuthAccount query result');
    return result;
  }

  async createOAuthAccount(data: {
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Creating OAuth mapping [provider: ${data.provider}] for credentials ID: ${data.credentialsId}`,
    );
    this.logger.debug({ data }, 'Database [Prisma]: createOAuthAccount payload parameters');

    try {
      await this.prisma.oAuthAccount.create({ data });
      this.logger.log(`Database [Prisma]: OAuth mapping created successfully`);
    } catch (error) {
      this.logger.error('Database [Prisma]: Failure creating OAuth account mapping', error);
      handlePrismaError(error);
    }
  }

  async saveSession(data: {
    id: string;
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
    ip?: string;
    country?: string;
    os?: string;
    browser?: string;
    device?: string;
    userAgent?: string;
  }): Promise<void> {
    this.logger.log(`Database [Prisma]: Storing session ID: ${data.id} in SQL store`);
    this.logger.debug(
      { sessionPayload: data },
      'Database [Prisma]: saveSession complete diagnostic parameters',
    );

    try {
      await this.prisma.session.create({ data });
      this.logger.log(`Database [Prisma]: Session ${data.id} successfully written to table`);
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure writing session ID: ${data.id} to storage`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async findSessionByTokenHash(tokenHash: string): Promise<DatabaseSession | null> {
    this.logger.log('Database [Prisma]: Querying session state by token hash');
    this.logger.verbose(
      { tokenHash },
      'Database [Prisma]: findSessionByTokenHash target parameters',
    );

    return this.prisma.session.findUnique({ where: { tokenHash } });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    this.logger.log('Database [Prisma]: Revoking specific session (setting revokedAt timestamp)');
    this.logger.verbose(
      { hasTokenHash: !!tokenHash },
      'Database [Prisma]: revokeSession parameters context',
    );

    try {
      await this.prisma.session.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
      this.logger.log('Database [Prisma]: Session successfully revoked');
    } catch (error) {
      this.logger.error('Database [Prisma]: Failure revoking session by token hash', error);
      handlePrismaError(error);
    }
  }

  async revokeAllSessions(credentialsId: string): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Mass revocation initiated for credentials ID: ${credentialsId}`,
    );

    try {
      const result = await this.prisma.session.updateMany({
        where: { credentialsId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`Database [Prisma]: Revoked ${result.count} active sessions`);
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure revoking all sessions for credentials ID: ${credentialsId}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async revokeSessionById(sessionId: string, credentialsId: string): Promise<boolean> {
    this.logger.log(`Database [Prisma]: Revoking active session ID: ${sessionId}`);

    try {
      const result = await this.prisma.session.updateMany({
        where: { id: sessionId, credentialsId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Database [Prisma]: Failure revoking session ID: ${sessionId}`, error);
      handlePrismaError(error);
    }
  }

  async findActiveSessions(credentialsId: string): Promise<DatabaseSession[]> {
    this.logger.log(
      `Database [Prisma]: Listing non-revoked active sessions for ID: ${credentialsId}`,
    );

    return this.prisma.session.findMany({
      where: { credentialsId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSessionById(sessionId: string): Promise<DatabaseSession | null> {
    this.logger.log(`Database [Prisma]: Querying session metadata by ID: ${sessionId}`);
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  async updateSessionLastActive(sessionId: string): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Updating last active timestamp for session ID: ${sessionId}`,
    );

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure updating last active field for session ID: ${sessionId}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Updating (rotating) token hash for session ID: ${sessionId}`,
    );
    this.logger.verbose(
      { sessionId, newTokenHash },
      'Database [Prisma]: updateSessionTokenHash target variables',
    );

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { tokenHash: newTokenHash },
      });
      this.logger.log(
        `Database [Prisma]: Token hash updated successfully for session ID: ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure rotating token hash for session ID: ${sessionId}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async findAdminAccount(credentialsId: string): Promise<AuthAdminAccount | null> {
    this.logger.log(`Database [Prisma]: Querying safe admin account view for ID: ${credentialsId}`);
    return this.prisma.credentials.findUnique({
      where: { id: credentialsId },
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
  }

  async banAndRevokeAllSessions(credentialsId: string, ban: AdminBanState): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Atomically banning and revoking sessions for credentials ID: ${credentialsId}`,
    );
    try {
      const revokedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.credentials.update({
          where: { id: credentialsId },
          data: {
            isBanned: ban.isBanned,
            bannedUntil: ban.bannedUntil,
            banReason: ban.banReason,
            bannedAt: ban.bannedAt,
            bannedBy: ban.bannedBy,
          },
        }),
        this.prisma.session.updateMany({
          where: { credentialsId, revokedAt: null },
          data: { revokedAt },
        }),
      ]);
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Atomic ban transaction failed for ID: ${credentialsId}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async clearBan(credentialsId: string): Promise<void> {
    this.logger.log(`Database [Prisma]: Clearing ban state for credentials ID: ${credentialsId}`);
    try {
      await this.prisma.credentials.update({
        where: { id: credentialsId },
        data: {
          isBanned: false,
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
          bannedBy: null,
        },
      });
    } catch (error) {
      this.logger.error(`Database [Prisma]: Failure clearing ban for ID: ${credentialsId}`, error);
      handlePrismaError(error);
    }
  }

  async normalizeExpiredBan(credentialsId: string, now: Date): Promise<boolean> {
    this.logger.log(`Database [Prisma]: Normalizing expired ban for ID: ${credentialsId}`);
    try {
      const result = await this.prisma.credentials.updateMany({
        where: { id: credentialsId, isBanned: true, bannedUntil: { not: null, lte: now } },
        data: {
          isBanned: false,
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
          bannedBy: null,
        },
      });
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Database [Prisma]: Failure normalizing ban for ID: ${credentialsId}`, error);
      handlePrismaError(error);
    }
  }

  async listAdminSessions(credentialsId: string): Promise<AdminSessionsResponse> {
    this.logger.log(`Database [Prisma]: Listing safe active sessions for ID: ${credentialsId}`);
    const sessions = await this.prisma.session.findMany({
      where: { credentialsId, revokedAt: null },
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
    return sessions.map((session) => ({ ...session, isCurrent: false }));
  }

  async verifyCredentials(id: string): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Performing verification step (isVerified=true) for credentials ID: ${id}`,
    );

    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { isVerified: true },
      });
      this.logger.log(`Database [Prisma]: Credentials ID: ${id} verified successfully`);
    } catch (error) {
      this.logger.error(
        `Database [Prisma]: Failure updating verification state for credentials ID: ${id}`,
        error,
      );
      handlePrismaError(error);
    }
  }

  async deleteUnverifiedOlderThan(before: Date): Promise<number> {
    this.logger.log(
      `Database [Prisma]: Cleaning up unverified stale records older than: ${before.toISOString()}`,
    );

    try {
      const result = await this.prisma.credentials.deleteMany({
        where: {
          isVerified: false,
          passwordHash: { not: null },
          createdAt: { lt: before },
        },
      });

      this.logger.verbose(
        { deletedCount: result.count },
        'Database [Prisma]: deleteUnverifiedOlderThan cleanup summary',
      );
      return result.count;
    } catch (error) {
      this.logger.error(
        'Database [Prisma]: Failure during cleanup of stale unverified records',
        error,
      );
      handlePrismaError(error);
    }
  }
}
