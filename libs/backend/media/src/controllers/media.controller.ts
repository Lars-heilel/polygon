import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { MEDIA_PATTERNS, MEDIA_SERVICE_TOKEN } from '@org/core';
import type { IMediaService } from '../interfaces/media.interface';
import { FileResponseDto } from '../dto/file-response.dto';

@Controller()
export class MediaController {
  constructor(
    @Inject(MEDIA_SERVICE_TOKEN) private readonly mediaService: IMediaService,
  ) {}

  @MessagePattern('media.initUpload')
  async initUpload(
    @Payload()
    payload: { originalName: string; mimeType: string; size: number; chatId?: string; uploaderId?: string },
  ) {
    return this.mediaService.initUpload(
      {
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        size: payload.size,
        chatId: payload.chatId,
      },
      payload.uploaderId,
    );
  }

  @MessagePattern('media.confirmUpload')
  async confirmUpload(@Payload() { fileId }: { fileId: string }): Promise<FileResponseDto> {
    return this.mediaService.confirmUpload(fileId);
  }

  @MessagePattern(MEDIA_PATTERNS.GET_FILE_URL)
  async getFileUrl(@Payload() { id }: { id: string }) {
    return this.mediaService.getFileUrl(id);
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
    @Payload() { uploaderId }: { uploaderId: string },
  ): Promise<FileResponseDto[]> {
    return this.mediaService.getHistory(uploaderId);
  }
}
