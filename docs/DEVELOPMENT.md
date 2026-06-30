# Руководство по разработке

---

## Nx Workspace

Nx — это система сборки и запуска задач для данного монорепозитория. Ключевые концепции:

- **Project graph (граф проектов)** — Nx отслеживает зависимости между всеми проектами. Выполните `npx nx graph` для визуализации.
- **Кэширование** — результаты задач (сборка, тесты, линтинг) кэшируются. Повторный запуск для неизменённого проекта происходит мгновенно.
- **Affected (затронутые)** — `npx nx affected -t test` запускает тесты только для проектов, изменённых относительно базовой ветки.

Все проекты идентифицируются по имени пакета `@org/<name>`.

### Часто используемые команды

```bash
# Serve (запуск в режиме разработки)
npx nx serve @org/gateway
npx nx serve @org/messenger

# Build / test / lint / typecheck
npx nx build @org/<project>
npx nx test @org/<project>
npx nx lint @org/<project>
npx nx typecheck @org/<project>

# Запуск нескольких целей
npx nx run-many -t build test lint typecheck
npx nx affected -t test

# Просмотр конфигурации проекта и доступных целей
npx nx show project @org/<project> --json
npx nx show project @org/<project> --json | jq '.targets | keys'

# Исправление рассинхронизации workspace / очистка устаревшего кэша
npx nx sync
npx nx reset
```

---

## Структура проекта

```
polygon/
├── apps/
│   ├── backend/
│   │   ├── gateway/              # API Gateway — единая точка входа (порт 3000)
│   │   ├── auth-service/         # Аутентификация (порт 3002)
│   │   ├── user-service/         # Профили пользователей (порт 3001)
│   │   ├── chat-service/         # Чаты и сообщения (порт 3003)
│   │   ├── media-service/        # Работа с файлами (порт 3004)
│   │   ├── notification-service/ # Уведомления (порт 3005)
│   │   └── search-service/       # Поиск (порт 3006)
│   └── client/
│       └── messenger/            # React 19 + Vite SPA
│
├── libs/
│   ├── backend/
│   │   ├── auth/                 # Бизнес-логика аутентификации + Prisma schema
│   │   ├── user/                 # Бизнес-логика пользователей + Prisma schema
│   │   ├── chat/                 # Бизнес-логика чатов + Prisma schema
│   │   ├── media/
│   │   ├── notification/
│   │   ├── search/               # Логика поиска (Meilisearch)
│   │   └── core/                 # Общая NestJS инфраструктура (логирование, guards, токены, redis...)
│   ├── client/                   # Feature-Sliced Design — разбит на мини-пакеты
│   │   ├── shared/               # @org/shared — UI kit, API client, socket, theme
│   │   ├── entities/
│   │   │   ├── user/             # @org/entities-user
│   │   │   ├── chat/             # @org/entities-chat
│   │   │   └── message/          # @org/entities-message
│   │   ├── features/
│   │   │   ├── auth/             # @org/features-auth
│   │   │   ├── create-chat/      # @org/features-create-chat
│   │   │   ├── send-message/     # @org/features-send-message
│   │   │   ├── chat-socket/      # @org/features-chat-socket
│   │   │   ├── notifications/    # @org/features-notifications
│   │   │   ├── upload-avatar/    # @org/features-upload-avatar
│   │   │   ├── emoji/            # @org/features-emoji
│   │   │   ├── theme/            # @org/features-theme
│   │   │   ├── infinite-scroll/  # @org/features-infinite-scroll
│   │   │   └── search/           # @org/features-search (заглушка)
│   │   ├── layouts/
│   │   │   ├── auth/             # @org/layouts-auth
│   │   │   ├── sidebar/          # @org/layouts-sidebar
│   │   │   └── mobile/           # @org/layouts-mobile
│   │   └── pages/
│   │       ├── auth/             # @org/pages-login, @org/pages-register, ...
│   │       ├── messenger/        # @org/pages-chat-page, @org/pages-settings, ...
│   │       └── system/           # @org/pages-not-found, @org/pages-design-system
│   └── common/                   # @org/common — Zod-схемы + константы
│
├── scripts/                      # bootstrap.sh, init-db.sh
├── infra/                        # Docker-конфиги
└── docs/
```

