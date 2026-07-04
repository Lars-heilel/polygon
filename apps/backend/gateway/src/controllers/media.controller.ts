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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { lastValueFrom, Observable } from 'rxjs';

import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  MEDIA_CLIENT_TOKEN,
  MEDIA_PATTERNS,
  STORAGE_PROVIDER_TOKEN,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import type { IStorageProvider } from '@org/core';
import type { FileCategory } from '@org/common';

@Controller()
@UseGuards(JwtGuard)
export class MediaGatewayController {
  constructor(
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
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

  @Post('media/upload-avatar')
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

  @Get('media/files/:fileId/content')
  async getFileContent(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
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

    const { url } = await this.send<{ url: string }>(
      this.mediaClient.send(MEDIA_PATTERNS.GET_FILE_URL, { id: fileId }),
    );

    res.redirect(url);
  }

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

    if (fileInfo.category === 'AVATAR' && fileInfo.url) {
      const currentUser = await this.send<{ avatarUrl: string | null }>(
        this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub }),
      );

      if (fileInfo.url === currentUser.avatarUrl) {
        const history = await this.send<Array<{ url: string; createdAt: string }>>(
          this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, {
            uploaderId: user.sub,
            category: 'AVATAR',
          }),
        );

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
    @Query('category') category?: FileCategory,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
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
      this.mediaClient.send('media.getChatHistory', {
        chatId,
        uploaderId: user.sub,
        category,
        take: take ? parseInt(take, 10) : 50,
        skip: skip ? parseInt(skip, 10) : 0,
      }),
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
