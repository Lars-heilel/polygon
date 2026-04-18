# Monitoring Design — Polygon

**Date:** 2026-04-18  
**Approach:** Вариант A — починить существующий стек + новые дашборды

---

## Архитектура

Три сигнала телеметрии, каждый по своему пути:

```
Сервисы (NestJS)
  │
  ├── Логи (pino-loki) ──────────────────► Loki ──► Grafana (Logs Dashboard)
  │     /health + /metrics исключены из autoLogging
  │
  ├── Метрики (Prometheus /metrics) ────► Prometheus ► Grafana (Overview + Business)
  │     + бизнес-счётчики (auth events)
  │     + RPC latency gauge (LoggingInterceptor)
  │
  └── Трейсы (OTel SDK) ──► OTel Collector ──► Tempo ──► Grafana (Tracing)
        trace_id пробрасывается в логи (уже работает)
```

---

## Изменения в коде

### `libs/backend/core/src/logger/logger.module.ts`
Добавить `ignore` в `pinoHttp` для исключения `/health` и `/metrics` из autoLogging:
```ts
autoLogging: {
  ignore: (req) => ['/health', '/metrics'].includes(req.url),
},
```

### `libs/backend/core/src/interceptors/logging.interceptor.ts`
Добавить Prometheus Histogram `rpc_duration_seconds` с лейблом `{ pattern }`.  
Инкрементируется в `tap()` после завершения RPC-вызова.  
Сервис определяется по имени паттерна (у каждого сервиса уникальные паттерны RabbitMQ), поэтому отдельный лейбл `service` не нужен.

### `libs/backend/auth/src/services/auth.service.ts`
Инжектировать и инкрементировать счётчики:
- `auth_login_success_total`
- `auth_login_failure_total`
- `auth_register_total`

Счётчики объявляются в `MetricsModule` через `makeCounterProvider` и экспортируются из `@org/core`.

### `infra/tempo/tempo.yml`
```yaml
# было
block_retention: 1h
# стало
block_retention: 24h
```

---

## Grafana Dashboards

Все файлы в `infra/grafana/dashboards/` подхватываются автоматически через provisioning.

### 1. `overview.json` — Polygon Overview
| Панель | Запрос | Тип |
|---|---|---|
| Service Status | `up{job=~".*-service\|gateway"}` | Stat |
| HTTP Request Rate | `sum(rate(http_request_duration_seconds_count[1m])) by (job)` | Timeseries |
| Error Rate (5xx) | `sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[1m])) by (job) / sum(rate(http_request_duration_seconds_count[1m])) by (job)` | Timeseries |
| Latency p50/p95/p99 | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))` | Timeseries |
| Heap Memory | `nodejs_heap_size_used_bytes` by job | Timeseries |
| CPU Usage | `rate(process_cpu_seconds_total[1m])` by job | Timeseries |

### 2. `logs.json` — Centralized Logs
- Datasource: Loki
- Переменные: `$service` (all / gateway / auth-service / ...), `$level` (error / warn / info / debug)
- LogQL: `{service=~"$service"} | json | level=~"$level"`
- Поле поиска по `trace_id` для корреляции с Tempo
- Цветовая кодировка по уровню логирования

### 3. `tracing.json` — Distributed Tracing
- Datasource: Tempo
- Panels: Service Map, Latency Heatmap, таблица последних трейсов
- Фильтры: по сервису, статусу (OK / ERROR), минимальной длительности

### 4. `business.json` — Business & RPC Metrics
- Auth events rate: `rate(auth_login_success_total[1m])`, `rate(auth_login_failure_total[1m])`, `rate(auth_register_total[1m])`
- Login failure ratio: `auth_login_failure_total / (auth_login_success_total + auth_login_failure_total)`
- RPC latency p95: `histogram_quantile(0.95, sum(rate(rpc_duration_seconds_bucket[5m])) by (le, pattern))`
- Топ медленных RPC-паттернов: таблица sorted by p95

---

## Что НЕ меняется

- docker-compose.yml — стек уже полный
- Все `main.ts` — `setupOtel()` уже вызывается
- Все модули — `MetricsModule`, `LoggerModule`, `HealthModule` уже импортированы
- OTel Collector конфиг — traces pipeline уже работает
- Prometheus конфиг — все сервисы уже в scrape_configs

---

## Порядок реализации

1. Починить `LoggerModule` (фильтр health/metrics из логов)
2. Расширить `LoggingInterceptor` (RPC histogram)
3. Добавить auth счётчики в `@org/core` + `auth.service.ts`
4. Исправить Tempo `block_retention`
5. Создать 4 дашборда JSON
6. Закоммитить и проверить в Grafana
