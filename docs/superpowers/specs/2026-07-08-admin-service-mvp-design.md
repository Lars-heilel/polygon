# Admin Service MVP Design

**Date:** 2026-07-08  
**Status:** Approved for implementation planning

## Goal

Deliver the first administrative workflow as a separate React SPA without introducing a backend service that owns no data. The MVP covers access control, user discovery and inspection, session management, and immediate temporary or permanent account bans.

Emergency reset, storage maintenance, broadcasts, account cleanup, and Meilisearch maintenance are separate follow-up phases.

## Architecture

The Admin SPA lives in `apps/client/admin` and reuses the workspace's existing shared UI, API client, authentication state, and FSD conventions. Nginx serves it under `/admin`. The existing messenger displays an Admin shield link beside Settings only for `CREATOR` and `ADMIN`; the link performs a full navigation to `/admin` because Admin is a separate application.

Administrative HTTP routes live under `/api/admin` in the Gateway. The Gateway remains an orchestration boundary and delegates to the existing domain owners:

- Search Service searches users.
- User Service returns profile data.
- Auth Service owns roles, OAuth accounts, sessions, and ban state.
- Media Service returns avatar history.

No standalone admin backend service or admin database is introduced in this phase.

## Authorization

The existing roles are retained with this administrative hierarchy:

1. `CREATOR` has the highest administrative authority.
2. `ADMIN` can manage `MODERATOR` and `USER` accounts.
3. `MODERATOR` and `USER` have no Admin SPA or Admin API access.

Both `CREATOR` and `ADMIN` may access the Admin SPA and `/api/admin/*`. An `ADMIN` cannot manage another `ADMIN` or a `CREATOR`. A `CREATOR` can manage every other account, including `ADMIN`, but cannot ban or revoke their own account.

The messenger hides the Admin link from unauthorized roles. The Admin SPA redirects authenticated users with an invalid role to `/admin/404`; unauthenticated users go through the existing login flow. These client checks are only presentation controls. Every Admin API endpoint independently enforces the role hierarchy through the Gateway's `RolesGuard` and returns `403` for insufficient authority.

## Auth Data Model

`Credentials` in `polygon_auth` gains additive nullable/defaulted columns:

```prisma
isBanned   Boolean   @default(false) @map("is_banned")
bannedUntil DateTime? @map("banned_until")
banReason  String?   @map("ban_reason")
bannedAt   DateTime? @map("banned_at")
bannedBy   String?   @map("banned_by")
```

`bannedBy` stores the administrator credentials ID for audit context. The migration only adds columns and defaults; it does not rewrite or delete existing account/session data.

## Ban Contract

The Gateway accepts a duration enum rather than a client-calculated timestamp:

- `ONE_HOUR`
- `ONE_DAY`
- `SEVEN_DAYS`
- `THIRTY_DAYS`
- `PERMANENT`

Reason presets are `SPAM`, `BULLYING`, `UNACCEPTABLE_CONTENT`, `SUSPICIOUS_ACTIVITY`, and `CUSTOM`. A custom reason is required for `CUSTOM` and must contain 5-500 trimmed characters. Auth Service resolves duration against server time and stores the final display reason.

An active ban is permanent when `isBanned` is true and `bannedUntil` is null, or temporary when `bannedUntil` is in the future. An expired temporary ban is treated as inactive and its database fields are cleared during the next login or refresh.

## Immediate Enforcement

On ban, Auth Service:

1. Validates actor/target hierarchy and duration/reason input.
2. Updates the credentials ban fields and revokes all SQL sessions.
3. Deletes active session entries from Redis.
4. Writes a Redis ban marker containing reason and expiry information. Temporary markers use a TTL ending at `bannedUntil`; permanent markers have no TTL.
5. Returns success only after the required database and Redis state is established.

The Gateway checks the Redis marker after JWT verification for every protected HTTP request. This prevents an already issued access token from bypassing an immediate ban and allows the Gateway to return a structured `403` containing `reason` and `bannedUntil`. The same check applies to WebSocket authentication. After a successful Admin ban RPC, the Gateway disconnects all sockets registered for the target user.

If required Redis state cannot be established, the ban command returns `503` and must not report a successful partial operation. Manual unban clears the Auth fields and Redis marker. Expiring a temporary marker automatically restores request access; Auth Service later normalizes the persisted fields on login or refresh.

## Admin API

The MVP exposes:

```text
GET    /api/admin/users?query=
GET    /api/admin/users/:id
GET    /api/admin/users/:id/sessions
DELETE /api/admin/users/:id/sessions/:sessionId
DELETE /api/admin/users/:id/sessions
POST   /api/admin/users/:id/ban
DELETE /api/admin/users/:id/ban
```

The detail endpoint aggregates profile, role/ban state, OAuth providers, avatar history, and session summary. Ban and unban operations are idempotent. Invalid state/input returns `400` or `409`; missing users return `404`; hierarchy violations return `403`.

## Admin SPA

Routes:

- `/admin` provides an overview and direct user search.
- `/admin/users` provides user search and a result table.
- `/admin/users/:id` provides profile, role, OAuth providers, avatar history, active sessions, and ban state.
- `/admin/404` handles unauthorized roles and unknown Admin routes.

The ban dialog provides duration presets and reason presets. Selecting `CUSTOM` reveals the validated text field. Successful commands invalidate the affected list/detail queries. The application includes a clear link back to the messenger.

## Testing

- Unit tests cover role hierarchy, self-management denial, duration calculation, custom reason validation, permanent bans, and expired-ban normalization.
- Auth integration tests cover the additive migration, database state, Redis marker TTL, permanent markers, session revocation, unban, and Redis failure behavior.
- Gateway end-to-end tests cover role access, target hierarchy, structured ban `403`, and Admin route responses.
- Admin SPA tests cover route guards, conditional messenger link visibility, ban form behavior, and query invalidation.
- A runtime scenario verifies that banning an online user causes the next HTTP request to return `403` and disconnects their WebSocket.
- Migration verification runs against existing representative data and confirms no account/session rows are removed.

## Deferred Phases

The following remain explicitly outside this MVP:

- Emergency reset across Chat, Media, User, and Search.
- MinIO usage statistics and orphan cleanup.
- System WebSocket broadcasts.
- User/message index rebuild controls.
- Cleanup of unverified accounts.
- Manual password reset and forced email verification.

Each deferred capability requires its own design because it introduces destructive operations, cross-service coordination, or additional audit requirements.
