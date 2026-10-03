# Phase 3 (pools, N+1, sessions, test isolation, alerts, acceptance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать DB-пул как потолок Ц1, изолировать test-БД, добавить алерты и честно перемерить Ц1/Ц2.

**Architecture:** Явные лимиты пулов Prisma через env (сумма < `max_connections`
с запасом); N+1 в списке чатов — один `$queryRaw` с `unnest` (точная семантика
сохранена); access TTL 900→3600 (что заодно разблокирует сид 1000 для Ц2);
отдельные `polygon_*_test` БД для интеграционных спеков; алерты в существующий
`polygon-alerts.yml`; приёмка k6 как раньше.

**Tech Stack:** PrismaPg pool (`pg.PoolConfig`), Nest RMQ `prefetchCount`,
promtool, existing `infra/load` k6.

**Spec:** `docs/SCALING-TZ.md` (блоки 4–8, цели Ц1 и Ц2; логи выкинуты решением
пользователя)

## Global Constraints

- NPM only; новых npm-зависимостей нет.
- Env без валидации не существует: новые поля — в `env.schema.ts` +
  `.env.example` (значения в локальные `.env*` руками, они заигнорены).
- Guards порядок неизменен; контракты не трогаем.
- Без секретов в логах: флаги + `eventType`.
- Спеки в `__tests__/`; тесты из корня через `npm exec nx`; свои строки
  prettier-clean (чужие не форматировать).
- После задач: `affected --target=test` (с `--base=origin/dev`, т.к. локального
  `main` нет) + `format:check` на свои файлы. Помнить: user integration spec
  вайпает dev-БД (см. Task 5) — бэкап `User` перед прогонами.

---

### Task 1: Лимиты пулов Prisma

**Files (один батч, одна правка везде):**
- Modify: `libs/backend/{chat,auth,user,media,notification}/src/database/prisma/prisma.service.ts` (5 файлов)
- Modify: `libs/backend/core/src/config/env.schema.ts`, `.env.example`
- Test: существующие suites каждого сервиса (pool size не меняет unit-поведение)

**Interfaces:**
- Produces: `PRISMA_POOL_MAX` (=10), `PRISMA_POOL_MAX_CHAT` (=20) для всех задач.

`pg.PoolConfig` принимает `connectionString` + `max`, итого пулов 20+10×4=60
при дефолтных `max_connections=100` (проверить `SHOW max_connections;` шагом 0,
если не 100 — масштабировать числа с тем же запасом ~40%).

- [ ] **Step 0: Проверить max_connections**

Run: `PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2)" psql -h localhost -U polygon -d polygon -tAc 'SHOW max_connections;'`
Expected: `100` (иначе пересчитать лимиты: chat = 20% , остальные по 10% с округлением вниз, минимум 5)

- [ ] **Step 1: Env-поля**

```ts
PRISMA_POOL_MAX: z.coerce.number().int().min(5),
PRISMA_POOL_MAX_CHAT: z.coerce.number().int().min(5),
```

`.env.example`: `PRISMA_POOL_MAX=10`, `PRISMA_POOL_MAX_CHAT=20`.
Локальные `.env*` — те же значения руками.

- [ ] **Step 2: Правка 5 конструкторов (образец — chat, остальные аналогично
  со своим ключом)**

```ts
const adapter = new PrismaPg({
  connectionString: config.getOrThrow('CHAT_DATABASE_URL', { infer: true }),
  max: config.getOrThrow('PRISMA_POOL_MAX_CHAT', { infer: true }),
});
```

auth/user/media/notification: ключ `PRISMA_POOL_MAX`. Точный ключ env на сервис
взять из существующей строки `getOrThrow('*_DATABASE_URL')` того же файла
(не перепутать БД).

- [ ] **Step 3: Прогон suites (моки конфига могут упасть на новом ключе)**

