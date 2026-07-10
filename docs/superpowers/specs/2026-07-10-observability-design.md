# Single-Node Observability Design

## Context

Polygon is an Nx monorepo with React/Vite clients, an API Gateway, and NestJS microservices for Auth, User, Chat, Media, Notification, and Search. The backend uses RabbitMQ for service communication, Postgres per service, Redis, MinIO, and Meilisearch. The current observability baseline is the NestJS `Logger`, Docker health checks for part of the infrastructure, and no centralized metrics, traces, logs, or browser error capture.

The production environment for this design is one host: the current computer. There is no Kubernetes, no paid SaaS, and no external managed observability service.

## Goals

- Provide useful production monitoring with zero monetary spend.
- Run the observability stack on the same host through Docker Compose.
- Track service health, infrastructure health, HTTP latency, error rates, container resource usage, logs, and distributed traces.
- Keep data retention bounded so observability cannot consume the host disk.
- Reuse existing monorepo conventions and centralize backend instrumentation in `@org/core`.

## Non-Goals

- No Grafana Cloud, Sentry Cloud, Datadog, New Relic, or other paid services.
- No Kubernetes, Mimir, high availability, long-term object storage, or multi-node clustering.
- No product analytics or business event warehouse.
- No incident management platform in the first iteration.

## Recommended Approach

Use a single-node Grafana observability stack:

- Grafana for dashboards, exploration, and alerting.
- Prometheus for metrics.
- Loki for centralized logs.
- Tempo for distributed traces.
- Grafana Alloy as the local telemetry agent and collector.
- node_exporter for host CPU, memory, disk, and network metrics.
- cAdvisor for Docker container metrics.
- Native or exporter-based metrics for Postgres, Redis, RabbitMQ, MinIO, and Meilisearch where supported.

This is the lowest-cost production-grade option for one machine. It gives enough visibility to diagnose outages and slow requests without introducing Kubernetes-level operational complexity.

## Backend Instrumentation

Create shared observability code in `libs/backend/core` and wire it into every NestJS application entrypoint.

Each backend process must report a stable service name:

- `gateway`
- `auth-service`
- `user-service`
- `chat-service`
- `media-service`
- `notification-service`
- `search-service`

The instrumentation should provide:

- OpenTelemetry tracing for HTTP, NestJS, Node.js runtime, and supported dependencies.
- Metrics for HTTP request count, request duration, error count, process memory, CPU, event loop lag, and uptime.
- Trace context propagation through HTTP and, where practical, RabbitMQ message handling.
- Environment attributes such as `deployment.environment`, `service.name`, and `service.version`.
- A disabled-by-default mode for tests to avoid flaky telemetry side effects.

Telemetry should export to the local collector endpoint, not directly to Grafana backends. The default production endpoint should be `http://localhost:4318` for OTLP/HTTP unless the final implementation chooses OTLP/gRPC consistently across all services.

## Health Checks

Use `@nestjs/terminus`, which is already available in the repository, to expose health endpoints.

Gateway:

- `GET /api/health/live`: process is alive.
- `GET /api/health/ready`: Gateway dependencies are ready.

Microservices:

- Expose equivalent live and ready checks where the process has an HTTP listener.
- For pure RMQ microservices, either add a small internal HTTP listener for health checks or expose health through metrics. The implementation plan must choose one approach and apply it consistently.

Readiness checks should cover only dependencies required for the service to perform useful work:

- Postgres for services with a database.
- Redis where the service depends on Redis.
- RabbitMQ for RMQ producers/consumers.
- MinIO for Media.
- Meilisearch for Search.

## Logging

Move backend logs toward structured JSON logs suitable for Loki.

Every backend log entry should include:

- `timestamp`
- `level`
- `service`
- `context`
- `message`
- `traceId` when available
- `spanId` when available
- `requestId` when available

Logs must avoid sensitive data:

- No passwords, JWTs, refresh tokens, access tokens, cookies, OAuth secrets, SMTP credentials, VAPID private key, or database URLs.
- Request bodies should not be logged by default.

