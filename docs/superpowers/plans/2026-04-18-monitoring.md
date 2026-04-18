# Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить HTTP-метрики для Gateway, убрать /health и /metrics из логов, починить Tempo retention и создать 4 Grafana-дашборда (Overview, Logs, Tracing, Business).

**Architecture:** Три сигнала телеметрии: метрики → Prometheus → Grafana; логи → Loki → Grafana; трейсы → OTel Collector → Tempo → Grafana. HTTP-метрики добавляются только на Gateway через APP_INTERCEPTOR (единственный сервис с реальным HTTP-трафиком от клиентов). Бизнес-метрики auth уже реализованы.

**Tech Stack:** NestJS, `@willsoto/nestjs-prometheus`, `pino-http`, Grafana 11, Loki 3, Tempo 2.5, Prometheus 2.53

---

## Карта файлов

| Действие | Файл | Что меняется |
|---|---|---|
| Modify | `libs/backend/core/src/logger/logger.module.ts` | autoLogging.ignore для /health и /metrics |
| Modify | `libs/backend/core/src/metrics/metrics.module.ts` | makeHistogramProvider для http_request_duration_seconds |
| Create | `libs/backend/core/src/interceptors/http-metrics.interceptor.ts` | Interceptor, записывающий HTTP latency в Prometheus |
| Modify | `libs/backend/core/src/index.ts` | Экспорт HttpMetricsInterceptor |
| Modify | `apps/backend/gateway/src/app/gateway.module.ts` | APP_INTERCEPTOR → HttpMetricsInterceptor |
| Modify | `infra/tempo/tempo.yml` | block_retention: 1h → 24h |
| Create | `infra/grafana/dashboards/overview.json` | Дашборд статусов и системных метрик |
| Create | `infra/grafana/dashboards/logs.json` | Централизованные логи (Loki) |
| Create | `infra/grafana/dashboards/tracing.json` | Distributed tracing (Tempo) |
| Create | `infra/grafana/dashboards/business.json` | Auth-события и HTTP-статистика Gateway |

---

## Task 1: Фильтр /health и /metrics из pino autoLogging

**Files:**
- Modify: `libs/backend/core/src/logger/logger.module.ts`

- [ ] **Step 1: Заменить содержимое logger.module.ts**

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'http';
import type pino from 'pino';

