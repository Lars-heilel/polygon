# Phase 2 (gateway cluster) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gateway в Node-cluster режиме с кросс-воркер рассылкой сокетов и
корректными метриками, плюс закрытие join-race и чистое измерение Ц1/Ц2.

**Architecture:** `main.ts` форкает `GATEWAY_WORKERS` воркеров на общем `:3000`
(ноль изменений nginx); кросс-воркер broadcast — `@socket.io/redis-adapter`
на ioredis pub/sub; клиент только `websocket`-транспорт (polling при shared-порте
нельзя приstickить); метрики агрегирует primary-процесс по IPC
(`AggregatorRegistry`) на `127.0.0.1:3110`; join-race лечится ожиданием userId
с явной ошибкой вместо silent drop.

**Tech Stack:** Node 22 cluster, socket.io 4.8.3, new dep
`@socket.io/redis-adapter@^8` (backend only), prom-client AggregatorRegistry,
existing `infra/load` k6.

**Spec:** `docs/SCALING-TZ.md` (блок 2, цели Ц1 и Ц2); входы из финала фазы 1:
join-race, порог k6, дрейф throttle-константы.

## Global Constraints

- NPM only, `package-lock.json` — источник правды (новый dep ставится
  `npm i -S`, лок-файл коммитится).
- Env без валидации не существует: `GATEWAY_WORKERS`, `GATEWAY_METRICS_PORT` —
  поля в `libs/backend/core/src/config/env.schema.ts` + `.env.example` (значения
  в локальные `.env*` руками, они заигнорены — НЕ коммитить, урок фазы 1).
- Guards порядок неизменен; контракты (`API_ROUTES`, zod) не трогаем.
- Без секретов в логах: флаги + `eventType`.
- Спеки в `__tests__/`; тесты из корня через `npm exec nx`; новые строки
  prettier-clean (проверять `prettier --check` на тронутых файлах, не чинить
  чужие строки).
- После задач: `affected --target=test` + `format:check` (фол repo-wide
  pre-existing — смотреть только свои файлы).

---

### Task 1: Join-race fix + membership cache в handleJoin

**Files:**
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Modify: `apps/backend/gateway/src/gateways/__tests__/chat.socket-gateway.spec.ts`
  (читать `beforeEach`/`makeSocket` перед правкой, идентификаторы моков
  зеркалить оттуда)
- Test: тот же spec-файл

**Interfaces:**
- Consumes: `chatCache.isMemberCached/setMemberCached` (фаза 1, Task 3),
  env `MEMBERSHIP_CACHE_TTL_SEC` (фаза 1, Task 1).
- Produces: `chat:join:error` событие с `{ code: 'UNAUTHORIZED', chatId }`;
  `handleJoin` использует кеш членства (вход для измерения cache-hit в фазе 2).

Причина: `handleJoin` падает в `if (!userId) return` когда `chat:join` приходит
раньше конца async `handleConnection` (замерено: 57 коннектов → 7 ack).
Фикс ждёт userId до 5с, потом отвечает явной ошибкой вместо тишины.

- [ ] **Step 1: Написать падающие тесты**

```ts
it('waits for connection setup instead of dropping early join', async () => {
  chatClient.send.mockReturnValue(of(true));
  const early = makeSocket();
  early.data = {};
  const joinPromise = gateway.handleJoin(early, { chatId: 'c1' });
  early.data['userId'] = 'u1';
  await joinPromise;
  expect(joinEmitOf(early)).toHaveBeenCalledWith('chat:joined', { chatId: 'c1' });
});

it('emits chat:join:error when user never authenticates', async () => {
  const anon = makeSocket();
  anon.data = {};
  await gateway.handleJoin(anon, { chatId: 'c1' });
  expect(joinEmitOf(anon)).toHaveBeenCalledWith(
    'chat:join:error',
    expect.objectContaining({ code: 'UNAUTHORIZED', chatId: 'c1' }),
  );
});
```