Run: `npm exec nx -- run-many --target=test --projects=@org/auth,@org/user,@org/chat,@org/media,@org/notification --skip-nx-cache 2>&1 | tail -5`
Expected: PASS. Если спек падает с `Unexpected config key: PRISMA_POOL_MAX*`
(вайтлист-моки) — добавить ключ с прод-дефолтом (10 / 20 для chat) в тот мок,
перезапустить. Это ожидаемая правка, не отклонение.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/*/src/database/prisma/prisma.service.ts libs/backend/core/src/config/env.schema.ts .env.example
git commit -m "feat: explicit prisma pool limits"
```

### Task 2: N+1 в findChatsForUser → один запрос

**Files:**
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
  (новый метод + использование в `findChatsForUser`)
- Create: `libs/backend/chat/src/database/repository/__tests__/chat.unread-batch.spec.ts`
  (проверить как называются соседние спеки: `chat.prisma.repo.spec.ts` мокает
  PrismaService — новый файл рядом, стиль оттуда)
- Test: новый spec + весь `@org/chat` suite

**Interfaces:** Produces: меньше round-trip'ов на открытие списка чатов (вход Ц1).

Колонки snake_case (`"Message"`, `"ChatMember"`, `message_deletions` — как в
`COPY`-строках бэкапа). Семантика 1-в-1 с `countUnreadMessages` (null lastRead
= всё непрочитанное; tiebreak по id только при совпадении createdAt).

- [ ] **Step 1: Падающий тест**

```ts
describe('countUnreadForChats', () => {
  it('batches unread counts in a single queryRaw', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ chatId: 'c1', unread: 3 }]) };
    const repo = new ChatPrismaRepository(prisma as never);
    const out = await repo.countUnreadForChats(
      [{ chatId: 'c1', lastReadAt: null, lastReadMessageId: null }],
      'u1',
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out).toEqual(new Map([['c1', 3]]));
  });

  it('defaults missing chats to 0', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repo = new ChatPrismaRepository(prisma as never);
    const out = await repo.countUnreadForChats(
      [{ chatId: 'c1', lastReadAt: null, lastReadMessageId: null }],
      'u1',
    );
    expect(out.get('c1')).toBe(0);
  });
});
```

Конструктор `ChatPrismaRepository` взять из соседнего спека (там
`new ChatPrismaRepository(repositoryPrisma)`).

- [ ] **Step 2: RED**

Run: `npm exec nx -- test @org/chat --testPathPatterns=unread-batch 2>&1 | tail -3`
Expected: FAIL (`countUnreadForChats is not a function`; флаг `--testPathPatterns`
во множественном числе — singular удалён в этом jest)

- [ ] **Step 3: Реализация**

```ts
async countUnreadForChats(
  reads: { chatId: string; lastReadAt: Date | null; lastReadMessageId: string | null }[],
  userId: string,
): Promise<Map<string, number>> {
  if (reads.length === 0) return new Map();
  const rows = await this.prisma.$queryRaw<Array<{ chatId: string; unread: number }>>`
    SELECT c.chat_id AS "chatId", COUNT(m."id")::int AS "unread"
    FROM unnest(${reads.map((r) => r.chatId)}::uuid[], ${reads.map((r) => r.lastReadAt)}::timestamptz[], ${reads.map((r) => r.lastReadMessageId)}::uuid[]) AS c(chat_id, last_read_at, last_read_msg_id)
    LEFT JOIN "Message" m ON m."chat_id" = c.chat_id
      AND m."senderId" <> ${userId}
      AND m."deletedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "message_deletions" d WHERE d."message_id" = m."id" AND d."user_id" = ${userId})
      AND (c.last_read_at IS NULL OR m."createdAt" > c.last_read_at OR (m."createdAt" = c.last_read_at AND (c.last_read_msg_id IS NULL OR m."id" > c.last_read_msg_id)))
    GROUP BY c.chat_id`;
  const map = new Map<string, number>();
  for (const r of reads) map.set(r.chatId, 0);
  for (const row of rows) map.set(row.chatId, row.unread);
  return map;
}
```

Имена колонок в кавычках — camelCase для `"Message"` (`"chat_id"`? нет:
`COPY`-строка бэкапа: `"Message" (id, chat_id, sender_id, ...)` — snake_case,
а в Prisma-селектах поля camelCase. В raw SQL использовать snake_case как
в БД: `m.chat_id`, `m.sender_id`, `m.deleted_at`, `m.created_at`, `"Message"`,
`message_deletions(message_id, user_id)`. (В черновике выше оставлены camelCase
в кавычках — перед коммитом сверить с `\d "Message"` и поправить на реальные
имена; тест на моке это не поймает, поэтому сверка обязательна.)

Затем в `findChatsForUser` заменить `Promise.all(...countUnreadMessages...)`
на один вызов batch + `map.get(chat.id) ?? 0`. Старый `countUnreadMessages`
оставить (могут быть другие вызывающие — grep перед удалением; если только
этот цикл — удалить метод и его спеки обновить).

- [ ] **Step 4: GREEN + suite**

Run: новый spec, затем `npm exec nx -- test @org/chat 2>&1 | tail -3`
Expected: PASS всё.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/chat/src/database/repository/
git commit -m "feat: batch unread counts in single query"
```

### Task 3: RMQ prefetch bound (гигиена памяти, не throughput)

**Files:**
- Modify: `apps/backend/{auth,user,chat,media,notification,search}-service/src/main.ts`
  (6 файлов, однотипно)
- Modify: `libs/backend/core/src/config/env.schema.ts`, `.env.example`
- Test: boot каждого сервиса (prefetch виден в management UI `:15672` →
  Channels → Prefetch)

Честная рамка: дефолт Nest `prefetchCount=0` (безлимит) — throughput не
ограничивает (хендлеры асинхронны), но при медленной БД тысячи unacked
копятся в памяти сервиса. Биндим сверху, на скорость не претендуем.

- [ ] **Step 1: Env**

```ts
RABBITMQ_PREFETCH: z.coerce.number().int().min(0).default(200),
```

(`0` = оставить дефолт Nest; прод-дефолт 200.) `.env.example`: `RABBITMQ_PREFETCH=200`.

- [ ] **Step 2: Шесть main.ts (образец — chat, взять точные имена
  констант портов/очередей из каждого файла)**

```ts
const RABBITMQ_PREFETCH = configService.get('RABBITMQ_PREFETCH', { infer: true });
app.connectMicroservice<MicroserviceOptions>(
  {
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: CHAT_QUEUE,
      queueOptions: { durable: true },
      prefetchCount: RABBITMQ_PREFETCH,
    },
  },
  { inheritAppConfig: true },
);
```

(`get`, не `getOrThrow` — есть default в схеме; остальные строки блока
не трогать.)

- [ ] **Step 3: Проверка**

Перезапустить один сервис из dist (процедура фазы 2 Task 5: build →
kill PID → `setsid node dist`), открыть `http://localhost:15672`
(креды из `.env` `RABBITMQ_USER/PASSWORD`) → Channels → Prefetch = 200.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/*-service/src/main.ts libs/backend/core/src/config/env.schema.ts .env.example
git commit -m "feat: bound RMQ prefetch via env"
```

### Task 4: Access TTL 900 → 3600

**Files:** `.env`, `.env.test`, `.env.production`, `.env.example`
(только значения `JWT_ACCESS_TOKEN_EXPIRES`, кода нет)
- Test: `npm exec nx -- test @org/auth` + gateway auth specs (мокают конфиг —
  unaffected, но прогнать)

Побочный выигрыш зафиксировать в отчёте: сид 1000 (~15–17 мин) теперь влезает
в TTL — честный Ц2 1:1 становится возможен (Task 7).

- [ ] **Step 1: Значения**

`JWT_ACCESS_TOKEN_EXPIRES=3600` в 4 файлах (`.env*` локально + example).
Refresh (`604800`) не трогать. Ротация/reuse-защита не меняются.

- [ ] **Step 2: Проверки**

Run: `npm exec nx -- test @org/auth 2>&1 | tail -3` + gateway auth spec файл
Expected: PASS. Живая проверка: login → `users/me` 200 → подождать не надо;
refresh-flow покрыт спеками.

- [ ] **Step 3: Commit**

```bash
git add .env.example && git commit -m "feat: longer access token TTL"
```

(значения `.env*` локальны, не коммитятся; в сообщение — напоминание
дописать руками после мержа, как с пулами)

### Task 5: Изоляция test-БД

**Files:**
- Локально: создать 5 БД + `.env.test` URLs + `migrate deploy NODE_ENV=test` ×5
- Commit: подсекция в `docs/DEVELOPMENT.md` §12 про test-БД
- Test: user integration spec зелёный + dev `User` count=161 нетронут

Причина: `.env.test` сейчас копия `.env` → `user.repository.spec.ts`
вайпает dev-юзеров при каждом прогоне (дважды восстановлено из бэкапа).

- [ ] **Step 1: Создать тестовые БД**

```bash
PGPASS="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2)"
for DB in polygon_auth_test polygon_user_test polygon_chat_test polygon_media_test polygon_notification_test; do PGPASSWORD="$PGPASS" psql -h localhost -U polygon -d polygon -tAc "SELECT 'CREATE DATABASE $DB' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB')\gexec"; done
```

- [ ] **Step 2: Переключить .env.test (локально, не коммитить)**

Заменить имена БД на `*_test` во всех 5 `*_DATABASE_URL` `.env.test`.

- [ ] **Step 3: Миграции в test-БД**

```bash
for SVC in auth user chat media notification; do NODE_ENV=test prisma migrate deploy --config prisma.config.ts; done
```

Run from: корень каждой `libs/backend/$SVC` по очереди (cwd важен —
`prisma.config.ts` резолвит env от `__dirname`).

- [ ] **Step 4: Доказательство**

Run: `npm exec nx -- test @org/user 2>&1 | tail -3` → PASS;
сразу: dev `User` count — обязан остаться 161
(`psql ... -d polygon_user -tAc 'SELECT count(*) FROM "User";'`).

- [ ] **Step 5: Документация + commit**

В `docs/DEVELOPMENT.md` §12 добавить подсекцию «Test databases»
(5 строк: имена `polygon_*_test`, создаются шагом выше, `.env.test`
не коммитится). Commit только этот файл.

### Task 6: Инвалидация членства при leave

**Files:**
- Modify: `apps/backend/gateway/src/cache/gateway-chat-cache.service.ts`
  (+`clearMemberCached`)
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
  (`handleLeave`, строки ~312–326)
- Modify: существующий socket spec (кейс leave)
- Test: `@org/gateway` socket suite

- [ ] **Step 1: Метод + тест**

```ts
async clearMemberCached(chatId: string, userId: string): Promise<void> {
  try {
    await this.redis.del(`membership:${chatId}:${userId}`);
  } catch {
    /* best-effort */
  }
}
```

Спека — по образцу соседних (мок redis `{get,set,del}`, assert `del`
вызван с `membership:c1:u1`).

- [ ] **Step 2: Вызов в handleLeave (после `socket.leave`, рядом с чисткой
  `userChats`)**

```ts
await this.chatCache.clearMemberCached(payload.chatId, userId);
```

(`userId` может быть undefined — гард `if (userId)` уже есть вокруг,
вставить внутрь.)

- [ ] **Step 3: Кейс в socket spec + прогон**

`handleLeave` → `clearMemberCached` вызван с `(chatId, userId)`.
Run: socket suite. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/gateway/src/cache apps/backend/gateway/src/gateways/
git commit -m "feat: invalidate membership cache on leave"
```

