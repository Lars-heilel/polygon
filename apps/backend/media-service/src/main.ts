import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MediaModule } from './app/media.module';

async function bootstrap() {
  const app = await NestFactory.create(MediaModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3005;
  await app.listen(port);
  Logger.log(
    `🚀 Media Service is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
