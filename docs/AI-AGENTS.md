# Для AI агентов / For AI Agents

[← На главную](../README.md) | [Для разработчиков](./DEVELOPMENT.md) | [Архитектура](./ARCHITECTURE.md)

---

## 🤖 Руководство для AI ассистентов

Этот файл содержит инструкции для AI агентов (Qwen Code, Cursor, GitHub Copilot) для эффективной работы с проектом.

---

## 📋 Быстрая справка

```
Проект: Polygon Platform
Тип: Микросервисы на NestJS
Monorepo: Nx
Язык: TypeScript
БД: PostgreSQL + Prisma
Инфраструктура: Docker Compose
```

**Основные команды:**
```bash
# Инициализация
./scripts/bootstrap.sh

# Запуск задач через Nx
npx nx <target> <project>    # npx nx build user
npx nx run-many              # Запуск для нескольких проектов
npx nx affected              # Только изменённые проекты

# Prisma
npx prisma migrate dev       # Применить миграции
npx prisma generate          # Генерировать клиент
```

---

## 🎯 Паттерны проекта

### Repository Pattern
```typescript
// ✅ ПРАВИЛЬНО: Использование репозитория
@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserPrismaRepository) {}
  
  async getUser(id: string) {
    return this.userRepo.findById(id);
  }
}

// ❌ НЕПРАВИЛЬНО: Прямой вызов Prisma в сервисе
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  
  async getUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } }); // Избегать!
  }
}
```

### Типы Prisma
```typescript
// ✅ ПРАВИЛЬНО: Не импортировать типы Prisma
import { PrismaService } from '../prisma/prisma.service';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

// ❌ НЕПРАВИЛЬНО: Импортировать типы из Prisma
import type { User } from '../generated/prisma/models'; // Избегать!
```

### Структура сервиса
```
libs/backend/<service>/
├── src/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   └── repository/
│   │       └── *.prisma.repo.ts
│   ├── dto/
│   ├── services/
│   ├── controllers/
│   └── index.ts
└── prisma/
    └── schema.prisma
```

---

## 🔍 Поиск в коде

### Найти сервис
```bash
# Все сервисы
find libs/backend -name "*.service.ts"

# Конкретный сервис
find libs/backend/user -name "*.service.ts"
```

### Найти контроллер
```bash
find libs/backend -name "*.controller.ts"
```

### Найти репозиторий
```bash
find libs/backend -name "*.repo.ts"
```

### Найти Prisma схему
```bash
find libs/backend -name "schema.prisma"
```

---

## 📦 Nx команды

```bash
# Граф зависимостей
npx nx graph

# Запуск с зависимостями
npx nx run <project>:<target> --with-deps

# Несколько проектов
npx nx run-many --target=build --projects=user,auth,chat

# Только изменённые
npx nx affected --target=test

# Линт
npx nx lint <project>

# Тесты
npx nx test <project>

# Сборка
npx nx build <project>
```

---

## 🐛 Отладка

### Docker
```bash
# Логи
docker compose logs -f

# Логи сервиса
docker compose logs -f polygon-postgres

# Подключиться к БД
docker exec -it polygon-postgres psql -U polygon -d polygon_user
```

### Prisma
```bash
# Студия
npx prisma studio

# Миграции
npx prisma migrate dev
npx prisma migrate status
```

---

## ⚠️ Важные правила

1. **Не импортировать типы Prisma** — они выводятся автоматически
2. **Использовать Repository pattern** — не вызывать Prisma напрямую в сервисах
3. **Проверять зависимости** — перед запуском задачи проверить `nx graph`
4. **Следовать именованию** — файлы: `kebab-case`, классы: `PascalCase`
5. **TypeScript strict** — вся типизация должна быть явной

---

## 🔗 Полезные ссылки

- [README](../README.md) — главная страница
- [SETUP.md](../SETUP.md) — настройка окружения
- [DEVELOPMENT.md](./DEVELOPMENT.md) — гайд разработчика
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура
- [AGENTS.md](../AGENTS.md) — Nx навыки агентов

---

# For AI Agents

[← Home](../README.md) | [For Developers](./DEVELOPMENT.md) | [Architecture](./ARCHITECTURE.md)

---

## 🤖 AI Assistant Guide

This file contains instructions for AI agents (Qwen Code, Cursor, GitHub Copilot) to work effectively with this project.

---

## 📋 Quick Reference

```
Project: Polygon Platform
Type: NestJS Microservices
Monorepo: Nx
Language: TypeScript
Database: PostgreSQL + Prisma
Infrastructure: Docker Compose
```

**Key Commands:**
```bash
# Initialization
./scripts/bootstrap.sh

# Nx tasks
npx nx <target> <project>    # npx nx build user
npx nx run-many              # Run for multiple projects
npx nx affected              # Only affected projects

# Prisma
npx prisma migrate dev       # Apply migrations
npx prisma generate          # Generate client
```

---

## 🎯 Project Patterns

### Repository Pattern
```typescript
// ✅ CORRECT: Using repository
@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserPrismaRepository) {}
  
  async getUser(id: string) {
    return this.userRepo.findById(id);
  }
}

// ❌ INCORRECT: Direct Prisma call in service
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  
  async getUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } }); // Avoid!
  }
}
```

### Prisma Types
```typescript
// ✅ CORRECT: Don't import Prisma types
import { PrismaService } from '../prisma/prisma.service';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

// ❌ INCORRECT: Import types from Prisma
import type { User } from '../generated/prisma/models'; // Avoid!
```

### Service Structure
```
libs/backend/<service>/
├── src/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   └── repository/
│   │       └── *.prisma.repo.ts
│   ├── dto/
│   ├── services/
│   ├── controllers/
│   └── index.ts
└── prisma/
    └── schema.prisma
```

---

## 🔍 Code Search

### Find service
```bash
# All services
find libs/backend -name "*.service.ts"

# Specific service
find libs/backend/user -name "*.service.ts"
```

### Find controller
```bash
find libs/backend -name "*.controller.ts"
```

### Find repository
```bash
find libs/backend -name "*.repo.ts"
```

### Find Prisma schema
```bash
find libs/backend -name "schema.prisma"
```

---

## 📦 Nx Commands

```bash
# Dependency graph
npx nx graph

# Run with dependencies
npx nx run <project>:<target> --with-deps

# Multiple projects
npx nx run-many --target=build --projects=user,auth,chat

# Only affected
npx nx affected --target=test

# Lint
npx nx lint <project>

# Tests
npx nx test <project>

# Build
npx nx build <project>
```

---

## 🐛 Debugging

### Docker
```bash
# Logs
docker compose logs -f

# Service logs
docker compose logs -f polygon-postgres

# Connect to database
docker exec -it polygon-postgres psql -U polygon -d polygon_user
```

### Prisma
```bash
# Studio
npx prisma studio

# Migrations
npx prisma migrate dev
npx prisma migrate status
```

---

## ⚠️ Important Rules

1. **Don't import Prisma types** — inferred automatically
2. **Use Repository pattern** — don't call Prisma directly in services
3. **Check dependencies** — run `nx graph` before tasks
4. **Follow naming** — files: `kebab-case`, classes: `PascalCase`
5. **TypeScript strict** — all typing must be explicit

---

## 🔗 Quick Links

- [README](../README.md) — home page
- [SETUP.md](../SETUP.md) — environment setup
- [DEVELOPMENT.md](./DEVELOPMENT.md) — developer guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — architecture
- [AGENTS.md](../AGENTS.md) — Nx agent skills
