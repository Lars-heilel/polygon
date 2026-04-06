import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  AllExceptionsFilter,
  ConfigService,
  Env,
  LoggingInterceptor,
  NOTIFICATION_QUEUE,
} from '@org/core';
import { Logger } from 'nestjs-pino';

import { NotificationModule } from './app/notification.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule, {
    bufferLogs: true,
  });

  // ==========================================
  // Configuration Service
  // ==========================================
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  // ==========================================
  // Logging & Global Interceptors
  // ==========================================
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ==========================================
  // RabbitMQ Microservice
  // ==========================================
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: NOTIFICATION_QUEUE,
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`Notification Service: RMQ queue=${NOTIFICATION_QUEUE}`);
}

bootstrap();
