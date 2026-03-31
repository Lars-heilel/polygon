import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService<Env>) {
    const adapter = new PrismaPg({
      connectionString: config.get('AUTH_DATABASE_URL', { infer: true })!,
    });
    super({ adapter });
  }
}
