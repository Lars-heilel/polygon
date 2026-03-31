import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { OrgUserModule } from '@org/user';

import { HealthController } from '../controllers/health.controller';

@Module({
  imports: [OrgUserModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [HealthController],
})
export class UserModule {}
