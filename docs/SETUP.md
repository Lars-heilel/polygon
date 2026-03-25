# Project Setup

## 🚀 Quick Start

After cloning the repository, run the initialization script:

```bash
./scripts/bootstrap.sh
```

This script automatically:
- Checks for Docker and Docker Compose
- Starts containers (PostgreSQL, Redis, RabbitMQ)
- Creates databases for all microservices
- Generates Prisma clients
- Applies Prisma migrations

### Manual Initialization (Alternative)

```bash
# 1. First run — initialize databases
./scripts/init-db.sh

# 2. Start all services
docker compose up -d

# 3. Generate Prisma clients and apply migrations (for each service)
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
cd ../media && npx prisma migrate dev
cd ../notification && npx prisma migrate dev
```

---

## 📋 What Gets Created

### PostgreSQL Databases
- `polygon_auth` — authentication service
- `polygon_chat` — chat service
- `polygon_media` — media service
- `polygon_notification` — notification service
- `polygon_user` — user service

### Infrastructure
- **PostgreSQL** (port 5432) — main database
- **Redis** (port 6379) — caching
- **RabbitMQ** (ports 5672/15672) — message broker

---

## 🔧 Service Management

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Full reset (including data volumes)
docker compose down -v
```

---

## ⚠️ Important Notes

- Run `init-db.sh` **only once** after cloning
- Running `init-db.sh` again will **delete** all database data
- For daily development, use `bootstrap.sh`
- Prisma generated files are gitignored (`libs/backend/*/src/database/generated`)

---

## 🌐 Environment Variables

Copy `.env.example` to `.env` and configure for your environment:

```bash
cp .env.example .env
```

See `.env.example` file for details.
