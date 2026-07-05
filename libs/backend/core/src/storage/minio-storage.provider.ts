import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMinio } from 'nestjs-minio';
import * as Minio from 'minio';

import type { Env } from '../config/env.schema';
import type { IStorageProvider, UploadResult, Range, FileStreamResult } from './storage-provider.interface';

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
    if (name === this.avatarsBucket) {
      await this.setBucketPublic(name);
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

  async getFileStream(bucket: string, key: string, range?: Range): Promise<FileStreamResult> {
    await this.ensureBucket(bucket);

    const stat = await this.minioClient.statObject(bucket, key);

    let stream: NodeJS.ReadableStream;

    if (range) {
      const length = range.end - range.start + 1;
      stream = await this.minioClient.getPartialObject(bucket, key, range.start, length);
    } else {
      stream = await this.minioClient.getObject(bucket, key);
    }

    return {
      stream,
      size: stat.size,
      contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
    };
  }

  getAvatarsBucket(): string {
    return this.avatarsBucket;
  }

  getChatBucketName(chatId: string): string {
    return `polygon-chat-${chatId}`;
  }

  getPublicUrl(bucket: string, key: string): string {
    return `${this.publicEndpoint}/${bucket}/${key}`;
  }

  async putObject(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket(bucket);
    await this.minioClient.putObject(bucket, key, buffer, undefined, { 'Content-Type': mimeType });
  }

  async setBucketPublic(bucket: string): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };
    await this.minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
    this.logger.log(`Bucket ${bucket} set to public`);
  }
}
