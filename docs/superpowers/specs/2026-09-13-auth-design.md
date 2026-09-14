# SPEC-5 — auth-service (credentials, сессии, баны, роли)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Пятый из шести. Один сервис целиком: prisma → контракты → репозиторий → сервис+Redis → контроллер → фронт.
Общая преамбула типов — см. `2026-09-13-notification-design.md` §0.

## 1. Цель

Auth с tight-типами, cleanup-индексами сессий, Redis-сессиями/банами/лимитами, корректным guards-порядком.

## 2. Scope / Non-goals

- В скоупе: `Credentials`/`OAuthAccount`/`Session` Prisma, `auth.service`/`verification.service`/
  `cleanup.service`, Redis-репо сессий/банов/лимитов, gateway `auth`+`admin`-контроллеры,
  фронт-формы auth.
- Вне скоупа: профили (user-спека), WebSocket-присутствие (chat-спека, потребляет сессии/баны).

## 3. Prisma (`libs/backend/auth/src/database/prisma/schema.prisma`)

Текущее (факт): `Credentials(id uuid7, email unique, role, passwordHash?, isVerified,
lockedAt?, lockedUntil?, isBanned, bannedUntil?, banReason?, bannedAt?, bannedBy?, refreshTokens,
oauthAccounts)`, `OAuthAccount(id uuid7, provider, providerId, credentialsId, @@unique([provider,
providerId]), @@index([credentialsId]))`, `Session(id uuid7, tokenHash unique, credentialsId,
expiresAt, revokedAt?, lastActiveAt?, ip?, country?, os?, browser?, device?, userAgent?)`
без `@map` и без индексов cleanup.

Дельта:
- ID: `@db.Uuid @default(uuid(7))` везде; даты `@db.Timestamptz(3)`; `Role` — нативный enum.
- `Credentials`: `email @db.VarChar(254) @unique`, `passwordHash @db.VarChar(255)`,
  `banReason @db.VarChar(255)`, `bannedBy @db.Uuid?`; `lockedAt/lockedUntil` оставить
  (механика темп-блоков), добавить `@@index([isBanned])` только если появится скан банов —
  по умолчанию нет (бан проверяется через Redis-маркер, не сканом таблицы).
- `OAuthAccount`: `provider @db.VarChar(32)`, `providerId @db.VarChar(128)`,
  `@@unique([provider, providerId])` + `@@index([credentialsId])` оставить.
- `Session`: `tokenHash @db.Char(64) @unique` (sha256-hex фикс. длины — самый горячий
  btree refresh-пути); `ip @db.VarChar(45)`, `country @db.VarChar(2)`,
  `os/browser/device @db.VarChar(64)`, `userAgent @db.VarChar(512)`;
  добавить `@@index([credentialsId])` (revoke-all), `@@index([expiresAt])` (cleanup).
  Опция `tokenHash BYTEA(32)` (−32 байта/строка) — зафиксировать решение при реализации,
  базовый вариант `Char(64)`.
- Всем моделям/колонкам `@@map/@map` (сейчас у `Session` маппингов нет).
- `@@map("credentials"/"oauth_accounts"/"sessions")`.

## 4. Контракты (`libs/common`)

- `register/login/credentials/reset-password/oauth/session/role`-схемы: `email .max(254)`,
  `password` — существующий `PASSWORD_REGEX` + `.max(128)` (пароли длиннее не нужны и опасны
  для argon/bcrypt по времени), `username .min(2).max(32)`, токены/ID — `z.uuid()`.
- Никаких секретов в ответах: `passwordHash/tokenHash/providerId` за пределы сервиса не уходят
  (проверяется спеком по типу `auth.prisma.repo.spec.ts`-конвенции).

## 5. Репозиторий

- `auth.prisma.repo.ts`: credentials CRUD, сессии `create/findByTokenHash/revoke/revokeAll/
  deleteExpired`, OAuth link/unlink; всё через `handlePrismaError`.
- `session.redis.repo`/`ban.redis.repo`/`auth.redis.repo` (существуют): интерфейс без смены,
  ключи фиксируем: `sess:{sessionId}` / refresh-lookup, `ban:{userId}`, login-attempts
  `login:{ip|email}` с 5 попытками.

## 6. Сервис + Redis

- `auth.service`: login (лимит 5 попыток) → `sessionId` + `sha256(refresh)` в БД + Redis TTL;
  refresh-ротация с детектом reuse (reuse ⇒ revoke-all); logout/revoke/revoke-all;
  бан: Redis-маркер + revoke сессий + отключение сокетов через gateway.
- `verification.service`/`cleanup.service`: email-верификация/сброс (события в notification),
  периодический `deleteExpired` по индексу `expiresAt` батчами.
- Логи: только `hasUserId/hasSessionId`, `eventType`-цепочки; сырые токены/хеши/metadata — никогда.

## 7. Контроллеры

- Lib: `@MessagePattern` (validate-credentials, login, refresh, logout, revoke-*, get-role),
  `@EventPattern` для побочных (письма уходят через notification-события).
- Gateway: `auth`-контроллер (register/login/logout/refresh/verify/forgot/reset/OAuth/sessions),
  куки `access_token`+`refresh_token` HttpOnly SameSite=strict; guards-порядок
  Throttler → Session/Jwt → ActiveAccount → Roles; данные через `@CurrentUser()`/`@ClientMetadata()`.

## 8. Фронт

- `features-auth`: формы от общих схем (`registerSchema.extend({ confirmPassword })` —
  `confirmPassword` не уходит по сети, тип запроса `z.infer<typeof registerSchema>`),
  single-flight refresh-ретрай в `authed-fetch`, редиректы через `CLIENT_ROUTES`.

## 9. Тесты

- Unit: ротация/детект reuse, revoke-all, лимит попыток, отсутствие секретов в логах
  (копия `auth.prisma.repo.spec.ts`-конвенции).
- Gateway HTTP: supertest + мок RMQ, проверка `set-cookie` (HttpOnly/SameSite), 400 с полями.

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`.
- Миграция чистая (дроп разрешён); после — проверка login→refresh→logout цепочки руками.
