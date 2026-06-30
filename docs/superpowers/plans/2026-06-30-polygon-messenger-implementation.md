# Polygon Messenger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Довести Polygon Messenger до состояния production-ready demo для показа работодателю

**Architecture:** Микросервисы (NestJS) + React SPA (FSD) + RabbitMQ + PostgreSQL/Redis/MinIO + Meilisearch. Каждый сервис изолирован, коммуникация асинхронная.

**Tech Stack:** NestJS 11, React 19, Prisma, RabbitMQ, Socket.IO, Redis, MinIO, Meilisearch, Tailwind v4, Zustand, TanStack Query, WebRTC, Web Push API

**Specs:** `docs/specs/SPEC.md` и файлы в `docs/specs/*.md`

---

## Фазы реализации

План разбит на 10 фаз. Каждая фаза — самодостаточный блок с тестируемым результатом. Фазы можно выполнять параллельно, если есть несколько разработчиков.

---

## Phase 0: Critical Fixes (Infrastructure + Auth + Gateway)

**Цель:** Стабильная основа перед фича-разработкой.

### Task 0.1: Global Exception Filter (Gateway)

**Files:**
- Create: `libs/backend/core/src/filters/global-exception.filter.ts`
- Modify: `apps/backend/gateway/src/main.ts`

**Описание:** Нормализация всех HTTP-ответов с ошибками в единый формат.

### Task 0.2: Redis Session Check in JwtGuard (Gateway)

**Files:**
- Modify: `libs/backend/core/src/guards/jwt.guard.ts`

**Описание:** После верификации JWT проверять `session:{sessionId}` в Redis. Если сессии нет — 401.

### Task 0.3: Account Locking (Auth)

**Files:**
- Modify: `libs/backend/auth/src/services/auth.service.ts`
- Modify: `libs/backend/auth/src/database/repository/auth.prisma.repo.ts`

**Описание:** После 5 неудачных попыток — `lockedAt = now()`, `lockedUntil = now() + 15min`. Возвращать 423 Locked.

### Task 0.4: fix features-search placeholder (Client)

**Files:**
- Modify: `libs/client/features/search/src/index.ts`

**Описание:** Убрать пустой barrel, либо добавить базовую заглушку.

### Task 0.5: Cleanup Notification empty Prisma

**Files:**
- Modify: `libs/backend/notification/src/database/prisma/schema.prisma`

**Описание:** Добавить модели PushSubscription и NotificationLog, либо убрать схему.

### Task 0.6: bootstrap.sh validation

**Files:**
- Modify: `scripts/bootstrap.sh`

**Описание:** Проверить что скрипт поднимает всё с нуля. Пофиксить найденные проблемы.

---

## Phase 1: Auth & User Polish

**Цель:** Допилить аутентификацию и соц-фичи пользователей.

