# Testing Guide — Polygon

Что, чем и на каком уровне тестируем в этом проекте.

---

## Уровни тестирования

```
E2E (Playwright)
  ↑ самые медленные, ловят интеграционные проблемы между слоями
Integration
  ↑ реальные зависимости (DB, Redis), но изолированный сервис
Unit
  ↑ самые быстрые, всё снаружи — mock
```

---

## Frontend

### Что является бизнес-логикой на фронте?

```
libs/client/features/src/lib/auth/model/
  use-login.ts         ← бизнес-логика: навигация, стор, error handling
  use-register.ts
  use-logout.ts
  ...

libs/client/entities/src/lib/
  user/user.api.ts     ← API-слой: React Query мутации/запросы
  session/session.store.ts  ← стейт: Zustand
  api/authed-fetch.ts  ← инфра: auto-refresh логика
```

Компоненты (`ui/`) — это **представление**. Они рендерят то что получают через пропсы/хуки.
Хуки (`model/`) — это **бизнес-логика**. Вот что покрываем unit тестами.

### Unit тесты (Vitest + React Testing Library)

**Что тестируем:**

- Хуки (`use-login`, `use-register`, `use-logout`, `use-forgot-password`)
- Компоненты (рендер, валидация форм, error states)
- `authedFetch` (refresh логика, mutex, 401 handling)
- Zustand store (`session.store`)

**Чем мокируем:**

- HTTP запросы → **MSW** (Mock Service Worker) — перехватывает `fetch` на уровне сети
- Навигацию → `MemoryRouter` из react-router или `vi.mock('react-router')`
- Zustand store → реальный стор (он лёгкий, мокать не нужно)

**Пример структуры:**

```
libs/client/features/src/lib/auth/__tests__/
  use-login.spec.ts          ← хук
  use-login.integration.spec.ts  ← хук + реальный MSW сервер
  login-form.spec.tsx        ← компонент
```

**Пример теста хука:**

```ts
// use-login.spec.ts
import { act, renderHook } from '@testing-library/react';
// MSW server
import { HttpResponse, http } from 'msw';

import { server } from '../../test/server';

test('sets isAuthenticated on success', async () => {
  server.use(http.post('/api/auth/login', () => HttpResponse.json(null, { status: 201 })));

  const { result } = renderHook(() => useLogin(), { wrapper: Providers });

  await act(async () => {
    await result.current.login({ email: 'a@b.com', password: '123' });
  });

  expect(useSessionStore.getState().isAuthenticated).toBe(true);
});

test('shows error toast on 401', async () => {
  server.use(http.post('/api/auth/login', () => HttpResponse.json(null, { status: 401 })));
  // проверяем что toast вызван с нужным сообщением
});

test('shows rate limit message on 429', async () => {
  server.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json({ message: 'Too many attempts' }, { status: 429 }),
    ),
  );
  // этот тест УПАДЁТ сейчас — документирует ISSUE-1
});
```

**Пример теста компонента:**

```tsx
// login-form.spec.tsx
test('shows validation error on empty email', async () => {
  render(<LoginForm onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(screen.getByText(/email/i)).toBeVisible();
});
```

**Инструменты:**
| Инструмент | Роль |
|---|---|
| **Vitest** | Test runner |
| **@testing-library/react** | Рендер компонентов, `renderHook` |
| **@testing-library/user-event** | Симуляция кликов, ввода |
| **MSW** | Mock HTTP запросов (уже настроен в entities) |

---

## Backend — Gateway Controllers

### Что такое Gateway Controller?

Gateway — тонкий слой: принять HTTP → проверить guard → отправить в RabbitMQ → вернуть ответ.
Там **нет бизнес-логики**. Тестировать как unit (мокая всё) смысла мало — там нечего тестировать.

**Правильный уровень: Integration** (NestJS module test + mock RabbitMQ)

Поднимаем NestJS модуль через `@nestjs/testing`, мокируем только `ClientProxy` (брокер), реальный HTTP через `supertest`.

