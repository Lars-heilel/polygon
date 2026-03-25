# Architecture

---

## 🏗 Overview

- **API Gateway** as single entry point for all client requests
- **Database per service** pattern for data isolation
- **Async communication** via RabbitMQ message broker
- **Shared libraries** for code reuse across frontend and backend
- **Nx monorepo** for efficient development and tree-shaking

---

## 📐 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (SPA)                           │
│                   React + Vite                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│              (Single Entry Point)                           │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    User       │   │    Auth       │   │    Chat       │
│   Service     │   │   Service     │   │   Service     │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │           Message Broker              │
        │            RabbitMQ                   │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Media      │   │ Notification  │   │   PostgreSQL  │
│   Service     │   │   Service     │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │     Redis     │
                    │   (cache)     │
                    └───────────────┘
```

---

## 📦 Microservices

### API Gateway
**Entry point for all client requests.** Routes requests to appropriate backend services.

---

### User Service
**Responsibility:** User profile management

**Functions:**
- User CRUD operations
- User search
- Profile management (avatar, bio)

**Database:** `polygon_user`

---

### Auth Service
**Responsibility:** Authentication & authorization

**Functions:**
- Registration / login
- JWT tokens (access/refresh)
- Role-based access control

**Database:** `polygon_auth`

---

### Chat Service
**Responsibility:** Chats & messaging

**Functions:**
- Create/delete chats
- Member management
- Send/receive messages
- Message history

**Database:** `polygon_chat`

---

### Media Service
**Responsibility:** File handling

**Functions:**
- File uploads
- Metadata storage

**Database:** `polygon_media`

---

### Notification Service
**Responsibility:** Notifications

**Functions:**
- Email notifications
- Push notifications
- In-app notifications

**Database:** `polygon_notification`

---

## 🔄 Communication Patterns

### Async (RabbitMQ)

All inter-service communication happens via RabbitMQ events:

```
Auth Service --[user.created]--> Notification Service
Chat Service --[message.sent]--> Notification Service
Media Service --[file.uploaded]--> Chat Service
```

**Benefits:**
- Loose coupling between services
- Eventual consistency
- Better fault tolerance

---

## 🗄 Data Storage

### PostgreSQL

Database per service pattern:

| Service | Database |
|---------|----------|
| User | `polygon_user` |
| Auth | `polygon_auth` |
| Chat | `polygon_chat` |
| Media | `polygon_media` |
| Notification | `polygon_notification` |

### Redis

- Query caching
- Session storage
- Rate limiting

---

## 📁 Monorepo Structure (Nx)

```
polygon/
├── apps/
│   ├── backend/
│   │   ├── gateway/              # API Gateway
│   │   ├── user-service/         # Microservices
│   │   ├── auth-service/
│   │   ├── chat-service/
│   │   ├── media-service/
│   │   └── notification-service/
│   └── client/
│       └── messenger/            # React SPA
│
├── libs/
│   ├── backend/
│   │   ├── user/                 # Business logic + Prisma
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── media/
│   │   ├── notification/
│   │   └── core/
│   ├── client/
│   │   ├── entities/             # FSD: Data models
│   │   ├── features/             # FSD: Features
│   │   ├── layouts/              # FSD: Layouts
│   │   ├── pages/                # FSD: Pages
│   │   ├── shared/               # FSD: Shared utilities
│   │   └── widgets/              # FSD: Widgets
│   └── common/                   # Framework-agnostic shared code
│
└── infrastructure/
    └── db/init/                  # Database initialization
```

---

## 🔗 Shared Libraries (@org/common)

**Framework-agnostic library** for code reuse across frontend and backend.

### Purpose

- Share Zod schemas between client and server
- Store common constants (regex, validation rules)
- Provide base types for extension

### Schema Extension Pattern

```typescript
// libs/common/src/schemas/user.ts
export const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// libs/client/features/auth/src/register-form.ts
import { UserSchema } from '@org/common';

export const RegisterFormSchema = UserSchema.extend({
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match' }
);

// libs/backend/user/src/dto/create-user.dto.ts
import { UserSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class CreateUserDto extends createZodDto(UserSchema) {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'P@ssw0rd123',
  })
  password: string;
}
```

### Benefits

- **Single source of truth** for validation rules
- **Type safety** across the stack
- **Tree-shaking** — Nx includes only used code in final bundle

---

## 🎯 Client Architecture (FSD)

The client application uses **Feature-Sliced Design (FSD)** pattern:

| Layer | Purpose |
|-------|---------|
| `entities` | Business entities (User, Chat, Message) |
| `features` | User interactions (auth, send message) |
| `layouts` | Page layouts |
| `pages` | Full pages (Login, Chat, Settings) |
| `widgets` | Composite components (Sidebar, Header) |
| `shared` | Reusable utilities (UI kit, helpers) |

**All layers are Nx packages** — imported by messenger and future micro-frontends.

---

## 🛠 Infrastructure

### Docker Services

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL | `postgres:17-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| RabbitMQ | `rabbitmq:3-management-alpine` | 5672, 15672 |

### Nx Benefits

- Dependency graph visualization
- Affected commands (run only on changed projects)
- Build caching
- Code generators
- Tree-shaking for shared libraries
