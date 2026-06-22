import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env, IStorageProvider, UploadResult } from '@org/core';

@Injectable()
export class MinioProvider implements IStorageProvider {
  private readonly logger = new Logger(MinioProvider.name);

  constructor(config: ConfigService<Env, true>) {
    void config;
  }

  async upload(bucket: string, key: string, file: Buffer, mimeType: string): Promise<UploadResult> {
    void bucket;
    void key;
    void file;
    void mimeType;
    this.logger.warn('MinIO provider not implemented');
    throw new Error('Not implemented');
  }

  async delete(bucket: string, key: string): Promise<void> {
    void bucket;
    void key;
    this.logger.warn('MinIO provider not implemented');
    throw new Error('Not implemented');
  }

  async getPresignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string> {
    void bucket;
    void key;
    void expiresIn;
    this.logger.warn('MinIO provider not implemented');
    throw new Error('Not implemented');
  }
}
