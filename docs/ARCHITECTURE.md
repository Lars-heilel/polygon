# Architecture

---

## Overview

- **API Gateway** as single entry point for all client requests
- **Database per service** pattern for data isolation
- **Async communication** via RabbitMQ message broker
- **Shared schemas** via `@org/common` — single source of truth for validation across client and backend
- **Nx monorepo** for dependency management, caching, and build optimization

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (SPA)                           │
│                   React + Vite                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│              (Single Entry Point, port 3000)                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  User Service │   │  Auth Service │   │  Chat Service │
│   port 3001   │   │   port 3002   │   │   port 3003   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │              RabbitMQ                 │
        │           Message Broker              │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Media Service │   │ Notification  │   │  PostgreSQL   │
│   port 3004   │   │   port 3005   │   │  (per service)│
└───────────────┘   └───────────────┘   └───────────────┘
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │     Redis     │
                                        └───────────────┘
```

---

## Microservices

### API Gateway
Single entry point for all client requests. Handles routing, authentication guards, and proxies requests to the appropriate backend service via RabbitMQ.

### Auth Service
Registration, login, JWT access/refresh tokens, OAuth (GitHub, Google, Yandex), password reset.
Database: `polygon_auth`

### User Service
User profiles, search, avatar and bio management.
Database: `polygon_user`

### Chat Service
Chat creation, member management, message sending and history. Emits WebSocket events for real-time delivery.
Database: `polygon_chat`

### Media Service
File uploads and metadata storage.
Database: `polygon_media`

### Notification Service
Email, push, and in-app notifications.
Database: `polygon_notification`

---

## Communication Patterns

### Client → Backend
All HTTP requests go through the API Gateway. No service is directly accessible from the client.

### Inter-service (async)
All communication between services is asynchronous via RabbitMQ events. There is no direct HTTP between services.

```
Auth Service    --[user.created]-->  Notification Service
Chat Service    --[message.sent]-->  Notification Service
Media Service   --[file.uploaded]--> Chat Service
```

### WebSocket
The Gateway maintains a persistent Socket.IO connection with the client for real-time message delivery. See [Session & WebSocket](#session--websocket) for the full lifecycle.

---

## Data Storage

### PostgreSQL — database per service

| Service      | Database              |
| ------------ | --------------------- |
| Auth         | `polygon_auth`        |
| User         | `polygon_user`        |
| Chat         | `polygon_chat`        |
| Media        | `polygon_media`       |
| Notification | `polygon_notification`|

Each service owns its database exclusively. No cross-service database queries.

### Redis
- Session / token caching
- Rate limiting
- Pub/Sub for real-time events

---

## Shared Schemas (`@org/common`)

`libs/common` is a framework-agnostic library imported by both client and backend. It is the single source of truth for validation rules and constants.

### Zod Schemas

Define once, use on both sides:

```typescript
// libs/common/src/schemas/auth.ts
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

**Frontend** — extend schemas for form-specific needs:

```typescript
import { registerSchema } from '@org/common';

const registerFormSchema = registerSchema.extend({
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords don't match", path: ['confirmPassword'] },
);
```

**Backend** — create NestJS DTOs via `createZodDto`. `ZodValidationPipe` validates incoming requests automatically:

```typescript
import { createZodDto } from 'nestjs-zod';
import { loginSchema } from '@org/common';

export class LoginDto extends createZodDto(loginSchema) {}
```

**Swagger** — DTOs derived from `createZodDto` can be extended with `@ApiProperty` decorators for API documentation without duplicating validation logic:

```typescript
export class CreateUserDto extends createZodDto(UserSchema) {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'User password', example: 'P@ssw0rd123' })
  password: string;
}
```

---

## Client Architecture

The client is a React 19 SPA following **Feature-Sliced Design (FSD)**. Each layer is a separate Nx library.

### FSD Layers

| Layer | Package | Purpose |
| ----- | ------- | ------- |
| shared | `@org/shared` | UI kit, utilities, API client |
| entities | `@org/entities` | Business entities, TanStack Query hooks |
| features | `@org/features` | User-facing features (auth forms, theme) |
| widgets | `@org/widgets` | Composite components |
| layouts | `@org/layouts` | Page layouts |
| pages | `@org/pages` | Standalone pages (e.g. NotFoundPage) |

The application (`apps/client/messenger`) composes these layers into a working product — router, providers, and app-level pages live there.

### State Management

| Concern | Tool | Where |
| ------- | ---- | ----- |
| Server state (API data) | TanStack Query | `@org/entities` |
| Session / auth token | Zustand + `persist` | `@org/entities` → `session.store.ts` |
| UI state (theme) | React Context | `@org/features` → `theme/model/` |

---

## Session & WebSocket

### Authentication Flow

```
1. User submits login form
      │
      ▼
2. POST /api/auth/login → { accessToken }
      │
      ▼
3. setCredentials(accessToken)
   └─ Zustand store updated
   └─ persisted to localStorage (survives page reload)
      │
      ▼
4. socket-middleware reacts to store change
   └─ accessToken appeared → socket.connect()
      │
      ▼
5. ProtectedRoute reads selectIsAuthenticated
   └─ true → renders the app
   └─ false → redirect to /auth/login
```

### Token Refresh

`authedFetch` wraps every authenticated API call:

```
Request sent with Authorization: Bearer <token>
      │
  401 received?
      │
      ├─ No  → return response
      │
      └─ Yes → acquire mutex (prevents parallel refresh races)
                  │
                  ├─ Token already refreshed by another request?
                  │   └─ retry with new token
                  │
                  └─ POST /api/auth/refresh
                        │
                        ├─ Success → setCredentials(newToken) → retry request
                        └─ Failure → clearCredentials() → redirect to login
```

### WebSocket Lifecycle

```
App startup
  └─ initSocketMiddleware()
       └─ subscribe to useSessionStore
            ├─ accessToken set   → socket.connect()
            └─ accessToken cleared → socket.disconnect()

Socket auth
  └─ auth callback reads useSessionStore.getState().accessToken
       on every connect / reconnect — always uses the current token

User opens a chat (/chats/:chatId)
  └─ useChatSocket(chatId) mounts
       ├─ socket.emit('chat:join', { chatId })
       └─ socket.on('message:new', handler)
            └─ handler adds message to TanStack Query cache
                 └─ deduplicates by message.id

User leaves the chat (component unmounts)
  └─ socket.emit('chat:leave', { chatId })
  └─ socket.off('message:new', handler)

User logs out
  └─ clearCredentials()
       └─ Zustand store cleared
       └─ socket-middleware reacts → socket.disconnect()
```

---

## Infrastructure

| Service    | Image                            | Port(s)       |
| ---------- | -------------------------------- | ------------- |
| PostgreSQL | `postgres:17-alpine`             | 5432          |
| Redis      | `redis:7-alpine`                 | 6379          |
| RabbitMQ   | `rabbitmq:3-management-alpine`   | 5672 / 15672  |
| Prometheus | `prom/prometheus`                | 9090          |
| Grafana    | `grafana/grafana`                | 3010          |
