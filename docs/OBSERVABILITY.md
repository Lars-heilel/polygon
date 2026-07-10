# Observability

This document describes the zero-cost production monitoring setup for Polygon on a single host. The goal is pragmatic: one machine hosts the app and the monitoring stack, no paid SaaS, no external dependencies, and enough visibility to answer the operational questions that matter first:

- Is the app alive?
- Which service is failing?
- Is the host out of CPU, RAM, disk, or container capacity?
- What errors are users hitting in the browser?
- Which request path became slow?
- Can logs, metrics, and traces be inspected from one UI?

## Why This Stack

The chosen stack is Grafana OSS, Prometheus, Loki, Tempo, Grafana Alloy, node_exporter, cAdvisor, postgres_exporter, and redis_exporter.

This is not the only possible monitoring stack, but it fits the constraints:

- It is free and self-hosted.
- It runs well on one machine.
- It uses stable open formats: Prometheus metrics, structured JSON logs, OpenTelemetry traces.
- It does not require changing hosting provider or buying a managed monitoring product.
- It keeps observability data on local Docker volumes, which is simple to back up or delete.

The tradeoff is that this is not high availability. If the host dies, monitoring dies with it. For this project that is acceptable because the explicit deployment model is one machine. The stack is designed for diagnosis and day-to-day production visibility, not for multi-region incident response.

## Component Roles

| Component | Role | Why it was chosen |
| --- | --- | --- |
| Grafana | UI for dashboards, logs, traces, and Explore | Best OSS UI for combining Prometheus, Loki, and Tempo |
| Prometheus | Pulls and stores metrics | Simple, reliable, local TSDB, strong query language |
| Loki | Stores logs | Cheaper than indexing full text; good fit for structured stdout logs |
| Tempo | Stores traces | Lightweight trace backend; works directly with OpenTelemetry |
| Grafana Alloy | Collects Docker logs and receives OTLP traces | One local agent replaces separate log collector and OTLP collector |
| node_exporter | Host metrics | Standard way to expose Linux CPU/RAM/disk/network metrics |
| cAdvisor | Container metrics | Shows Docker container CPU, memory, network, and filesystem behavior |
| postgres_exporter | PostgreSQL metrics | Gives DB health without adding application code |
| redis_exporter | Redis metrics | Gives cache/queue-adjacent health without adding application code |

## Data Flow

Metrics:

```text
NestJS services /metrics
node_exporter
cAdvisor
postgres_exporter
redis_exporter
        |
        v
Prometheus
        |
        v
Grafana dashboards and PromQL
```

Logs:

```text
Backend structured JSON logs on Docker stdout
        |
        v
Docker JSON log files under /var/lib/docker/containers
        |
        v
Grafana Alloy
        |
        v
Loki
        |
        v
Grafana Explore and LogQL
```

Traces:

```text
OpenTelemetry auto-instrumentation in backend services
        |
        v
OTLP HTTP endpoint on Alloy :4318
        |
        v
Tempo
        |
        v
Grafana Explore
```

Frontend errors:

```text
React ErrorBoundary and global browser error handlers
        |
        v
POST /api/observability/frontend-errors on Gateway
        |
        v
Gateway structured log with eventType=frontend_error
        |
        v
Alloy -> Loki -> Grafana
```

The frontend reporter sends only `window.location.pathname`. Query params and hash fragments are intentionally not logged because reset tokens, OAuth state, and other secrets often appear there.

## Backend Instrumentation

Every backend service imports its `instrument.ts` before the Nest app starts. That file starts OpenTelemetry only when:

```dotenv
OTEL_ENABLED=true
```

The shared observability module adds:

- `/health/live`
- `/health/ready`
- `/metrics`
- HTTP request counter
- HTTP latency histogram
- default Node.js process metrics
- structured JSON logging with redaction

Gateway, User, and Search already expose HTTP ports. RMQ-only services also start a small HTTP listener for health and metrics:

| Service | Port env var | Default |
| --- | --- | --- |
| Auth | `AUTH_METRICS_PORT` | `3012` |
| Chat | `CHAT_METRICS_PORT` | `3013` |
| Media | `MEDIA_METRICS_PORT` | `3014` |
| Notification | `NOTIFICATION_METRICS_PORT` | `3015` |

Prometheus scrapes these targets through `host.docker.internal`, which allows containers to reach services running directly on the host.

## Ports

| Port | Service | Purpose |
| --- | --- | --- |
| `3009` | Grafana | Monitoring UI |
| `9090` | Prometheus | Metrics UI/API |
| `3100` | Loki | Logs API |
| `3200` | Tempo | Traces API |
| `12345` | Alloy | Agent UI/debug |
| `4317` | Alloy | OTLP/gRPC traces |
| `4318` | Alloy | OTLP/HTTP traces |

For production on a home/single-host setup, expose Grafana only through your private network, VPN, SSH tunnel, or protected reverse proxy. Do not publicly expose Prometheus, Loki, Tempo, or Alloy.

## Retention

Retention is intentionally short:

```dotenv
PROMETHEUS_RETENTION_TIME=15d
LOKI_RETENTION_PERIOD=168h
TEMPO_RETENTION_PERIOD=72h
```

