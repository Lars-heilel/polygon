import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService, Env } from '@org/core';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';

import { GatewayModule } from './app/gateway.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
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
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());

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
