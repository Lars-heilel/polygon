# Phase 0: Security & Infra Baseline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close critical security gaps and set up infrastructure baseline (coverage gate, CI) before any feature work.

**Architecture:** All changes touch only the gateway (Helmet, ThrottlerModule, CSRF), docker-compose (secrets), jest config (coverage), and CI pipeline. No new features, no refactoring, no business logic changes.

**Tech Stack:** NestJS 11, helmet, @nestjs/throttler, csrf-csrf, Docker Compose, Jest, GitHub Actions

---

## Current State (as of 2026-04-03)

**Already done:**

- ✅ Task 3 (WebSocket CORS) — `@WebSocketGateway` now uses `process.env['CLIENT_URL']` instead of `*`. Token is read from `access_token` cookie instead of `handshake.auth`.

**Still needed:**

- ❌ Task 1 — `helmet`, `@nestjs/throttler`, `csrf-csrf` not installed
- ❌ Task 2 — Helmet middleware not in `main.ts`
- ❌ Task 4 — ThrottlerModule not in `gateway.module.ts`
- ❌ Task 5 — CSRF protection not in `main.ts`
- ❌ Task 6 — `docker-compose.yml` has hardcoded `POSTGRES_PASSWORD`, `RABBITMQ_DEFAULT_PASS`, `GF_SECURITY_ADMIN_PASSWORD`
- ❌ Task 7 — `jest.preset.js` has no `coverageThreshold`
- ❌ Task 8 — CI pipeline has no `--coverage` flag

---

## File Map

| File                                                          | Action | Responsibility                                              |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `package.json` (root)                                         | Modify | Add helmet, @nestjs/throttler, csrf-csrf                    |
| `apps/backend/gateway/src/main.ts`                            | Modify | Helmet + CSRF middleware                                    |
| `apps/backend/gateway/src/app/gateway.module.ts`              | Modify | ThrottlerModule + APP_GUARD                                 |
| `apps/backend/gateway/src/__tests__/security-headers.spec.ts` | Create | Test: Helmet headers present                                |
| `apps/backend/gateway/src/__tests__/rate-limiting.spec.ts`    | Create | Test: 429 after limit exceeded                              |
| `apps/backend/gateway/src/__tests__/csrf-protection.spec.ts`  | Create | Test: POST without CSRF token → 403                         |
| `docker-compose.yml`                                          | Modify | Replace hardcoded passwords with env vars                   |
| `.env.example`                                                | Modify | Add POSTGRES_PASSWORD, RABBITMQ_PASSWORD, GF_ADMIN_PASSWORD |
| `jest.preset.js`                                              | Modify | Add coverageThreshold                                       |
| `.github/workflows/ci.yml`                                    | Modify | Add --coverage flag to test step                            |

---

### Task 1: Install dependencies

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Install packages**

```bash
npm install helmet @nestjs/throttler csrf-csrf
```

- [ ] **Step 2: Verify installation**

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

### Task 2: Add Helmet middleware

Helmet sets security headers: `X-Content-Type-Options`, `X-Frame-Options`, removes `X-Powered-By`, etc.

**Files:**

- Create: `apps/backend/gateway/src/__tests__/security-headers.spec.ts`
- Modify: `apps/backend/gateway/src/main.ts`

- [ ] **Step 1: Create the test file**

Create `apps/backend/gateway/src/__tests__/security-headers.spec.ts`:

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

- [ ] **Step 2: Run the test — expect PASS** (helmet is already a dep now, test creates its own app with helmet)

```bash
npx nx test @org/gateway --testFile=security-headers.spec.ts
```

Expected: PASS

- [ ] **Step 3: Add helmet to `apps/backend/gateway/src/main.ts`**

Current `main.ts` starts with these imports (lines 1-8):

```typescript
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, LoggingInterceptor } from '@org/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import passport from 'passport';
```

Add `import helmet from 'helmet';` after the `passport` import:

```typescript
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, LoggingInterceptor } from '@org/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import passport from 'passport';
```

Then add `app.use(helmet());` immediately after `app.useLogger(app.get(Logger));` (line 19) and before `app.enableCors(...)`:

