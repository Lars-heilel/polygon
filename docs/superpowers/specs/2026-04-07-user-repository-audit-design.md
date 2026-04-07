# Design: User Repository Audit & Integration Tests

**Date:** 2026-04-07  
**Scope:** `libs/backend/user`, `libs/backend/core`, `apps/backend/gateway`

---

## Цель

1. Зачистить мёртвый код в user-service репозитории
2. Исправить архитектурные ошибки (email-утечка, нарушение изоляции слоёв)
3. Восстановить незавершённую фичу публичного профиля
4. Написать интеграционные тесты на репозиторий

---

## Архитектурный принцип

Репозиторий полностью изолирует сервис от деталей БД:
- Репо знает про ORM-ошибки (Prisma P2025), скрывает их через `null`
- Сервис работает только с доменными типами и бросает доменные исключения (`NotFoundException`)
- Замена Prisma на любой другой механизм не затрагивает сервис

---

## Изменения по слоям

### `libs/backend/core` — паттерны

Добавить в `USER_PATTERNS`:

```ts
GET_PUBLIC_BY_ID: 'user.getPublicById'
```

`USER_EVENTS.DELETED` уже существует — не трогаем.

---

### `IUserRepository` — финальный интерфейс

```ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findPublicById(id: string): Promise<UserPublic | null>;  // восстановлен
  findAllPublic(): Promise<UserPublic[]>;
  upsert(data: CreateUserEventInput): Promise<void>;
  update(id: string, data: UpdateUserInput): Promise<User | null>;  // null если не найден
  delete(id: string): Promise<void>;  // hard delete, остаётся до реализации soft delete
}
```

**Удалены:** `findByEmail`, `exists`, `searchByName`

---

### `UserPrismaRepository` — реализация

**`findPublicById`** — восстановлен:
```ts
async findPublicById(id: string): Promise<UserPublic | null> {
  return this.prisma.user.findUnique({
    where: { id },
    select: USER_PUBLIC_SELECT_FIELDS,
  });
}
```

**`update`** — возвращает `User | null`, ловит P2025:
```ts
async update(id: string, data: UpdateUserInput): Promise<User | null> {
  try {
    return await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT_FIELDS,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') return null;
    throw e;
  }
}
```

**Удалены:** `findByEmail`, `exists`, `searchByName` (был закомментирован)

---

### `IUserService` — финальный интерфейс

```ts
export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<void>;
  getById(id: string): Promise<User>;
  getPublicById(id: string): Promise<UserPublic>;  // восстановлен
  getAllPublic(): Promise<UserPublic[]>;
  update(id: string, dto: UpdateUserInput): Promise<User>;
}
```

---

### `UserService` — реализация

**`getPublicById`** — восстановлен:
```ts
async getPublicById(id: string): Promise<UserPublic> {
  const user = await this.repo.findPublicById(id);
  if (!user) throw new NotFoundException('User not found');
  return user;
}
```

**`update`** — убирает `exists`, обрабатывает `null`:
```ts
async update(id: string, dto: UpdateUserInput): Promise<User> {
  const user = await this.repo.update(id, dto);
  if (!user) throw new NotFoundException('User not found');
  return user;
}
```

---

### `IUserController` — финальный интерфейс

```ts
export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): Promise<void>;
  getById(payload: { id: string }): Promise<User>;
  getPublicById(payload: { id: string }): Promise<UserPublic>;  // новый
  getAllPublic(): Promise<UserPublic[]>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<User>;
}
```

---

### `UserController` (микросервис) — новый хендлер

```ts
@MessagePattern(USER_PATTERNS.GET_PUBLIC_BY_ID)
getPublicById(@Payload() payload: { id: string }) {
  return this.userService.getPublicById(payload.id);
}
```

---

### Gateway `UserGatewayController`

`GET /users/me` — без изменений, возвращает полного `User` (владелец видит свой email):
```ts
return this.send(this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub }));
```

`GET /users/:id` — переключается на `GET_PUBLIC_BY_ID`, возвращает `UserPublic` (без email):
```ts
return this.send(this.userClient.send(USER_PATTERNS.GET_PUBLIC_BY_ID, { id }));
```

**Важно:** это исправляет утечку email — ранее любой авторизованный пользователь мог узнать email другого через `GET /users/:id`.

---

## Интеграционный тест

**Файл:** `libs/backend/user/src/Tests/integration/user.repository.spec.ts`

Инициализация уже корректна. Добавить тест-кейсы на все активные методы:

| Метод | Сценарии |
|---|---|
| `upsert` | создаёт нового; повторный вызов не дублирует |
| `findById` | находит существующего; возвращает null если нет |
| `findPublicById` | находит; не возвращает email; null если нет |
| `findAllPublic` | возвращает всех; не возвращает email |
| `update` | обновляет поля; возвращает null если id не существует |
| `delete` | удаляет; после findById возвращает null |

Тесты используют реальную БД (`polygon_user` в `.env.test`), `beforeEach` чистит таблицу.

---

## Файлы затронутые изменениями

```
libs/backend/core/src/constants/queues/user.queue.ts
libs/backend/user/src/interfaces/user.interface.ts
libs/backend/user/src/database/repository/user.prisma.repo.ts
libs/backend/user/src/services/user.service.ts
libs/backend/user/src/controllers/user.controller.ts
libs/backend/user/src/Tests/integration/user.repository.spec.ts
apps/backend/gateway/src/controllers/user.controller.ts
```
