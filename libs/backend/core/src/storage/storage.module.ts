import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestMinioModule } from 'nestjs-minio';

import { CoreConfigModule } from '../config/config.module';
import type { Env } from '../config/env.schema';
import { STORAGE_PROVIDER_TOKEN } from './storage-provider.token';
import { MinioStorageProvider } from './minio-storage.provider';

@Module({
  imports: [
    CoreConfigModule,
    NestMinioModule.registerAsync({
      isGlobal: true,
      imports: [CoreConfigModule],
      useFactory: (config: ConfigService<Env, true>) => {
        const rawSsl = config.get<string>('MINIO_USE_SSL');
        return {
          endPoint: config.get<string>('MINIO_ENDPOINT'),
          port: config.get<number>('MINIO_PORT'),
          useSSL: rawSsl === true || rawSsl === 'true' || rawSsl === 1 || rawSsl === '1',
          accessKey: config.get<string>('MINIO_ACCESS_KEY'),
          secretKey: config.get<string>('MINIO_SECRET_KEY'),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    { provide: STORAGE_PROVIDER_TOKEN, useClass: MinioStorageProvider },
  ],
  exports: [STORAGE_PROVIDER_TOKEN],
})
export class CoreStorageModule {}
