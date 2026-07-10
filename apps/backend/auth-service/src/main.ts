import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AUTH_QUEUE, ConfigService, Env } from '@org/core';
import { Logger } from 'nestjs-pino';

import { AuthModule } from './app/auth.module';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AuthModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });
  const port = configService.get('AUTH_METRICS_PORT', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: AUTH_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Auth Service: RMQ queue=${AUTH_QUEUE}, health/metrics port=${port}`);
}

bootstrap();
