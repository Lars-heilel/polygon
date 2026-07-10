import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CHAT_QUEUE, ConfigService, Env } from '@org/core';
import { Logger } from 'nestjs-pino';

import { ChatModule } from './app/chat.module';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(ChatModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });
  const port = configService.get('CHAT_METRICS_PORT', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: CHAT_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Chat Service: RMQ queue=${CHAT_QUEUE}, health/metrics port=${port}`);
}

bootstrap();
