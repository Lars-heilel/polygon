import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { MEDIA_PRISMA_REPOSITORY_TOKEN, STORAGE_PROVIDER_TOKEN } from '@org/core';
import type { IStorageProvider } from '@org/core';
import type { FileCategory } from '@org/common';
import type {
  CreateFileInput,
  FileContentResult,
  FileResponse,
  IMediaRepository,
  IMediaService,
  InitUploadResult,
  UploadInput,
} from '../interfaces/media.interface';

const CATEGORY_PREFIX: Record<FileCategory, string> = {
  AVATAR: 'avatars',
  IMAGE: 'images',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'files',
  VOICE: 'voice',
  CIRCLE: 'circles',
};

@Injectable()
export class MediaService implements IMediaService {
  constructor(
    @Inject(MEDIA_PRISMA_REPOSITORY_TOKEN) private readonly repo: IMediaRepository,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
  ) {}

  async initUpload(
    input: UploadInput,
    uploaderId?: string,
  ): Promise<InitUploadResult> {
    const ext = extname(input.originalName);
    const prefix = CATEGORY_PREFIX[input.category];
    const key = input.chatId
      ? `${prefix}/${randomUUID()}${ext}`
      : `${uploaderId ?? 'unknown'}/${randomUUID()}${ext}`;

    const bucket = input.chatId
      ? this.storage.getChatBucketName(input.chatId)
      : this.storage.getAvatarsBucket();

    const presignedUrl = await this.storage.getPresignedPutUrl(bucket, key);

    const file = await this.repo.create({
      bucket,
      key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      uploaderId: uploaderId ?? null,
      status: 'PENDING',
      chatId: input.chatId ?? null,
      category: input.category,
    });

    return { fileId: file.id, presignedUrl };
  }

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

  async getFileContent(id: string): Promise<FileContentResult> {
    const file = await this.repo.findById(id);
    if (!file) {
      throw new Error('File not found');
    }
    const result = await this.storage.getFileStream(file.bucket, file.key);
    return {
      stream: result.stream,
      mimeType: file.mimeType,
      originalName: file.originalName,
      bucket: file.bucket,
      key: file.key,
      size: file.size,
    };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const file = await this.repo.findById(id);
    if (!file) return { success: false };
    await this.storage.delete(file.bucket, file.key);
    await this.repo.delete(id);
    return { success: true };
  }

  async getHistory(uploaderId: string, category?: FileCategory): Promise<FileResponse[]> {
    const files = await this.repo.findByUploaderId(uploaderId, category);
    return files.map((f) => ({
      id: f.id,
      url: f.url,
      bucket: f.bucket,
      key: f.key,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      category: f.category as FileCategory,
      uploaderId: f.uploaderId,
      chatId: f.chatId,
      createdAt: f.createdAt,
    }));
  }

  async getChatHistory(
    chatId: string,
    uploaderId: string,
    options?: { category?: FileCategory; take?: number; skip?: number },
  ): Promise<{ files: FileResponse[]; total: number }> {
    const [files, total] = await Promise.all([
      this.repo.findByChatId(chatId, { uploaderId, category: options?.category, take: options?.take, skip: options?.skip }),
      this.repo.countByChatId(chatId, { category: options?.category }),
    ]);
    return {
      files: files.map((f) => ({
        id: f.id,
        url: f.url,
        bucket: f.bucket,
        key: f.key,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        category: f.category as FileCategory,
        uploaderId: f.uploaderId,
        chatId: f.chatId,
        createdAt: f.createdAt,
      })),
      total,
    };
  }

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
}