function buildTransport(
  serviceName: string,
): pino.TransportSingleOptions | pino.TransportMultiOptions {
  const lokiTarget: pino.TransportSingleOptions = {
    target: 'pino-loki',
    options: {
      host: process.env['LOKI_URL'] ?? 'http://localhost:3100',
      labels: { service: serviceName },
      propsToLabels: ['level'],
      batching: { interval: 5 },
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

const IGNORED_PATHS = ['/health', '/metrics', '/api/metrics'];

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
            autoLogging: {
              ignore: (req: IncomingMessage) =>
                IGNORED_PATHS.some((p) => req.url?.startsWith(p)),
            },
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

- [ ] **Step 2: Запустить typecheck**

```bash
npx nx typecheck @org/core
```

Ожидаемый результат: no errors.

- [ ] **Step 3: Commit**

```bash
git add libs/backend/core/src/logger/logger.module.ts
git commit -m "fix(logger): exclude /health and /metrics from pino autoLogging"
```

---

## Task 2: HTTP-метрики — Histogram в MetricsModule

**Files:**
- Modify: `libs/backend/core/src/metrics/metrics.module.ts`

- [ ] **Step 1: Заменить содержимое metrics.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { getToken, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

export const HTTP_HISTOGRAM_NAME = 'http_request_duration_seconds';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: HTTP_HISTOGRAM_NAME,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
  ],
  // getToken() возвращает реальный DI-токен который создаёт makeHistogramProvider
  exports: [PrometheusModule, getToken(HTTP_HISTOGRAM_NAME)],
})
export class MetricsModule {}
```

- [ ] **Step 2: Запустить typecheck**

```bash
npx nx typecheck @org/core
```

Ожидаемый результат: no errors.

---

## Task 3: HTTP-метрики — HttpMetricsInterceptor

**Files:**
- Create: `libs/backend/core/src/interceptors/http-metrics.interceptor.ts`
- Modify: `libs/backend/core/src/index.ts`

- [ ] **Step 1: Создать файл http-metrics.interceptor.ts**

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

import { HTTP_HISTOGRAM_NAME } from '../metrics/metrics.module';

const IGNORED_PATHS = ['/health', '/metrics', '/api/metrics'];

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_HISTOGRAM_NAME)
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    if (IGNORED_PATHS.some((p) => req.url?.startsWith(p))) return next.handle();

    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.observe(req.method, req.url, res.statusCode, start),
        error: () => this.observe(req.method, req.url, res.statusCode || 500, start),
      }),
    );
  }

  private observe(method: string, url: string, statusCode: number, start: number): void {
    const duration = (Date.now() - start) / 1000;
    this.histogram.observe(
      {
        method,
        path: this.normalizePath(url),
        status_code: String(statusCode),
      },
      duration,
    );
  }

  private normalizePath(url: string): string {
    return url
      .split('?')[0]
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
```

- [ ] **Step 2: Добавить экспорт в index.ts**

В файл `libs/backend/core/src/index.ts` добавить строку после экспорта `logging.interceptor`:

```typescript
export * from './interceptors/http-metrics.interceptor';
```

- [ ] **Step 3: Запустить typecheck**

```bash
npx nx typecheck @org/core
```

Ожидаемый результат: no errors.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/core/src/metrics/metrics.module.ts \
        libs/backend/core/src/interceptors/http-metrics.interceptor.ts \
        libs/backend/core/src/index.ts
git commit -m "feat(metrics): add http_request_duration_seconds histogram and HttpMetricsInterceptor"
```

---

## Task 4: Подключить HttpMetricsInterceptor в Gateway

**Files:**
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`

- [ ] **Step 1: Заменить содержимое gateway.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GithubStrategy, GoogleStrategy, LocalStrategy, YandexStrategy } from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_QUEUE,
  CHAT_CLIENT_TOKEN,
  CHAT_QUEUE,
  CoreConfigModule,
  CoreTokenModule,
  type Env,
  HealthModule,
  HttpMetricsInterceptor,
  JwtGuard,
  LoggerModule,
  MetricsModule,
  SEARCH_CLIENT_TOKEN,
  SEARCH_QUEUE,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';

import { AuthGatewayController } from '../controllers/auth.controller';
import { ChatGatewayController } from '../controllers/chat.controller';
import { SearchGatewayController } from '../controllers/search.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

const rmqClient = (name: string, queue: string) => ({
  name,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [config.get<string>('RABBITMQ_URL', { infer: true })],
      queue,
      queueOptions: { durable: true },
    },
  }),
});

