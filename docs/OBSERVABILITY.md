# Observability

Polygon uses structured backend logs, Prometheus metrics, OpenTelemetry traces, health endpoints, and a controlled frontend error-reporting path. The standards in this document are part of the maintenance contract: diagnostics must explain a flow without disclosing user content, credentials, or transport secrets.

## Safety Rules

Never log raw tokens, cookies, authorization headers, passwords, OAuth values, database URLs, Redis/RabbitMQ passwords, MinIO/SMTP/VAPID credentials, signed URLs, raw request payloads, message text, file names, or unredacted user/chat/file identifiers.

Prefer safe diagnostic fields:

- boolean presence flags such as `hasUserId`, `hasChatId`, and `hasAttachment`;
- categories such as `messageType`, `fileCategory`, and `deleteMode`;
- counts, status/result values, error classifications, and durations.

Backend Pino configuration redacts common secret fields and strips request query strings. This is defense in depth, not permission to attach unsafe fields to a log object. A query string or URL fragment may contain password-reset tokens, OAuth state, or signed URLs.

## Event Lifecycle

Every meaningful user or system flow must produce enough safe events to locate a failure stage:

| Event family | Meaning |
| --- | --- |
| `*_requested` | Action reached the system |
| `*_validated` / `*_validation_failed` | Business validation outcome |
| `*_denied` | Authorization, ownership, membership, limit, or state rejection |
| `*_started` | External or expensive stage began |
| `*_succeeded`, `*_completed`, `*_created`, `*_updated`, `*_deleted` | State change completed |
| `*_failed` | Expected stage failed with a safe classification |
| `*_skipped` | Deliberate no-op branch |

For a cross-service flow, the gateway and every owning service log their local stage using compatible event families. Cover successful, denied/failed, and skipped branches when they exist. A log sequence should answer what was attempted, which validation and authorization decisions were made, which external step ran, and which state changed, without exposing the payload.

## Backend Logging, Metrics, And Traces

Use Nest `Logger` or the backend-core logger. Production defaults should be structured JSON:

```dotenv
LOG_LEVEL=info
LOG_FORMAT=json
```

Backend core provides health and metrics instrumentation. Gateway health and metrics are under its `/api` prefix; user and search expose their service-root endpoints. RMQ-only services use dedicated HTTP metrics listeners:

| Service | Environment variable | Default port |
| --- | --- | --- |
| Auth | `AUTH_METRICS_PORT` | `3012` |
| Chat | `CHAT_METRICS_PORT` | `3013` |
| Media | `MEDIA_METRICS_PORT` | `3014` |
| Notification | `NOTIFICATION_METRICS_PORT` | `3015` |

OpenTelemetry starts only when `OTEL_ENABLED=true`. A host process sends traces to `http://localhost:4318`; a containerized process must use a reachable Alloy endpoint such as `http://alloy:4318`.

```dotenv
DEPLOYMENT_ENVIRONMENT=production
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_VERSION=0.0.1
```

Do not claim a request is observable solely because a trace exporter is configured. Confirm the service starts instrumentation before Nest boot, the metrics endpoint is reachable, and traffic creates the expected logs/traces.

## Frontend Logging And Error Reporting

Use `useLogger(context)` inside React components/hooks and `frontendLog` in non-hook code. Direct `console.*` calls are forbidden outside the shared logger/reporter implementation. The helper emits development diagnostics and becomes a no-op in production, keeping the production/demo console clean.

`ErrorBoundary` and global browser-error handlers report to `POST /api/observability/frontend-errors`. The reporter sends `window.location.pathname`, not the query string or hash. Treat error messages, stacks, user agents, and component stacks as potentially sensitive: do not add form values, tokens, copied URLs, request bodies, or application state to the payload, and keep server logs restricted to safe metadata.

Tests for reporter changes must verify that query/hash fragments and secrets are absent. Tests for logger changes must keep production logging silent and prevent direct console use in normal client code.

## Single-Host Monitoring Stack

The repository includes a Docker Compose monitoring stack:

| Component | Purpose |
| --- | --- |
| Grafana | Dashboards, logs, traces, and Explore |
| Prometheus | Metrics collection and storage |
| Loki | Structured Docker stdout logs |
| Tempo | OpenTelemetry traces |
| Grafana Alloy | Docker log collection and OTLP receiver |
| node_exporter / cAdvisor | Host and container metrics |
| postgres_exporter / redis_exporter | PostgreSQL and Redis health metrics |

Prometheus scrapes host-run services through `host.docker.internal`. This stack is intentionally single-host and not highly available. Keep Grafana private or protected, and do not publicly expose Prometheus, Loki, Tempo, Alloy, or OTLP ports.

| Port | Component |
| --- | --- |
| `3009` | Grafana |
| `9090` | Prometheus |
| `3100` | Loki |
| `3200` | Tempo |
| `12345` | Alloy UI |
| `4317` / `4318` | Alloy OTLP gRPC / HTTP |

Retention defaults are intentionally short to protect local disk capacity:

```dotenv
PROMETHEUS_RETENTION_TIME=15d
LOKI_RETENTION_PERIOD=168h
TEMPO_RETENTION_PERIOD=72h
```

Increase retention gradually only after verifying disk headroom. Reduce Loki and Tempo first on constrained hosts.

## Runbook

Start and inspect the monitoring stack:

```bash
npm run observability:up
npm run observability:logs
```

Open Grafana at `http://localhost:3009`, Prometheus at `http://localhost:9090`, and Alloy at `http://localhost:12345`. Check scrape targets at `http://localhost:9090/targets` and verify application endpoints directly:

```bash
curl http://localhost:3000/api/metrics
curl http://localhost:3000/api/health/ready
curl http://localhost:3012/metrics
```

Stop the stack while retaining its Docker volumes:

```bash
npm run observability:down
```

Dashboards are provisioned from `infra/observability/grafana/dashboards`; Prometheus alerts are in `infra/observability/prometheus/rules/polygon-alerts.yml`. Existing alerts cover target availability, 5xx rate, p95 latency, disk pressure, and host CPU. No alert delivery guarantee exists until an alert-routing component is configured and tested.

## Triage

When targets are down, check the service process, its configured port, the local `/metrics` endpoint, `host-gateway` support, and `docker compose logs prometheus`.

When traces are absent, check `OTEL_ENABLED`, the reachable OTLP endpoint, `docker compose logs alloy tempo`, and generate a new request after startup.

When logs are absent, confirm JSON/stdout logging, `LOG_FORMAT=json`, Alloy access to Docker log files, and `docker compose logs alloy loki`.

When a dashboard is empty, first confirm targets are up and that the application has received traffic. Counters and latency histograms do not appear until requests occur.
