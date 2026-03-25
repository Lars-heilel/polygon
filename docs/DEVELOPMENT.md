# Разработка / Development

[← На главную](../README.md) | [Архитектура](./ARCHITECTURE.md) | [Для AI агентов](./AI-AGENTS.md)

---

## 📁 Структура проекта

```
polygon/
├── apps/                    # Приложения (если есть)
├── libs/                    # Библиотеки
│   └── backend/
│       ├── auth/           # Сервис аутентификации
│       ├── user/           # Сервис пользователей
│       ├── chat/           # Сервис чатов
│       ├── media/          # Сервис медиа
│       └── notification/   # Сервис уведомлений
├── scripts/                 # Скрипты инициализации
├── infra/                   # Инфраструктура (Docker, init скрипты)
└── docs/                    # Документация
```

---

## 🚀 Запуск разработки

### 1. Инициализация (первый раз)

```bash
./scripts/bootstrap.sh
```

### 2. Применение миграций

```bash
# Для каждого сервиса
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
cd ../media && npx prisma migrate dev
cd ../notification && npx prisma migrate dev
```

### 3. Генерация Prisma клиентов

```bash
npx prisma generate
```

### 4. Запуск сервисов

```bash
# Через Docker
docker compose up -d

# Или локально (если настроено)
npm run start:dev
```

---

## 🧪 Тестирование

```bash
# Запустить тесты всех проектов
npm run test

# Запустить тесты конкретного сервиса
npx nx test user
npx nx test auth
npx nx test chat

# Запустить линтинг
npx nx lint user

# Сборка проекта
npx nx build user
```

---

## 📝 Стандарты кода

### TypeScript
- Строгая типизация (`strict: true`)
- Интерфейсы для DTO и сущностей
- Типы Prisma не импортируются — выводятся автоматически

### NestJS
- Декоративный стиль (`@Injectable()`, `@Controller()`)
- Repository pattern для работы с БД
- Dependency Injection через конструктор

### Именование
```typescript
// Классы — PascalCase
class UserService {}

// Интерфейсы — PascalCase
interface UserDTO {}

// Переменные/функции — camelCase
const getUserById = () => {}

// Константы — UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3

// Файлы — kebab-case
user.service.ts
```

### Структура сервиса
```
libs/backend/user/
├── src/
│   ├── database/
│   │   ├── prisma/           # Prisma сервис
│   │   └── repository/       # Репозитории
│   ├── dto/                  # Data Transfer Objects
│   ├── services/             # Бизнес-логика
│   ├── controllers/          # HTTP контроллеры
│   └── index.ts              # Точка входа
├── prisma/
│   └── schema.prisma         # Prisma схема
└── tsconfig.json
```

---

## 🔧 Утилиты Nx

```bash
# Показать граф зависимостей
npx nx graph

# Запустить задачу с зависимостями
npx nx run user:build --with-deps

# Запустить задачи для нескольких проектов
npx nx run-many --target=build --projects=user,auth

# Запустить только изменённые проекты
npx nx affected --target=test
```

---

## 🐛 Отладка

### Логи Docker
```bash
# Все логи
docker compose logs -f

# Лог конкретного сервиса
docker compose logs -f postgres
```

### Базы данных
```bash
# Подключиться к PostgreSQL
docker exec -it polygon-postgres psql -U polygon -d polygon_user

# Показать все БД
docker exec polygon-postgres psql -U polygon -d postgres -c "\l"
```

---

## 📦 Переменные окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

**Основные переменные:**
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
- `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES`

Подробнее: [SETUP.md](../SETUP.md)

---

# Development

[← Home](../README.md) | [Architecture](./ARCHITECTURE.md) | [For AI Agents](./AI-AGENTS.md)

---

## 📁 Project Structure

```
polygon/
├── apps/                    # Applications (if any)
├── libs/                    # Libraries
│   └── backend/
│       ├── auth/           # Authentication service
│       ├── user/           # User service
│       ├── chat/           # Chat service
│       ├── media/          # Media service
│       └── notification/   # Notification service
├── scripts/                 # Initialization scripts
├── infra/                   # Infrastructure (Docker, init scripts)
└── docs/                    # Documentation
```

---

## 🚀 Development Workflow

### 1. Initialization (first time)

```bash
./scripts/bootstrap.sh
```

### 2. Apply Migrations

```bash
# For each service
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
cd ../media && npx prisma migrate dev
cd ../notification && npx prisma migrate dev
```

### 3. Generate Prisma Clients

```bash
npx prisma generate
```

### 4. Start Services

```bash
# Via Docker
docker compose up -d

# Or locally (if configured)
npm run start:dev
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific service tests
npx nx test user
npx nx test auth
npx nx test chat

# Run linting
npx nx lint user

# Build project
npx nx build user
```

---

## 📝 Code Standards

### TypeScript
- Strict typing (`strict: true`)
- Interfaces for DTOs and entities
- Prisma types not imported — inferred automatically

### NestJS
- Decorator style (`@Injectable()`, `@Controller()`)
- Repository pattern for database access
- Constructor-based Dependency Injection

### Naming Conventions
```typescript
// Classes — PascalCase
class UserService {}

// Interfaces — PascalCase
interface UserDTO {}

// Variables/functions — camelCase
const getUserById = () => {}

// Constants — UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3

// Files — kebab-case
user.service.ts
```

### Service Structure
```
libs/backend/user/
├── src/
│   ├── database/
│   │   ├── prisma/           # Prisma service
│   │   └── repository/       # Repositories
│   ├── dto/                  # Data Transfer Objects
│   ├── services/             # Business logic
│   ├── controllers/          # HTTP controllers
│   └── index.ts              # Entry point
├── prisma/
│   └── schema.prisma         # Prisma schema
└── tsconfig.json
```

---

## 🔧 Nx Utilities

```bash
# Show dependency graph
npx nx graph

# Run task with dependencies
npx nx run user:build --with-deps

# Run tasks for multiple projects
npx nx run-many --target=build --projects=user,auth

# Run only affected projects
npx nx affected --target=test
```

---

## 🐛 Debugging

### Docker Logs
```bash
# All logs
docker compose logs -f

# Specific service logs
docker compose logs -f postgres
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

More info: [SETUP.md](../SETUP.md)
