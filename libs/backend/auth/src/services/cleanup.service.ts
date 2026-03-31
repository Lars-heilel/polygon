import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AUTH_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type { IAuthRepository } from '../interfaces/auth.interface';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN)
    private readonly repo: IAuthRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async deleteStaleUnverifiedCredentials(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.repo.deleteUnverifiedOlderThan(cutoff);
    if (count > 0) {
      this.logger.log(`Deleted ${count} stale unverified credential(s)`);
    }
  }
}
