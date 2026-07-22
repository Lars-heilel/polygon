# Task 5 Backend Report

## Summary

The chat send path now writes `MessageAttachment` rows through `createMessageWithRelations`. Legacy `file*` inputs are converted to one attachment while the inline legacy fields remain populated for the transition. After the message and attachments are created, Chat Service creates one Media Service reference per attachment.

When reference creation fails, Chat Service attempts to delete any references already created, deletes the new message and cascading attachment rows, records the compensated failure, and rethrows. The message is never returned or broadcast before references have been protected.

## Changed Files

- `libs/backend/chat/src/services/chat.service.ts`
- `libs/backend/chat/src/services/chat.service.spec.ts`
- `libs/backend/chat/src/interfaces/chat.interface.ts`
- `libs/backend/chat/src/controllers/chat.controller.ts`
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- `libs/backend/chat/src/lib/chat.module.ts`

No client files were changed. Gateway REST and socket send paths continue forwarding the legacy fields and do not duplicate conversion logic.

## RED / GREEN

- RED: the new legacy-file send test failed because `createMessageWithRelations` had zero calls.
- GREEN: focused Chat Service tests pass with 18 tests, including attachment creation, Media reference creation, compensation, and sanitized failure logging.

## Verification

- `env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache`
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/chat --skip-nx-cache`
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/chat.controller.spec.ts src/gateways/chat.socket-gateway.spec.ts --runInBand --skip-nx-cache`
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/gateway --skip-nx-cache`

## Logging Events

- `message_send_requested`
- `message_attachment_created`
- `media_reference_create_requested`
- `media_reference_create_started`
- `media_reference_created`
- `media_reference_create_failed`
- `media_reference_create_skipped`
- `media_reference_delete_skipped`
- `message_send_compensated`
- `message_send_compensation_failed`
- `message_send_failed`

All new log payloads use booleans and counts only; they omit identifiers, text, filenames, storage location, URLs, and secrets.

## Commit

Commit hash is recorded in the task completion response for `feat(chat): write message attachments on send`.

## Risks

- The DB write and Media reference RPC remain a distributed operation. Compensation is best-effort if Media Service is unavailable during reference deletion; this prevents exposure of the new message, but may leave an orphaned Media reference for later cleanup.
- HTTP validation continues to accept the existing legacy `file*` payload. Direct Chat Service RPCs can additionally carry normalized `attachments`; client normalizer/schema migration remains outside Task 5.
