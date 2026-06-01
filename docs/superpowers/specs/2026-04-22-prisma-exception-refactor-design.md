# Prisma Exception Handling Refactor

## Problem

`AllExceptionsFilter` на гейтвее содержит `PRISMA_CODE_MAP` для маппинга Prisma-ошибок в HTTP-статусы, но Prisma работает только в микросервисах — не в гейтвее. Маппинг никогда не выполняется.

Фактическая цепочка при Prisma-ошибке (например, P2002):

1. Микросервис: Prisma бросает `PrismaClientKnownRequestError`
2. `RpcErrorInterceptor` ловит её в catch-all → оборачивает в `RpcException({ statusCode: 500 })`
3. Гейтвей `send()` → `HttpException(500)`
4. Клиент получает 500 вместо 409

Следствие: дублирование регистрации (P2002) возвращает 500, при этом верификационное письмо может уже уйти.

## Solution

Явное выбрасывание исключений в репозиторном слое через утилиту `handlePrismaError`. `AllExceptionsFilter` удаляется полностью.

## Architecture

**До:**

```
Prisma error → RpcErrorInterceptor (catch-all → 500) → Gateway send() → AllExceptionsFilter (мёртвый маппинг) → 500
```

**После:**

```
Prisma error → handlePrismaError() → NestJS HttpException → RpcErrorInterceptor (корректная обёртка) → Gateway send() → HttpException(правильный статус) → NestJS built-in filter → клиент
```

## Components

### 1. `handlePrismaError` utility

**Файл:** `libs/backend/core/src/prisma/prisma-error.handler.ts`  
**Экспорт:** из `@org/core`

Использует duck-typing для определения Prisma-ошибок (без прямого импорта клиента, т.к. у каждого сервиса свой генерируемый клиент).

Сигнатура: `function handlePrismaError(error: unknown): never`

Маппинг кодов:

| Prisma код                     | NestJS исключение     | HTTP статус |
| ------------------------------ | --------------------- | ----------- |
| P2002                          | `ConflictException`   | 409         |
| P2025                          | `NotFoundException`   | 404         |
| P2003                          | `BadRequestException` | 400         |
| P2014                          | `BadRequestException` | 400         |
| P2000                          | `BadRequestException` | 400         |
| Неизвестный Prisma / не Prisma | re-throw              | —           |

### 2. Изменения в репозиториях

**`auth.prisma.repo.ts`** — добавить `try/catch` + `handlePrismaError`:

| Метод                | Возможная ошибка Prisma            |
| -------------------- | ---------------------------------- |
| `createCredentials`  | P2002 — email unique               |
| `saveRefreshToken`   | P2002 — tokenHash unique           |
| `createOAuthAccount` | P2002 — provider_providerId unique |
| `updatePasswordHash` | P2025 — запись не найдена          |
| `revokeRefreshToken` | P2025 — токен не найден            |
| `verifyCredentials`  | P2025 — credentials не найден      |

**`user.prisma.repo.ts`** — частичная обработка уже есть:

- `update` — заменить ручной `instanceof` на `handlePrismaError`
- `upsert` — **оставить как есть**: P2002 здесь — бизнес-логика (realign id), не HTTP-маппинг

**`chat.prisma.repo.ts`** — добавить `try/catch` + `handlePrismaError`:

| Метод              | Возможная ошибка Prisma      |
| ------------------ | ---------------------------- |
| `addChatMember`    | P2002 — chatId_userId unique |
| `removeChatMember` | P2025 — не найден            |
| `createMessage`    | P2003 — chatId FK            |

**`notification.prisma.repo.ts`** — пропустить (реализация пуста).

### 3. Удаление `AllExceptionsFilter`

- Удалить `libs/backend/core/src/filters/all-exceptions.filter.ts`
- Убрать экспорт из `libs/backend/core/src/index.ts`
- Убрать `app.useGlobalFilters(new AllExceptionsFilter())` из `apps/backend/gateway/src/main.ts`
- Удалить папку `libs/backend/core/src/filters/` (станет пустой)

### 4. Что остаётся без изменений

- `RpcErrorInterceptor` — safety net для непредвиденных ошибок, не трогать
- `send()` хелперы в контроллерах гейтвея — корректно перемаппируют statusCode+message, не трогать
- NestJS built-in `BaseExceptionFilter` — автоматически обрабатывает `HttpException` на гейтвее

## Error Flow After Refactor

**Пример: регистрация с уже занятым email (P2002)**

1. `AuthService.register()` → `repo.createCredentials()` → Prisma бросает P2002
2. `catch (error) { handlePrismaError(error) }` → бросает `ConflictException('Resource already exists')`
3. `RpcErrorInterceptor` ловит `HttpException` → `RpcException({ statusCode: 409, message: '...' })`
4. Gateway `send()` ловит payload → `HttpException('Resource already exists', 409)`
5. NestJS built-in filter → `{ statusCode: 409, message: '...' }` клиенту
