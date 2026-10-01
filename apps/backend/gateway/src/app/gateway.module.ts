import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  GithubStrategy,
  GoogleStrategy,
  LocalStrategy,
  SessionGuard,
  SessionRedisRepository,
} from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_QUEUE,
  ActiveAccountGuard,
  BanMarkerRepository,
  CHAT_CLIENT_TOKEN,
  CHAT_QUEUE,
  CoreConfigModule,
  CoreRedisModule,
  CoreStorageModule,
  CoreTokenModule,
  type Env,
  JwtGuard,
  MEDIA_CLIENT_TOKEN,
  MEDIA_QUEUE,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_QUEUE,
  ObservabilityModule,
  RolesGuard,
  SEARCH_CLIENT_TOKEN,
  SEARCH_QUEUE,
  SERVICE_NAMES,
  SESSION_CACHE_REPOSITORY_TOKEN,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';

import { GatewayChatCacheService } from '../cache/gateway-chat-cache.service';
import { AuthGatewayController } from '../controllers/auth.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
import { MediaGatewayController } from '../controllers/media.controller';
import { NotificationGatewayController } from '../controllers/notification.controller';
import { SearchGatewayController } from '../controllers/search.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';
import { USER_THROTTLE } from '../throttle/throttle-limits';
import { throttleTracker } from '../throttle/user-throttle.tracker';

const rmqClient = (name: string, queue: string) => ({
  name,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [config.get<string>('RABBITMQ_URL', { infer: true })],
      queue,
      queueOptions: { durable: true },
    },
  }),
});

@Module({
  imports: [
    ObservabilityModule.forService(SERVICE_NAMES.gateway),
    CoreConfigModule,
    CoreStorageModule,
    CoreTokenModule,
    CoreRedisModule,
    ThrottlerModule.forRootAsync({
      imports: [CoreConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        if (config.getOrThrow('THROTTLE_USER_LIMIT', { infer: true }) !== USER_THROTTLE.limit) {
          throw new Error('THROTTLE_USER_LIMIT drifted from USER_THROTTLE.limit');
        }
        return {
          throttlers: [
            {
              ttl: 60000,
              limit: config.getOrThrow('THROTTLE_ANON_LIMIT', { infer: true }),
            },
          ],
          getTracker: (req: Record<string, unknown>) =>
            throttleTracker(req as { headers?: { cookie?: string }; ip?: string }),
        };
      },
    }),
    ClientsModule.registerAsync([
      rmqClient(AUTH_CLIENT_TOKEN, AUTH_QUEUE),
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(CHAT_CLIENT_TOKEN, CHAT_QUEUE),
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
      rmqClient(MEDIA_CLIENT_TOKEN, MEDIA_QUEUE),
      rmqClient(NOTIFICATION_CLIENT_TOKEN, NOTIFICATION_QUEUE),
    ]),
  ],
  controllers: [
    AuthGatewayController,
    MediaGatewayController,
    UserGatewayController,
    ChatGatewayController,
    SearchGatewayController,
    NotificationGatewayController,
  ],
  providers: [
    JwtGuard,
    ActiveAccountGuard,
    RolesGuard,
    BanMarkerRepository,
    { provide: SESSION_CACHE_REPOSITORY_TOKEN, useClass: SessionRedisRepository },
    SessionGuard,
    ChatSocketGateway,
    GatewayChatCacheService,
    LocalStrategy,
    GithubStrategy,
    GoogleStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class GatewayModule {}
