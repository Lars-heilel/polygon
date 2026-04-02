import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, LoggingInterceptor } from '@org/core';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import passport from 'passport';

import { GatewayModule } from './app/gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, {
    // Буферизируем логи до инициализации Pino, чтобы ничего не потерять
    bufferLogs: true,
  });

  // Заменяем встроенный NestJS Logger на Pino
  app.useLogger(app.get(Logger));

  app.use(helmet());

  app.enableCors({
    origin: process.env['CLIENT_URL'] ?? 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());

  // CSRF protection (double-submit cookie pattern)
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env['JWT_ACCESS_SECRET'] ?? 'dev-csrf-secret-min-32-characters-x',
    getSessionIdentifier: (req) => (req as Request).ip ?? 'unknown',
    cookieName: '__csrf',
    cookieOptions: {
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
      httpOnly: true,
    },
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  });

  app.use(doubleCsrfProtection);

  // Endpoint for client to fetch a CSRF token
  app.getHttpAdapter().get('/api/auth/csrf-token', (req: Request, res: Response) => {
    const token = generateCsrfToken(req, res);
    res.json({ token });
  });

  app.use(passport.initialize());
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('api');

  // Глобальный перехватчик ошибок — ловит всё что не поймали контроллеры
  app.useGlobalFilters(new AllExceptionsFilter());

  // Логируем время выполнения каждого запроса
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Polygon API')
    .setDescription('Polygon messaging platform REST API')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['GATEWAY_PORT'] ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Gateway is running on: http://localhost:${port}/api`);
  app.get(Logger).log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
