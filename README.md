# Polygon

_By Lars Heilel (Igor Shevchenko)_

> **Status:** 🚧 In Development  
> **Architecture:** Microservices (NestJS) + React SPA (FSD) + RabbitMQ + PostgreSQL/Redis/MinIO/Meilisearch

---

## Documentation Map

| Раздел                                                     | Описание                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [📋 Техническое задание (Specs)](./docs/specs/SPEC.md)     | Бизнес-требования, кейсы, acceptance criteria по каждой системе |
| [🏗️ Архитектура](./docs/ARCHITECTURE.md)                   | Микросервисы, FSD, RabbitMQ, схема системы                      |
| [🛠️ Разработка](./docs/DEVELOPMENT.md)                     | Nx workspace, код-стайл, модульные границы                      |
| [🚀 Запуск (SETUP)](./docs/SETUP.md)                       | Docker, базы, Prisma, окружение                                 |
| [⚠️ Подводные камни (Gotchas)](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4, env, Prisma пути                                   |

### Systems Specs

| Система                                                      | Статус          |
| ------------------------------------------------------------ | --------------- |
| [API Gateway](./docs/specs/gateway-service.md)               | 🟡 Почти готово |
| [Auth Service](./docs/specs/auth-service.md)                 | 🟢 Почти готово |
| [User Service](./docs/specs/user-service.md)                 | 🟡 Почти готово |
| [Chat Service](./docs/specs/chat-service.md)                 | 🔴 В разработке |
| [Media Service](./docs/specs/media-service.md)               | 🟡 Почти готово |
| [Notification Service](./docs/specs/notification-service.md) | 🔴 В разработке |
| [Search Service](./docs/specs/search-service.md)             | 🔴 В разработке |
| [Client (Messenger SPA)](./docs/specs/client-messenger.md)   | 🔴 В разработке |
| [Infrastructure](./docs/specs/infrastructure.md)             | 🟡 Почти готово |

---

## Quick Start

```bash
# Initial setup — Docker, DB, Prisma, migrations
./scripts/bootstrap.sh

# Dev — все сервисы
npm run dev:all
```