```ts
// auth.controller.integration.spec.ts
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('POST /auth/login', () => {
  let app: INestApplication;
  let authClient: { send: jest.Mock };

  beforeAll(async () => {
    authClient = { send: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [AuthGatewayController],
      providers: [
        { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
        { provide: ConfigService, useValue: mockConfig },
        LocalStrategy,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  test('sets cookies on successful login', async () => {
    authClient.send
      .mockReturnValueOnce(of({ id: 'user-1', role: 'USER', isVerified: true })) // validate-creds
      .mockReturnValueOnce(of({ accessToken: 'acc', refreshToken: 'ref' })); // login

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: '123' })
      .expect(201);

    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=acc'),
        expect.stringContaining('refresh_token=ref'),
      ]),
    );
  });

  test('returns 401 on invalid credentials', async () => {
    authClient.send.mockReturnValueOnce(throwError(() => new UnauthorizedException()));

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' })
      .expect(401);
  });
});
```

**Что проверяем в gateway тестах:**

- Правильные cookies выставляются (httpOnly, SameSite)
- Правильные RabbitMQ паттерны вызываются в нужном порядке
- HTTP статусы прокидываются корректно (401, 429, 201)
- Guards работают (LocalGuard, JwtGuard)

---

## Backend — Services (Unit)

Сервисы содержат всю бизнес-логику. Мокируем репо, Redis, TokenService.

```ts
// auth.service.spec.ts
describe('AuthService.validateCredentials', () => {
  let service: AuthService;
  let repo: DeepMockProxy<IAuthRepo>;
  let redis: DeepMockProxy<RedisService>;
  let encryption: DeepMockProxy<EncryptionService>;

  beforeEach(() => {
    repo = mockDeep<IAuthRepo>();
    redis = mockDeep<RedisService>();
    encryption = mockDeep<EncryptionService>();
    service = new AuthService(repo, redis, encryption, tokenService, config);
  });

  test('returns payload on valid credentials', async () => {
    redis.incr.mockResolvedValue(1);
    repo.findByEmail.mockResolvedValue(mockCredentials({ isVerified: true }));
    encryption.compare.mockResolvedValue(true);

    const result = await service.validateCredentials('a@b.com', 'pass');

    expect(result).toEqual({ id: mockCredentials().id, role: 'USER', isVerified: true });
    expect(redis.del).toHaveBeenCalledWith(`login_attempts:a@b.com`);
  });

  test('throws 401 on wrong password', async () => {
    redis.incr.mockResolvedValue(1);
    repo.findByEmail.mockResolvedValue(mockCredentials({ isVerified: true }));
    encryption.compare.mockResolvedValue(false); // wrong password

    await expect(service.validateCredentials('a@b.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(redis.del).not.toHaveBeenCalled(); // счётчик не сбрасывается
  });

  test('throws 429 after 5 failed attempts', async () => {
    redis.incr.mockResolvedValue(6); // 6-я попытка

    await expect(service.validateCredentials('a@b.com', 'pass')).rejects.toThrow(HttpException); // 429
  });

  test('throws 401 for unverified email', async () => {
    redis.incr.mockResolvedValue(1);
    repo.findByEmail.mockResolvedValue(mockCredentials({ isVerified: false }));
    encryption.compare.mockResolvedValue(true);

    await expect(service.validateCredentials('a@b.com', 'pass')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

**Что тестируем в сервисах:**

- Вся бизнес-логика (ветки if/else)
- Rate limiting (граничные значения: 5, 6, сброс)
- Token refresh rotation (replay attack, revoked token)
- Что вызывается в репо и в каком порядке
- Что НЕ вызывается (например, `redis.del` при неудаче)

**Мокаем через:** `jest-mock-extended` / `mockDeep` — типобезопасные моки

---

## Backend — Repositories (Integration)

Репо тестируем с **реальной базой данных**. Юнит-тест репо бессмысленен — там нечего тестировать без БД, это просто Prisma запросы.

**Подход: тестовая БД через Docker**

```ts
// auth.repo.integration.spec.ts
// Запускаем отдельную postgres для тестов