### Task 7: Алерты Gateway/DB

**Files:**
- Modify: `infra/observability/prometheus/rules/polygon-alerts.yml`
- Test: `promtool check rules` + `/-/reload` + один форсированный триггер

Стиль — как существующие (groups/rules/alert/expr/for/labels/annotations).
RMQ-глубина НЕ алертится (нет экспортёра — зафиксировано как follow-up,
не выдумывать метрику).

- [ ] **Step 1: Четыре алерта (в группу polygon-service-health)**

```yaml
- alert: GatewayHighP95Latency
  expr: histogram_quantile(0.95, sum(rate(polygon_http_request_duration_seconds_bucket{service="gateway"}[5m])) by (le)) > 0.5
  for: 3m
- alert: GatewayThrottleSpike
  expr: sum(rate(polygon_http_requests_total{service="gateway",status_code="429"}[5m])) / sum(rate(polygon_http_requests_total{service="gateway"}[5m])) > 0.05
  for: 2m
- alert: PostgresConnsHigh
  expr: sum(pg_stat_activity_count) / sum(pg_settings_max_connections) > 0.7
  for: 5m
- alert: GatewayRSSHigh
  expr: max(process_resident_memory_bytes{service="gateway"}) > 2000000000
  for: 5m
```

Имена метрик exporter'ов (`pg_stat_activity_count`, `pg_settings_max_connections`)
сверить с `/api/metrics` postgres-exporter перед коммитом — если имён нет,
взять реальные из `/federate` или targets-страницы `:9090` и поправить expr
(процедура, не плейсхолдер: открыть `http://localhost:9090/targets`,
найти exporter-джобу, открыть `/metrics`, скопировать точные имена).

