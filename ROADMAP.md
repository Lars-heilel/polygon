# Polygon — Roadmap

Анализ legacy-проекта (LegacySrc) выявил что было сделано хорошо и что надо исправить.
Этот файл — живой чеклист. Отмечай по мере выполнения.

---

## ✅ Что было хорошо (сохраняем и развиваем)

- FSD архитектура на фронте
- Repository pattern на бэке
- Zod валидация на обоих сторонах
- RTK Query с кешированием
- JWT access + refresh tokens с ротацией
- Bcrypt для паролей
- Swagger документация
- Docker + multi-stage builds
- Redis для сессий WebSocket

---

## 🏗️ Фаза 1 — Фундамент

### Дизайн-система
- [x] Tailwind v4 + дизайн-токены (dark/light темы)
- [x] ThemeProvider + useTheme
- [x] Компоненты: Heading, Text, Button, IconButton, Input, Textarea, Avatar, Badge, Divider, Spinner
- [x] Storybook с autodocs
- [ ] Компоненты: Tooltip, Dropdown, Modal, Toast

### Роутинг
- [x] React Router v7
- [x] AuthLayout в shared (переиспользуемый)
- [x] Маршруты: /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password
- [x] Маршруты: /chats, /chats/:chatId, /settings
- [x] Protected routes (guard для авторизованных маршрутов)
- [x] 404 страница (в libs/client/pages)

### Инфраструктура приложения
- [x] Providers слой (легко добавлять новые провайдеры)
- [x] RTK Query — настроен, store готов
- [x] Глобальный error boundary
- [x] Env validation на старте (zod, падает с понятной ошибкой)

---

## 🔐 Фаза 2 — Авторизация

### Бэк (auth-service)
- [x] Register endpoint
- [x] Login endpoint
- [x] Refresh token endpoint с ротацией
- [x] Logout endpoint
- [x] Email verification — генерация и отправка токена (Nodemailer)
- [ ] Resend verification endpoint
- [ ] Forgot password — отправка письма с токеном
- [ ] Reset password — валидация токена + смена пароля
- [ ] OAuth (Google) через Passport

### Фронт
- [x] Страницы: login, register, forgot-password, reset-password (роуты созданы)
- [ ] Форма логина (React Hook Form + Zod), подключена к API
- [ ] Форма регистрации (React Hook Form + Zod), подключена к API
- [ ] Форма forgot-password, подключена к API
- [ ] Форма reset-password (токен из URL), подключена к API
- [ ] Refresh token interceptor (автоматически обновлять при 401)
- [ ] Logout с очисткой стейта
- [ ] OAuth кнопки (Google)

> ⚠️ Legacy ошибка: CORS URL был захардкожен в двух местах включая WebSocket gateway.
> Решение: один источник истины — переменная окружения.

---

## 💬 Фаза 3 — Мессенджер

### Бэк (chat-service, gateway)
- [x] WebSocket gateway (chat.socket-gateway.ts)
- [x] Chat controller в Gateway (REST: создать чат, отправить сообщение)
- [x] Очереди RabbitMQ для chat и notification
- [ ] Пагинация истории сообщений (cursor-based)
- [ ] Статус прочитано/непрочитано
- [ ] Индексы в БД: senderId, chatRoomId, createdAt
- [ ] Грамотная обработка переподключения WebSocket

### Фронт
- [x] Socket.io клиент (socket.ts, use-chat-socket.ts)
- [x] RTK Query для chat API (chat-api.ts)
- [ ] Sidebar: список чатов с аватаром, последним сообщением, счётчиком непрочитанных
- [ ] ChatWindow: список сообщений с виртуализацией (react-virtual)
- [ ] MessageInput: textarea + кнопка отправки + attach
- [ ] Оптимистичные обновления при отправке сообщения
- [ ] Infinite scroll для истории сообщений
- [ ] Индикатор онлайн-статуса
- [ ] Индикатор "печатает..."
- [ ] Поиск пользователей для нового чата
- [ ] Управление дружбой (запросы, принять/отклонить)

> ⚠️ Legacy ошибка: Message.createAt вместо createdAt, уникальный индекс на timestamp+id без смысла.
> Решение: правильные имена полей, индексы только на читаемых колонках.

---

## 🖼️ Фаза 4 — Медиа

### Инфраструктура
- [ ] MinIO в docker-compose (для dev)
- [ ] Cloudflare R2 как продакшен-хранилище (бесплатный tier: 10 GB, 0 за egress)
- [ ] Env vars: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_KEY`, `STORAGE_SECRET`

### Бэк (media-service)
- [ ] Prisma схема: `Media` (id, key, url, mimeType, size, ownerId, bucket, createdAt)
- [ ] `@aws-sdk/client-s3` клиент (S3-совместимый — работает с MinIO и R2)
- [ ] `POST /media/upload` — multipart/form-data, через Gateway
- [ ] Валидация: допустимые MIME-типы (image/jpeg, image/png, image/webp), максимальный размер
- [ ] Конвертация в WebP + ресайз через `sharp`
- [ ] Сохранение метаданных в PostgreSQL
- [ ] `DELETE /media/:id` — удаление файла и записи

### Фронт
- [ ] Компонент загрузки аватара (drag & drop или клик)
- [ ] Предпросмотр перед загрузкой
- [ ] Прогресс-бар загрузки
- [ ] Обновление аватара в профиле пользователя

---

## 🧪 Фаза 5 — Качество

### Логирование и мониторинг
- [x] Структурированные логи на бэке (Pino)
- [x] Health check endpoints
- [x] Prometheus метрики
- [x] Глобальный exception filter
- [ ] Sentry для отслеживания ошибок в продакшене
- [ ] Убрать console.error() из продакшн кода фронта

### Безопасность
- [ ] Rate limiting на auth endpoints (Throttler)
- [ ] Helmet.js для HTTP headers
- [ ] Санитизация входящих сообщений
- [ ] Все секреты через env, никаких хардкодов

### Тесты
- [ ] Unit-тесты для всех сервисов бэка (auth, user, chat, media)
- [ ] Unit-тесты для хуков и утилит фронта
- [ ] Integration-тесты для API endpoints
- [ ] E2E тесты ключевых флоу (Playwright): login → chat → send message

> ⚠️ Legacy ошибка: 1 тест файл на весь бэк, 0 на фронт.

---

## 🚀 Фаза 6 — DevOps

- [ ] CI/CD pipeline (GitHub Actions): lint → typecheck → test → build
- [ ] Secrets management (не в .env в репо)
- [ ] Миграции отдельно от старта сервиса
- [ ] Логи контейнеров в structured JSON

> ⚠️ Legacy ошибка: visualizer({ open: true }) — ломал CI/CD.
> Решение: запускать через отдельный скрипт, не в дефолтном билде.

---

## 📌 Постоянные правила (вынесены из ошибок legacy)

| Правило | Причина |
|---------|---------|
| CORS URLs только из env | Был захардкожен Vercel URL прямо в gateway |
| Все env vars — required | POSTGRES_* были optional, падало в рантайме |
| Только английский в коде | Были русские комментарии в debug логах |
| Типы без typo в именах | `Intreface`, `stratrgy`, `createAt` — путали |
| console.* только в dev | console.error в продакшне светил ошибки юзеру |
| Тесты пишем сразу | Не "потом" — потом не будет |
