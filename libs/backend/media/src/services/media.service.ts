import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { MEDIA_PRISMA_REPOSITORY_TOKEN, STORAGE_PROVIDER_TOKEN } from '@org/core';
import type { IStorageProvider } from '@org/core';
import type {
  FileResponse,
  FileUrlResult,
  IMediaRepository,
  IMediaService,
  InitUploadResult,
} from '../interfaces/media.interface';

@Injectable()
export class MediaService implements IMediaService {
  private readonly publicBucket: string;

  constructor(
    @Inject(MEDIA_PRISMA_REPOSITORY_TOKEN) private readonly repo: IMediaRepository,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
  ) {
    this.publicBucket = 'polygon-public';
  }

  async initUpload(
    input: { originalName: string; mimeType: string; size: number; chatId?: string },
    uploaderId?: string,
  ): Promise<InitUploadResult> {
    const ext = extname(input.originalName);
    const key = `${randomUUID()}${ext}`;

    const presignedUrl = await this.storage.getPresignedPutUrl(this.publicBucket, key);

    const file = await this.repo.create({
      bucket: this.publicBucket,
      key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      uploaderId: uploaderId ?? null,
      status: 'PENDING',
      chatId: input.chatId ?? null,
    });

    return { fileId: file.id, presignedUrl };
  }

  async confirmUpload(fileId: string): Promise<FileResponse> {
    const file = await this.repo.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const url = await this.storage.getPresignedUrl(file.bucket, file.key);
    const updated = await this.repo.updateStatus(fileId, 'READY', url);

    return {
      id: updated.id,
      url: updated.url!,
      originalName: updated.originalName,
      mimeType: updated.mimeType,
      size: updated.size,
      createdAt: updated.createdAt,
    };
  }

  async getFileUrl(id: string): Promise<FileUrlResult> {
    const file = await this.repo.findById(id);
    if (!file) throw new Error('File not found');
    const expiresIn = 900;
    const url = await this.storage.getPresignedUrl(file.bucket, file.key, expiresIn);
    return { url, expiresIn };
  }

  async getById(id: string): Promise<FileResponse | null> {
    const file = await this.repo.findById(id);
    if (!file || !file.url) return null;
    return {
      id: file.id,
      url: file.url,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
    };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const file = await this.repo.findById(id);
    if (!file) return { success: false };
    await this.storage.delete(file.bucket, file.key);
    await this.repo.delete(id);
    return { success: true };
  }

  async getHistory(uploaderId: string): Promise<FileResponse[]> {
    const files = await this.repo.findByUploaderId(uploaderId);
    return files.map((f) => ({
      id: f.id,
      url: f.url!,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
    }));
  }
}
