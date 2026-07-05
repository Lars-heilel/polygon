# Permanent Private File Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace presigned GET URL file access with direct Gateway streaming from MinIO, with Range Request support for video seeking.

**Architecture:** Gateway already has `IStorageProvider` (MinIO) injected. Instead of generating presigned URLs and redirecting, Gateway pipes the MinIO `getObject` stream directly to the HTTP response. Upload flow (2-phase presigned PUT) stays unchanged. Avatars remain public bucket with direct URLs.

**Tech Stack:** NestJS, MinIO JS Client, RxJS, Prisma

## Global Constraints

- All HTTP traffic through Gateway — no direct service access
- Avatars excluded from changes
- Upload flow unchanged
- Video capped at 200 MB
- `url` field in `File` model already nullable — no DB migration needed
- Existing presigned URLs in legacy `url` fields left as-is

---

### Task 1: IStorageProvider — Range types and interface

**Files:**
- Modify: `libs/backend/core/src/storage/storage-provider.interface.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `FileStreamResult`, `Range`, updated `IStorageProvider`

---

- [ ] **Add `FileStreamResult` and `Range` types, update `getFileStream`**

Replace the `IStorageProvider` interface in `storage-provider.interface.ts`:

```typescript
export interface UploadResult {
  bucket: string;
  key: string;
  url: string;
}

export interface Range {
  start: number;
  end: number;
}

export interface FileStreamResult {
  stream: NodeJS.ReadableStream;
  size: number;
  contentType: string;
  etag?: string;
}

