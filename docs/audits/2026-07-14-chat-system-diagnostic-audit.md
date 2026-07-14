# Chat System Diagnostic Audit

## Summary

Status: in progress

## Classification Legend

- `implemented`: code and tests match the documented expectation.
- `implemented-no-test`: behavior appears implemented, but direct test coverage is missing or weak.
- `bug`: behavior contradicts the spec or likely breaks an implemented user flow.
- `missing-from-spec`: code contains behavior that is not documented clearly enough.
- `missing-from-code`: spec requires behavior that is absent from implementation.
- `intended-behavior`: current behavior differs from a first intuition, but is justified by architecture, security, or product constraints.
- `needs-decision`: the correct behavior is ambiguous and requires user/product confirmation.
- `needs-manual-validation`: behavior depends on real WebSocket/browser behavior, Docker services, file processing, media devices, push notifications, or visual inspection.

## Source Documents Reviewed

| Document | Reviewed | Notes |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | yes | Gateway-only HTTP entrypoint, database-per-service, RabbitMQ events, Socket.IO through gateway, Chat owns `polygon_chat`. |
| `docs/DEVELOPMENT.md` | yes | Nx target usage, strict TypeScript, Nest repository pattern, FSD package boundaries. |
| `docs/MONOREPO_GOTCHAS.md` | yes | Vite `/api` and `/socket.io` proxy, Tailwind source scanning, MSW layout, gateway Supertest with mocked microservice clients. |
| `docs/specs/chat-service.md` | yes | Direct chat, chat list, message pagination, send text/files, forward, and realtime are marked ready; edit/delete/search/unread/groups/calls are expected gaps. |
| `docs/specs/gateway-service.md` | yes | Cookie JWT, WebSocket cookie auth, rate limiting, error normalization, and instant revoke expectations. |
| `docs/specs/client-messenger.md` | yes | Chat list/window, optimistic send, socket lifecycle, mobile adaptation, empty states, and Level 2+ roadmap gaps. |
| `docs/specs/media-service.md` | yes | Chat file upload/history are ready; async processing, thumbnails, waveform, video previews, cleanup, and cascade delete are expected gaps. |
| `docs/specs/search-service.md` | yes | User search is ready; avatarUrl in search, message indexing, message search, and message reindex are expected gaps. |

## Nx Project Targets Reviewed

| Project | Targets checked | Notes |
| --- | --- | --- |
| `@org/chat` | `typecheck`, `lint`, `test`, `prisma-generate` | Backend business library has direct Jest tests, lint, and typecheck; no build target. |
| `@org/chat-service` | `typecheck`, `lint`, `test`, `build`, `serve`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `prune-lockfile`, `copy-workspace-modules`, `prune` | App has test target with `passWithNoTests`, plus deployable build. |
| `@org/gateway` | `typecheck`, `lint`, `test`, `build`, `serve`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `prune-lockfile`, `copy-workspace-modules`, `prune` | Gateway has direct Jest/Supertest coverage and deployable build. |
| `@org/messenger` | `typecheck`, `build`, `serve`, `dev`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `lint`, `test`, `e2e`, `e2e-ci`, atomized e2e auth/session targets | App has Jest and Playwright targets, but current atomized e2e targets are auth/session oriented. |
| `@org/entities-chat` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for chat entity state/API/UI. |
| `@org/entities-message` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for message entity rendering/API. |
| `@org/features-create-chat` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for create-chat modal/search behavior. |
| `@org/features-send-message` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for send-message/attachment/recorder behavior. |
| `@org/features-chat-socket` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for client socket hook behavior. |
| `@org/features-chat-media` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for chat media panel/API behavior. |
| `@org/pages-chat-page` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for chat page layout/window behavior. |
| `@org/pages-chats-layout` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | No direct test target for chat list layout/mobile behavior. |
| `@org/common` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `test` | Shared Zod contracts have Jest, lint, typecheck, and build targets. |

## Spec-To-Code Matrix