### Task 1.1: Avatar delete handling (Media → User)

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`
- Modify: `libs/backend/core/src/constants/queues/user.queue.ts`

**Описание:** При удалении активного AVATAR файла → User Service сбрасывает `avatarUrl` в null.

### Task 1.2: Status / Presence (User + Gateway)

**Files:**
- Modify: `libs/backend/user/src/database/prisma/schema.prisma`
- Modify: `libs/backend/user/src/services/user.service.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`

**Описание:** Модель User + поля status, lastSeenAt. Обновление при WS disconnect. Explicit status через API.

### Task 1.3: Block user (User)

**Files:**
- Create: `libs/backend/user/src/database/prisma/migrations/`
- Modify: `libs/backend/user/src/services/user.service.ts`
- Create: `libs/backend/user/src/database/repository/block.prisma.repo.ts` (если нужно)

**Описание:** Таблица BlockedUser. API блокировки/разблокировки. Фильтр сообщений от заблокированных.

### Task 1.4: Placeholder avatar (Client)

**Files:**
- Modify: `libs/client/shared/src/lib/ui/avatar.tsx`

**Описание:** Если avatarUrl = null → показывать инициалы (первые буквы name/displayName).

### Task 1.5: react-email templates (Notification)

**Files:**
- Create: `libs/backend/notification/src/templates/verification.tsx`
- Create: `libs/backend/notification/src/templates/password-reset.tsx`
- Create: `libs/backend/notification/src/templates/welcome.tsx`
- Modify: `libs/backend/notification/src/services/notification.service.ts`

**Описание:** Современные HTML-шаблоны для писем с поддержкой dark mode.

### Task 1.6: fix avatarUrl in Meilisearch (Search)

**Files:**
- Modify: `libs/backend/search/src/services/search.service.ts`

**Описание:** При индексации пользователя сохранять avatarUrl в документ Meilisearch.

---

## Phase 2: Media Processing Pipeline

**Цель:** Асинхронная обработка файлов (thumbnail, waveform, preview).

### Task 2.1: Add PROCESSING status + fields (Media)

**Files:**
- Modify: `libs/backend/media/src/database/prisma/schema.prisma`

**Описание:** Добавить FileStatus.PROCESSING, поля thumbnailUrl, waveform.

### Task 2.2: RabbitMQ worker for media processing (Media)

**Files:**
- Create: `libs/backend/media/src/workers/media.worker.ts`
- Create: `libs/backend/media/src/services/processing.service.ts`
- Modify: `libs/backend/media/src/lib/media.module.ts`

**Описание:** Слушает `media.process`, вызывает sharp/ffmpeg/audiowaveform. Обновляет статус на READY. Эмитит `media.ready`.

### Task 2.3: Confirm → PROCESSING flow (Media)

**Files:**
- Modify: `libs/backend/media/src/controllers/media.controller.ts`
- Modify: `libs/backend/media/src/services/media.service.ts`

**Описание:** После confirm → status PROCESSING → emit `media.process` → ответ клиенту с PROCESSING.

### Task 2.4: Orphan cleanup cron (Media)

**Files:**
- Modify: `libs/backend/media/src/services/media.service.ts`
- Create: `libs/backend/media/src/services/cleanup.service.ts`

**Описание:** Cron: каждый час удалять PENDING файлы старше 30 минут.

---

## Phase 3: Chat Messages UX

**Цель:** Редактирование, удаление, link preview, поиск сообщений.

### Task 3.1: Edit message (Chat)

**Files:**
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/core/src/constants/queues/chat.queue.ts`

**Описание:** PATCH → isEdited = true. WS эмит `message:edited`. Проверка автора + таймаут.

### Task 3.2: Delete message for all / for me (Chat)

**Files:**
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`

**Описание:** DELETE mode=for_all → isDeleted. mode=for_me → HiddenMessage. WS эмит `message:deleted`.

### Task 3.3: Link preview (Chat)

**Files:**
- Create: `libs/backend/chat/src/services/link-preview.service.ts`
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`

**Описание:** При отправке URL → асинхронный парсинг OG тегов → сохранение LinkPreview → WS эмит с preview.

### Task 3.4: Search messages (Chat → Search)

**Files:**
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Create: `libs/backend/core/src/constants/queues/search.queue.ts` (добавить message patterns)
- Modify: `libs/backend/search/src/services/search.service.ts`

**Описание:** Chat Service шлёт события при создании/изменении/удалении. Search индексирует. API поиска с фильтром по chatId.

### Task 3.5: Unread count + lastReadMessageId (Chat)

**Files:**
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma` (lastReadMessageId)
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`

**Описание:** При получении сообщения — если не в комнате → инкремент unread. POST markRead.

---

## Phase 4: Audio/Video Players (Client)

**Цель:** Полноценные плееры для аудио, видео, кружков.

### Task 4.1: Audio player with waveform (Client)

**Files:**
- Create: `libs/client/shared/src/lib/ui/audio-player.tsx`
- Modify: `libs/client/shared/src/index.ts`

**Описание:** Waveform (canvas или SVG), play/pause, speed (0.5x-2x), seek, time display.

### Task 4.2: Voice message player (Client)

**Files:**
- Create: `libs/client/shared/src/lib/ui/voice-player.tsx`
- Modify: `libs/client/shared/src/index.ts`

**Описание:** Compact variant audio-player, waveform, play/pause.

### Task 4.3: Video player inline + fullscreen (Client)

