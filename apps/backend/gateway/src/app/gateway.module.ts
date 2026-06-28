import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GithubStrategy, GoogleStrategy, LocalStrategy, YandexStrategy } from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_QUEUE,
  CHAT_CLIENT_TOKEN,
  CHAT_QUEUE,
  CoreConfigModule,
  CoreTokenModule,
  type Env,
  JwtGuard,
  MEDIA_CLIENT_TOKEN,
  MEDIA_QUEUE,
  SEARCH_CLIENT_TOKEN,
  SEARCH_QUEUE,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';

import { AuthGatewayController } from '../controllers/auth.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
import { MediaGatewayController } from '../controllers/media.controller';
import { SearchGatewayController } from '../controllers/search.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

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
    CoreConfigModule,
    CoreTokenModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    ClientsModule.registerAsync([
      rmqClient(AUTH_CLIENT_TOKEN, AUTH_QUEUE),
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(CHAT_CLIENT_TOKEN, CHAT_QUEUE),
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
      rmqClient(MEDIA_CLIENT_TOKEN, MEDIA_QUEUE),
    ]),
  ],
  controllers: [
    AuthGatewayController,
    MediaGatewayController,
    UserGatewayController,
    ChatGatewayController,
    SearchGatewayController,
  ],
  providers: [
    JwtGuard,
    ChatSocketGateway,
    LocalStrategy,
    GithubStrategy,
    YandexStrategy,
    GoogleStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class GatewayModule {}
