# User Repository Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зачистить мёртвый код в user-service, исправить утечку email через GET /users/:id, восстановить findPublicById, изолировать ORM-детали в репозитории, написать интеграционные тесты.

**Architecture:** Репозиторий возвращает `null` вместо ORM-исключений — сервис работает с доменными типами и не знает про Prisma. `GET /users/:id` переключается на `GET_PUBLIC_BY_ID` → `UserPublic` без email. Закомментированный мёртвый код удаляется насовсем.

**Tech Stack:** NestJS, Prisma (PrismaPg adapter), RabbitMQ паттерны через `@nestjs/microservices`, Jest integration tests, Nx monorepo (`@org` scope).

---

## File Map

| Файл | Действие |
|---|---|
| `libs/backend/core/src/constants/queues/user.queue.ts` | добавить `GET_PUBLIC_BY_ID` в `USER_PATTERNS` |
| `libs/backend/user/src/interfaces/user.interface.ts` | обновить все три интерфейса |
| `libs/backend/user/src/database/repository/user.prisma.repo.ts` | удалить мёртвый код, восстановить `findPublicById`, `update` → `User \| null` |
| `libs/backend/user/src/services/user.service.ts` | восстановить `getPublicById`, исправить `update` |
| `libs/backend/user/src/controllers/user.controller.ts` | добавить хендлер `GET_PUBLIC_BY_ID` |
| `apps/backend/gateway/src/controllers/user.controller.ts` | `GET /users/:id` → `GET_PUBLIC_BY_ID` |
| `libs/backend/user/src/Tests/integration/user.repository.spec.ts` | написать все тест-кейсы |

---

## Task 1: Добавить GET_PUBLIC_BY_ID в core constants

**Files:**
- Modify: `libs/backend/core/src/constants/queues/user.queue.ts`

- [ ] **Открыть файл и добавить паттерн**

```ts
export const USER_QUEUE = 'user_queue';
export const USER_CLIENT_TOKEN = 'USER_CLIENT';

export const USER_PATTERNS = {
  GET_BY_ID: 'user.getById',
  GET_PUBLIC_BY_ID: 'user.getPublicById',
  GET_ALL_PUBLIC: 'user.getAllPublic',
  UPDATE: 'user.update',
} as const;

export const USER_EVENTS = {
  REGISTERED: 'user.registered',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
} as const;
```

- [ ] **Проверить что core собирается**

```bash
npx nx typecheck @org/core --skipNxCache
```

Ожидание: без ошибок.

- [ ] **Commit**

```bash
git add libs/backend/core/src/constants/queues/user.queue.ts
git commit -m "feat(core): add GET_PUBLIC_BY_ID to USER_PATTERNS"
```

---

## Task 2: Обновить интерфейсы

**Files:**
- Modify: `libs/backend/user/src/interfaces/user.interface.ts`

- [ ] **Заменить содержимое файла**

```ts
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { UpdateUserDto } from '../dto/update-user.dto';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findPublicById(id: string): Promise<UserPublic | null>;
  findAllPublic(): Promise<UserPublic[]>;
  upsert(data: CreateUserEventInput): Promise<void>;
  update(id: string, data: UpdateUserInput): Promise<User | null>;
  delete(id: string): Promise<void>;
}

export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<void>;
  getById(id: string): Promise<User>;
  getPublicById(id: string): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
  update(id: string, dto: UpdateUserInput): Promise<User>;
}

export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): Promise<void>;
  getById(payload: { id: string }): Promise<User>;
  getPublicById(payload: { id: string }): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<User>;
}
```

- [ ] **Commit**

```bash
git add libs/backend/user/src/interfaces/user.interface.ts
git commit -m "refactor(user): update repository and service interfaces"
```

---

## Task 3: TDD — update() возвращает null вместо исключения Prisma

**Files:**
- Modify: `libs/backend/user/src/Tests/integration/user.repository.spec.ts`
- Modify: `libs/backend/user/src/database/repository/user.prisma.repo.ts`

- [ ] **Написать падающий тест**

