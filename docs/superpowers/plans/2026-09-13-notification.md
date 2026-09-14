# notification-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести notification-service к конвенциям рефакторинга: tight-типы Prisma, контракты в `libs/common`, `API_ROUTES`, идемпотентный репозиторий, ноль секретов в логах.

**Architecture:** Вертикальный срез одного сервиса: сначала Prisma (красный `schema.spec.ts` → зелёный), затем zod-контракты в `libs/common`, затем репозиторий → сервис → контроллеры Gateway, в конце фронт-аудит. Чистая перезапись миграций (дроп БД разрешён).

**Tech Stack:** NestJS + Prisma (Postgres 18) + zod (`zod`, `nestjs-zod`), Jest (backend), Nx (`npm exec nx ...` из корня репо).

**Spec:** `docs/superpowers/specs/2026-09-13-notification-design.md`

## Global Constraints

- Все команды Nx — только из корня репо через `npm exec nx ...` (никогда cwd внутри либы — env-валидация упадёт с `NaN`/`undefined`, см. MONOREPO_GOTCHAS §3).
- `npm` эксклюзивно. Не создавать `pnpm-lock.yaml` / `yarn.lock` / `bun.lock`.
- Новые контракты — сначала zod в `libs/common`; backend — `createZodDto`-wrap; фронт — `.extend()`; маршруты только `API_ROUTES` / `CLIENT_ROUTES`.
- Lib-контроллеры — только `@MessagePattern` / `@EventPattern`; HTTP — только Gateway.
- Сервисы бросают RPC-ошибки `{ message, status }`; Gateway маппит в `HttpException`.
- Логи: только presence-флаги (`hasEndpoint: !!endpoint`), `eventType`-цепочки; сырые endpoint/p256dh/auth/userId/email в `log/debug/verbose` запрещены.
- Спеки в `__tests__/` рядом с кодом; моки в `__mocks__`; живых broker/DB/Redis в юнит-прогоне нет.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `libs/backend/notification/src/database/prisma/schema.prisma` (modify) | Tight-типы, убрать лишний unique, `@@map` |
| `libs/backend/notification/src/database/prisma/migrations/*` (rewrite) | Чистые миграции под новую схему (старые директории удалить) |
| `libs/backend/notification/src/database/prisma/__tests__/schema.spec.ts` (exists, red) | Контракт схемы — зеленеет в Task 1, не трогать |
| `libs/common/src/schemas/notification/push-subscription.schema.ts` (create) | `pushSubscriptionSchema`, `pushSubscribeEventSchema`, `pushUnsubscribeEventSchema` |
| `libs/common/src/schemas/notification/send-push.schema.ts` (create) | `sendPushSchema` (title/body/tag/eventType лимиты) |
| `libs/common/src/schemas/notification/index.ts` (create) | Баррель |
| `libs/common/src/schemas/notification/__tests__/push-subscription.schema.spec.ts` (create) | Спеки лимитов |
| `libs/common/src/schemas/notification/__tests__/send-push.schema.spec.ts` (create) | Спеки лимитов |
| `libs/common/src/schemas/index.ts` (modify) | `export * from './notification'` |
| `libs/common/src/constants/routes.ts` (modify) | `API_ROUTES.notifications` |
| `libs/backend/notification/src/dto/push-subscription.dto.ts` (create) | `SubscribePushDto`, `UnsubscribePushDto` через `createZodDto` |
| `libs/backend/notification/src/dto/index.ts` (create) | Баррель |
| `libs/backend/notification/src/index.ts` (modify) | Экспорт dto |
| `libs/backend/notification/src/database/repository/push-subscription.prisma.repo.ts` (modify) | `findUnique` + `upsert` + `deleteByEndpoint` через `deleteMany` |
| `libs/backend/notification/src/database/repository/__tests__/push-subscription.prisma.repo.spec.ts` (create) | Юнит-спеки репозитория (мок `PrismaService`) |
| `libs/backend/notification/src/services/push.service.ts` (modify) | Упростить subscribe на upsert-семантику, сохранить логи без секретов |
| `libs/backend/notification/src/services/__tests__/push.service.spec.ts` (create) | Юнит-спеки идемпотентности |
| `apps/backend/gateway/src/controllers/notification.controller.ts` (modify) | DTO + `ZodValidationPipe`, маршрут из `API_ROUTES` |
| `apps/backend/gateway/src/controllers/__tests__/notification.controller.spec.ts` (modify) | Кейс 400 на невалидном теле |
| Фронт `features-notifications` (audit only) | Заменить хардкод путей на `API_ROUTES.notifications`, если есть |

