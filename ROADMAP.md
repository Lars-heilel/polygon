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

## 🏗️ Фаза 1 — Фундамент (сейчас)

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

### Фронт
- [ ] Форма логина (React Hook Form + Zod)
- [ ] Форма регистрации (React Hook Form + Zod)
- [ ] Форма forgot-password
- [ ] Форма reset-password (токен из URL)
- [ ] OAuth кнопки (Google)
- [ ] Сохранение токенов (httpOnly cookie или secure storage)
- [ ] Refresh token interceptor (автоматически обновлять при 401)
- [ ] Logout с очисткой стейта

### Бэк (auth-service)
- [ ] Register endpoint
- [ ] Login endpoint (local strategy)
- [ ] Refresh token endpoint с ротацией
- [ ] Logout endpoint
- [ ] OAuth (Google) через Passport
- [ ] Forgot password — отправка письма с токеном
- [ ] Reset password — валидация токена + смена пароля
- [ ] Все env vars обязательные (не .optional())

> ⚠️ Legacy ошибка: CORS URL был захардкожен в двух местах включая WebSocket gateway.
> Решение: один источник истины — переменная окружения.

---

## 💬 Фаза 3 — Мессенджер

### Фронт
- [ ] Sidebar: список чатов с аватаром, последним сообщением, счётчиком непрочитанных
- [ ] ChatWindow: список сообщений с виртуализацией (react-virtual)
- [ ] MessageInput: textarea + кнопка отправки + attach
- [ ] Оптимистичные обновления при отправке сообщения
- [ ] Infinite scroll для истории сообщений
- [ ] Индикатор онлайн-статуса
- [ ] Индикатор "печатает..."
- [ ] Поиск пользователей для нового чата
- [ ] Управление дружбой (запросы, принять/отклонить)

### Бэк (chat-service, user-service)
- [ ] WebSocket gateway — вынести логику в отдельные сервисы
- [ ] Грамотная обработка переподключения
- [ ] Пагинация истории сообщений (cursor-based)
- [ ] Статус прочитано/непрочитано
- [ ] Индексы в БД: senderId, chatRoomId, createdAt

> ⚠️ Legacy ошибка: Message.createAt вместо createdAt, уникальный индекс на timestamp+id без смысла.
> Решение: правильные имена полей, индексы только на читаемых колонках.

---

## 🧪 Фаза 4 — Качество

### Тесты
- [ ] Unit-тесты для всех сервисов бэка (auth, user, chat, friendship)
- [ ] Unit-тесты для хуков и утилит фронта
- [ ] Integration-тесты для API endpoints
- [ ] E2E тесты ключевых флоу (Playwright): login → chat → send message

> ⚠️ Legacy ошибка: 1 тест файл на весь бэк, 0 на фронт.

### Логирование и мониторинг
- [ ] Структурированные логи на бэке (Pino или Winston)
- [ ] Убрать console.error() из продакшн кода фронта
- [ ] Sentry или аналог для отслеживания ошибок
- [ ] Health check endpoints

### Безопасность
- [ ] Rate limiting на auth endpoints
- [ ] Санитизация входящих сообщений
- [ ] Helmet.js для HTTP headers
- [ ] Все секреты через env, никаких хардкодов

---

## 🚀 Фаза 5 — DevOps

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
