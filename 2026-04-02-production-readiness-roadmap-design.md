# Polygon: Roadmap к Production-Readiness

> **Дата:** 2026-04-02
> **Тип:** Improvement roadmap — от пет-проекта к публичному продакшну
> **Подход:** Гибридный — критический фундамент (Фаза 0), затем вертикальные срезы (Фазы 1-5)
> **Контекст:** Соло-разработка (разработчик + Claude Code), без дедлайнов, Kubernetes в перспективе

---

## Исходное состояние проекта

**Масштаб:** ~394 TS-файлов, ~29K LOC, версия 0.0.0 (pre-MVP)

**Backend:** 6 NestJS микросервисов (gateway + auth/user/chat/notification + media-stub), RabbitMQ event bus, PostgreSQL per-service, Redis, JWT + Passport, Socket.IO WebSocket

**Frontend:** React 19 + Vite 7, Feature-Sliced Design, Zustand + TanStack Query, Tailwind 4, React Hook Form + Zod

### Что работает хорошо

- Архитектура чистая — микросервисы изолированы, repository pattern, Zod-валидация сквозная
- Auth flow наиболее зрелый — bcrypt(12), JWT rotation, OAuth (GitHub/Google/Yandex), rate-limited login
- Module boundary enforcement через Nx
- Документация качественная (CLAUDE.md актуален, TODO.md — детальный roadmap)
- CI: lint + typecheck + tests через GitHub Actions
- Observability: Prometheus + Grafana + Pino JSON logging

### Критические проблемы

| Проблема                                                | Severity |
| ------------------------------------------------------- | -------- |
| Нет Helmet — отсутствуют все security-заголовки         | Critical |
| WebSocket CORS = `*` — любой сайт подключается к сокету | Critical |
| Hardcoded credentials в docker-compose.yml              | High     |
| Нет глобального API rate limiting (только login)        | High     |
| Нет CSRF-защиты                                         | High     |
| 13 тестов на 29K LOC, ноль фронтенд-тестов              | High     |
| Нет coverage thresholds — регрессии не ловятся          | Medium   |
| Media-service пустой stub                               | Medium   |
| Нет production deployment pipeline                      | Medium   |
| Grafana admin password в открытом виде                  | Low      |

---

## Фаза 0: Security & Infra Baseline

Быстрая фаза, закрывающая критические дыры до любой работы над фичами.

### 0.1 Security Hardening

| Что                    | Зачем                                                          | Как                                                                                                |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Helmet middleware      | Нет ни одного security-заголовка (X-Frame-Options, CSP и т.д.) | `npm i helmet`, добавить в gateway `main.ts`                                                       |
| WebSocket CORS         | Сейчас `*` — любой сайт может подключиться к сокету            | Ограничить до `CLIENT_URL`, как в REST CORS                                                        |
| Убрать hardcoded creds | docker-compose.yml содержит пароли в открытом виде             | Вынести в `.env`, в compose использовать `${VAR}`                                                  |
| Global rate limiting   | Только логин защищён, остальные endpoints открыты              | `@nestjs/throttler` на gateway — базовый лимит (100 req/min)                                       |
| CSRF защита            | Отсутствует полностью                                          | Double-submit cookie pattern (csurf deprecated — реализовать вручную или использовать `csrf-csrf`) |

### 0.2 Infra Baseline

| Что                 | Зачем                                    | Как                                                                                 |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Secrets management  | Всё в `.env` файлах — не масштабируется  | `.env` + `.env.example` строго в `.gitignore`. Позже: sealed-secrets для k8s        |
| Coverage thresholds | 13 тестов, нет порога                    | Jest config: `coverageThreshold: { global: { lines: 50 } }`, повышать по мере роста |
| CI усиление         | CI прогоняет тесты, но нет coverage gate | Добавить `--coverage` + fail если ниже порога                                       |
| Grafana credentials | admin/polygon_grafana в открытом виде    | Вынести в `.env` как и остальные сервисы                                            |

### 0.3 Что НЕ входит в Фазу 0

- Новые фичи
- Рефакторинг архитектуры
- Деплой
- Масштабные тестовые кампании

---

## Фаза 1: Auth Flow до production-ready

Auth — наиболее зрелый сервис. Задача — дочистить, покрыть тестами, закрыть оставшиеся дыры.

### 1.1 Баги и доработки

