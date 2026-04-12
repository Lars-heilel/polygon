import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { OrgNotificationModule } from '@org/notification';

@Module({
  imports: [OrgNotificationModule, LoggerModule.forService('notification-service'), HealthModule, MetricsModule],
  controllers: [],
})
export class NotificationModule {}
