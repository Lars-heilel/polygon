# Chat System Audit

Дата аудита: 2026-07-14

## Цель

Проверить фактическую реализацию chat-системы на frontend и backend, сравнить ее со старыми спецификациями и зафиксировать новый рабочий контракт для следующего этапа: тесты Jest/Playwright, исправление багов, обязательное логирование, обновление Swagger и правил разработки.

Старые документы `docs/specs/chat-service.md`, `docs/specs/client-messenger.md` и `docs/specs/gateway-service.md` используются как входные материалы для переписывания. Они не считаются полностью актуальным контрактом.

## Проверенные источники

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/MONOREPO_GOTCHAS.md`
- `docs/OBSERVABILITY.md`
- `docs/specs/chat-service.md`
- `docs/specs/client-messenger.md`
- `docs/specs/gateway-service.md`
- `libs/backend/chat/src/services/chat.service.ts`
- `libs/backend/chat/src/controllers/chat.controller.ts`
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- `apps/backend/gateway/src/controllers/chat.controller.ts`
- `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- `libs/common/src/schemas/chat/*`
- `libs/client/entities/chat/src/*`
- `libs/client/entities/message/src/*`
- `libs/client/features/send-message/src/*`
- `libs/client/features/chat-socket/src/*`
- `libs/client/pages/messenger/pages-chat-page/src/lib/*`
- `apps/client/messenger/src/app/socket/*`
- `apps/client/messenger/e2e/chat-scroll-layout.spec.ts`

## Текущая Архитектура

### Backend

Фактический поток:

1. Клиент обращается только к Gateway.
2. Gateway HTTP controller принимает `/api/chats/*`, валидирует auth через `JwtGuard` и `ActiveAccountGuard`.
3. Gateway отправляет команды в chat-service через RabbitMQ `ClientProxy`.
4. `libs/backend/chat` содержит бизнес-логику, Prisma repository и RPC controller.
5. После успешной отправки сообщения Gateway рассылает `message:new` через Socket.IO и триггерит push для offline-получателей.

Фактические backend-функции:

- Создание/получение direct-чата.
- Получение списка чатов с профилями участников через дополнительный запрос в user-service.
- Получение сообщений с cursor-пагинацией.
- Отправка текстовых и файловых сообщений.
- Получение media/link сообщений по фильтрам.
- Forward сообщений.
- Проверка членства в чате для Socket.IO join.
- Получение участников для push-уведомлений.

Не реализовано в backend chat как полноценный контракт:

- Редактирование сообщений.
- Удаление for all / for me.
- Серверный unread/read-state через `lastReadMessageId` / read marker. Это не future-only: unread переводится в backend-контракт.
- Поиск сообщений в чате.
- Link preview lifecycle на уровне chat.
- Групповые чаты, роли и системные сообщения.
- Calls/WebRTC signaling.

### Frontend

Фактический поток:

1. Chat list грузится через TanStack Query `['chats']`.
2. Message history грузится через `useSuspenseInfiniteQuery(['messages', chatId])`.
3. Активный чат подключается к Socket.IO через `useChatSocket(chatId)` и события `chat:join` / `chat:leave`.
4. Отправка из composer идет преимущественно через Socket.IO `message:send`.
5. `message:new` обновляет кеш сообщений и `lastMessage` в списке чатов.
6. Unread сейчас хранится локально в Zustand `localStorage`, а не на backend. Это считается временным расхождением: целевой контракт переносит unread/read-state на сервер.
7. Presence хранится transient в Zustand на основе `user:online` / `user:offline`.

Фактические frontend-функции:

- Chat list с адаптером имени, preview, unread и online.
- Окно чата с виртуализированным списком.
- Отправка текста Enter/кнопкой.
- Upload файлов, voice recorder, circle recorder.
- Emoji picker.
- Визуализация разных типов file messages.
- E2E-проверки layout/scroll для разных типов сообщений.

Не реализовано или не является завершенным контрактом:

- Retry UI для неотправленных сообщений.
- Серверно-согласованный unread после перезагрузки/между устройствами.
- Inline edit/delete.
- Message search.
- Typing indicator в видимой chat UI-части требует отдельной проверки.
- Полный media gallery как отдельный user flow.
- Полный Playwright flow отправки текста/файла через socket.

## Расхождения Со Старыми Спеками

### Спеки слишком широкие

