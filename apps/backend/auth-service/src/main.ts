import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { setupOtel } from '@org/core';
import { AUTH_QUEUE, ConfigService, Env, LoggingInterceptor, RpcErrorInterceptor } from '@org/core';
import { Logger } from 'nestjs-pino';

import { AuthModule } from './app/auth.module';

setupOtel('auth-service');

async function bootstrap() {
  const app = await NestFactory.create(AuthModule, { bufferLogs: true });

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
        queue: AUTH_QUEUE,
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`Auth Service: RMQ queue=${AUTH_QUEUE}`);
}

bootstrap();
