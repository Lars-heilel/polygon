# Phase 1 (throttle per-user + WS send path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user троттлер и дешёвый путь отправки WS-сообщений (кеш членства, антиспам-лимит, join-ack).

**Architecture:** Трекинг троттлера — чистая функция без DI (парсинг sub из JWT без
верификации, ключ `sub:ip`, auth всё равно проверяет SessionGuard после);
лимиты — через env + `forRootAsync`; путь отправки — Redis-кеш членства (TTL 45с,
авторитетно проверяет chat-service `findChatMember`, уже есть) + Redis-счётчик
отправок + `chat:joined` ack.

**Tech Stack:** NestJS 11, @nestjs/throttler 6.5.0, ioredis, existing `infra/load` k6.

**Spec:** `docs/SCALING-TZ.md` (блоки 1 и 3, цели Ц4 и Ц2)

## Global Constraints

- NPM only, `package-lock.json` — источник правды; новых npm-зависимостей нет.
- Env без валидации не существует: каждая новая переменная — поле в
  `libs/backend/core/src/config/env.schema.ts` + значения в `.env`, `.env.test`,
  `.env.production` (стиль: `JWT_ACCESS_TOKEN_EXPIRES: z.coerce.number()`).
- Guards порядок: Throttler → Session/Jwt → ActiveAccount → Roles (не менять).
- Без секретов в логах: только `hasUserId`-флаги + `eventType`.
- Спеки живут в `__tests__/` рядом с кодом; тесты гонять из корня через
  `npm exec nx` (никогда jest/vitest с cwd внутри либы).
- После задач: `npm exec nx -- affected --target=test` + `npm run format:check`.

---

### Task 1: Env-переменные лимитов

**Files:**
- Modify: `libs/backend/core/src/config/env.schema.ts`
- Modify: `.env`, `.env.test`, `.env.production`
- Test: boot gateway (`npm exec nx -- serve @org/gateway` стартует без `safeParse` ошибок;
  сломанное значение падает на старте со списком полей — это intended)

**Interfaces:**
- Consumes: ничего.
- Produces: `Env['THROTTLE_ANON_LIMIT']`, `Env['THROTTLE_USER_LIMIT']`,
  `Env['WS_SEND_LIMIT_PER_MIN']`, `Env['MEMBERSHIP_CACHE_TTL_SEC']` для Task 2/4.

- [ ] **Step 1: Добавить поля в схему**

```ts
// рядом с JWT_ полями, стиль как JWT_ACCESS_TOKEN_EXPIRES: z.coerce.number()
THROTTLE_ANON_LIMIT: z.coerce.number().int().min(1),
THROTTLE_USER_LIMIT: z.coerce.number().int().min(1),
WS_SEND_LIMIT_PER_MIN: z.coerce.number().int().min(1),
MEMBERSHIP_CACHE_TTL_SEC: z.coerce.number().int().min(5),
```

- [ ] **Step 2: Добавить значения в три env-файла**

```
THROTTLE_ANON_LIMIT=100
THROTTLE_USER_LIMIT=300
WS_SEND_LIMIT_PER_MIN=30
MEMBERSHIP_CACHE_TTL_SEC=45
```

- [ ] **Step 3: Проверить валидацию**

