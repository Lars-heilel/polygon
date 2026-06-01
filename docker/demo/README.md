# Polygon Demo

Production-ready Docker-развёртывание мессенджера Polygon для домашнего сервера.

## Архитектура

```
Cloudflare (опционально) → nginx:80
  ├── /api/*            → gateway:3000
  ├── /socket.io/*      → gateway:3000 (WebSocket)
  └── /*                → SPA (React, статика из dist)
```

Из портов наружу торчит **только nginx (80)**. Все сервисы бэкенда внутри Docker сети, наружу не вылезают.

## Состав

| Файл                      | Назначение                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| `Dockerfile`              | Мультистейдж сборка бэкенда (7 микросервисов в одном контейнере)        |
| `docker-compose.yml`      | Оркестрация: БД, бэкенд, nginx, мониторинг                              |
| `Makefile`                | `make build` / `make start` / `make stop` / `make logs` / `make backup` |
| `start.sh`                | Точка входа — миграции + запуск всех сервисов                           |
| `nginx/Dockerfile`        | nginx:alpine со статикой фронта                                         |
| `nginx/conf/default.conf` | Прокси API, WebSocket, SPA fallback                                     |

## Требования

- Docker + Docker Compose v2
- Node.js 22+ (для сборки фронта)

## Переменные окружения

Единственный источник — `.env.production` в корне проекта. В нём:

- Пароли к БД, JWT секреты, OAuth ключи
- SMTP, Redis, RabbitMQ, Meilisearch

Docker-compose подгружает его через `env_file`, а hostname-зависимые переменные (где нужно `postgres` вместо `localhost`) переопределяются в `environment` блоке через `${VAR}`.

**`.env.production` в `.gitignore`** — не закоммитится случайно.

## Запуск

```bash
# Первый раз: сборка фронта + образов
make -C docker/demo build

# Запуск
make -C docker/demo start

# Логи
make -C docker/demo logs

# Бекап БД
make -C docker/demo backup

# Остановка
make -C docker/demo stop
```

Или по шагам вручную:

```bash
# Собрать фронт
npx nx build @org/messenger --skip-nx-cache

# Подготовить статику для nginx
mkdir -p docker/demo/nginx/html
cp -r apps/client/messenger/dist/* docker/demo/nginx/html/

# Собрать и запустить
docker compose -f docker/demo/docker-compose.yml --env-file .env.production up -d
```

Фронт будет доступен на `http://localhost`, API на `http://localhost/api`.

## Безопасность

- **tini** — корректная обработка сигналов внутри контейнера
- **HEALTHCHECK** — проверка gateway через curl
- **Resource limits** — каждый контейнер ограничен по памяти (см. `deploy.resources`)
- **Только nginx наружу** — бэкенд не торчит портами
- **Secrets** — все в `.env.production`, в гите только плейсхолдеры

### Когда будет домен

Раскомментируй сервис `cloudflared` в `docker-compose.yml` и вставь токен туннеля:

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: polygon-cloudflared
  restart: unless-stopped
  command: tunnel run --token YOUR_TOKEN
  networks:
    - polygon-network
```

Cloudflare даст HTTPS и защиту. Grafana/Swagger/админку скроешь через Cloudflare Access без единой строчки кода.
