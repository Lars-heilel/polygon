import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CHAT_QUEUE, ConfigService, Env } from '@org/core';

import { ChatModule } from './app/chat.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

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
  logger.log(`Chat Service: RMQ queue=${CHAT_QUEUE}`);
}

bootstrap();
