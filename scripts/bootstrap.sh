#!/bin/bash

# Главный скрипт инициализации и запуска проекта
# Автоматически определяет состояние системы и выполняет нужные действия

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 Проверка состояния системы..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не найден. Пожалуйста, установите Docker."
    exit 1
fi

# Проверка наличия docker compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не найден. Пожалуйста, установите Docker Compose."
    exit 1
fi

# Проверка состояния контейнеров
if docker ps -a --format '{{.Names}}' | grep -q "polygon-postgres"; then
    echo "✅ Контейнеры уже существуют"
    
    # Проверка работы PostgreSQL
    if docker ps --format '{{.Names}}' | grep -q "polygon-postgres"; then
        echo "✅ PostgreSQL работает"
    else
        echo "⚠️  PostgreSQL остановлен. Запускаю..."
        docker compose up -d postgres
        sleep 5
    fi
else
    echo "🆕 Первый запуск. Инициализация..."
    
    # Запуск всех сервисов
    docker compose up -d
    
    echo "⏳ Ожидание готовности PostgreSQL..."
    sleep 10
fi

# Проверка наличия баз данных
echo "📋 Проверка баз данных..."
DB_COUNT=$(docker exec polygon-postgres psql -U polygon -d postgres -t -c "SELECT count(*) FROM pg_database WHERE datname LIKE 'polygon_%'" 2>/dev/null | tr -d ' ')

if [ "$DB_COUNT" -lt 5 ]; then
    echo "⚠️  Базы данных не найдены. Запуск инициализации..."
    ./scripts/init-db.sh
else
    echo "✅ Базы данных существуют ($DB_COUNT найдено)"
fi

echo ""
echo "✅ Система готова к работе!"
echo ""
echo "📚 Следующие шаги:"
echo "   1. Применить миграции Prisma:"
echo "      cd libs/backend/user && npx prisma migrate dev"
echo "      cd ../auth && npx prisma migrate dev"
echo "      cd ../chat && npx prisma migrate dev"
echo ""
echo "   2. Запустить сервисы (если ещё не запущены):"
echo "      docker compose up -d"
echo ""