Имена `makeSocket`/`emit`-хелперов взять из файла (адаптировать без смены смысла;
`joinEmitOf` — локальный хелпер вида `(s) => s.emit` по образцу файла; таймаут
ожидания мокать коротким через `jest.useFakeTimers` НЕ надо — helper ждёт
реально, в тесте userId подставляется синхронно до тика).

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm exec nx -- test @org/gateway --testPathPatterns=chat.socket-gateway 2>&1 | tail -4`
Expected: FAIL (нет `chat:join:error`, ранний join дропается)

- [ ] **Step 3: Helper ожидания + правка handleJoin**

В gateway добавить приватный helper (рядом с `presenceKey`/`typingKey`):

```ts
private async waitForUserId(socket: Socket, timeoutMs: number): Promise<string | undefined> {
  const start = Date.now();
  for (;;) {
    const userId = socket.data['userId'] as string | undefined;
    if (userId) return userId;
    if (!socket.connected) return undefined;
    if (Date.now() - start > timeoutMs) return undefined;
    await new Promise((r) => setTimeout(r, 50));
  }
}
```

В `handleJoin` заменить:

```ts
const userId = socket.data['userId'] as string;
if (!userId) return;
```

на:

```ts
let userId = socket.data['userId'] as string | undefined;
if (!userId) {
  userId = await this.waitForUserId(socket, 5000);
}
if (!userId) {
  this.logger.warn({ eventType: 'socket_join_denied', hasChatId: !!payload.chatId });
  socket.emit('chat:join:error', {
    code: 'UNAUTHORIZED',
    message: 'Not authenticated',
    chatId: payload.chatId,
  });
  return;
}
```

- [ ] **Step 4: Кеш членства в handleJoin (вместо всегда-RPC)**

Тот же паттерн что в `handleSendMessage` (фаза 1): `isMemberCached` → `null` →
RPC `CHECK_MEMBERSHIP` → `setMemberCached` при `true` с
`config.getOrThrow('MEMBERSHIP_CACHE_TTL_SEC', { infer: true })`.
`socket.join` + `chat:joined` ack без изменений.

- [ ] **Step 5: Зелёный прогон**

Run: `npm exec nx -- test @org/gateway --testPathPatterns=chat.socket-gateway 2>&1 | tail -4`
Expected: PASS (старые + 2 новых)

- [ ] **Step 6: Commit**

```bash
git add apps/backend/gateway/src/gateways/
git commit -m "fix: queue early chat join until connection setup"
```

### Task 2: k6-порог на message:new + throttle-константа

**Files:**
- Modify: `infra/load/scenarios/ws-load.js`
- Create: `apps/backend/gateway/src/throttle/throttle-limits.ts`
- Modify: 5 контроллеров фазы 1 (заменить литерал `300` на константу)
- Modify: `apps/backend/gateway/src/app/gateway.module.ts` (drift-check в factory)
- Create: `apps/backend/gateway/src/throttle/__tests__/throttle-limits.spec.ts`
- Test: `apps/backend/gateway/src/throttle/__tests__/throttle-limits.spec.ts`

**Interfaces:**
- Consumes: `chat:joined` надёжен после Task 1 (ретрай из фазы 1 можно убирать).
- Produces: порог `msg_new_ok rate>0.99` для Ц2; единый источник лимита.

- [ ] **Step 1: Rate-метрика вместо общего checks-порога (ws-load.js)**

```js
import { Rate } from 'k6/metrics';
const msgNewOk = new Rate('msg_new_ok');
// thresholds: { msg_new_ok: ['rate>0.99'], http_req_failed: ['rate<0.01'] }
// в конце итерации: msgNewOk.add(gotNew === true);
// остальные checks (connect/namespace/no-errors/join-ack) оставить как info, без порога
```

Убрать 5-кратный ресенд `chat:join` (Task 1 починил сервер): один `chat:join`,
ждать `chat:joined` 5с, fallback как раньше. Убрать `ackTimeout`-флаг если
больше не используется.

- [ ] **Step 2: Константа лимита + drift-check**

`throttle-limits.ts`:

```ts
export const USER_THROTTLE = { limit: 300, ttl: 60000 } as const;
```

В 5 контроллерах заменить `@Throttle({ default: { limit: 300, ttl: 60000 } })`
на `@Throttle({ default: USER_THROTTLE })` (+ импорт, sync-комментарий оставить,
дописав `// source of truth, env must match`).
В `forRootAsync` factory добавить после чтения env:

```ts
if (config.getOrThrow('THROTTLE_USER_LIMIT', { infer: true }) !== USER_THROTTLE.limit) {
  throw new Error('THROTTLE_USER_LIMIT drifted from USER_THROTTLE.limit');
}
```

Спека `throttle-limits.spec.ts`:

```ts
import { USER_THROTTLE } from '../throttle-limits';

describe('USER_THROTTLE', () => {
  it('matches documented user limit', () => {
    expect(USER_THROTTLE).toEqual({ limit: 300, ttl: 60000 });
  });
});
```

- [ ] **Step 3: Проверки**

Run: `npm exec nx -- test @org/gateway --testPathPatterns=throttle 2>&1 | tail -4`
Expected: PASS.

Run: `npx prettier --check <все тронутые файлы>` — только свои строки чинить.
Smoke k6 не нужен (сценарий не менял протокол, только метрику).

- [ ] **Step 4: Commit**

```bash
git add infra/load/scenarios/ws-load.js apps/backend/gateway/src/throttle apps/backend/gateway/src/app/gateway.module.ts apps/backend/gateway/src/controllers/
git commit -m "test: scope k6 threshold to message delivery; single-source throttle limit"
```

### Task 3: Cluster + Redis adapter + агрегированные метрики

**Files:**
- Modify: `apps/backend/gateway/src/main.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
  (`afterInit` адаптер, `user:`-комнаты, `emitToUser`/`disconnectUser`)
- Modify: `libs/client/shared/src/lib/socket/socket.ts` (только websocket)
- Modify: `libs/backend/core/src/config/env.schema.ts` + `.env.example`
  (значения в локальные `.env*` руками, не коммитить)
- Modify: `infra/observability/prometheus/prometheus.yml` (таргет агрегатора)
- Modify: root `package.json` (new dep через `npm i -S`)
- Test: gateway suite + `@org/shared` suite + boot двух воркеров

**Interfaces:**
- Consumes: env-стиль фазы 1; `REDIS_HOST/PORT/PASSWORD` уже в схеме.
- Produces: `GATEWAY_WORKERS`/`GATEWAY_METRICS_PORT`; `/metrics` агрегатора
  на `127.0.0.1:3110`; кросс-воркер `message:new`/`message:hidden`.

Порядок в коде важен: сначала env+dep, потом main.ts, потом адаптер, потом клиент.

- [ ] **Step 1: Зависимость и env**

Run: `npm i -S @socket.io/redis-adapter@^8`
Expected: `package.json` + `package-lock.json` обновлены, билд типов ок.

Схема (`env.schema.ts`, рядом с `GATEWAY_PORT`):

```ts
GATEWAY_WORKERS: z.coerce.number().int().min(0).default(0),
GATEWAY_METRICS_PORT: z.coerce.number().int().min(1).default(3110),
```

`0` = авто (`max(1, cpu - 6)`). `.env.example`:

```
GATEWAY_WORKERS=0
GATEWAY_METRICS_PORT=3110
```

Локальные `.env*` — те же две строки руками.

- [ ] **Step 2: Cluster + агрегатор в main.ts**

В начало файла:

```ts
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import http from 'node:http';
import { config as dotenvConfig } from 'dotenv';
import { AggregatorRegistry } from 'prom-client';

dotenvConfig();

function workerCount(): number {
  const raw = Number(process.env['GATEWAY_WORKERS'] ?? 0);
  if (Number.isInteger(raw) && raw > 0) return raw;
  return Math.max(1, availableParallelism() - 6);
}
```

`bootstrap()` оставить как есть, но вернуть `app` (`return app;` в конце,
сигнатура `Promise<INestApplication>` — тип импортировать из `@nestjs/common`).

В конец файла вместо прямого `bootstrap();`:

```ts
if (cluster.isPrimary) {
  const n = workerCount();
  logger.log(`Gateway primary starting ${n} workers`);
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    logger.warn(`Gateway worker ${worker.process.pid} exited (${code}), reforking`);
    setTimeout(() => cluster.fork(), 2000);
  });
  serveAggregatedMetrics(
    Number(process.env['GATEWAY_METRICS_PORT'] ?? 3110),
  );
} else {
  bootstrap().then((app) => {
    const metrics = app.get('MetricsService' as never) as { metrics(): Promise<string> };
    process.on('message', (msg: unknown) => {
      if (msg === 'metrics-req' && process.send) {
        metrics
          .metrics()
          .then((body) => process.send?.({ metricsBody: body }))
          .catch(() => undefined);
      }
    });
  });
}

