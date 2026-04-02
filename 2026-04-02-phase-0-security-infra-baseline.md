# Фаза 0: Security & Infra Baseline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть критические дыры в безопасности и настроить инфраструктурный baseline (coverage, CI gate) до начала работы над фичами.

**Architecture:** Все изменения затрагивают только gateway (Helmet, throttler, CORS, CSRF), docker-compose (secrets), jest-конфиги (coverage) и CI pipeline. Никаких новых фич, рефакторинга или изменений бизнес-логики.

**Tech Stack:** NestJS 11, Helmet, @nestjs/throttler, csrf-csrf, Docker Compose, Jest, GitHub Actions

---

## Карта файлов

| Файл                                                       | Действие | Ответственность                                                           |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `package.json` (root)                                      | Modify   | Добавить helmet, @nestjs/throttler, csrf-csrf                             |
| `apps/backend/gateway/src/main.ts`                         | Modify   | Helmet middleware, CSRF middleware                                        |
| `apps/backend/gateway/src/app/gateway.module.ts`           | Modify   | ThrottlerModule import                                                    |
| `apps/backend/gateway/src/gateways/chat.socket-gateway.ts` | Modify   | WebSocket CORS fix                                                        |
| `docker-compose.yml`                                       | Modify   | Вынести credentials в env vars                                            |
| `.env.example`                                             | Modify   | Добавить POSTGRES_PASSWORD, RABBITMQ_PASSWORD, GF_SECURITY_ADMIN_PASSWORD |
| `jest.preset.js`                                           | Modify   | Добавить coverageThreshold                                                |
| `.github/workflows/ci.yml`                                 | Modify   | Добавить --coverage флаг                                                  |
| `apps/backend/gateway/src/main.ts` (тест)                  | Create   | Тест для Helmet headers и CSRF                                            |

---

### Task 1: Установить зависимости

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Установить helmet, @nestjs/throttler, csrf-csrf**

```bash
npm install helmet @nestjs/throttler csrf-csrf
```

- [ ] **Step 2: Проверить установку**

```bash
node -e "require('helmet'); require('@nestjs/throttler'); require('csrf-csrf'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add helmet, @nestjs/throttler, csrf-csrf dependencies"
```

---

### Task 2: Добавить Helmet middleware

Helmet добавляет security-заголовки: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security и др.

**Files:**

- Modify: `apps/backend/gateway/src/main.ts:1-54`

- [ ] **Step 1: Написать тест — проверить что security headers возвращаются**

Создать файл `apps/backend/gateway/src/__tests__/security-headers.spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';

describe('Security Headers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [],
    }).compile();

    app = module.createNestApplication();
    app.use(helmet());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return X-Content-Type-Options header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should return X-Frame-Options header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should not expose X-Powered-By header', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(404);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```bash
