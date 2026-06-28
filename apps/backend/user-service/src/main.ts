import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, USER_QUEUE } from '@org/core';

import { UserModule } from './app/user.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(UserModule);

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: USER_QUEUE,
        queueOptions: { durable: true },
        noAck: false,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  const port = process.env['USER_PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`User Service: RMQ queue=${USER_QUEUE}, HTTP port=${port}`);
}

bootstrap();
