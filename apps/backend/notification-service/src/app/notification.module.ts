import { Module } from '@nestjs/common';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';
import { OrgNotificationModule } from '@org/notification';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.notification), OrgNotificationModule],
  controllers: [],
  providers: [],
})
export class NotificationModule {}
