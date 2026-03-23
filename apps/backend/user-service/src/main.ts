import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { UserModule } from './app/user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3002;
  await app.listen(port);
  Logger.log(`🚀 User Service is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