### Установка зависимостей

Все внешние пакеты устанавливаются только в **корне репозитория**:

```bash
npm install <package>   # всегда в корне репозитория
```

Файлы `package.json` отдельных библиотек не перечисляют внешние пакеты — Nx разрешает всё из корня через hoisting. Это обеспечивает единую политику версий во всём монорепозитории.

---

## Границы модулей

Nx обеспечивает правила зависимостей с помощью ESLint-правила `@nx/enforce-module-boundaries`. Проекты объявляют свою принадлежность через теги в `package.json`:

```json
{
  "nx": {
    "tags": ["layer:features", "scope:client"]
  }
}
```

### Используемые теги

| Тег                        | Проекты                              |
| -------------------------- | ------------------------------------ |
| `scope:client`             | Все `libs/client/*`                  |
| `scope:backend`            | Все `libs/backend/*`                 |
| `scope:shared`             | `libs/common`                        |
| `layer:shared`             | `@org/shared`                        |
| `layer:entities`           | `@org/entities-*` (каждый слайс)     |
| `layer:features`           | `@org/features-*` (каждый слайс)     |
| `layer:layouts`            | `@org/layouts-*` (каждый слайс)      |
| `layer:pages`              | `@org/pages-*` (каждый слайс)        |
| `type:business`            | Библиотеки сервисов бэкенда          |
| `type:core`                | `@org/core`                          |
| `type:framework-agnostic`  | `@org/common`                        |

### Правила границ

Настроены в корневом `.eslintrc.json` в секции `@nx/enforce-module-boundaries`:

```
Порядок слоёв FSD (можно импортировать только из слоёв ниже):
  pages → layouts → widgets → features → entities → shared

Правила scope (области видимости):
  scope:client  — не может импортировать scope:backend
  scope:backend — не может импортировать scope:client
  scope:shared  — может импортироваться кем угодно
```

Проверка нарушений:

```bash
npx nx lint @org/<project>
npx nx run-many -t lint
```

---

## Соглашения по коду

### Именование

| Объект                | Соглашение        | Пример                                 |
| --------------------- | ----------------- | -------------------------------------- |
| Файлы                 | kebab-case        | `user.service.ts`, `create-user.dto.ts` |
| Классы / Интерфейсы   | PascalCase        | `UserService`, `CreateUserDto`         |
| Переменные / Функции  | camelCase         | `getUserById`                          |
| Константы             | UPPER_SNAKE_CASE  | `MAX_RETRY_COUNT`                      |

### TypeScript

- `strict: true` — без исключений
- Запрещён `any` — используйте `unknown` с явным сужением типа
- Явные возвращаемые типы у публичных функций и методов
- Запрещены неиспользуемые локальные переменные и параметры

### NestJS

- Только constructor-based DI — без внедрения через свойства
- Repository pattern для всех обращений к базе данных — контроллеры и сервисы никогда не работают с Prisma напрямую
- Каждая библиотека бэкенда следует единой внутренней структуре:

```
libs/backend/<service>/
  lib/<service>.module.ts
  services/<service>.service.ts
  controllers/<service>.controller.ts
  database/
    prisma/schema.prisma
    prisma/prisma.service.ts
    repository/<service>.prisma.repo.ts
  dto/
```

---

## Общая логика (`@org/common`)

`libs/common` — единый источник истины для схем валидации и констант. Он не зависит от фреймворка и может импортироваться как клиентом, так и бэкендом.

### Zod-схемы

Определяйте схемы один раз, используйте везде:

```typescript
// libs/common/src/schemas/auth.ts
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

**Фронтенд** — расширение для специфических нужд форм:

```typescript
// libs/client/features/src/lib/auth/ui/register-form.tsx
import { registerSchema } from '@org/common';

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

