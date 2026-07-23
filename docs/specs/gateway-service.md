# API Gateway Specification

## Purpose

The API Gateway is the browser-facing HTTP and Socket.IO entry point. It owns cookie handling, gateway guards, request routing to microservices, and real-time connection admission.

## Implemented Capabilities

- Routes authentication, profile, user search, chat, media, notification subscription, administration, and frontend-error requests to the owning service.
- Sets and clears HttpOnly authentication cookies for credential and OAuth flows.
- Applies `SessionGuard` and `ActiveAccountGuard` to private HTTP routes.
- Applies `RolesGuard` to administrative routes.
- Provides GitHub and Google OAuth redirects and callbacks.
- Authenticates Socket.IO connections, enforces active-account/ban state, manages chat rooms, and relays message, read, presence, and typing events.

## Runtime Contracts

- `SessionGuard` validates the session identity and verifies that its Redis session state remains active. A missing or revoked Redis session denies the private request.
- Cookie-based access and refresh credentials are not returned to browser application state.
- Socket connections authenticate at connection time. Banned accounts are rejected or disconnected from active chat use.
- Gateway controllers translate HTTP requests into the service contracts; individual controller error handling remains route-specific.

## Acceptance Criteria

- **GATEWAY-1:** Private HTTP routes use `SessionGuard` and reject missing or revoked Redis sessions.
- **GATEWAY-2:** Socket.IO authenticates on connect and handles chat join/leave, message, read, presence, and typing events.
- **GATEWAY-3:** Credential and OAuth routes set and clear cookies through the gateway.
- **GATEWAY-4:** Administrative endpoints require both an active session and the configured role guard.

## Exclusions

The gateway does not document a general global exception-filter contract, call signaling, group-chat routing, or an offline client contract.