Reasons:

- Metrics are compact, so 15 days is reasonable.
- Logs grow quickly, especially under errors, so 7 days is safer for a small disk.
- Traces are the heaviest signal, so 72 hours is enough for recent incident debugging.

If disk is large, increase these values gradually. If the host is small, reduce Loki and Tempo first.

## Dashboards

Grafana provisions dashboards automatically from:

```text
infra/observability/grafana/dashboards
```

Current dashboards:

- `Polygon Backend Overview`: request rate, 5xx rate, p95 latency, scrape health
- `Polygon Host Overview`: CPU, memory, disk, container network

These dashboards are intentionally basic. They answer the first operational questions without requiring manual Grafana setup.

## Alerts

Prometheus loads local alert rules from:

```text
infra/observability/prometheus/rules/polygon-alerts.yml
```

Current rules detect:

- backend scrape target down
- high 5xx rate
- high p95 latency
- low host disk space
- high host CPU

There is no Alertmanager in the first version. Reason: the requested constraint is zero-cost and single-host. Local rules still make the problem visible in Prometheus/Grafana. If notification delivery becomes required later, add Alertmanager with Telegram/email/webhook routing.

## Logs And Secrets

Backend logs use structured JSON by default:

```dotenv
LOG_FORMAT=json
LOG_LEVEL=info
```

Sensitive fields are redacted in the logger configuration. This includes common token/password/secret fields and project-specific secrets such as database URLs, JWT secrets, OAuth secrets, MinIO credentials, SMTP credentials, VAPID keys, Redis password, RabbitMQ password, and Grafana admin password.

Request URLs are logged without query strings. This avoids leaking tokens from reset links, OAuth redirects, and signed URLs.

Useful LogQL queries:

```logql
{job="docker"} |= "frontend_error"
{job="docker"} |= "level"
{job="docker"} |= "statusCode"
```

## Settings Reference

Required observability environment:

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
GRAFANA_ADMIN_PASSWORD=change-this-password
```

If a backend service runs inside a Docker network instead of directly on the host, use a reachable Alloy URL:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
```

If a backend service runs on the host, keep:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Runbook

Start only the monitoring stack:

```bash
npm run observability:up
```

Open:

- Grafana: http://localhost:3009
- Prometheus: http://localhost:9090
- Alloy UI: http://localhost:12345

Check Prometheus targets:

```text
http://localhost:9090/targets
```

Check app metrics manually:

```bash
curl http://localhost:3000/metrics
curl http://localhost:3012/metrics
```

Check logs:

```bash
npm run observability:logs
```

Stop the stack:

```bash
npm run observability:down
```

This stops containers and keeps Docker volumes. To delete all stored monitoring data, remove the monitoring volumes explicitly.

## Troubleshooting

If Prometheus targets are down:

1. Confirm the backend service is running on the expected port.
2. Open `http://localhost:<port>/metrics` directly on the host.
3. Check `GATEWAY_PORT`, `USER_PORT`, `SEARCH_PORT`, and `*_METRICS_PORT`.
4. Check that Docker supports `host-gateway`.
5. Check `docker compose logs prometheus`.

If traces do not appear:

1. Confirm `OTEL_ENABLED=true`.
2. Confirm `OTEL_EXPORTER_OTLP_ENDPOINT` points to Alloy.
3. Check `docker compose logs alloy tempo`.
4. Generate a backend request after startup; traces are created from runtime traffic.

If logs do not appear:

1. Confirm services write logs to stdout.
2. Confirm `LOG_FORMAT=json` in production.
3. Check that Alloy can read `/var/lib/docker/containers`.
4. Check `docker compose logs alloy loki`.

If Grafana dashboards are empty:

1. Check `http://localhost:9090/targets`.
2. Confirm Prometheus can scrape the target.
3. Confirm the application received traffic; request counters and latency histograms appear after requests.

## Full System Setup

1. Set production observability env values in `.env.production`.

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
GRAFANA_ADMIN_PASSWORD=change-this-password
```

2. Start infrastructure and the app using the normal production process for this host.

3. Confirm backend health endpoints:

```bash
curl http://localhost:3000/health/ready
curl http://localhost:3001/health/ready
curl http://localhost:3006/health/ready
curl http://localhost:3012/health/ready
curl http://localhost:3013/health/ready
curl http://localhost:3014/health/ready
curl http://localhost:3015/health/ready
```

4. Start observability:

```bash
npm run observability:up
```

5. Open Prometheus targets and verify exporters are up:

```text
http://localhost:9090/targets
```

Expected core targets:

- `polygon-backend`
- `node`
- `cadvisor`
- `postgres`
- `redis`

6. Open Grafana:

```text
http://localhost:3009
```

7. Check dashboards:

- `Polygon / Polygon Backend Overview`
- `Polygon / Polygon Host Overview`

8. Generate traffic through the app and confirm:

- request rate increases
- p95 latency appears
- logs appear in Grafana Explore with Loki
- traces appear in Grafana Explore with Tempo

9. Keep these ports private on production:

```text
9090, 3100, 3200, 12345, 4317, 4318
```

Grafana on `3009` should also be private unless protected by authentication and a trusted reverse proxy.
