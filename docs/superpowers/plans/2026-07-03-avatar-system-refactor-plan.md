# Avatar System Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate avatar files to permanent public URLs in MinIO, fix avatar deletion bug with DB-level avatarUrl management.

**Architecture:** Gateway receives multipart upload → puts directly to MinIO (public bucket) → notifies media service (create File record) + user service (update avatarUrl). Delete endpoint extended to update User.avatarUrl when active avatar is removed.

**Tech Stack:** NestJS, React, MinIO, Prisma, RabbitMQ

## Global Constraints

- Only `polygon-avatars` bucket — other buckets (chat, etc.) not touched
- All existing endpoints for non-avatar files remain unchanged
- No presigned URLs anywhere in avatar flow
- JWT guard on all new/modified endpoints
- Backend uploads files to MinIO directly (not presigned PUT from client)

---

## File Structure

### Modified files (7 files):

| # | File | Change |
|---|------|--------|
| 1 | `libs/backend/core/src/storage/storage-provider.interface.ts` | Add `getPublicUrl()`, `putObject()`, `setBucketPublic()` |
| 2 | `libs/backend/core/src/storage/minio-storage.provider.ts` | Implement new methods; set bucket public on ensure |
| 3 | `libs/backend/core/src/constants/queues/media.queue.ts` | Add `CREATE_FILE` pattern |
| 4 | `libs/backend/media/src/interfaces/media.interface.ts` | Add `CreateFileInput`, add `create()` to `IMediaService` |
| 5 | `libs/backend/media/src/services/media.service.ts` | Add `create()` method |
| 6 | `libs/backend/media/src/controllers/media.controller.ts` | Add `media.createFile` handler |
| 7 | `apps/backend/gateway/src/controllers/media.controller.ts` | Add `POST /media/upload-avatar`, modify `DELETE /media/:id` |
| 8 | `apps/backend/gateway/src/app/gateway.module.ts` | Import `CoreStorageModule` |
| 9 | `libs/client/features/upload-avatar/src/lib/api/upload-avatar.api.ts` | Add `uploadAvatar()` |
| 10 | `libs/client/features/upload-avatar/src/lib/hooks/use-avatar-upload.ts` | Rewrite to use `uploadAvatar()` |
| 11 | `libs/client/features/upload-avatar/src/lib/ui/avatar-carousel.tsx` | Simplify `handleDelete` |

---

### Task 1: Storage layer — add public URL, direct upload, bucket policy

**Files:**
- Modify: `libs/backend/core/src/storage/storage-provider.interface.ts`
- Modify: `libs/backend/core/src/storage/minio-storage.provider.ts`

**Interfaces:**
- Consumes: existing `IStorageProvider` interface, `MinioStorageProvider` class
- Produces: `getPublicUrl(bucket, key): string`, `putObject(bucket, key, buffer, mimeType): Promise<void>`, `setBucketPublic(bucket): Promise<void>`

- [ ] **Step 1: Add methods to interface**

Edit `libs/backend/core/src/storage/storage-provider.interface.ts`:

```typescript
export interface IStorageProvider {
  upload(bucket: string, key: string, file: Buffer, mimeType: string): Promise<UploadResult>;
  delete(bucket: string, key: string): Promise<void>;
  getPresignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getPresignedPutUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getFileStream(bucket: string, key: string): Promise<NodeJS.ReadableStream>;
  ensureBucket(name: string): Promise<void>;
  getAvatarsBucket(): string;
  getChatBucketName(chatId: string): string;
  getPublicUrl(bucket: string, key: string): string;
  putObject(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<void>;
  setBucketPublic(bucket: string): Promise<void>;
}
```

- [ ] **Step 2: Implement `getPublicUrl` in `MinioStorageProvider`**

Edit `libs/backend/core/src/storage/minio-storage.provider.ts` — add method:

```typescript
getPublicUrl(bucket: string, key: string): string {
  return `${this.publicEndpoint}/${bucket}/${key}`;
}
```

- [ ] **Step 3: Implement `putObject`**

Add to `MinioStorageProvider`:

```typescript
async putObject(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await this.ensureBucket(bucket);
  await this.minioClient.putObject(bucket, key, buffer, undefined, { 'Content-Type': mimeType });
}
```

- [ ] **Step 4: Implement `setBucketPublic`**

Add to `MinioStorageProvider`:

```typescript
async setBucketPublic(bucket: string): Promise<void> {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  };
  await this.minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
  this.logger.log(`Bucket ${bucket} set to public`);
}
```

