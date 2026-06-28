import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, NOTIFICATION_QUEUE } from '@org/core';

import { NotificationModule } from './app/notification.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule);

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: NOTIFICATION_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  logger.log(`Notification Service: RMQ queue=${NOTIFICATION_QUEUE}`);
}

bootstrap();
