import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  type AdminBanDuration,
  type AdminBanReason,
  type AdminBanState,
  type AdminSessionsResponse,
  adminBanRequestSchema,
} from '@org/common';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  BAN_CACHE_REPOSITORY_TOKEN,
  SESSION_CACHE_REPOSITORY_TOKEN,
} from '@org/core';

import type { IBanCacheRepository } from '../cache/ban.cache.interface';
import type { ISessionCacheRepository } from '../cache/session.cache.interface';
import type {
  AuthAdminAccount,
  IAdminBanService,
  IAuthRepository,
} from '../interfaces/auth.interface';
import { canManage } from './admin-policy';

export const ADMIN_BAN_CLOCK_TOKEN = 'ADMIN_BAN_CLOCK_TOKEN';
export const ADMIN_LOCK_TIMING_TOKEN = 'ADMIN_LOCK_TIMING_TOKEN';
export type AdminBanClock = () => Date;
export interface AdminLockTiming {
  leaseMs: number;
  renewIntervalMs: number;
}

export interface AdminRpcError {
  statusCode: number;
  message: string;
  code?: string;
  reason?: string | null;
  bannedUntil?: string | null;
}

export const adminRpcException = (error: AdminRpcError): RpcException => new RpcException(error);

const durationMs: Record<Exclude<AdminBanDuration, 'PERMANENT'>, number> = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
};

const presetReasons: Record<Exclude<AdminBanReason, 'CUSTOM'>, string> = {
  SPAM: 'Spam',
  BULLYING: 'Bullying',
  UNACCEPTABLE_CONTENT: 'Unacceptable content',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity',
};

