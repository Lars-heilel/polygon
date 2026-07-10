import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, NOTIFICATION_QUEUE } from '@org/core';
import { Logger } from 'nestjs-pino';

import { NotificationModule } from './app/notification.module';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });
  const port = configService.get('NOTIFICATION_METRICS_PORT', { infer: true });

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
  await app.listen(port);
  logger.log(`Notification Service: RMQ queue=${NOTIFICATION_QUEUE}, health/metrics port=${port}`);
}

bootstrap();
