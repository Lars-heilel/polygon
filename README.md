# Polygon

_By Lars Heilel (Igor Shevchenko)_

## Applications

> **Status:** 🚧 In Development

| Application     | README                                                               |
| --------------- | -------------------------------------------------------------------- |
| Messenger (SPA) | [apps/client/messenger/README.md](./apps/client/messenger/README.md) |

---

## Tech Stack

### Frontend

- **Core:** React 19 (SPA)
- **Build Tool:** Vite
- **State Management:** Zustand
- **Data Fetching:** TanStack Query v5 (React Query)
- **Routing:** React Router 7
- **Forms & Validation:** React Hook Form + Zod
- **Styling:** Tailwind CSS 4, class-variance-authority (CVA), tailwind-merge
- **UI Components:** Sonner (notifications), Emoji Mart (emojis), React Syntax Highlighter
- **Virtualization:** TanStack Virtual (for high-performance infinite scroll)

### Backend

- **Framework:** NestJS
- **Real-time:** Socket.io (WebSockets)
- **Database (ORM):** Prisma
- **Messaging & Queues:** RabbitMQ (Amqp)
- **Caching & Sessions:** Redis (ioredis)
- **Auth:** Passport.js (JWT, OAuth: Google, GitHub, Yandex)
- **Search Engine:** Meilisearch
- **Validation:** nestjs-zod
- **Emails:** react-emails,nodemailer

### Infrastructure & Tooling

- **Monorepo Management:** [Nx](https://nx.dev)
- **Testing:** Vitest, Jest, Playwright (E2E), MSW (Mock Service Worker)
- **Logging & Monitoring:** Pino, Prometheus, OpenTelemetry
- **Linting & Formatting:** ESLint, Prettier
- **Documentation:** Storybook, Swagger (OpenAPI)

---

## Quick Start

```bash
# Initial setup — Docker, DB, Prisma, migrations
./scripts/bootstrap.sh
```

---

## Documentation

| File                                                   | Description                                                |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [docs/SETUP.md](./docs/SETUP.md)                       | Environment setup, Docker, and database configuration      |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)           | Project structure, coding standards, and Nx commands       |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)         | Microservices, FSD, and inter-service communication        |
| [docs/MONOREPO_GOTCHAS.md](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4 in Nx, environment variables, and Prisma paths |
