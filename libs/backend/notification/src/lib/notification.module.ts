import { Module } from '@nestjs/common';
import { CoreConfigModule, CoreEmailModule } from '@org/core';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../services/notification.service';

@Module({
  imports: [CoreConfigModule, CoreEmailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class OrgNotificationModule {}