```typescript
// Заменяем встроенный NestJS Logger на Pino
app.useLogger(app.get(Logger));

app.use(helmet());

app.enableCors({
  origin: process.env['CLIENT_URL'] ?? 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

- [ ] **Step 4: Typecheck**

```bash
npx nx typecheck @org/gateway
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/main.ts apps/backend/gateway/src/__tests__/security-headers.spec.ts
git commit -m "feat(gateway): add helmet middleware for security headers"
```

---

### Task 3: ~~WebSocket CORS~~ — ALREADY DONE ✅

`apps/backend/gateway/src/gateways/chat.socket-gateway.ts` already uses `process.env['CLIENT_URL']` instead of `*`. Skip this task.

---

### Task 4: Add global rate limiting

**Files:**

- Create: `apps/backend/gateway/src/__tests__/rate-limiting.spec.ts`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`

- [ ] **Step 1: Create the test file**

Create `apps/backend/gateway/src/__tests__/rate-limiting.spec.ts`:

```typescript
import { Controller, Get, INestApplication } from '@nestjs/common';
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

- [ ] **Step 2: Run the test**

```bash
npx nx test @org/gateway --testFile=rate-limiting.spec.ts
```

Expected: PASS

- [ ] **Step 3: Add ThrottlerModule to `apps/backend/gateway/src/app/gateway.module.ts`**

Current imports section (top of file):

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
```

Add after line 1 (`import { Module } from '@nestjs/common';`):

```typescript
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
```

Current `@Module` imports array ends with:

```typescript
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
    ]),
  ],
```

Add `ThrottlerModule.forRoot(...)` to the `imports` array, after `MetricsModule` and before `ClientsModule.registerAsync`:

```typescript
    MetricsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,   // 1 minute window
          limit: 100,   // 100 requests per minute per IP
        },
      ],
    }),
    ClientsModule.registerAsync([
```

Current `providers` array:

```typescript
  providers: [
    JwtGuard,
    ChatSocketGateway,
    LocalStrategy,
    GithubStrategy,
    YandexStrategy,
    GoogleStrategy,
  ],
```

Add `ThrottlerGuard` as global guard:

```typescript
  providers: [
    JwtGuard,
    ChatSocketGateway,
    LocalStrategy,
    GithubStrategy,
    YandexStrategy,
    GoogleStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
```

- [ ] **Step 4: Typecheck**

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

### Task 5: Add CSRF protection

Cookie-based auth without CSRF is vulnerable to cross-site request forgery. We use the double-submit cookie pattern via `csrf-csrf`.

**Files:**

- Create: `apps/backend/gateway/src/__tests__/csrf-protection.spec.ts`
- Modify: `apps/backend/gateway/src/main.ts`

- [ ] **Step 1: Create the test file**

Create `apps/backend/gateway/src/__tests__/csrf-protection.spec.ts`:

```typescript
import { Controller, Get, INestApplication, Post } from '@nestjs/common';
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
    const tokenRes = await agent.get('/csrf-token').expect(200);
    const csrfToken = tokenRes.body.token;

    await agent.post('/test').set('x-csrf-token', csrfToken).expect(200);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npx nx test @org/gateway --testFile=csrf-protection.spec.ts
```

Expected: PASS

- [ ] **Step 3: Add CSRF middleware to `apps/backend/gateway/src/main.ts`**

Add import after the `helmet` import line:

```typescript
import { doubleCsrf } from 'csrf-csrf';
```

Add CSRF setup block after `app.use(cookieParser());` (currently line 28) and before `app.use(passport.initialize());`:

```typescript
app.use(cookieParser());

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

// Endpoint for client to fetch a CSRF token
app.getHttpAdapter().get('/api/auth/csrf-token', (req: any, res: any) => {
  const token = generateToken(req, res);
  res.json({ token });
});

app.use(doubleCsrfProtection);

app.use(passport.initialize());
```

- [ ] **Step 4: Typecheck**

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

### Task 6: Remove hardcoded credentials from docker-compose.yml

PostgreSQL, RabbitMQ, and Grafana passwords are currently hardcoded in `docker-compose.yml`. Meilisearch already uses env vars correctly.

**Files:**

- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Replace hardcoded postgres credentials in `docker-compose.yml`**

Current lines 9-11:

```yaml
environment:
  POSTGRES_USER: polygon
  POSTGRES_PASSWORD: polygon_password
  POSTGRES_DB: polygon
```

Replace with:

```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER:-polygon}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
  POSTGRES_DB: ${POSTGRES_DB:-polygon}
```

Current line 20 (postgres healthcheck):

```yaml
test: ['CMD-SHELL', 'pg_isready -U polygon']
```

Replace with:

```yaml
test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-polygon}']
```

- [ ] **Step 2: Replace hardcoded rabbitmq credentials**

Current lines 49-50:

