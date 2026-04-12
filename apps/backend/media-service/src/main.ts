import { setupOtel } from '@org/core';
setupOtel('media-service');
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  ConfigService,
  Env,
  LoggingInterceptor,
  MEDIA_QUEUE,
  RpcErrorInterceptor,
} from '@org/core';
import { Logger } from 'nestjs-pino';

import { MediaModule } from './app/media.module';

async function bootstrap() {
  const app = await NestFactory.create(MediaModule, { bufferLogs: true });

  // ==========================================
  // Configuration Service
  // ==========================================
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  // ==========================================
  // Logging & Global Interceptors
  // ==========================================
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new RpcErrorInterceptor(), new LoggingInterceptor());

  // ==========================================
  // RabbitMQ Microservice
  // ==========================================
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: MEDIA_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`Media Service: RMQ queue=${MEDIA_QUEUE}`);
}

bootstrap();
