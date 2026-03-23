# Polygon Infrastructure

Инфраструктура для разработки и запуска мессенджера Polygon.

## 🚀 Быстрый старт

### Запуск всей инфраструктуры

```bash
# Из корня проекта
./infra/scripts/start-infra.sh
```

Или вручную:

```bash
docker compose up -d
```

### Остановка инфраструктуры

```bash
./infra/scripts/stop-infra.sh
```

Или вручную:

```bash
docker compose down
```

---

## 📦 Сервисы

| Сервис | Порт | URL | Логин/Пароль |
|--------|------|-----|--------------|
| **PostgreSQL** | 5432 | - | polygon / polygon_password |
| **Redis** | 6379 | - | - |
| **RabbitMQ** | 5672 / 15672 | http://localhost:15672 | polygon / polygon_password |
| **Prometheus** | 9090 | http://localhost:9090 | - |
| **Grafana** | 3001 | http://localhost:3001 | admin / admin_password |
| **Elasticsearch** | 9200 / 9300 | http://localhost:9200 | - |
| **Kibana** | 5601 | http://localhost:5601 | - |
| **Jaeger** | 16686 / 4317 / 4318 | http://localhost:16686 | - |

---

## 🔧 Конфигурация

### Переменные окружения

Файл `.env.docker` содержит все переменные окружения.

### Базы данных

В PostgreSQL создаются отдельные базы для каждого микросервиса:

- `auth_db` - для auth-service
- `user_db` - для user-service
- `chat_db` - для chat-service
- `notification_db` - для notification-service
- `media_db` - для media-service

### RabbitMQ

RabbitMQ используется для event-driven архитектуры:

- **Exchanges:** `polygon.events` (topic)
- **Queues:** Создаются динамически сервисами

---

## 📊 Мониторинг

### Prometheus

Собирает метрики со всех сервисов.

**Конфигурация:** `infra/monitoring/prometheus/prometheus.yml`

**Доступ:** http://localhost:9090

---

### Grafana

Визуализация метрик и алерты.

**Конфигурация:**
- Datasources: `infra/monitoring/grafana/provisioning/datasources/datasources.yml`
- Dashboards: `infra/monitoring/grafana/provisioning/dashboards/dashboards.yml`

**Доступ:** http://localhost:3001
**Логин:** `admin`
**Пароль:** `admin_password`

---

### Elasticsearch + Kibana

Сбор и визуализация логов.

**Конфигурация:**
- Filebeat: `infra/monitoring/filebeat/filebeat.yml`

**Elasticsearch:** http://localhost:9200
**Kibana:** http://localhost:5601

---

### Jaeger

Distributed tracing для отслеживания запросов между сервисами.

**Доступ:** http://localhost:16686

**Порты:**
- `16686` - UI
- `4317` - OTLP gRPC
- `4318` - OTLP HTTP

---

## 🛠 Полезные команды

```bash
# Статус контейнеров
docker compose ps

# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f postgres
docker compose logs -f rabbitmq
docker compose logs -f elasticsearch

# Перезапуск сервиса
docker compose restart postgres

# Очистка volumes (удаление всех данных)
docker compose down -v

# Просмотр ресурсов
docker stats
```

---

## 🔗 Интеграция с сервисами

### Backend сервисы (NestJS)

Каждый сервис подключается к:

**PostgreSQL:**
```
postgresql://polygon:polygon_password@localhost:5432/<db_name>
```

**Redis:**
```
redis://localhost:6379
```

**RabbitMQ:**
```
amqp://polygon:polygon_password@localhost:5672
```

**Prometheus:**
```
http://localhost:9090/metrics
```

**Elasticsearch:**
```
http://localhost:9200
```

**Jaeger:**
```
http://localhost:16686
OTLP gRPC: localhost:4317
OTLP HTTP: localhost:4318
```

---

## 📝 Notes

1. **Elasticsearch требует много RAM** - выделено 2GB лимит. Если не хватает, увеличьте `ES_JAVA_OPTS` в `docker-compose.yml`.

2. **Для работы Filebeat на Linux** может потребоваться запуск от root (уже настроено).

3. **Grafana dashboards** можно создавать через UI - они сохранятся в `infra/monitoring/grafana/dashboards/`.

4. **PostgreSQL** - один контейнер на все сервисы (для разработки). В проде - отдельные БД.

---

## 🚨 Troubleshooting

### Elasticsearch не запускается

```bash
# Увеличьте лимит мапов в ядре Linux
sudo sysctl -w vm.max_map_count=262144
```

### Grafana не видит datasource

Проверьте что Prometheus запущен:
```bash
docker compose ps prometheus
```

### RabbitMQ Management UI не доступен

Подождите 30-60 секунд после запуска - RabbitMQ долго стартует.

### Filebeat не отправляет логи

Проверьте конфиг:
```bash
docker compose logs filebeat
```

---

## 📚 Документация

- [PostgreSQL](https://www.postgresql.org/docs/)
- [Redis](https://redis.io/docs/)
- [RabbitMQ](https://www.rabbitmq.com/docs)
- [Prometheus](https://prometheus.io/docs/)
- [Grafana](https://grafana.com/docs/)
- [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Jaeger](https://www.jaegertracing.io/docs/)
