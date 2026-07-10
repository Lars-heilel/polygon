# Single-Node Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zero-cost production monitoring for the single-host Polygon deployment.

**Architecture:** Run Grafana, Prometheus, Loki, Tempo, Grafana Alloy, node_exporter, cAdvisor, and service exporters through Docker Compose on the same host. Backend services expose health and Prometheus metrics over HTTP, send traces to Alloy over OTLP/HTTP, and write structured JSON logs to stdout for Alloy/Loki collection. Frontend errors are posted to the Gateway and logged as structured backend events.

**Tech Stack:** Nx, NestJS, React/Vite, Docker Compose, Grafana, Prometheus, Loki, Tempo, Grafana Alloy, OpenTelemetry JS, `prom-client`, `nestjs-pino`, `pino`, `@nestjs/terminus`.

---

## File Structure

- Modify `package.json`: add observability dependencies and helper scripts.
- Modify `.env` and `.env.production`: add telemetry, log, and internal health port variables.
- Modify `libs/backend/core/src/config/env.schema.ts`: validate new variables.
- Create `libs/backend/core/src/observability/observability.constants.ts`: service-name and endpoint constants.
- Create `libs/backend/core/src/observability/observability.types.ts`: shared observability types.
- Create `libs/backend/core/src/observability/telemetry.ts`: OpenTelemetry trace bootstrap.
- Create `libs/backend/core/src/observability/logger.ts`: JSON logger setup and redaction rules.
- Create `libs/backend/core/src/observability/metrics.service.ts`: Prometheus registry, default metrics, HTTP metrics.
- Create `libs/backend/core/src/observability/metrics.interceptor.ts`: HTTP latency/error metrics interceptor.
- Create `libs/backend/core/src/observability/health.controller.ts`: live/ready endpoints.
- Create `libs/backend/core/src/observability/metrics.controller.ts`: `/metrics`.
- Create `libs/backend/core/src/observability/observability.module.ts`: common Nest module.
- Modify `libs/backend/core/src/index.ts`: export observability utilities.
- Create `apps/backend/*/src/instrument.ts`: per-service telemetry bootstrap.
- Modify `apps/backend/*/src/main.ts`: import instrumentation first, use structured logger, listen on internal HTTP ports where missing.
- Modify each backend app module in `apps/backend/*/src/app/*.module.ts`: import `ObservabilityModule`.
- Create `apps/backend/gateway/src/controllers/frontend-error.controller.ts`: browser error ingestion endpoint.
- Modify `apps/backend/gateway/src/app/gateway.module.ts`: register frontend error controller.
- Create `libs/common/src/schemas/frontend-error.ts`: shared frontend error schema.
- Modify `libs/common/src/index.ts`: export frontend error schema.
- Create `libs/client/shared/src/lib/observability/frontend-error-reporter.ts`: browser error reporter.
- Modify `libs/client/shared/src/ui/error-boundary/error-boundary.tsx`: post caught render errors.
- Modify `apps/client/messenger/src/app/main.tsx` and `apps/client/admin/src/app/main.tsx`: register global browser error handlers.
- Create `infra/observability/prometheus/prometheus.yml`: Prometheus scrape config.
- Create `infra/observability/prometheus/rules/polygon-alerts.yml`: alert rules.
- Create `infra/observability/alloy/config.alloy`: Docker log collection and OTLP trace forwarding.
- Create `infra/observability/loki/loki.yml`: local Loki config and retention.
- Create `infra/observability/tempo/tempo.yml`: local Tempo config and retention.
- Create `infra/observability/grafana/provisioning/datasources/datasources.yml`: Prometheus/Loki/Tempo datasources.
- Create `infra/observability/grafana/provisioning/dashboards/dashboards.yml`: dashboard provider.
- Create dashboard JSON files under `infra/observability/grafana/dashboards/`.
- Modify `docker-compose.yml`: add observability services, exporters, volumes, and ports.
- Create `docs/OBSERVABILITY.md`: how to run, inspect, retain, and troubleshoot monitoring.

---

## Task 1: Install Dependencies And Add Environment Contract

**Files:**
- Modify: `package.json`
- Modify: `.env`
- Modify: `.env.production`
- Modify: `libs/backend/core/src/config/env.schema.ts`

