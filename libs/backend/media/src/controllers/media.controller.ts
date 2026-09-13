import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { MEDIA_PATTERNS, MEDIA_SERVICE_TOKEN } from '@org/core';
import type { FileCategory } from '@org/common';
import type {
  CreateFileInput,
  CreateMediaReferenceInput,
  DeleteFileResult,
  DeleteMediaReferenceInput,
  DeleteMediaReferenceResult,
  IMediaService,
  MediaReferenceResponse,
} from '../interfaces/media.interface';
import { FileResponseDto } from '../dto/file-response.dto';

@Controller()
export class MediaController {
  constructor(
    @Inject(MEDIA_SERVICE_TOKEN) private readonly mediaService: IMediaService,
  ) {}

  @MessagePattern(MEDIA_PATTERNS.INIT_UPLOAD)
  async initUpload(
    @Payload()
    payload: { originalName: string; mimeType: string; size: number; category: FileCategory; chatId?: string; uploaderId?: string },
  ) {
    return this.mediaService.initUpload(
      {
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        size: payload.size,
        category: payload.category,
        chatId: payload.chatId,
      },
      payload.uploaderId,
    );
  }

  @MessagePattern(MEDIA_PATTERNS.CONFIRM_UPLOAD)
  async confirmUpload(@Payload() { fileId }: { fileId: string }): Promise<FileResponseDto> {
    return this.mediaService.confirmUpload(fileId);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_FILE_CONTENT)
  async getFileContent(@Payload() { id }: { id: string }) {
    return this.mediaService.getFileContent(id);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_BY_ID)
  async getById(@Payload() { id }: { id: string }): Promise<FileResponseDto | null> {
    return this.mediaService.getById(id);
  }

  @MessagePattern(MEDIA_PATTERNS.DELETE)
  async delete(@Payload() { id }: { id: string }): Promise<DeleteFileResult> {
    return this.mediaService.delete(id);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_HISTORY)
  async getHistory(
    @Payload() { uploaderId, category }: { uploaderId: string; category?: FileCategory },
  ): Promise<FileResponseDto[]> {
    return this.mediaService.getHistory(uploaderId, category);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_ADMIN_AVATAR_HISTORY)
  async getAdminAvatarHistory(
    @Payload() { targetId }: { targetId: string },
  ): Promise<FileResponseDto[]> {
    return this.mediaService.getHistory(targetId, 'AVATAR');
  }

  @MessagePattern(MEDIA_PATTERNS.GET_CHAT_HISTORY)
  async getChatHistory(
    @Payload() payload: { chatId: string; uploaderId: string; category?: FileCategory; take?: number; skip?: number },
  ): Promise<{ files: FileResponseDto[]; total: number }> {
    return this.mediaService.getChatHistory(payload.chatId, payload.uploaderId, {
      category: payload.category,
      take: payload.take,
      skip: payload.skip,
    });
  }

  @MessagePattern(MEDIA_PATTERNS.CREATE_FILE)
  async createFile(@Payload() payload: CreateFileInput): Promise<FileResponseDto> {
    return this.mediaService.create(payload);
  }

  @MessagePattern(MEDIA_PATTERNS.CREATE_REFERENCE)
  async createReference(
    @Payload() payload: CreateMediaReferenceInput,
  ): Promise<MediaReferenceResponse> {
    return this.mediaService.createReference(payload);
  }

  @MessagePattern(MEDIA_PATTERNS.DELETE_REFERENCE)
  async deleteReference(
    @Payload() payload: DeleteMediaReferenceInput,
  ): Promise<DeleteMediaReferenceResult> {
    return this.mediaService.deleteReference(payload);
  }

  @MessagePattern(MEDIA_PATTERNS.COUNT_REFERENCES)
  async countReferences(@Payload() { fileId }: { fileId: string }): Promise<number> {
    return this.mediaService.countReferences(fileId);
  }

  @MessagePattern(MEDIA_PATTERNS.GC_STALE)
  async gcStale(
    @Payload() payload: { olderThanHours: number; take: number },
  ): Promise<{ deleted: number; failed: number }> {
    return this.mediaService.gcStalePending(payload.olderThanHours, payload.take);
  }
}
