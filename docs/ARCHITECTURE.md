# Архитектура / Architecture

[← На главную](../README.md) | [Для разработчиков](./DEVELOPMENT.md) | [Для AI агентов](./AI-AGENTS.md)

---

## 🏗 Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│                    (HTTP / WebSocket)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (опционально)                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    User       │   │    Auth       │   │    Chat       │
│   Service     │   │   Service     │   │   Service     │
│   (3001)      │   │   (3002)      │   │   (3003)      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │           Message Broker              │
        │            RabbitMQ                   │
        │         (5672 / 15672)                │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Media      │   │ Notification  │   │   PostgreSQL  │
│   Service     │   │   Service     │   │   (5432)      │
│   (3004)      │   │   (3005)      │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │     Redis     │
                    │    (6379)     │
                    │  (cache/queue)│
                    └───────────────┘
```

---

## 📦 Микросервисы

### User Service (3001)
**Ответственность:** Управление профилями пользователей

**Функции:**
- CRUD операции с пользователями
- Поиск пользователей
- Управление профилями (аватар, био)

**База данных:** `polygon_user`

**Связи:**
- Auth — валидация токенов
- Chat — данные пользователей в чатах
- Media — загрузка аватаров

---

### Auth Service (3002)
**Ответственность:** Аутентификация и авторизация

**Функции:**
- Регистрация / вход
- JWT токены (access/refresh)
- Ролевая модель (USER, ADMIN, MODERATOR)
- Блокировка аккаунтов

**База данных:** `polygon_auth`

**Связи:**
- User — получение данных пользователя
- Notification — уведомления о входе
- Все сервисы — валидация токенов

---

### Chat Service (3003)
**Ответственность:** Чаты и сообщения

**Функции:**
- Создание/удаление чатов
- Управление участниками
- Отправка/получение сообщений
- История сообщений

**База данных:** `polygon_chat`

**Связи:**
- User — данные участников
- Notification — уведомления о сообщениях
- Media — отправка файлов

---

### Media Service (3004)
**Ответственность:** Работа с файлами

**Функции:**
- Загрузка файлов
- Хранение метаданных
- CDN интеграция (опционально)

**База данных:** `polygon_media`

**Связи:**
- Chat — файлы в сообщениях
- User — аватары

---

### Notification Service (3005)
**Ответственность:** Уведомления

**Функции:**
- Email уведомления
- Push уведомления
- Внутренние уведомления

**База данных:** `polygon_notification`

**Связи:**
- RabbitMQ — потребление событий
- Auth — уведомления о безопасности

---

## 🔄 Межсервисное взаимодействие

### Синхронное (HTTP)
```
User Service → Auth Service: валидация токена
Chat Service → User Service: получение данных пользователя
```

### Асинхронное (RabbitMQ)
```
Auth Service --[user.created]--> Notification Service
Chat Service --[message.sent]--> Notification Service
Media Service --[file.uploaded]--> Chat Service
```

---

## 🗄 Базы данных

### PostgreSQL
Каждый сервис имеет свою БД (Database per Service):

| Сервис | БД | Том |
|--------|-----|-----|
| User | `polygon_user` | `postgres_data` |
| Auth | `polygon_auth` | `postgres_data` |
| Chat | `polygon_chat` | `postgres_data` |
| Media | `polygon_media` | `postgres_data` |
| Notification | `polygon_notification` | `postgres_data` |

### Redis
- Кэширование частых запросов
- Сессии пользователей
- Rate limiting

### Prisma ORM
Каждый сервис имеет свою Prisma схему:
```
libs/backend/<service>/src/database/prisma/schema.prisma
```

---

## 📁 Monorepo структура (Nx)

```
polygon/
├── nx.json                 # Nx конфигурация
├── package.json            # Зависимости workspace
├── tsconfig.base.json      # Базовый TypeScript config
│
├── libs/
│   └── backend/
│       ├── user/
│       │   ├── src/
│       │   ├── prisma/
│       │   └── package.json
│       ├── auth/
│       └── chat/
│
└── docker-compose.yml      # Инфраструктура
```

**Преимущества Nx:**
- Граф зависимостей
- Affected commands (только изменённые проекты)
- Кэширование сборок
- Генераторы кода

---

# Architecture

[← Home](../README.md) | [For Developers](./DEVELOPMENT.md) | [For AI Agents](./AI-AGENTS.md)

---

## 🏗 Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│                    (HTTP / WebSocket)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (optional)                   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    User       │   │    Auth       │   │    Chat       │
│   Service     │   │   Service     │   │   Service     │
│   (3001)      │   │   (3002)      │   │   (3003)      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │           Message Broker              │
        │            RabbitMQ                   │
        │         (5672 / 15672)                │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Media      │   │ Notification  │   │   PostgreSQL  │
│   Service     │   │   Service     │   │   (5432)      │
│   (3004)      │   │   (3005)      │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │     Redis     │
                    │    (6379)     │
                    │  (cache/queue)│
                    └───────────────┘
```