| Что                    | Проблема                                                      | Решение                                                                                                                          |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Refresh token rotation | Нет проверки reuse revoked токена                             | Reuse detection — если revoked refresh token используется повторно, отозвать ВСЕ токены пользователя (token family invalidation) |
| Account lockout        | `lockedAt`/`lockedUntil` в модели есть, логика не реализована | После N неудачных попыток — временная блокировка аккаунта, не только rate limit                                                  |
| Password reset token   | Нет лимита на количество запросов                             | Проверить что cooldown 60s в VerificationService работает корректно                                                              |
| OAuth fallback email   | `{providerId}@github.noemail` при отсутствии публичного email | Flow "укажите email" после OAuth, если email отсутствует                                                                         |
| Unverified cleanup     | `CleanupService` — проверить работоспособность                | Проверить cron, написать тест                                                                                                    |

### 1.2 Тестовое покрытие

| Слой                       | Текущее состояние                         | Цель                                                                                   |
| -------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Unit — AuthService         | `auth.service.spec.ts` существует         | Покрыть все ветки: register, login (success/fail/locked), refresh, revocation, OAuth   |
| Unit — VerificationService | `verification.service.spec.ts` существует | Покрыть: generate, verify, resend, cooldown, token expiry                              |
| Unit — TokenService        | Нет тестов                                | Создать: генерация, верификация, невалидный/просроченный токен                         |
| E2E — Auth endpoints       | `register.e2e.spec.ts` существует         | Дополнить: login, logout, refresh, verify-email, forgot/reset-password, OAuth callback |
| Frontend — Auth hooks      | Ноль тестов                               | `useLoginMutation`, `useRegisterMutation`, authed-fetch с 401 retry                    |

### 1.3 Security review чеклист

- [ ] JWT payload не содержит чувствительных данных (ок — только sub, role, isVerified)
- [ ] Refresh token хранится только как hash (ок — SHA256)
- [ ] Cookie flags: `HttpOnly`, `Secure` (в prod), `SameSite=Strict` — проверить все три
- [ ] Пароль не возвращается ни в одном ответе API
- [ ] Rate limiting на все auth endpoints (register, login, forgot-password, resend-verification)
- [ ] Timing-safe сравнение при валидации токенов

---

## Фаза 2: Chat Flow до production-ready

Ядро продукта — real-time чат.

### 2.1 Доработки

| Что                      | Текущее состояние                              | Решение                                                               |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| WebSocket аутентификация | Токен из `socket.handshake.auth['token']`      | Добавить валидацию expiry + reconnect с refresh                       |
| Отключение при logout    | Нет механизма                                  | При logout/token revoke — `force:disconnect` или Redis pub/sub        |
| Typing indicators        | `isTyping` в ChatStore, нет серверного события | `chat:typing` event через WebSocket (throttle 2-3s)                   |
| Пагинация сообщений      | Offset-based (skip/take)                       | Работает для MVP. Cursor-based — при необходимости позже              |
| Групповые чаты           | Модель поддерживает (GROUP/CHANNEL), API нет   | Endpoints: create group, add/remove members, admin actions            |
| Read status              | Нет                                            | `lastReadAt` в ChatMember                                             |
| Unread count             | Нет                                            | COUNT messages WHERE createdAt > member.lastReadAt                    |
| Online status            | Нет                                            | Redis set с подключёнными userId, `user:online`/`user:offline` events |

### 2.2 Тестовое покрытие

| Слой                        | Цель                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Unit — ChatService          | createDirectChat, sendMessage (membership), getMessages (пагинация, access denied)        |
| Unit — ChatPrismaRepository | Все методы с реальной test-БД                                                             |
| E2E — Chat endpoints        | create direct, send/get messages, membership enforcement                                  |
| E2E — WebSocket             | connect, join room, receive broadcast, disconnect, unauthorized                           |
| Frontend — chat hooks       | `useGetChatsQuery`, `useSendMessageMutation` (optimistic update), `useChatSocket` (dedup) |

### 2.3 Производительность

| Что                 | Зачем                                    | Как                                              |
| ------------------- | ---------------------------------------- | ------------------------------------------------ |
| Message query index | Есть `(chatId, createdAt)`               | Проверить EXPLAIN на реальных данных             |
| WebSocket rooms     | Socket.IO rooms — ок для одного инстанса | При масштабировании: Redis adapter               |
| Connection limits   | Нет лимита                               | Max connections на gateway + graceful disconnect |

### 2.4 Фронтенд — аудит ререндеров

Исследование фактической render-производительности с замерами:

