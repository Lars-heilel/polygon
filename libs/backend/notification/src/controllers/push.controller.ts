import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_EVENTS } from '@org/core';

import type { PushPayload, PushSubscriptionData } from '../interfaces/notification.interface';
import { PushService } from '../services/push.service';

@Controller()
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  @EventPattern(NOTIFICATION_EVENTS.PUSH_SUBSCRIBE)
  async subscribe(@Payload() payload: { userId: string; subscription: PushSubscriptionData }): Promise<void> {
    this.logger.log({ eventType: 'push_subscribe_request' });
    await this.pushService.subscribe(payload.userId, payload.subscription);
    this.logger.log({ eventType: 'push_subscribe_done' });
  }

  @EventPattern(NOTIFICATION_EVENTS.PUSH_UNSUBSCRIBE)
  async unsubscribe(@Payload() payload: { userId: string; endpoint: string }): Promise<void> {
    this.logger.log({ eventType: 'push_unsubscribe_request' });
    await this.pushService.unsubscribe(payload.userId, payload.endpoint);
    this.logger.log({ eventType: 'push_unsubscribe_done' });
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PUSH)
  async sendPush(@Payload() payload: PushPayload): Promise<void> {
    this.logger.log({ eventType: 'push_send_request' });
    const results = await this.pushService.send(payload.userId, payload);
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    this.logger.log({ eventType: 'push_send_done', sent, failed });
  }
}