---

### Task 1: Prisma — зазеленить `schema.spec.ts`

**Files:**
- Modify: `libs/backend/notification/src/database/prisma/schema.prisma`
- Rewrite: `libs/backend/notification/src/database/prisma/migrations/` (удалить `20260702105739_add_push_subscription/`, `20260702110000_add_endpoint_unique/`)
- Test: `libs/backend/notification/src/database/prisma/__tests__/schema.spec.ts` (exists — не трогать)

**Interfaces:**
- Consumes: ничего
- Produces: таблица `push_subscriptions` с нативными типами; все последующие таски полагаются на `userId @db.Uuid`, `endpoint @unique @db.VarChar(2048)`

- [ ] **Step 1: Запустить спек и зафиксировать красный**

Run: `npm exec nx -- test @org/notification --testPathPatterns="schema.spec" --skip-nx-cache`
Expected: FAIL — `stores userId as native UUID` (в схеме нет `@db.Uuid`), `stores every timestamp as TIMESTAMPTZ`, `maps the model to a snake_case table`.

- [ ] **Step 2: Переписать `schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model PushSubscription {
  id        String   @id @default(uuid(7)) @db.Uuid
  userId    String   @db.Uuid
  endpoint  String   @unique @db.VarChar(2048)
  p256dh    String   @db.VarChar(128)
  auth      String   @db.VarChar(128)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@index([userId])
  @@map("push_subscriptions")
}
```

Что изменилось относительно текущей схемы и почему: убран `@@unique([userId, endpoint])` (избыточен при глобально-уникальном `endpoint` — два btree на вставку вместо одного); `userId` — `@db.Uuid` (16 байт вместо 37); строки — tight-`VarChar`; даты — `Timestamptz(3)`; `@@map("push_subscriptions")`.

- [ ] **Step 3: Переписать миграции чисто**

```bash
rm -rf libs/backend/notification/src/database/prisma/migrations/20260702105739_add_push_subscription libs/backend/notification/src/database/prisma/migrations/20260702110000_add_endpoint_unique
```

Затем из корня репо создать миграцию средствами Prisma с конфигом либы (дроп БД разрешён спекой):

```bash
npx prisma migrate dev --name push_subscription_tight_types --config libs/backend/notification/prisma.config.ts
```

Expected: новая директория `migrations/<timestamp>_push_subscription_tight_types/` с `migration.sql`, содержащим `CREATE TABLE "push_subscriptions"` и один `UNIQUE ("endpoint")`.

- [ ] **Step 4: Перегенерировать клиент**

Run: `npm exec nx -- run @org/notification:prisma-generate --skip-nx-cache`
Expected: PASS, `src/database/generated/prisma` обновлён.

- [ ] **Step 5: Прогнать спек**

