#!/usr/bin/env bash

# Test environment bootstrap script
# Creates test databases and applies migrations with NODE_ENV=test
# Safe to re-run — databases and tables are not dropped
#
# Works in two modes:
#   Local:  uses 'docker exec polygon-postgres' (requires running container)
#   CI:     uses 'psql' directly via localhost (CI=true env var)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PG_USER="${PGUSER:-polygon}"
PG_PASSWORD="${PGPASSWORD:-polygon_password}"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"

run_psql() {
  if [ "${CI:-false}" = "true" ]; then
    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "$1"
  else
    if ! docker ps --format '{{.Names}}' | grep -q "polygon-postgres"; then
      echo "ERROR: polygon-postgres container is not running."
      echo "Run 'docker compose up -d' or './scripts/bootstrap.sh' first."
      exit 1
    fi
    docker exec polygon-postgres psql -U "$PG_USER" -d postgres -c "$1"
  fi
}

echo "Creating test databases..."

run_psql "
  SELECT 'CREATE DATABASE polygon_auth_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_auth_test')\gexec
  SELECT 'CREATE DATABASE polygon_user_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_user_test')\gexec
  SELECT 'CREATE DATABASE polygon_chat_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_chat_test')\gexec
  SELECT 'CREATE DATABASE polygon_notification_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_notification_test')\gexec

  GRANT ALL PRIVILEGES ON DATABASE polygon_auth_test TO polygon;
  GRANT ALL PRIVILEGES ON DATABASE polygon_user_test TO polygon;
  GRANT ALL PRIVILEGES ON DATABASE polygon_chat_test TO polygon;
  GRANT ALL PRIVILEGES ON DATABASE polygon_notification_test TO polygon;
"

echo "Applying migrations to test databases..."

SERVICES=("user" "auth" "chat" "notification")

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_PATH="libs/backend/$SERVICE"

  if [ -f "$SERVICE_PATH/src/database/prisma/schema.prisma" ]; then
    echo "  Migrating $SERVICE..."
    cd "$SERVICE_PATH"
    NODE_ENV=test npx prisma migrate deploy
    cd "$PROJECT_ROOT"
  else
    echo "  WARNING: schema.prisma not found for $SERVICE, skipping..."
  fi
done

echo ""
echo "Test environment is ready."
echo "  Databases: polygon_*_test"
echo "  Run tests: NODE_ENV=test npx nx run-many -t test"
