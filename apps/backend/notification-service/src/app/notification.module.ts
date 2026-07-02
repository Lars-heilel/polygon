import { Module } from '@nestjs/common';
import { OrgNotificationModule } from '@org/notification';

@Module({
  imports: [OrgNotificationModule],
  controllers: [],
  providers: [],
})
export class NotificationModule {}
