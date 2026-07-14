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

## Backend Chat Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

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
