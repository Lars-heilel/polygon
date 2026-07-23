import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Logger, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from '@org/auth';
import { ActiveAccountGuard, CurrentUser, NOTIFICATION_CLIENT_TOKEN, NOTIFICATION_EVENTS, type Env, type JwtPayload } from '@org/core';

@ApiTags('notifications')
@ApiCookieAuth('access_token')
@Controller('notifications/push')
@UseGuards(SessionGuard, ActiveAccountGuard)
export class NotificationGatewayController {
  private readonly logger = new Logger(NotificationGatewayController.name);

  constructor(
    @Inject(NOTIFICATION_CLIENT_TOKEN) private readonly notificationClient: ClientProxy,
    private readonly config: ConfigService<Env>,
  ) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  @ApiResponse({ status: 201, description: 'Subscribed successfully' })
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string; p256dh: string; auth: string },
  ): Promise<void> {
    this.logger.log({
      eventType: 'push_subscribe_request',
      route: '/notifications/push/subscribe',
      hasEndpoint: !!body.endpoint,
      hasP256dh: !!body.p256dh,
      hasAuth: !!body.auth,
    });
    await this.notificationClient.emit(NOTIFICATION_EVENTS.PUSH_SUBSCRIBE, {
      userId: user.sub,
      subscription: { endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth },
    });
    this.logger.log({
      eventType: 'push_subscribe_emitted',
      route: '/notifications/push/subscribe',
    });
  }

  @Delete('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  @ApiResponse({ status: 204, description: 'Unsubscribed successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string },
  ): Promise<void> {
    this.logger.log({
      eventType: 'push_unsubscribe_request',
      route: '/notifications/push/unsubscribe',
      hasEndpoint: !!body.endpoint,
    });
    await this.notificationClient.emit(NOTIFICATION_EVENTS.PUSH_UNSUBSCRIBE, {
      userId: user.sub,
      endpoint: body.endpoint,
    });
  }

  @Get('vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  @ApiResponse({ status: 200, description: 'VAPID public key' })
  getVapidKey(): { publicKey: string } {
    this.logger.log(`HTTP GET /notifications/push/vapid-key — returning public key`);
    return { publicKey: this.config.getOrThrow('VAPID_PUBLIC_KEY', { infer: true }) };
  }
}
