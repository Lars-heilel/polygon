# Setup Guide

## Prerequisites

- Docker with Docker Compose
- Node.js 20.x
- npm

## 1. Configure The Environment

Create the local environment file from the example:

```bash
cp .env.example .env
```

The repository uses root environment files. Read `.env.example` and supply local values for PostgreSQL, Redis, RabbitMQ, MinIO, Meilisearch, JWT/cookie secrets, OAuth, mail, and optional observability settings. Do not commit `.env` or paste its values into diagnostics.

Vite reads the root through `envDir`; browser-exposed values must use the `VITE_` prefix. Prisma configuration selects `.env`, `.env.test`, or `.env.production` from `NODE_ENV` and resolves it from the repository root.

## 2. Bootstrap Local Infrastructure

After cloning, install workspace dependencies and run the bootstrap script:

```bash
npm install
./scripts/bootstrap.sh
```

The script verifies Docker/Compose, starts local infrastructure, creates service databases when absent, and generates Prisma clients/applies migrations for the service schemas it manages. It is designed for initial local setup. Do not treat it as a disposable reset command: database initialization helpers can remove local data.

The underlying development infrastructure can also be controlled directly:

```bash
npm run dev:docker:up
npm run dev:docker:down
docker compose logs -f
```

| Service | Port(s) | Local role |
| --- | --- | --- |
| PostgreSQL | `5432` | Service-owned databases |
| Redis | `6379` | Sessions, rate limits, realtime coordination |
| RabbitMQ | `5672`, `15672` | Service broker and management UI |
| MinIO | `9000`, `9001` | S3-compatible media storage and console |
| Meilisearch | `7700` | User search index |

## 3. Run The Application

Start the gateway and messenger in separate terminals:

```bash
npm exec nx serve @org/gateway
npm exec nx serve @org/messenger
```

Open `http://localhost:4200`. The Vite server proxies `/api` and `/socket.io` to the gateway on port `3000`, so local browser traffic uses the Vite port. See [MONOREPO_GOTCHAS.md](./MONOREPO_GOTCHAS.md) before changing that proxy.

The workspace also exposes a convenience command for the full local development set:

```bash
npm run dev:all
```

Use it only when the required service environment values and local infrastructure are ready. `dev:all:skip-cache` first removes generated `dist` directories, so it is unsuitable when those outputs must be preserved for another local task.

## 4. Prisma And Database Maintenance

Run Prisma-related work through the owning Nx project where such a target exists. Before invoking an unfamiliar migration or generate target, inspect it:

```bash
npm exec nx show project @org/<service> --json
```

Avoid invoking Prisma from an arbitrary subdirectory. Its environment lookup and schema paths are service-specific; the Prisma configuration's explicit root environment path is the supported execution model. Back up local data before any command that initializes, drops, or reapplies databases.

## 5. Verify The Workspace

Run focused checks for the changed application area through Nx:

```bash
npm exec nx test @org/gateway
npm exec nx test @org/messenger
npm exec nx build @org/gateway
npm exec nx build @org/messenger
```

For a broader maintenance pass, run the relevant lint/typecheck targets or a change-aware task:

```bash
npm exec nx affected -t test
npm exec nx lint @org/<project>
npm exec nx typecheck @org/<project>
```

## 6. Remote Device Testing

With the dev servers running, `./scripts/tunnel.sh` can expose the Vite server through ngrok after ngrok is installed and authenticated:

```bash
ngrok config add-authtoken <token>
./scripts/tunnel.sh
```

Because Vite proxies HTTP and Socket.IO, tunnel the Vite address rather than exposing every backend port. Treat the generated public URL as temporary and avoid using a public tunnel with real secrets or production data.

## 7. Optional Observability Stack

The local single-host Grafana, Prometheus, Loki, Tempo, Alloy, and exporter stack is optional for ordinary feature development:

```bash
npm run observability:up
npm run observability:logs
npm run observability:down
```

Grafana is available at `http://localhost:3009`; Prometheus targets are at `http://localhost:9090/targets`. Configure `OTEL_ENABLED=true` and a reachable OTLP endpoint before expecting backend traces. Keep monitoring ports private outside a trusted local network. Full operational details are in [OBSERVABILITY.md](./OBSERVABILITY.md).
