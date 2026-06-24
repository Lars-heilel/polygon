import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMinio } from 'nestjs-minio';
import * as Minio from 'minio';

import type { Env } from '../config/env.schema';
import type { IStorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements IStorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private publicBucket: string;
  private privateBucket: string;

  constructor(
    @InjectMinio() private readonly minioClient: Minio.Client,
    config: ConfigService<Env, true>,
  ) {
    this.publicBucket = config.get('MINIO_PUBLIC_BUCKET', { infer: true });
    this.privateBucket = config.get('MINIO_PRIVATE_BUCKET', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket(this.publicBucket);
    await this.ensureBucket(this.privateBucket);
  }

  private async ensureBucket(name: string): Promise<void> {
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

  async getPresignedUrl(bucket: string, key: string, expiresIn = 604800): Promise<string> {
    await this.ensureBucket(bucket);
    return this.minioClient.presignedGetObject(bucket, key, expiresIn);
  }

  async getPresignedPutUrl(bucket: string, key: string, expiresIn = 900): Promise<string> {
    await this.ensureBucket(bucket);
    return this.minioClient.presignedPutObject(bucket, key, expiresIn);
  }
}
