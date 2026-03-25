# Инициализация баз данных

Этот скрипт нужен для **первого запуска** проекта после клонирования.

## Быстрый старт

```bash
# 1. Запустить скрипт инициализации (только один раз)
./scripts/init-db.sh

# 2. Запустить все сервисы
docker compose up -d

# 3. Запустить миграции Prisma (если не были применены)
cd libs/backend/user && npx prisma migrate dev
cd ../auth && npx prisma migrate dev
cd ../chat && npx prisma migrate dev
```

## Что делает скрипт `init-db.sh`

1. Останавливает все контейнеры
2. Удаляет старый том PostgreSQL (если есть)
3. Запускает PostgreSQL с чистым томом
4. Автоматически создаются базы данных для всех микросервисов:
   - `polygon_auth`
   - `polygon_chat`
   - `polygon_media`
   - `polygon_notification`
   - `polygon_user`

## Важные замечания

- Скрипт нужно запускать **только один раз** после клонирования проекта
- При повторном запуске все данные баз данных будут **удалены**
- Для сброса данных можно запустить скрипт повторно

## Ручное управление

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f postgres

# Остановка всех сервисов
docker compose down

# Полный сброс (включая тома)
docker compose down -v
```