- [ ] **Step 5: Ensure avatar bucket is public on creation**

Modify `ensureBucket` in `MinioStorageProvider` to make the avatar bucket public:

```typescript
async ensureBucket(name: string): Promise<void> {
  const exists = await this.minioClient.bucketExists(name);
  if (!exists) {
    await this.minioClient.makeBucket(name);
    this.logger.log(`Created bucket: ${name}`);
  }
  // Make the avatars bucket publicly readable
  if (name === this.avatarsBucket) {
    await this.setBucketPublic(name);
  }
}
```

- [ ] **Step 6: Verify build**

```bash
npx nx run core:build 2>&1 | tail -5
```
Expected: `Successfully ran target build`

- [ ] **Step 7: Commit**

```bash
git add libs/backend/core/src/storage/
git commit -m "feat(storage): add public URL, direct put, and bucket policy methods for avatar bucket"
```

---

### Task 2: Media Patterns — add CREATE_FILE constant

**Files:**
- Modify: `libs/backend/core/src/constants/queues/media.queue.ts`

- [ ] **Step 1: Add CREATE_FILE to MEDIA_PATTERNS**

```typescript
export const MEDIA_PATTERNS = {
  INIT_UPLOAD: 'media.initUpload',
  CONFIRM_UPLOAD: 'media.confirmUpload',
  GET_BY_ID: 'media.getById',
  GET_FILE_URL: 'media.getFileUrl',
  GET_FILE_CONTENT: 'media.getFileContent',
  DELETE: 'media.delete',
  GET_HISTORY: 'media.getHistory',
  GET_CHAT_HISTORY: 'media.getChatHistory',
  CREATE_FILE: 'media.createFile',
} as const;
```

- [ ] **Step 2: Verify build**

```bash
npx nx run core:build 2>&1 | tail -5
```
Expected: `Successfully ran target build`

- [ ] **Step 3: Commit**

```bash
git add libs/backend/core/src/constants/queues/media.queue.ts
git commit -m "feat(media): add CREATE_FILE message pattern"
```

---

### Task 3: Media Service — add `create` method and controller handler

**Files:**
- Modify: `libs/backend/media/src/interfaces/media.interface.ts`
- Modify: `libs/backend/media/src/services/media.service.ts`
- Modify: `libs/backend/media/src/controllers/media.controller.ts`

- [ ] **Step 1: Add `CreateFileInput` and `create()` to interface**

Edit `libs/backend/media/src/interfaces/media.interface.ts`:

Add after `UploadInput`:

```typescript
export interface CreateFileInput {
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploaderId: string;
  category: FileCategory;
}
```

Add `create()` to `IMediaService`:

```typescript
export interface IMediaService {
  initUpload(input: UploadInput, uploaderId?: string): Promise<InitUploadResult>;
  confirmUpload(fileId: string): Promise<FileResponse>;
  getById(id: string): Promise<FileResponse | null>;
  getFileUrl(id: string): Promise<FileUrlResult>;
  getFileContent(id: string): Promise<FileContentResult>;
  delete(id: string): Promise<{ success: boolean }>;
  getHistory(uploaderId: string, category?: FileCategory): Promise<FileResponse[]>;
  getChatHistory(chatId: string, uploaderId: string, options?: { category?: FileCategory; take?: number; skip?: number }): Promise<{ files: FileResponse[]; total: number }>;
  create(input: CreateFileInput): Promise<FileResponse>;
}
```

- [ ] **Step 2: Add `create()` to MediaService**

Add to `libs/backend/media/src/services/media.service.ts`:

```typescript
async create(input: CreateFileInput): Promise<FileResponse> {
  const file = await this.repo.create({
    bucket: input.bucket,
    key: input.key,
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    url: input.url,
    uploaderId: input.uploaderId,
    status: 'READY',
    category: input.category,
  });

  return {
    id: file.id,
    url: file.url!,
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

- [ ] **Step 3: Add controller handler**

Add to `libs/backend/media/src/controllers/media.controller.ts`:

```typescript
@MessagePattern(MEDIA_PATTERNS.CREATE_FILE)
async createFile(@Payload() payload: CreateFileInput): Promise<FileResponseDto> {
  return this.mediaService.create(payload);
}
```

And import `CreateFileInput`:

```typescript
import type { CreateFileInput } from '../interfaces/media.interface';
```

- [ ] **Step 4: Verify build**

```bash
npx nx run media:build 2>&1 | tail -5
```
Expected: `Successfully ran target build`

- [ ] **Step 5: Commit**

```bash
git add libs/backend/media/src/
git commit -m "feat(media): add create method for direct file record creation"
```

---

### Task 4: Gateway — add CoreStorageModule and POST /media/upload-avatar

**Files:**
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`

