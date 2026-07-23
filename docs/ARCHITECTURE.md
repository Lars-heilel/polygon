# Architecture

## System Model

Polygon is an Nx monorepo with a React/Vite messenger SPA and NestJS services. The **API Gateway is the single entry point** for browser HTTP and Socket.IO traffic. Backend services communicate through RabbitMQ; the browser must never call a service directly.

The core architecture constraints are:

- **Database per service:** each service owns its PostgreSQL database and no other service queries it directly.
- **RabbitMQ service communication:** cross-service commands and domain events use `ClientProxy`/RabbitMQ, not synchronous service-to-service HTTP.
- **Shared schemas in `@org/common`:** Zod schemas and constants are framework-agnostic contracts shared by client and backend.
- **React Feature-Sliced Design mini-packages:** client slices are separate Nx packages so lazy pages do not pull an entire FSD layer into one bundle.

```text
React + Vite SPA (port 4200)
        |
        | HTTP /api and Socket.IO /socket.io
        v
API Gateway (port 3000)
        |
        | RabbitMQ RPC/events
        v
Auth | User | Chat | Media | Notification | Search services
        |       |       |         |              |
    PostgreSQL per service      MinIO       Meilisearch
        |
      Redis for sessions, rate limits, and realtime coordination
```

Local infrastructure is PostgreSQL, Redis, RabbitMQ, MinIO, and Meilisearch. The observability stack is documented in [OBSERVABILITY.md](./OBSERVABILITY.md).

## Services And Ownership

| Component | Responsibility | Persistent dependency |
| --- | --- | --- |
| API Gateway | Public HTTP API, cookies, guards, API-to-RMQ adaptation, Socket.IO delivery | Redis through auth/session integrations |
| Auth | Registration, login, cookie token issuance/rotation, OAuth, password and verification flows, session revocation | `polygon_auth` |
| User | Profiles and user-facing account data | `polygon_user` |
| Chat | Direct and saved-message chats, messages, read state, forwarding and attachment references | `polygon_chat` |
| Media | Upload initiation/confirmation, protected content delivery, metadata, avatar/history references | `polygon_media`, MinIO |
| Notification | Notification and subscription integration surface | `polygon_notification` |
| Search | User indexing and user search | Meilisearch |

Do not move ownership by reading another service's database. Add an RPC contract or event instead. Services should publish events after their own durable state change; consumers remain responsible for their own idempotency and error handling.

## Gateway And Security Boundaries

The gateway routes browser requests to the owning service over RabbitMQ and maps service failures to HTTP responses. Keep authorization at the public boundary and enforce domain ownership again in the service that changes data.

- Cookie-based authentication uses HttpOnly access and refresh cookies. The SPA uses `credentials: 'include'` and does not handle raw tokens.
- **`SessionGuard` is required on private gateway routes.** It validates the JWT and the Redis-backed session, so a revoked session is rejected even when a token has not expired.
- Private user-facing controllers also use `ActiveAccountGuard`; administrative surfaces add `RolesGuard`.
- New private controller endpoints must receive the same guard treatment as adjacent protected endpoints. Do not replace `SessionGuard` with a JWT-only check.
- The gateway must not log raw cookies, tokens, request bodies, presigned URLs, or unredacted identifiers.

### Browser Session Lifecycle

1. Login or refresh causes the backend to set HttpOnly cookies.
2. `AuthBootstrap` validates the session with `GET /api/users/me` before protected routes render.
3. `authedFetch` sends credentials, serializes refresh attempts with a mutex after a `401`, and retries only after a successful cookie rotation.
4. Session logout or revocation clears authenticated client state; protected requests then fail through `SessionGuard`.

Session/device management and administrative revocation must invalidate the Redis session record as part of the security contract. A successful-looking UI logout without server-side revocation is incomplete.

## Socket.IO Realtime Gateway

Socket.IO terminates at the gateway, not at individual services. Socket authentication uses the same cookie-backed session model and rejects banned or unauthenticated users.

- The client connects when session state becomes authenticated and disconnects when it becomes unauthenticated.
- Chat screens join and leave chat rooms explicitly.
- Realtime flow covers new messages, optimistic client-ID reconciliation, updates, deletes, read state, typing relays, and basic online/offline presence.
- Gateway handlers must authorize chat membership before room-scoped operations and must clean up listeners when a chat view unmounts.
- A ban or revoked session must prevent continued private access; keep HTTP and socket authorization behavior aligned when extending either surface.

## Data And Integration Rules

### PostgreSQL

| Service | Database |
| --- | --- |
| Auth | `polygon_auth` |
| User | `polygon_user` |
| Chat | `polygon_chat` |
| Media | `polygon_media` |
| Notification | `polygon_notification` |

Repositories are the only layer that talks to Prisma. Controllers and domain services use repository interfaces rather than reaching into another service's database or Prisma client.

### Redis

Redis supports the session/revocation contract, rate limiting, and realtime coordination. Treat its availability as security-relevant: do not silently bypass session validation if Redis cannot answer the guard's query.

### MinIO And Media

The media flow is presigned upload initialization, client upload, confirmation from `PENDING` to `READY`, and protected streaming/download through the gateway. Chat attachment access is member-scoped. File deletion must retain the reference-aware checks that prevent removal while messages or other records still reference the file.

The client renders images, video, audio, voice, circle video, and generic files. Do not document or depend on an asynchronous thumbnail, waveform, video-preview, or orphan-cleanup pipeline unless it is implemented and verified separately.

### Meilisearch

The implemented public search surface is user search and user reindexing. Keep index updates event-driven through the gateway/service integration. Do not claim message search merely because chat events exist.

## Shared Contracts

`libs/common` is the source of truth for shared validation and constants. Define a Zod schema once, then:

- consume or extend it in client forms;
- expose it to Nest through `createZodDto` and `ZodValidationPipe`;
- keep protocol payloads and event names typed from the same contract where practical.

Do not duplicate validation rules in a client-only form and a backend DTO. Add an explicit client-only refinement only when it is genuinely presentation-specific.

## Client Composition

The client follows Feature-Sliced Design with package-level slices:

| Layer | Package pattern | Examples |
| --- | --- | --- |
| shared | `@org/shared` | UI primitives, API client, socket, theme, observability helpers |
| entities | `@org/entities-*` | user, chat, message state and queries |
| features | `@org/features-*` | authentication, send message, chat socket, uploads, notifications |
| layouts | `@org/layouts-*` | auth, sidebar, mobile layouts |
| pages | `@org/pages-*` | login, chat page, settings, profile |

Each package exposes its supported public API through its root `index.ts`. Consumers import from the slice package, never an internal `src` path. Keep server state in TanStack Query, scoped client state in the owning Zustand store, and shared theme state in `@org/shared`.

`@org/shared` owns reusable UI primitives, semantic tokens, global styles, and shared browser infrastructure. Feature and page code should use it before creating another local button, modal, loader, or visual state implementation.

## Observability Architecture

Backend services use structured Pino/Nest logging, metrics and health endpoints from backend core, and OpenTelemetry instrumentation when `OTEL_ENABLED=true`. The repository contains Grafana, Prometheus, Loki, Tempo, and Alloy configuration for a local single-host stack.

Every cross-service flow must be diagnosable as a sequence of safe lifecycle events at the gateway and the owning service. Use counts, booleans, categories, durations, and results instead of raw user data or payloads. The concrete rules and runbook are in [OBSERVABILITY.md](./OBSERVABILITY.md).
