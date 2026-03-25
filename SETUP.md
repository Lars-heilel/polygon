# Настройка проекта Polygon

## 🚀 Быстрый старт (Dev разработка)

После клонирования репозитория выполните скрипт инициализации:

```bash
./scripts/bootstrap.sh
```

Этот скрипт автоматически:
- Проверит наличие Docker и Docker Compose
- Запустит контейнеры (PostgreSQL, Redis, RabbitMQ)
- Создаст базы данных для всех микросервисов
- Применит миграции Prisma

### Ручная инициализация (альтернатива)

```bash
# 1. Первый запуск — инициализация БД
./scripts/init-db.sh

# 2. Запуск всех сервисов
docker compose up -d

# 3. Применение миграций Prisma для каждого сервиса
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
cd ../media && npx prisma migrate dev
cd ../notification && npx prisma migrate dev
```

---

## 📋 Что создаётся при инициализации

### Базы данных PostgreSQL
- `polygon_auth` — сервис аутентификации
- `polygon_chat` — сервис чатов
- `polygon_media` — сервис медиа
- `polygon_notification` — сервис уведомлений
- `polygon_user` — сервис пользователей

### Инфраструктура
- **PostgreSQL** (порт 5432) — основная БД
- **Redis** (порт 6379) — кэширование
- **RabbitMQ** (порты 5672/15672) — брокер сообщений

---

## 🔧 Управление сервисами

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка всех сервисов
docker compose down

# Полный сброс (включая тома с данными)
docker compose down -v
```

---

## ⚠️ Важные замечания

- Скрипт `init-db.sh` нужно запускать **только один раз** после клонирования
- При повторном запуске `init-db.sh` все данные баз данных будут **удалены**
- Для повседневной разработки используйте `bootstrap.sh`

---

## 🌐 Переменные окружения

Скопируйте файл `.env.example` в `.env` и настройте под свою среду:

```bash
cp .env.example .env
```

Подробнее см. в файле `.env.example`.

---

# Project Setup — Polygon

## 🚀 Quick Start (Dev Development)

After cloning the repository, run the initialization script:

```bash
./scripts/bootstrap.sh
```

This script automatically:
- Checks for Docker and Docker Compose
- Starts containers (PostgreSQL, Redis, RabbitMQ)
- Creates databases for all microservices
- Applies Prisma migrations

### Manual Initialization (Alternative)

```bash
# 1. First run — initialize databases
./scripts/init-db.sh

# 2. Start all services
docker compose up -d

# 3. Apply Prisma migrations for each service
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
cd ../media && npx prisma migrate dev
cd ../notification && npx prisma migrate dev
```

---

## 📋 What Gets Created During Initialization

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

---

## 🌐 Environment Variables

Copy `.env.example` to `.env` and configure for your environment:

```bash
cp .env.example .env
```

See `.env.example` file for details.
