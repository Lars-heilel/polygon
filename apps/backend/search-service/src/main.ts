import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService, Env, SEARCH_QUEUE } from '@org/core';

import { SearchAppModule } from './app/search.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(SearchAppModule);

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: SEARCH_QUEUE,
        queueOptions: { durable: true },
        noAck: false,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  const port = process.env['SEARCH_PORT'] ?? 3006;
  await app.listen(port);

  logger.log(`Search Service: RMQ queue=${SEARCH_QUEUE}, HTTP port=${port}`);
}

bootstrap();
