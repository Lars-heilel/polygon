#!/bin/bash

# ============================================
# Скрипт запуска инфраструктуры для Polygon
# ============================================

set -e

echo "======================================"
echo "  Polygon Infrastructure Startup"
echo "======================================"
echo ""

# Проверка что Docker запущен
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker не запущен!"
    exit 1
fi

echo "✅ Docker запущен"
echo ""

# Проверка наличия docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml не найден!"
    exit 1
fi

echo "✅ docker-compose.yml найден"
echo ""

# Остановка старых контейнеров
echo "🛑 Остановка старых контейнеров..."
docker compose down --remove-orphans 2>/dev/null || true
echo "✅ Старые контейнеры остановлены"
echo ""

# Запуск инфраструктуры
echo "🚀 Запуск инфраструктуры..."
echo ""
echo "  📦 PostgreSQL (5432)"
echo "  📦 Redis (6379)"
echo "  📦 RabbitMQ (5672, 15672)"
echo "  📦 Prometheus (9090)"
echo "  📦 Grafana (3001)"
echo "  📦 Elasticsearch (9200)"
echo "  📦 Kibana (5601)"
echo "  📦 Jaeger (16686)"
echo ""

docker compose up -d

echo ""
echo "✅ Инфраструктура запущена!"
echo ""
echo "======================================"
echo "  Сервисы доступны по адресам:"
echo "======================================"
echo ""
echo "  🟦 PostgreSQL:    localhost:5432"
echo "  🟥 Redis:         localhost:6379"
echo "  🟨 RabbitMQ:      localhost:5672 (AMQP), localhost:15672 (Management)"
echo "  🟩 Prometheus:    http://localhost:9090"
echo "  🟩 Grafana:       http://localhost:3001 (admin/admin_password)"
echo "  🟩 Elasticsearch: http://localhost:9200"
echo "  🟩 Kibana:        http://localhost:5601"
echo "  🟣 Jaeger:        http://localhost:16686"
echo ""
echo "======================================"
echo "  Полезные команды:"
echo "======================================"
echo ""
echo "  docker compose ps              # Статус контейнеров"
echo "  docker compose logs -f         # Логи всех сервисов"
echo "  docker compose logs -f <name>  # Логи конкретного сервиса"
echo "  docker compose down            # Остановить всё"
echo "  docker compose restart         # Перезапустить"
echo ""
echo "======================================"
