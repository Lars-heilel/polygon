import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_QUEUE,
  CHAT_CLIENT_TOKEN,
  CHAT_QUEUE,
  ConfigService,
  CoreConfigModule,
  CoreTokenModule,
  HealthModule,
  JwtGuard,
  LoggerModule,
  MetricsModule,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';
import { AuthGatewayController } from '../controllers/auth.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
import { HealthController } from '../controllers/health.controller';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';
import { GithubStrategy } from '../oauth/github.strategy';
import { YandexStrategy } from '../oauth/yandex.strategy';
import { GoogleStrategy } from '../oauth/google.strategy';

@Module({
  imports: [
    CoreConfigModule,
    CoreTokenModule,
    LoggerModule,
    HealthModule,
    MetricsModule,
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: AUTH_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: USER_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: USER_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: CHAT_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: CHAT_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthGatewayController, UserGatewayController, ChatGatewayController, HealthController],
  providers: [JwtGuard, ChatSocketGateway, GithubStrategy, YandexStrategy, GoogleStrategy],
})
export class GatewayModule {}