Run: `npm exec nx -- test @org/notification --testPathPatterns="schema.spec" --skip-nx-cache`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add libs/backend/notification/src/database/prisma/
git commit -m "refactor(notification): tight prisma types, single endpoint unique"
```

---

### Task 2: Контракты в `libs/common`

**Files:**
- Create: `libs/common/src/schemas/notification/push-subscription.schema.ts`
- Create: `libs/common/src/schemas/notification/send-push.schema.ts`
- Create: `libs/common/src/schemas/notification/index.ts`
- Create: `libs/common/src/schemas/notification/__tests__/push-subscription.schema.spec.ts`
- Create: `libs/common/src/schemas/notification/__tests__/send-push.schema.spec.ts`
- Modify: `libs/common/src/schemas/index.ts`

**Interfaces:**
- Consumes: ничего
- Produces: `pushSubscriptionSchema`, `pushSubscribeEventSchema`, `pushUnsubscribeEventSchema`, `sendPushSchema` + инфер-типы `PushSubscriptionInput`, `SendPushInput` (их используют Task 3 DTO и Task 5 сервис)

- [ ] **Step 1: Написать падающие спеки схем**

`libs/common/src/schemas/notification/__tests__/push-subscription.schema.spec.ts`:

```ts
import { pushSubscribeEventSchema, pushSubscriptionSchema } from '../push-subscription.schema';

describe('pushSubscriptionSchema', () => {
  it('accepts a valid subscription', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://push.example.test/a',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }).success,
    ).toBe(true);
  });

  it('rejects an endpoint longer than 2048 characters', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: `https://push.example.test/${'a'.repeat(2048)}`,
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }).success,
    ).toBe(false);
  });

  it('rejects keys longer than 128 characters', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://push.example.test/a',
        p256dh: 'k'.repeat(129),
        auth: 'auth-key',
      }).success,
    ).toBe(false);
  });
});

describe('pushSubscribeEventSchema', () => {
  it('requires a uuid userId', () => {
    expect(
      pushSubscribeEventSchema.safeParse({
        userId: 'not-a-uuid',
        subscription: {
          endpoint: 'https://push.example.test/a',
          p256dh: 'k',
          auth: 'a',
        },
      }).success,
    ).toBe(false);
  });

  it('accepts a uuidv7 userId', () => {
    expect(
      pushSubscribeEventSchema.safeParse({
        userId: '0197f96c-b278-7f64-a32f-d44a57f6726b',
        subscription: {
          endpoint: 'https://push.example.test/a',
          p256dh: 'k',
          auth: 'a',
        },
      }).success,
    ).toBe(true);
  });
});
```

`libs/common/src/schemas/notification/__tests__/send-push.schema.spec.ts`:

```ts
import { sendPushSchema } from '../send-push.schema';