`docs/specs/chat-service.md` и `docs/specs/client-messenger.md` описывают Level 2/3/Calls/Groups как acceptance criteria рядом с MVP. Для текущего состояния их нужно переписать:

- MVP: direct chats, explicit self-chat action, list, messages, files, socket delivery, basic presence, server-side unread/read markers, push for offline recipients.
- Next: edit/delete, message search, richer media gallery, retry/failed states.
- Future: groups, calls, E2E encryption.

### Unread

Старая спека требует `lastReadMessageId` у участника чата и серверный unread. В реализации unread локальный:

- `libs/client/entities/chat/src/chat.store.ts` хранит `unreadByChatId` в localStorage.
- Backend schema/service не предоставляет mark-read endpoint.
- После другого устройства/браузера состояние не синхронизируется.

Вывод: local unread больше не считается достаточным MVP. Нужно перенести unread в backend:

- добавить read marker в chat member model, например `lastReadMessageId` или `lastReadAt`;
- добавить endpoint/RPC для mark-read при открытии активного чата;
- рассчитывать unread count на backend для `GET /chats`;
- обновлять unread через Socket.IO при входящих сообщениях;
- оставить frontend Zustand только как UI-cache, а не источник истины.

### File Category

Frontend отправляет `fileCategory` через socket. Gateway HTTP controller при `POST /chats/:id/messages` не проксирует `fileCategory` в chat-service, хотя DTO и service его поддерживают.

Риск: HTTP path сохраняет файловое сообщение без категории, из-за чего preview/media filters могут работать неверно.

### Логирование

Требование проекта: frontend использует `useLogger`, backend использует Nest logger/общий logger; dev логирует подробно, prod/demo не засоряет browser console и не раскрывает данные.

Фактически:

- `useLogger` существует и в production возвращает no-op.
- Frontend error endpoint существует: `POST /api/observability/frontend-errors`.
- В chat frontend почти нет `useLogger`.
- Есть прямые `console.error` в `ErrorBoundary`, `main.tsx`, `env.ts`.
- Gateway Socket.IO логирует часть событий структурно.
- Gateway Chat HTTP controller не имеет собственного logger.
- `libs/backend/chat` service/controller/repository почти не логируют бизнес-операции, кроме Prisma lifecycle.

Вывод: логирование chat нужно сделать отдельным стандартом и покрыть тестами на отсутствие PII/secrets в prod-логах.

### Swagger

Gateway chat controller имеет базовые Swagger decorators, но документация не отражает полностью:

- payload для file messages, включая `fileCategory`;
- forward request/response;
- media message filters и validation errors;
- реальные коды ошибок Gateway mapping;
- socket events не документируются в Swagger и должны быть описаны отдельно в specs/development docs.

Swagger обновлять после тестов и фиксов, чтобы он соответствовал фактическому контракту.

## Найденные Баги И Риски

### B1. HTTP sendMessage теряет `fileCategory`

Файл: `apps/backend/gateway/src/controllers/chat.controller.ts`

Метод `sendMessage()` передает в chat-service `fileId/fileBucket/fileKey/fileName/fileSize/fileMime`, но не передает `fileCategory`.

Ожидаемое поведение: HTTP и Socket.IO пути должны сохранять одинаковую структуру message attachment.

Тест:

- Gateway integration Jest: `POST /api/chats/:id/messages` с file payload должен отправить в `CHAT_PATTERNS.SEND_MESSAGE` поле `fileCategory`.

### B2. Нет backend unit/integration тестов для `@org/chat`

Файлы `libs/backend/chat/src/**/*.spec.ts` отсутствуют.

Риск: membership guards, direct-chat idempotency, pagination, forward и media filters не закреплены тестами.

Тесты:

- `chat.service.unit.spec.ts`
- `chat.controller.unit.spec.ts`
- `chat.prisma.repo.integration.spec.ts` или repository unit с Prisma mock, если реальная БД не поднимается в CI.

### B3. `getChats()` создает self-direct чат как side effect

Файл: `libs/backend/chat/src/services/chat.service.ts`

`getChats(userId)` всегда вызывает `createDirectChat(userId, userId)`.

Решение по контракту: убрать side effect из `getChats()`. "Личное" должно создаваться конкретным автоматическим действием, а не как костыль внутри чтения списка.

Целевое поведение:

- `GET /chats` только читает список и не создает записи;
- self-chat создается отдельным явным действием, например `POST /chats/self` или отдельным bootstrap/use-case при первом входе после регистрации;
- действие должно быть idempotent: повторный вызов возвращает существующий self-chat;
- новая спека должна назвать это действие и момент запуска.

