import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { CoreConfigModule } from '../config/config.module';
import type { Env } from '../config/env.schema';
import { REDIS_CLIENT } from './redis.token';

@Module({
  imports: [CoreConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis =>
        new Redis({
          host: config.getOrThrow('REDIS_HOST', { infer: true }),
          port: config.getOrThrow('REDIS_PORT', { infer: true }),
          password: config.get('REDIS_PASSWORD', { infer: true }),
          lazyConnect: true,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CoreRedisModule {}