@Injectable()
export class AdminBanService implements IAdminBanService {
  private readonly logger = new Logger(AdminBanService.name);

  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN) private readonly repo: IAuthRepository,
    @Inject(SESSION_CACHE_REPOSITORY_TOKEN)
    private readonly sessions: ISessionCacheRepository,
    @Inject(BAN_CACHE_REPOSITORY_TOKEN) private readonly bans: IBanCacheRepository,
    @Inject(ADMIN_BAN_CLOCK_TOKEN) private readonly now: AdminBanClock,
    @Inject(ADMIN_LOCK_TIMING_TOKEN) private readonly lockTiming: AdminLockTiming,
  ) {}

  async getAccount(actorId: string, targetId: string): Promise<AuthAdminAccount> {
    return this.operational('Unable to get account', async () => {
      const { target } = await this.loadAndAuthorize(actorId, targetId);
      return target;
    });
  }

  async listSessions(actorId: string, targetId: string): Promise<AdminSessionsResponse> {
    return this.operational('Unable to list sessions', async () => {
      await this.loadAndAuthorize(actorId, targetId);
      return this.repo.listAdminSessions(targetId);
    });
  }

  async revokeSession(actorId: string, targetId: string, sessionId: string): Promise<void> {
    await this.operational('Unable to revoke session', async () => {
      await this.loadAndAuthorize(actorId, targetId);
      const session = await this.repo.findSessionById(sessionId);
      if (!session || session.credentialsId !== targetId) {
        throw adminRpcException({ statusCode: 404, message: 'Session not found' });
      }
      if (session.revokedAt === null) {
        // A false result can mean a concurrent revocation; ownership was already verified.
        await this.repo.revokeSessionById(sessionId, targetId);
      }
      const cacheResults = await Promise.allSettled([
        this.sessions.remove(sessionId),
        this.sessions.removeFromUserSessions(targetId, sessionId),
      ]);
      if (cacheResults.some((result) => result.status === 'rejected')) {
        throw new Error('Session cache reconciliation failed');
      }
    });
  }

  async revokeAllSessions(actorId: string, targetId: string): Promise<void> {
    await this.operational('Unable to revoke sessions', async () => {
      await this.loadAndAuthorize(actorId, targetId);
      await this.repo.revokeAllSessions(targetId);
      await this.sessions.removeAllForUser(targetId);
    });
  }

  async ban(actorId: string, targetId: string, input: unknown): Promise<void> {
    await this.operational('Unable to establish ban state', () =>
      this.withTargetLock(targetId, () => this.banLocked(actorId, targetId, input)),
    );
  }

  private async banLocked(actorId: string, targetId: string, input: unknown): Promise<void> {
    const request = adminBanRequestSchema.safeParse(input);
    if (!request.success) {
      throw adminRpcException({ statusCode: 400, message: 'Invalid ban request' });
    }

    const { actor, target } = await this.loadAndAuthorize(actorId, targetId);
    const bannedAt = this.now();
    if (this.isActiveBan(target, bannedAt)) {
      await this.reconcileActiveBan(target);
      return;
    }
    const bannedUntil =
      request.data.duration === 'PERMANENT'
        ? null
        : new Date(bannedAt.getTime() + durationMs[request.data.duration]);
    const banReason =
      request.data.reason === 'CUSTOM'
        ? request.data.customReason
        : presetReasons[request.data.reason];
    const state: AdminBanState = {
      isBanned: true,
      bannedUntil,
      banReason,
      bannedAt,
      bannedBy: actor.id,
    };

    await this.repo.banAndRevokeAllSessions(target.id, state);

    try {
      await this.sessions.removeAllForUser(target.id);
      await this.bans.set(target.id, {
        reason: banReason,
        bannedUntil: bannedUntil?.toISOString() ?? null,
      });
    } catch (error) {
      const results = await Promise.allSettled([
        this.repo.clearBan(target.id),
        this.bans.clear(target.id),
      ]);
      const compensationErrors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : [],
      );
      const cause = compensationErrors.length
        ? new AggregateError([error, ...compensationErrors], 'Ban and compensation failed')
        : error;
      this.logger.error(
        this.errorDiagnostic(
          'admin_ban_state_compensation_failed',
          'Unable to establish ban state; session revocation is not reversible',
          cause,
        ),
      );
      throw adminRpcException({ statusCode: 503, message: 'Unable to establish ban state' });
    }
  }

  async unban(actorId: string, targetId: string): Promise<void> {
    await this.operational('Unable to clear ban state', () =>
      this.withTargetLock(targetId, () => this.unbanLocked(actorId, targetId)),
    );
  }

  private async unbanLocked(actorId: string, targetId: string): Promise<void> {
    const { target } = await this.loadAndAuthorize(actorId, targetId);
    if (target.isBanned) {
      try {
        await this.repo.clearBan(target.id);
      } catch (cause) {
        this.logger.error(
          this.errorDiagnostic(
            'admin_unban_persisted_clear_failed',
            'Unable to clear persisted ban state',
            cause,
          ),
        );
        throw adminRpcException({ statusCode: 503, message: 'Unable to clear ban state' });
      }
    }
    try {
      await this.bans.clear(target.id);
    } catch (cause) {
      this.logger.error(
        this.errorDiagnostic(
          'admin_unban_marker_clear_failed',
          'Persisted ban was cleared but Redis marker cleanup failed',
          cause,
        ),
      );
      throw adminRpcException({ statusCode: 503, message: 'Unable to clear ban state' });
    }
  }

  async assertAccountActive(credentialsId: string): Promise<void> {
    const account = await this.operational('Unable to check account state', () =>
      this.repo.findAdminAccount(credentialsId),
    );
    if (!account) throw adminRpcException({ statusCode: 404, message: 'User not found' });

    const now = this.now();
    if (!account.isBanned) return;
    if (account.bannedUntil !== null && account.bannedUntil <= now) {
      await this.repo.normalizeExpiredBan(credentialsId, now);
      return;
    }
    throw adminRpcException({
      statusCode: 403,
      code: 'ACCOUNT_BANNED',
      message: 'Account is banned',
      reason: account.banReason,
      bannedUntil: account.bannedUntil?.toISOString() ?? null,
    });
  }

  private async loadAndAuthorize(
    actorId: string,
    targetId: string,
  ): Promise<{ actor: AuthAdminAccount; target: AuthAdminAccount }> {
    const actor = await this.repo.findAdminAccount(actorId);
    if (!actor) throw adminRpcException({ statusCode: 404, message: 'Actor not found' });
    const target = await this.repo.findAdminAccount(targetId);
    if (!target) throw adminRpcException({ statusCode: 404, message: 'Target not found' });
    if (!canManage(actor.role, target.role, actorId === targetId)) {
      throw adminRpcException({ statusCode: 403, message: 'Insufficient role hierarchy' });
    }
    return { actor, target };
  }

  private async operational<T>(message: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error(this.errorDiagnostic('admin_operation_failed', message, error));
      throw adminRpcException({ statusCode: 503, message });
    }
  }

  private isActiveBan(account: AuthAdminAccount, now: Date): boolean {
    return account.isBanned && (account.bannedUntil === null || account.bannedUntil > now);
  }

  private async reconcileActiveBan(account: AuthAdminAccount): Promise<void> {
    try {
      await this.sessions.removeAllForUser(account.id);
      await this.bans.set(account.id, {
        reason: account.banReason ?? 'Account banned',
        bannedUntil: account.bannedUntil?.toISOString() ?? null,
      });
    } catch (cause) {
      this.logger.error(
        this.errorDiagnostic(
          'admin_active_ban_reconciliation_failed',
          'Unable to reconcile active ban; Redis session revocation is not reversible',
          cause,
        ),
      );
      throw adminRpcException({ statusCode: 503, message: 'Unable to establish ban state' });
    }
  }

  private async withTargetLock(
    operationTargetId: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    let ownershipToken: string | null;
    try {
      ownershipToken = await this.bans.acquireLock(operationTargetId, this.lockTiming.leaseMs);
    } catch (cause) {
      this.logger.error(
        this.errorDiagnostic(
          'admin_operation_lock_acquire_failed',
          'Unable to acquire admin operation lock',
          cause,
        ),
      );
      throw adminRpcException({
        statusCode: 503,
        message: 'Unable to acquire admin operation lock',
      });
    }
    if (ownershipToken === null) {
      throw adminRpcException({
        statusCode: 409,
        message: 'Another admin operation is in progress',
      });
    }

    const heartbeatController = new AbortController();
    const heartbeat = this.maintainLock(
      operationTargetId,
      ownershipToken,
      heartbeatController.signal,
    );

    let operationFailed = false;
    let operationError: unknown;
    try {
      await operation();
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }

    heartbeatController.abort();
    const renewalError = await heartbeat;

    let releaseError: unknown;
    try {
      const released = await this.bans.releaseLock(operationTargetId, ownershipToken);
      if (!released) releaseError = new Error('Admin operation lock ownership was lost');
    } catch (error) {
      releaseError = error;
    }

    if (releaseError !== undefined) {
      this.logger.error(
        this.errorDiagnostic(
          'admin_operation_lock_release_failed',
          'Unable to safely release admin operation lock',
          releaseError,
        ),
      );
    }
    if (operationFailed) throw operationError;
    if (renewalError !== undefined) {
      this.logger.error(
        this.errorDiagnostic(
          'admin_operation_lock_renewal_failed',
          'Admin operation lock renewal failed',
          renewalError,
        ),
      );
      throw adminRpcException({
        statusCode: 503,
        message: 'Admin operation lock renewal failed',
      });
    }
    if (releaseError !== undefined) {
      throw adminRpcException({
        statusCode: 503,
        message: 'Unable to release admin operation lock',
      });
    }
  }

  private async maintainLock(
    targetId: string,
    ownershipToken: string,
    signal: AbortSignal,
  ): Promise<unknown | undefined> {
    while (await this.waitForRenewal(signal)) {
      try {
        const renewed = await this.bans.renewAdminLock(
          targetId,
          ownershipToken,
          this.lockTiming.leaseMs,
        );
        if (!renewed) return new Error('Admin operation lock ownership was lost during renewal');
      } catch (error) {
        return error;
      }
    }
    return undefined;
  }

  private waitForRenewal(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(false);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(true);
      }, this.lockTiming.renewIntervalMs);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private errorDiagnostic(eventType: string, operation: string, error: unknown) {
    return {
      eventType,
      operation,
      hasError: error !== undefined && error !== null,
      errorType: error instanceof Error ? error.name : typeof error,
    };
  }
}