Тест:

- Unit: `getChats()` не вызывает `createDirectChat()` и не пишет в repository.
- Unit/integration: explicit self-chat action создает один self-chat и повторно возвращает существующий.
- Gateway integration: explicit endpoint/action не создает дубликаты.

### B4. Cursor pagination требует контракта порядка

Файл: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`

Repository выбирает `createdAt desc`, затем `reverse()`, возвращая страницу в ascending порядке. `nextCursor` берется из `messages[0].id` до reverse, то есть из самого старого элемента выбранной страницы.

Это может быть корректно для "подгрузить старые сообщения вверх", но контракт должен быть зафиксирован тестом.

Тест:

- Для сообщений 1..60 первый запрос `take=50` возвращает 11..60 ascending и `nextCursor=11`.
- Следующий запрос cursor=11 возвращает 1..10 ascending и `nextCursor=null`.

### B5. Frontend upload cancel очищает UI, но не гарантирует очистку pending attachment ref

Файлы:

- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`
- `libs/client/features/send-message/src/use-send-message.ts`

Кнопка отмены pending file вызывает только `setPendingFile(null)`. Attachment ref живет внутри `useSendMessage`. Если ref уже установлен, UI может скрыть вложение, но следующая отправка может уйти с attachment.

Нужно подтвердить/исправить компонентным тестом. Если текущий flow устанавливает ref только после успешного upload и сразу отправляет через `requestAnimationFrame`, отмена может не сработать как пользовательское действие. Тогда UI отмены во время uploaded-but-not-sent состояния лишняя или должна вызывать `setFileAttachment(null)`.

### B6. Frontend logging не покрывает chat flow

Файлы:

