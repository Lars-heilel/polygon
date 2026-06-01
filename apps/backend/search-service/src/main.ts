import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { setupOtel } from '@org/core';
import {
  ConfigService,
  Env,
  LoggingInterceptor,
  RpcErrorInterceptor,
  SEARCH_QUEUE,
} from '@org/core';
import { Logger } from 'nestjs-pino';

import { SearchAppModule } from './app/search.module';

setupOtel('search-service');

async function bootstrap() {
  const app = await NestFactory.create(SearchAppModule, { bufferLogs: true });

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
        queue: SEARCH_QUEUE,
        queueOptions: { durable: true },
        noAck: false,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  // ==========================================
  // HTTP Server
  // ==========================================
  const port = process.env['SEARCH_PORT'] ?? 3006;
  await app.listen(port);

  // ==========================================
  // Service Start Log
  // ==========================================
  app.get(Logger).log(`Search Service: RMQ queue=${SEARCH_QUEUE}, HTTP port=${port}`);
}

bootstrap();
