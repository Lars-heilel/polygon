# Polygon

_By Lars Heilel (Igor Shevchenko)_

> **Status:** 🚧 In Development

## Приложения

| Приложение      | README                                                               |
| --------------- | -------------------------------------------------------------------- |
| Messenger (SPA) | [apps/client/messenger/README.md](./apps/client/messenger/README.md) |

## Стек

| Категория          | Технология             | Версия |
| ------------------ | ---------------------- | ------ |
| **Runtime**        | Node.js                | 20.x   |
| **Язык**           | TypeScript             | ~5.9   |
| **Backend**        | NestJS                 | ^11.0  |
| **База данных**    | PostgreSQL             | 17     |
| **ORM**            | Prisma                 | ^7.5   |
| **Кеш**            | Redis                  | 7      |
| **Message Broker** | RabbitMQ               | 3      |
| **Монорепо**       | Nx                     | 22.6   |
| **Frontend**       | React 19 + Vite        | ^7.0   |
| **CSS**            | Tailwind CSS           | v4     |
| **Валидация**      | Zod                    | ^4.3   |
| **Инфраструктура** | Docker, Docker Compose | —      |

---

## Быстрый старт

```bash
# Первичная настройка — Docker, БД, Prisma, миграции
./scripts/bootstrap.sh

cp .env.example .env
docker compose up -d

# Запустить любой сервис
npx nx serve @org/gateway
npx nx serve @org/messenger
```

---

## Документация

| Файл | Описание |
|------|----------|
| [docs/SETUP.md](./docs/SETUP.md) | Настройка окружения, Docker, базы данных |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Структура проекта, стандарты кода, Nx команды |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Микросервисы, FSD, межсервисное взаимодействие |
| [docs/MONOREPO_GOTCHAS.md](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4 в Nx, env-переменные, Prisma пути |
