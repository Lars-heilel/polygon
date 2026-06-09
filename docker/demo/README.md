# Polygon Demo

Production-ready Docker-развёртывание мессенджера Polygon на [polygon-by-lars-heilel.ru](https://www.polygon-by-lars-heilel.ru).

## Архитектура

```
Cloudflare Tunnel → nginx:80
  ├── /api/*            → gateway:3000
  ├── /socket.io/*      → gateway:3000 (WebSocket)
  └── /*                → SPA (React, статика из dist)
```

Наружу торчит **только nginx (80)** через Cloudflare Tunnel. Cloudflare даёт HTTPS, все сервисы бэкенда внутри Docker сети.

## Состав

| Файл                      | Назначение                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| `Dockerfile`              | Мультистейдж сборка бэкенда (7 микросервисов в одном контейнере)        |
| `docker-compose.yml`      | Оркестрация: БД, бэкенд, nginx, мониторинг                              |
| `Makefile`                | `make build` / `make start` / `make stop` / `make logs` / `make backup` |
| `start.sh`                | Точка входа — миграции + запуск всех сервисов                           |
| `nginx/Dockerfile`        | nginx:alpine со статикой фронта                                         |
| `nginx/conf/default.conf` | Прокси API, WebSocket, SPA fallback                                     |

## Домен

Домен: `https://www.polygon-by-lars-heilel.ru`

Настроен через Cloudflare Tunnel — сервис `cloudflared` в `docker-compose.yml` (раскомментирован, требует токен).

### OAuth колбеки (зарегистрировать в провайдерах)

| Провайдер | Callback URL                                                     |
| --------- | ---------------------------------------------------------------- |
| GitHub    | `https://www.polygon-by-lars-heilel.ru/api/auth/github/callback` |
| Google    | `https://www.polygon-by-lars-heilel.ru/api/auth/google/callback` |
| Yandex    | `https://www.polygon-by-lars-heilel.ru/api/auth/yandex/callback` |

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

## Безопасность

- **tini** — корректная обработка сигналов внутри контейнера
- **HEALTHCHECK** — проверка gateway через curl
- **Resource limits** — каждый контейнер ограничен по памяти (см. `deploy.resources`)
- **Только nginx + Cloudflare наружу** — бэкенд не торчит портами
- **Secrets** — все в `.env.production`, в гите только плейсхолдеры

### Cloudflare Tunnel

Туннель уже настроен в `docker-compose.yml`. Нужен только токен:

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: polygon-cloudflared
  restart: unless-stopped
  command: tunnel run --token YOUR_TOKEN
  networks:
    - polygon-demo-network
```

Cloudflare даёт HTTPS, защиту от DDoS, и скрытие портов. Grafana/Swagger/админку можно дополнительно закрыть через Cloudflare Access.