---

## 📦 Microservices

### User Service (3001)
**Responsibility:** User profile management

**Functions:**
- User CRUD operations
- User search
- Profile management (avatar, bio)

**Database:** `polygon_user`

**Dependencies:**
- Auth — token validation
- Chat — user data in chats
- Media — avatar uploads

---

### Auth Service (3002)
**Responsibility:** Authentication & authorization

**Functions:**
- Registration / login
- JWT tokens (access/refresh)
- Role-based access (USER, ADMIN, MODERATOR)
- Account locking

**Database:** `polygon_auth`

**Dependencies:**
- User — user data retrieval
- Notification — login notifications
- All services — token validation

---

### Chat Service (3003)
**Responsibility:** Chats & messaging

**Functions:**
- Create/delete chats
- Member management
- Send/receive messages
- Message history

**Database:** `polygon_chat`

**Dependencies:**
- User — member data
- Notification — message notifications
- Media — file sharing

---

### Media Service (3004)
**Responsibility:** File handling

**Functions:**
- File uploads
- Metadata storage
- CDN integration (optional)

**Database:** `polygon_media`

**Dependencies:**
- Chat — message attachments
- User — avatars

---

### Notification Service (3005)
**Responsibility:** Notifications

**Functions:**
- Email notifications
- Push notifications
- In-app notifications

**Database:** `polygon_notification`

**Dependencies:**
- RabbitMQ — event consumption
- Auth — security notifications

---

## 🔄 Inter-service Communication

### Synchronous (HTTP)
```
User Service → Auth Service: token validation
Chat Service → User Service: get user data
```

### Asynchronous (RabbitMQ)
```
Auth Service --[user.created]--> Notification Service
Chat Service --[message.sent]--> Notification Service
Media Service --[file.uploaded]--> Chat Service
```

---

## 🗄 Databases

### PostgreSQL
Each service has its own database (Database per Service):

| Service | Database | Volume |
|---------|----------|--------|
| User | `polygon_user` | `postgres_data` |
| Auth | `polygon_auth` | `postgres_data` |
| Chat | `polygon_chat` | `postgres_data` |
| Media | `polygon_media` | `postgres_data` |
| Notification | `polygon_notification` | `postgres_data` |

### Redis
- Cache frequent queries
- User sessions
- Rate limiting

### Prisma ORM
Each service has its own Prisma schema:
```
libs/backend/<service>/src/database/prisma/schema.prisma
```

---

## 📁 Monorepo Structure (Nx)

```
polygon/
├── nx.json                 # Nx configuration
├── package.json            # Workspace dependencies
├── tsconfig.base.json      # Base TypeScript config
│
├── libs/
│   └── backend/
│       ├── user/
│       │   ├── src/
│       │   ├── prisma/
│       │   └── package.json
│       ├── auth/
│       └── chat/
│
└── docker-compose.yml      # Infrastructure
```

**Nx Benefits:**
- Dependency graph
- Affected commands (only changed projects)
- Build caching
- Code generators
