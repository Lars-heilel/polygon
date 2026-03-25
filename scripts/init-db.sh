#!/bin/bash

# Full database initialization script
# Run ONLY once after cloning the project
# Clears old PostgreSQL volume and creates databases for all microservices

set -e

echo "🗑️  Stopping containers..."
cd "$(dirname "$0")/.."
docker compose down

echo "🧹 Clearing PostgreSQL volume..."
docker volume rm polygon_postgres_data 2>/dev/null || true

echo "🚀 Starting PostgreSQL with clean volume..."
docker compose up -d postgres

echo "⏳ Waiting for PostgreSQL to be ready (30 seconds)..."
sleep 30

echo "📋 Checking created databases..."
docker exec polygon-postgres psql -U polygon -d postgres -c "\l"

echo ""
echo "✅ Initialization complete!"
echo "Now you can start all services: docker compose up -d"
