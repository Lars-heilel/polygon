import './instrument';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService, Env } from '@org/core';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';

import { GatewayModule } from './app/gateway.module';
import { GatewayHttpExceptionFilter } from './filters/gateway-http-exception.filter';
import { ZodValidationExceptionFilter } from './filters/zod-validation-exception.filter';

const logger = new NestLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService<Env, true>);
  const CLIENT_URL = configService.get('CLIENT_URL', { infer: true });
  const GATEWAY_PORT = configService.get('GATEWAY_PORT', { infer: true });

  app.enableCors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Accept-CH', 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version');
    next();
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GatewayHttpExceptionFilter(), new ZodValidationExceptionFilter());

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Polygon API')
      .setDescription('Polygon messaging platform REST API')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(GATEWAY_PORT);
  logger.log(`Gateway is running on: http://localhost:${GATEWAY_PORT}`);
}

bootstrap();
