#!/bin/sh
set -e

log() {
  echo "[start.sh] $*"
}

wait_for_postgres() {
  local host port user
  host="${POSTGRES_HOST:-postgres}"
  port="${POSTGRES_PORT:-5432}"
  user="${POSTGRES_USER:-polygon}"
  log "Waiting for PostgreSQL at ${host}:${port}..."
  for i in $(seq 1 60); do
    pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1 && return 0
    sleep 2
  done
  log "ERROR: PostgreSQL not ready after 60 attempts"
  exit 1
}

run_migrations() {
  local config_path="$1"
  local db_url_var="$2"
  local name
  name=$(basename "$(dirname "$config_path")")
  log "Running migrations for $name..."

  eval "DB_URL=\"\$$db_url_var\""
  if [ -z "$DB_URL" ]; then
    log "WARN: $db_url_var not set, skipping $name"
    return
  fi

  migration_dir="$(dirname "$config_path")/src/database/prisma/migrations"
  if [ -d "$migration_dir" ] && ls "$migration_dir"/*/migration.sql 2>/dev/null | head -1 >/dev/null 2>&1; then
    export "$db_url_var=$DB_URL"
    node ./node_modules/prisma/build/index.js migrate deploy \
      --config="./$config_path" 2>&1 | sed 's/^/  [prisma] /'
  else
    log "No migrations found for $name, running db push..."
    export "$db_url_var=$DB_URL"
    node ./node_modules/prisma/build/index.js db push \
      --config="./$config_path" --skip-generate 2>&1 | sed 's/^/  [prisma] /'
  fi
}

wait_for_postgres

log "Running database migrations..."
run_migrations "libs/backend/auth/prisma.config.ts" "AUTH_DATABASE_URL"
run_migrations "libs/backend/user/prisma.config.ts" "USER_DATABASE_URL"
run_migrations "libs/backend/chat/prisma.config.ts" "CHAT_DATABASE_URL"
run_migrations "libs/backend/notification/prisma.config.ts" "NOTIFICATION_DATABASE_URL"

log "Starting services..."
SERVICES="auth-service user-service chat-service media-service notification-service search-service gateway"

for svc in $SERVICES; do
  log "Starting $svc..."
  node --enable-source-maps "./$svc/main.js" &
  PIDS="$PIDS $!"
done

trap 'log "Shutting down..."; kill $PIDS 2>/dev/null; wait; exit 0' INT TERM

log "All services started. PIDs: $PIDS"
log "Gateway: http://localhost:${GATEWAY_PORT:-3000}"
log "Swagger: http://localhost:${GATEWAY_PORT:-3000}/api/docs"

wait
