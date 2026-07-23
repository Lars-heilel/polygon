# Auth Service Specification

## Purpose

The Auth Service owns account credentials, identity-provider sign-in, verification and recovery tokens, refresh-token sessions, and account-ban enforcement.

## Implemented Capabilities

- Email/password registration and login with login rate limiting.
- HttpOnly access and refresh cookie issuance, refresh-token rotation, logout, and refresh-token replay rejection.
- Email verification, verification resend, password-reset request, and password reset.
- GitHub and Google OAuth sign-in, including linking an OAuth identity to an existing account when the verified email matches.
- Device/session listing and revocation of one, other, or all sessions.
- Administrative account lookup, session aggregation and revocation, idempotent ban/unban actions, and disconnect of banned active sockets.

## Runtime Contracts

- Session records are durable in the Auth database and active session pointers are stored in Redis.
- Authentication responses set cookie values at the API Gateway; browser code does not receive token values as application state.
- Refresh changes the session token pair. Reusing a revoked refresh token is rejected.
- Revocation updates durable session state and removes the Redis pointer. Bans revoke target sessions and establish an active-ban marker.

## Acceptance Criteria

- **AUTH-1:** Successful credential or OAuth login creates HttpOnly access and refresh cookies.
- **AUTH-2:** Refresh rotates tokens and rejects reuse of a revoked refresh token.
- **AUTH-3:** Revoking a session removes its Redis state and blocks subsequent protected requests.
- **AUTH-4:** Session/device listing identifies the current session and supports revoking the current, another, or all eligible sessions.
- **AUTH-5:** Registration and password recovery use verification/reset flows without exposing account credentials in client state.
- **AUTH-6:** A banned account is denied active use; an existing chat socket is disconnected after a successful ban.

## Exclusions

This service does not define calls, group membership, user-blocking policy, or notification delivery guarantees.
