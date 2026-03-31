import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
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
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';

import { AuthGatewayController } from '../controllers/auth.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
import { HealthController } from '../controllers/health.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

const rmqClient = (name: string, queue: string) => ({
  name,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [
        `amqp://${config.get('RABBITMQ_USER', { infer: true })}:${config.get('RABBITMQ_PASSWORD', {
          infer: true,
        })}@${config.get('RABBITMQ_HOST', { infer: true })}:${config.get('RABBITMQ_PORT', {
          infer: true,
        })}`,
      ],
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
    ClientsModule.registerAsync([
      rmqClient(AUTH_CLIENT_TOKEN, AUTH_QUEUE),
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(CHAT_CLIENT_TOKEN, CHAT_QUEUE),
    ]),
  ],
  controllers: [
    AuthGatewayController,
    UserGatewayController,
    ChatGatewayController,
    HealthController,
  ],
  providers: [
    JwtGuard,
    ChatSocketGateway,
    LocalStrategy,
    GithubStrategy,
    YandexStrategy,
    GoogleStrategy,
  ],
})
export class GatewayModule {}
