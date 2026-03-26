# Observability в NestJS микросервисах

> Мониторинг — это не "приятная добавка". Без него ты слепой: не знаешь упал ли сервис,
> почему тормозит, где конкретно произошла ошибка из цепочки из 5 сервисов.

---

## Три столпа Observability

```
Logs    → ЧТО произошло     ("ошибка авторизации у user 123 в 14:23:05")
Metrics → КАК ЧАСТО / БЫСТРО ("100 req/s, p95=200ms, error rate=0.3%")
Traces  → ГДЕ в цепочке     ("gateway 12ms → auth-service 45ms → DB 38ms")
```

Без всех трёх ты можешь заметить проблему, но не понять её причину.

---

## Что реализовано в проекте

| Компонент | Где | Что даёт |
|---|---|---|
| `AllExceptionsFilter` | `@org/core` | ловит все ошибки, логирует, форматирует ответ |
| `LoggingInterceptor` | `@org/core` | замеряет время каждого запроса |
| `LoggerModule` (Pino) | `@org/core` | структурированные JSON-логи |
| `HealthModule` | `@org/core` | `/health` эндпоинт с проверками |
| `MetricsModule` | `@org/core` | `/metrics` эндпоинт для Prometheus |
| Prometheus | `docker-compose` | собирает метрики каждые 15s |
| Grafana | `docker-compose` | дашборды, порт 3010 |

---

## 1. Exception Filter

### Что это

Глобальный перехватчик. `@Catch()` без аргументов — поймай вообще всё что
не поймал ни один контроллер или сервис.

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void { ... }
}

// Подключается один раз в main.ts — работает для всего приложения
app.useGlobalFilters(new AllExceptionsFilter());
```

### Зачем

**Без фильтра:** клиент получает `500 Internal Server Error` без деталей,
в логах ничего нет, ты не знаешь что упало.

**С фильтром:** всё логируется с контекстом, клиент получает понятный JSON,
уровень лога (`warn` / `error`) зависит от тяжести ошибки.

### HTTP vs RPC

У нас два типа сервисов — с HTTP (Gateway) и с RabbitMQ (Auth, User).
Фильтр определяет контекст и ведёт себя по-разному:

```typescript
const contextType = host.getType(); // 'http' или 'rpc'

if (contextType === 'http') {
  // Клиент ждёт HTTP ответ — возвращаем JSON
  response.status(status).json({ statusCode, message, path, timestamp });
} else {
  // RabbitMQ не знает HTTP статусов — логируем и бросаем RpcException обратно
  throw new RpcException({ message, statusCode });
}
```

### Уровни логирования

```typescript
if (status >= 500) {
  this.logger.error(payload); // Реальная проблема — нужно чинить
} else {
  this.logger.warn(payload);  // Ошибка клиента (404, 401) — это нормально
}
```

Это важно: если логировать 404 как `error` — алерты будут орать от каждого
опечатанного URL. 4xx — это warn, 5xx — error.

---

## 2. Обработка ошибок Prisma и Zod

### Проблема

Prisma и Zod — сторонние библиотеки. Они бросают **свои** типы ошибок,
а не NestJS-исключения. Без обработки всё это улетает в фильтр как `500`.

```
Prisma P2002 (unique constraint) → должно быть 409 Conflict
Prisma P2025 (record not found)  → должно быть 404 Not Found
ZodError (невалидные данные)     → должно быть 400 Bad Request
```

### Два уровня защиты

```
Уровень 1 — сервис (явная проверка, бизнес-логика):
  AuthService.register():
    const existing = await repo.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    // ↑ Явно — ты знаешь что проверяешь и почему

Уровень 2 — фильтр (safety net, инфраструктура):
  Race condition: два запроса прошли одновременно, оба findByEmail вернул null,
  оба пытаются create → Prisma бросает P2002 → фильтр ловит → 409
  // ↑ Неявно — защита от случаев которые нельзя предусмотреть явно