Grafana Alloy should collect Docker container logs and send them to Loki with labels for service/container name and environment. Labels must stay low-cardinality; user IDs, request IDs, trace IDs, and message IDs belong in log fields, not Loki labels.

## Frontend Error Capture

Do not use Sentry in the first iteration.

Extend the existing shared React `ErrorBoundary` behavior so browser errors can be posted to a Gateway endpoint. The Gateway should validate and log these events as structured logs with a dedicated marker such as `eventType: "frontend_error"`.

The frontend error payload should include:

- app name: `messenger` or `admin`
- route
- error message
- stack when available
- component stack when available
- browser user agent
- timestamp

The payload must not include cookies, local storage dumps, full form contents, or tokens.

## Infrastructure Metrics

Prometheus should scrape:

- Prometheus itself.
- Grafana Alloy internal metrics.
- node_exporter.
- cAdvisor.
- Backend service metrics.
- Postgres exporter.
- Redis exporter.
- RabbitMQ Prometheus endpoint or exporter.
- MinIO metrics endpoint.
- Meilisearch health or metrics endpoint if available in the deployed version.

For services that cannot expose full metrics immediately, readiness checks and container metrics are acceptable for the first implementation step.

## Dashboards

Provision dashboards as files under version control.

Must-have dashboards:

- System overview: CPU, memory, disk usage, disk IO, network.
- Docker overview: container CPU, memory, restarts, network, filesystem usage.
- Backend services: request rate, p50/p95/p99 latency, error rate, process memory, event loop lag, uptime.
- Gateway: HTTP latency/errors, auth-related failures, WebSocket connection count if available.
- RabbitMQ: queue depth, consumers, unacked messages, publish/deliver rates.
- Datastores: Postgres availability/connections, Redis availability/memory, MinIO availability, Meilisearch availability.
- Logs explorer: filter by service, level, and trace ID.
- Trace explorer: slow requests and error traces across Gateway and backend services.

## Alerts

Grafana alerting should be configured for local notifications first. If no external notification channel is available, alerts should still be visible in Grafana and documented.

Must-have alert rules:

- Any required service is down.
- Any required infrastructure container is down.
- Disk usage above 85%.
- Container restart loop.
- Gateway 5xx rate is elevated for 5 minutes.
- Gateway p95 latency is elevated for 5 minutes.
- RabbitMQ queue backlog is growing or unacked messages are high.
- Postgres unavailable.
- Redis unavailable.

Alert thresholds should start conservative to avoid noise and be tuned after real usage.

## Retention And Resource Limits

Because everything runs on one host, retention must be intentionally small:

- Prometheus: 7 to 15 days.
- Loki: 3 to 7 days.
- Tempo: 1 to 3 days.

Docker volumes must be named and documented. The implementation should set storage and retention limits where the component supports them. Grafana dashboards should include disk usage so retention problems are visible before the host becomes full.

## Configuration

Add environment variables to the root `.env` and `.env.production` patterns without duplicating secrets in code:

- `OTEL_ENABLED`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_SERVICE_VERSION`
- `DEPLOYMENT_ENVIRONMENT`
- `LOG_LEVEL`
- `LOG_FORMAT`

Tests should default to telemetry disabled.

## Verification

The implementation is complete when:

- `docker compose` starts the observability stack on the host.
- Grafana opens locally and has provisioned Prometheus, Loki, and Tempo datasources.
- At least one backend request produces metrics, logs, and a trace visible in Grafana.
- Health endpoints report live and ready status.
- Stopping a required service changes readiness or alert state.
- Frontend ErrorBoundary events appear in Loki as structured logs.
- Nx build/test/lint targets touched by the implementation pass through `npm exec nx`.

## Implementation Decisions

- Use OTLP/HTTP between application services and Grafana Alloy. It is easy to configure through environment variables and avoids gRPC-specific networking issues on a single Docker host.
- Add a small internal HTTP listener for pure RMQ microservices so every backend process exposes consistent `live`, `ready`, and metrics endpoints.
- Use a dedicated structured logger package in the backend rather than extending the default NestJS logger. The implementation plan should choose a NestJS-compatible logger with JSON output, redaction support, and trace correlation.
