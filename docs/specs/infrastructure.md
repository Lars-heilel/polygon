# Infrastructure Specification

## Purpose

The local runtime provides the backing services required by the Polygon microservices and Messenger SPA, along with the observability conventions used by the application.

## Implemented Capabilities

- Docker Compose runs PostgreSQL, Redis, RabbitMQ, MinIO, and Meilisearch for local development.
- Each backend service owns its PostgreSQL database and Prisma schema.
- Redis stores active-session and account-ban state used by guarded requests.
- RabbitMQ carries service events, including user/search, authentication/email, and notification-related communication.
- MinIO provides S3-compatible direct-upload storage and protected media retrieval.
- Meilisearch backs user search and user reindexing.
- Nx is the supported interface for build, test, serve, and project orchestration.
- Backend services use structured Pino/Nest logging and health/telemetry components; the client uses the shared `frontendLog`/`useLogger` interfaces for controlled diagnostics.

## Runtime Contracts

- Required service configuration is supplied through the repository environment files and validated service environment schema.
- Docker-backed dependencies must be running before services that require their connections are started.
- Inter-service calls use the configured RabbitMQ contracts rather than direct database access across service boundaries.
- Logs must not include raw passwords, token values, cookies, or complete user payloads.

## Acceptance Criteria

- **INFRA-1:** PostgreSQL, Redis, RabbitMQ, MinIO, and Meilisearch are required runtime dependencies and can be started through the repository Docker workflow.
- **INFRA-2:** Nx commands invoked through the workspace package manager are the supported build, test, and serve interface.
- **INFRA-3:** Service database ownership, Redis session state, RabbitMQ communication, MinIO storage, and Meilisearch user search remain separated by their defined boundaries.
- **INFRA-4:** Backend and client diagnostic interfaces use the repository logging conventions without logging raw sensitive values.

## Exclusions

This product specification does not promise a configured Prometheus/Grafana deployment, CI/CD pipeline, production deployment topology, or notification delivery guarantees.
