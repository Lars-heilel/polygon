import { Module } from '@nestjs/common';
import { OrgUserModule } from '@org/user';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { HealthController } from '../controllers/health.controller';

@Module({
  imports: [OrgUserModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [HealthController],
})
export class UserModule {}
