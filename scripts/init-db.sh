#!/bin/bash

# Скрипт полной инициализации баз данных
# Запускается ОДИН раз после клонирования проекта
# Очищает старый том PostgreSQL и создаёт базы данных для всех микросервисов

set -e

echo "🗑️  Остановка контейнеров..."
cd "$(dirname "$0")/.."
docker compose down

echo "🧹 Очистка тома PostgreSQL..."
docker volume rm polygon_postgres_data 2>/dev/null || true

echo "🚀 Запуск PostgreSQL с чистым томом..."
docker compose up -d postgres

echo "⏳ Ожидание готовности PostgreSQL (30 секунд)..."
sleep 30

echo "📋 Проверка созданных баз данных..."
docker exec polygon-postgres psql -U polygon -d postgres -c "\l"

echo ""
echo "✅ Инициализация завершена!"
echo "Теперь можно запустить все сервисы: docker compose up -d"
