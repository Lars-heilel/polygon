import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ChatModule } from './app/chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3003;
  await app.listen(port);
  Logger.log(`🚀 Chat Service is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
