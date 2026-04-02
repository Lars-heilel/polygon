import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllExceptionsFilter, LoggingInterceptor, SEARCH_QUEUE } from '@org/core';
import { Logger } from 'nestjs-pino';

import { SearchAppModule } from './app/search.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${
    RABBITMQ_HOST ?? 'localhost'
  }:${RABBITMQ_PORT ?? 5672}`;

  const app = await NestFactory.create(SearchAppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: SEARCH_QUEUE,
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();

  const port = process.env['SEARCH_PORT'] ?? 3006;
  await app.listen(port);

  app.get(Logger).log(`Search Service: RMQ queue=${SEARCH_QUEUE}, HTTP port=${port}`);
}

bootstrap();