| Area | Expected Behavior | Implementation Evidence | Existing Tests | Status | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Backend chat: repository boundary | Chat service owns chat/message/member persistence through `polygon_chat` and repository pattern. | `OrgChatModule` binds `CHAT_PRISMA_REPOSITORY_TOKEN` to `ChatPrismaRepository`; `ChatService` injects only the repository token; Prisma schema defines `Chat`, `ChatMember`, and `Message`. Evidence: `libs/backend/chat/src/lib/chat.module.ts:13-15`, `libs/backend/chat/src/services/chat.service.ts:13-14`, `libs/backend/chat/src/database/prisma/schema.prisma:33-79`. | `none found` under `libs/backend/chat` or `apps/backend/chat-service`. | implemented-no-test | Add backend unit tests around service/repository boundaries and database ownership assumptions. |
| Backend chat: direct chat creation | Direct chat should be idempotent for the same two users. | `ChatService.createDirectChat` checks `findDirectChatBetween` before creating a `DIRECT` chat and adding members; repository query requires both users and only those users. Evidence: `libs/backend/chat/src/services/chat.service.ts:16-32`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:28-39`. | `none found`. | implemented-no-test | Add service/repository tests for idempotency, self-chat, and concurrent duplicate prevention. |
| Backend chat: chat list preview | User chat list returns user's chats with last-message preview. | `getChats` ensures a self-chat exists, then `findChatsForUser` selects members and one newest message as `lastMessage`, ordered by `updatedAt`. Evidence: `libs/backend/chat/src/services/chat.service.ts:35-37`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:42-60`. | `none found`. | implemented-no-test | Test chat list ordering and preview updates after message creation. |
| Backend chat: message pagination | Message history uses cursor/limit and stable ordering. | Membership is checked before fetch; repository reads `createdAt desc`, applies cursor/skip, reverses page to ascending display order, and returns `nextCursor`. Evidence: `libs/backend/chat/src/services/chat.service.ts:40-49`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:114-130`. | `none found`. | implemented-no-test | Test cursor boundary, `take`, ordering, and non-member rejection. |
| Backend chat: send text/file message | Send validates chat membership and persists text/file metadata. | `sendMessage` rejects non-members and persists `type`, text, file fields, and `fileCategory`. Evidence: `libs/backend/chat/src/services/chat.service.ts:63-93`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:160-181`, `libs/backend/chat/src/database/prisma/schema.prisma:59-78`. | `none found`. | implemented-no-test | Add service tests for non-member rejection, empty/4000+ text via shared schema, file categories, and ordering. |
| Backend chat: forward messages | Forwarding should copy 1+ source messages into target chat for a member of both chats. | `forwardMessages` checks source and target membership, copies text/file fields, and sets `forwardedFromId`; missing source messages are silently skipped. Evidence: `libs/backend/chat/src/services/chat.service.ts:96-127`. | `none found`. | implemented-no-test | Add tests for membership, skipped missing messages, >50 limit via shared schema/gateway, and source-chat mismatch. |
| Backend chat: unread/read state | Spec says unread count is stored via `lastReadMessageId` on chat member. | `ChatMember` schema has `chatId`, `userId`, `role`, and `joinedAt`, but no `lastReadMessageId`; service/repository expose no read-marker mutation. Evidence: `libs/backend/chat/src/database/prisma/schema.prisma:47-57`, `libs/backend/chat/src/services/chat.service.ts:130-138`. | `none found`. | missing-from-code | Add read-marker model/API or update spec if unread is intentionally deferred. |
| Backend chat: edit/delete/link-preview/groups/calls | Features marked `Надо` should be absent or partial without breaking Level 1 flows. | Chat schema has no `isDeleted`, edit timestamp, link-preview metadata, group membership operations, system messages, or call signaling persistence; current service exposes direct/chat list/messages/media/send/forward/membership only. Evidence: `libs/backend/chat/src/database/prisma/schema.prisma:33-79`, `libs/backend/chat/src/controllers/chat.controller.ts:17-108`. | `none found`. | intended-behavior | Keep as roadmap unless UI/API advertises these actions as complete. |
| Backend chat: message-created event | Search spec expects Chat Service to publish message indexing event after send. | `ChatService.sendMessage` only calls `repo.createMessage`; `rg` found `CHAT_PATTERNS` but no `CHAT_EVENTS`, `chat.message.created`, or client emit in `libs/backend/chat/src`. Evidence: `libs/backend/chat/src/services/chat.service.ts:81-93`, `libs/backend/core/src/constants/queues/chat.queue.ts:4-12`. | `none found`. | missing-from-code | Emit `chat.message.created` after successful create, and test Search indexing integration contract. |
| Backend chat: RPC payload validation | Microservice handlers should validate untrusted payloads before service code. | DTOs exist for create direct and send message, but `ChatController` uses raw `@Payload()` objects with no `ZodValidationPipe`; forward/get payloads also have no explicit validation. Evidence: `libs/backend/chat/src/dto/create-direct-chat.dto.ts:1-4`, `libs/backend/chat/src/dto/send-message.dto.ts:1-4`, `libs/backend/chat/src/controllers/chat.controller.ts:17-108`. | `none found`. | missing-from-code | Parse all chat RPC payloads through shared Zod schemas or DTO pipes at controller boundary. |
| Gateway HTTP: chat endpoints | Client chat HTTP requests go through gateway, use cookie identity, and map to Chat RPC patterns. | `ChatGatewayController` exposes `POST /chats/direct`, `GET /chats`, `GET /chats/:id/messages`, `GET /chats/:id/media/messages`, `POST /chats/:id/messages`, and `POST /chats/:id/forward`; class guards use `JwtGuard` and `ActiveAccountGuard`; user ID comes from `CurrentUser`. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:39-198`. | No `chat.controller.spec.ts`; `rg --files apps/backend/gateway/src | rg '(spec|test)'` lists no chat controller spec. | implemented-no-test | Add Supertest specs for every chat HTTP route with mocked Chat/User clients. |
| Gateway HTTP: chat validation | Body DTO validation exists for create/send through global Zod pipe, but params and some query/body paths are weak. | Global `ZodValidationPipe` is registered; create/send use Zod DTO classes; media query uses `chatMediaQuerySchema`; `GET :id/messages` parses `take` manually and does not validate `chatId`/cursor; forward body is a TypeScript type only. Evidence: `apps/backend/gateway/src/main.ts:39-41`, `apps/backend/gateway/src/controllers/chat.controller.ts:54-58`, `apps/backend/gateway/src/controllers/chat.controller.ts:103-115`, `apps/backend/gateway/src/controllers/chat.controller.ts:125-138`, `apps/backend/gateway/src/controllers/chat.controller.ts:179-190`. | No chat HTTP spec. | missing-from-code | Add Zod DTOs/schemas for `chatId`, message query, and forward body; test invalid UUIDs and invalid `take`. |
| Gateway HTTP: send file category | File-category metadata must reach Chat service so media filters and galleries can classify messages. | `sendMessageSchema` includes `fileCategory`, backend persists it, but gateway `sendMessage` omits `fileCategory` from `CHAT_PATTERNS.SEND_MESSAGE` payload. Evidence: `libs/common/src/schemas/chat/send-message.schema.ts:4-20`, `apps/backend/gateway/src/controllers/chat.controller.ts:154-166`, `libs/backend/chat/src/services/chat.service.ts:81-93`. | No chat HTTP spec. | bug | Pass `dto.fileCategory ?? null` to Chat RPC and add regression test for file message payload. |
| Gateway HTTP: realtime fanout after HTTP send | HTTP send/forward should broadcast created messages to active socket clients. | After Chat RPC success, `sendMessage` calls `broadcastMessage` and `triggerPushForOfflineRecipients`; forward broadcasts each created message. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:154-170`, `apps/backend/gateway/src/controllers/chat.controller.ts:184-195`. | No chat HTTP spec; socket gateway has separate tests. | implemented-no-test | Add controller tests that assert broadcast/push calls after successful send and no broadcast on RPC failure. |
| Gateway HTTP: media upload relation | Chat uploads and file reads check chat membership before exposing chat-scoped media. | `initUpload`, `getFileUrl`, `getFileContent`, `delete`, and chat media history call `CHAT_PATTERNS.CHECK_MEMBERSHIP` for chat-scoped files/routes. Evidence: `apps/backend/gateway/src/controllers/media.controller.ts:51-78`, `apps/backend/gateway/src/controllers/media.controller.ts:132-155`, `apps/backend/gateway/src/controllers/media.controller.ts:197-218`, `apps/backend/gateway/src/controllers/media.controller.ts:263-294`, `apps/backend/gateway/src/controllers/media.controller.ts:338-365`. | `media.controller.spec.ts` only covers YouTube link-preview fallback; no membership/upload route tests. | implemented-no-test | Add media gateway specs for chat membership, forbidden access, invalid pagination, and upload init payload. |
| Gateway HTTP: search relation | Gateway exposes user search/reindex only; message search is absent as expected from search spec status. | `SearchGatewayController` exposes `GET /search/users` and `POST /search/reindex`; no message search route or message reindex route exists. Evidence: `apps/backend/gateway/src/controllers/search.controller.ts:27-43`; Search spec marks message indexing/search/reindex as `Надо`. | No search controller spec. | intended-behavior | Track message search as roadmap; add controller spec for user search query validation. |
| Gateway HTTP: error mapping | Chat/media/search controller helper maps RPC errors into `HttpException`; global filters normalize responses at runtime. | Controller private `send` catches `{ statusCode, message }`; gateway `main.ts` registers `GatewayHttpExceptionFilter` and `ZodValidationExceptionFilter`. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:200-206`, `apps/backend/gateway/src/controllers/search.controller.ts:46-52`, `apps/backend/gateway/src/main.ts:39-41`. | Auth HTTP specs cover filters; no chat-specific error mapping specs. | implemented-no-test | Add chat route error mapping tests for 403, 404, validation errors, and unsafe 5xx messages. |

## Backend Chat Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Chat HTTP routes use authenticated cookie identity. | Class-level `@UseGuards(JwtGuard, ActiveAccountGuard)` and `@CurrentUser()` drive `userId`/`senderId`; clients cannot supply sender ID in body. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:39-58`, `apps/backend/gateway/src/controllers/chat.controller.ts:149-166`. | implemented-no-test | Cover with Supertest to ensure RPC payload uses JWT `sub`, not body user fields. |
| Chat route param/query validation is incomplete. | `GET /chats/:id/messages` accepts raw `chatId`, raw `cursor`, and `parseInt(take, 10)`; invalid values can reach Chat RPC. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:103-115`. | missing-from-code | Add Zod validation for UUID params and numeric query bounds. |
| Forward messages route is not runtime validated. | `@Body() dto: ForwardMessageInput` is only a TypeScript type; no DTO class or explicit `forwardMessageSchema.parse` is applied. Evidence: `apps/backend/gateway/src/controllers/chat.controller.ts:179-190`, `libs/common/src/schemas/chat/forward-message.schema.ts:3-6`. | missing-from-code | Use `forwardMessageSchema`/DTO and test empty arrays, >50 IDs, and invalid UUIDs. |
| File messages lose `fileCategory` at gateway boundary. | Shared schema has `fileCategory`; gateway omits it in the Chat RPC payload; backend has storage for it. Evidence: `libs/common/src/schemas/chat/send-message.schema.ts:4-20`, `apps/backend/gateway/src/controllers/chat.controller.ts:154-166`, `libs/backend/chat/src/database/prisma/schema.prisma:65-72`. | bug | Pass `fileCategory` through and add regression coverage. |
| Media chat history route uses a literal pattern instead of `MEDIA_PATTERNS.GET_CHAT_HISTORY`. | Constant exists, but controller calls `this.mediaClient.send('media.getChatHistory', ...)`. Evidence: `apps/backend/gateway/src/controllers/media.controller.ts:357-365`, `libs/backend/core/src/constants/queues/media.queue.ts:11-13`. | implemented-no-test | Prefer the shared constant to reduce drift; add route spec. |
| Search gateway does not expose message search. | Search controller only has `search/users` and `reindex`; message search is marked `Надо` in `docs/specs/search-service.md`. Evidence: `apps/backend/gateway/src/controllers/search.controller.ts:27-43`. | intended-behavior | Keep as roadmap item unless message search UI is enabled. |
| Gateway chat/search controller test coverage is absent. | Spec inventory contains auth/user/media/notification/admin/frontend-error/socket specs, but no chat or search controller spec. Evidence: `rg --files apps/backend/gateway/src | rg '(spec|test)'`. | implemented-no-test | Add `chat.controller.spec.ts` and `search.controller.spec.ts`. |
| Repository pattern is followed, but untested. | Service injects `CHAT_PRISMA_REPOSITORY_TOKEN` rather than Prisma; repository owns Prisma calls. Evidence: `libs/backend/chat/src/services/chat.service.ts:13-14`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:17-19`. | implemented-no-test | Add focused Jest specs for `ChatService` with mocked repository and `ChatPrismaRepository` behavior. |
| Direct chat creation is not transactional. | `createDirectChat` creates the chat, then adds member A, then member B in separate awaited calls. Evidence: `libs/backend/chat/src/services/chat.service.ts:20-27`. | implemented-no-test | Add concurrency/failure tests; consider repository-level transaction if partial chat creation is observed. |
| Chat list preview exists but unread count cannot be derived from persisted read state. | `findChatsForUser` returns `lastMessage`, but `ChatMember` lacks `lastReadMessageId`. Evidence: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:42-60`, `libs/backend/chat/src/database/prisma/schema.prisma:47-57`. | missing-from-code | Add `lastReadMessageId` and mark-read flow or revise unread requirements. |
| Message pagination is implemented, but cursor semantics are untested. | Repository fetches descending messages, reverses for response, and sets `nextCursor` to the oldest fetched item. Evidence: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:114-130`. | implemented-no-test | Test cursor paging around equal timestamps and page boundaries. |
| Send-message accepts raw `type` cast from payload. | `input.type` is cast to `Message['type']`; controller does not apply DTO validation. Evidence: `libs/backend/chat/src/services/chat.service.ts:81-85`, `libs/backend/chat/src/controllers/chat.controller.ts:65-93`. | missing-from-code | Validate `type`, text length, and file fields with `sendMessageSchema` before persistence. |
| Message-created indexing event is absent. | No event emission appears in `ChatService` or chat constants; Search spec requires async message indexing. Evidence: `libs/backend/chat/src/services/chat.service.ts:81-93`, `libs/backend/core/src/constants/queues/chat.queue.ts:4-12`. | missing-from-code | Define/emit message-created event and add Search consumer contract tests. |
| Backend chat and chat-service currently have no checked-in specs. | `rg --files libs/backend/chat apps/backend/chat-service | rg '(spec|test)'` returned exit `1`. | implemented-no-test | Add backend service/repository/controller tests before fixing behavior. |