**Files:**
- Create: `libs/client/shared/src/lib/ui/video-player.tsx`
- Modify: `libs/client/shared/src/index.ts`

**Описание:** Кастомные контролы, fullscreen, auto-play (muted) при скролле.

### Task 4.4: Circle player (Client)

**Files:**
- Create: `libs/client/shared/src/lib/ui/circle-player.tsx`
- Modify: `libs/client/shared/src/index.ts`

**Описание:** Video с border-radius:50%, auto-play, loop, muted. Tap → fullscreen.

### Task 4.5: Message bubble rendering for all types (Client)

**Files:**
- Modify: `libs/client/entities/message/src/lib/message-bubble.tsx`

**Описание:** Рендеринг всех типов сообщений: TEXT, IMAGE (thumbnail), AUDIO (player), VIDEO (player), VOICE (voice-player), CIRCLE (circle-player), FILE (download link).

---

## Phase 5: Media Gallery (Client)

**Цель:** Вкладки медиа/файлы/аудио/видео/ссылки внутри чата.

### Task 5.1: Chat media gallery API integration (Client)

**Files:**
- Create: `libs/client/features/media-gallery/src/lib/api.ts`
- Create: `libs/client/features/media-gallery/src/lib/hooks.ts`
- Create: `libs/client/features/media-gallery/src/index.ts`

**Описание:** Запросы к /chats/:chatId/media/history с фильтром по категории.

### Task 5.2: Gallery tabs UI (Client)

**Files:**
- Create: `libs/client/features/media-gallery/src/lib/ui/gallery-tabs.tsx`
- Create: `libs/client/features/media-gallery/src/lib/ui/media-grid.tsx`
- Create: `libs/client/features/media-gallery/src/lib/ui/files-list.tsx`
- Create: `libs/client/features/media-gallery/src/lib/ui/links-list.tsx`

**Описание:** Табы Медиа/Файлы/Аудио/Видео/Ссылки. Сетка для медиа, таблица для файлов, список для ссылок.

### Task 5.3: Integrate gallery into ChatPage (Client)

**Files:**
- Modify: `libs/client/pages/chat-page/src/lib/chat-page.tsx`

**Описание:** Добавить вкладки в header чата или как отдельный экран.

---

## Phase 6: Push Notifications

**Цель:** Push-уведомления через Service Worker.

### Task 6.1: PushSubscription model + API (Notification)

**Files:**
- Modify: `libs/backend/notification/src/database/prisma/schema.prisma`
- Create: `libs/backend/notification/src/controllers/push.controller.ts`
- Create: `libs/backend/notification/src/services/push.service.ts`
- Modify: `libs/backend/notification/src/lib/notification.module.ts`

**Описание:** Хранение подписок. POST subscribe, DELETE unsubscribe. Web Push API отправка.

### Task 6.2: Push on new message (Chat → Notification)

**Files:**
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `libs/backend/core/src/constants/queues/notification.queue.ts`

**Описание:** При отправке сообщения — если получатель не в комнате → emit `notification.send-push`.

### Task 6.3: Service Worker registration (Client)

**Files:**
- Create: `apps/client/messenger/sw.js`
- Modify: `apps/client/messenger/src/app/main.tsx`

**Описание:** SW регистрация. Push event → notification. Клик → открытие чата.

### Task 6.4: Push subscription on login (Client)

**Files:**
- Create: `libs/client/features/notifications/src/lib/push.ts`
- Modify: `apps/client/messenger/src/app/providers/index.tsx`

**Описание:** После логина — подписка на push. Отправка endpoint на сервер.

---

## Phase 7: Group Chats ★

**Цель:** Групповые чаты с ролями.

### Task 7.1: Create group API (Chat)

**Files:**
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/core/src/constants/queues/chat.queue.ts`

**Описание:** POST /chats с type=GROUP, name, userIds[]. Создание + добавление участников с ролью CREATOR для создателя.

### Task 7.2: Group management API (Chat)

**Files:**
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`

**Описание:** POST/DELETE members, PATCH member role. WS эмит `chat:memberJoined`, `chat:memberLeft`.

### Task 7.3: System messages for events (Chat)

**Files:**
- Modify: `libs/backend/chat/src/services/chat.service.ts`

