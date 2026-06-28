import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_EVENTS } from '@org/core';

import { NotificationService } from '../services/notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  @EventPattern(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL)
  async sendVerificationEmail(@Payload() payload: { to: string; token: string }): Promise<void> {
    await this.notificationService.sendVerificationEmail(payload.to, payload.token);
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET)
  async sendPasswordReset(@Payload() payload: { to: string; token: string }): Promise<void> {
    await this.notificationService.sendPasswordReset(payload.to, payload.token);
  }
}