- [ ] **Step 1: Install dependencies**

Run from the repository root:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions prom-client pino pino-http nestjs-pino
```

Expected: `package.json` and `package-lock.json` include the new packages.

- [ ] **Step 2: Add root scripts**

Add these scripts to the root `package.json` `scripts` object:

```json
{
  "observability:up": "docker compose up -d grafana prometheus loki tempo alloy node-exporter cadvisor postgres-exporter redis-exporter",
  "observability:down": "docker compose stop grafana prometheus loki tempo alloy node-exporter cadvisor postgres-exporter redis-exporter",
  "observability:logs": "docker compose logs -f grafana prometheus loki tempo alloy"
}
```

- [ ] **Step 3: Add environment variables**

Add to `.env` and `.env.production`:

```dotenv
DEPLOYMENT_ENVIRONMENT=production
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_VERSION=0.0.1
LOG_LEVEL=info
LOG_FORMAT=json
AUTH_METRICS_PORT=3012
CHAT_METRICS_PORT=3013
MEDIA_METRICS_PORT=3014
NOTIFICATION_METRICS_PORT=3015
PROMETHEUS_RETENTION_TIME=15d
LOKI_RETENTION_PERIOD=168h
TEMPO_RETENTION_PERIOD=72h
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

- [ ] **Step 4: Extend env schema**

Add these fields to `libs/backend/core/src/config/env.schema.ts`:

```ts
  // Observability
  DEPLOYMENT_ENVIRONMENT: z.string().default('development'),
  OTEL_ENABLED: z.preprocess((v) => v === 'true' || v === true || v === '1' || v === 1, z.boolean()).default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default('http://localhost:4318'),
  OTEL_SERVICE_VERSION: z.string().default('0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  AUTH_METRICS_PORT: z.coerce.number().default(3012),
  CHAT_METRICS_PORT: z.coerce.number().default(3013),
  MEDIA_METRICS_PORT: z.coerce.number().default(3014),
  NOTIFICATION_METRICS_PORT: z.coerce.number().default(3015),
```

- [ ] **Step 5: Verify dependency and config compile**

Run:

```bash
npm exec nx -- run @org/core:typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env .env.production libs/backend/core/src/config/env.schema.ts
git commit -m "chore: add observability dependencies and env"
```

---

## Task 2: Add Backend Observability Core

**Files:**
- Create: `libs/backend/core/src/observability/observability.constants.ts`
- Create: `libs/backend/core/src/observability/observability.types.ts`
- Create: `libs/backend/core/src/observability/telemetry.ts`
- Create: `libs/backend/core/src/observability/logger.ts`
- Create: `libs/backend/core/src/observability/metrics.service.ts`
- Create: `libs/backend/core/src/observability/metrics.interceptor.ts`
- Create: `libs/backend/core/src/observability/health.controller.ts`
- Create: `libs/backend/core/src/observability/metrics.controller.ts`
- Create: `libs/backend/core/src/observability/observability.module.ts`
- Modify: `libs/backend/core/src/index.ts`

- [ ] **Step 1: Add constants and types**

Create `observability.constants.ts`:

```ts
export const OBSERVABILITY_SERVICE_NAME = 'OBSERVABILITY_SERVICE_NAME';

export const SERVICE_NAMES = {
  gateway: 'gateway',
  auth: 'auth-service',
  user: 'user-service',
  chat: 'chat-service',
  media: 'media-service',
  notification: 'notification-service',
  search: 'search-service',
} as const;
```

Create `observability.types.ts`:

```ts
export type ObservabilityServiceName =
  | 'gateway'
  | 'auth-service'
  | 'user-service'
  | 'chat-service'
  | 'media-service'
  | 'notification-service'
  | 'search-service';

export interface StartTelemetryOptions {
  serviceName: ObservabilityServiceName;
}
```

- [ ] **Step 2: Add OpenTelemetry bootstrap**

Create `telemetry.ts`:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions';

import type { StartTelemetryOptions } from './observability.types';

let sdk: NodeSDK | null = null;

