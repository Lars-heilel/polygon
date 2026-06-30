# Архитектура

---

## Обзор

- **API Gateway** как единая точка входа для всех клиентских запросов
- **Database per service** — паттерн изоляции данных
- **Асинхронная коммуникация** через брокер сообщений RabbitMQ
- **Shared schemas** через `@org/common` — единый источник истины для валидации на клиенте и бэкенде
- **Nx monorepo** для управления зависимостями, кэширования и оптимизации сборки
- **Sliced packages** — клиентские FSD-слои разбиты на мини-пакеты (`@org/entities-user`, `@org/features-auth`, `@org/pages-login`) для правильного code splitting. Один большой пакет на слой ломает бандлинг (ленивая страница тянет все зависимости слоя).

---

## Схема системы

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (SPA)                           │
│                   React + Vite + Socket.IO                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│              (Single Entry Point, port 3000)                │
│              HTTP + WebSocket + RabbitMQ Client             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  User Service │   │  Auth Service │   │  Chat Service │
│   port 3001   │   │   port 3002   │   │   port 3003   │
└───────────────┘   └───────────────┘   └───────┬───────┘
                                                  │
        ┌──────────────────────────────────────────┘
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Media Service│   │Notification  │   │Search Service │
│   port 3004   │   │  port 3005   │   │   port 3006   │
└───────┬───────┘   └───────────────┘   └───────┬───────┘
        │                                       │
        ▼                                       ▼
 ┌──────────────┐                     ┌──────────────┐
 │    MinIO     │                     │  Meilisearch  │
 │  S3 Storage  │                     │Search Engine  │
 └──────────────┘                     └──────────────┘

                ┌──────────────────────┐
                │      RabbitMQ        │
                │   Message Broker     │
                └──────────┬───────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │PostgreSQL│  │  Redis   │  │   (все   │
       │ per svc  │  │Cache/    │  │ сервисы) │
       └──────────┘  │Sessions  │  └──────────┘
                     └──────────┘
```

---

## Микросервисы

### API Gateway

Единая точка входа для всех клиентских запросов. Обрабатывает маршрутизацию, guards аутентификации и проксирует запросы к соответствующему бэкенд-сервису через RabbitMQ.

### Auth Service

Регистрация, вход, JWT access/refresh токены, OAuth (GitHub, Google, Yandex), сброс пароля.
База данных: `polygon_auth`

### User Service

Профили пользователей, поиск, управление аватаром и био.
База данных: `polygon_user`

### Chat Service

Создание чатов, управление участниками, отправка сообщений и история. Испускает WebSocket-события для доставки в реальном времени.
База данных: `polygon_chat`

### Media Service

Загрузка файлов, хранение метаданных, асинхронная обработка (миниатюры, waveform, превью видео).
База данных: `polygon_media`

### Notification Service

Email, push и внутриприложные уведомления.
База данных: `polygon_notification`

### Search Service

Поиск пользователей и сообщений через Meilisearch. Без собственной базы данных — использует внешний поисковый движок. Слушает RabbitMQ-события от Auth (`user.registered`), User (`user.updated`) и Chat (`message.created`) для поддержки индексов.

---

## Паттерны коммуникации

### Клиент → Бэкенд

Все HTTP-запросы проходят через API Gateway. Ни один сервис напрямую из клиента недоступен.

### Межсервисная (асинхронная)

Вся коммуникация между сервисами асинхронна через RabbitMQ-события. Прямого HTTP между сервисами нет.

```
Auth Service    --[user.registered]-----------> User Service (create profile)
Auth Service    --[user.registered]-----------> Search Service (index user)
Auth Service    --[notification.send-verification] -> Notification Service (email)
Auth Service    --[notification.send-password-reset] -> Notification Service (email)
Gateway         --[user.updated]--------------> Search Service (re-index user)
Chat Service    --[chat.message.created]------> Search Service (index message)
Media Service   --[media.process]-------------> Media Service (async processing)
```

### WebSocket

Gateway поддерживает постоянное Socket.IO-соединение с клиентом для доставки сообщений в реальном времени. Полный жизненный цикл описан в разделе [Session & WebSocket](#session--websocket).

---

## Хранение данных

### PostgreSQL — database per service

| Сервис       | База данных             |
| ------------ | ----------------------- |
| Auth         | `polygon_auth`          |
| User         | `polygon_user`          |
| Chat         | `polygon_chat`          |
| Media        | `polygon_media`         |
| Notification | `polygon_notification`  |

Каждый сервис владеет своей базой данных эксклюзивно. Межсервисных запросов к БД нет.

### Redis

- Кэширование сессий / токенов
- Rate limiting
- Pub/Sub для событий в реальном времени

---

## Shared Schemas (`@org/common`)

`libs/common` — фреймворк-независимая библиотека, импортируемая как клиентом, так и бэкендом. Это единый источник истины для правил валидации и констант.

### Zod-схемы

Определяются один раз, используются на обеих сторонах:

```typescript
// libs/common/src/schemas/auth.ts
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

**Фронтенд** — расширение схем для специфических нужд форм:

```typescript
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

**Бэкенд** — создание NestJS DTO через `createZodDto`. `ZodValidationPipe` автоматически валидирует входящие запросы:

```typescript
import { loginSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
```

**Swagger** — DTO, полученные из `createZodDto`, могут быть расширены декораторами `@ApiProperty` для документации API без дублирования логики валидации:

```typescript
export class CreateUserDto extends createZodDto(UserSchema) {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'User password', example: 'P@ssw0rd123' })
  password: string;
}
```

---

## Архитектура клиента

Клиент — это React 19 SPA, построенная по **Feature-Sliced Design (FSD)**. Каждый слой нарезан на **мини-пакеты** (один на slice/feature) для правильного code splitting — один большой пакет на слой собрал бы все зависимости вместе, ломая lazy loading.

### Слои FSD (нарезанные)

| Layer    | Паттерн пакета                 | Примеры                                          |
| -------- | ------------------------------ | ------------------------------------------------ |
| shared   | `@org/shared`                  | UI kit, API client (socket, authedFetch), theme  |
| entities | `@org/entities-{entity}`       | `@org/entities-user`, `@org/entities-chat`, `@org/entities-message` |
| features | `@org/features-{feature}`      | `@org/features-auth`, `@org/features-create-chat`, `@org/features-send-message`, `@org/features-emoji`, `@org/features-theme`, `@org/features-notifications`, `@org/features-upload-avatar`, `@org/features-infinite-scroll` |
| widgets  | `@org/widgets-{widget}`        | (пусто — не используется)                       |
| layouts  | `@org/layouts-{layout}`        | `@org/layouts-auth`, `@org/layouts-sidebar`, `@org/layouts-mobile` |
| pages    | `@org/pages-{page}`            | `@org/pages-login`, `@org/pages-register`, `@org/pages-chat-page`, `@org/pages-settings`, `@org/pages-profile`, `@org/pages-not-found` |

Приложение (`apps/client/messenger`) собирает эти срезы — роутер, провайдеры и страницы уровня app находятся там.

### Управление состоянием

| Область                    | Инструмент      | Где                                             |
| -------------------------- | --------------- | ----------------------------------------------- |
| Server state (данные API)  | TanStack Query  | `@org/entities-*` (queries + mutations на сущность) |
| Session state              | Zustand         | `@org/entities-user` → `session.store.ts`       |
| Chat state                 | Zustand         | `@org/entities-chat` → `chat.store.ts`          |
| Presence state             | Zustand         | `@org/entities-chat` → `presence.store.ts`      |
| UI state (тема)            | React Context   | `@org/shared` → `theme.tsx`                     |
| Состояние уведомлений      | Zustand (persist) | `@org/features-notifications` → `notification.store.ts` |

---

## Session & WebSocket

### Процесс аутентификации

Аутентификация основана на куках. Бэкенд устанавливает `HttpOnly` cookies при входе — клиент никогда не работает с токенами напрямую.

```
1. Пользователь отправляет форму входа
      │
      ▼
2. POST /api/auth/login → бэкенд устанавливает HttpOnly cookies (access + refresh)
      │
      ▼
3. setAuthenticated(true)
   └─ Zustand store обновлён (isAuthenticated: true, isLoading: false)
      │
      ▼
4. socket-middleware реагирует на изменение стора
   └─ isAuthenticated стал true → socket.connect() (withCredentials)
      │
      ▼
5. ProtectedRoute читает selectIsAuthenticated
   └─ isLoading: true  → рендерит <Spinner /> (проверка сессии)
   └─ isAuthenticated  → рендерит приложение
   └─ !isAuthenticated → редирект на /auth/login
```

### Загрузка сессии

При каждой загрузке приложения, перед рендерингом защищённых маршрутов, `AuthBootstrap` проверяет сессию:

```
App монтируется
  └─ AuthBootstrap вызывает GET /api/users/me (cookie отправляется автоматически)
       ├─ 200 OK  → setAuthenticated(true)
       └─ 401     → setAuthenticated(false)
            └─ ProtectedRoute редиректит на /auth/login
```

### Обновление токенов

`authedFetch` оборачивает каждый аутентифицированный API-вызов:

```
Запрос отправлен (cookies включены автоматически через credentials: 'include')
      │
  401 получен?
      │
      ├─ Нет → вернуть ответ
      │
      └─ Да → захватить mutex (предотвращает параллельные гонки обновления)
                  │
                  └─ POST /api/auth/refresh (refresh cookie отправляется автоматически)
                        │
                        ├─ Успех → бэкенд ротирует cookies → повтор оригинального запроса
                        └─ Ошибка → setAuthenticated(false) → редирект на логин
```

### Жизненный цикл WebSocket

```
Запуск приложения
  └─ initSocketMiddleware()
       └─ подписка на useSessionStore
            ├─ isAuthenticated стал true  → socket.connect()
            └─ isAuthenticated стал false → socket.disconnect()

Аутентификация сокета
  └─ socket.io настроен с withCredentials: true
       └─ cookies отправляются при каждом connect / reconnect автоматически

Пользователь открывает чат (/chats/:chatId)
  └─ useChatSocket(chatId) монтируется
       ├─ socket.emit('chat:join', { chatId })
       └─ socket.on('message:new', handler)
            └─ handler добавляет сообщение в кэш TanStack Query
                 └─ дедупликация по message.id

Пользователь покидает чат (компонент размонтируется)
  └─ socket.emit('chat:leave', { chatId })
  └─ socket.off('message:new', handler)

Пользователь выходит из системы
  └─ POST /api/auth/logout → бэкенд очищает cookies
  └─ setAuthenticated(false)
       └─ socket-middleware реагирует → socket.disconnect()
```

---

## Инфраструктура

| Сервис      | Образ                           | Порт(ы)       |
| ----------- | ------------------------------- | ------------- |
| PostgreSQL  | `postgres:17-alpine`            | 5432          |
| Redis       | `redis:7-alpine`                | 6379          |
| RabbitMQ    | `rabbitmq:3-management-alpine`  | 5672 / 15672  |
| MinIO       | `quay.io/minio/minio`           | 9000 / 9001   |
| Meilisearch | `meilisearch`                   | 7700          |

> **Prometheus + Grafana** — убраны (были нерабочими). Настройка с нуля запланирована.
