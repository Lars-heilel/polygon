import { Injectable, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

// Prisma не пробрасывает LogOpts через extends — $on невозможно типизировать корректно.
// @see https://github.com/prisma/prisma/issues/16216
@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isDev = process.env['NODE_ENV'] !== 'production';
    const adapter = new PrismaPg({
      connectionString: process.env.NOTIFICATION_DATABASE_URL as string,
    });
    super({
      adapter,
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
    });

    if (isDev) {
      // @ts-expect-error Prisma не пробрасывает LogOpts через extends
      this.$on('query', (e: { query: string; duration: number }) => {
        this.logger.debug(`[${e.duration}ms] ${e.query}`);
      });
    }
  }
}
