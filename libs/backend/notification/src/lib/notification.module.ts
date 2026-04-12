import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { CoreConfigModule, CoreEmailModule } from '@org/core';

import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../services/notification.service';

@Module({
  imports: [CoreConfigModule, CoreEmailModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    makeCounterProvider({
      name: 'email_sent_total',
      help: 'Total emails sent, labeled by type and status',
      labelNames: ['type', 'status'] as const,
    }),
    makeCounterProvider({
      name: 'rmq_events_total',
      help: 'Total RabbitMQ events consumed, labeled by pattern and status',
      labelNames: ['pattern', 'status'] as const,
    }),
  ],
})
export class OrgNotificationModule {}
