# Development Guide

---

## 📁 Project Structure

```
polygon/
├── apps/
│   ├── backend/           # Executable applications
│   │   ├── gateway/       # API Gateway
│   │   ├── user-service/  # Microservices
│   │   ├── auth-service/
│   │   ├── chat-service/
│   │   ├── media-service/
│   │   └── notification-service/
│   └── client/
│       └── messenger/     # React SPA
│
├── libs/
│   ├── backend/           # Business logic libraries
│   │   ├── user/          # Prisma schemas + logic
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── media/
│   │   ├── notification/
│   │   └── core/
│   ├── client/            # FSD packages
│   │   ├── entities/      # Data models
│   │   ├── features/      # User interactions
│   │   ├── layouts/       # Page layouts
│   │   ├── pages/         # Full pages
│   │   ├── shared/        # Utilities
│   │   └── widgets/       # Composite components
│   └── common/            # Framework-agnostic shared code
│
├── scripts/               # Initialization scripts
├── infra/                 # Infrastructure (Docker, DB init)
└── docs/                  # Documentation
```

---

## 🚀 Quick Start

### 1. Initialize (First Run)

```bash
./scripts/bootstrap.sh
```

This script:
- Checks Docker and Docker Compose
- Starts containers (PostgreSQL, Redis, RabbitMQ)
- Creates databases
- Generates Prisma clients
- Applies migrations

### 2. Start Services

```bash
docker compose up -d
```

### 3. Generate Prisma Client (if needed)

```bash
cd libs/backend/user && npx prisma generate
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific project tests
npx nx test @org/user-service

# Run with coverage
npx nx test @org/user-service --coverage

# Run specific test file
npx nx test @org/user-service --testFile=user.service.spec.ts
```

---

## 🔒 Module Boundaries (FSD)

This project uses **Nx Module Boundaries** to enforce Feature-Sliced Design (FSD) architecture.

### Dependency Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    FSD Layer Dependencies                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  pages → layouts, widgets, features, entities, shared       │
│    ↓                                                        │
│  layouts → widgets, features, entities, shared              │
│    ↓                                                        │
│  widgets → features, entities, shared                       │
│    ↓                                                        │
│  features → entities, shared                                │
│    ↓                                                        │
│  entities → shared                                          │
│    ↓                                                        │
│  shared → (external packages only)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scope Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Scope Boundaries                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  @org/common (framework-agnostic)                           │
│    ↓ can be imported by anyone                              │
│                                                             │
│  @org/client/*  ←→  @org/backend/*                          │
│  (client cannot import backend)                             │
│  (backend cannot import client)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Examples

```typescript
// ✅ ALLOWED: widgets can import entities
import { User } from '@org/entities';  // libs/client/widgets/...

// ✅ ALLOWED: features can import common
import { UserSchema } from '@org/common';  // libs/client/features/...

// ❌ FORBIDDEN: entities cannot import widgets
import { ChatWidget } from '@org/widgets';  // libs/client/entities/...
// Error: Projects using tag "layer:entities" cannot depend on projects using tag "layer:widgets"

// ❌ FORBIDDEN: client cannot import backend
import { UserService } from '@org/backend/user';  // apps/client/...
// Error: Projects using tag "scope:client" cannot depend on projects using tag "scope:backend"
```

### Tags Reference

| Tag | Purpose |
|-----|---------|
| `layer:entities` | Business entities (User, Chat, Message) |
| `layer:features` | User interactions (auth, send message) |
| `layer:layouts` | Page layouts |
| `layer:pages` | Full pages |
| `layer:widgets` | Composite components |
| `layer:shared` | Reusable utilities |
| `scope:client` | Client-side code |
| `scope:backend` | Server-side code |
| `scope:shared` | Framework-agnostic shared code |
| `type:app` | Executable applications |
| `type:business` | Business logic libraries |
| `type:framework-agnostic` | No framework dependencies |

### Check Boundaries

```bash
# Check for boundary violations
npx nx graph

# Run lint with boundary checks
npx nx lint --skip-nx-cache
```

---

## 📝 Code Standards

### TypeScript

- Strict typing (`strict: true`)
- Explicit return types
- Interfaces for DTOs
- No `any` type

### NestJS

- Decorator style (`@Injectable()`, `@Controller()`)
- Repository pattern for database
- Constructor-based DI

### Naming Conventions

```typescript
// Files — kebab-case
user.service.ts
create-user.dto.ts

// Classes — PascalCase
class UserService {}

// Interfaces — PascalCase
interface UserDTO {}

// Variables/functions — camelCase
const getUserById = () => {}

// Constants — UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
```

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

---

## 🔧 Nx Commands

```bash
# Show dependency graph
npx nx graph

# Run task with dependencies
npx nx run @org/user-service:build --with-deps

# Run tasks for multiple projects
npx nx run-many --target=build --projects=@org/user-service,@org/auth-service

# Run only affected projects
npx nx affected --target=test

# Show projects
npx nx show projects

# Show project details
npx nx show project @org/user-service --json
```

---

## 🐛 Debugging

### Docker Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f polygon-postgres
```

### Databases

```bash
# Connect to PostgreSQL
docker exec -it polygon-postgres psql -U polygon -d polygon_user

# Show all databases
docker exec polygon-postgres psql -U polygon -d postgres -c "\l"
```

---

## 📦 Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Key variables:**
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
- `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES`

See [SETUP.md](./SETUP.md) for details.
