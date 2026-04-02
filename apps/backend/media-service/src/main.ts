import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { MediaModule } from './app/media.module';

async function bootstrap() {
  const app = await NestFactory.create(MediaModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const config = app.get(ConfigService);
  const port = config.get<number>('MEDIA_PORT', 3004);
  await app.listen(port);
  Logger.log(`🚀 Media Service is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
