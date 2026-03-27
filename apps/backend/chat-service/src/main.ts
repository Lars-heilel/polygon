import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter, CHAT_QUEUE, LoggingInterceptor } from '@org/core';
import { ChatModule } from './app/chat.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST ?? 'localhost'}:${RABBITMQ_PORT ?? 5672}`;

  // Гибридное приложение: HTTP для /health + RabbitMQ для обработки сообщений
  const app = await NestFactory.create(ChatModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: CHAT_QUEUE,
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();

  const port = process.env['CHAT_PORT'] ?? 3003;
  await app.listen(port);

  app.get(Logger).log(`Chat Service: RMQ queue=${CHAT_QUEUE}, HTTP port=${port}`);
}

bootstrap();