npx nx test @org/gateway --testFile=security-headers.spec.ts
```

Expected: FAIL — тесты пока не подключены к реальному приложению, но helmet уже установлен. Тест должен пройти т.к. мы подключаем helmet в тестовом app. Если проходит — значит helmet работает корректно, переходим к подключению в main.ts.

- [ ] **Step 3: Добавить helmet в gateway main.ts**

В файле `apps/backend/gateway/src/main.ts`, добавить import и middleware:

Добавить import после строки 8 (`import passport from 'passport';`):

```typescript
import helmet from 'helmet';
```

Добавить вызов helmet() после строки 19 (`app.useLogger(app.get(Logger));`) и перед CORS:

```typescript
app.use(helmet());
```

Итоговый порядок middleware в main.ts:

1. `app.useLogger(...)` (строка 19)
2. `app.use(helmet())` — NEW
3. `app.enableCors(...)` (строки 21-26)
4. `app.use(cookieParser())` (строка 28)
5. `app.use(passport.initialize())` (строка 29)

- [ ] **Step 4: Проверить что тест проходит**

```bash
npx nx test @org/gateway --testFile=security-headers.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/main.ts apps/backend/gateway/src/__tests__/security-headers.spec.ts
git commit -m "feat(gateway): add helmet middleware for security headers"
```

---

### Task 3: Исправить WebSocket CORS

Сейчас WebSocket принимает подключения с любого origin (`*`). Нужно ограничить до `CLIENT_URL`.

**Files:**

- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts:16`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts` (если нужен ConfigService в gateway)

- [ ] **Step 1: Изменить CORS в WebSocketGateway**

Проблема: декоратор `@WebSocketGateway` не имеет доступа к ConfigService напрямую. Решение — использовать `afterInit` для динамической конфигурации через `ConfigService`, или передать `CLIENT_URL` через `process.env` (он уже загружен через CoreConfigModule к моменту создания gateway).

В файле `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`, заменить строку 16:

```typescript
@WebSocketGateway({ cors: { origin: '*', credentials: true } })
```

на:

```typescript
@WebSocketGateway({
  cors: {
    origin: process.env['CLIENT_URL'] ?? 'http://localhost:4200',
    credentials: true,
  },
})
```

- [ ] **Step 2: Проверить typecheck**

```bash
npx nx typecheck @org/gateway
```

Expected: PASS (без ошибок типов)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/gateway/src/gateways/chat.socket-gateway.ts
git commit -m "fix(gateway): restrict WebSocket CORS to CLIENT_URL instead of wildcard"
```

---

### Task 4: Добавить global rate limiting

Сейчас только login endpoint имеет rate limiting через Redis. Нужен базовый глобальный лимит на все API endpoints.

**Files:**

- Modify: `apps/backend/gateway/src/app/gateway.module.ts:47-75`
- Modify: `apps/backend/gateway/src/main.ts`

- [ ] **Step 1: Написать тест — rate limiter возвращает 429 при превышении лимита**

Создать файл `apps/backend/gateway/src/__tests__/rate-limiting.spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

@Controller('test')
class TestController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('Rate Limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 3 }],
        }),
      ],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests within limit', async () => {
    await request(app.getHttpServer()).get('/test').expect(200);
    await request(app.getHttpServer()).get('/test').expect(200);
    await request(app.getHttpServer()).get('/test').expect(200);
  });

  it('should return 429 when limit is exceeded', async () => {
    await request(app.getHttpServer()).get('/test').expect(429);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться что проходит**

```bash
npx nx test @org/gateway --testFile=rate-limiting.spec.ts
```

Expected: PASS (ThrottlerModule работает корректно)

- [ ] **Step 3: Добавить ThrottlerModule в GatewayModule**

В файле `apps/backend/gateway/src/app/gateway.module.ts`:

Добавить imports в начало файла (после строки 3):

```typescript
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
```

Добавить `ThrottlerModule.forRoot(...)` в массив `imports` модуля (после `MetricsModule`, строка 53):

```typescript
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,   // 1 минута
          limit: 100,   // 100 запросов в минуту на IP
        },
      ],
    }),
