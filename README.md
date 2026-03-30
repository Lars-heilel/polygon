# Polygon

_By Lars Heilel (Igor Shevchenko)_

> **Status:** 🚧 In Development

---

## Applications

| App                                            | Description                |
| ---------------------------------------------- | -------------------------- |
| [Messenger](./apps/client/messenger/README.md) | Real-time chat application |

---

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
| **Frontend Build** | Vite                   | ^7.0    |
| **UI**             | React                  | ^19.0   |
| **State**          | Zustand                | —       |
| **Data Fetching**  | TanStack Query         | —       |
| **WebSocket**      | Socket.IO              | —       |
| **CSS**            | Tailwind CSS           | v4      |
| **Validation**     | Zod                    | ^4.3    |
| **Infrastructure** | Docker, Docker Compose | —       |

---

## Documentation

| File                                           | Description                                         |
| ---------------------------------------------- | --------------------------------------------------- |
| [Setup](./docs/SETUP.md)                       | Environment setup, Docker, databases                |
| [Development](./docs/DEVELOPMENT.md)           | Project structure, code standards, Nx commands      |
| [Architecture](./docs/ARCHITECTURE.md)         | Microservices design, client FSD, communication     |
| [Monorepo Gotchas](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4 in Nx, env variables, Prisma paths      |
| [Observability](./docs/observability.md)       | Logging, metrics, health checks, Prometheus/Grafana |
