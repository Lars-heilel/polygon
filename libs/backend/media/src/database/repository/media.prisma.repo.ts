import { Injectable } from '@nestjs/common';

import type { File, FileCategory } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { IMediaRepository } from '../../interfaces/media.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MediaPrismaRepository implements IMediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<File | null> {
    return this.prisma.file.findUnique({ where: { id } });
  }

  async findByUploaderId(uploaderId: string, category?: FileCategory): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        uploaderId,
        status: 'READY',
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByChatId(chatId: string, uploaderId?: string): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        chatId,
        status: 'READY',
        ...(uploaderId ? { uploaderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    bucket: string;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string | null;
    uploaderId?: string | null;
    status?: 'PENDING' | 'READY';
    chatId?: string | null;
    category: FileCategory;
  }): Promise<File> {
    try {
      return await this.prisma.file.create({
        data: {
          bucket: data.bucket,
          key: data.key,
          originalName: data.originalName,
          mimeType: data.mimeType,
          size: data.size,
          url: data.url ?? null,
          uploaderId: data.uploaderId ?? null,
          status: data.status ?? 'PENDING',
          chatId: data.chatId ?? null,
          category: data.category,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateStatus(id: string, status: 'PENDING' | 'READY', url: string): Promise<File> {
    try {
      return await this.prisma.file.update({
        where: { id },
        data: { status, url },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.file.delete({ where: { id } });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
