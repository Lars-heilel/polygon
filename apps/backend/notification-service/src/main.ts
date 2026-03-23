import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './app/notification.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3004;
  await app.listen(port);
  Logger.log(`🚀 Notification Service is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