| Область            | Что проверить                                | Потенциальные проблемы                                                                  |
| ------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Zustand stores     | Точечные селекторы vs подписка на весь store | Подписка на весь store = ререндер при любом изменении                                   |
| React Query        | invalidation при `message:new` через сокет   | Частый invalidate = частый refetch = ререндер списка                                    |
| Optimistic updates | setQueryData + onSettled invalidate          | Двойной ререндер: optimistic insert + full refetch                                      |
| Socket listener    | Мемоизация, пересоздание listeners           | Утечка listeners + лишние ререндеры                                                     |
| Список сообщений   | Все сообщения рендерятся массивом            | Нет виртуализации — тормоза при 500+ сообщениях. `react-virtuoso` / `@tanstack/virtual` |
| Список чатов       | Все чаты с превью                            | Аналогично при 100+ чатах                                                               |
| Callbacks в props  | `useCallback` использование                  | Новая ссылка каждый рендер → ререндер дочерних                                          |
| Theme toggle       | Context update                               | Все потребители контекста ререндерятся                                                  |

**Инструменты:**

- React DevTools Profiler — запись сессии (20 сообщений), поиск лишних ререндеров
- `why-did-you-render` — автоматический лог unnecessary re-renders в dev

**Результат:** Документ с конкретными findings: "компонент X ререндерится N раз при действии Y, причина — Z, фикс — W". Без спекуляций — только измеренные данные.

---

## Фаза 3: User Profiles + Media

### 3.1 User Service — доработки

| Что                 | Текущее состояние                             | Решение                                                                  |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Поиск пользователей | `searchByName` в репо, нет endpoint           | `GET /api/users/search?q=` с пагинацией, debounce на фронте              |
| Валидация update    | `UpdateUserDto` — displayName, avatarUrl, bio | Ограничения: bio (500 chars), формат avatarUrl, sanitization displayName |
| Синхронизация email | Auth и User хранят email независимо           | Учитывать в архитектуре, не реализовывать "change email" пока            |

### 3.2 Media Service — реализация с нуля

**Архитектура:**

| Компонент | Решение                                                               | Почему                                                      |
| --------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Хранилище | Локальная FS для dev, S3-compatible (MinIO) для prod                  | MinIO в Docker, API идентичен S3 — переход на AWS бесшовный |
| Загрузка  | Multer middleware на gateway → media-service                          | Gateway проксирует файл, media-service сохраняет            |
| БД        | `File (id, ownerId, filename, mimeType, size, storageKey, createdAt)` | Метаданные в БД, файл в object storage                      |

**Security:**

| Что                   | Как                                               |
| --------------------- | ------------------------------------------------- |
| Лимит размера         | Max 10MB изображения, 50MB файлы (настраиваемо)   |
| Валидация MIME        | Magic bytes, не доверять Content-Type             |
| Генерация имён        | UUID-based storage key — исключает path traversal |
| Доступ                | Только участники чата могут скачивать медиа чата  |
| Обработка изображений | `sharp` — resize аватарок (256x256), thumbnails   |

**Endpoints:**

```
POST   /api/media/upload          — загрузить файл (JwtGuard)
GET    /api/media/:id             — получить файл (проверка доступа)
DELETE /api/media/:id             — удалить (только владелец)
PATCH  /api/users/me/avatar       — загрузить аватар (обёртка)
```

### 3.3 Тестовое покрытие

| Слой                | Цель                                                                |
| ------------------- | ------------------------------------------------------------------- |
| Unit — UserService  | getById, update, search                                             |
| Unit — MediaService | upload (size/mime), delete (ownership)                              |
| E2E — User          | search, update profile, upload avatar                               |
| E2E — Media         | upload, download (auth + access), delete                            |
| Frontend            | Профиль, avatar upload с preview, поиск пользователей, медиа в чате |

### 3.4 Фронтенд

| Что           | Решение                                               |
| ------------- | ----------------------------------------------------- |
| Профиль       | `/settings` — редактирование displayName, bio, avatar |
| Avatar upload | File picker, preview, crop (опционально)              |
| Поиск         | Search input с debounced query для создания чата      |
| Медиа в чате  | Превью изображений inline, скачивание файлов          |

---

## Фаза 4: Notifications

### 4.1 Расширение

**Два канала доставки:**

| Канал  | Сейчас                        | Цель                                                                              |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Email  | Verification + password reset | + Welcome email, + email о новом устройстве (опционально)                         |
| In-app | Нет                           | WebSocket push: новое сообщение в неактивном чате, добавление в группу, системные |

**Prisma schema:**

```
Notification (id, userId, type, title, body, isRead, metadata JSON, createdAt)
```

**Новые events:**

| Event                        | Триггер                              | Действие                        |
| ---------------------------- | ------------------------------------ | ------------------------------- |
| `NOTIFICATION.NEW_MESSAGE`   | sendMessage, получатель не в комнате | In-app notification + WebSocket |
| `NOTIFICATION.ADDED_TO_CHAT` | addChatMember                        | Уведомить добавленного          |
| `NOTIFICATION.WELCOME`       | register (после верификации)         | Welcome email                   |

### 4.2 Фронтенд

