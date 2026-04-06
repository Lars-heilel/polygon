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
  HealthModule,
  JwtGuard,
  LoggerModule,
  MetricsModule,
  SEARCH_CLIENT_TOKEN,
  SEARCH_QUEUE,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';

import { AuthGatewayController } from '../controllers/auth.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
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
    LoggerModule,
    HealthModule,
    MetricsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 1 minute window
          limit: 100, // 100 requests per minute per IP
        },
      ],
    }),
    ClientsModule.registerAsync([
      rmqClient(AUTH_CLIENT_TOKEN, AUTH_QUEUE),
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(CHAT_CLIENT_TOKEN, CHAT_QUEUE),
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
    ]),
  ],
  controllers: [
    AuthGatewayController,
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
