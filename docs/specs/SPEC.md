# Polygon Messenger Product Specification

## Purpose

Polygon is a full-stack messenger implemented as an Nx monorepo. This document is the as-built product contract: it describes behavior available in the current application.

## Implemented Capabilities

- **API Gateway:** HTTP entry point, cookie/session guards, OAuth redirects, Socket.IO, and service RPC bridge.
- **Auth Service:** Credentials, OAuth, email verification, password reset, refresh rotation, sessions, and administrative bans.
- **User Service:** Public and current-user profiles, profile changes, and avatar state.
- **Chat Service:** Direct and self chats, messages, attachments, read markers, edits, deletes, forwarding, and link previews.
- **Media Service:** Direct uploads, confirmed media metadata, protected content access, histories, and reference-aware deletion.
- **Notification Service:** Verification/reset email dispatch and push subscription endpoints.
- **Search Service:** User indexing, user search, and user reindexing through Meilisearch.
- **Messenger SPA:** Authentication, chats, media playback/viewing, profile/settings, session devices, themes, and notification settings.

## Subsystem Specifications

| Spec | Contract |
| --- | --- |
| [API Gateway](./gateway-service.md) | Browser HTTP entry point, session guards, RPC adaptation, Socket.IO, and administrative API surface |
| [Auth Service](./auth-service.md) | Credentials, OAuth, verification, password reset, session rotation/revocation, and bans |
| [User Service](./user-service.md) | Current-user profile, public profile, profile updates, and avatar state |
| [Chat Service](./chat-service.md) | Direct/self chats, messages, attachments, read state, edit/delete, forwarding, presence, and typing |
| [Media Service](./media-service.md) | Upload initialization, confirmation, protected content access, avatar/history references, and deletion checks |
| [Notification Service](./notification-service.md) | Verification/reset email dispatch plus VAPID and push-subscription storage surface |
| [Search Service](./search-service.md) | User indexing, user search, and user reindexing through Meilisearch |
| [Messenger SPA](./client-messenger.md) | React client behavior for auth, chats, media, profile/settings, sessions, themes, and mobile-responsive controls |
| [Infrastructure](./infrastructure.md) | Local runtime dependencies, service ownership, configuration, observability stack, and operational boundaries |

## Runtime Contracts

- Authentication uses HttpOnly access and refresh cookies. Redis-backed session state is checked for protected gateway routes.
- Direct conversations and one-user saved-message chats are the chat types exposed by the current application.
- PostgreSQL databases are owned per service. RabbitMQ carries service events, MinIO stores media, Meilisearch serves user search, and Socket.IO carries real-time chat state.
- Media rendering in the Messenger SPA supports images, videos, audio, voice messages, circle videos, and documents.

## Acceptance Criteria

- **SYSTEM-1:** A valid active session gives a user access to protected Messenger and gateway operations; a revoked session is denied.
- **SYSTEM-2:** A user can find another user, open a direct conversation or saved-message chat, and exchange text or media messages.
- **SYSTEM-3:** The application synchronizes message, edit, delete, read, presence, and typing updates through Socket.IO.
- **SYSTEM-4:** Message history is paginated and media content is served only through its authorized surface.
- **SYSTEM-5:** Profile, avatar, session-device, theme, and notification-setting surfaces use the service APIs described by the subsystem specifications.

## Exclusions

Calls, group chats and group calls, offline/PWA install or caching behavior, internationalization, message search/indexing, last-seen and custom statuses, user blocking, server-side thumbnail/waveform/video-preview pipelines, orphan cleanup, and notification delivery guarantees are not provided as current product behavior.
