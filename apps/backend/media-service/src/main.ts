import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { setupOtel } from '@org/core';
import { MEDIA_QUEUE, ConfigService, Env, LoggingInterceptor, RpcErrorInterceptor } from '@org/core';
import { Logger } from 'nestjs-pino';
import { MediaModule } from './app/media.module';

setupOtel('media-service');

async function bootstrap() {
  const app = await NestFactory.create(MediaModule, { bufferLogs: true });
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const RABBITMQ_URL = configService.get('RABBITMQ_URL', { infer: true });

  app.useLogger(app.get(Logger));
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
  app.get(Logger).log(`Media Service: RMQ queue=${MEDIA_QUEUE}`);
}
bootstrap();
