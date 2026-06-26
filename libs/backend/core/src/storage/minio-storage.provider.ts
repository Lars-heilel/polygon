import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMinio } from 'nestjs-minio';
import * as Minio from 'minio';

import type { Env } from '../config/env.schema';
import type { IStorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly avatarsBucket: string;
  private readonly publicEndpoint: string;

  constructor(
    @InjectMinio() private readonly minioClient: Minio.Client,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.avatarsBucket = config.get('MINIO_PUBLIC_BUCKET', { infer: true });
    this.publicEndpoint = config.get('MINIO_PUBLIC_ENDPOINT', { infer: true });
  }

  async ensureBucket(name: string): Promise<void> {
    const exists = await this.minioClient.bucketExists(name);
    if (!exists) {
      await this.minioClient.makeBucket(name);
      this.logger.log(`Created bucket: ${name}`);
    }
  }

  async upload(bucket: string, key: string, file: Buffer, mimeType: string): Promise<UploadResult> {
    await this.ensureBucket(bucket);
    await this.minioClient.putObject(bucket, key, file, undefined, { 'Content-Type': mimeType });
    const url = await this.getPresignedUrl(bucket, key);
    return { bucket, key, url };
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.ensureBucket(bucket);
    await this.minioClient.removeObject(bucket, key);
  }

  private replaceEndpoint(url: string): string {
    const host = this.config.get('MINIO_ENDPOINT', { infer: true });
    const port = this.config.get('MINIO_PORT', { infer: true });
    const useSsl = this.config.get('MINIO_USE_SSL', { infer: true });
    const protocol = useSsl ? 'https' : 'http';
    const internal = `${protocol}://${host}:${port}`;
    return url.replace(internal, this.publicEndpoint);
  }

  async getPresignedUrl(bucket: string, key: string, expiresIn = 604800): Promise<string> {
    await this.ensureBucket(bucket);
    const url = await this.minioClient.presignedGetObject(bucket, key, expiresIn);
    return this.replaceEndpoint(url);
  }

  async getPresignedPutUrl(bucket: string, key: string, expiresIn = 900): Promise<string> {
    await this.ensureBucket(bucket);
    const url = await this.minioClient.presignedPutObject(bucket, key, expiresIn);
    return this.replaceEndpoint(url);
  }

  getAvatarsBucket(): string {
    return this.avatarsBucket;
  }

  getChatBucketName(chatId: string): string {
    return `polygon-chat-${chatId}`;
  }
}
