import { Module } from '@nestjs/common';

import { CoreConfigModule } from '../config/config.module';
import { RedisService } from './redis.service';

@Module({
  imports: [CoreConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class CoreRedisModule {}
