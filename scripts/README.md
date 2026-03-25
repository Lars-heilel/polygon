# Database Initialization

This script is for the **first run** of the project after cloning.

## Quick Start

```bash
# 1. Run bootstrap script (initialization + migrations + Prisma client generation)
./scripts/bootstrap.sh

# 2. Start all services
docker compose up -d
```

## What `bootstrap.sh` Does

1. Checks Docker and Docker Compose availability
2. Starts containers (PostgreSQL, Redis, RabbitMQ)
3. Creates databases for all microservices (if not exists)
4. Generates Prisma clients for all backend services
5. Applies Prisma migrations

## What `init-db.sh` Does

1. Stops all containers
2. Removes old PostgreSQL volume (if exists)
3. Starts PostgreSQL with clean volume
4. Automatically creates databases for all microservices:
   - `polygon_auth`
   - `polygon_chat`
   - `polygon_media`
   - `polygon_notification`
   - `polygon_user`

## Important Notes

- Run `bootstrap.sh` **only once** after cloning the project
- Running `init-db.sh` again will **delete** all database data
- Prisma generated files are gitignored:
  - `libs/backend/*/src/database/generated`
  - `apps/backend/*/src/database/generated`

## Manual Management

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Full reset (including volumes)
docker compose down -v

# Generate Prisma client for a service
cd libs/backend/user && npx prisma generate

# Apply migrations for a service
cd libs/backend/user && npx prisma migrate dev

# Using Nx (alternative)
npx nx run @org/user:prisma-generate
npx nx run @org/user:prisma-migrate
```