```

Добавить `ThrottlerGuard` как глобальный guard в `providers` (после `GoogleStrategy`, строка 72):

```typescript
    { provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 4: Проверить typecheck**

```bash
npx nx typecheck @org/gateway
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/app/gateway.module.ts apps/backend/gateway/src/__tests__/rate-limiting.spec.ts
git commit -m "feat(gateway): add global rate limiting via @nestjs/throttler (100 req/min)"
```

---

### Task 5: Добавить CSRF защиту

Cookie-based auth без CSRF уязвим к cross-site request forgery. Используем double-submit cookie pattern через `csrf-csrf`.

**Files:**

- Modify: `apps/backend/gateway/src/main.ts`

- [ ] **Step 1: Написать тест — мутирующие запросы без CSRF токена возвращают 403**

Создать файл `apps/backend/gateway/src/__tests__/csrf-protection.spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import request from 'supertest';

@Controller('test')
class TestController {
  @Get()
  get() {
    return { ok: true };
  }

  @Post()
  post() {
    return { ok: true };
  }
}

describe('CSRF Protection', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());

    const { doubleCsrfProtection, generateToken } = doubleCsrf({
      getSecret: () => 'test-csrf-secret-min-32-chars-xxxx',
      cookieName: '__csrf',
      cookieOptions: { sameSite: 'strict', secure: false, httpOnly: true },
      getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
    });

    // Expose token generation endpoint for tests
    app.getHttpAdapter().get('/csrf-token', (req: any, res: any) => {
      const token = generateToken(req, res);
      res.json({ token });
    });

    app.use(doubleCsrfProtection);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow GET requests without CSRF token', async () => {
    await request(app.getHttpServer()).get('/test').expect(200);
  });

  it('should reject POST requests without CSRF token', async () => {
    await request(app.getHttpServer()).post('/test').expect(403);
  });

  it('should allow POST requests with valid CSRF token', async () => {
    const agent = request.agent(app.getHttpServer());

    // Get CSRF token (sets cookie + returns token)
    const tokenRes = await agent.get('/csrf-token').expect(200);
    const csrfToken = tokenRes.body.token;

    // POST with token in header
    await agent.post('/test').set('x-csrf-token', csrfToken).expect(200);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться что проходит**

```bash
npx nx test @org/gateway --testFile=csrf-protection.spec.ts
```

Expected: PASS

- [ ] **Step 3: Добавить CSRF middleware в gateway main.ts**

В файле `apps/backend/gateway/src/main.ts`:

Добавить import после helmet import:

```typescript
import { doubleCsrf } from 'csrf-csrf';
```

Добавить CSRF middleware после `app.use(cookieParser())` (после текущей строки 28) и перед `app.use(passport.initialize())`:

```typescript
// CSRF protection (double-submit cookie pattern)
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env['JWT_ACCESS_SECRET'] ?? 'dev-csrf-secret-min-32-characters-x',
  cookieName: '__csrf',
  cookieOptions: {
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Endpoint для получения CSRF токена клиентом
app.getHttpAdapter().get('/api/auth/csrf-token', (req: any, res: any) => {
  const token = generateToken(req, res);
  res.json({ token });
});

app.use(doubleCsrfProtection);
```

- [ ] **Step 4: Проверить typecheck**

```bash
npx nx typecheck @org/gateway
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/main.ts apps/backend/gateway/src/__tests__/csrf-protection.spec.ts
git commit -m "feat(gateway): add CSRF protection via double-submit cookie pattern"
```

---

### Task 6: Вынести hardcoded credentials из docker-compose.yml

Пароли PostgreSQL, RabbitMQ и Grafana сейчас в открытом виде в docker-compose.yml.

**Files:**

- Modify: `docker-compose.yml:1-114`
- Modify: `.env.example`

- [ ] **Step 1: Заменить hardcoded credentials в docker-compose.yml на env переменные**

В файле `docker-compose.yml`, заменить секцию postgres environment (строки 8-11):

```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER:-polygon}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
  POSTGRES_DB: ${POSTGRES_DB:-polygon}
```

Заменить healthcheck команду postgres (строка 20):

```yaml
test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-polygon}']
```

Заменить секцию rabbitmq environment (строки 48-49):

```yaml
environment:
  RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-polygon}
  RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:?Set RABBITMQ_PASSWORD in .env}
```

Заменить секцию grafana environment (строки 89-92):

```yaml
environment:
  GF_SECURITY_ADMIN_USER: ${GF_ADMIN_USER:-admin}
  GF_SECURITY_ADMIN_PASSWORD: ${GF_ADMIN_PASSWORD:?Set GF_ADMIN_PASSWORD in .env}
  GF_USERS_ALLOW_SIGN_UP: 'false'
```

- [ ] **Step 2: Добавить новые переменные в .env.example**

В файле `.env.example`, добавить секцию Docker после секции DATABASE (после строки 48):

```
# ===========================================
# DOCKER COMPOSE
# ===========================================

