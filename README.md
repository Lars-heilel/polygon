# Polygon

_By Lars Heilel (Igor Shevchenko)_

Polygon is a full-stack messenger built as an Nx monorepo. It combines a React messenger SPA, a NestJS API Gateway and backend services, service-owned PostgreSQL databases, RabbitMQ communication, Redis-backed sessions, MinIO media storage, and Socket.IO real-time delivery.

## Tech Stack

| Area                 | Stack                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| Monorepo             | Nx, npm workspaces                                                                    |
| Client               | React, Vite, TypeScript, Feature-Sliced Design, TanStack Query, Zustand, Tailwind CSS |
| Gateway and services | NestJS, RabbitMQ `ClientProxy`, Socket.IO, Zod DTO validation                         |
| Data                 | PostgreSQL per service, Prisma, Redis, MinIO, Meilisearch                             |
| Auth and sessions    | HttpOnly cookies, JWT access/refresh tokens, Redis-backed session revocation          |
| Observability        | Pino/Nest logging, OpenTelemetry, Prometheus, Grafana, Loki, Tempo, Alloy             |
| Testing              | Jest, Testing Library, Supertest, MSW, Playwright, Nx task orchestration              |

## Documentation Routing

Use the engineering references for implementation and maintenance work.

| Document                                       | Use it for                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Architecture](./docs/ARCHITECTURE.md)         | Runtime model, service ownership, security boundaries, realtime flow, and shared contracts                   |
| [Development Guide](./docs/DEVELOPMENT.md)     | Nx workflow, coding conventions, FSD boundaries, logging rules, and testing strategy                         |
| [Setup Guide](./docs/SETUP.md)                 | Local environment, Docker infrastructure, Prisma notes, startup commands, and remote device testing          |
| [Monorepo Gotchas](./docs/MONOREPO_GOTCHAS.md) | Tailwind v4 source paths, Vite proxy, Prisma env lookup, MSW setup, Gateway Supertest, and Nx cache behavior |
| [Observability](./docs/OBSERVABILITY.md)       | Logging, metrics, tracing, dashboards, redaction rules, and diagnostic runbooks                              |

## Implemented System

- Cookie-based authentication with email/password, GitHub and Google OAuth, email verification, password reset, refresh-token rotation, and revocation of Redis-backed sessions. Private routes reject revoked sessions.
- Direct chats and self chats with cursor-paginated history, unread counters, read state, typing indicators, online presence, and real-time Socket.IO updates.
- Text, image, video, audio, voice, circle video, and document messages with MinIO-backed uploads and protected media delivery.
- Message editing, deletion for everyone or for self, copying, and forwarding with durable original-author snapshots.
- Link previews, image and video viewers, chat media panels, waveform voice/audio messages, a compact global audio player, and client-side media rendering and playback.
- User search, profiles, avatar history, settings, device and session management, and light and dark themes.
- Push subscription and VAPID-key API surfaces, plus sanitized frontend error reporting and structured backend observability.
- Administrative API support for user details, sessions, bans, and related moderation data.

## Architecture

The React/Vite messenger client communicates through the NestJS API Gateway. The gateway exposes HTTP and WebSocket entry points and routes work to the Auth, User, Chat, Media, Notification, and Search services through RabbitMQ. Each data-owning service has its own PostgreSQL database; Redis stores session state and supports cache and real-time coordination. MinIO stores uploaded media.

The client is organized into sliced Feature-Sliced Design packages under `libs/client`. Shared schemas and utilities live in common libraries, while Nx manages project boundaries, dependency graphs, caching, and builds.