export function startTelemetry(options: StartTelemetryOptions): void {
  if (process.env['NODE_ENV'] === 'test' || process.env['OTEL_ENABLED'] !== 'true') return;
  if (sdk) return;

  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: process.env['OTEL_SERVICE_VERSION'] ?? '0.0.1',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env['DEPLOYMENT_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    void sdk?.shutdown().finally(() => process.exit(0));
  });
}
```

- [ ] **Step 3: Add JSON logger configuration**

Create `logger.ts`:

```ts
import type { Params } from 'nestjs-pino';

const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.body.password',
  'req.body.confirmPassword',
  'req.body.accessToken',
  'req.body.refreshToken',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'MINIO_SECRET_KEY',
  'SMTP_PASSWORD',
  'VAPID_PRIVATE_KEY',
];

export function createLoggerOptions(serviceName: string): Params {
  const level = process.env['LOG_LEVEL'] ?? 'info';
  const isPretty = process.env['LOG_FORMAT'] === 'pretty';

  return {
    pinoHttp: {
      level,
      redact: { paths: redactPaths, remove: true },
      customProps: () => ({
        service: serviceName,
        env: process.env['DEPLOYMENT_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
      }),
      transport: isPretty
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true },
          }
        : undefined,
    },
  };
}
```

If `pino-pretty` is not already installed and pretty logs are required in development, add it as a dev dependency. Production must use JSON.

- [ ] **Step 4: Add Prometheus metrics service**

Create `metrics.service.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

