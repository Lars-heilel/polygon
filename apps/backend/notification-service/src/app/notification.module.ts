import { Module } from '@nestjs/common';
import { OrgNotificationModule } from '@org/notification';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { HealthController } from '../controllers/health.controller';

@Module({
  imports: [OrgNotificationModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [HealthController],
})
export class NotificationModule {}
