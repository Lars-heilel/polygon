# Notification Service Specification

## Purpose

The Notification Service provides verification/reset email dispatch and the stored push-subscription surface used by the application.

## Implemented Capabilities

- Sends verification-email and password-reset email requests received from Auth Service events.
- Stores, retrieves, and removes Web Push subscription records.
- Exposes gateway endpoints for the VAPID public key and push subscription/unsubscription.
- Provides the browser subscription bootstrap surface where browser push APIs are available.

## Runtime Contracts

- Email dispatch is invoked through RabbitMQ service communication.
- A push subscription contains an endpoint and browser-provided keys and is owned by one user.
- Notification settings and browser capability checks belong to the client bootstrap flow; this service contract is limited to email dispatch and push-subscription storage.

## Acceptance Criteria

- **NOTIFICATION-1:** Auth flows can request verification and password-reset email dispatch through the notification service.
- **NOTIFICATION-2:** An authenticated client can obtain the VAPID key and create or remove its own push subscription.
- **NOTIFICATION-3:** The client can bootstrap browser push subscription only when browser APIs and user settings allow it.

## Exclusions

Push support is documented only as a subscription and integration surface. The current product does not promise service-worker offline behavior, reliable end-to-end push delivery, notification logs, delivery receipts, calls, or call notifications.