describe('AuthPrismaRepo', () => {
  let repo: AuthPrismaRepo;
  let prisma: PrismaService;

  beforeAll(async () => {
    // подключаемся к test БД (DATABASE_URL из .env.test)
    prisma = new PrismaService({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    repo = new AuthPrismaRepo(prisma);
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.credentials.deleteMany();  // clean slate
  });

  test('findByEmail returns null when not found', async () => {
    const result = await repo.findByEmail('nonexistent@test.com');
    expect(result).toBeNull();
  });

  test('saveRefreshToken stores hash', async () => {
    const creds = await repo.createCredentials({ email: 'a@b.com', passwordHash: 'hash', ... });
    await repo.saveRefreshToken({ tokenHash: 'abc123', credentialsId: creds.id, expiresAt: futureDate });

    const stored = await repo.findRefreshToken('abc123');
    expect(stored).not.toBeNull();
    expect(stored?.revokedAt).toBeNull();
  });

  test('revokeRefreshToken sets revokedAt', async () => {
    // ... setup + revoke + verify revokedAt is set
  });
});
```

**Что тестируем в репо:**

- CRUD операции правильно работают
- Уникальные ограничения (дубликат email → ошибка)
- Nullable поля корректны
- Cascade delete/update работают

---

## E2E — Playwright

### Что такое E2E тест в Playwright

Playwright открывает **реальный браузер** и взаимодействует с приложением как пользователь.
В нашем проекте E2E используют **mock API** через `page.route()` — браузер реальный, но HTTP запросы перехватываются.

Это даёт:

- Реальный браузер (cookies, navigation, forms)
- Без необходимости поднимать весь бэкенд для каждого теста
- Быстрее чем полный стек E2E

### Структура теста

```ts
// apps/client/messenger-e2e/src/auth/login.spec.ts
import { expect, test } from '@playwright/test';

// Хелпер для мока API
function mockLogin(page: Page, status: number, body?: object) {
  return page.route('**/api/auth/login', (route) =>
    route.fulfill({ status, body: body ? JSON.stringify(body) : '' }),
  );
}

// Хелпер заполнения формы
async function fillLoginForm(page: Page, email = 'user@test.com', password = 'Password1!') {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
}
```

### Как работает `page.route()`

```ts
// Перехватить запрос и вернуть нужный ответ
await page.route('**/api/auth/login', (route) => {
  route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'ok' }),
    headers: {
      'Set-Cookie': 'access_token=fake_token; Path=/; HttpOnly',
    },
  });
});

// Перехватить и пропустить дальше (к реальному серверу)
await page.route('**/api/auth/login', (route) => route.continue());

// Посмотреть что отправил браузер
await page.route('**/api/auth/login', (route) => {
  const body = route.request().postDataJSON();
  console.log(body); // { email, password }
  route.continue();
});
```

### Полный пример login.spec.ts

```ts
import { type Page, expect, test } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────
async function fillAndSubmit(page: Page, email: string, password: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function mockMe(page: Page, success = true) {
  await page.route('**/api/users/me', (route) =>
    success
      ? route.fulfill({ status: 200, body: JSON.stringify({ id: '1', email: 'u@t.com' }) })
      : route.fulfill({ status: 401 }),
  );
}

// ── tests ─────────────────────────────────────────────────────
test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    // По умолчанию /users/me возвращает 401 (не залогинен)
    await mockMe(page, false);
    await page.goto('/auth/login');
  });

  test('happy path — redirects to /chats on success', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({ status: 201 }));
    await mockMe(page, true); // после логина /me вернёт пользователя

    await fillAndSubmit(page, 'user@test.com', 'Password1!');

    await expect(page).toHaveURL(/\/chats/);
  });

  test('shows error on wrong credentials (401)', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({ status: 401 }));

    await fillAndSubmit(page, 'user@test.com', 'wrongpass');

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/); // остаёмся на логине
  });

  test('[BUG] shows rate limit message on 429', async ({ page }) => {
    // Этот тест УПАДЁТ — документирует ISSUE-1
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 429,
        body: JSON.stringify({
          message: 'Too many failed login attempts. Please try again in 15 minutes.',
        }),
      }),
    );

    await fillAndSubmit(page, 'user@test.com', 'wrong');

    // Ожидаем специфичное сообщение — сейчас показывает "Invalid email or password"
    await expect(page.getByText(/too many/i)).toBeVisible();
  });

  test('[BUG] shows verify email prompt on unverified account', async ({ page }) => {
    // Этот тест УПАДЁТ — документирует ISSUE-1
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        body: JSON.stringify({ message: 'Please verify your email before signing in' }),
      }),
    );

    await fillAndSubmit(page, 'user@test.com', 'pass');

    // Ожидаем кнопку/ссылку для resend verification
    await expect(page.getByText(/verify your email/i)).toBeVisible();
  });

  test('validates empty email', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/email/i)).toBeVisible(); // inline error
  });

  test('GuestRoute — redirects to /chats if already logged in', async ({ page }) => {
    await mockMe(page, true); // симулируем залогиненного пользователя

    await page.goto('/auth/login');

    await expect(page).toHaveURL(/\/chats/);
  });

  test('ProtectedRoute — redirects to login if not authenticated', async ({ page }) => {
    await page.goto('/chats');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('auth persists on page refresh', async ({ page }) => {
    // Логинимся
    await page.route('**/api/auth/login', (route) => route.fulfill({ status: 201 }));
    await mockMe(page, true);
    await fillAndSubmit(page, 'user@test.com', 'Password1!');
    await expect(page).toHaveURL(/\/chats/);

    // Рефрешим
    await page.reload();
    await expect(page).toHaveURL(/\/chats/); // должны остаться
  });
});
```

### Как запускать E2E

```bash
# Запустить все E2E тесты
npx nx e2e @org/messenger-e2e