@Module({
  imports: [
    CoreConfigModule,
    CoreTokenModule,
    LoggerModule.forService('gateway'),
    HealthModule,
    MetricsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    ClientsModule.registerAsync([
      rmqClient(AUTH_CLIENT_TOKEN, AUTH_QUEUE),
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(CHAT_CLIENT_TOKEN, CHAT_QUEUE),
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
    ]),
  ],
  controllers: [
    AuthGatewayController,
    UserGatewayController,
    ChatGatewayController,
    SearchGatewayController,
  ],
  providers: [
    JwtGuard,
    ChatSocketGateway,
    LocalStrategy,
    GithubStrategy,
    YandexStrategy,
    GoogleStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class GatewayModule {}
```

- [ ] **Step 2: Запустить typecheck**

```bash
npx nx typecheck @org/gateway
```

Ожидаемый результат: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/gateway/src/app/gateway.module.ts
git commit -m "feat(gateway): wire HttpMetricsInterceptor via APP_INTERCEPTOR"
```

---

## Task 5: Исправить Tempo block_retention

**Files:**
- Modify: `infra/tempo/tempo.yml`

- [ ] **Step 1: Заменить содержимое tempo.yml**

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
    block_retention: 24h
```

- [ ] **Step 2: Commit**

```bash
git add infra/tempo/tempo.yml
git commit -m "fix(tempo): increase block_retention from 1h to 24h"
```

---

## Task 6: Grafana Dashboard — Overview

**Files:**
- Create: `infra/grafana/dashboards/overview.json`

- [ ] **Step 1: Создать файл overview.json**

```json
{
  "title": "Polygon — Overview",
  "uid": "polygon-overview",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "15s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "Service Status",
      "type": "stat",
      "gridPos": { "x": 0, "y": 0, "w": 24, "h": 4 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "up{job=~\"auth-service|user-service|chat-service|media-service|notification-service|search-service|gateway\"}",
          "legendFormat": "{{job}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "mappings": [
            {
              "type": "value",
              "options": {
                "0": { "text": "DOWN", "color": "red", "index": 0 },
                "1": { "text": "UP", "color": "green", "index": 1 }
              }
            }
          ],
          "thresholds": {
            "mode": "absolute",
            "steps": [{ "color": "red", "value": null }, { "color": "green", "value": 1 }]
          }
        }
      },
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "orientation": "horizontal",
        "colorMode": "background",
        "graphMode": "none"
      }
    },
    {
      "id": 2,
      "title": "HTTP Request Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 4, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "sum(rate(http_request_duration_seconds_count[1m])) by (path)",
          "legendFormat": "{{path}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "lineWidth": 2, "fillOpacity": 10 }
        }
      }
    },
    {
      "id": 3,
      "title": "HTTP Error Rate (5xx %)",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 4, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "sum(rate(http_request_duration_seconds_count{status_code=~\"5..\"}[1m])) / sum(rate(http_request_duration_seconds_count[1m])) * 100",
          "legendFormat": "error rate %"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "custom": { "lineWidth": 2, "fillOpacity": 10 },
          "color": { "fixedColor": "red", "mode": "fixed" }
        }
      }
    },
    {
      "id": 4,
      "title": "HTTP Latency p50 / p95 / p99",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 12, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p99"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    },
    {
      "id": 5,
      "title": "Heap Memory Used",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 12, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "nodejs_heap_size_used_bytes{job=~\"auth-service|user-service|chat-service|media-service|notification-service|search-service|gateway\"}",
          "legendFormat": "{{job}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "bytes",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    },
    {
      "id": 6,
      "title": "CPU Usage",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 20, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "rate(process_cpu_seconds_total{job=~\"auth-service|user-service|chat-service|media-service|notification-service|search-service|gateway\"}[1m])",
          "legendFormat": "{{job}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    },
    {
      "id": 7,
      "title": "Event Loop Lag",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 20, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "nodejs_eventloop_lag_seconds{job=~\"auth-service|user-service|chat-service|media-service|notification-service|search-service|gateway\"}",
          "legendFormat": "{{job}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/grafana/dashboards/overview.json
git commit -m "feat(grafana): add Overview dashboard"
```

---

## Task 7: Grafana Dashboard — Logs

**Files:**
- Create: `infra/grafana/dashboards/logs.json`

- [ ] **Step 1: Создать файл logs.json**

```json
{
  "title": "Polygon — Logs",
  "uid": "polygon-logs",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "templating": {
    "list": [
      {
        "name": "service",
        "label": "Service",
        "type": "custom",
        "query": "gateway,auth-service,user-service,chat-service,media-service,notification-service,search-service",
        "current": { "text": "All", "value": "$__all" },
        "includeAll": true,
        "allValue": ".+",
        "multi": true,
        "options": []
      },
      {
        "name": "level",
        "label": "Level",
        "type": "custom",
        "query": "error,warn,info,debug",
        "current": { "text": "All", "value": "$__all" },
        "includeAll": true,
        "allValue": ".+",
        "multi": true,
        "options": []
      }
    ]
  },
  "panels": [
    {
      "id": 1,
      "title": "Log Volume by Level",
      "type": "barchart",
      "gridPos": { "x": 0, "y": 0, "w": 24, "h": 5 },
      "datasource": { "type": "loki", "uid": "loki" },
      "targets": [
        {
          "expr": "sum by (level) (count_over_time({service=~\"$service\"} | json | level=~\"$level\" [1m]))",
          "legendFormat": "{{level}}",
          "queryType": "range"
        }
      ],
      "options": {
        "xTickLabelRotation": 0,
        "stacking": "normal"
      },
      "fieldConfig": {
        "overrides": [
          { "matcher": { "id": "byName", "options": "error" }, "properties": [{ "id": "color", "value": { "fixedColor": "#F2495C", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "warn" }, "properties": [{ "id": "color", "value": { "fixedColor": "#FF9830", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "info" }, "properties": [{ "id": "color", "value": { "fixedColor": "#73BF69", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "debug" }, "properties": [{ "id": "color", "value": { "fixedColor": "#5794F2", "mode": "fixed" } }] }
        ]
      }
    },
    {
      "id": 2,
      "title": "Logs",
      "type": "logs",
      "gridPos": { "x": 0, "y": 5, "w": 24, "h": 22 },
      "datasource": { "type": "loki", "uid": "loki" },
      "targets": [
        {
          "expr": "{service=~\"$service\"} | json | level=~\"$level\"",
          "queryType": "range"
        }
      ],
      "options": {
        "dedupStrategy": "none",
        "enableLogDetails": true,
        "prettifyLogMessage": false,
        "showLabels": true,
        "showTime": true,
        "sortOrder": "Descending",
        "wrapLogMessage": false
      }
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/grafana/dashboards/logs.json
git commit -m "feat(grafana): add centralized Logs dashboard (Loki)"
```

---

## Task 8: Grafana Dashboard — Tracing

**Files:**
- Create: `infra/grafana/dashboards/tracing.json`

- [ ] **Step 1: Создать файл tracing.json**

```json
{
  "title": "Polygon — Tracing",
  "uid": "polygon-tracing",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "Trace Search",
      "type": "traces",
      "gridPos": { "x": 0, "y": 0, "w": 24, "h": 20 },
      "datasource": { "type": "tempo", "uid": "tempo" },
      "targets": [
        {
          "datasource": { "type": "tempo", "uid": "tempo" },
          "queryType": "traceql",
          "query": "{}",
          "limit": 20,
          "tableType": "traces"
        }
      ],
      "options": {
        "dedupStrategy": "none",
        "enableLogDetails": true,
        "sortOrder": "Descending"
      }
    },
    {
      "id": 2,
      "title": "Service Map",
      "type": "nodeGraph",
      "gridPos": { "x": 0, "y": 20, "w": 24, "h": 16 },
      "datasource": { "type": "tempo", "uid": "tempo" },
      "targets": [
        {
          "datasource": { "type": "tempo", "uid": "tempo" },
          "queryType": "serviceMap"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/grafana/dashboards/tracing.json
git commit -m "feat(grafana): add Tracing dashboard (Tempo)"
```

---

## Task 9: Grafana Dashboard — Business Metrics

**Files:**
- Create: `infra/grafana/dashboards/business.json`

- [ ] **Step 1: Создать файл business.json**

```json
{
  "title": "Polygon — Business Metrics",
  "uid": "polygon-business",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "15s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "Auth Events (total counters)",
      "type": "stat",
      "gridPos": { "x": 0, "y": 0, "w": 24, "h": 4 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        { "expr": "auth_events_total{event=\"login_success\"}", "legendFormat": "login_success" },
        { "expr": "auth_events_total{event=\"login_failure\"}", "legendFormat": "login_failure" },
        { "expr": "auth_events_total{event=\"register\"}", "legendFormat": "register" },
        { "expr": "auth_events_total{event=\"password_reset\"}", "legendFormat": "password_reset" }
      ],
      "fieldConfig": {
        "defaults": { "color": { "mode": "palette-classic" } },
        "overrides": [
          { "matcher": { "id": "byName", "options": "login_failure" }, "properties": [{ "id": "color", "value": { "fixedColor": "#F2495C", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "login_success" }, "properties": [{ "id": "color", "value": { "fixedColor": "#73BF69", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "register" }, "properties": [{ "id": "color", "value": { "fixedColor": "#5794F2", "mode": "fixed" } }] }
        ]
      },
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "orientation": "horizontal",
        "colorMode": "background",
        "graphMode": "none"
      }
    },
    {
      "id": 2,
      "title": "Auth Events Rate (per minute)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 4, "w": 16, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        { "expr": "rate(auth_events_total{event=\"login_success\"}[1m]) * 60", "legendFormat": "login_success" },
        { "expr": "rate(auth_events_total{event=\"login_failure\"}[1m]) * 60", "legendFormat": "login_failure" },
        { "expr": "rate(auth_events_total{event=\"register\"}[1m]) * 60", "legendFormat": "register" },
        { "expr": "rate(auth_events_total{event=\"password_reset\"}[1m]) * 60", "legendFormat": "password_reset" }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": { "lineWidth": 2, "fillOpacity": 10 }
        },
        "overrides": [
          { "matcher": { "id": "byName", "options": "login_failure" }, "properties": [{ "id": "color", "value": { "fixedColor": "#F2495C", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "login_success" }, "properties": [{ "id": "color", "value": { "fixedColor": "#73BF69", "mode": "fixed" } }] },
          { "matcher": { "id": "byName", "options": "register" }, "properties": [{ "id": "color", "value": { "fixedColor": "#5794F2", "mode": "fixed" } }] }
        ]
      }
    },
    {
      "id": 3,
      "title": "Login Failure Ratio",
      "type": "gauge",
      "gridPos": { "x": 16, "y": 4, "w": 8, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "rate(auth_events_total{event=\"login_failure\"}[5m]) / (rate(auth_events_total{event=\"login_success\"}[5m]) + rate(auth_events_total{event=\"login_failure\"}[5m])) * 100",
          "legendFormat": "failure %"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 10 },
              { "color": "red", "value": 30 }
            ]
          }
        }
      },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } }
    },
    {
      "id": 4,
      "title": "Gateway HTTP Request Rate by Path",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 12, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "sum(rate(http_request_duration_seconds_count[1m])) by (path, method)",
          "legendFormat": "{{method}} {{path}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    },
    {
      "id": 5,
      "title": "Gateway HTTP Latency p95 by Path",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 12, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))",
          "legendFormat": "p95 {{path}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "lineWidth": 2, "fillOpacity": 5 }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/grafana/dashboards/business.json
git commit -m "feat(grafana): add Business Metrics dashboard"
```

---

## Task 10: Перезапустить Grafana и проверить дашборды

- [ ] **Step 1: Перезапустить Grafana чтобы подхватить новые дашборды**

```bash
docker compose restart grafana
```

- [ ] **Step 2: Открыть Grafana и убедиться что все 4 дашборда появились**

Перейти на http://localhost:3010 → Dashboards → папка "Polygon".  
Ожидаемый результат: 4 дашборда — Overview, Logs, Tracing, Business Metrics.

- [ ] **Step 3: Проверить Overview**

Открыть "Polygon — Overview". Ожидаемый результат:
- Панель "Service Status" показывает UP/DOWN для каждого сервиса
- Панели CPU и Heap Memory показывают данные для всех запущенных сервисов
- HTTP панели показывают "No data" если Gateway не запущен (это нормально)

- [ ] **Step 4: Проверить Logs**

Открыть "Polygon — Logs". Ожидаемый результат:
- Dropdown `service` работает, можно выбрать конкретный сервис
- Logs panel показывает логи из Loki
- Запросы к /health и /metrics НЕ появляются в логах даже при перезагрузке страницы

- [ ] **Step 5: Перезапустить Tempo для применения нового retention**

```bash
docker compose restart tempo
```

- [ ] **Step 6: Final commit если остались изменения**

```bash
git status
# если есть несохранённые изменения — добавить и закоммитить
```