Добавить в `describe('UserPrismaRepository (integration)')`:

```ts
describe('update', () => {
  it('returns null when user does not exist', async () => {
    const result = await repo.update('00000000-0000-0000-0000-000000000000', {
      displayName: 'Ghost',
    });
    expect(result).toBeNull();
  });

  it('updates and returns User when user exists', async () => {
    await repo.upsert({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'a@test.com',
      name: 'Alice',
    });

    const result = await repo.update('11111111-1111-1111-1111-111111111111', {
      displayName: 'Alice Updated',
    });

    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Alice Updated');
    expect(result!.email).toBe('a@test.com');
  });
});
```

- [ ] **Запустить — убедиться что первый тест падает**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: `returns null when user does not exist` — FAIL (Prisma бросает исключение вместо null).

- [ ] **Исправить repo.update — поймать P2025**

В `libs/backend/user/src/database/repository/user.prisma.repo.ts` заменить метод `update`:

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

- [ ] **Запустить — убедиться что оба теста проходят**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: оба теста в `describe('update')` — PASS.

- [ ] **Commit**

```bash
git add libs/backend/user/src/database/repository/user.prisma.repo.ts \
        libs/backend/user/src/Tests/integration/user.repository.spec.ts
git commit -m "refactor(user): update() returns null on not-found instead of throwing Prisma error"
```

---

## Task 4: TDD — восстановить findPublicById

**Files:**
- Modify: `libs/backend/user/src/Tests/integration/user.repository.spec.ts`
- Modify: `libs/backend/user/src/database/repository/user.prisma.repo.ts`

- [ ] **Написать падающий тест**

Добавить в `describe`:

```ts
describe('findPublicById', () => {
  it('returns null when user does not exist', async () => {
    const result = await repo.findPublicById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('returns UserPublic without email', async () => {
    await repo.upsert({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'b@test.com',
      name: 'Bob',
    });

    const result = await repo.findPublicById('22222222-2222-2222-2222-222222222222');

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id', '22222222-2222-2222-2222-222222222222');
    expect(result).toHaveProperty('name', 'Bob');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('createdAt');
  });
});
```

- [ ] **Запустить — убедиться что тесты падают**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: FAIL — `repo.findPublicById is not a function`.

- [ ] **Добавить findPublicById в репозиторий**

Добавить метод после `findById` в `UserPrismaRepository`. Убедиться что импорты включают `USER_PUBLIC_SELECT_FIELDS` и тип `UserPublic`:

```ts
import { USER_PUBLIC_SELECT_FIELDS, USER_SELECT_FIELDS } from '@org/common';
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';
```

Метод:

```ts
async findPublicById(id: string): Promise<UserPublic | null> {
  return this.prisma.user.findUnique({
    where: { id },
    select: USER_PUBLIC_SELECT_FIELDS,
  });
}
```

- [ ] **Запустить — убедиться что тесты проходят**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: все тесты — PASS.

- [ ] **Commit**

```bash
git add libs/backend/user/src/database/repository/user.prisma.repo.ts \
        libs/backend/user/src/Tests/integration/user.repository.spec.ts
git commit -m "feat(user): restore findPublicById to repository"
```

---

## Task 5: Написать оставшиеся интеграционные тесты

**Files:**
- Modify: `libs/backend/user/src/Tests/integration/user.repository.spec.ts`

- [ ] **Добавить тесты для upsert, findById, findAllPublic, delete**

