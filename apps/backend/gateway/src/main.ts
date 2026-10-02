import { INestApplication, Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService, Env, MetricsService } from '@org/core';
import cookieParser from 'cookie-parser';
import { config as dotenvConfig } from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import cluster from 'node:cluster';
import http from 'node:http';
import { availableParallelism } from 'node:os';
import { AggregatorRegistry } from 'prom-client';

import { GatewayModule } from './app/gateway.module';
import { GatewayHttpExceptionFilter } from './filters/gateway-http-exception.filter';
import { ZodValidationExceptionFilter } from './filters/zod-validation-exception.filter';
import './instrument';

dotenvConfig();

function workerCount(): number {
  const raw = Number(process.env['GATEWAY_WORKERS'] ?? 0);
  if (Number.isInteger(raw) && raw > 0) return raw;
  return Math.max(1, availableParallelism() - 6);
}

const logger = new NestLogger('Bootstrap');

async function bootstrap(): Promise<INestApplication> {
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
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
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
  return app;
}

if (cluster.isPrimary) {
  const n = workerCount();
  logger.log(`Gateway primary starting ${n} workers`);
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    logger.warn(`Gateway worker ${worker.process.pid} exited (${code}), reforking`);
    setTimeout(() => cluster.fork(), 2000);
  });
  serveAggregatedMetrics(Number(process.env['GATEWAY_METRICS_PORT'] ?? 3110));
} else {
  bootstrap().then((app) => {
    const metrics = app.get(MetricsService);
    process.on('message', (msg: unknown) => {
      if (msg === 'metrics-req' && process.send) {
        metrics
          .metricsJson()
          .then((json) => process.send?.({ metricsJson: json }))
          .catch(() => undefined);
      }
    });
  });
}

function serveAggregatedMetrics(port: number): void {
  const server = http.createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404);
      res.end();
      return;
    }
    const workers = Object.values(cluster.workers ?? {});
    if (workers.length === 0) {
      res.writeHead(503);
      res.end();
      return;
    }
    let pending = workers.length;
    let settled = false;
    const bodies: object[][] = [];
    const done = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        // NB: prom-client v15 exposes aggregate() as a static taking
        // getMetricsAsJSON() arrays (instance .aggregate(exposition) does not
        // exist) — workers reply with metricsJson() for this reason.
        const aggregated = AggregatorRegistry.aggregate(bodies);
        void aggregated.metrics().then(
          (out) => {
            res.setHeader('Content-Type', aggregated.contentType);
            res.end(out);
          },
          () => {
            res.writeHead(500);
            res.end();
          },
        );
      } catch {
        res.writeHead(500);
        res.end();
      }
    };
    const timer = setTimeout(done, 2000);
    for (const w of workers) {
      w?.once('message', (msg: unknown) => {
        const json = (msg as { metricsJson?: unknown })?.metricsJson;
        if (Array.isArray(json)) bodies.push(json as object[]);
        pending -= 1;
        if (pending === 0) done();
      });
      w?.send('metrics-req');
    }
  });
  server.listen(port, '127.0.0.1', () => {
    logger.log(`Gateway metrics aggregator on http://127.0.0.1:${port}/metrics`);
  });
}
