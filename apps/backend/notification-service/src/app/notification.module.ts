import { Module } from '@nestjs/common';
import { HealthModule } from '@org/core';
import { OrgNotificationModule } from '@org/notification';

@Module({
  imports: [
    OrgNotificationModule,
    HealthModule,
  ],
  controllers: [],
})
export class NotificationModule {}
