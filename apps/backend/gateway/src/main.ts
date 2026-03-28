import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter, LoggingInterceptor } from '@org/core';
import { GatewayModule } from './app/gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, {
    // Буферизируем логи до инициализации Pino, чтобы ничего не потерять
    bufferLogs: true,
  });

  // Заменяем встроенный NestJS Logger на Pino
  app.useLogger(app.get(Logger));

  app.use(cookieParser());
  app.use(passport.initialize());
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('api');

  // Глобальный перехватчик ошибок — ловит всё что не поймали контроллеры
  app.useGlobalFilters(new AllExceptionsFilter());

  // Логируем время выполнения каждого запроса
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env['GATEWAY_PORT'] ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Gateway is running on: http://localhost:${port}/api`);
}

bootstrap();