export interface IStorageProvider {
  upload(bucket: string, key: string, file: Buffer, mimeType: string): Promise<UploadResult>;
  delete(bucket: string, key: string): Promise<void>;
  getPresignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getPresignedPutUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getFileStream(bucket: string, key: string, range?: Range): Promise<FileStreamResult>;
  ensureBucket(name: string): Promise<void>;
  getAvatarsBucket(): string;
  getChatBucketName(chatId: string): string;
  getPublicUrl(bucket: string, key: string): string;
  putObject(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<void>;
  setBucketPublic(bucket: string): Promise<void>;
}
```

Key change: `getFileStream(bucket, key)` → `getFileStream(bucket, key, range?)` with `FileStreamResult` return type.

---

### Task 2: MinioStorageProvider — Range-aware getFileStream

**Files:**
- Modify: `libs/backend/core/src/storage/minio-storage.provider.ts`

**Interfaces:**
- Consumes: `IStorageProvider` with new `getFileStream` signature
- Produces: working `getFileStream` with MinIO range passthrough

---

- [ ] **Implement range-aware `getFileStream`**

Replace the existing `getFileStream` method in `minio-storage.provider.ts`:

```typescript
async getFileStream(bucket: string, key: string, range?: Range): Promise<FileStreamResult> {
  await this.ensureBucket(bucket);

  const stat = await this.minioClient.statObject(bucket, key);

  let stream: NodeJS.ReadableStream;

  if (range) {
    const length = range.end - range.start + 1;
    stream = await this.minioClient.getPartialObject(bucket, key, range.start, length);
  } else {
    stream = await this.minioClient.getObject(bucket, key);
  }

  return {
    stream,
    size: stat.size,
    contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
  };
}
```

Also update the import at the top:

```typescript
import type { IStorageProvider, UploadResult, Range, FileStreamResult } from './storage-provider.interface';
```

---

### Task 3: Media repository — updateStatus without url

**Files:**
- Modify: `libs/backend/media/src/database/repository/media.prisma.repo.ts`

**Interfaces:**
- Consumes: `IMediaRepository` interface
- Produces: `updateStatus(id, status)` without url param

---

- [ ] **Change `updateStatus` signature — remove `url` param**

```typescript
async updateStatus(id: string, status: 'PENDING' | 'READY'): Promise<File> {
  try {
    return await this.prisma.file.update({
      where: { id },
      data: { status },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}
```

---

### Task 4: Interfaces — update IMediaRepository and IMediaService

**Files:**
- Modify: `libs/backend/media/src/interfaces/media.interface.ts`

**Interfaces:**
- Consumes: updated `updateStatus` from repository
- Produces: new `IMediaRepository`, `IMediaService` with nullable url

---

- [ ] **Update interfaces**

```typescript
export interface IMediaRepository {
  findById(id: string): Promise<File | null>;
  findByUploaderId(uploaderId: string, category?: FileCategory): Promise<File[]>;
  findByChatId(chatId: string, options?: { uploaderId?: string; category?: FileCategory; take?: number; skip?: number }): Promise<File[]>;
  countByChatId(chatId: string, options?: { category?: FileCategory }): Promise<number>;
  create(data: {
    bucket: string;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string | null;
    uploaderId?: string | null;
    status?: 'PENDING' | 'READY';
    chatId?: string | null;
    category: FileCategory;
  }): Promise<File>;
  updateStatus(id: string, status: 'PENDING' | 'READY'): Promise<File>;
  delete(id: string): Promise<void>;
}

export interface FileResponse {
  id: string;
  url: string | null;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  uploaderId: string | null;
  chatId: string | null;
  createdAt: Date;
}

export interface IMediaService {
  initUpload(input: UploadInput, uploaderId?: string): Promise<InitUploadResult>;
  confirmUpload(fileId: string): Promise<FileResponse>;
  getById(id: string): Promise<FileResponse | null>;
  getFileContent(id: string): Promise<FileContentResult>;
  delete(id: string): Promise<{ success: boolean }>;
  getHistory(uploaderId: string, category?: FileCategory): Promise<FileResponse[]>;
  getChatHistory(chatId: string, uploaderId: string, options?: { category?: FileCategory; take?: number; skip?: number }): Promise<{ files: FileResponse[]; total: number }>;
  create(input: CreateFileInput): Promise<FileResponse>;
}
```

Changes:
- `updateStatus(id, status, url)` → `updateStatus(id, status)`
- `FileResponse.url` → `string | null`
- Removed `getFileUrl` from `IMediaService`

---

### Task 5: Media service — update confirmUpload, getById, remove getFileUrl

**Files:**
- Modify: `libs/backend/media/src/services/media.service.ts`

**Interfaces:**
- Consumes: updated `IMediaRepository` and `IMediaService`
- Produces: working service without presigned GET generation

---

- [ ] **Update `confirmUpload` — no presigned GET URL**

```typescript
async confirmUpload(fileId: string): Promise<FileResponse> {
  const file = await this.repo.findById(fileId);
  if (!file) {
    throw new Error('File not found');
  }

  const updated = await this.repo.updateStatus(fileId, 'READY');

  return {
    id: updated.id,
    url: null,
    bucket: updated.bucket,
    key: updated.key,
    originalName: updated.originalName,
    mimeType: updated.mimeType,
    size: updated.size,
    category: updated.category as FileCategory,
    uploaderId: updated.uploaderId,
    chatId: updated.chatId,
    createdAt: updated.createdAt,
  };
}
```

- [ ] **Update `getById` — return file even without url**

```typescript
async getById(id: string): Promise<FileResponse | null> {
  const file = await this.repo.findById(id);
  if (!file) return null;
  return {
    id: file.id,
    url: file.url,
    bucket: file.bucket,
    key: file.key,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category as FileCategory,
    uploaderId: file.uploaderId,
    chatId: file.chatId,
    createdAt: file.createdAt,
  };
}
```

- [ ] **Remove `getFileUrl` method entirely** (lines 91-97)

- [ ] **Update `getHistory` and `getChatHistory` — url nullable**

Replace `f.url!` with `f.url` in both methods (remove non-null assertion):

```typescript
return files.map((f) => ({
  id: f.id,
  url: f.url,
  // ...
}));
```

---

### Task 6: Media controller — remove getFileUrl RMQ handler

**Files:**
- Modify: `libs/backend/media/src/controllers/media.controller.ts`

**Interfaces:**
- Consumes: updated `IMediaService`
- Produces: cleaned RMQ handlers

---

- [ ] **Remove the `getFileUrl` handler** (lines 37-40):

Delete this block:
```typescript
@MessagePattern(MEDIA_PATTERNS.GET_FILE_URL)
async getFileUrl(@Payload() { id }: { id: string }) {
  return this.mediaService.getFileUrl(id);
}
```

Also remove `FileUrlResult` from import if it was the only usage (check imports at top).

- [ ] **Remove unused `MEDIA_PATTERNS.GET_FILE_URL` import** — verify `GET_FILE_URL` isn't used elsewhere in the controller.

---

### Task 7: DTOs and schemas — nullable url + video limit

**Files:**
- Modify: `libs/backend/media/src/dto/file-response.dto.ts`
- Modify: `libs/backend/media/src/dto/upload-file.dto.ts`
- Modify: `libs/common/src/schemas/media/file.schema.ts`

**Interfaces:**
- Consumes: nothing
- Produces: validated DTOs with nullable url, 200 MB video limit

---

- [ ] **Update `file-response.dto.ts` — url nullable**

```typescript
export const fileResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string().nullable(),
  bucket: z.string(),
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  category: fileCategorySchema,
  uploaderId: z.string().uuid().nullable(),
  chatId: z.string().uuid().nullable(),
  createdAt: z.date(),
});
```

- [ ] **Update `upload-file.dto.ts` — video limit 200 MB**

```typescript
export const FILE_SIZE_LIMITS: Record<string, number> = {
  AVATAR: 5 * 1024 * 1024,
  IMAGE: 20 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,   // changed from 500 MB to 200 MB
  FILE: 100 * 1024 * 1024,
  VOICE: 10 * 1024 * 1024,
  CIRCLE: 30 * 1024 * 1024,
};
```

- [ ] **Update `file.schema.ts` — url nullable**

```typescript
export const fileSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string(),
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  url: z.string().nullable(),
  uploaderId: z.string().uuid().nullable(),
  status: fileStatusSchema,
  chatId: z.string().uuid().nullable(),
  category: fileCategorySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

### Task 8: Gateway `/content` — stream from MinIO with Range support

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`

**Interfaces:**
- Consumes: `IStorageProvider` with range-aware `getFileStream`
- Produces: streaming file content with Range, ETag, caching headers

---

- [ ] **Rewrite `getFileContent` method** (lines 156-184)

```typescript
import { createHash } from 'node:crypto';

@Get('media/files/:fileId/content')
async getFileContent(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload, @Req() req: Request, @Res() res: Response) {
  const fileInfo = await this.send<{ id: string; bucket: string; key: string; mimeType: string; size: number; chatId: string | null } | null>(
    this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id: fileId }),
  );

