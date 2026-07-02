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
    this.logger.log(`RPC [PUSH_SUBSCRIBE]: userId=${payload.userId}, endpoint=${payload.subscription.endpoint.slice(0, 50)}...`);
    await this.pushService.subscribe(payload.userId, payload.subscription);
    this.logger.log(`RPC [PUSH_SUBSCRIBE]: subscription saved for userId=${payload.userId}`);
  }

  @EventPattern(NOTIFICATION_EVENTS.PUSH_UNSUBSCRIBE)
  async unsubscribe(@Payload() payload: { userId: string; endpoint: string }): Promise<void> {
    this.logger.log(`RPC [PUSH_UNSUBSCRIBE]: userId=${payload.userId}, endpoint=${payload.endpoint.slice(0, 50)}...`);
    await this.pushService.unsubscribe(payload.userId, payload.endpoint);
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PUSH)
  async sendPush(@Payload() payload: PushPayload): Promise<void> {
    this.logger.log(`RPC [SEND_PUSH]: userId=${payload.userId}, chatId=${(payload.data as Record<string, string> | undefined)?.chatId ?? 'unknown'}`);
    this.logger.debug({ payload }, 'RPC [SEND_PUSH]: full payload');
    const results = await this.pushService.send(payload.userId, payload);
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    this.logger.log(`RPC [SEND_PUSH]: done for userId=${payload.userId} — sent=${sent}, failed=${failed}`);
  }
}