```ts
describe('upsert', () => {
  it('creates a new user', async () => {
    await repo.upsert({
      id: '33333333-3333-3333-3333-333333333333',
      email: 'c@test.com',
      name: 'Carol',
    });

    const user = await repo.findById('33333333-3333-3333-3333-333333333333');
    expect(user).not.toBeNull();
    expect(user!.email).toBe('c@test.com');
    expect(user!.name).toBe('Carol');
  });

  it('is idempotent — repeated call does not throw or duplicate', async () => {
    const data = {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'd@test.com',
      name: 'Dave',
    };
    await repo.upsert(data);
    await expect(repo.upsert(data)).resolves.not.toThrow();

    const all = await repo.findAllPublic();
    expect(all.filter((u) => u.id === data.id)).toHaveLength(1);
  });
});

describe('findById', () => {
  it('returns null when user does not exist', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('returns full User with email when exists', async () => {
    await repo.upsert({
      id: '55555555-5555-5555-5555-555555555555',
      email: 'e@test.com',
      name: 'Eve',
    });

    const result = await repo.findById('55555555-5555-5555-5555-555555555555');

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('email', 'e@test.com');
    expect(result).toHaveProperty('createdAt');
  });
});

describe('findAllPublic', () => {
  it('returns empty array when no users', async () => {
    const result = await repo.findAllPublic();
    expect(result).toEqual([]);
  });

  it('returns all users without email', async () => {
    await repo.upsert({ id: '66666666-6666-6666-6666-666666666666', email: 'f@test.com', name: 'Frank' });
    await repo.upsert({ id: '77777777-7777-7777-7777-777777777777', email: 'g@test.com', name: 'Grace' });

    const result = await repo.findAllPublic();

    expect(result).toHaveLength(2);
    result.forEach((u) => {
      expect(u).not.toHaveProperty('email');
      expect(u).toHaveProperty('id');
      expect(u).toHaveProperty('name');
    });
  });
});

describe('delete', () => {
  it('removes user so findById returns null', async () => {
    await repo.upsert({
      id: '88888888-8888-8888-8888-888888888888',
      email: 'h@test.com',
      name: 'Hank',
    });

    await repo.delete('88888888-8888-8888-8888-888888888888');

    const result = await repo.findById('88888888-8888-8888-8888-888888888888');
    expect(result).toBeNull();
  });
});
```

- [ ] **Запустить все тесты**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: все тесты — PASS.

- [ ] **Commit**

```bash
git add libs/backend/user/src/Tests/integration/user.repository.spec.ts
git commit -m "test(user): add integration tests for all repository methods"
```

---

## Task 6: Удалить мёртвый код из репозитория

**Files:**
- Modify: `libs/backend/user/src/database/repository/user.prisma.repo.ts`

- [ ] **Заменить файл на чистую версию без мёртвого кода**

```ts
import { Injectable } from '@nestjs/common';
import { USER_PUBLIC_SELECT_FIELDS, USER_SELECT_FIELDS } from '@org/common';
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { IUserRepository } from '../../interfaces/user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_FIELDS,
    });
  }

  async findPublicById(id: string): Promise<UserPublic | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT_FIELDS,
    });
  }

  async findAllPublic(): Promise<UserPublic[]> {
    return this.prisma.user.findMany({ select: USER_PUBLIC_SELECT_FIELDS });
  }

  async upsert(data: CreateUserEventInput): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {},
    });
  }

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

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
```

- [ ] **Запустить тесты — убедиться что ничего не сломалось**

```bash
npx nx test @org/user --testFile=user.repository.spec.ts --skipNxCache
```

Ожидание: все тесты — PASS.

- [ ] **Commit**

```bash
git add libs/backend/user/src/database/repository/user.prisma.repo.ts
git commit -m "refactor(user): remove dead code (findByEmail, exists, searchByName)"
```

---

## Task 7: Обновить UserService

**Files:**
- Modify: `libs/backend/user/src/services/user.service.ts`