# Запустить конкретный файл
npx nx e2e @org/messenger-e2e --grep "Login"

# С UI режимом (видно браузер, шаги, скриншоты)
npx nx e2e @org/messenger-e2e --ui

# Headed mode (видно браузер в реальном времени)
npx nx e2e @org/messenger-e2e --headed

# Debug mode (пауза на каждом шаге)
npx nx e2e @org/messenger-e2e --debug
```

### page.route() — шпаргалка

```ts
// Конкретный URL
page.route('**/api/auth/login', handler);

// По паттерну
page.route('**/api/**', handler);

// Один раз (потом убирается)
page.routeOnce('**/api/auth/login', handler);

// Убрать мок
page.unroute('**/api/auth/login');

// В handler:
route.fulfill({ status, body, headers }); // вернуть ответ
route.continue(); // пропустить к серверу
route.abort(); // оборвать запрос
route.request().postDataJSON(); // прочитать тело запроса
route.request().headers(); // прочитать заголовки
```

---

## Что НЕ тестируем

| Что                        | Почему                                                                |
| -------------------------- | --------------------------------------------------------------------- |
| `EncryptionService`        | Тонкая обёртка над bcrypt. Тестировать bcrypt — не наша работа        |
| Prisma-генерированные типы | Автоматически сгенерированный код                                     |
| `zod` валидация схем       | Zod сам по себе протестирован. Тестируем только что схема применяется |
| CSS/стили                  | Не функциональная логика                                              |
| Third-party UI компоненты  | Не наш код                                                            |

---

## Матрица покрытия

| Слой                          | Тип теста   | Инструмент                        | Мокаем                       |
| ----------------------------- | ----------- | --------------------------------- | ---------------------------- |
| Frontend компоненты (UI)      | Unit        | Vitest + RTL                      | MSW (HTTP)                   |
| Frontend хуки (бизнес-логика) | Unit        | Vitest + renderHook               | MSW (HTTP)                   |
| Frontend authedFetch          | Unit        | Vitest                            | vi.mock fetch / MSW          |
| Frontend Zustand store        | Unit        | Vitest                            | ничего                       |
| Gateway controllers           | Integration | Jest + Supertest + NestJS Testing | ClientProxy (RabbitMQ)       |
| Auth/User/Chat сервисы        | Unit        | Jest                              | repo + Redis + token service |
| Repositories                  | Integration | Jest + реальная БД                | ничего                       |
| Token service                 | Unit        | Jest                              | ConfigService                |
| JWT Guard                     | Unit        | Jest                              | TokenService                 |
| E2E login/register flows      | E2E         | Playwright                        | page.route() (HTTP)          |

---

## Запуск тестов

```bash
# Unit тесты конкретной либы
npx nx test @org/features
npx nx test @org/auth

# С coverage
npx nx test @org/auth --coverage

# Конкретный файл
npx nx test @org/auth --testFile=auth.service.spec.ts

# Watch mode
npx nx test @org/features --watch

# Все unit тесты
npx nx run-many -t test

# E2E
npx nx e2e @org/messenger-e2e
npx nx e2e @org/messenger-e2e --ui        # с интерфейсом
npx nx e2e @org/messenger-e2e --headed    # видно браузер
```
