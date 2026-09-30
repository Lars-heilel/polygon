# Polygon — Fast, Private Messenger for Teams

Developed by **Igor Shevchenko**.

## Tech Stack

**Frontend (`apps/client/*`, `libs/client/*`)**

- React 19 + Vite 7 SPA, React Router 7, Zustand, TanStack Query / Virtual
- Tailwind CSS v4, Socket.IO client, Storybook, Vitest / Jest

**Backend (`apps/backend/*`, `libs/backend/*`)**

- NestJS 11 API Gateway + microservices: auth, user, chat, media, notification, search
- Database-per-service via Prisma + PostgreSQL , Redis
- RabbitMQ events, Socket.IO WebSockets, MinIO media storage, Meilisearch
- OpenTelemetry + Pino logging, Swagger docs, Jest / Supertest

**Platform / Workspace**

- Nx 22 monorepo, TypeScript, ESLint + Prettier
- Docker Compose: Postgres, Redis, MinIO, RabbitMQ, Meilisearch

## Screenshots

> 📱 All screens, including mobile views, are available in the [docs/screenshots/app](docs/screenshots/app) folder.

### Landing

[<img src="docs/screenshots/app/landing.png" width="800" alt="Polygon landing — desktop" />](docs/screenshots/app/landing.png)

### Messenger

[<img src="docs/screenshots/app/messenger.png" width="800" alt="Polygon messenger — desktop, media and audio messages" />](docs/screenshots/app/messenger.png)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Monorepo Gotchas](docs/MONOREPO_GOTCHAS.md)