describe('sendPushSchema', () => {
  const base = {
    userId: '0197f96c-b278-7f64-a32f-d44a57f6726b',
    title: 'New message',
    body: 'Hello',
  };

  it('accepts a minimal payload', () => {
    expect(sendPushSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a title longer than 128 characters', () => {
    expect(sendPushSchema.safeParse({ ...base, title: 't'.repeat(129) }).success).toBe(false);
  });

  it('rejects a body longer than 512 characters', () => {
    expect(sendPushSchema.safeParse({ ...base, body: 'b'.repeat(513) }).success).toBe(false);
  });

  it('rejects an unknown eventType', () => {
    expect(sendPushSchema.safeParse({ ...base, eventType: 'SMS' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает (модулей ещё нет)**

Run: `npm exec nx -- test @org/common --testPathPatterns="schemas/notification" --skip-nx-cache`
Expected: FAIL — `Cannot find module '../push-subscription.schema'`.

- [ ] **Step 3: Написать минимальные схемы**

`libs/common/src/schemas/notification/push-subscription.schema.ts`:

```ts
import * as z from 'zod';

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  p256dh: z.string().min(1).max(128),
  auth: z.string().min(1).max(128),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushSubscribeEventSchema = z.object({
  userId: z.uuid(),
  subscription: pushSubscriptionSchema,
});
export type PushSubscribeEventInput = z.infer<typeof pushSubscribeEventSchema>;

export const pushUnsubscribeEventSchema = z.object({
  userId: z.uuid(),
  endpoint: z.url().max(2048),
});
export type PushUnsubscribeEventInput = z.infer<typeof pushUnsubscribeEventSchema>;
```

`libs/common/src/schemas/notification/send-push.schema.ts`:

```ts
import * as z from 'zod';

export const notificationEventTypeSchema = z.enum(['MESSAGE', 'CALL_INCOMING', 'CALL_MISSED']);
export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;

export const sendPushSchema = z.object({
  userId: z.uuid(),
  title: z.string().min(1).max(128),
  body: z.string().min(1).max(512),
  icon: z.url().max(2048).optional(),
  tag: z.string().max(128).optional(),
  eventType: notificationEventTypeSchema.optional(),
});
export type SendPushInput = z.infer<typeof sendPushSchema>;
```

`libs/common/src/schemas/notification/index.ts`:

```ts
export * from './push-subscription.schema';
export * from './send-push.schema';
```

В `libs/common/src/schemas/index.ts` добавить строкой после `export * from './admin';`:

```ts
export * from './notification';
```

Примечание: `z.uuid()` версийно-агностичен и принимает v7 (зафиксировано существующим
`uuidv7-ids.spec.ts`-подходом в chat-схемах) — отдельная v7-валидация не нужна.

- [ ] **Step 4: Прогнать спеки**

Run: `npm exec nx -- test @org/common --testPathPatterns="schemas/notification" --skip-nx-cache`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/common/src/schemas/notification libs/common/src/schemas/index.ts
git commit -m "feat(common): notification push contracts with tight limits"
```

---

### Task 3: `API_ROUTES.notifications` + Gateway-контроллер на DTO

**Files:**
- Modify: `libs/common/src/constants/routes.ts`
- Create: `libs/backend/notification/src/dto/push-subscription.dto.ts`
- Create: `libs/backend/notification/src/dto/index.ts`
- Modify: `libs/backend/notification/src/index.ts`
- Modify: `apps/backend/gateway/src/controllers/notification.controller.ts`
- Modify: `apps/backend/gateway/src/controllers/__tests__/notification.controller.spec.ts`

**Interfaces:**
- Consumes: `pushSubscriptionSchema`, `pushUnsubscribeEventSchema` из Task 2
- Produces: `SubscribePushDto`, `UnsubscribePushDto` (используются Gateway-контроллером); `API_ROUTES.notifications.*` (использует фронт-аудит в Task 7)

- [ ] **Step 1: Добавить роут-константы**

В `libs/common/src/constants/routes.ts`, после блока `search`:

```ts
notifications: {
  root: 'notifications/push',
  pushSubscribe: 'notifications/push/subscribe',
  pushUnsubscribe: 'notifications/push/unsubscribe',
  vapidKey: 'notifications/push/vapid-key',
},
```

- [ ] **Step 2: Написать DTO либы**

`libs/backend/notification/src/dto/push-subscription.dto.ts`:

```ts
import { pushSubscriptionSchema, pushUnsubscribeEventSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class SubscribePushDto extends createZodDto(pushSubscriptionSchema) {}
export class UnsubscribePushDto extends createZodDto(
  pushUnsubscribeEventSchema.pick({ endpoint: true }),
) {}
```

`libs/backend/notification/src/dto/index.ts`:

```ts
export * from './push-subscription.dto';
```

В `libs/backend/notification/src/index.ts` добавить:

```ts
export * from './dto';
```

- [ ] **Step 3: Перевести Gateway-контроллер на DTO + `ZodValidationPipe` + `API_ROUTES`**

Точные правки `apps/backend/gateway/src/controllers/notification.controller.ts`:
1. `@Controller('notifications/push')` → `@Controller(API_ROUTES.notifications.root)` — хардкода строк не остаётся.
2. `@Post('subscribe')` → `@Post('subscribe')` оставить (суффикс), тело — `@Body() body: SubscribePushDto` + `ZodValidationPipe` на методе через `@UsePipes(new ZodValidationPipe(SubscribePushDto))` — по образцу `auth.controller.ts`, который уже импортит `ZodValidationPipe` из `nestjs-zod` и DTO из `@org/auth`.
3. `@Delete('unsubscribe')` — тело `@Body() body: UnsubscribePushDto` + тот же pipe.
4. Лог-политика без изменений: в логах остаются только `hasEndpoint/hasP256dh/hasAuth` (сырые значения уже запрещены существующим спеком).

- [ ] **Step 4: Добавить в существующий gateway-спек кейс 400**

В `apps/backend/gateway/src/controllers/__tests__/notification.controller.spec.ts` добавить:

```ts
it('rejects an oversized endpoint at the validation layer', async () => {
  const pipe = new ZodValidationPipe(SubscribePushDto);
  await expect(
    pipe.transform(
      {
        endpoint: `https://push.example.test/${'a'.repeat(2048)}`,
        p256dh: 'k',
        auth: 'a',
      },
      { type: 'body', metatype: SubscribePushDto },
    ),
  ).rejects.toThrow();
});
```

Импорты в спеке: `import { ZodValidationPipe } from 'nestjs-zod';`, `import { SubscribePushDto } from '@org/notification';`.

- [ ] **Step 5: Прогнать тесты common + gateway**

Run: `npm exec nx -- test @org/common --skip-nx-cache`
Expected: PASS.

Run: `npm exec nx -- test @org/gateway --testPathPatterns="notification.controller.spec" --skip-nx-cache`
Expected: PASS (3/3: два старых кейса без секретов в логах + новый 400-кейс).

- [ ] **Step 6: Commit**

```bash
git add libs/common/src/constants/routes.ts libs/backend/notification/src/dto libs/backend/notification/src/index.ts apps/backend/gateway/src/controllers/notification.controller.ts apps/backend/gateway/src/controllers/__tests__/notification.controller.spec.ts
git commit -m "refactor(notification): gateway push endpoints on zod DTOs and API_ROUTES"
```

---

### Task 4: Репозиторий — `findUnique` + upsert-идемпотентность

**Files:**
- Modify: `libs/backend/notification/src/database/repository/push-subscription.prisma.repo.ts`
- Test: `libs/backend/notification/src/database/repository/__tests__/push-subscription.prisma.repo.spec.ts` (create)

**Interfaces:**
- Consumes: таблица `push_subscriptions` из Task 1 (`endpoint @unique`)
- Produces: `upsertByEndpoint(data)` — использует Task 5; сигнатуру `IPushSubscriptionRepository` расширить методом `upsertByEndpoint(data: PushSubscriptionData & { userId: string }): Promise<PushSubscriptionRecord>` (править `src/interfaces/notification.interface.ts` в этом же таске)

- [ ] **Step 1: Написать падающий спек репозитория**

```ts
jest.mock('@org/core', () => ({
  handlePrismaError: (error: unknown) => {
    throw error;
  },
}));

import type { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionPrismaRepository } from '../push-subscription.prisma.repo';

describe('PushSubscriptionPrismaRepository', () => {
  const pushSubscription = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const prisma = { pushSubscription };
  const repository = new PushSubscriptionPrismaRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('looks up endpoint with findUnique on the unique key', async () => {
    pushSubscription.findUnique.mockResolvedValue(null);
    await repository.findByEndpoint('https://push.example.test/a');
    expect(pushSubscription.findUnique).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
    });
    expect(pushSubscription.findFirst).toBeUndefined();
  });

  it('upserts on endpoint so redelivery never duplicates', async () => {
    const record = {
      id: 'sub-1',
      userId: 'user-1',
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
      createdAt: new Date('2026-09-13T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    };
    pushSubscription.upsert.mockResolvedValue(record);
    await expect(
      repository.upsertByEndpoint({
        userId: 'user-1',
        endpoint: 'https://push.example.test/a',
        p256dh: 'k',
        auth: 'a',
      }),
    ).resolves.toEqual(record);
    expect(pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
      update: { userId: 'user-1', p256dh: 'k', auth: 'a' },
      create: {
        userId: 'user-1',
        endpoint: 'https://push.example.test/a',
        p256dh: 'k',
        auth: 'a',
      },
    });
  });

  it('deletes by endpoint with a single deleteMany', async () => {
    pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    await repository.deleteByEndpoint('https://push.example.test/a');
    expect(pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.test/a' },
    });
  });
});
```

Мок `@org/core` — по образцу `media.prisma.repo.spec.ts` (тот же приём).

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npm exec nx -- test @org/notification --testPathPatterns="push-subscription.prisma.repo.spec" --skip-nx-cache`
Expected: FAIL — `repository.upsertByEndpoint is not a function`, `findUnique` не вызывается.

- [ ] **Step 3: Минимальная реализация**

В `src/interfaces/notification.interface.ts` добавить в `IPushSubscriptionRepository`:

```ts
upsertByEndpoint(data: PushSubscriptionData & { userId: string }): Promise<PushSubscriptionRecord>;
```

В `push-subscription.prisma.repo.ts` заменить `findByEndpoint`/`deleteByEndpoint` и добавить `upsertByEndpoint`:

```ts
async findByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null> {
  return this.prisma.pushSubscription.findUnique({ where: { endpoint } });
}

async upsertByEndpoint(
  data: PushSubscriptionData & { userId: string },
): Promise<PushSubscriptionRecord> {
  return this.prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    update: { userId: data.userId, p256dh: data.p256dh, auth: data.auth },
    create: data,
  });
}

async deleteByEndpoint(endpoint: string): Promise<void> {
  await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
```

`create` и `delete(id)` оставить без изменений (используются другими путями).

- [ ] **Step 4: Прогнать спек**

Run: `npm exec nx -- test @org/notification --testPathPatterns="push-subscription.prisma.repo.spec" --skip-nx-cache`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add libs/backend/notification/src/database/repository/ libs/backend/notification/src/interfaces/
git commit -m "refactor(notification): upsert-by-endpoint repository, unique lookups"
```

---

### Task 5: Сервис — subscribe через upsert, спеки идемпотентности и тишины логов

**Files:**
- Modify: `libs/backend/notification/src/services/push.service.ts`
- Test: `libs/backend/notification/src/services/__tests__/push.service.spec.ts` (create)

**Interfaces:**
- Consumes: `upsertByEndpoint` из Task 4
- Produces: `PushService.subscribe/unsubscribe/send` с теми же сигнатурами (контроллеры не меняются)

- [ ] **Step 1: Написать падающие спеки сервиса**

```ts
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';

import type {
  IPushSubscriptionRepository,
  PushSubscriptionRecord,
} from '../../interfaces/notification.interface';
import { PushService } from '../push.service';

const record = (overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord => ({
  id: 'sub-1',
  userId: 'user-1',
  endpoint: 'https://push.example.test/a',
  p256dh: 'k',
  auth: 'a',
  createdAt: new Date('2026-09-13T00:00:00.000Z'),
  updatedAt: new Date('2026-09-13T00:00:00.000Z'),
  ...overrides,
});

describe('PushService', () => {
  let repo: {
    findByUserId: jest.Mock;
    findByEndpoint: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteByEndpoint: jest.Mock;
    upsertByEndpoint: jest.Mock;
  };
  let service: PushService;
  let logger: { log: jest.Mock; warn: jest.Mock; debug: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteByEndpoint: jest.fn(),
      upsertByEndpoint: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'public';
        if (key === 'VAPID_PRIVATE_KEY') return 'private';
        if (key === 'VAPID_SUBJECT') return 'mailto:test@example.test';
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };
    service = new PushService(
      repo as unknown as IPushSubscriptionRepository,
      config as unknown as ConfigService<Env>,
    );
    logger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it('subscribes with a single upsert so redelivery is safe', async () => {
    repo.upsertByEndpoint.mockResolvedValue(record());
    await service.subscribe('user-1', {
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
    });
    expect(repo.upsertByEndpoint).toHaveBeenCalledWith({
      userId: 'user-1',
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
    });
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('unsubscribes only its own endpoint', async () => {
    repo.findByEndpoint.mockResolvedValue(record({ userId: 'other' }));
    await service.unsubscribe('user-1', 'https://push.example.test/a');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('never writes raw identifiers to logs', async () => {
    repo.upsertByEndpoint.mockResolvedValue(record());
    await service.subscribe('user-secret-id', {
      endpoint: 'https://push.example.test/secret-endpoint',
      p256dh: 'p256dh-secret-key',
      auth: 'auth-secret-key',
    });
    const payload = JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.debug.mock.calls,
      logger.error.mock.calls,
    ]);
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('secret-endpoint');
    expect(payload).not.toContain('p256dh-secret-key');
    expect(payload).not.toContain('auth-secret-key');
  });
});
```

Примечание: мок `ConfigService` нужен, потому что конструктор `PushService`
(`push.service.ts:24-28`) вызывает `getOrThrow` для VAPID-ключей и `setVapidDetails` —
без него инстанцирование упадёт.

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npm exec nx -- test @org/notification --testPathPatterns="services/__tests__/push.service.spec" --skip-nx-cache`
Expected: FAIL — текущий `subscribe` зовёт `findByEndpoint`+`create`, а не `upsertByEndpoint`; лог-спек падает на `userId=${userId}` и `endpoint.slice` в `logger.log`.

- [ ] **Step 3: Минимальная реализация сервиса**

Заменить тело `subscribe` в `push.service.ts` (строки 31-46) на:

```ts
async subscribe(userId: string, data: PushSubscriptionData): Promise<void> {
  this.logger.log('Service: subscribe() requested');
  await this.repo.upsertByEndpoint({ ...data, userId });
  this.logger.log('Service: subscribe() done');
}
```

Заменить лог-строки в `unsubscribe` (`push.service.ts:48-61`) на версии без интерполяции
идентификаторов:

```ts
async unsubscribe(userId: string, endpoint: string): Promise<void> {
  this.logger.log('Service: unsubscribe() requested');
  const sub = await this.repo.findByEndpoint(endpoint);
  if (sub) {
    if (sub.userId === userId) {
      await this.repo.delete(sub.id);
      this.logger.log('Service: unsubscribe() done');
    } else {
      this.logger.warn('Service: unsubscribe() — endpoint owned by another user, skipping');
    }
  } else {
    this.logger.log('Service: unsubscribe() — nothing found');
  }
}
```

В `send` (`push.service.ts:63-106`) убрать интерполяции `userId`/`endpoint` из всех
`logger.log/warn/debug/error`, оставив счётчики (`subscriptionsFound`, `sent`, `failed`)
и `statusCode` — по образцу: `this.logger.log('Service: send() done')` плюс числа.
Структуру `try/catch`, удаление при 410 и `PushResult[]` не трогать.

Диагностическая достаточность сохраняется через счётчики и `eventType`-цепочки в
контроллерах (`push.controller.ts` уже пишет `*_requested → *_done`); сырые значения
больше нигде не нужны.

- [ ] **Step 4: Прогнать спеки сервиса**

Run: `npm exec nx -- test @org/notification --testPathPatterns="services/__tests__/push.service.spec" --skip-nx-cache`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add libs/backend/notification/src/services/
git commit -m "refactor(notification): upsert subscribe, secret-free service logs"
```

---

### Task 6: Контроллеры lib — верификация без изменений + gateway-регрессия

**Files:**
- Verify only: `libs/backend/notification/src/controllers/push.controller.ts`, `libs/backend/notification/src/controllers/notification.controller.ts`
- Test: расширить `apps/backend/gateway/src/controllers/__tests__/notification.controller.spec.ts` (уже тронут в Task 3)

**Interfaces:**
- Consumes: сигнатуры `PushService` из Task 5 (не менялись)
- Produces: ничего нового

- [ ] **Step 1: Проверить, что lib-контроллеры не требуют правок**

Убедиться чтением: все пять хендлеров — `@EventPattern` (`PUSH_SUBSCRIBE`, `PUSH_UNSUBSCRIBE`,
`SEND_PUSH`, `SEND_VERIFICATION_EMAIL`, `SEND_PASSWORD_RESET`), сигнатуры совпадают с
неизменёнными методами сервисов. Правок нет. Исключение: если в `push.controller.ts:16,23,30`
лог-строки с `payload.userId`/`endpoint.slice` сочтены секретами — заменить на
`eventType`-объекты (`{ eventType: 'push_subscribe_request' }`) в этом же таске и покрыть
спеком по образцу gateway-спека «does not write raw identifiers».

- [ ] **Step 2: Прогнать все тесты затронутых проектов**

Run: `npm exec nx -- test @org/notification --skip-nx-cache`
Expected: PASS.

Run: `npm exec nx -- test @org/gateway --testPathPatterns="notification.controller.spec" --skip-nx-cache`
Expected: PASS.

- [ ] **Step 3: Commit (только если были правки логов контроллера)**

```bash
git add libs/backend/notification/src/controllers/
git commit -m "refactor(notification): secret-free controller logs"
```

Если правок не было — коммита нет, шаг пропускается.

---

### Task 7: Фронт-аудит `features-notifications` (без новой UI)

**Files:**
- Audit: `libs/client/features/notifications/src/**/*.{ts,tsx}` (только чтение + точечные правки)

- [ ] **Step 1: Найти хардкод путей**

Run: `rg -n "notifications/push" libs/client apps/client`
Expected: либо пусто (уже через константы), либо список мест для замены.

- [ ] **Step 2: Заменить на `API_ROUTES.notifications`**

Каждую найденную строку вида `authedFetch('notifications/push/...')` заменить на
`authedFetch(API_ROUTES.notifications.pushSubscribe)` (соответственно `pushUnsubscribe`,
`vapidKey`) с импортом `import { API_ROUTES } from '@org/common';`. Поведение и UI не менять.

- [ ] **Step 3: Прогнать клиентские тесты затронутого пакета**

Run: `npm exec nx -- test @org/features-notifications --skip-nx-cache`
Expected: PASS (или «No tests found» — тогда только `tsc`/lint пакета; отсутствие тестов
фиксируется как известный пробел, новые тесты в этом таске не пишутся — вне скоупа спеки).

- [ ] **Step 4: Commit (только если были замены)**

```bash
git add libs/client/features/notifications
git commit -m "refactor(notification): frontend push calls on API_ROUTES"
```

---

## Execution notes (fact, 2026-09-13)

- Jest в репо принимает только `--testPathPatterns` (старый флаг удалён).
- После добавления межпакетных импортов нужен `npm exec nx -- sync` (дважды: первый прогон
  применяет, второй подтверждает `All files are up to date`); sync-правки tsconfig коммитятся
  вместе с таском. У `@org/notification` нет `build`-таргета — только `prisma-generate` + `test`.
- `ZodValidationPipe.transform` бросает синхронно → в спеках `expect(() => ...).toThrow()`,
  схема резолвится из `metatype` (`new ZodValidationPipe()` без аргументов).
- `PushService` в конструкторе валидирует VAPID через настоящий `web-push` → в спеках
  `jest.mock('web-push', ...)` обязателен.
- Спеки lib-контроллеров должны мокать `@org/core` фабрикой с `NOTIFICATION_EVENTS`,
  иначе тянется ESM `meilisearch` и сьюит не парсится (паттерн как в `media.prisma.repo.spec.ts`).
- `npx prisma migrate dev` при удалённых миграциях требует `prisma migrate reset --force`
  (дроп dev-БД разрешён спекой).

---

### Task 8: Финальная верификация

- [ ] **Step 1: Все затронутые тесты из корня**

Run: `npm exec nx -- affected --target=test --skip-nx-cache`
Expected: PASS. (Запускать строго из корня репо — см. Global Constraints.)

- [ ] **Step 2: Формат**

Run: `npm run format:check`
Expected: PASS (при FAIL — `npx nx format:write`, затем повтор).

- [ ] **Step 3: Доложить**

Вывод исполнителя: список коммитов, результаты `affected/test` и `format:check`,
известные пробелы (например, отсутствие клиентских тестов в Task 7).
