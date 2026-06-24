import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';

import {
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  MEDIA_CLIENT_TOKEN,
  MEDIA_PATTERNS,
} from '@org/core';

@Controller('media')
@UseGuards(JwtGuard)
export class MediaGatewayController {
  constructor(@Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy) {}

  @Post('init-upload')
  async initUpload(
    @Body() body: { originalName: string; mimeType: string; size: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.INIT_UPLOAD, {
        originalName: body.originalName,
        mimeType: body.mimeType,
        size: body.size,
        uploaderId: user.sub,
      }),
    );
  }

  @Post('confirm')
  async confirmUpload(
    @Body() body: { fileId: string },
  ) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.CONFIRM_UPLOAD, { fileId: body.fileId }),
    );
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
