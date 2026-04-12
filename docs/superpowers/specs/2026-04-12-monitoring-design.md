# Monitoring Design — Polygon

**Date:** 2026-04-12
**Status:** Approved

## Goals

1. **Centralized logs** — all services in one place, searchable by service, level, correlationId
2. **Distributed tracing** — full request path across microservices with waterfall view
3. **Business metrics** — email delivery, auth events, RabbitMQ event counts

## Stack

| Layer | Tool | Role |
|---|---|---|
| Logs | Grafana Loki | Log storage |
| Log shipping | pino-loki transport | Ships stdout from NestJS processes to Loki over HTTP |
| Traces | Grafana Tempo | Trace storage |
| Trace collection | OTel Collector | Receives OTLP spans from services, forwards to Tempo |
| Instrumentation | @opentelemetry/sdk-node + @opentelemetry/auto-instrumentations-node | Auto-instruments HTTP, amqplib (RabbitMQ), pg (Prisma) |
| Metrics | Prometheus + @willsoto/nestjs-prometheus | Already in place — custom counters added |
| UI | Grafana | Already in place — Loki and Tempo datasources added |

## Architecture

Services run via `nx serve` on the host (not containerized). Docker is only used for infrastructure. This means Alloy/Promtail cannot collect logs from service stdout — instead `pino-loki` transport ships logs directly from the pino logger to Loki's HTTP API.

```
NestJS services (host)
  ├── pino logger
  │   ├── pino-pretty  → terminal (dev, unchanged)
  │   └── pino-loki    → Loki :3100 (new)
  └── OTel SDK
      └── OTLP gRPC   → OTel Collector :4317 → Tempo :3200

Grafana :3010
  ├── Datasource: Prometheus (existing)
  ├── Datasource: Loki (new)
  └── Datasource: Tempo (new)
      └── Trace → Logs correlation via trace_id field in pino
```

## Infrastructure Changes

### docker-compose.yml additions

**Loki** — log storage
- Image: `grafana/loki:3.0.0`
- Port: `3100`
- Config: filesystem storage, single-process mode (sufficient for dev)

**Grafana Tempo** — trace storage
- Image: `grafana/tempo:2.5.0`
- Port: `3200` (HTTP), `4317` (OTLP gRPC receiver, internal only)
- Config: local filesystem backend

**OTel Collector** — trace receiver / forwarder
- Image: `otel/opentelemetry-collector-contrib:0.102.0`
- Port: `4317` (OTLP gRPC, exposed to host so services can reach it)
- Config: receives OTLP, exports to Tempo

### Grafana provisioning additions

- `infra/grafana/provisioning/datasources/loki.yml` — Loki datasource
- `infra/grafana/provisioning/datasources/tempo.yml` — Tempo datasource with trace-to-logs and logs-to-traces correlation
- `infra/otel-collector/otel-collector.yml` — OTel Collector pipeline config
- `infra/loki/loki.yml` — Loki config
- `infra/tempo/tempo.yml` — Tempo config

## Code Changes

### 1. logger.module.ts — add pino-loki transport

`LoggerModule` currently uses a single transport (pino-pretty in dev, none in prod). Change to `targets` array with two entries in dev:
- `pino-pretty` — terminal output (unchanged)
- `pino-loki` — ships to `http://localhost:3100/loki/api/v1/push` with `service` label set to the service name

In prod: only `pino-loki` (no pretty printing). Service name passed via env var `SERVICE_NAME`.

Pino-loki config includes `batching: true` and `interval: 5` (5-second batch) to reduce HTTP overhead.

### 2. otel.ts per service — OpenTelemetry bootstrap

Each service gets `apps/backend/<service>/src/otel.ts`:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'

const sdk = new NodeSDK({
  serviceName: '<service-name>',
  traceExporter: new OTLPTraceExporter({ url: 'grpc://localhost:4317' }),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
```

First import in each `main.ts`:
```ts
import './otel'  // must be first
```

### 3. trace_id in pino context

To correlate logs with traces, inject the active trace ID into each log line. NestJS request context → extract `trace_id` + `span_id` from OTel active span → add to pino child logger via `pinoHttp.customProps`.

This enables Grafana's "Logs for this trace" feature.

### 4. env vars for OTel and Loki

OTel SDK reads `OTEL_SERVICE_NAME` and `OTEL_EXPORTER_OTLP_ENDPOINT` from `process.env` directly (standard OTel env vars) — no need to add to `envSchema` or pass through `ConfigService`.

`LOKI_URL` is read directly in `logger.module.ts` from `process.env` for the same reason.

Both vars are added to all `.env` files with dev defaults:
- `OTEL_SERVICE_NAME=<service-name>` (set per-service in each `main.ts` before SDK init, or via env)
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`
- `LOKI_URL=http://localhost:3100`

### 5. Business metrics

**`libs/backend/core/src/metrics/`** — shared metric definitions:

```
rmq_events_total{pattern, direction ("publish"|"consume"), status ("success"|"error")}
```

Registered in `MetricsModule`, incremented in `LoggingInterceptor` (already covers RPC context).

**`libs/backend/notification/src/`:**

```
email_sent_total{type ("verification"|"password_reset"), status ("success"|"error")}
```

Registered in `OrgNotificationModule`. Injected into `NotificationService`. Incremented inside `sendVerificationEmail` and `sendPasswordReset` — wrapped in try/catch.

**`libs/backend/auth/src/`:**

```
auth_events_total{event ("register"|"login_success"|"login_failure"|"password_reset")}
```

Registered in `AuthModule`. Injected into `AuthService`. Incremented at relevant points.

### 6. Notification error visibility fix

`NotificationController` currently returns the promise from `NotificationService` directly. If `sendMail` throws (SMTP unreachable, bad credentials), the error propagates to the RabbitMQ consumer but is not logged.

Change: wrap handler body in try/catch, call `Logger.error` with full error details, increment `email_sent_total{status="error"}`, then rethrow so RabbitMQ can nack.

## New npm packages

All installed at repo root (`npm install <pkg>`):

- `pino-loki` — pino transport for Loki
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-grpc`

## What does NOT change

- Prometheus scrape config — services already expose `/metrics`, no change needed
- Existing Grafana dashboard (`nodejs-services.json`) — untouched
- RabbitMQ, Redis, Postgres, Meilisearch containers — untouched
- Any business logic outside notification error handling

## Definition of Done

- `docker compose up -d` starts Loki, Tempo, OTel Collector alongside existing services
- Grafana shows Loki and Tempo datasources without manual configuration
- Running `npx nx serve @org/auth-service` sends logs to Loki visible in Grafana Explore
- A `POST /auth/register` request produces a trace in Tempo showing all service hops
- `email_sent_total`, `auth_events_total`, `rmq_events_total` appear in Prometheus
- SMTP failure in notification-service produces a log line at `error` level
