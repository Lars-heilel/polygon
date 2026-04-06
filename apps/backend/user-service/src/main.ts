import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllExceptionsFilter, ConfigService, Env, LoggingInterceptor, USER_QUEUE } from '@org/core';
import { Logger } from 'nestjs-pino';

import { UserModule } from './app/user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule, { bufferLogs: true });

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
      queue: USER_QUEUE,
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();

  // ==========================================
  // HTTP Server
  // ==========================================
  const port = process.env['USER_PORT'] ?? 3001;
  await app.listen(port);

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`User Service: RMQ queue=${USER_QUEUE}, HTTP port=${port}`);
}

bootstrap();
