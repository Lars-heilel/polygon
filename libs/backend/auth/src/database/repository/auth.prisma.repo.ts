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
      { found: !!result, hasCredentialsId: !!result?.id },
      'Database [Prisma]: findByEmail query result',
    );
    return result;
  }

  async findById(id: string): Promise<Credentials | null> {
    this.logger.log('Database [Prisma]: Querying credentials by ID');

    const result = await this.prisma.credentials.findUnique({
      where: { id },
    });

    this.logger.verbose(
      {
        found: !!result,
        hasPasswordHash: !!result?.passwordHash,
        isVerified: result?.isVerified,
        role: result?.role,
      },
      'Database [Prisma]: findById query result',
    );
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
      this.logger.log('Database [Prisma]: Successfully created credentials record');
      return result;
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('credentials_create_failed', error),
        'Database [Prisma]: Failure during credentials creation',
      );
      handlePrismaError(error);
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    this.logger.log('Database [Prisma]: Updating password hash for credentials');
    this.logger.verbose(
      { hasCredentialsId: !!id, passwordHashLength: passwordHash.length },
      'Database [Prisma]: updatePasswordHash parameters',
    );

    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { passwordHash },
      });
      this.logger.log('Database [Prisma]: Password hash updated successfully');
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('credentials_password_update_failed', error),
        'Database [Prisma]: Failure updating password hash for credentials',
      );
      handlePrismaError(error);
    }
  }

  async findOAuthAccount(
    provider: string,
    providerId: string,
  ): Promise<{ credentials: Credentials } | null> {
    this.logger.log(
      `Database [Prisma]: Querying OAuth account for provider: ${provider}`,
    );

    const result = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      select: { credentials: true },
    });

    this.logger.verbose(
      {
        found: !!result,
        hasCredentials: !!result?.credentials,
      },
      'Database [Prisma]: findOAuthAccount query result',
    );
    return result;
  }

  async createOAuthAccount(data: {
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void> {
    this.logger.log(
      `Database [Prisma]: Creating OAuth mapping [provider: ${data.provider}]`,
    );
    this.logger.debug(
      {
        provider: data.provider,
        hasProviderId: !!data.providerId,
        hasCredentialsId: !!data.credentialsId,
      },
      'Database [Prisma]: createOAuthAccount payload parameters',
    );

    try {
      await this.prisma.oAuthAccount.create({ data });
      this.logger.log(`Database [Prisma]: OAuth mapping created successfully`);
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('oauth_mapping_create_failed', error),
        'Database [Prisma]: Failure creating OAuth account mapping',
      );
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
    this.logger.log('Database [Prisma]: Storing session in SQL store');
    this.logger.debug(
      {
        hasTokenHash: !!data.tokenHash,
        hasCredentialsId: !!data.credentialsId,
        hasIp: !!data.ip,
        hasCountry: !!data.country,
        hasOs: !!data.os,
        hasBrowser: !!data.browser,
        hasDevice: !!data.device,
        hasUserAgent: !!data.userAgent,
        expiresAt: data.expiresAt.toISOString(),
      },
      'Database [Prisma]: saveSession diagnostic parameters',
    );

    try {
      await this.prisma.session.create({ data });
      this.logger.log('Database [Prisma]: Session successfully written to table');
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('session_create_failed', error),
        'Database [Prisma]: Failure writing session to storage',
      );
      handlePrismaError(error);
    }
  }

  async findSessionByTokenHash(tokenHash: string): Promise<DatabaseSession | null> {
    this.logger.log('Database [Prisma]: Querying session state by token hash');
    this.logger.verbose(
      { hasTokenHash: !!tokenHash },
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
      this.logger.error(
        this.prismaErrorDiagnostic('session_revoke_by_token_hash_failed', error),
        'Database [Prisma]: Failure revoking session by token hash',
      );
      handlePrismaError(error);
    }
  }

  async revokeAllSessions(credentialsId: string): Promise<void> {
    this.logger.log(
      'Database [Prisma]: Mass revocation initiated for credentials',
    );

    try {
      const result = await this.prisma.session.updateMany({
        where: { credentialsId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`Database [Prisma]: Revoked ${result.count} active sessions`);
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('sessions_revoke_all_failed', error),
        'Database [Prisma]: Failure revoking all sessions for credentials',
      );
      handlePrismaError(error);
    }
  }

  async revokeSessionById(sessionId: string, credentialsId: string): Promise<boolean> {
    this.logger.log('Database [Prisma]: Revoking active session by ID');

    try {
      const result = await this.prisma.session.updateMany({
        where: { id: sessionId, credentialsId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count > 0;
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('session_revoke_by_id_failed', error),
        'Database [Prisma]: Failure revoking session by ID',
      );
      handlePrismaError(error);
    }
  }

  async findActiveSessions(credentialsId: string): Promise<DatabaseSession[]> {
    this.logger.log(
      'Database [Prisma]: Listing non-revoked active sessions for credentials',
    );

    return this.prisma.session.findMany({
      where: { credentialsId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSessionById(sessionId: string): Promise<DatabaseSession | null> {
    this.logger.log('Database [Prisma]: Querying session metadata by ID');
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  async updateSessionLastActive(sessionId: string): Promise<void> {
    this.logger.log(
      'Database [Prisma]: Updating last active timestamp for session',
    );

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('session_last_active_update_failed', error),
        'Database [Prisma]: Failure updating last active field for session',
      );
      handlePrismaError(error);
    }
  }

  async updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void> {
    this.logger.log(
      'Database [Prisma]: Updating (rotating) token hash for session',
    );
    this.logger.verbose(
      { hasSessionId: !!sessionId, hasNewTokenHash: !!newTokenHash },
      'Database [Prisma]: updateSessionTokenHash target variables',
    );

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { tokenHash: newTokenHash },
      });
      this.logger.log(
        'Database [Prisma]: Token hash updated successfully for session',
      );
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('session_token_hash_rotate_failed', error),
        'Database [Prisma]: Failure rotating token hash for session',
      );
      handlePrismaError(error);
    }
  }

  async findAdminAccount(credentialsId: string): Promise<AuthAdminAccount | null> {
    this.logger.log('Database [Prisma]: Querying safe admin account view');
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
      'Database [Prisma]: Atomically banning and revoking sessions for credentials',
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
        this.prismaErrorDiagnostic('credentials_ban_transaction_failed', error),
        'Database [Prisma]: Atomic ban transaction failed',
      );
      handlePrismaError(error);
    }
  }

  async clearBan(credentialsId: string): Promise<void> {
    this.logger.log('Database [Prisma]: Clearing ban state for credentials');
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
      this.logger.error(
        this.prismaErrorDiagnostic('credentials_ban_clear_failed', error),
        'Database [Prisma]: Failure clearing ban',
      );
      handlePrismaError(error);
    }
  }

  async normalizeExpiredBan(credentialsId: string, now: Date): Promise<boolean> {
    this.logger.log('Database [Prisma]: Normalizing expired ban');
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
      this.logger.error(
        this.prismaErrorDiagnostic('credentials_ban_normalize_failed', error),
        'Database [Prisma]: Failure normalizing ban',
      );
      handlePrismaError(error);
    }
  }

  async listAdminSessions(credentialsId: string): Promise<AdminSessionsResponse> {
    this.logger.log('Database [Prisma]: Listing safe active sessions');
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
      'Database [Prisma]: Performing verification step (isVerified=true) for credentials',
    );

    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { isVerified: true },
      });
      this.logger.log('Database [Prisma]: Credentials verified successfully');
    } catch (error) {
      this.logger.error(
        this.prismaErrorDiagnostic('credentials_verify_failed', error),
        'Database [Prisma]: Failure updating verification state for credentials',
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
        this.prismaErrorDiagnostic('credentials_cleanup_failed', error),
        'Database [Prisma]: Failure during cleanup of stale unverified records',
      );
      handlePrismaError(error);
    }
  }

  private prismaErrorDiagnostic(eventType: string, error: unknown) {
    return {
      eventType,
      hasError: error !== undefined && error !== null,
      errorType: error instanceof Error ? error.name : typeof error,
    };
  }
}