- [ ] **Step 1: Import CoreStorageModule in gateway module**

Edit `apps/backend/gateway/src/app/gateway.module.ts`:

Add import:
```typescript
import { CoreStorageModule } from '@org/core';
```

Add to `imports` array:
```typescript
CoreStorageModule,
```

- [ ] **Step 2: Add `POST /media/upload-avatar` endpoint**

Edit `apps/backend/gateway/src/controllers/media.controller.ts`:

Add imports:
```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { STORAGE_PROVIDER_TOKEN, USER_CLIENT_TOKEN, USER_PATTERNS } from '@org/core';
import type { IStorageProvider } from '@org/core';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
```

Add `userClient` to constructor:
```typescript
constructor(
  @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
  @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
  @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
  @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
) {}
```

Add endpoint method:
```typescript
@Post('media/upload-avatar')
@UseGuards(JwtGuard)
@UseInterceptors(FileInterceptor('file'))
async uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: JwtPayload,
) {
  if (!file) {
    throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
  }

  if (!file.mimetype.startsWith('image/')) {
    throw new HttpException('Only image files are allowed', HttpStatus.BAD_REQUEST);
  }

  const ext = extname(file.originalname);
  const key = `avatars/${user.sub}/${randomUUID()}${ext}`;
  const bucket = this.storage.getAvatarsBucket();

  await this.storage.putObject(bucket, key, file.buffer, file.mimetype);
  const publicUrl = this.storage.getPublicUrl(bucket, key);

  const created = await this.send<Record<string, unknown>>(
    this.mediaClient.send(MEDIA_PATTERNS.CREATE_FILE, {
      bucket,
      key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.buffer.length,
      url: publicUrl,
      uploaderId: user.sub,
      category: 'AVATAR',
    }),
  );

  await this.send(
    this.userClient.send(USER_PATTERNS.UPDATE, {
      id: user.sub,
      dto: { avatarUrl: publicUrl },
    }),
  );

  return created;
}
```

- [ ] **Step 3: Verify build**

```bash
npx nx run gateway:build 2>&1 | tail -10
```
Expected: `Successfully ran target build`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/gateway/src/
git commit -m "feat(gateway): add POST /media/upload-avatar with public MinIO upload"
```

---

### Task 5: Gateway — fix DELETE /media/:id for avatar URL cleanup

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`

- [ ] **Step 1: Modify delete endpoint**

Replace the existing `delete` method in `apps/backend/gateway/src/controllers/media.controller.ts`:

```typescript
@Delete('media/:id')
async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  const fileInfo = await this.send<{
    id: string;
    chatId: string | null;
    uploaderId: string | null;
    url: string | null;
    category: string | null;
  } | null>(
    this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id }),
  );

  if (!fileInfo) {
    throw new HttpException('File not found', HttpStatus.NOT_FOUND);
  }

  if (fileInfo.uploaderId !== user.sub) {
    throw new HttpException('Forbidden: not the file owner', HttpStatus.FORBIDDEN);
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

  let previousAvatarUrl: string | null | undefined;

  // If deleting an avatar, check if it's the active one
  if (fileInfo.category === 'AVATAR' && fileInfo.url) {
    const currentUser = await this.send<{ avatarUrl: string | null }>(
      this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub }),
    );

    if (fileInfo.url === currentUser.avatarUrl) {
      // Find the previous avatar in history
      const history = await this.send<Array<{ url: string; createdAt: string }>>(
        this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, {
          uploaderId: user.sub,
          category: 'AVATAR',
        }),
      );

      // History is ordered by createdAt desc; find first entry that is NOT the deleted file
      const previous = history.find((f) => f.url !== fileInfo.url);
      previousAvatarUrl = previous?.url ?? null;

      await this.send(
        this.userClient.send(USER_PATTERNS.UPDATE, {
          id: user.sub,
          dto: { avatarUrl: previousAvatarUrl },
        }),
      );
    }
  }

  await this.send(this.mediaClient.send(MEDIA_PATTERNS.DELETE, { id }));

  return { success: true, previousAvatarUrl };
}
```

- [ ] **Step 2: Verify build**

