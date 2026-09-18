# Polygon — Fast, Private Messenger for Teams

Developed by **Igor Shevchenko**.

### Landing — Desktop

![Polygon landing — desktop](docs/screenshots/app/lending.png)

### Messenger — Desktop

![Polygon messenger — desktop, media and audio messages](docs/screenshots/app/messenger.png)

### Mobile

<table>
  <tr>
    <td><img src="docs/screenshots/app/mobile-lending.png" width="280" alt="Polygon landing — mobile" /></td>
    <td><img src="docs/screenshots/app/mobile-messenger.png" width="280" alt="Polygon messenger — mobile, media and audio messages" /></td>
  </tr>
</table>

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

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Monorepo Gotchas](docs/MONOREPO_GOTCHAS.md)
