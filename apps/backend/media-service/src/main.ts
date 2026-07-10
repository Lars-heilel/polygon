import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, MEDIA_QUEUE } from '@org/core';
import { Logger } from 'nestjs-pino';

import { MediaModule } from './app/media.module';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(MediaModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });
  const port = configService.get('MEDIA_METRICS_PORT', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: MEDIA_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Media Service: RMQ queue=${MEDIA_QUEUE}, health/metrics port=${port}`);
}
bootstrap();
