import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AUTH_QUEUE, AllExceptionsFilter, LoggingInterceptor } from '@org/core';
import { Logger } from 'nestjs-pino';

import { AuthModule } from './app/auth.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${
    RABBITMQ_HOST ?? 'localhost'
  }:${RABBITMQ_PORT ?? 5672}`;

  // Гибридное приложение: HTTP-сервер для /health и /metrics
  // + RabbitMQ транспорт для обработки сообщений
  const app = await NestFactory.create(AuthModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Подключаем RabbitMQ транспорт поверх HTTP приложения
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: AUTH_QUEUE,
      queueOptions: { durable: true },
    },
  });

  // Стартуем RabbitMQ слушатель
  await app.startAllMicroservices();

  // Стартуем HTTP сервер для health + metrics
  const port = process.env['AUTH_PORT'] ?? 3002;
  await app.listen(port);

  app.get(Logger).log(`Auth Service: RMQ queue=${AUTH_QUEUE}, HTTP port=${port}`);
}

bootstrap();