- `libs/client/features/send-message/src/use-send-message.ts`
- `apps/client/messenger/src/app/socket/chat-socket-manager.ts`
- `libs/client/features/chat-socket/src/use-chat-socket.ts`
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`

Нужно добавить `useLogger`/logger-adapter на операции:

- join/leave chat;
- message send requested/succeeded/failed;
- file upload init/upload/confirm/send;
- socket message received;
- cache update skipped duplicate;
- unread increment/mark-read.

В prod/demo browser console должен оставаться чистым. Для ошибок в prod допустима отправка sanitized payload в существующий observability endpoint или отдельный frontend log endpoint, если он будет явно добавлен/подтвержден.

### B7. Прямые `console.error` нарушают стандарт чистой prod/demo console

Файлы:

- `libs/client/shared/src/ui/error-boundary/error-boundary.tsx`
- `apps/client/messenger/src/app/main.tsx`
- `apps/client/messenger/src/app/config/env.ts`

Суть проблемы: эти вызовы обходят `useLogger`, поэтому их сложнее централизованно выключить, отредактировать и протестировать. Требование проекта говорит, что dev может логировать подробно, а prod/demo browser console должен быть чистым. Прямой `console.error` в shared/app-коде может нарушить это требование при runtime ошибке, service worker failure или неверной env-конфигурации.

Почему это важно:

- browser console в prod/demo не должна показывать внутренние стеки, component stack, env diagnostics или технический шум;
- ошибки frontend уже должны уходить в observability endpoint sanitized payload'ом;
- прямой `console.error` сложнее покрыть единым тестом на "prod console clean";
- если в `console.error` попадет raw Error, браузер может раскрыть stack, route или данные из message.

Решение требует аккуратности:

- `ErrorBoundary` должен вызывать `reportFrontendError(error, componentStack)` всегда, а печатать в console только в dev через logger/dev gate;
- service worker registration failure в `main.tsx` должен логироваться через dev-gated logger или отправляться как sanitized frontend error/warn;
- env validation в `env.ts` может печатать подробности только в dev; в prod/demo лучше fail-fast без console dump или отправить sanitized событие;
- реализация `useLogger` может оставаться единственным местом, где допустим `console.*`.

Тесты:

- unit для `useLogger`: prod no-op, dev пишет на ожидаемый уровень;
- unit/component для `ErrorBoundary`: вызывает reporter, но не пишет в console при production mode;
- Playwright production smoke: открыть chat flow и проверить отсутствие unexpected console messages.

## Новая Тестовая Матрица

### Unit: backend Jest

Проект: `@org/chat`

Команда: `npm exec nx test @org/chat`

Тест-кейсы:

- `ChatService.createDirectChat` возвращает existing direct chat без создания нового.
- `ChatService.createDirectChat` создает DIRECT chat и добавляет двух участников.
- explicit self-chat use-case добавляет одного участника и имя `Личное`.
- `ChatService.getChats` не создает self-chat и не выполняет write side effects.
- server-side unread calculation возвращает unread count для каждого чата.
- mark-read use-case обновляет read marker только для участника чата.
- `ChatService.getMessages` возвращает `ForbiddenException`, если пользователь не участник.
- `ChatService.sendMessage` возвращает `ForbiddenException`, если отправитель не участник.
- `ChatService.sendMessage` прокидывает text/file fields в repository.
- `ChatService.forwardMessages` проверяет membership source и target.
- `ChatService.forwardMessages` игнорирует сообщения не из source chat или возвращает explicit error, после решения контракта.
- `ChatController` корректно маппит RPC payload на service calls.

### Integration: backend repository/Gateway Jest

Проекты: `@org/chat`, `@org/gateway`

Команды:

- `npm exec nx test @org/chat`
- `npm exec nx test @org/gateway`

Тест-кейсы:

- Repository pagination order/cursor.
- Repository media filters: ALL, IMAGE, VIDEO includes CIRCLE, AUDIO, FILE, LINK.
- Gateway `GET /api/chats` enriches members with profiles.
- Gateway `GET /api/chats/:id/messages` parses `take` and `cursor`.
- Gateway `GET /api/chats/:id/media/messages` validates query through Zod.
- Gateway `POST /api/chats/:id/messages` includes `fileCategory`.
- Gateway `POST /api/chats/:id/messages` broadcasts `message:new` after successful RPC.
- Gateway `POST /api/chats/:id/forward` broadcasts each created message.
- Gateway maps microservice `{ statusCode, message }` to HTTP exception.
- Swagger snapshot/spec test covers chat endpoints after fixes.

### Unit: frontend Jest

Проекты: `@org/messenger`, `@org/entities-chat`, `@org/entities-message`, `@org/features-send-message`, `@org/features-chat-socket`

Команды:

- `npm exec nx test @org/messenger`
- Если у library target отсутствует, добавить target или тестировать через app-level Jest только временно.

Тест-кейсы:

- `appendMessageToPages` does not duplicate message.
- `updateChatListLastMessage` updates and sorts chats.
- `useChatStore` treats unread as UI-cache and clears/reconciles it from server data.
- `useChatList` maps direct/self chat display names and previews.
- `getMessagePreview` covers text/image/video/circle/voice/audio/file/empty.
- `useSendMessage` emits `typing:start` once and debounced `typing:stop`.
- `useSendMessage` trims text and does not send empty messages.
- `useSendMessage` maps file category to message type.
- `useSendMessage` clears file attachment after sending.
- Frontend logger no-ops in prod and writes in dev only through logger implementation.

### Component: frontend Jest/Testing Library

Тест-кейсы:

- `ChatFooter` disables send while recording.
- `ChatFooter` Enter sends, Shift+Enter keeps newline behavior.
- `ChatFooter` upload failure clears pending UI and logs sanitized error.
- `ChatFooter` successful upload calls init, upload, confirm, then emits socket message with file metadata.
- `VirtualMessageList` renders empty state.
- `VirtualMessageList` renders text and file message rows with stable `data-message-id`.
- `SidebarContent` renders empty state, search results, and chat items.
- ErrorBoundary reports to frontend observability endpoint without raw query/hash.

### E2E: Playwright

Проект: `@org/messenger`

Команды:

- `npm exec nx e2e @org/messenger`
- Targeted: `npm exec nx run @org/messenger:e2e-ci--e2e/chat-scroll-layout.spec.ts`

Тест-кейсы:

- User opens `/chats` with mocked session and sees chat list.
- User opens `/chats/:id`; latest messages are visible and layout has no horizontal overflow.
- User sends text; socket or mocked API returns `message:new`; message appears and input clears.
- Incoming message for active chat appends without duplicate.
- Incoming message for inactive chat updates preview and unread badge.
- File message rows render image/audio/voice/video/circle/file without layout overflow.
- Mobile viewport: list and chat navigation do not overlap composer/header.
- Production build smoke: browser console has no unexpected logs for chat flow.

## Логирование: Новый Стандарт Для Chat

### Frontend

Правила:

- В компонентах/хуках chat использовать `useLogger(context)` или общий frontend logger-wrapper.
- Dev: `log/debug/verbose/warn/error` доступны для диагностики.
- Prod/demo: browser console чистая.
- Error/warn в prod отправляются только через sanitized reporter в backend endpoint. Нельзя отправлять raw token, cookie, full URL with query/hash, message text, file names без явного redaction.
- Запрещены прямые `console.*` вне реализации logger.

Минимальные события:

- `chat_join_requested`, `chat_leave_requested`
- `message_send_requested`, `message_send_ack`, `message_send_failed`
- `message_received`, `message_duplicate_skipped`
- `file_upload_started`, `file_upload_confirmed`, `file_upload_failed`
- `unread_incremented`, `chat_marked_read`

### Backend

Правила:

- Gateway и chat-service используют Nest `Logger`/общий logger.
- Структурные payloads вместо строк с raw ids.
- В dev допустимы debug/verbose с флагами `hasUserId`, `hasChatId`, counts, durations.
- В prod/demo не логировать raw message text, tokens, cookies, raw user ids, raw chat ids, file names, presigned URLs.

Минимальные события:

- `chat_create_direct_requested/completed`
- `chat_create_self_requested/completed`
- `chat_list_requested/completed`
- `messages_page_requested/completed`
- `message_send_requested/completed/failed`
- `message_forward_requested/completed/failed`
- `chat_membership_denied`
- `socket_join_requested/completed/denied`
- `push_offline_recipients_start/complete/failed`

## Документация К Обновлению

### `docs/DEVELOPMENT.md`

Добавить разделы:

- frontend logging standard: `useLogger`, no direct `console.*`, dev/prod behavior;
- backend logging standard: structured logger, levels, redaction;
- Swagger standard: endpoint decorators and DTO docs обновляются вместе с feature/test;
- testing standard for chat: unit/component/integration/e2e definitions and Nx commands.

### `docs/OBSERVABILITY.md`

Уточнить:

- какие frontend события идут в `/api/observability/frontend-errors`;
- будет ли отдельный endpoint для non-error frontend logs или errors-only остается единственным контрактом;
- redaction policy для chat message/file/user data.

### `docs/specs/chat-service.md`

Переписать:

- убрать будущие Level 2/3 из MVP acceptance criteria;
- явно описать текущий direct/self chat behavior;
- описать HTTP и Socket.IO message contracts;
- зафиксировать cursor pagination order;
- описать server-side unread/read markers как обязательный MVP-контракт.
- описать explicit self-chat action и запрет write side effects в `GET /chats`.

### `docs/specs/client-messenger.md`

Переписать:

- привести статус реализации к фактическому;
- описать socket-driven send flow;
- описать server-side unread flow и роль frontend Zustand как UI-cache;
- добавить logging и clean console как acceptance criteria;
- отделить будущие edit/delete/search/groups/calls.

### Swagger

Обновлять после тестов и багфиксов:

- `POST /chats/:id/messages` с text/file examples и `fileCategory`;
- `GET /chats/:id/media/messages` filter enum;
- `POST /chats/:id/forward`;
- error responses 400/401/403/500;
- DTO decorators для generated schemas, где не хватает примеров.

## Рекомендуемый Порядок Работ

1. Зафиксировать новый MVP spec для chat на основе этого аудита.
2. Написать failing tests для B1-B4, server-side unread и explicit self-chat action.
3. Исправить B1, убрать side effect из `getChats()` и подтвердить pagination/direct-chat contracts.
4. Реализовать backend unread/read marker и mark-read flow.
5. Добавить backend chat unit/integration coverage.
6. Добавить frontend unit/component coverage для send/socket/cache/unread.
7. Внедрить chat logging frontend/backend и заменить прямые `console.*`.
8. Добавить Playwright E2E для отправки текста, incoming message, server unread и production clean console.
9. Обновить Swagger.
10. Обновить `docs/DEVELOPMENT.md`, `docs/OBSERVABILITY.md` и переписать chat/client specs.

## Nx Команды Для Проверки

```bash
npm exec nx test @org/chat
npm exec nx test @org/gateway
npm exec nx test @org/messenger
npm exec nx e2e @org/messenger
npm exec nx lint @org/chat
npm exec nx lint @org/gateway
npm exec nx lint @org/messenger
npm exec nx typecheck @org/chat
npm exec nx typecheck @org/gateway
npm exec nx typecheck @org/messenger
```