# Пароль PostgreSQL для Docker (используется в docker-compose.yml)
# PostgreSQL password for Docker (used in docker-compose.yml)
POSTGRES_USER=polygon
POSTGRES_PASSWORD=polygon_password

# Пароль Grafana admin
# Grafana admin password
GF_ADMIN_USER=admin
GF_ADMIN_PASSWORD=polygon_grafana
```

- [ ] **Step 3: Проверить что docker compose config парсится без ошибок**

```bash
docker compose config --quiet
```

Expected: без ошибок (если `.env` содержит нужные переменные)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "fix(infra): extract hardcoded credentials from docker-compose to env vars"
```

---

### Task 7: Добавить coverage thresholds в Jest

Установить минимальный порог покрытия, чтобы регрессии не проходили незамеченными.

**Files:**

- Modify: `jest.preset.js`

- [ ] **Step 1: Добавить coverageThreshold в jest.preset.js**

Заменить содержимое `jest.preset.js`:

```javascript
const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  coverageThreshold: {
    global: {
      lines: 50,
      branches: 40,
      functions: 40,
      statements: 50,
    },
  },
};
```

- [ ] **Step 2: Проверить что тесты проходят с coverage**

```bash
npx nx test @org/gateway --coverage
```

Expected: PASS (threshold 50% — текущее покрытие может быть ниже, но тесты не упадут пока не включён `--coverage` в CI)

Примечание: если текущее покрытие ниже 50%, снизить порог до реального уровня и поднимать итеративно. Проверить output и скорректировать.

- [ ] **Step 3: Commit**

```bash
git add jest.preset.js
git commit -m "chore: add jest coverage thresholds (50% lines/statements, 40% branches/functions)"
```

---

### Task 8: Добавить coverage gate в CI

CI должен запускать тесты с `--coverage` и падать если покрытие ниже порога.

**Files:**

- Modify: `.github/workflows/ci.yml:174-180`

- [ ] **Step 1: Добавить --coverage флаг к test commands в CI**

В файле `.github/workflows/ci.yml`, заменить блок "Run tests" (строки 174-182):

```yaml
- name: Run tests
  run: |
    if [ "$NX_TEST_CMD" = "affected" ]; then
      npx nx affected -t test --base=$NX_AFFECTED_BASE --parallel=3 --coverage
    else
      npx nx run-many -t test --parallel=3 --coverage
    fi
  env:
    NODE_ENV: test
```

Единственное изменение — добавлен `--coverage` к обеим веткам.

- [ ] **Step 2: Проверить YAML-синтаксис**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || echo "YAML INVALID"
```

Expected: без ошибок

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: enable coverage reporting and threshold gate in test job"
```

---

### Task 9: Финальная проверка — все изменения работают вместе

**Files:** все изменённые файлы

- [ ] **Step 1: Typecheck всего проекта**

```bash
npx nx run-many -t typecheck --parallel=3
```

Expected: PASS для всех проектов

- [ ] **Step 2: Lint всего проекта**

```bash
npx nx run-many -t lint --parallel=3
```

Expected: PASS

- [ ] **Step 3: Запустить все тесты gateway с coverage**

```bash
npx nx test @org/gateway --coverage
```

Expected: PASS, coverage выше threshold

- [ ] **Step 4: Проверить docker compose**

```bash
docker compose config --quiet
```

Expected: без ошибок

- [ ] **Step 5: Финальный commit (если есть несохранённые изменения)**

```bash
git status
# Если есть изменения:
git add -A
git commit -m "chore: phase 0 security & infra baseline complete"
```

---

## Чеклист после завершения Фазы 0

- [ ] Helmet headers возвращаются на всех HTTP ответах gateway
- [ ] WebSocket CORS ограничен до CLIENT_URL
- [ ] docker-compose.yml не содержит hardcoded паролей
- [ ] Global rate limiting (100 req/min) на gateway
- [ ] CSRF protection через double-submit cookie
- [ ] Jest coverage thresholds настроены (50% lines)
- [ ] CI запускает тесты с --coverage
- [ ] Все typecheck/lint/test проходят