```

Оба уровня нужны. Первый — про намерение. Второй — про надёжность.

### Маппинг Prisma P-кодов

```typescript
const PRISMA_CODE_MAP = {
  P2002: { status: 409, message: 'Resource already exists' },  // unique constraint
  P2025: { status: 404, message: 'Resource not found' },       // record not found
  P2003: { status: 400, message: 'Related resource not found' },// foreign key
  P2000: { status: 400, message: 'Input value is too long' },
};
```

Полный список кодов: https://www.prisma.io/docs/orm/reference/error-reference

### Почему duck-typing вместо instanceof

Можно было написать `exception instanceof PrismaClientKnownRequestError`,
но это требует импорта из `@prisma/client/runtime/library` — внутреннего пути
который недоступен в `@org/core` (у core нет своего Prisma-клиента).

Решение — проверять наличие характерных свойств:

```typescript
function isPrismaKnownError(e: unknown): e is { code: string } {
  return (
    typeof e === 'object' && e !== null &&
    'code' in e && 'clientVersion' in e &&       // есть у всех Prisma ошибок
    typeof (e as { code: unknown }).code === 'string' &&
    (e as { code: string }).code.startsWith('P') // P2002, P2025...
  );
}
```

Это надёжнее: работает с любой версией Prisma и любым сгенерированным клиентом.

### ZodError и ZodValidationPipe

`nestjs-zod` уже обрабатывает Zod-ошибки из DTO-валидации —
`ZodValidationPipe` автоматически конвертирует `ZodError` → `BadRequestException`.

Фильтр покрывает другой случай — когда `z.parse()` вызывается напрямую
в сервисе для валидации бизнес-данных:

```typescript
// В сервисе — ручная валидация
const result = someSchema.parse(externalData); // ZodError если невалидно

// Фильтр поймает, сформирует понятный ответ:
// "email: Invalid email format; age: Expected number"
// вместо 500
```

В Zod v4 ошибки находятся в `exception.issues` (не `.errors` как было в v3).

### Полный поток обработки ошибки

```
throw ConflictException          → HttpException  → status=409, logStack=false
throw NotFoundException          → HttpException  → status=404, logStack=false
Prisma P2002                     → isPrismaKnown  → status=409, logStack=false
Prisma P2025                     → isPrismaKnown  → status=404, logStack=false
Prisma connection error          → isPrismaInit   → status=503, logStack=true
z.parse() на невалидных данных   → ZodError       → status=400, logStack=false
throw new Error('что-то сломалось') → unknown     → status=500, logStack=true
```

`logStack=true` только там где реально нужно чинить код — это убирает шум
из логов от обычных клиентских ошибок.

---

## 3. Pino Logger

### Зачем не встроенный NestJS Logger

Встроенный Logger:
```
[Nest] 12345  - 01/01/2025, 14:23:05  INFO  [AuthService] User registered
```

Это текст. Grafana Loki, Datadog, ELK — они парсят JSON, не текст.
Чтобы написать запрос "все ошибки за час по userId" — нужна структура.

Pino в prod:
```json
{"level":50,"time":1735737785000,"pid":1,"msg":"User registered","userId":"abc","service":"auth"}
```

Каждое поле индексируется. Можно фильтровать по `userId`, `service`, `level`.

### Режимы работы

```typescript
// dev — pino-pretty: цветной читаемый вывод в терминале
transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } }

