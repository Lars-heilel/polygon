# Permanent Private File Access — Media Service

**Date:** 2026-07-05
**Status:** Draft

## Problem

Current media file access relies on MinIO presigned GET URLs:
1. `confirmUpload` generates a 7-day presigned URL stored in `File.url`
2. `/api/media/files/:id/content` generates a 15-min presigned URL and issues HTTP 302
3. Files effectively "expire" every 7 days
4. No CDN available — all traffic already passes through Gateway

## Scope

- Chat-scoped files (IMAGE, VIDEO, AUDIO, VOICE, FILE, CIRCLE)
- **Avatars explicitly excluded** — remain public bucket with direct public URLs
- Upload flow **unchanged** — 2-phase initUpload (presigned PUT) → client uploads to MinIO → confirmUpload

## Solution: Gateway Streaming from MinIO

Replace presigned GET redirect with direct streaming from Gateway. Gateway already has `CoreStorageModule` and `IStorageProvider` injected.

```
Before:
  GET /media/files/:id/content → JWT → membership check → presigned GET URL (15 min) → 302 redirect

After:
  GET /media/files/:id/content → JWT → membership check → storage.getFileStream(bucket, key, range?) → stream (200/206)
```

### 1. Upload — confirmUpload

Remove presigned GET URL generation. `confirmUpload` only sets `status=READY` without generating any URL.

- `IMediaRepository.updateStatus(id, 'READY', url)` → `updateStatus(id, 'READY')` (url param removed)
- `File.url` stays nullable — only populated by legacy records and avatars
- `FileResponse.url` becomes `string | null` — null for new chat files, populated for avatars
- `fileResponseSchema.url` → `z.string().nullable()`
- `getHistory`/`getChatHistory` — `f.url!` becomes `f.url ?? null` (nullable mapping)

### 2. Serve — Gateway `/content`

`GET /api/media/files/:fileId/content` is rewritten:

1. JWT verify (existing `JwtGuard`)
2. Lookup file metadata via RMQ `media.getById` → get `bucket`, `key`, `mimeType`, `size`, `chatId`
3. If `chatId` present → RMQ `chat.checkMembership` (existing)
4. Parse `Range` header from request (for video seeking)
5. Call `storage.getFileStream(bucket, key, range?)` which streams from MinIO
6. Pipe stream to HTTP response with headers:
   - `Content-Type: <mimeType>`
   - `Content-Length` (full size for 200, partial for 206)
   - `Content-Range: bytes <start>-<end>/<total>` (for 206)
   - `Accept-Ranges: bytes`
   - `Cache-Control: private, max-age=31536000, immutable`
   - `ETag: "<fileId>-<updatedAt timestamp>"`

`GET /media/files/:fileId/url` — returns `{ url: "/api/media/files/<fileId>/content", expiresIn: null }`. No longer generates presigned URLs.

`IMediaService.getFileUrl()` RMQ handler — removed entirely. Gateway constructs the URL client-side; no RMQ call needed for this.

`MediaService.getById()` — currently returns `null` if `!file.url`. Changed to return file metadata even when `url` is null (gateway only needs `bucket`, `key`, `mimeType`, `size`, `chatId` for streaming).

### 3. IStorageProvider — Range Support

```typescript
interface FileStreamResult {
  stream: NodeJS.ReadableStream;
  size: number;       // full file size in bytes
  contentType: string;
}

interface Range {
  start: number;
  end: number;
}

interface IStorageProvider {
  getFileStream(
    bucket: string,
    key: string,
    range?: Range,
  ): Promise<FileStreamResult>;
}
```

MinIO JS client's `getObject(bucket, key, getOpts?)` accepts `getOpts` with `Range` header. Implementation passes `{ Range: \`bytes=${start}-${end}\` }` when range is provided.

### 4. Upload Limits — Video capped at 200 MB

In `upload-file.dto.ts`:

```typescript
VIDEO: 200 * 1024 * 1024,   // was 500 MB, now 200 MB
```

All other limits unchanged.

### 5. Database

No schema changes needed. `File.url` is already nullable.

- For new chat files: `url` stays `null`
- Legacy records with presigned URLs in `url` field: left as-is (harmless, unused)
- `getById` no longer requires `url` to be non-null for a valid response

### 6. Client

Zero changes. All media components already use:
```typescript
const url = \`/api/media/files/${message.fileId}/content\`;
```

Previously received HTTP 302 → now receives 200/206 with stream. Transparent to `<img>`, `<video>`, `<audio>`, `<a>` tags.

The `getChatFileUrl` function in `upload-chat-file.api.ts` is unused in rendering — left as-is (dead code, not in scope).

## Files Changed

### Interfaces & Providers

| File | Change |
|---|---|
| `libs/backend/core/src/storage/storage-provider.interface.ts` | Add `FileStreamResult`, `Range`, update `getFileStream` signature |
| `libs/backend/core/src/storage/minio-storage.provider.ts` | Implement range-aware `getFileStream` |

### Media Service (RMQ handlers)

| File | Change |
|---|---|
| `libs/backend/media/src/interfaces/media.interface.ts` | `IMediaRepository.updateStatus` — remove `url` param. `FileResponse.url` → `string\|null`. Remove `getFileUrl` from `IMediaService`. |
| `libs/backend/media/src/services/media.service.ts` | `confirmUpload` — no presigned GET. `getById` — return file without requiring `url`. Remove `getFileUrl`. `getHistory`/`getChatHistory` — map `f.url ?? null`. |
| `libs/backend/media/src/controllers/media.controller.ts` | Remove `getFileUrl` RMQ handler. Update `confirmUpload` return type (url nullable). |
| `libs/backend/media/src/database/repository/media.prisma.repo.ts` | `updateStatus(id, status)` — no url arg. `this.prisma.file.update({ data: { status } })`. |
| `libs/backend/media/src/dto/file-response.dto.ts` | `url` → `z.string().nullable()` |
| `libs/backend/media/src/dto/upload-file.dto.ts` | `VIDEO` limit → `200 * 1024 * 1024` |

### Gateway (HTTP)

| File | Change |
|---|---|
| `apps/backend/gateway/src/controllers/media.controller.ts` | `/content` — stream directly from MinIO via `this.storage` with Range support. `/url` — return fileId-based URL, no RMQ. Remove RMQ calls for presigned URL. |

### Shared Schemas

| File | Change |
|---|---|
| `libs/common/src/schemas/media/file.schema.ts` | `url` → `z.string().nullable()` |

## Optimization Summary

| Technique | Implementation |
|---|---|
| Browser caching | `Cache-Control: private, max-age=31536000, immutable` — browser never re-fetches |
| ETag / conditional | `ETag: fileId-updatedAt`, respond with 304 if `If-None-Match` matches |
| Range Requests | Parse `Range` header, proxy to MinIO, return 206 Partial Content |
| Streaming | `pipe()` from MinIO to HTTP response — no memory buffering |
| Accept-Ranges | `Accept-Ranges: bytes` advertised for all files |
| No presigned overhead | Eliminates S3 presigned URL generation + redirect latency |
| Video cap 200 MB | Prevents single large file from occupying stream for too long |

## Backwards Compatibility

- Legacy files with `url` field populated: `url` field ignored by client (uses `/content` endpoint)
- Avatar flow: unchanged, still uses public bucket + direct URL
- `GET /media/files/:fileId/url`: now returns fileId-based URL path, no presigned URL — unused client-side `getChatFileUrl()` is dead code, unaffected