## Gateway HTTP Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Gateway WebSocket Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Frontend Chat UX Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Media And Attachment Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Search And Indexing Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Visual Review

| Viewport | Route Or Component | Observation | Status | Follow-up |
| --- | --- | --- | --- | --- |

## Automated Verification Results

| Command | Result | Evidence |
| --- | --- | --- |
| `sed -n '1,260p' docs/ARCHITECTURE.md` | pass | Exit `0`; reviewed gateway-only routing, database-per-service, RabbitMQ events, Chat service role, Search message indexing expectation, Socket.IO lifecycle, and FSD slice layout. |
| `sed -n '1,280p' docs/DEVELOPMENT.md` | pass | Exit `0`; reviewed Nx command conventions, strict TypeScript, repository pattern, and module boundaries. |
| `sed -n '1,260p' docs/MONOREPO_GOTCHAS.md` | pass | Exit `0`; reviewed Vite proxy for `/socket.io` and Gateway Supertest strategy. |
| `sed -n '1,700p' docs/specs/chat-service.md` | pass | Exit `0`; reviewed TC-1.1 through TC-3.1 and chat implementation status table. |
| `sed -n '1,260p' docs/specs/gateway-service.md` | pass | Exit `0`; reviewed gateway HTTP/WebSocket/cookie/rate-limit/error expectations. |
| `sed -n '1,320p' docs/specs/client-messenger.md` | pass | Exit `0`; reviewed client chat, realtime, mobile, empty-state, and roadmap expectations. |
| `sed -n '1,320p' docs/specs/media-service.md` | pass | Exit `0`; reviewed chat upload, file categories, and media processing expectations. |
| `sed -n '1,320p' docs/specs/search-service.md` | pass | Exit `0`; reviewed user and message search/indexing expectations. |
| `npm exec nx show project @org/chat --json` | pass | Exit `0`; targets: `typecheck`, `lint`, `test`, `prisma-generate`. |
| `npm exec nx show project @org/chat-service --json` | pass | Exit `0`; targets include `typecheck`, `lint`, `test`, `build`, `serve`, and packaging targets. |
| `npm exec nx show project @org/gateway --json` | pass | Exit `0`; targets include `typecheck`, `lint`, `test`, `build`, `serve`, and packaging targets. |
| `npm exec nx show project @org/messenger --json` | pass | Exit `0`; targets include `test`, `e2e`, `typecheck`, `lint`, `build`, and auth/session atomized e2e targets. |
| `npm exec nx show project @org/entities-chat --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/entities-message --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/features-create-chat --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/features-send-message --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/features-chat-socket --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/features-chat-media --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/pages-chat-page --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/pages-chats-layout --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/common --json` | pass | Exit `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `test`. |
| `rg -n "create\|direct\|message\|send\|forward\|member\|read\|unread\|lastRead\|file\|attachment\|media\|event\|emit\|search\|deleted\|edited\|transaction\|Prisma\|ZodValidation" libs/backend/chat/src apps/backend/chat-service/src` | pass | Exit `0`; captured backend chat service, controller, repository, schema, DTO, and Prisma references. |
| `sed -n '1,260p' libs/backend/chat/src/controllers/chat.controller.ts` | pass | Exit `0`; captured raw `@Payload()` RPC handlers for create, list, messages, media messages, send, forward, membership, and members. |
| `sed -n '1,460p' libs/backend/chat/src/services/chat.service.ts` | pass | Exit `0`; captured direct chat creation, membership checks, message send, forward, and membership helpers. |
| `sed -n '1,560p' libs/backend/chat/src/database/repository/chat.prisma.repo.ts` | pass | Exit `0`; captured direct-chat lookup, chat-list preview, cursor pagination, media filtering, message create, and file metadata persistence. |
| `sed -n '1,260p' libs/backend/chat/src/database/prisma/schema.prisma` | pass | Exit `0`; captured `Chat`, `ChatMember`, and `Message` models, including absence of read-marker/delete/edit fields. |
| `sed -n '1,240p' libs/backend/chat/src/interfaces/chat.interface.ts` | pass | Exit `0`; captured chat service/repository interfaces and forward message data shape. |
| `sed -n '1,120p' libs/backend/chat/src/dto/create-direct-chat.dto.ts` | pass | Exit `0`; DTO extends `createDirectChatSchema`. |
| `sed -n '1,120p' libs/backend/chat/src/dto/send-message.dto.ts` | pass | Exit `0`; DTO extends `sendMessageSchema`. |
| `sed -n '1,140p' libs/backend/chat/src/lib/chat.module.ts` | pass | Exit `0`; captured repository and service DI bindings. |
| `sed -n '1,180p' apps/backend/chat-service/src/app/chat.module.ts` | pass | Exit `0`; captured observability and `OrgChatModule` wiring. |
| `sed -n '1,160p' apps/backend/chat-service/src/main.ts` | pass | Exit `0`; captured RMQ setup on `CHAT_QUEUE` and metrics port listener. |
| `rg --files libs/backend/chat apps/backend/chat-service | rg '(spec\|test)\\.(ts\|tsx)$|\\.spec\\.ts$|\\.test\\.ts$'` | fail | Exit `1`; no checked-in backend chat or chat-service spec files were found. |
| `rg -n "MESSAGE\|message\|CHAT_PATTERNS\|CHAT_EVENTS\|chat.message" libs/backend/core/src/constants libs/backend/chat/src libs/backend/search/src` | pass | Exit `0`; found chat RPC patterns but no chat message-created event emission in chat service. |
| `rg -n "Controller\\('chat\|Controller\\('chats\|Post\\(\|Get\\(\|Delete\\(\|Patch\\(\|UseGuards\|ZodValidationPipe\|CHAT\|MEDIA\|SEARCH\|send\\(\|emit\\(\|catchError\|ApiOperation\|ApiResponse\|ApiCookieAuth" apps/backend/gateway/src` | pass | Exit `0`; captured chat, media, search, socket, and test references; output was large and truncated by shell capture. |
| `sed -n '1,360p' apps/backend/gateway/src/controllers/chat.controller.ts` | pass | Exit `0`; captured all chat HTTP routes, Chat RPC payloads, socket broadcast calls, and private RPC error mapper. |
| `sed -n '1,360p' apps/backend/gateway/src/controllers/media.controller.ts` | pass | Exit `0`; captured chat membership checks for upload, file URL/content, delete, and chat media history. |
| `sed -n '361,460p' apps/backend/gateway/src/controllers/media.controller.ts` | pass | Exit `0`; captured remaining media helper code and private RPC error mapper. |
| `sed -n '1,260p' apps/backend/gateway/src/controllers/search.controller.ts` | pass | Exit `0`; captured user search and user reindex routes only. |
| `sed -n '1,180p' apps/backend/gateway/src/app/gateway.module.ts` | pass | Exit `0`; captured registration of ChatGatewayController, MediaGatewayController, SearchGatewayController, ChatSocketGateway, and RMQ clients. |
| `rg --files apps/backend/gateway/src/controllers | rg 'chat\|media\|search\|spec'` | pass | Exit `0`; found chat/media/search controllers and controller specs, but no `chat.controller.spec.ts` or `search.controller.spec.ts`. |
| `rg --files apps/backend/gateway/src | rg '(spec\|test)\\.(ts\|tsx)$'` | pass | Exit `0`; listed gateway specs, including socket and media, but no chat/search HTTP controller specs. |
| `sed -n '1,260p' apps/backend/gateway/src/controllers/media.controller.spec.ts` | pass | Exit `0`; only link-preview YouTube fallback is covered. |
| `sed` reads for `send-message.schema.ts`, `forward-message.schema.ts`, and `chat-media.schema.ts` | pass | Exit `0`; captured `fileCategory`, text/file refine, forward ID constraints, and chat-media query bounds. |
| `rg -n "GET_CHAT_HISTORY\|media.getChatHistory\|GET_HISTORY\|INIT_UPLOAD\|CONFIRM_UPLOAD" libs/backend/core/src/constants libs/backend/media/src apps/backend/gateway/src/controllers/media.controller.ts` | pass | Exit `0`; confirmed `MEDIA_PATTERNS.GET_CHAT_HISTORY` exists while gateway uses literal `media.getChatHistory`. |

## Manual Validation Points

| Flow | Why Manual | Required Setup | Status |
| --- | --- | --- | --- |

## Decisions Needed

| Decision | Context | Options | Recommendation |
| --- | --- | --- | --- |

## Prioritized Follow-Up Work

| Priority | Work Item | Reason | Suggested Test Level |
| --- | --- | --- | --- |

## Recommended Test Additions

| Level | Project | Test Gap | Suggested Coverage |
| --- | --- | --- | --- |
