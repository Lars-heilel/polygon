import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';

import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  MEDIA_CLIENT_TOKEN,
  MEDIA_PATTERNS,
} from '@org/core';

@Controller('media')
@UseGuards(JwtGuard)
export class MediaGatewayController {
  constructor(
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
  ) {}

  @Post('init-upload')
  async initUpload(
    @Body() body: { originalName: string; mimeType: string; size: number; chatId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.INIT_UPLOAD, {
        originalName: body.originalName,
        mimeType: body.mimeType,
        size: body.size,
        chatId: body.chatId,
        uploaderId: user.sub,
      }),
    );
  }

  @Post('confirm')
  async confirmUpload(@Body() body: { fileId: string }) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.CONFIRM_UPLOAD, { fileId: body.fileId }),
    );
  }

  @Get('files/:fileId/url')
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

    return this.send(this.mediaClient.send(MEDIA_PATTERNS.GET_FILE_URL, { id: fileId }));
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.send(this.mediaClient.send(MEDIA_PATTERNS.DELETE, { id }));
  }

  @Get('history')
  async getHistory(@CurrentUser() user: JwtPayload) {
    return this.send(this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, { uploaderId: user.sub }));
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Internal server error', error.statusCode ?? 500);
    }
  }
}
