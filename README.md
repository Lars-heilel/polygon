# Polygon

_By Lars Heilel (Igor Shevchenko)_

Polygon is a full-stack messenger built as an Nx monorepo. It combines a React messenger SPA, a NestJS API Gateway and backend services, service-owned PostgreSQL databases, RabbitMQ communication, Redis-backed sessions, MinIO media storage, and Socket.IO real-time delivery.

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

## Documentation Map

| Document | Purpose |
| --- | --- |
| [Product Specification](./docs/specs/SPEC.md) | As-built product behavior and system map |
| [Architecture](./docs/ARCHITECTURE.md) | Runtime architecture and service responsibilities |
| [Development Guide](./docs/DEVELOPMENT.md) | Nx workflow, conventions, boundaries, and maintenance rules |
| [Setup Guide](./docs/SETUP.md) | Local infrastructure, environment, and startup commands |
| [Monorepo Gotchas](./docs/MONOREPO_GOTCHAS.md) | Non-obvious Nx, Vite, Tailwind, Prisma, and testing notes |
| [Observability](./docs/OBSERVABILITY.md) | Logging, diagnostics, and data-safety contracts |

## Verification

```bash
npm exec nx test @org/gateway
npm exec nx test @org/messenger
npm exec nx build @org/gateway
npm exec nx build @org/messenger
```