```bash
npx nx run gateway:build 2>&1 | tail -10
```
Expected: `Successfully ran target build`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/gateway/src/controllers/media.controller.ts
git commit -m "fix(gateway): update User.avatarUrl on avatar file deletion"
```

---

### Task 6: Frontend — add uploadAvatar API and simplify upload hook

**Files:**
- Modify: `libs/client/features/upload-avatar/src/lib/api/upload-avatar.api.ts`
- Modify: `libs/client/features/upload-avatar/src/lib/hooks/use-avatar-upload.ts`

- [ ] **Step 1: Add `uploadAvatar` API function**

Add to `libs/client/features/upload-avatar/src/lib/api/upload-avatar.api.ts`:

```typescript
export async function uploadAvatar(file: File): Promise<AvatarItem> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/media/upload-avatar', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 2: Rewrite `use-avatar-upload` hook**

Replace `libs/client/features/upload-avatar/src/lib/hooks/use-avatar-upload.ts`:

```typescript
import { useCallback, useState } from 'react';
import { queryClient } from '@org/shared';
import { uploadAvatar } from '../api/upload-avatar.api';
import { useAvatarStore } from '../model/avatar.store';

export function useAvatarUpload() {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const addFile = useAvatarStore((s) => s.addFile);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setStep('uploading');
      setProgress(0);

      try {
        setProgress(50);
        const result = await uploadAvatar(file);
        setProgress(100);

        queryClient.invalidateQueries({ queryKey: ['me'] });

        addFile({
          id: result.id,
          url: result.url,
          bucket: result.bucket,
          key: result.key,
          originalName: result.originalName,
          mimeType: result.mimeType,
          size: result.size,
          category: 'AVATAR',
          createdAt: result.createdAt,
        });
        setStep('done');
      } catch (e) {
        setStep('error');
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    },
    [addFile],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { upload, reset, progress, step, error, isUploading: step === 'uploading' };
}
```

- [ ] **Step 3: Commit**

```bash
git add libs/client/features/upload-avatar/src/lib/api/upload-avatar.api.ts libs/client/features/upload-avatar/src/lib/hooks/use-avatar-upload.ts
git commit -m "feat(client): simplify avatar upload to single backend call"
```

---

### Task 7: Frontend — simplify avatar carousel delete handler

**Files:**
- Modify: `libs/client/features/upload-avatar/src/lib/ui/avatar-carousel.tsx`

- [ ] **Step 1: Remove manual avatarUrl update from handleDelete**

Replace `handleDelete` in `libs/client/features/upload-avatar/src/lib/ui/avatar-carousel.tsx`:

```typescript
const handleDelete = async () => {
  if (!currentFile || actionLoading) return;
  setActionLoading(true);
  try {
    await deleteFile(currentFile.id);
    queryClient.invalidateQueries({ queryKey: ['me'] });
    removeFile(currentFile.id);
  } catch {
    /* ignore */
  } finally {
    setActionLoading(false);
  }
};
```

Remove unused imports:
- Remove `updateUserProfile` from the import line (keep `deleteFile`)
- Remove `useMeQuery` import if it's no longer used elsewhere

Check if `me` is used elsewhere in the component. The `useMeQuery` is used for `me?.avatarUrl` check which is now removed. Let me check the full component...

The `me` variable is only used in `handleDelete`. Since we removed that logic, we can remove `useMeQuery` entirely.

Remove:
```typescript
import { useMeQuery } from '@org/entities-user';
```

And remove:
```typescript
const { data: me } = useMeQuery();
```

- [ ] **Step 2: Commit**

```bash
git add libs/client/features/upload-avatar/src/lib/ui/avatar-carousel.tsx
git commit -m "fix(client): remove manual avatarUrl update on delete — handled by backend"
```

---

### Task 8: Verify build

- [ ] **Step 1: Build all affected projects**

Run from workspace root:
```bash
npx nx run-many -t build -p gateway features-upload-avatar media media-service user-service core
```

Fix any type errors.

- [ ] **Step 2: Verify avatar upload flow end-to-end**

1. Start the app (gateway, media service, user service, MinIO)
2. Upload an avatar via the UI
3. Check MinIO bucket — file should be in `polygon-avatars/avatars/{userId}/{uuid}.jpg`
4. Check the URL stored in `User.avatarUrl` — should be a permanent public URL (e.g., `http://localhost:9000/polygon-avatars/avatars/{userId}/{uuid}.jpg`)
5. Verify the URL is accessible without any presigned parameters
6. Delete the active avatar — check `User.avatarUrl` is updated to the previous avatar or null
7. Upload another avatar — confirm old one still exists in MinIO, new one gets new public URL
