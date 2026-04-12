import { Module } from '@nestjs/common';
import { OrgAuthModule } from '@org/auth';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';

@Module({
  imports: [OrgAuthModule, LoggerModule.forService('auth-service'), HealthModule, MetricsModule],
  controllers: [],
})
export class AuthModule {}
