import { Controller, HttpException, Inject, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';

import { MEDIA_CLIENT_TOKEN, MEDIA_PATTERNS } from '@org/core';

@Controller('media')
export class MediaGatewayController {
  constructor(@Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    return this.send(this.mediaClient.send(MEDIA_PATTERNS.UPLOAD, file));
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
