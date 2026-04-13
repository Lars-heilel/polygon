import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  private static readonly SLOW_QUERY_MS = 200;

  constructor(config: ConfigService<Env, true>) {
    const isDev = config.get('NODE_ENV') !== 'production';
    const adapter = new PrismaPg({
      connectionString: config.get('AUTH_DATABASE_URL', { infer: true }),
    });
    super({
      adapter,
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
    });

    // @ts-expect-error Prisma не пробрасывает LogOpts через extends
    this.$on('error', (e: { message: string; target: string }) => {
      this.logger.error({ target: e.target }, e.message);
    });

    if (isDev) {
      // @ts-expect-error
      this.$on('warn', (e: { message: string }) => {
        this.logger.warn(e.message);
      });
      // @ts-expect-error
      this.$on('query', (e: { query: string; params: string; duration: number }) => {
        if (e.duration >= PrismaService.SLOW_QUERY_MS) {
          this.logger.warn({ duration: e.duration, params: e.params }, `Slow query: ${e.query}`);
        } else {
          this.logger.debug({ duration: e.duration }, e.query);
        }
      });
    }
  }
}
