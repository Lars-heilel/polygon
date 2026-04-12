import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { OrgUserModule } from '@org/user';

@Module({
  imports: [OrgUserModule, LoggerModule.forService('user-service'), HealthModule, MetricsModule],
  controllers: [],
})
export class UserModule {}
