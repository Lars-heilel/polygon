# Forward Clone Task 3 Fix Report

## Findings Closed

1. **Race-safe media deletion and reference creation**
   - Added `FileStatus.DELETING` and migration `20260722010000_add_file_deleting_status`.
   - `createReference` now locks the `File` row in a Prisma transaction and only creates a reference for `READY` files.
   - `claimForDeletion` locks the same row, counts references while locked, returns `REFERENCED` when necessary, and otherwise marks the file `DELETING` before object and metadata deletion.
   - Storage-delete failure restores `READY`; metadata-delete failure leaves the file `DELETING` to prevent new references to a missing object.

2. **Reference count RPC**
   - Added `MEDIA_PATTERNS.COUNT_REFERENCES` (`media.references.count`), `IMediaService.countReferences`, and the controller handler.
   - Added lifecycle logging for requested, started, counted, and failed count operations.

3. **Nx verification targets**
   - Added the media Jest configuration and `test` target in `libs/backend/media/package.json`.
   - Updated `prisma-generate` to run from `libs/backend/media` so its Prisma config resolves correctly from the workspace root.

4. **Delete failure logging**
   - Wrapped the complete delete flow so claim, storage, metadata, and claim-release failures emit sanitized lifecycle failure events.
   - Added focused tests for claim and storage-delete failures.

5. **Honest idempotent reference deletion**
   - Extended `DeleteMediaReferenceInput` with optional `fileId`.
   - Repeated deletion returns the current count when `fileId` is supplied and `remainingCount: null` when it is not.

## Changed Files

- `libs/backend/media/src/database/prisma/schema.prisma`
- `libs/backend/media/src/database/prisma/migrations/20260722010000_add_file_deleting_status/migration.sql`
- `libs/common/src/schemas/media/file.schema.ts`
- `libs/backend/media/src/interfaces/media.interface.ts`
- `libs/backend/media/src/database/repository/media.prisma.repo.ts`
- `libs/backend/media/src/services/media.service.ts`
- `libs/backend/media/src/controllers/media.controller.ts`
- `libs/backend/core/src/constants/queues/media.queue.ts`
- `libs/backend/media/src/services/media.service.spec.ts`
- `libs/backend/media/package.json`

## Verification

- `env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/media:prisma-generate` - passed
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/media --runTestsByPath src/services/media.service.spec.ts --runInBand --skip-nx-cache` - passed (1 suite, 11 tests)
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/media --skip-nx-cache` - passed
- `env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/media --skip-nx-cache` - passed

## Commit

`63808db fix(media): harden media reference lifecycle`

## Remaining Risk

If object storage reports a failure after deleting the object, restoring `READY` can expose stale metadata. This is an unavoidable ambiguity without a storage deletion receipt or reconciliation worker; a metadata-delete failure instead remains `DELETING` to preserve reference safety.
