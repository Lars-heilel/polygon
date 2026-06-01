import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_EVENTS } from '@org/core';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';

import { NotificationService } from '../services/notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectMetric('rmq_events_total') private readonly rmqCounter: Counter<string>,
  ) {}

  @EventPattern(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL)
  async sendVerificationEmail(@Payload() payload: { to: string; token: string }): Promise<void> {
    try {
      await this.notificationService.sendVerificationEmail(payload.to, payload.token);
      this.rmqCounter.inc({
        pattern: NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL,
        status: 'success',
      });
    } catch (error) {
      this.rmqCounter.inc({
        pattern: NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL,
        status: 'error',
      });
      throw error;
    }
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET)
  async sendPasswordReset(@Payload() payload: { to: string; token: string }): Promise<void> {
    try {
      await this.notificationService.sendPasswordReset(payload.to, payload.token);
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, status: 'success' });
    } catch (error) {
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, status: 'error' });
      throw error;
    }
  }
}