severity/labels/annotations — как у соседей (warning/critical + summary).

- [ ] **Step 2: Проверка и reload**

Run: `docker compose exec prometheus promtool check rules /etc/prometheus/rules/polygon-alerts.yml`
Expected: SUCCESS.
Run: `curl -s -X POST http://localhost:9090/-/reload` (lifecycle включён в compose).
Форсированный триггер одного алерта (например 429-шторм k6 1 мин) → `curl -s http://localhost:9090/api/v1/alerts | grep GatewayThrottleSpike` показывает firing→resolved.

- [ ] **Step 3: Commit**

```bash
git add infra/observability/prometheus/rules/polygon-alerts.yml
git commit -m "feat: gateway and db alerts"
```

### Task 8: Приёмка Ц1 + Ц2

**Files:** без кода — `infra/load/README.md` таблица + (если нужен)
восстановленный `http-paced.js`.
**Interfaces:** требует Tasks 1–4 (пулы), TTL 3600 (Task 4) для сида 1000.

- [ ] **Step 1: Стек и сид**

Пересобрать dist всех 7 (`npm exec nx -- run-many --target=build`),
перезапустить процессы (процедура фазы 2), `SEED_N=1000` (~15 мин, батчинг
есть) → SQL-верификация → `SEED_LOGIN_ONLY=1` (влезает в TTL 3600 —
проверить exit 0 и withCookies=1000).

- [ ] **Step 2: Ц1 — paced 1000 RPS / 5 мин**

Восстановить `http-paced.js` (текст в отчёте фазы 1/Task 5 — перепечатать
в `infra/load/scenarios/http-paced.js`, коммит) → `RATE=1000`.
Expected: p95 < 500мс, ошибок < 1%. Иначе — зафиксировать и вернуть в работу
пулы/путь записи (не чинить в этой задаче).

- [ ] **Step 3: Ц2 — 1000 писателей 1:1 / 3 мин**

Стандартный `ws-load.js` (порог `msg_new_ok` из фазы 2).
Expected: rate > 0.99.

- [ ] **Step 4: Запись + commit**

```bash
git add infra/load/
git commit -m "test: phase3 acceptance C1 C2"
```

Критерий закрытия фазы: Ц1 и Ц2 зелёные; иначе — цифры в отчёт и следующий
план (железо), код не откатывать.
