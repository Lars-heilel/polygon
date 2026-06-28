import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MEDIA_QUEUE, ConfigService, Env, LoggingInterceptor, RpcErrorInterceptor } from '@org/core';
import { MediaModule } from './app/media.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(MediaModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.useGlobalInterceptors(new RpcErrorInterceptor(), new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: MEDIA_QUEUE,
      queueOptions: { durable: true },
    },
  }, { inheritAppConfig: true });

  await app.startAllMicroservices();
  logger.log(`Media Service: RMQ queue=${MEDIA_QUEUE}`);
}
bootstrap();