import { OBSERVABILITY_SERVICE_NAME } from './observability.constants';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly requestDuration: Histogram<string>;
  private readonly requestTotal: Counter<string>;
  private readonly websocketConnections: Gauge<string>;

  constructor(@Inject(OBSERVABILITY_SERVICE_NAME) private readonly serviceName: string) {
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: this.registry });

    this.requestTotal = new Counter({
      name: 'polygon_http_requests_total',
      help: 'Total HTTP requests handled by Polygon services',
      labelNames: ['service', 'method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'polygon_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['service', 'method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.websocketConnections = new Gauge({
      name: 'polygon_websocket_connections',
      help: 'Current Gateway WebSocket connections',
      labelNames: ['service'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { service: this.serviceName, method, route, status_code: String(statusCode) };
    this.requestTotal.inc(labels);
    this.requestDuration.observe(labels, durationSeconds);
  }

  setWebsocketConnections(count: number): void {
    this.websocketConnections.set({ service: this.serviceName }, count);
  }

  contentType(): string {
    return this.registry.contentType;
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

- [ ] **Step 5: Add metrics interceptor**

Create `metrics.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const started = process.hrtime.bigint();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap({
        finalize: () => {
          const durationSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
          const route = request.route?.path ?? request.path ?? 'unknown';
          this.metrics.recordHttpRequest(request.method, route, response.statusCode, durationSeconds);
        },
      }),
    );
  }
}
```

- [ ] **Step 6: Add health and metrics controllers**

Create `health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([]);
  }
}
```

Create `metrics.controller.ts`:

```ts
import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
```

- [ ] **Step 7: Add observability module**

Create `observability.module.ts`:

```ts
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';

import { OBSERVABILITY_SERVICE_NAME } from './observability.constants';
import { HealthController } from './health.controller';
import { createLoggerOptions } from './logger';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import type { ObservabilityServiceName } from './observability.types';

@Module({})
export class ObservabilityModule {
  static forService(serviceName: ObservabilityServiceName): DynamicModule {
    return {
      module: ObservabilityModule,
      imports: [LoggerModule.forRoot(createLoggerOptions(serviceName)), TerminusModule],
      controllers: [HealthController, MetricsController],
      providers: [
        { provide: OBSERVABILITY_SERVICE_NAME, useValue: serviceName },
        MetricsService,
        { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
      ],
      exports: [MetricsService],
    };
  }
}
```

- [ ] **Step 8: Export observability APIs**

Add to `libs/backend/core/src/index.ts`:

```ts
export * from './observability/observability.constants';
export * from './observability/observability.types';
export * from './observability/telemetry';
export * from './observability/logger';
export * from './observability/metrics.service';
export * from './observability/observability.module';
```

- [ ] **Step 9: Verify**

Run:

```bash
npm exec nx -- run @org/core:typecheck
npm exec nx -- run @org/core:lint
```

Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add libs/backend/core/src
git commit -m "feat: add backend observability core"
```

---

## Task 3: Wire Observability Into Backend Apps

**Files:**
- Create: `apps/backend/gateway/src/instrument.ts`
- Create: `apps/backend/auth-service/src/instrument.ts`
- Create: `apps/backend/user-service/src/instrument.ts`
- Create: `apps/backend/chat-service/src/instrument.ts`
- Create: `apps/backend/media-service/src/instrument.ts`
- Create: `apps/backend/notification-service/src/instrument.ts`
- Create: `apps/backend/search-service/src/instrument.ts`
- Modify: `apps/backend/*/src/main.ts`
- Modify: `apps/backend/*/src/app/*.module.ts`

- [ ] **Step 1: Add instrument files**

Example for `apps/backend/gateway/src/instrument.ts`:

```ts
import { SERVICE_NAMES, startTelemetry } from '@org/core';

startTelemetry({ serviceName: SERVICE_NAMES.gateway });
```

Use the matching service name for every app:

```ts
// auth-service
startTelemetry({ serviceName: SERVICE_NAMES.auth });

// user-service
startTelemetry({ serviceName: SERVICE_NAMES.user });

// chat-service
startTelemetry({ serviceName: SERVICE_NAMES.chat });

// media-service
startTelemetry({ serviceName: SERVICE_NAMES.media });

// notification-service
startTelemetry({ serviceName: SERVICE_NAMES.notification });

// search-service
startTelemetry({ serviceName: SERVICE_NAMES.search });
```

- [ ] **Step 2: Import instrumentation first in each main**

At the first line of every `apps/backend/*/src/main.ts`:

```ts
import './instrument';
```

- [ ] **Step 3: Use Pino logger in NestFactory**

For Gateway, change the NestFactory setup to use buffered logs:

```ts
const app = await NestFactory.create(GatewayModule, {
  bufferLogs: true,
});
app.useLogger(app.get(Logger));
```

Import `Logger` from `nestjs-pino`, not `@nestjs/common`, for `app.get(Logger)`.

Apply the same pattern to each backend app after importing `Logger` from `nestjs-pino`.

- [ ] **Step 4: Import ObservabilityModule in app modules**

Example for `apps/backend/gateway/src/app/gateway.module.ts`:

```ts
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';

@Module({
  imports: [
    ObservabilityModule.forService(SERVICE_NAMES.gateway),
    CoreConfigModule,
    // existing imports
  ],
})
export class GatewayModule {}
```

Apply equivalent imports to:

- `apps/backend/auth-service/src/app/auth.module.ts`
- `apps/backend/user-service/src/app/user.module.ts`
- `apps/backend/chat-service/src/app/chat.module.ts`
- `apps/backend/media-service/src/app/media.module.ts`
- `apps/backend/notification-service/src/app/notification.module.ts`
- `apps/backend/search-service/src/app/search.module.ts`

- [ ] **Step 5: Ensure every backend process has HTTP health/metrics**

Keep Gateway on `GATEWAY_PORT`, User on `USER_PORT`, and Search on `SEARCH_PORT`.

Add HTTP listeners to RMQ-only services:

```ts
const port = configService.get('AUTH_METRICS_PORT', { infer: true });
await app.listen(port);
logger.log(`Auth Service: RMQ queue=${AUTH_QUEUE}, health/metrics port=${port}`);
```

Use the matching env variable:

- Auth: `AUTH_METRICS_PORT`
- Chat: `CHAT_METRICS_PORT`
- Media: `MEDIA_METRICS_PORT`
- Notification: `NOTIFICATION_METRICS_PORT`

- [ ] **Step 6: Verify services build**

Run:

```bash
npm exec nx -- run-many --target build --projects='@org/gateway,@org/auth-service,@org/user-service,@org/chat-service,@org/media-service,@org/notification-service,@org/search-service'
```

Expected: PASS.

- [ ] **Step 7: Verify tests**

Run:

```bash
npm exec nx -- run-many --target test --projects='@org/gateway,@org/auth-service,@org/user-service,@org/chat-service,@org/media-service,@org/notification-service,@org/search-service'
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend
git commit -m "feat: wire observability into backend services"
```

---

## Task 4: Add Frontend Error Intake

**Files:**
- Create: `libs/common/src/schemas/frontend-error.ts`
- Modify: `libs/common/src/index.ts`
- Create: `apps/backend/gateway/src/controllers/frontend-error.controller.ts`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`
- Create: `libs/client/shared/src/lib/observability/frontend-error-reporter.ts`
- Modify: `libs/client/shared/src/index.ts`
- Modify: `libs/client/shared/src/ui/error-boundary/error-boundary.tsx`
- Modify: `apps/client/messenger/src/app/main.tsx`
- Modify: `apps/client/admin/src/app/main.tsx`

- [ ] **Step 1: Add shared schema**

Create `libs/common/src/schemas/frontend-error.ts`:

```ts
import * as z from 'zod';

export const frontendErrorSchema = z.object({
  app: z.enum(['messenger', 'admin']),
  route: z.string().max(2048),
  message: z.string().max(4096),
  stack: z.string().max(20000).optional(),
  componentStack: z.string().max(20000).optional(),
  userAgent: z.string().max(1024).optional(),
  timestamp: z.string().datetime(),
});

export type FrontendErrorPayload = z.infer<typeof frontendErrorSchema>;
```

Export it from `libs/common/src/index.ts`:

```ts
export * from './schemas/frontend-error';
```

- [ ] **Step 2: Add Gateway controller**

Create `apps/backend/gateway/src/controllers/frontend-error.controller.ts`:

```ts
import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { frontendErrorSchema, type FrontendErrorPayload } from '@org/common';

@Controller('observability/frontend-errors')
export class FrontendErrorController {
  private readonly logger = new Logger(FrontendErrorController.name);

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  capture(@Body() body: FrontendErrorPayload): { accepted: true } {
    const event = frontendErrorSchema.parse(body);

    this.logger.error({
      eventType: 'frontend_error',
      ...event,
    });

    return { accepted: true };
  }
}
```

Register it in `GatewayModule.controllers`.

- [ ] **Step 3: Add frontend reporter**

Create `libs/client/shared/src/lib/observability/frontend-error-reporter.ts`:

```ts
import type { FrontendErrorPayload } from '@org/common';

type AppName = FrontendErrorPayload['app'];

let configuredApp: AppName | null = null;

export function configureFrontendErrorReporting(app: AppName): void {
  configuredApp = app;
}

export function reportFrontendError(error: Error, componentStack?: string): void {
  if (!configuredApp) return;

  const payload: FrontendErrorPayload = {
    app: configuredApp,
    route: window.location.pathname + window.location.search,
    message: error.message,
    stack: error.stack,
    componentStack,
    userAgent: window.navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  void fetch('/api/observability/frontend-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export function registerGlobalFrontendErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    reportFrontendError(error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportFrontendError(reason);
  });
}
```

Export from `libs/client/shared/src/index.ts`:

```ts
export * from './lib/observability/frontend-error-reporter';
```

- [ ] **Step 4: Wire ErrorBoundary**

In `error-boundary.tsx`, replace the existing `componentDidCatch` body with:

```ts
import { reportFrontendError } from '../../lib/observability/frontend-error-reporter';

override componentDidCatch(error: Error, info: ErrorInfo) {
  reportFrontendError(error, info.componentStack ?? undefined);
  console.error('[ErrorBoundary]', error, info.componentStack);
}
```

- [ ] **Step 5: Configure clients**

In Messenger `main.tsx` after imports:

```ts
import { configureFrontendErrorReporting, registerGlobalFrontendErrorHandlers } from '@org/shared';

configureFrontendErrorReporting('messenger');
registerGlobalFrontendErrorHandlers();
```

In Admin `main.tsx`:

```ts
import { configureFrontendErrorReporting, registerGlobalFrontendErrorHandlers } from '@org/shared';

configureFrontendErrorReporting('admin');
registerGlobalFrontendErrorHandlers();
```

- [ ] **Step 6: Verify**

Run:

```bash
npm exec nx -- run @org/common:typecheck
npm exec nx -- run @org/shared:typecheck
npm exec nx -- run @org/gateway:test
npm exec nx -- run-many --target build --projects='@org/messenger,@org/admin'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/common apps/backend/gateway libs/client/shared apps/client/messenger apps/client/admin
git commit -m "feat: capture frontend errors through gateway"
```

---

## Task 5: Add Observability Docker Stack

**Files:**
- Create: `infra/observability/prometheus/prometheus.yml`
- Create: `infra/observability/prometheus/rules/polygon-alerts.yml`
- Create: `infra/observability/alloy/config.alloy`
- Create: `infra/observability/loki/loki.yml`
- Create: `infra/observability/tempo/tempo.yml`
- Create: `infra/observability/grafana/provisioning/datasources/datasources.yml`
- Create: `infra/observability/grafana/provisioning/dashboards/dashboards.yml`
- Create: `infra/observability/grafana/dashboards/system-overview.json`
- Create: `infra/observability/grafana/dashboards/backend-services.json`
- Create: `infra/observability/grafana/dashboards/docker-overview.json`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add Prometheus config**

Create `infra/observability/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['prometheus:9090']

  - job_name: node
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: cadvisor
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: polygon-gateway
    metrics_path: /api/metrics
    static_configs:
      - targets:
          - host.docker.internal:3000

  - job_name: polygon-backend
    metrics_path: /metrics
    static_configs:
      - targets:
          - host.docker.internal:3001
          - host.docker.internal:3006
          - host.docker.internal:3012
          - host.docker.internal:3013
          - host.docker.internal:3014
          - host.docker.internal:3015

  - job_name: postgres
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: redis
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: rabbitmq
    static_configs:
      - targets: ['rabbitmq:15692']

  - job_name: minio
    metrics_path: /minio/v2/metrics/cluster
    static_configs:
      - targets: ['minio:9000']
```

- [ ] **Step 2: Add alert rules**

Create `infra/observability/prometheus/rules/polygon-alerts.yml`:

```yaml
groups:
  - name: polygon-single-node
    rules:
      - alert: HostDiskAlmostFull
        expr: (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}) < 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Host disk has less than 15% free space

      - alert: BackendHighErrorRate
        expr: sum(rate(polygon_http_requests_total{status_code=~"5.."}[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Backend service has elevated 5xx rate

      - alert: BackendHighLatency
        expr: histogram_quantile(0.95, sum(rate(polygon_http_request_duration_seconds_bucket[5m])) by (le, service)) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Backend p95 latency is above 1 second

      - alert: ContainerRestarting
        expr: increase(container_start_time_seconds{name!=""}[10m]) > 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: Container restarted more than once in 10 minutes
```

- [ ] **Step 3: Add Loki config**

Create `infra/observability/loki/loki.yml` with single-node filesystem storage and retention:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 168h

compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  delete_request_store: filesystem
```

- [ ] **Step 4: Add Tempo config**

Create `infra/observability/tempo/tempo.yml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces

compactor:
  compaction:
    block_retention: 72h
```

- [ ] **Step 5: Add Alloy config**

Create `infra/observability/alloy/config.alloy`:

```hcl
local.file_match "docker_logs" {
  path_targets = [{
    __path__ = "/var/lib/docker/containers/*/*-json.log",
    job      = "docker",
  }]
}

loki.source.file "docker_logs" {
  targets    = local.file_match.docker_logs.targets
  forward_to = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}

otelcol.receiver.otlp "default" {
  http {
    endpoint = "0.0.0.0:4318"
  }

  output {
    traces = [otelcol.exporter.otlphttp.tempo.input]
  }
}

otelcol.exporter.otlphttp "tempo" {
  client {
    endpoint = "http://tempo:4318"
  }
}
```

- [ ] **Step 6: Add Grafana provisioning**

Create `infra/observability/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
```

Create `infra/observability/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: Polygon
    orgId: 1
    folder: Polygon
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

- [ ] **Step 7: Add initial dashboards**

Create minimal dashboard JSON files with panels for:

- `system-overview.json`: `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, `node_filesystem_avail_bytes`.
- `docker-overview.json`: `container_cpu_usage_seconds_total`, `container_memory_usage_bytes`, `container_network_receive_bytes_total`.
- `backend-services.json`: `polygon_http_requests_total`, `polygon_http_request_duration_seconds_bucket`, `process_resident_memory_bytes`.

Use Grafana dashboard JSON with `"schemaVersion"` matching the installed Grafana image and datasource variable `"${DS_PROMETHEUS}"`.

- [ ] **Step 8: Extend Docker Compose**

Add services to `docker-compose.yml`:

```yaml
  grafana:
    image: grafana/grafana:latest
    container_name: polygon-dev-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
    ports:
      - '3007:3000'
    volumes:
      - grafana_data:/var/lib/grafana
      - ./infra/observability/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./infra/observability/grafana/dashboards:/var/lib/grafana/dashboards:ro
    networks:
      - polygon-dev-network

  prometheus:
    image: prom/prometheus:latest
    container_name: polygon-dev-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=${PROMETHEUS_RETENTION_TIME:-15d}'
    ports:
      - '9090:9090'
    volumes:
      - prometheus_data:/prometheus
      - ./infra/observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./infra/observability/prometheus/rules:/etc/prometheus/rules:ro
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    networks:
      - polygon-dev-network

  loki:
    image: grafana/loki:latest
    container_name: polygon-dev-loki
    restart: unless-stopped
    command: ['-config.file=/etc/loki/loki.yml']
    ports:
      - '3100:3100'
    volumes:
      - loki_data:/loki
      - ./infra/observability/loki/loki.yml:/etc/loki/loki.yml:ro
    networks:
      - polygon-dev-network

  tempo:
    image: grafana/tempo:latest
    container_name: polygon-dev-tempo
    restart: unless-stopped
    command: ['-config.file=/etc/tempo/tempo.yml']
    ports:
      - '3200:3200'
    volumes:
      - tempo_data:/tmp/tempo
      - ./infra/observability/tempo/tempo.yml:/etc/tempo/tempo.yml:ro
    networks:
      - polygon-dev-network

  alloy:
    image: grafana/alloy:latest
    container_name: polygon-dev-alloy
    restart: unless-stopped
    command: ['run', '/etc/alloy/config.alloy']
    ports:
      - '4318:4318'
    volumes:
      - ./infra/observability/alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    networks:
      - polygon-dev-network

  node-exporter:
    image: prom/node-exporter:latest
    container_name: polygon-dev-node-exporter
    restart: unless-stopped
    ports:
      - '9100:9100'
    networks:
      - polygon-dev-network

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: polygon-dev-cadvisor
    restart: unless-stopped
    ports:
      - '8080:8080'
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - polygon-dev-network

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: polygon-dev-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: postgresql://${POSTGRES_USER:-polygon}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-polygon}?sslmode=disable
    ports:
      - '9187:9187'
    depends_on:
      - postgres
    networks:
      - polygon-dev-network

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: polygon-dev-redis-exporter
    restart: unless-stopped
    environment:
      REDIS_ADDR: redis://redis:6379
    ports:
      - '9121:9121'
    depends_on:
      - redis
    networks:
      - polygon-dev-network
```

Add volumes:

```yaml
  grafana_data:
  prometheus_data:
  loki_data:
  tempo_data:
```

- [ ] **Step 9: Verify compose config**

Run:

```bash
docker compose config
```

Expected: valid rendered Compose config.

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml infra/observability
git commit -m "feat: add single-node observability stack"
```

---

## Task 6: Add Documentation And Run End-To-End Verification

**Files:**
- Create: `docs/OBSERVABILITY.md`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Document runbook**

Create `docs/OBSERVABILITY.md`:

````md
# Observability

## Start

Run infrastructure:

```bash
npm run dev:docker:up
npm run observability:up
```

Run applications:

```bash
npm run dev:start
```

Open:

- Grafana: http://localhost:3007
- Prometheus: http://localhost:9090
- Loki API: http://localhost:3100
- Tempo API: http://localhost:3200

## Health

- Gateway: http://localhost:3000/api/health/live
- Gateway ready: http://localhost:3000/api/health/ready
- Gateway metrics: http://localhost:3000/api/metrics
- User metrics: http://localhost:3001/metrics
- Search metrics: http://localhost:3006/metrics
- RMQ-only service metrics ports: 3012-3015

## Retention

- Prometheus: `PROMETHEUS_RETENTION_TIME`
- Loki: `LOKI_RETENTION_PERIOD`
- Tempo: `TEMPO_RETENTION_PERIOD`

## Troubleshooting

- No metrics: check Prometheus Targets page.
- No traces: check Alloy logs and `OTEL_ENABLED=true`.
- No logs: check Alloy Docker log mount permissions.
- Disk growing: reduce retention variables and restart observability services.
```
````

Add a short link to `docs/DEVELOPMENT.md` under common commands:

```md
For production-style local monitoring, see [Observability](OBSERVABILITY.md).
```

- [ ] **Step 2: Start stack**

Run:

```bash
npm run dev:docker:up
npm run observability:up
```

Expected: required infrastructure and observability containers are running.

- [ ] **Step 3: Start apps**

Run:

```bash
npm run dev:start
```

Expected: Gateway exposes health and metrics on `3000`, User on `3001`, Search on `3006`, and RMQ-only services on `3012-3015`.

- [ ] **Step 4: Verify health**

Run:

```bash
curl -fsS http://localhost:3000/api/health/live
curl -fsS http://localhost:3000/api/health/ready
curl -fsS http://localhost:3012/health/live
curl -fsS http://localhost:3012/metrics | head
```

Expected: health endpoints return JSON status and metrics output includes `polygon_http_requests_total` or default process metrics.

- [ ] **Step 5: Verify Prometheus targets**

Open:

```text
http://localhost:9090/targets
```

Expected: `polygon-backend`, `node`, `cadvisor`, `postgres`, `redis`, `rabbitmq`, and `minio` targets are up or documented if an external component does not expose metrics.

- [ ] **Step 6: Verify Grafana datasources**

Open:

```text
http://localhost:3007
```

Expected: Prometheus, Loki, and Tempo datasources are provisioned and pass their connection checks.

- [ ] **Step 7: Verify trace flow**

Make a Gateway request:

```bash
curl -i http://localhost:3000/api/health/live
```

Open Grafana Explore, select Tempo, and search recent traces.

Expected: at least one trace from `gateway` appears.

- [ ] **Step 8: Verify frontend error flow**

Temporarily trigger a frontend ErrorBoundary error in development or call the endpoint manually:

```bash
curl -i -X POST http://localhost:3000/api/observability/frontend-errors \
  -H 'Content-Type: application/json' \
  -d '{"app":"messenger","route":"/debug","message":"manual test","timestamp":"2026-07-10T00:00:00.000Z"}'
```

Open Grafana Explore, select Loki, and query:

```logql
{job="docker"} |= "frontend_error"
```

Expected: structured frontend error log appears.

- [ ] **Step 9: Run Nx verification**

Run:

```bash
npm exec nx -- run-many --target lint --projects='@org/core,@org/common,@org/shared,@org/gateway,@org/auth-service,@org/user-service,@org/chat-service,@org/media-service,@org/notification-service,@org/search-service,@org/messenger,@org/admin'
npm exec nx -- run-many --target test --projects='@org/core,@org/common,@org/shared,@org/gateway,@org/auth-service,@org/user-service,@org/chat-service,@org/media-service,@org/notification-service,@org/search-service'
npm exec nx -- run-many --target build --projects='@org/gateway,@org/auth-service,@org/user-service,@org/chat-service,@org/media-service,@org/notification-service,@org/search-service,@org/messenger,@org/admin'
```

Expected: all available targets pass. If a listed project has no target, remove that project from the command and record the actual command used in the final implementation notes.

- [ ] **Step 10: Commit**

```bash
git add docs/OBSERVABILITY.md docs/DEVELOPMENT.md
git commit -m "docs: add observability runbook"
```

---

## Self-Review Notes

- Spec coverage: the plan covers zero-cost single-host deployment, backend telemetry, health endpoints, JSON logs, frontend error capture, Docker observability stack, dashboards, alerts, retention, and verification.
- Placeholder scan: no task depends on an undefined future decision. Dashboard JSON content is intentionally scoped to initial panels and must be created in Task 5.
- Type consistency: service names use `SERVICE_NAMES`; env fields match `env.schema.ts`; frontend error payload uses `FrontendErrorPayload` from `@org/common`.
- Known implementation risk: `pino-pretty` is referenced only for optional development pretty logs. Production JSON logging works without it when `LOG_FORMAT=json`.