| Что                 | Решение                                              |
| ------------------- | ---------------------------------------------------- |
| Notification center | Иконка в хедере с unread badge, dropdown             |
| Real-time           | Подписка на `notification:new` через socket          |
| Mark as read        | `PATCH /api/notifications/:id/read` + batch read-all |
| State               | `notificationStore` (Zustand) с `unreadCount`        |

### 4.3 Email templates

| Что          | Решение                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| Шаблонизатор | Строковая интерполяция — достаточно для MVP. При росте — `@react-email/components` |
| Стилизация   | Базовый inline-CSS шаблон с логотипом                                              |
| Preview      | Mailhog (уже в docker-compose)                                                     |

### 4.4 Тестовое покрытие

| Слой                       | Цель                                                   |
| -------------------------- | ------------------------------------------------------ |
| Unit — NotificationService | Каждый event handler: шаблон, получатель, запись в БД  |
| Unit — Repository          | CRUD, mark as read, batch, unread count                |
| E2E — Endpoints            | GET notifications (пагинация), mark read, unread count |
| E2E — Event flow           | Сообщение → notification → WebSocket push              |
| Frontend                   | NotificationStore, unread badge, mark as read          |

---

## Фаза 5: Production Deployment & CI/CD

### 5.1 Контейнеризация

| Что          | Сейчас          | Цель                                                              |
| ------------ | --------------- | ----------------------------------------------------------------- |
| Dockerfiles  | Нет             | Multi-stage: build (npm ci + nx build) → runtime (node:20-alpine) |
| Фронтенд     | Vite dev server | nginx-alpine: static + проксирование `/api`                       |
| Compose prod | Только infra    | `docker-compose.prod.yml`: все сервисы + infra + MinIO            |

### 5.2 CI/CD Pipeline

**Итоговый pipeline:**

```
PR → lint → typecheck → test (coverage) → build → e2e
merge to main → всё выше + docker build + push GHCR → deploy staging
manual trigger → deploy production
```

### 5.3 Kubernetes подготовка

Не внедряем k8s сейчас, но готовим:

| Что               | Решение                                           |
| ----------------- | ------------------------------------------------- |
| Health endpoints  | Уже есть `/health` — k8s readiness/liveness ready |
| Graceful shutdown | Проверить `enableShutdownHooks()`                 |
| Config            | Env vars → прямой маппинг на ConfigMap/Secret     |
| Stateless         | Сервисы stateless — горизонтально масштабируемы   |
| Логи              | Pino JSON — k8s-native                            |

### 5.4 Secrets Management

| Этап                | Решение                                       |
| ------------------- | --------------------------------------------- |
| Dev                 | `.env` файлы                                  |
| CI                  | GitHub Secrets                                |
| Docker Compose prod | `.env.production` (не в git) + docker secrets |
| Kubernetes          | External Secrets Operator → Vault / AWS SM    |

### 5.5 Мониторинг

| Что            | Сейчас               | Цель                                                        |
| -------------- | -------------------- | ----------------------------------------------------------- |
| Метрики        | Prometheus + Grafana | Проверить покрытие дашбордом всех сервисов                  |
| Логи           | Pino JSON            | В k8s — Loki/Fluentd                                        |
| Error tracking | Нет                  | GlitchTip (self-hosted Sentry)                              |
| Alerting       | Нет                  | Grafana alerts: latency > 1s, error rate > 5%, service down |
| Uptime         | Нет                  | Health endpoint monitoring (Gatus)                          |

---

## Порядок выполнения и зависимости

```
Фаза 0 — Security & Infra Baseline
  │
Фаза 1 — Auth Flow
  │
Фаза 2 — Chat Flow + Render Audit
  │
Фаза 3 — User Profiles + Media
  │
Фаза 4 — Notifications
  │
Фаза 5 — Production Deployment
```

**Зависимости:**

| Зависимость            | Причина                                          |
| ---------------------- | ------------------------------------------------ |
| Фаза 0 → всё остальное | Без baseline security нет смысла строить фичи    |
| Фаза 1 → Фаза 2        | Chat использует auth — auth должен быть стабилен |
| Фаза 2 → Фаза 3        | Media нужно для файлов в чатах                   |
| Фаза 2 → Фаза 4        | Notifications триггерятся из chat events         |
| Фазы 1-4 → Фаза 5      | Деплоить когда фичи стабильны                    |

## Сквозные практики

На каждой фазе:

- **Тесты** — каждая фича с unit + e2e тестами, coverage не опускается ниже порога
- **Security review** — чеклист при завершении фазы
- **Документация** — обновлять ARCHITECTURE.md и Swagger по мере изменений
- **Code review** — Claude Code reviewer agent после каждой крупной задачи
