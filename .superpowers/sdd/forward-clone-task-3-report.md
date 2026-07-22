# Forward Clone Task 3 Report

## Summary

Added media-reference persistence and RPCs for message attachments. Physical media deletion now checks the reference count and skips object/metadata deletion while references remain.

## Changed Files

- `libs/backend/media/src/database/prisma/schema.prisma`
- `libs/backend/media/src/database/prisma/migrations/20260722000000_add_media_references/migration.sql`
- `libs/backend/media/src/interfaces/media.interface.ts`
- `libs/backend/media/src/database/repository/media.prisma.repo.ts`
- `libs/backend/media/src/services/media.service.ts`
- `libs/backend/media/src/controllers/media.controller.ts`
- `libs/backend/core/src/constants/queues/media.queue.ts`
- `libs/backend/media/src/services/media.service.spec.ts`

## RED Output Summary

The required command was run:

`env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/media --runTestsByPath src/services/media.service.spec.ts --runInBand --skip-nx-cache`

It could not start tests because the existing `@org/media` project has no `test` target: `Cannot find configuration for task @org/media:test`.

Using an isolated Jest fallback configuration for the new spec produced the intended RED result: 4 failing tests before implementation, including missing `createReference` and `deleteReference`, unprotected physical deletion, and absent lifecycle logging.

## Prisma Generate

The required command was run:

`env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/media:prisma-generate`

It failed because the existing target resolves `prisma.config.ts` from the workspace root instead of `libs/backend/media`.

Fallback command passed:

`npm exec prisma -- generate --config prisma.config.ts` from `libs/backend/media`

Prisma Client 7.6.0 generated successfully.

## GREEN Output Summary

The required Nx test command still cannot run because the existing project has no `test` target. The same isolated Jest fallback passed: 1 suite, 5 tests.

`env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/media --skip-nx-cache` passed.

`env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/media --skip-nx-cache` passed for `@org/common`, `@org/core`, and `@org/media`.

## Migration Path

`libs/backend/media/src/database/prisma/migrations/20260722000000_add_media_references/migration.sql`

The migration creates the `MediaReferenceOwnerType` enum, `media_references` table, unique owner constraint, file lookup index, and cascading foreign key to `File`.

## Logging Events Added

- `media_reference_create_requested`, `media_reference_create_started`, `media_reference_created`, `media_reference_create_failed`
- `media_reference_delete_requested`, `media_reference_delete_started`, `media_reference_deleted`, `media_reference_delete_skipped`, `media_reference_delete_failed`
- `media_file_delete_requested`, `media_file_delete_skipped`, `media_file_gc_started`, `media_file_gc_deleted`, `media_file_gc_failed`

All events use flags, owner types, counts, and safe reason codes without raw ids, file names, bucket/key values, or URLs.

## Commit Hash

`56fdcd1 feat(media): add media references`

## Risks / Notes

- No `media.references.count` RPC was added. `countReferences` is required internally by the media service for safe-delete decisions, but no existing caller or Task 3 test needs a public count RPC.
- The existing `@org/media` Nx configuration lacks a `test` target and has an incorrect working directory for `prisma-generate`; both required commands were executed and their failures are pre-existing configuration constraints outside this task's ownership boundaries.
- The count check protects the requested delete flow. Coordinating a concurrent reference creation with external object deletion would require a broader transactional/deletion-state design, outside Task 3 scope.
