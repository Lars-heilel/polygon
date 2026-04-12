import { setupOtel } from '@org/core';
setupOtel('gateway');
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, ConfigService, Env, LoggingInterceptor } from '@org/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';

import { GatewayModule } from './app/gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, {
    bufferLogs: true,
  });
  app.setGlobalPrefix('api');

  // ==========================================
  // Configuration Service
  // ==========================================
  const configService = app.get(ConfigService<Env, true>);
  const CLIENT_URL = configService.get('CLIENT_URL', { infer: true });
  const GATEWAY_PORT = configService.get('GATEWAY_PORT', { infer: true });

  // ==========================================
  // Security (CORS, Cookies, Validation)
  // ==========================================
  app.enableCors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  // ==========================================
  // Logging (Pino)
  // ==========================================
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ==========================================
  // Swagger API Documentation
  // ==========================================
  const config = new DocumentBuilder()
    .setTitle('Polygon API')
    .setDescription('Polygon messaging platform REST API')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('api/docs', app, document);

  // ==========================================
  // HTTP Server Start
  // ==========================================
  await app.listen(GATEWAY_PORT);
  app.get(Logger).log(`Gateway is running on: http://localhost:${GATEWAY_PORT}`);
  app.get(Logger).log(`Swagger docs: http://localhost:${GATEWAY_PORT}/api/docs`);
}

bootstrap();