function serveAggregatedMetrics(port: number): void {
  const aggregator = new AggregatorRegistry();
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
    const bodies: string[] = [];
    const done = (): void => {
      try {
        const out = aggregator.aggregate(bodies);
        res.setHeader('Content-Type', aggregator.contentType);
        res.end(out);
      } catch {
        res.writeHead(500);
        res.end();
      }
    };
    const timer = setTimeout(done, 2000);
    for (const w of workers) {
      w?.once('message', (msg: unknown) => {
        const body = (msg as { metricsBody?: unknown })?.metricsBody;
        if (typeof body === 'string') bodies.push(body);
        pending -= 1;
        if (pending === 0) {
          clearTimeout(timer);
          done();
        }
      });
      w?.send('metrics-req');
    }
  });
  server.listen(port, '127.0.0.1', () => {
    logger.log(`Gateway metrics aggregator on http://127.0.0.1:${port}/metrics`);
  });
}
```

Замечание по `app.get('MetricsService')`: точный DI-токен — класс
`MetricsService` из `@org/core` (проверить barrel `libs/backend/core/src/index.ts`
на реэкспорт observability; если нет — добавить `export *` observability-строку
и импортировать класс нормально вместо `as never`; строковой токен — fallback
только если barrel закрыт и правило запрещает глубокий импорт — тогда
расширить barrel, это разрешено).

- [ ] **Step 3: Redis adapter + user-комнаты (socket gateway)**

Импорты:

```ts
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
```

Метод (Nest вызывает `afterInit` автоматически):

```ts
async afterInit(server: Server): Promise<void> {
  const host = this.config.getOrThrow('REDIS_HOST', { infer: true });
  const port = this.config.getOrThrow('REDIS_PORT', { infer: true });
  const password = this.config.getOrThrow('REDIS_PASSWORD', { infer: true });
  const opts = { host, port, ...(password ? { password } : {}) };
  const pub = new Redis(opts);
  const sub = new Redis(opts);
  await Promise.all([pub.connect().catch(() => undefined), sub.connect().catch(() => undefined)]);
  server.adapter(createAdapter(pub, sub));
  this.logger.log({ eventType: 'socket_redis_adapter_ready', hasHost: !!host });
}
```

Примечание: `lazyConnect` не выставляем (дефолт подключается сам);
`connect().catch` — страховка двойного коннекта. Отдельные pub/sub соединения
обязательны (shared `REDIS_CLIENT` как sub использовать нельзя).

В `handleConnection` после `userSockets.set`:

```ts
await socket.join(`user:${userId}`).catch(() => undefined);
```

`emitToUser` заменить телом:

```ts
this.server.to(`user:${userId}`).emit(event, payload);
```

`disconnectUser` заменить телом:

```ts
this.server.in(`user:${userId}`).disconnectSockets(true);
this.userSockets.delete(userId);
this.userChats.delete(userId);
this.redis.del(this.presenceKey(userId)).catch(() => undefined);
```

Локальные мапы чистятся best-effort (источник правды — комнаты адаптера).

- [ ] **Step 4: Клиент только websocket**

`libs/client/shared/src/lib/socket/socket.ts`:

```ts
export const socket = io(window.location.origin, {
  autoConnect: false,
  withCredentials: true,
  // кластер gateway на shared-порту: polling нельзя приstickить, только websocket
  transports: ['websocket'],
});
```

- [ ] **Step 5: Prometheus таргет агрегатора**

`infra/observability/prometheus/prometheus.yml`, рядом с `polygon-gateway`:

```yaml
  - job_name: polygon-gateway-aggregated
    metrics_path: /metrics
    static_configs:
      - targets:
          - host.docker.internal:3110
        labels:
          stack: polygon
```

Портхардкод 3110 + комментарий `# keep in sync with GATEWAY_METRICS_PORT`.

- [ ] **Step 6: Проверки**

