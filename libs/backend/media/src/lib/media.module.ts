import { Module } from '@nestjs/common';

import {
  CoreConfigModule,
  CoreStorageModule,
  MEDIA_PRISMA_REPOSITORY_TOKEN,
  MEDIA_SERVICE_TOKEN,
  STORAGE_PROVIDER_TOKEN,
} from '@org/core';

import { MediaController } from '../controllers/media.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { MediaPrismaRepository } from '../database/repository/media.prisma.repo';
import { MinioProvider } from '../providers/minio.provider';
import { MediaService } from '../services/media.service';

@Module({
  imports: [CoreConfigModule, CoreStorageModule],
  controllers: [MediaController],
  providers: [
    PrismaService,
    { provide: MEDIA_PRISMA_REPOSITORY_TOKEN, useClass: MediaPrismaRepository },
    { provide: MEDIA_SERVICE_TOKEN, useClass: MediaService },
    { provide: STORAGE_PROVIDER_TOKEN, useClass: MinioProvider },
  ],
  exports: [PrismaService],
})
export class OrgMediaModule {}
