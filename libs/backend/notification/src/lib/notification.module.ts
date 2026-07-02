import { Module } from '@nestjs/common';
import { CoreConfigModule, CoreEmailModule } from '@org/core';

import { NotificationController } from '../controllers/notification.controller';
import { PushController } from '../controllers/push.controller';
import { NotificationPrismaRepository } from '../database/repository/notification.prisma.repo';
import { PushSubscriptionPrismaRepository } from '../database/repository/push-subscription.prisma.repo';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationService } from '../services/notification.service';
import { PushService } from '../services/push.service';
import { PUSH_SUBSCRIPTION_REPOSITORY_TOKEN } from '../tokens/push.tokens';

@Module({
  imports: [CoreConfigModule, CoreEmailModule],
  controllers: [NotificationController, PushController],
  providers: [
    NotificationService,
    PushService,
    PrismaService,
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY_TOKEN,
      useClass: PushSubscriptionPrismaRepository,
    },
    NotificationPrismaRepository,
  ],
  exports: [PushService, NotificationService],
})
export class OrgNotificationModule {}