Run: `npm exec nx -- run @org/core:test 2>&1 | tail -5`
Expected: PASS (или no tests found — тоже ок, схема проверяется boot'ом)

- [ ] **Step 4: Commit (`.env*` заигнорены — коммитим схему + пример)**

```bash
git add libs/backend/core/src/config/env.schema.ts .env.example
git commit -m "feat: throttle and ws send limit env vars"
```

Значения в локальные `.env`, `.env.test`, `.env.production` внести руками
(не коммитятся). Существующим разработчикам после мержа дописать 4 строки
из `.env.example`, иначе boot упадёт fail-fast (intended).

### Task 2: Трекинг троттлера per-user

**Files:**
- Create: `apps/backend/gateway/src/throttle/user-throttle.tracker.ts`
- Create: `apps/backend/gateway/src/throttle/__tests__/user-throttle.tracker.spec.ts`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`
- Modify (по одному декоратору на класс): `apps/backend/gateway/src/controllers/chat.controller.ts`,
  `user.controller.ts`, `media.controller.ts`, `search.controller.ts`,
  `notification.controller.ts`
- Test: `apps/backend/gateway/src/throttle/__tests__/user-throttle.tracker.spec.ts`

**Interfaces:**
- Consumes: `Env` поля из Task 1.
- Produces: трекер `throttleTracker(req): string`; контроллеры чатов/юзеров/
  медиа/поиска/уведомлений под лимитом 300/мин (auth-контроллер остаётся на
  дефолте 100/мин).

Логика трекера (без верификации JWT — auth делает SessionGuard позже;
ключ включает реальный IP, поэтому поддельный sub бьёт только по ведру
атакующего):

- [ ] **Step 1: Написать падающий тест**

```ts
import { throttleTracker } from '../user-throttle.tracker';

const sub = 'user-123';
const jwt = `header.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.sig`;

describe('throttleTracker', () => {
  it('keys authed user by sub and ip', () => {
    expect(
      throttleTracker({ headers: { cookie: `access_token=${jwt}` }, ip: '1.2.3.4' }),
    ).toBe(`user:${sub}:1.2.3.4`);
  });

  it('falls back to ip for anonymous', () => {
    expect(throttleTracker({ headers: {}, ip: '5.6.7.8' })).toBe('ip:5.6.7.8');
  });

  it('falls back to ip for malformed token', () => {
    expect(
      throttleTracker({ headers: { cookie: 'access_token=not.a.jwt' }, ip: '9.9.9.9' }),
    ).toBe('ip:9.9.9.9');
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm exec nx -- test @org/gateway --testPathPattern=user-throttle 2>&1 | tail -5`
Expected: FAIL with "Cannot find module" (файла ещё нет)

- [ ] **Step 3: Минимальная реализация**

```ts
export function throttleTracker(req: {
  headers?: { cookie?: string };
  ip?: string;
}): string {
  const ip = req.ip ?? 'unknown';
  const cookie = req.headers?.cookie ?? '';
  const token = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (token) {
    try {
      const sub = (
        JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64').toString()) as {
          sub?: unknown;
        }
      ).sub;
      if (typeof sub === 'string' && sub.length > 0) return `user:${sub}:${ip}`;
    } catch {
      /* malformed — fall through to ip */
    }
  }
  return `ip:${ip}`;
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npm exec nx -- test @org/gateway --testPathPattern=user-throttle 2>&1 | tail -5`
Expected: PASS, 3/3

- [ ] **Step 5: Подключить в модуле (forRootAsync + getTracker)**

```ts
// gateway.module.ts: заменить ThrottlerModule.forRoot({...}) на:
ThrottlerModule.forRootAsync({
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    throttlers: [
      {
        ttl: 60000,
        limit: config.getOrThrow('THROTTLE_ANON_LIMIT', { infer: true }),
      },
    ],
    getTracker: (req: Record<string, unknown>) =>
      throttleTracker(req as { headers?: { cookie?: string }; ip?: string }),
  }),
}),
```

`{ provide: APP_GUARD, useClass: ThrottlerGuard }` оставить как есть.
Импорт: `import { throttleTracker } from '../throttle/user-throttle.tracker';`

- [ ] **Step 6: Поднять лимит на 5 authed-контроллерах**

В начало каждого класса (после `@Controller(...)`, перед `@UseGuards(...)` если есть)
добавить импорт и декоратор:

```ts
import { Throttle } from '@nestjs/throttler';

@Throttle({
  default: { limit: 300, ttl: 60000 },
})
```

Файлы: `chat.controller.ts`, `user.controller.ts`, `media.controller.ts`,
`search.controller.ts`, `notification.controller.ts`.
`auth.controller.ts` НЕ трогать (остаётся 100/мин — антибрутфорс; там же
действует Redis-лимит 5 попыток логина).

Примечание: значение 300 дублирует `THROTTLE_USER_LIMIT` — декоратор статичен
(без DI), поэтому число захардкожено здесь и покрыто комментарием
`// keep in sync with THROTTLE_USER_LIMIT`. Env остаётся источником для
дефолта (anon) и документации.

- [ ] **Step 7: Существующие gateway-тесты зелёные**

Run: `npm exec nx -- test @org/gateway 2>&1 | tail -5`
Expected: PASS (моки конфига в спеках не затронуты — новые env читаются только
в `forRootAsync` на boot, а спеки контроллеров инстанцируют классы напрямую)

- [ ] **Step 8: Commit**

```bash
git add apps/backend/gateway/src/throttle apps/backend/gateway/src/app/gateway.module.ts apps/backend/gateway/src/controllers/
git commit -m "feat: per-user throttle tracking"
```

### Task 3: Кеш членства в GatewayChatCacheService

**Files:**
- Modify: `apps/backend/gateway/src/cache/gateway-chat-cache.service.ts`
- Create: `apps/backend/gateway/src/cache/__tests__/gateway-membership-cache.spec.ts`
- Test: `apps/backend/gateway/src/cache/__tests__/gateway-membership-cache.spec.ts`

**Interfaces:**
- Consumes: `REDIS_CLIENT` (как остальные методы), TTL из Task 1 применят в Task 4.
- Produces: `isMemberCached(chatId, userId): Promise<boolean | null>`,
  `setMemberCached(chatId, userId, ttlSec): Promise<void>` для Task 4.

Стиль — как существующие методы: silent Redis fallback, в логах только флаги.
Ключ: `membership:{chatId}:{userId}`, значение `'1'`.
TTL-only инвалидация безопасна: chat-service `sendMessage`
(`libs/backend/chat/src/services/chat.service.ts:181`) авторитетно проверяет
`findChatMember` и кидает `ForbiddenException` — протухший кеш даст максимум
`message:send:error`, не чужое сообщение.

- [ ] **Step 1: Написать падающий тест**

```ts
import { GatewayChatCacheService } from '../gateway-chat-cache.service';

describe('GatewayChatCacheService membership', () => {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    del: jest.fn(() => Promise.resolve(1)),
  };

  const svc = new GatewayChatCacheService(redis as never);

  it('misses before set, hits after set', async () => {
    await expect(svc.isMemberCached('c1', 'u1')).resolves.toBeNull();
    await svc.setMemberCached('c1', 'u1', 45);
    await expect(svc.isMemberCached('c1', 'u1')).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('membership:c1:u1', '1', 'EX', 45);
  });

  it('falls back silently on redis failure', async () => {
    const failing = new GatewayChatCacheService({
      get: () => Promise.reject(new Error('down')),
    } as never);
    await expect(failing.isMemberCached('c1', 'u1')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm exec nx -- test @org/gateway --testPathPattern=membership 2>&1 | tail -4`
Expected: FAIL with "isMemberCached is not a function"

- [ ] **Step 3: Минимальная реализация (в конец класса)**

```ts
async isMemberCached(chatId: string, userId: string): Promise<boolean | null> {
  try {
    const raw = await this.redis.get(`membership:${chatId}:${userId}`);
    if (!raw) return null;
    return true;
  } catch {
    return null;
  }
}

async setMemberCached(chatId: string, userId: string, ttlSec: number): Promise<void> {
  try {
    await this.redis.set(`membership:${chatId}:${userId}`, '1', 'EX', ttlSec);
  } catch {
    /* Redis unavailable — caller falls back to RPC */
  }
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npm exec nx -- test @org/gateway --testPathPattern=membership 2>&1 | tail -4`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/cache/
git commit -m "feat: gateway membership cache"
```

### Task 4: Send-path сокета (кеш + лимит + join-ack)

**Files:**
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Modify: `apps/backend/gateway/src/gateways/__tests__/chat.socket-gateway.spec.ts`
  (читать `beforeEach` и `makeSocket` в начале файла, моки зависимостей
  зеркалить оттуда; `chatCache` мокать как `{ isMemberCached: jest.fn(),
  setMemberCached: jest.fn(), invalidateChatPages: jest.fn(),
  invalidateChatList: jest.fn() }`, `config` — объект с
  `getOrThrow: jest.fn((k) => k === 'WS_SEND_LIMIT_PER_MIN' ? 30 :
  k === 'MEMBERSHIP_CACHE_TTL_SEC' ? 45 : (() => { throw new Error(k); })())`)
- Test: тот же spec-файл

**Interfaces:**
- Consumes: методы Task 3, env Task 1, `chat:join` хендлер (строки ~230–250).
- Produces: `chat:joined` ack для клиентов; `RATE_LIMITED` ошибка сокета.

Порядок в `handleSendMessage` (после `if (!userId) return`, до `safeParse`):
рейт-лимит → валидация (как есть) → кеш членства → RPC только при промахе.

- [ ] **Step 1: Добавить ConfigService в конструктор gateway**

```ts
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';
// в конструктор, рядом с остальными:
private readonly config: ConfigService<Env, true>,
```

Проверить что `@org/core` уже импортируется в файле (да: BanMarkerRepository
и др. оттуда) — дописать `Env` в существующий импорт и `ConfigService`
отдельной строкой из `@nestjs/config`.

- [ ] **Step 2: Рейт-лимит отправок (до валидации)**

```ts
const sendKey = `ws_send:${userId}`;
const sends = await this.redis.incr(sendKey).catch(() => 0);
if (sends === 1) {
  await this.redis.expire(sendKey, 60).catch(() => undefined);
}
const sendLimit = this.config.getOrThrow('WS_SEND_LIMIT_PER_MIN', { infer: true });
if (sends > sendLimit) {
  this.logger.warn({
    eventType: 'socket_message_send_rate_limited',
    hasUserId: !!userId,
    hasChatId: !!payload.chatId,
  });
  socket.emit('message:send:error', {
    code: 'RATE_LIMITED',
    message: 'Too many messages, slow down',
    chatId: payload.chatId,
    clientId: payload.clientId ?? null,
  });
  return;
}
```

Фиксированное окно 60с (приблизительный лимит — задокументировать комментарием
`// fixed 60s window, approximate by design`).

- [ ] **Step 3: Кеш членства вместо всегда-RPC**

Заменить блок `CHECK_MEMBERSHIP` (строки ~348–353):

```ts
const ttlSec = this.config.getOrThrow('MEMBERSHIP_CACHE_TTL_SEC', { infer: true });
let isMember = await this.chatCache.isMemberCached(payload.chatId, userId);
if (isMember === null) {
  isMember = await lastValueFrom(
    this.chatClient.send<boolean>(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
      chatId: payload.chatId,
      userId,
    }),
  ).catch(() => false);
  if (isMember) {
    await this.chatCache.setMemberCached(payload.chatId, userId, ttlSec);
  }
}
```

Остальной код (`if (!isMember)` → `FORBIDDEN`) без изменений.

- [ ] **Step 4: Join-ack в handleJoin (после `socket.join`)**

```ts
socket.emit('chat:joined', { chatId: payload.chatId });
```

Строка — сразу после `await socket.join(...)`, до логгирования.

- [ ] **Step 5: Дописать спеки (в существующий spec-файл, стиль `makeSocket`)**

```ts
it('uses cached membership without RPC', async () => {
  chatCache.isMemberCached.mockResolvedValue(true);
  await gateway.handleSendMessage(socket, { chatId: 'c1', type: 'TEXT', text: 'hi' });
  expect(chatClient.send).not.toHaveBeenCalled();
});

it('rate-limits senders over WS_SEND_LIMIT_PER_MIN', async () => {
  redis.incr.mockResolvedValue(31);
  await gateway.handleSendMessage(socket, { chatId: 'c1', type: 'TEXT', text: 'hi' });
  expect(emit).toHaveBeenCalledWith(
    'message:send:error',
    expect.objectContaining({ code: 'RATE_LIMITED', chatId: 'c1' }),
  );
});

it('emits chat:joined after successful join', async () => {
  chatClient.send.mockReturnValue(of(true));
  await gateway.handleJoin(joinSocket, { chatId: 'c1' });
  expect(joinEmit).toHaveBeenCalledWith('chat:joined', { chatId: 'c1' });
});
```

Имена моков (`chatClient`, `redis`, `socket`/`emit`/`joinSocket`/`joinEmit`)
взять из `beforeEach`/`makeSocket` файла — прочитать его перед правкой
и подставить фактические идентификаторы, смысл кейсов не менять.
`redis` мок дополнить `incr: jest.fn().mockResolvedValue(1)` и
`expire: jest.fn().mockResolvedValue(1)`.

- [ ] **Step 6: Запустить спеки**

Run: `npm exec nx -- test @org/gateway --testPathPattern=chat.socket-gateway 2>&1 | tail -5`
Expected: PASS (старые + 3 новых кейса)

- [ ] **Step 7: Commit**

```bash
git add apps/backend/gateway/src/gateways/
git commit -m "feat: ws send membership cache, rate limit, join ack"
```

### Task 5: Сид на 1000 + k6 на join-ack + проверка Ц4

**Files:**
- Modify: `infra/load/seed.mjs` (батчинг регистрации/логина под anon-лимит 100/мин)
- Modify: `infra/load/scenarios/ws-load.js` (ждать `chat:joined` вместо задержки 500мс)
- Test: `bash infra/load/run.sh smoke` + NAT-проверка ниже

**Interfaces:**
- Consumes: Task 2 (anon-лимит), Task 4 (join-ack).
- Produces: воспроизводимая процедура Ц4.

- [ ] **Step 1: Батчинг в seed.mjs**

В register- и login-циклах после каждых 80 запросов вставить паузу 65с.
Точный код:

```js
if ((i + 1) % 80 === 0) {
  console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
  await new Promise((r) => setTimeout(r, 65000));
}
```

Ожидаемое время сида 1000 юзеров: ~13–15 мин. Задокументировать в
`infra/load/README.md` одной строкой:
`SEED_N=1000: ~15 мин из-за anon-лимита 100/мин, паузы автоматические.`

- [ ] **Step 2: ws-load.js ждёт ack**

Заменить задержку 500мс перед `message:send` на ожидание события
`chat:joined` с таймаутом 5с (при таймауте — слать как раньше, пометить флагом).
Убрать комментарий про 500мс-костыль.

- [ ] **Step 3: Smoke + NAT-проверка Ц4**

Run: `bash infra/load/run.sh smoke`
Expected: PASS как раньше.

Run (50 юзеров, человеческий темп, один IP — эмуляция офиса):
`docker run --rm --network host -v "$PWD/infra/load:/scripts" -e BASE_URL=http://localhost:3000 grafana/k6 run --vus 50 --duration 2m /scripts/scenarios/http-load.js`
Expected: `http_req_failed` rate 0.00% и ноль 429 в логе gateway за окно
(`grep -c '429' /tmp/opencode/polygon-dev-all.log` до/после не растёт на этом IP).

- [ ] **Step 4: Commit**

```bash
git add infra/load/
git commit -m "test: seed batching, join-ack wait, NAT acceptance"
```

### Task 6: Верификация Ц2 (1000 писателей)

**Files:** без кода — измерение; результат дописать в `infra/load/README.md`
таблицу `## Results` новой строкой.

**Interfaces:** Consumes: Tasks 1–5.

- [ ] **Step 1: Обновить токены**

Run: `SEED_LOGIN_ONLY=1 node infra/load/seed.mjs`
Expected: `withCookies` = `withChats` = числу юзеров, exit 0

- [ ] **Step 2: Прогон 1000 VU / 3 мин**

Run: `bash infra/load/run.sh ws` (сценарий уже настроен на 100 VU/3 мин —
для Ц2 запустить с оверрайдом:
`docker run --rm --network host -v "$PWD/infra/load:/scripts" -e BASE_URL=http://localhost:3000 grafana/k6 run --vus 1000 --duration 3m /scripts/scenarios/ws-load.js`)
Expected: `message:new` ≥ 99%, threshold `rate>0.99` зелёный

- [ ] **Step 3: Записать факт в README + commit**

```bash
git add infra/load/README.md
git commit -m "test: phase1 WS writers acceptance result"
```

Критерий закрытия фазы: Ц4 зелёный + Ц2 ≥ 99%. Если Ц2 не взят —
не чинить в этой фазе, зафиксировать цифры и передать в Plan 2 (кластер)
как входные данные.
