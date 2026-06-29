# Session-Based Multi-Device Auth System

## Overview

Обновление системы авторизации для поддержки нескольких устройств с управлением сессиями. Access/refresh токены привязываются к конкретной сессии/устройству, что позволяет пользователю отслеживать и мгновенно отзывать сессии через Redis.

## Architecture

```
┌─────────────────────┐      ┌──────────────────────────────┐
│   Frontend (React)  │      │      Backend Gateway         │
│                     │      │                              │
│  entities/user     │─────▶│  POST /auth/login            │
│  features/auth     │      │  POST /auth/refresh          │
│  pages/settings    │      │  POST /auth/logout           │
│                     │      │  GET  /auth/sessions        │
│                     │      │  DELETE /auth/sessions/:id  │
└─────────────────────┘      │  DELETE /auth/sessions      │
                             └──────────┬───────────────────┘
                                        │ RabbitMQ
                             ┌──────────▼───────────────────┐
                             │    Auth Microservice          │
                             │                              │
                             │  AuthService                 │
                             │   ├─ login()                 │
                             │   ├─ refresh()               │
                             │   ├─ logout()                │
                             │   ├─ listSessions()          │
                             │   ├─ revokeSession()         │
                             │   └─ revokeAllSessions()     │
                             │                              │
                             │  TokenService                │
                             │   └─ generateTokenPair()     │
                             │                              │
                             │  SessionRedisRepository      │
                             │  AuthRedisCacheRepository    │
                             └──────┬───────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              ┌──────────┐                  ┌──────────┐
              │  Redis   │                  │  PG (via Prisma)  │
              │          │                  │                    │
              │ session: │                  │ Session            │
              │ {sid}    │                  │ Credentials        │
              │ user_ses-│                  │ OAuthAccount       │
              │ sions:   │                  │                    │
              │ {userId} │                  │                    │
              └──────────┘                  └────────────────────┘
```

## Data Model

### PostgreSQL (Prisma)

```prisma
model Session {
  id            String    @id @default(uuid())
  tokenHash     String    @unique
  credentialsId String
  expiresAt     DateTime
  revokedAt     DateTime?
  lastActiveAt  DateTime?
  ip            String?
  country       String?
  os            String?
  browser       String?
  device        String?
  userAgent     String?
  createdAt     DateTime  @default(now())

  credentials   Credentials @relation(fields: [credentialsId], references: [id], onDelete: Cascade)

  @@index([credentialsId])
}
```

### JWT Payload

```ts
export type JwtPayload = {
  sub: string;
  role: Role;
  isVerified: boolean;
  sessionId: string;
  jti: string;
};
```

### Redis Keys

```
session:{sessionId} → JSON { credentialsId, device, expiresAt }
TTL = JWT_REFRESH_TOKEN_EXPIRES (сек)

user_sessions:{credentialsId} → Set<sessionId>
```

## Changes by Layer

### 1. @org/core — TokenService

- `JwtPayload` — добавить `sessionId`
- Новый метод `generateTokenPair(payload, sessionId): TokenPair`
  - Генерирует access + refresh с одинаковым `sessionId` и разными `jti`

### 2. @org/auth — AuthService

**`login(userId, clientMetadata)`**
1. Создать Session в PG
2. Сгенерировать token pair с `sessionId` = Session.id
3. Сохранить `tokenHash` в Session
4. Сохранить в Redis: `session:{id}` с TTL
5. sessionId в `user_sessions:{userId}`
6. Вернуть TokenPair

**`refresh(refreshToken)`**
1. Верифицировать JWT, извлечь `sessionId`
2. Проверить Redis (быстрый path)
3. При Redis промахе — проверить PG
4. Если отозвана/истекла — 401
5. Revoke старый tokenHash
6. Новая пара с тем же `sessionId`
7. Обновить Redis TTL, lastActiveAt

**`logout(refreshToken)`**
1. Извлечь `sessionId`
2. DEL Redis + SREM
3. UPDATE revokedAt = NOW()

**`listSessions(credentialsId)`** (новый)
- SELECT WHERE credentialsId = ? AND revokedAt IS NULL
- Статус: active / expired

**`revokeSession(sessionId, credentialsId)`** (новый)
1. Проверить принадлежность
2. DEL Redis + UPDATE revokedAt

**`revokeAllSessions(credentialsId)`**
1. SMEMBERS → DEL всех + DEL set
2. UPDATE PG

### 3. @org/auth — SessionRedisRepository (новый)

```ts
interface SessionCacheData {
  credentialsId: string;
  device: string;
  expiresAt: string;
}

class SessionRedisRepository {
  save(sessionId, data, ttlSec)
  find(sessionId): SessionCacheData | null
  remove(sessionId)
  addToUserSessions(userId, sessionId)
  getUserSessionIds(userId): string[]
  removeFromUserSessions(userId, sessionId)
}
```

### 4. DI

Новый токен `SESSION_CACHE_REPOSITORY_TOKEN` в `@org/core`.
Провайдер `SessionRedisRepository` в `OrgAuthModule`.

### 5. Gateway Controller

- Login/VerifyEmail/OAuth: передавать `clientMetadata`
- Новые эндпоинты:

```
GET    /auth/sessions        → auth.list-sessions     → SessionInfo[]
DELETE /auth/sessions/:id    → auth.revoke-session
DELETE /auth/sessions?all=true → auth.revoke-all-sessions
```

### 6. Frontend entities/user

`user.api.ts` — `getSessions()`, `revokeSession()`, `revokeAllSessions()`
`model/session.types.ts` — `SessionInfo` type

### 7. Frontend features/auth

Новый хук `useSessions()` с React Query:
- `useQuery('sessions', getSessions)`
- `useMutation(revokeSession) → invalidateQueries`
- `useMutation(revokeAllSessions) → invalidateQueries`

### 8. Frontend pages/settings

`settings-devices-tab.tsx` — данные из `useSessions()`, кнопки revoke, метка "current device"

## Notes

- **lastActiveAt**: обновляется при `refresh()` (ротация токенов). Не при каждом API-запросе — это было бы слишком дорого
- **Current session**: фронтенд определяет по совпадению `sessionId` из JWT (в cookies) с `id` из списка сессий. Gateway возвращает `isCurrent: true` для сессии с переданным `sessionId`
- **Self-revoke**: при revoke текущей сессии — gateway очищает cookies. При revoke чужой сессии — cookies остаются

## Security

- SessionId в обоих токенах
- Instant revocation через Redis
- Replay detection (revokeAll при replay)
- Password reset → revokeAllSessions
- Logout → remove from Redis + revokedAt

## Implementation Order

1. Prisma: добавить `lastActiveAt` в Session, сгенерировать клиент
2. @org/core: обновить JwtPayload, добавить generateTokenPair
3. @org/auth: создать SessionRedisRepository + DI
4. @org/auth: обновить AuthService (login, refresh, logout)
5. @org/auth: добавить listSessions, revokeSession, revokeAllSessions
6. @org/auth: обновить IAuthService, IAuthController, AUTH_PATTERNS
7. @org/auth: переименовать AuthRedisCacheRepository
8. Gateway: новые эндпоинты, clientMetadata
9. Frontend: типы, API, useSessions
10. Frontend: SettingsDevicesTab
11. Тесты