// prod — чистый JSON, один объект на строку
transport: undefined
```

### bufferLogs

```typescript
const app = await NestFactory.create(Module, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

NestJS стартует и пишет логи до того как Pino инициализирован.
`bufferLogs: true` — придержи логи в буфере, отдай Pino когда он будет готов.
Без этого сообщения о старте будут в неправильном формате.

### Redact — защита чувствительных данных

```typescript
redact: ['req.headers.authorization', 'req.headers.cookie']
// → {"authorization": "[Redacted]"}
```

Токены и куки не должны попадать в лог-системы.

---

## 4. Logging Interceptor

### Что такое Interceptor

Middleware — работает на уровне Express, до NestJS.
Interceptor — работает на уровне NestJS, знает о контроллерах и handlers.

```typescript
return next.handle().pipe(
  tap({
    next:  () => logger.debug(`POST /api/auth/login — 45ms`),
    error: () => logger.debug(`POST /api/auth/login — 45ms [FAILED]`),
  })
);
```

`next.handle()` — это Observable (поток). `tap` подключается к потоку,
смотрит на результат, но не меняет его — как `console.log` внутри `.then()`.

### Почему не middleware

Middleware не знает паттерн RabbitMQ-сообщения. Interceptor работает
одинаково для обоих контекстов — HTTP и RPC.

---

## 5. Health Checks

### Что это

Эндпоинт `/health` который отвечает на вопрос "сервис здоров?".
Используется Docker/Kubernetes для liveness probe и load balancer-ом.

```json
// Всё хорошо → HTTP 200
{
  "status": "ok",
  "info": {
    "auth_db":     { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}

// Что-то упало → HTTP 503
{
  "status": "error",
  "error": {
    "auth_db": { "status": "down", "error": "Connection refused" }
  }
}
```

### Виды проверок

```typescript
// Память heap — рабочая память JS-кода. Если утечка → растёт и не падает
this.memory.checkHeap('memory_heap', 512 * 1024 * 1024); // порог 512MB

// RSS — вся память процесса в ОС (heap + стек + нативный код)
this.memory.checkRSS('memory_rss', 750 * 1024 * 1024);

// Диск — не более 90% занято (важно для логов и временных файлов)
this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 });

// Prisma — SELECT 1 к базе данных (минимальный запрос, просто проверяет соединение)
this.prismaIndicator.isHealthy('auth_db', this.prismaService);
```

### Гибридное приложение

Auth и User — RabbitMQ микросервисы, у них нет HTTP.
Решение: гибридное приложение — **один процесс**, два транспорта.

```typescript
// NestFactory.create() вместо createMicroservice() — создаём HTTP-приложение
const app = await NestFactory.create(AuthModule);

// Добавляем RabbitMQ как второй транспорт
app.connectMicroservice({ transport: Transport.RMQ, options: { queue: AUTH_QUEUE } });

await app.startAllMicroservices(); // ← слушает RabbitMQ
await app.listen(3002);            // ← слушает HTTP
```

Теперь auth-service одновременно:
- Обрабатывает `auth.login`, `auth.register` через RabbitMQ
- Отвечает на `GET /health` и `GET /metrics` через HTTP

---

## 6. Метрики (Prometheus + Grafana)

### Pull vs Push модель

Большинство систем мониторинга — push (сервис сам отправляет метрики).
Prometheus — pull: **он сам** ходит к каждому сервису каждые 15 секунд.

```
Prometheus → GET http://auth-service:3002/metrics → сохраняет
Prometheus → GET http://gateway:3000/api/metrics  → сохраняет
...повторяет каждые 15 секунд для каждого сервиса
```

Плюс pull-модели: сервис не знает про Prometheus, просто экспозит данные.

### Что `/metrics` возвращает

Текстовый формат (Prometheus Exposition Format):
```
# HELP nodejs_heap_size_used_bytes Heap size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes{service="auth"} 45678912

# HELP http_request_duration_seconds Duration histogram
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="POST",route="/auth/login"} 847
http_request_duration_seconds_bucket{le="0.5",method="POST",route="/auth/login"} 1203
http_request_duration_seconds_count{method="POST",route="/auth/login"} 1250
http_request_duration_seconds_sum{method="POST",route="/auth/login"} 143.7
```

### Типы метрик

| Тип | Поведение | Когда использовать |
|---|---|---|
| **Counter** | только растёт, никогда не падает | кол-во запросов, кол-во ошибок |
| **Gauge** | может расти и падать | память, активные соединения, очередь |
| **Histogram** | считает распределение в buckets | время ответа (нужен p50/p95/p99) |
| **Summary** | похоже на histogram | то же, но вычисляет квантили на клиенте |

### Что собирается автоматически

```
nodejs_heap_size_used_bytes    — сколько памяти занимает JS код
nodejs_heap_size_total_bytes   — сколько выделено (может больше чем used)
nodejs_eventloop_lag_seconds   — задержка event loop
                                  > 100ms = проблемы с производительностью
process_cpu_seconds_total      — суммарное время CPU (rate() даст % загрузки)
nodejs_active_handles_total    — открытые соединения/таймеры/сокеты
nodejs_gc_duration_seconds     — время сборки мусора (частая/долгая GC = утечка)
```

### PromQL — язык запросов

Используется в Grafana для построения графиков:

```promql
# Запросов в секунду по каждому сервису
sum(rate(http_request_duration_seconds_count[1m])) by (job)

# p95 время ответа в миллисекундах
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[1m])) by (le, job)
) * 1000

# Процент 5xx ошибок
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[1m]))
/
sum(rate(http_request_duration_seconds_count[1m]))
* 100

# Использование heap в MB
nodejs_heap_size_used_bytes / 1024 / 1024
```

`rate([1m])` — средняя скорость изменения за последнюю минуту.
`histogram_quantile(0.95, ...)` — значение ниже которого 95% всех запросов.

### Grafana Provisioning

Grafana при старте читает YAML-файлы вместо ручной настройки через UI:

```
infra/grafana/provisioning/
  datasources/prometheus.yml  → "вот твой Prometheus, используй по умолчанию"
  dashboards/dashboards.yml   → "дашборды ищи в /var/lib/grafana/dashboards"

infra/grafana/dashboards/
  nodejs-services.json        → готовый дашборд: RPS, error rate, p95, heap, CPU
```

---

## Как всё работает вместе

```
HTTP запрос: POST /api/auth/login
    │
    ├─ LoggingInterceptor: start = Date.now()
    │
    ├─ AllExceptionsFilter: ждёт...
    │
    ├─ AuthGatewayController → RabbitMQ → AuthService
    │      ├─ OK: возвращает токены
    │      └─ FAIL: бросает UnauthorizedException
    │
    ├─ Если FAIL → AllExceptionsFilter:
    │      resolveException(UnauthorizedException)
    │        → HttpException → status=401, logStack=false
    │      logger.warn({ method, url, status: 401 })
    │      response.json({ statusCode: 401, message: "Invalid credentials" })
    │
    └─ LoggingInterceptor: logger.debug("POST /api/auth/login — 32ms")
```

```
Prometheus scrape (каждые 15s):
    GET http://gateway:3000/api/metrics
    GET http://auth-service:3002/metrics
    GET http://user-service:3001/metrics
        ↓
    Сохраняет time series данные
        ↓
    Grafana читает через PromQL → рисует графики
```

---

## Запуск

```bash
# Поднять всю инфраструктуру
docker compose up -d

# Проверить health
curl http://localhost:3000/api/health   # Gateway
curl http://localhost:3002/health       # Auth Service
curl http://localhost:3001/health       # User Service

# Посмотреть сырые метрики
curl http://localhost:3002/metrics

# Открыть дашборды
# Grafana:    http://localhost:3010  (admin / polygon_grafana)
# Prometheus: http://localhost:9090
# RabbitMQ:   http://localhost:15672 (polygon / polygon_password)
```

---

## Что ещё можно добавить (Phase 2)

### OpenTelemetry + Jaeger — Distributed Tracing

Когда запрос медленный — ты знаешь что он медленный (из метрик),
но не знаешь **где именно**: gateway, auth-service, или запрос к БД?

Distributed tracing добавляет `traceId` который проходит через все сервисы.
В Jaeger видишь весь путь запроса с временными метками каждого шага:

```
gateway:          12ms total
  └─ auth-service: 45ms
       └─ DB query: 38ms  ← вот тут узкое место
```

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

### Alerting в Grafana

Уведомление в Slack/Telegram при:
- Error rate > 1% за 5 минут
- Heap memory > 80% от максимума
- p95 latency > 500ms
- Health check упал

### Loki — централизованные логи

Сейчас логи каждого сервиса — в его stdout (терминале).
Loki собирает логи всех сервисов в одно место, Grafana их ищет.

```
auth-service logs  ─┐
user-service logs  ─┤→ Loki → Grafana → "покажи все ERROR за последний час"
gateway logs       ─┘
```

### Sentry / Glitchtip — трекинг ошибок

Grafana хороша для метрик и логов. Для ошибок удобнее специализированный инструмент:
- Stack trace с полным контекстом запроса
- Группировка одинаковых ошибок
- Сколько пользователей затронуто
- История: когда появилась, сколько раз воспроизвелась

---

## Полезные ссылки

- [nestjs-pino](https://github.com/iamolegga/nestjs-pino) — логгер
- [@nestjs/terminus](https://docs.nestjs.com/recipes/terminus) — health checks
- [@willsoto/nestjs-prometheus](https://github.com/willsoto/nestjs-prometheus) — метрики
- [Prisma Error Codes](https://www.prisma.io/docs/orm/reference/error-reference) — все P-коды
- [Prometheus Getting Started](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
