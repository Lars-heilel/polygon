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
  Query,
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
import type { FileCategory } from '@org/common';

@Controller()
@UseGuards(JwtGuard)
export class MediaGatewayController {
  constructor(
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
  ) {}

  @Post('media/init-upload')
  async initUpload(
    @Body() body: { originalName: string; mimeType: string; size: number; category: FileCategory; chatId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    if (body.chatId) {
      const isMember = await this.send<boolean>(
        this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
          chatId: body.chatId,
          userId: user.sub,
        }),
      );

      if (!isMember) {
        throw new HttpException('Forbidden: not a chat member', HttpStatus.FORBIDDEN);
      }
    }

    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.INIT_UPLOAD, {
        originalName: body.originalName,
        mimeType: body.mimeType,
        size: body.size,
        category: body.category,
        chatId: body.chatId,
        uploaderId: user.sub,
      }),
    );
  }

  @Post('media/confirm')
  async confirmUpload(@Body() body: { fileId: string }) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.CONFIRM_UPLOAD, { fileId: body.fileId }),
    );
  }

  @Get('media/files/:fileId/url')
  async getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload) {
    const fileInfo = await this.send<{ id: string; chatId: string | null; uploaderId: string | null } | null>(
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

  @Delete('media/:id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const fileInfo = await this.send<{ id: string; chatId: string | null; uploaderId: string | null } | null>(
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

    return this.send(this.mediaClient.send(MEDIA_PATTERNS.DELETE, { id }));
  }

  @Get('media/history')
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: FileCategory,
  ) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, { uploaderId: user.sub, category }),
    );
  }

  @Get('chats/:chatId/media/history')
  async getChatHistory(
    @Param('chatId') chatId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );

    if (!isMember) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return this.send(
      this.mediaClient.send('media.getChatHistory', { chatId, uploaderId: user.sub }),
    );
  }

  @Get('users/:userId/avatars')
  async getUserAvatars(@Param('userId') userId: string) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, {
        uploaderId: userId,
        category: 'AVATAR',
      }),
    );
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
