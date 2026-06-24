import { Module } from '@nestjs/common';

import {
  CoreConfigModule,
  CoreStorageModule,
  MEDIA_PRISMA_REPOSITORY_TOKEN,
  MEDIA_SERVICE_TOKEN,
} from '@org/core';

import { MediaController } from '../controllers/media.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { MediaPrismaRepository } from '../database/repository/media.prisma.repo';
import { MediaService } from '../services/media.service';

@Module({
  imports: [CoreConfigModule, CoreStorageModule],
  controllers: [MediaController],
  providers: [
    PrismaService,
    { provide: MEDIA_PRISMA_REPOSITORY_TOKEN, useClass: MediaPrismaRepository },
    { provide: MEDIA_SERVICE_TOKEN, useClass: MediaService },
  ],
  exports: [PrismaService],
})
export class OrgMediaModule {}