**Описание:** Автоматическая генерация SYSTEM сообщений (user joined, user left, role changed).

### Task 7.4: Group UI (Client)

**Files:**
- Create: `libs/client/features/create-chat/src/lib/ui/create-group-modal.tsx`
- Create: `libs/client/features/chat-settings/src/lib/ui/group-settings.tsx`
- Modify: `libs/client/entities/chat/src/lib/chat-list.tsx`
- Modify: `libs/client/shared/src/lib/ui/avatar.tsx`

**Описание:** Create group modal. Group header с участниками. Group settings (kick, roles).

---

## Phase 8: Calls (WebRTC) ★

**Цель:** Аудио/видео звонки.

### Task 8.1: WebRTC signaling via WS (Gateway)

**Files:**
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`

**Описание:** Relay SDP offer/answer + ICE candidates между участниками.

### Task 8.2: P2P call client (Client)

**Files:**
- Create: `libs/client/features/calls/src/lib/webrtc.ts`
- Create: `libs/client/features/calls/src/lib/ui/call-overlay.tsx`
- Create: `libs/client/features/calls/src/lib/ui/call-button.tsx`
- Create: `libs/client/features/calls/src/index.ts`
- Modify: `libs/client/pages/chat-page/src/lib/chat-page.tsx`

**Описание:** WebRTC peer connection, media streams, call overlay UI (avatar, timer, mute, end).

### Task 8.3: Group calls (Client + Gateway)

**Files:**
- Modify: `libs/client/features/calls/src/lib/webrtc.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`

**Описание:** SFU (Selective Forwarding Unit) или mesh-topology для групповых звонков.

---

## Phase 9: PWA + Polish

**Цель:** Production-ready UI для демки.

### Task 9.1: PWA manifest config (Client)

**Files:**
- Modify: `apps/client/messenger/index.html`
- Create: `apps/client/messenger/manifest.json`

**Описание:** Иконки, splash screen, theme color, display standalone.

### Task 9.2: Skeleton screens (Client)

**Files:**
- Create: `libs/client/shared/src/lib/ui/skeleton.tsx`
- Modify: `libs/client/pages/messenger-main/src/lib/messenger-main-page.tsx`
- Modify: `libs/client/pages/chat-page/src/lib/chat-page.tsx`

**Описание:** Skeletons для списка чатов и сообщений.

### Task 9.3: Empty states (Client)

**Files:**
- Modify: `libs/client/shared/src/lib/ui/empty-state.tsx`
- Modify: `libs/client/pages/messenger-main/src/lib/messenger-main-page.tsx`

**Описание:** "Нет чатов", "Нет сообщений", "Ничего не найдено".

### Task 9.4: Mobile responsive (Client)

**Files:**
- Modify: `libs/client/pages/messenger-main/src/lib/messenger-main-page.tsx`
- Modify: `libs/client/layouts/sidebar/src/lib/sidebar-layout.tsx`
- Create: `libs/client/layouts/mobile/src/lib/mobile-layout.tsx`

**Описание:** На мобильных — bottom tabs, sidebar как overlay.

### Task 9.5: Message animations (Client)

**Files:**
- Modify: `libs/client/entities/message/src/lib/message-bubble.tsx`

**Описание:** Анимация появления новых сообщений, обновления списка.

---

## Дорожная карта

```
Фаза 0: Critical Fixes        → 1-2 дня
Фаза 1: Auth & User Polish    → 2-3 дня
Фаза 2: Media Pipeline        → 2-3 дня
Фаза 3: Chat Messages UX      → 3-4 дня
Фаза 4: Audio/Video Players   → 2-3 дня
Фаза 5: Media Gallery         → 1-2 дня
Фаза 6: Push Notifications    → 2-3 дня
Фаза 7: Group Chats ★         → 3-4 дня
Фаза 8: Calls ★               → 4-5 дней
Фаза 9: PWA + Polish          → 2-3 дня
                              ─────────
                    Итого:    ~22-32 дня
```

Фазы 0-1-2-3 — основа, можно показывать работодателю уже после них.
Фазы 7-8 — задачи со звездочкой, если успеваем.
