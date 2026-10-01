# Load Test Design — сколько людей и RPS держит Polygon

Дата: 2026-10-01. Статус: approved (вариант A). Spike-результат: single-IP потолок — Throttler 100/60с.

## 1. Цель и success criteria

Ответить на вопрос: сколько concurrent-пользователей (VU) и RPS держит приложение до деградации.
Деградация = p95 > 500ms ИЛИ доля ошибок > 1% (HTTP 5xx + 429 сверх лимита + WS `message:send:error` + таймауты).
Два замера: (1) как есть с throttle 100/60с — «с одного NAT», (2) с поднятым лимитом только на время прогона — «потолок сервисов».

## 2. Что меряем (сценарии)

HTTP через Gateway `http://localhost:3000/api`, маршруты только из `API_ROUTES` (`libs/common/src/constants/routes.ts`), тела только из zod-схем `libs/common`:
- `auth/register` → `auth/login` (setup/seed, не в основном замере).
- `GET chats` (read-through Redis `chat:list:{userId}`, смотрим `X-Cache` HIT/MISS).
- `GET chats/:id/messages` (Redis `chat:msgs:{chatId}:*`).
- `POST chats/:id/messages` (`send-message.schema`, триггерит socket broadcast + offline push + инвалидацию кеша).
- `GET search/users?q=` (Meilisearch через `search_queue`).
- WS через `ws://localhost:3000/socket.io`: connect по cookie `access_token`, `message:send` с zod-валидацией, ждём `message:new`, считаем `message:send:error`.

Нагрузка: k6 ramp `50 → 200 → 500 VU`, каждый VU: login (сохранённый токен из seed) → цикл read/send/search + WS-сообщения. Отдельный smoke `VUs=5` для проверки.

## 3. Архитектура и файлы

Новая папка вне прод-кода, прод-контракты не меняем:
- `infra/load/scenarios/http-load.js` — k6 HTTP-сценарий (stages, thresholds, summary).
- `infra/load/scenarios/ws-load.js` — k6 WS-сценарий (`k6/ws`).
- `infra/load/seed.mjs` — Node: создаёт `load_*` юзеров/чаты через `fetch` + Gateway, пишет `infra/load/.tokens.json` (gitignored), идемпотентен по префиксу.
- `infra/load/cleanup.mjs` — удаляет `load_*` данные (best-effort, по списку из seed).
- `infra/load/run.sh` — `docker run --rm --network host -v ./:/scripts grafana/k6 run /scripts/scenarios/http-load.js` и ws-вариант + smoke-флаг.
- `infra/load/README.md` — как поднять (`dev:docker:up`, `dev:all`), прогнать, где смотреть Grafana `polygon-backend-overview` (Prometheus `:9090`, Grafana `:3009`).
- `infra/load/.gitignore` — `.tokens.json`, `*.log`, k6 summary.

Почему `infra/load`: `apps/` — только тонкие шеллы, `libs/` — прод-пакеты, нагрузке там не место; рядом уже `infra/db`, `infra/observability`, `docker/demo`.

Правила репо: NPM only (k6 — docker-образ, в `package.json` не добавляем); никаких захардкоженных URL/шейпов; без секретов в логах (только `hasToken`, `eventType`); RMQ-паттерны не трогаем, бьём только через Gateway HTTP/WS.

## 4. Throttle и окружение

Прод-лимит `ThrottlerModule 60с/100` в `apps/backend/gateway/src/app/gateway.module.ts` не меняем.
Замер 1 — как есть (ожидаем 429 с одного IP, фиксируем как «лимит NAT»).
Замер 2 — потолок сервисов: на время прогона поднимаем лимит через env override только в локальном прогоне (флаг в `run.sh`, доку в README), возвращаем обратно после. Альтернатива — N IP — отклонена как сложная.
Окружение по умолчанию — локальный dev (`dev:docker:up` + `dev:all`); `docker/demo` — опционально вторым прогоном для prod-like цифр.

## 5. Наблюдаемость и отчёт

Во время прогона смотрим: k6 summary (RPS, VU, p50/p95, err%), Gateway `/api/metrics` + `/metrics` сервисов через Prometheus, `polygon-backend-overview` в Grafana, логи `*_requested → *_started → *_done` с `eventType`. Итоговый отчёт в чате: таблица stage → RPS/VU/p95/err + где упёрлись (throttle/RMQ/Redis/DB/WS broadcast).

## 6. Вне скоупа

E2E через браузер Messenger, MinIO upload больших файлов, push/email, хаос-тесты брокера/БД, CI-джоба. Только локальный ручной прогон.
