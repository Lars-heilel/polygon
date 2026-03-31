import { Module } from '@nestjs/common';
import { OrgAuthModule } from '@org/auth';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';

import { HealthController } from '../controllers/health.controller';

@Module({
  imports: [OrgAuthModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [HealthController],
})
export class AuthModule {}
