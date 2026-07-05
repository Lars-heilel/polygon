import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { MEDIA_PATTERNS, MEDIA_SERVICE_TOKEN } from '@org/core';
import type { FileCategory } from '@org/common';
import type { CreateFileInput, IMediaService } from '../interfaces/media.interface';
import { FileResponseDto } from '../dto/file-response.dto';

@Controller()
export class MediaController {
  constructor(
    @Inject(MEDIA_SERVICE_TOKEN) private readonly mediaService: IMediaService,
  ) {}

  @MessagePattern('media.initUpload')
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

  @MessagePattern('media.confirmUpload')
  async confirmUpload(@Payload() { fileId }: { fileId: string }): Promise<FileResponseDto> {
    return this.mediaService.confirmUpload(fileId);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_FILE_CONTENT)
  async getFileContent(@Payload() { id }: { id: string }) {
    return this.mediaService.getFileContent(id);
  }

  @MessagePattern('media.getById')
  async getById(@Payload() { id }: { id: string }): Promise<FileResponseDto | null> {
    return this.mediaService.getById(id);
  }

  @MessagePattern('media.delete')
  async delete(@Payload() { id }: { id: string }): Promise<{ success: boolean }> {
    return this.mediaService.delete(id);
  }

  @MessagePattern('media.getHistory')
  async getHistory(
    @Payload() { uploaderId, category }: { uploaderId: string; category?: FileCategory },
  ): Promise<FileResponseDto[]> {
    return this.mediaService.getHistory(uploaderId, category);
  }

  @MessagePattern('media.getChatHistory')
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
}