```yaml
environment:
  RABBITMQ_DEFAULT_USER: polygon
  RABBITMQ_DEFAULT_PASS: polygon_password
```

Replace with:

```yaml
environment:
  RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-polygon}
  RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:?Set RABBITMQ_PASSWORD in .env}
```

- [ ] **Step 3: Replace hardcoded grafana credentials**

Current lines 111-112:

```yaml
environment:
  GF_SECURITY_ADMIN_USER: admin
  GF_SECURITY_ADMIN_PASSWORD: polygon_grafana
```

Replace with:

```yaml
environment:
  GF_SECURITY_ADMIN_USER: ${GF_ADMIN_USER:-admin}
  GF_SECURITY_ADMIN_PASSWORD: ${GF_ADMIN_PASSWORD:?Set GF_ADMIN_PASSWORD in .env}
```

- [ ] **Step 4: Add new variables to `.env.example`**

The current `.env.example` already has Meilisearch vars added. Add a Docker Compose section after the existing `# ПОИСК / SEARCH` section:

```
# ===========================================
# DOCKER COMPOSE
# ===========================================

# PostgreSQL password for Docker (used in docker-compose.yml)
POSTGRES_USER=polygon
POSTGRES_PASSWORD=polygon_password

# RabbitMQ credentials for Docker
RABBITMQ_USER=polygon
RABBITMQ_PASSWORD=polygon_password

# Grafana admin credentials
GF_ADMIN_USER=admin
GF_ADMIN_PASSWORD=polygon_grafana
```

- [ ] **Step 5: Verify docker compose parses correctly**

```bash
POSTGRES_PASSWORD=test RABBITMQ_PASSWORD=test GF_ADMIN_PASSWORD=test docker compose config --quiet
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "fix(infra): extract hardcoded credentials from docker-compose to env vars"
```

---

### Task 7: Add Jest coverage thresholds

**Files:**

- Modify: `jest.preset.js`

- [ ] **Step 1: Update `jest.preset.js`**

Current content:

```javascript
const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };
```

Replace with:

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

- [ ] **Step 2: Run gateway tests with coverage to check current levels**

```bash
npx nx test @org/gateway --coverage
```

Check the output coverage table. If any category falls below the threshold, lower that threshold to match current coverage minus 5% (round down to nearest 5), then raise it incrementally over time.

Example adjustment if lines are at 28%:

```javascript
coverageThreshold: {
  global: {
    lines: 25,
    branches: 25,
    functions: 25,
    statements: 25,
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add jest.preset.js
git commit -m "chore: add jest coverage thresholds to jest.preset.js"
```

---

### Task 8: Add coverage gate to CI

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Find the "Run tests" step in `.github/workflows/ci.yml`**

Current block (look for lines around 174-182):

```yaml
- name: Run tests
  run: |
    if [ "$NX_TEST_CMD" = "affected" ]; then
      npx nx affected -t test --base=$NX_AFFECTED_BASE --parallel=3
    else
      npx nx run-many -t test --parallel=3
    fi
  env:
    NODE_ENV: test
```

- [ ] **Step 2: Add `--coverage` flag to both branches**

Replace with:

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

- [ ] **Step 3: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || echo "YAML INVALID"
```

Expected: no output (valid YAML)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: enable coverage reporting and threshold gate in test job"
```

---

### Task 9: Final verification

**Files:** all modified files

- [ ] **Step 1: Typecheck entire project**

```bash
npx nx run-many -t typecheck --parallel=3
```

Expected: PASS for all projects

- [ ] **Step 2: Lint entire project**

```bash
npx nx run-many -t lint --parallel=3
```

Expected: PASS

- [ ] **Step 3: Run all gateway tests with coverage**

```bash
npx nx test @org/gateway --coverage
```

Expected: PASS, all new tests included, coverage above threshold

- [ ] **Step 4: Verify docker compose**

```bash
POSTGRES_PASSWORD=test RABBITMQ_PASSWORD=test GF_ADMIN_PASSWORD=test docker compose config --quiet
```

Expected: no errors

---

## Phase 0 Completion Checklist

- [ ] Helmet headers returned on all HTTP responses from gateway
- [ ] WebSocket CORS restricted to CLIENT_URL (already done ✅)
- [ ] `docker-compose.yml` has no hardcoded passwords
- [ ] Global rate limiting (100 req/min) on gateway
- [ ] CSRF protection via double-submit cookie
- [ ] Jest coverage thresholds configured
- [ ] CI runs tests with `--coverage`
- [ ] All typecheck/lint/test pass
