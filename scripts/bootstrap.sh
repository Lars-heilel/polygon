#!/bin/bash

# Main project initialization and startup script
# Automatically detects system state and performs required actions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 Checking system state..."

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Check docker compose availability
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Check container state
if docker ps -a --format '{{.Names}}' | grep -q "polygon-postgres"; then
    echo "✅ Containers already exist"

    # Check PostgreSQL status
    if docker ps --format '{{.Names}}' | grep -q "polygon-postgres"; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL is stopped. Starting..."
        docker compose up -d postgres
        sleep 5
    fi
else
    echo "🆕 First run. Initializing..."

    # Start all services
    docker compose up -d

    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# Check databases
echo "📋 Checking databases..."
DB_COUNT=$(docker exec polygon-postgres psql -U polygon -d postgres -t -c "SELECT count(*) FROM pg_database WHERE datname LIKE 'polygon_%'" 2>/dev/null | tr -d ' ')

if [ "$DB_COUNT" -lt 5 ]; then
    echo "⚠️  Databases not found. Running initialization..."
    ./scripts/init-db.sh
else
    echo "✅ Databases exist ($DB_COUNT found)"
fi

echo ""
echo "✅ System is ready!"
echo ""
echo "📋 Applying Prisma migrations and generating clients..."

# Backend services list (libs/backend/<name>)
SERVICES=("user" "auth" "chat" "media" "notification")

for SERVICE in "${SERVICES[@]}"; do
    SERVICE_PATH="libs/backend/$SERVICE"
    echo ""
    echo "🔧 Processing $SERVICE..."
    
    # Check if schema exists
    if [ -f "$SERVICE_PATH/src/database/prisma/schema.prisma" ]; then
        cd "$SERVICE_PATH"
        
        # Generate Prisma client
        echo "   📦 Generating Prisma client..."
        npx prisma generate
        
        # Apply migrations
        echo "   🗄️  Applying migrations..."
        npx prisma migrate dev
        
        cd - > /dev/null
    else
        echo "   ⚠️  schema.prisma not found, skipping..."
    fi
done

echo ""
echo "✅ All migrations applied and clients generated!"
echo ""
echo "📚 Next steps:"
echo "   1. Start services (if not already running):"
echo "      docker compose up -d"
echo ""
echo "   2. Check logs:"
echo "      docker compose logs -f"
echo ""
