# Polygon

_By Lars Heilel (Igor Shevchenko)_

## Applications
> **Status:** 🚧 In Development
| Application     | README                                                               |
| --------------- | -------------------------------------------------------------------- |
| Messenger (SPA) | [apps/client/messenger/README.md](./apps/client/messenger/README.md) |

## Tech Stack

| Category           | Technology             | Version |
| ------------------ | ---------------------- | ------- |
| **Runtime**        | Node.js                | 20.x    |
| **Language**       | TypeScript             | ~5.9    |
| **Backend**        | NestJS                 | ^11.0   |
| **Database**       | PostgreSQL             | 17      |
| **ORM**            | Prisma                 | ^7.5    |
| **Cache**          | Redis                  | 7       |
| **Message Broker** | RabbitMQ               | 3       |
| **Monorepo**       | Nx                     | 22.6    |
| **Frontend**       | React 19 + Vite        | ^7.0    |
| **CSS**            | Tailwind CSS           | v4      |
| **Validation**     | Zod                    | ^4.3    |
| **Infrastructure** | Docker, Docker Compose | —       |

---

## Quick Start

```bash
# Initial setup — Docker, DB, Prisma, migrations
./scripts/bootstrap.sh

cp .env.example .env
docker compose up -d

# Run any service
npx nx serve @org/gateway
npx nx serve @org/messenger
```

---

## Documentation

| File | Description |
|------|----------|
| [docs/SETUP.md](./docs/SETUP.md) | Environment setup, Docker, and database configuration |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Project structure, coding standards, and Nx commands |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Microservices, FSD, and inter-service communication |
| [docs/MONOREPO_GOTCHAS.md](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4 in Nx, environment variables, and Prisma paths |
