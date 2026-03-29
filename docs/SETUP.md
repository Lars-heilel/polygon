# Setup

## Prerequisites

- Docker & Docker Compose
- Node.js 20.x
- npm

---

## 1. Environment Variables

```bash
cp .env.example .env
```

All services share a single `.env` at the repository root. Configure it for your local environment — all variables and descriptions are in `.env.example`.

---

## 2. Bootstrap

Run once after cloning:

```bash
./scripts/bootstrap.sh
```

What it does:
1. Checks Docker and Docker Compose availability
2. Starts containers (PostgreSQL, Redis, RabbitMQ)
3. Creates a database for each service
4. Generates Prisma clients for all backend services
5. Applies Prisma migrations

> ⚠️ Run only once after cloning. Re-running `init-db.sh` will delete all database data.

---

## Infrastructure

| Service    | Port(s)      | Purpose                                          |
| ---------- | ------------ | ------------------------------------------------ |
| PostgreSQL | 5432         | Primary database                                 |
| Redis      | 6379         | Cache                                            |
| RabbitMQ   | 5672 / 15672 | Message broker — UI at http://localhost:15672    |
