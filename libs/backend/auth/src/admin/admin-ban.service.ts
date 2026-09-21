import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
} from '@org/core';

import type { IAdminBanService, IAuthRepository } from '../interfaces/auth.interface';

export const ADMIN_BAN_CLOCK_TOKEN = 'ADMIN_BAN_CLOCK_TOKEN';
export type AdminBanClock = () => Date;

export interface AdminRpcError {
  statusCode: number;
  message: string;
  code?: string;
  reason?: string | null;
  bannedUntil?: string | null;
}

export const adminRpcException = (error: AdminRpcError): RpcException => new RpcException(error);

@Injectable()
export class AdminBanService implements IAdminBanService {
  private readonly logger = new Logger(AdminBanService.name);

  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN) private readonly repo: IAuthRepository,
    @Inject(ADMIN_BAN_CLOCK_TOKEN) private readonly now: AdminBanClock,
  ) {}

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

  private async operational<T>(message: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error(this.errorDiagnostic('admin_operation_failed', message, error));
      throw adminRpcException({ statusCode: 503, message });
    }
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
