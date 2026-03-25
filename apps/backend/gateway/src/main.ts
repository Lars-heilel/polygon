import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { GatewayModule } from './app/gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('api');

  const port = process.env.GATEWAY_PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Gateway is running on: http://localhost:${port}/api`);
}

bootstrap();