**Бэкенд** — создание NestJS DTO через `createZodDto`:

```typescript
// libs/backend/auth/src/dto/login.dto.ts
import { loginSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
```

`ZodValidationPipe` (применён глобально в каждом сервисе) автоматически валидирует входящие запросы по схеме DTO и возвращает `400 Bad Request` при ошибке.

---

## Архитектура клиента — FSD с разбивкой на пакеты

Клиент использует **Feature-Sliced Design (FSD)**. Каждый слайс внутри каждого слоя является отдельным Nx-пакетом в `libs/client/`:

```
libs/client/
  shared/                        ← @org/shared
  entities/user/                 ← @org/entities-user
  entities/chat/                 ← @org/entities-chat
  entities/message/              ← @org/entities-message
  features/auth/                 ← @org/features-auth
  features/create-chat/          ← @org/features-create-chat
  features/send-message/         ← @org/features-send-message
  features/chat-socket/          ← @org/features-chat-socket
  features/notifications/        ← @org/features-notifications
  features/search/               ← @org/features-search
  layouts/auth/                  ← @org/layouts-auth
  layouts/sidebar/               ← @org/layouts-sidebar
  pages/auth/                    ← @org/pages-login
  pages/register/                ← @org/pages-register
  pages/chat-page/               ← @org/pages-chat-page
```

**Зачем разбивать?** Хранение целого слоя в одном пакете ломает code splitting. Например, если `@org/pages` (`layer:pages`) — один большой пакет, то при ленивой загрузке страницы подтянутся компоненты всех остальных страниц. Разбивка на `@org/pages-login`, `@org/pages-chat-page` и т.д. позволяет каждому бандлу оставаться минимальным.

Само приложение (`apps/client/messenger`) собирает эти слои воедино: router, providers, layouts уровня приложения и страницы живут там.

### Внутренняя структура фичи

Каждая фича внутри `libs/client/features/src/lib/` разделена на два сегмента:

```
lib/auth/
  ui/             # React-компоненты, используемые страницами
  model/          # Хуки и логика состояния, используемые ui/ или страницами
  index.ts        # Публичное API этой фичи
```

Следите, чтобы `ui/` и `model/` были сосредоточены **только на одной фиче**. Открыв `auth/ui/`, вы должны сразу понимать, что делает каждый файл — потому что всё там относится к аутентификации. Папка с 20 компонентами разного назначения — сигнал к тому, что пора разбить на отдельные фичи.

### Публичное API

Каждая библиотека и каждая фича предоставляет публичное API через `index.ts`. Этот файл является **контрактом** — он явно объявляет, что разрешено использовать внешнему миру. Всё, что не перечислено там, — детали реализации.

```typescript
// libs/client/features/src/lib/auth/index.ts
export { LoginForm } from './ui/login-form';
export { RegisterForm } from './ui/register-form';
export { useLogin } from './model/use-login';
export { useRegister } from './model/use-register';
// ForgotPasswordForm намеренно не экспортируется — используется только внутри фичи
```

`src/index.ts` на уровне библиотеки реэкспортирует из `index.ts` каждой фичи:

```typescript
// libs/client/features/auth/src/index.ts
export { LoginForm } from './ui/login-form';
export { useLogin } from './model/use-login';
```

Для разбитых на слайсы пакетов нет агрегированного реэкспорта — потребители импортируют напрямую из пакета слайса:

```typescript
// ✅ правильно — импорт из конкретного пакета слайса
import { LoginForm, useLogin } from '@org/features-auth';

// ❌ неправильно — обход контракта, сломается при любом внутреннем рефакторинге
import { LoginForm } from '@org/features-auth/src/ui/login-form';
```

Это означает, что можно свободно перестраивать внутренности (переименовывать файлы, разделять сегменты, перемещать код) без необходимости трогать потребителей — пока `index.ts` остаётся неизменным.