- [ ] **Заменить содержимое файла**

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';
import { USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type { IUserRepository, IUserService } from '../interfaces/user.interface';

@Injectable()
export class UserService implements IUserService {
  constructor(@Inject(USER_PRISMA_REPOSITORY_TOKEN) private readonly repo: IUserRepository) {}

  async createFromEvent(data: CreateUserEventInput): Promise<void> {
    await this.repo.upsert(data);
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicById(id: string): Promise<UserPublic> {
    const user = await this.repo.findPublicById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAllPublic(): Promise<UserPublic[]> {
    return this.repo.findAllPublic();
  }

  async update(id: string, dto: UpdateUserInput): Promise<User> {
    const user = await this.repo.update(id, dto);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
```

- [ ] **Проверить typecheck**

```bash
npx nx typecheck @org/user --skipNxCache
```

Ожидание: без ошибок.

- [ ] **Commit**

```bash
git add libs/backend/user/src/services/user.service.ts
git commit -m "refactor(user): restore getPublicById, remove exists() usage from update()"
```

---

## Task 8: Добавить хендлер GET_PUBLIC_BY_ID в контроллер микросервиса

**Files:**
- Modify: `libs/backend/user/src/controllers/user.controller.ts`

- [ ] **Заменить содержимое файла**

```ts
import { Controller, Inject } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import type { CreateUserEventInput } from '@org/common';
import { USER_EVENTS, USER_PATTERNS, USER_SERVICE_TOKEN } from '@org/core';

import { UpdateUserDto } from '../dto/update-user.dto';
import type { IUserController, IUserService } from '../interfaces/user.interface';

@Controller()
export class UserController implements IUserController {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  @EventPattern(USER_EVENTS.REGISTERED)
  handleUserRegistered(@Payload() data: CreateUserEventInput) {
    return this.userService.createFromEvent(data);
  }

  @MessagePattern(USER_PATTERNS.GET_BY_ID)
  getById(@Payload() payload: { id: string }) {
    return this.userService.getById(payload.id);
  }

  @MessagePattern(USER_PATTERNS.GET_PUBLIC_BY_ID)
  getPublicById(@Payload() payload: { id: string }) {
    return this.userService.getPublicById(payload.id);
  }

  @MessagePattern(USER_PATTERNS.GET_ALL_PUBLIC)
  getAllPublic() {
    return this.userService.getAllPublic();
  }

  @MessagePattern(USER_PATTERNS.UPDATE)
  update(@Payload() payload: { id: string; dto: UpdateUserDto }) {
    return this.userService.update(payload.id, payload.dto);
  }
}
```

- [ ] **Проверить typecheck и lint**

```bash
npx nx typecheck @org/user --skipNxCache && npx nx lint @org/user --skipNxCache
```

Ожидание: без ошибок.

- [ ] **Commit**

```bash
git add libs/backend/user/src/controllers/user.controller.ts
git commit -m "feat(user): add GET_PUBLIC_BY_ID message pattern handler"
```

---

## Task 9: Исправить утечку email в Gateway

**Files:**
- Modify: `apps/backend/gateway/src/controllers/user.controller.ts`

- [ ] **Переключить GET /users/:id на GET_PUBLIC_BY_ID**

Изменить только метод `getById` (строка с `USER_PATTERNS.GET_BY_ID` → `GET_PUBLIC_BY_ID`). Обновить описание в `@ApiResponse`:

```ts
@Get(':id')
@ApiOperation({ summary: 'Get user profile by ID' })
@ApiParam({ name: 'id', description: 'User UUID' })
@ApiResponse({ status: 200, description: 'User public profile' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 404, description: 'User not found' })
getById(@Param('id') id: string) {
  return this.send(this.userClient.send(USER_PATTERNS.GET_PUBLIC_BY_ID, { id }));
}
```

`getMe` остаётся без изменений — владелец видит свой email через `GET_BY_ID`.

- [ ] **Проверить typecheck и lint**

```bash
npx nx typecheck @org/gateway --skipNxCache && npx nx lint @org/gateway --skipNxCache
```

Ожидание: без ошибок.

- [ ] **Commit**

```bash
git add apps/backend/gateway/src/controllers/user.controller.ts
git commit -m "fix(gateway): GET /users/:id returns UserPublic without email"
```

---

## Task 10: Финальная проверка

- [ ] **Запустить все тесты user lib**

```bash
npx nx test @org/user --skipNxCache
```

Ожидание: все тесты — PASS.

- [ ] **Typecheck и lint по всем затронутым проектам**

```bash
npx nx run-many -t typecheck lint -p @org/user @org/core @org/gateway --skipNxCache
```

Ожидание: без ошибок.