  if (!fileInfo) {
    throw new HttpException('File not found', HttpStatus.NOT_FOUND);
  }

  if (fileInfo.chatId) {
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId: fileInfo.chatId,
        userId: user.sub,
      }),
    );

    if (!isMember) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  const etag = `"${fileId}-${fileInfo.size}"`;

  if (req.headers['if-none-match'] === etag) {
    return res.status(HttpStatus.NOT_MODIFIED).end();
  }

  const rangeHeader = req.headers['range'] as string | undefined;
  let range: { start: number; end: number } | undefined;

  if (rangeHeader) {
    const parsed = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (parsed) {
      const start = parseInt(parsed[1], 10);
      const end = parsed[2] ? parseInt(parsed[2], 10) : fileInfo.size - 1;
      if (start < fileInfo.size && end < fileInfo.size && start <= end) {
        range = { start, end };
      }
    }
  }

  const fileStream = await this.storage.getFileStream(fileInfo.bucket, fileInfo.key, range);

  if (range) {
    res.status(HttpStatus.PARTIAL_CONTENT);
    res.setHeader('Content-Range', `bytes ${range.start}-${Math.min(range.end, fileStream.size - 1)}/${fileStream.size}`);
    res.setHeader('Content-Length', Math.min(range.end, fileStream.size - 1) - range.start + 1);
  } else {
    res.setHeader('Content-Length', fileStream.size);
  }

  res.setHeader('Content-Type', fileStream.contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('ETag', etag);

  fileStream.stream.pipe(res).on('error', () => {
    if (!res.headersSent) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
    }
  });
}
```

Also add `@Req()` import from `@nestjs/common` — add to the existing import line:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
```

---

### Task 9: Gateway `/url` — return fileId-based URL

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`

**Interfaces:**
- Consumes: nothing
- Produces: clean URL endpoint without presigned generation

---

- [ ] **Update `getFileUrl` method** (lines 130-154)

```typescript
@Get('media/files/:fileId/url')
async getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload) {
  const fileInfo = await this.send<{ id: string; chatId: string | null } | null>(
    this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id: fileId }),
  );

  if (!fileInfo) {
    throw new HttpException('File not found', HttpStatus.NOT_FOUND);
  }

  if (fileInfo.chatId) {
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId: fileInfo.chatId,
        userId: user.sub,
      }),
    );

    if (!isMember) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  return { url: `/api/media/files/${fileId}/content`, expiresIn: null };
}
```

---

### Task 10: Cleanup unused imports and verify build

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`
- Modify: `libs/backend/media/src/controllers/media.controller.ts`

---

- [ ] **Remove unused `MEDIA_PATTERNS.GET_FILE_URL` references**

In `apps/backend/gateway/src/controllers/media.controller.ts` — ensure no remaining references to `MEDIA_PATTERNS.GET_FILE_URL` (it was used in the old `getFileUrl` and `getFileContent` methods — both are now replaced).

- [ ] **Run typecheck to verify**

```bash
npx nx run-many -t typecheck -p @org/gateway @org/media @org/core @org/common
```

- [ ] **Run build to verify**

```bash
npx nx run-many -t build -p @org/gateway @org/media @org/core @org/common
```
