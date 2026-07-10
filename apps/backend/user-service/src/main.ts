import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, USER_QUEUE } from '@org/core';
import { Logger } from 'nestjs-pino';

import { UserModule } from './app/user.module';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(UserModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: USER_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  const port = configService.get('USER_PORT', { infer: true });
  await app.listen(port);

  logger.log(`User Service: RMQ queue=${USER_QUEUE}, HTTP port=${port}`);
}

bootstrap();
