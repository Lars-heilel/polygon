# Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full observability stack — centralized logs (Loki), distributed tracing (OpenTelemetry + Tempo), and business metrics — to all seven NestJS microservices.

**Architecture:** Services run on host via `nx serve`. Loki, Tempo, and OTel Collector run in Docker alongside existing infra. pino-loki ships logs directly over HTTP; each service bootstraps the OTel SDK before NestJS loads, auto-instrumenting HTTP, RabbitMQ (amqplib), and Prisma (pg). Custom Prometheus counters track email delivery, auth events, and RMQ consumption.

**Tech Stack:** `pino-loki`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-proto`, `@willsoto/nestjs-prometheus` (already installed), `grafana/loki:3.0.0`, `grafana/tempo:2.5.0`, `otel/opentelemetry-collector-contrib:0.102.0`

---

## File Map

**Created:**
- `infra/loki/loki.yml` — Loki config (filesystem backend, single-process)
- `infra/tempo/tempo.yml` — Tempo config (filesystem backend)
- `infra/otel-collector/otel-collector.yml` — OTel Collector pipeline (OTLP → Tempo)
- `infra/grafana/provisioning/datasources/loki.yml` — Grafana Loki datasource
- `infra/grafana/provisioning/datasources/tempo.yml` — Grafana Tempo datasource with trace-logs correlation
- `libs/backend/core/src/otel/otel.setup.ts` — shared `setupOtel(serviceName)` factory, used by all services

**Modified:**
- `docker-compose.yml` — add Loki, Tempo, OTel Collector services + volumes
- `libs/backend/core/src/logger/logger.module.ts` — add pino-loki target + trace_id injection
- `apps/backend/*/src/main.ts` (all 7) — add `import './otel'` as first line
- `libs/backend/notification/src/controllers/notification.controller.ts` — try/catch + Logger.error
- `libs/backend/notification/src/services/notification.service.ts` — inject + increment email counter
- `libs/backend/notification/src/lib/notification.module.ts` — register email counter provider
- `libs/backend/auth/src/services/auth.service.ts` — inject + increment auth counter
- `libs/backend/auth/src/lib/auth.module.ts` — register auth counter provider
- `.env` — add `OTEL_EXPORTER_OTLP_ENDPOINT`, `LOKI_URL`
- `.env.example` — add same vars with comments

---

## Task 1: Install npm packages

**Files:** `package.json` (root)

- [ ] **Step 1: Install packages**

```bash
cd /home/heilel/Документы/Dev/polygon
npm install pino-loki @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('pino-loki'); require('@opentelemetry/sdk-node'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install pino-loki and opentelemetry packages"
```

---

## Task 2: Infrastructure config files

**Files:**
- Create: `infra/loki/loki.yml`
- Create: `infra/tempo/tempo.yml`
- Create: `infra/otel-collector/otel-collector.yml`

- [ ] **Step 1: Create Loki config**

```bash
mkdir -p infra/loki
```

Write `infra/loki/loki.yml`:

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
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093
```

- [ ] **Step 2: Create Tempo config**

```bash
mkdir -p infra/tempo
```

Write `infra/tempo/tempo.yml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
    wal:
      path: /tmp/tempo/wal

compactor:
  compaction:
    block_retention: 1h
```

- [ ] **Step 3: Create OTel Collector config**

```bash
mkdir -p infra/otel-collector
```

Write `infra/otel-collector/otel-collector.yml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```

- [ ] **Step 4: Commit**

```bash
git add infra/loki/ infra/tempo/ infra/otel-collector/
git commit -m "chore(infra): add Loki, Tempo, OTel Collector config files"
```

---

## Task 3: docker-compose additions

**Files:** Modify `docker-compose.yml`

- [ ] **Step 1: Add Loki, Tempo, OTel Collector services and volumes**

In `docker-compose.yml`, add to the `# ==================== МОНИТОРИНГ ====================` section (after the existing `grafana` service) and add volumes:

```yaml
  loki:
    image: grafana/loki:3.0.0
    container_name: polygon-loki
    restart: unless-stopped
    command: -config.file=/etc/loki/loki.yml
    ports:
      - '3100:3100'
    volumes:
      - ./infra/loki/loki.yml:/etc/loki/loki.yml:ro
      - loki_data:/loki
    networks:
      - polygon-network

  tempo:
    image: grafana/tempo:2.5.0
    container_name: polygon-tempo
    restart: unless-stopped
    command: -config.file=/etc/tempo/tempo.yml
    ports:
      - '3200:3200'
    volumes:
      - ./infra/tempo/tempo.yml:/etc/tempo/tempo.yml:ro
      - tempo_data:/tmp/tempo
    networks:
      - polygon-network

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.102.0
    container_name: polygon-otel-collector
    restart: unless-stopped
    command: ['--config=/etc/otel/otel-collector.yml']
    ports:
      - '4317:4317'  # OTLP gRPC — services on host send traces here
      - '4318:4318'  # OTLP HTTP — used by NestJS services
    volumes:
      - ./infra/otel-collector/otel-collector.yml:/etc/otel/otel-collector.yml:ro
    depends_on:
      - tempo
    networks:
      - polygon-network
    extra_hosts:
      - 'host.docker.internal:host-gateway'
```

Add to the `volumes:` section at the bottom:
```yaml
  loki_data:
  tempo_data:
```

- [ ] **Step 2: Start new containers and verify**

```bash
docker compose up -d loki tempo otel-collector
docker compose ps loki tempo otel-collector
```

Expected: all three show `running`.

Check Loki is up:
```bash
curl -s http://localhost:3100/ready
```
Expected: `ready`

Check Tempo is up:
```bash
curl -s http://localhost:3200/ready
```
Expected: `ready`

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(infra): add Loki, Tempo, OTel Collector to docker-compose"
```

---

## Task 4: Grafana datasource provisioning

**Files:**
- Create: `infra/grafana/provisioning/datasources/loki.yml`
- Create: `infra/grafana/provisioning/datasources/tempo.yml`

- [ ] **Step 1: Create Loki datasource**

Write `infra/grafana/provisioning/datasources/loki.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"trace_id":"(\w+)"'
          name: TraceID
          url: '$${__value.raw}'
          urlDisplayLabel: View Trace
```

- [ ] **Step 2: Create Tempo datasource**

Write `infra/grafana/provisioning/datasources/tempo.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    uid: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: false
    editable: true
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
        filterBySpanID: false
        customQuery: false
      serviceMap:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true
```

- [ ] **Step 3: Restart Grafana to apply datasources**

```bash
docker compose restart grafana
```

Open http://localhost:3010, go to Connections → Data sources. Verify Loki and Tempo appear.

- [ ] **Step 4: Commit**

```bash
git add infra/grafana/provisioning/datasources/
git commit -m "chore(grafana): add Loki and Tempo datasources with trace-log correlation"
```

---

## Task 5: Add env vars

**Files:** Modify `.env`, `.env.example`

- [ ] **Step 1: Add to `.env`**

Append to `.env`:

```bash
# ===========================================
# OBSERVABILITY
# ===========================================
# OTel Collector HTTP endpoint (receives traces from NestJS services)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Loki HTTP endpoint (receives logs from pino-loki transport)
LOKI_URL=http://localhost:3100
```

- [ ] **Step 2: Add to `.env.example`**

Append to `.env.example`:

```bash
# ===========================================
# OBSERVABILITY
# ===========================================
# OTel Collector HTTP endpoint (receives traces from NestJS services)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Loki HTTP endpoint (receives logs from pino-loki transport)
LOKI_URL=http://localhost:3100
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add OTEL and LOKI env vars to example"
```

---

## Task 6: LoggerModule — pino-loki transport + trace_id

**Files:** Modify `libs/backend/core/src/logger/logger.module.ts`

Current state: single transport — pino-pretty in dev, none in prod.

Target state: two transports in dev (pino-pretty + pino-loki), one in prod (pino-loki only). Plus `customProps` injects active OTel `trace_id` and `span_id` into every log line.

- [ ] **Step 1: Replace logger.module.ts**

Write `libs/backend/core/src/logger/logger.module.ts`:

```ts
import { DynamicModule, Module } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

function buildTransport(serviceName: string) {
  const lokiTarget = {
    target: 'pino-loki',
    options: {
      host: process.env['LOKI_URL'] ?? 'http://localhost:3100',
      labels: { service: serviceName },
      batching: true,
      interval: 5,
    },
  };

  if (process.env['NODE_ENV'] !== 'production') {
    return {
      targets: [
        { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
        lokiTarget,
      ],
    };
  }

  return lokiTarget;
}

@Module({})
export class LoggerModule {
  static forService(serviceName: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          forRoutes: [{ path: '/{*splat}', method: RequestMethod.ALL }],
          pinoHttp: {
            transport: buildTransport(serviceName),
            level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
            autoLogging: true,
            serializers: {
              req: (req) => ({ method: req.method, url: req.url }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            customProps: () => {
              const span = trace.getActiveSpan();
              if (!span?.isRecording()) return {};
              const ctx = span.spanContext();
              return { trace_id: ctx.traceId, span_id: ctx.spanId };
            },
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
```

- [ ] **Step 2: Update all 7 app modules — replace `LoggerModule` with `LoggerModule.forService('...')`**

In each file below, replace the bare `LoggerModule` in the `imports` array with the `forService` call. No other changes.

**`apps/backend/gateway/src/app/gateway.module.ts`**
```ts
// before
LoggerModule,
// after
LoggerModule.forService('gateway'),
```

**`apps/backend/auth-service/src/app/auth.module.ts`**
```ts
LoggerModule.forService('auth-service'),
```

**`apps/backend/user-service/src/app/user.module.ts`**
```ts
LoggerModule.forService('user-service'),
```

**`apps/backend/chat-service/src/app/chat.module.ts`**
```ts
LoggerModule.forService('chat-service'),
```

**`apps/backend/media-service/src/app/media.module.ts`**
```ts
LoggerModule.forService('media-service'),
```

**`apps/backend/notification-service/src/app/notification.module.ts`**
```ts
LoggerModule.forService('notification-service'),
```

**`apps/backend/search-service/src/app/search.module.ts`**
```ts
LoggerModule.forService('search-service'),
```

- [ ] **Step 3: Typecheck core**

```bash
npx nx typecheck @org/core
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/core/src/logger/logger.module.ts apps/backend/
git commit -m "feat(core): add pino-loki transport and trace_id injection to LoggerModule"
```

---

## Task 7: OTel bootstrap — shared setupOtel in @org/core + wire into all main.ts

**Files:**
- Create: `libs/backend/core/src/otel/otel.setup.ts`
- Modify: `libs/backend/core/src/index.ts` — export setupOtel
- Modify: `apps/backend/gateway/src/main.ts`
- Modify: `apps/backend/auth-service/src/main.ts`
- Modify: `apps/backend/user-service/src/main.ts`
- Modify: `apps/backend/chat-service/src/main.ts`
- Modify: `apps/backend/media-service/src/main.ts`
- Modify: `apps/backend/notification-service/src/main.ts`
- Modify: `apps/backend/search-service/src/main.ts`

The OTel SDK must run before NestJS loads any modules — `require()` patching only works on modules that haven't been loaded yet. Calling `setupOtel()` as the very first statement in `main.ts` (before any NestJS import) guarantees this. All configuration lives in one shared function in `@org/core`.

- [ ] **Step 1: Create libs/backend/core/src/otel/otel.setup.ts**

```ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

export function setupOtel(serviceName: string): void {
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
      url: `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318'}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });
  sdk.start();
}
```

- [ ] **Step 2: Export setupOtel from @org/core**

In `libs/backend/core/src/index.ts`, add at the bottom:

```ts
// OTel
export * from './otel/otel.setup';
```

- [ ] **Step 3: Wire into gateway/src/main.ts**

Add `setupOtel` call as the very first two lines — before any NestJS import. Node.js executes `import` statements before any code in an ES module, so use a dynamic approach: put the call at the top of the file before NestJS imports by restructuring to a top-level call.

Since the project uses CommonJS (NestJS default), imports are hoisted but `require()` calls run in order. The safest pattern is to call `setupOtel` before `NestFactory` is used:

`apps/backend/gateway/src/main.ts` — add as first two lines:

```ts
import { setupOtel } from '@org/core';
setupOtel('gateway');
```

Full file becomes:

```ts
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
  const app = await NestFactory.create(GatewayModule, { bufferLogs: true });
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
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Polygon API')
    .setDescription('Polygon messaging platform REST API')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(GATEWAY_PORT);
  app.get(Logger).log(`Gateway is running on: http://localhost:${GATEWAY_PORT}`);
  app.get(Logger).log(`Swagger docs: http://localhost:${GATEWAY_PORT}/api/docs`);
}

bootstrap();
```

- [ ] **Step 4: Wire into auth-service/src/main.ts**

Add as first two lines (before NestJS imports), keep rest unchanged:

```ts
import { setupOtel } from '@org/core';
setupOtel('auth-service');

import { NestFactory } from '@nestjs/core';
// ... rest of file unchanged
```

- [ ] **Step 5: Wire into user-service/src/main.ts**

```ts
import { setupOtel } from '@org/core';
setupOtel('user-service');

import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

- [ ] **Step 6: Wire into chat-service/src/main.ts**

```ts
import { setupOtel } from '@org/core';
setupOtel('chat-service');

import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

- [ ] **Step 7: Wire into media-service/src/main.ts**

```ts
import { setupOtel } from '@org/core';
setupOtel('media-service');

import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

- [ ] **Step 8: Wire into notification-service/src/main.ts**

```ts
import { setupOtel } from '@org/core';
setupOtel('notification-service');

import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

- [ ] **Step 9: Wire into search-service/src/main.ts**

```ts
import { setupOtel } from '@org/core';
setupOtel('search-service');

import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

- [ ] **Step 10: Typecheck core and three services**

```bash
npx nx run-many -t typecheck -p @org/core @org/gateway @org/auth-service @org/notification-service
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add libs/backend/core/src/otel/ libs/backend/core/src/index.ts apps/backend/
git commit -m "feat(core): add shared setupOtel factory; wire into all service main.ts"
```

---

## Task 8: email_sent_total metric + notification error visibility fix

**Files:**
- Modify: `libs/backend/notification/src/lib/notification.module.ts`
- Modify: `libs/backend/notification/src/services/notification.service.ts`
- Modify: `libs/backend/notification/src/controllers/notification.controller.ts`

This task fixes two things at once: errors from SMTP are currently silently swallowed inside the RabbitMQ handler. Adding try/catch + logging + metric covers both the bug and the metric.

- [ ] **Step 1: Register email counter in notification.module.ts**

Current `notification.module.ts`:
```ts
@Module({
  imports: [CoreConfigModule, CoreEmailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class OrgNotificationModule {}
```

New `notification.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { CoreConfigModule, CoreEmailModule } from '@org/core';

import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../services/notification.service';

@Module({
  imports: [CoreConfigModule, CoreEmailModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    makeCounterProvider({
      name: 'email_sent_total',
      help: 'Total emails sent, labeled by type and status',
      labelNames: ['type', 'status'] as const,
    }),
  ],
})
export class OrgNotificationModule {}
```

- [ ] **Step 2: Inject counter into NotificationService**

Current `notification.service.ts`:
```ts
@Injectable()
export class NotificationService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.verification(
      token,
      this.config.get('APP_URL', { infer: true }),
    );
    await this.email.send({ to, subject, html });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.passwordReset(
      token,
      this.config.get('APP_URL', { infer: true }),
    );
    await this.email.send({ to, subject, html });
  }
}
```

New `notification.service.ts`:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { EMAIL_PROVIDER, type Env, type IEmailProvider, emailTemplates } from '@org/core';
import type { Counter } from 'prom-client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly config: ConfigService<Env, true>,
    @InjectMetric('email_sent_total') private readonly emailCounter: Counter<string>,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.verification(
      token,
      this.config.get('APP_URL', { infer: true }),
    );
    try {
      await this.email.send({ to, subject, html });
      this.emailCounter.inc({ type: 'verification', status: 'success' });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (err) {
      this.emailCounter.inc({ type: 'verification', status: 'error' });
      this.logger.error(`Failed to send verification email to ${to}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.passwordReset(
      token,
      this.config.get('APP_URL', { infer: true }),
    );
    try {
      await this.email.send({ to, subject, html });
      this.emailCounter.inc({ type: 'password_reset', status: 'success' });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.emailCounter.inc({ type: 'password_reset', status: 'error' });
      this.logger.error(`Failed to send password reset email to ${to}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}
```

- [ ] **Step 3: Typecheck notification lib**

```bash
npx nx typecheck @org/notification
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/notification/
git commit -m "feat(notification): add email_sent_total metric and SMTP error logging"
```

---

## Task 9: auth_events_total metric

**Files:**
- Modify: `libs/backend/auth/src/lib/auth.module.ts`
- Modify: `libs/backend/auth/src/services/auth.service.ts`

- [ ] **Step 1: Register auth counter in auth.module.ts**

In `libs/backend/auth/src/lib/auth.module.ts`, add `makeCounterProvider` to `providers`:

```ts
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
```

Add to `providers` array in `@Module`:

```ts
makeCounterProvider({
  name: 'auth_events_total',
  help: 'Total auth events by type',
  labelNames: ['event'] as const,
}),
```

- [ ] **Step 2: Inject counter into AuthService**

In `libs/backend/auth/src/services/auth.service.ts`, add import:

```ts
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';
```

Add to constructor after existing params:

```ts
@InjectMetric('auth_events_total') private readonly authCounter: Counter<string>,
```

Add increments at the relevant points in methods:

In `register()` — after `this.repo.createCredentials(...)`:
```ts
this.authCounter.inc({ event: 'register' });
```

In `validateCredentials()` — in the `if (!valid)` branch before throwing:
```ts
this.authCounter.inc({ event: 'login_failure' });
```

After `await this.cache.clearLoginAttempts(email)`:
```ts
this.authCounter.inc({ event: 'login_success' });
```

In `forgotPassword()` — after `await this.verification.generatePasswordReset(...)`:
```ts
this.authCounter.inc({ event: 'password_reset' });
```

- [ ] **Step 3: Typecheck auth lib**

```bash
npx nx typecheck @org/auth
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/auth/
git commit -m "feat(auth): add auth_events_total metric"
```

---

## Task 10: rmq_events_total metric

**Files:**
- Modify: `libs/backend/notification/src/lib/notification.module.ts`
- Modify: `libs/backend/notification/src/controllers/notification.controller.ts`

Track RMQ consume events in notification-service — the most critical consumer for the email bug scenario.

- [ ] **Step 1: Register rmq counter in notification.module.ts**

Add second counter to `providers` in `OrgNotificationModule`:

```ts
makeCounterProvider({
  name: 'rmq_events_total',
  help: 'Total RabbitMQ events consumed, labeled by pattern and status',
  labelNames: ['pattern', 'status'] as const,
}),
```

- [ ] **Step 2: Inject counter into NotificationController**

Current `notification.controller.ts`:
```ts
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL)
  sendVerificationEmail(@Payload() payload: { to: string; token: string }): Promise<void> {
    return this.notificationService.sendVerificationEmail(payload.to, payload.token);
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET)
  sendPasswordReset(@Payload() payload: { to: string; token: string }): Promise<void> {
    return this.notificationService.sendPasswordReset(payload.to, payload.token);
  }
}
```

New `notification.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { NOTIFICATION_EVENTS } from '@org/core';
import type { Counter } from 'prom-client';

import { NotificationService } from '../services/notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectMetric('rmq_events_total') private readonly rmqCounter: Counter<string>,
  ) {}

  @EventPattern(NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL)
  async sendVerificationEmail(@Payload() payload: { to: string; token: string }): Promise<void> {
    try {
      await this.notificationService.sendVerificationEmail(payload.to, payload.token);
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL, status: 'success' });
    } catch {
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL, status: 'error' });
      throw;
    }
  }

  @EventPattern(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET)
  async sendPasswordReset(@Payload() payload: { to: string; token: string }): Promise<void> {
    try {
      await this.notificationService.sendPasswordReset(payload.to, payload.token);
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, status: 'success' });
    } catch {
      this.rmqCounter.inc({ pattern: NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, status: 'error' });
      throw;
    }
  }
}
```

- [ ] **Step 3: Typecheck notification lib**

```bash
npx nx typecheck @org/notification
```

Expected: no errors.

- [ ] **Step 4: Verify all metrics appear in Prometheus**

Start notification-service and curl its metrics endpoint:

```bash
npx nx serve @org/notification-service &
sleep 5
curl -s http://localhost:3005/metrics | grep -E "email_sent_total|rmq_events_total"
```

Expected: both metric names appear in output (with HELP and TYPE lines).

- [ ] **Step 5: Commit**

```bash
git add libs/backend/notification/
git commit -m "feat(notification): add rmq_events_total metric to controller"
```

---

## Task 11: End-to-end smoke test

Verify the full observability stack works together.

- [ ] **Step 1: Start all infrastructure**

```bash
docker compose up -d
```

- [ ] **Step 2: Start auth and notification services in separate terminals**

Terminal 1:
```bash
npx nx serve @org/auth-service
```

Terminal 2:
```bash
npx nx serve @org/notification-service
```

Terminal 3:
```bash
npx nx serve @org/gateway
```

- [ ] **Step 3: Send a registration request**

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","username":"testuser"}'
```

- [ ] **Step 4: Verify trace in Grafana Tempo**

Open http://localhost:3010 → Explore → Select datasource: Tempo → Search → Service name: `gateway`. Find the `POST /api/auth/register` trace. It should show spans for: HTTP handler → auth-service → Prisma query → RabbitMQ emit.

- [ ] **Step 5: Verify logs in Grafana Loki**

Explore → Select datasource: Loki → Log browser → `{service="auth-service"}`. Verify log lines appear with `trace_id` field.

Click on a log line with a `trace_id` → "View Trace" link should open the corresponding trace in Tempo.

- [ ] **Step 6: Verify email metric**

```bash
curl -s http://localhost:3005/metrics | grep email_sent_total
```

Expected (if SMTP works):
```
email_sent_total{type="verification",status="success"} 1
```

If SMTP is not configured: `status="error"` with the error visible in notification-service terminal.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete observability stack — Loki, Tempo, OTel, custom metrics"
```
