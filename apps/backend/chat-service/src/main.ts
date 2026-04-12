import { setupOtel } from '@org/core';
setupOtel('chat-service');
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CHAT_QUEUE, ConfigService, Env, LoggingInterceptor, RpcErrorInterceptor } from '@org/core';
import { Logger } from 'nestjs-pino';

import { ChatModule } from './app/chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule, { bufferLogs: true });

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
        queue: CHAT_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`Chat Service: RMQ queue=${CHAT_QUEUE}`);
}

bootstrap();
