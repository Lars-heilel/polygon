import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import {
  AllExceptionsFilter,
  LoggingInterceptor,
  NOTIFICATION_QUEUE,
} from '@org/core';
import { NotificationModule } from './app/notification.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } =
    process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${
    RABBITMQ_HOST ?? 'localhost'
  }:${RABBITMQ_PORT ?? 5672}`;

  const app = await NestFactory.create(NotificationModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: NOTIFICATION_QUEUE,
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();

  const port = process.env['NOTIFICATION_PORT'] ?? 3005;
  await app.listen(port);

  app
    .get(Logger)
    .log(
      `Notification Service: RMQ queue=${NOTIFICATION_QUEUE}, HTTP port=${port}`
    );
}

bootstrap();