Run: `npm exec nx -- test @org/gateway 2>&1 | tail -3`
Expected: PASS (afterInit/adapter не вызываются в юнит-спеках без ascii; если
спека падает на `new Redis` — мокать `ioredis` в spec-файле через `jest.mock`,
образец: существующие моки клиентов).

Run: `npm exec nx -- test @org/shared 2>&1 | tail -3`
Expected: PASS.

Run: `npm exec nx -- build @org/gateway 2>&1 | tail -2`
Expected: `webpack compiled successfully`.

Boot двух воркеров: `GATEWAY_WORKERS=2` + запуск dist, `curl` обоих
`127.0.0.1:3110/metrics` содержит `polygon_http_requests_total`, два
`message:new` между сокетами на разных воркерах (проверить k6 smoke 5 VU:
`bash infra/load/run.sh smoke` — smoke ходит только HTTP; для WS — короткая
ручная проверка сокетом из `node -e` скрипта в отчёте, не в коммит).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/gateway/src/main.ts apps/backend/gateway/src/gateways/chat.socket-gateway.ts libs/client/shared/src/lib/socket/socket.ts libs/backend/core/src/config/env.schema.ts .env.example infra/observability/prometheus/prometheus.yml package.json package-lock.json
git commit -m "feat: gateway cluster with redis adapter and aggregated metrics"
```

### Task 4: Верификация Ц1 + Ц2 + leave/kick-аудит

**Files:** без кода кроме `infra/load/README.md` (таблица Results + строка про
leave/kick-аудит). Измерение + запись.

**Interfaces:** Consumes: Tasks 1–3, gateway dist пересобран и перезапущен
(процедура из фазы 1 Task 5: build → kill старого PID → `setsid node dist`).

- [ ] **Step 1: Leave/kick-аудит (до прогонов)**

Run: `grep -rn "leave\|kick\|removeMember\|REMOVE_MEMBER" apps/backend/gateway/src/controllers/chat.controller.ts apps/backend/gateway/src/gateways/chat.socket-gateway.ts | grep -v "^.*://" | head`
Expected: пусто (на фазе 1 не найдено) → TTL-only 45с остаётся принятым
решением; записать в README одну строку:
`Membership invalidation: TTL-only 45s (no leave/kick endpoints in gateway; service re-checks authoritatively).`
Если эндпоинты найдутся — НЕ чинить здесь, зафиксировать список в отчёте
для Plan 3.

- [ ] **Step 2: Токены + Ц1 (paced 1000 RPS / 5 мин)**

Run: `SEED_LOGIN_ONLY=1 node infra/load/seed.mjs` (exit 0, withCookies=withChats)
Run: сценарий `infra/load/scenarios/http-load.js` — stages в файле рассчитаны
на ~100 RPS; для Ц1 нужен paced-вариант из фазы 1 (`/tmp/opencode/http-paced.js`
в отчёте фазы 1 — восстановить его в `infra/load/scenarios/http-paced.js`
коммитом ПЕРЕД прогоном, rate через `RATE=1000`):
`RATE=1000` 5 мин.
Expected: p95 < 500мс, ошибок < 1% (иначе — зафиксировать факт для Plan 3,
см. риск ТЗ про железо).

- [ ] **Step 3: Ц2 (1000 писателей 1:1 + 3 мин)**

Предусловие: `SEED_N=1000` прогнать заранее (~15 мин, батчинг Task 5 фазы 1),
затем SQL-верификация и `SEED_LOGIN_ONLY=1`.
Run: `docker run --rm --network host -v "$PWD/infra/load:/scripts" -e BASE_URL=http://localhost:3000 grafana/k6 run --vus 1000 --duration 3m /scripts/scenarios/ws-load.js`
Expected: `msg_new_ok rate>0.99` зелёный (порог Task 2).

- [ ] **Step 4: Записать факты + commit**

Таблица `## Results` в README + строка leave/kick-аудита.

```bash
git add infra/load/
git commit -m "test: phase2 acceptance results C1 C2"
```

Критерий закрытия фазы: Ц1 и Ц2 зелёные. Если нет — зафиксировать цифры,
закрыть фазу отчётом (код фазы не откатывать), входы — в Plan 3.
