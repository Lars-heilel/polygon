import type { File } from '@org/common';

export interface IMediaRepository {
  findById(id: string): Promise<File | null>;
  findByUploaderId(uploaderId: string): Promise<File[]>;
  create(data: {
    bucket: string;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string | null;
    uploaderId?: string | null;
    status?: 'PENDING' | 'READY';
    chatId?: string | null;
  }): Promise<File>;
  updateStatus(id: string, status: 'PENDING' | 'READY', url: string): Promise<File>;
  delete(id: string): Promise<void>;
}

export interface FileResponse {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface InitUploadResult {
  fileId: string;
  presignedUrl: string;
}

export interface FileUrlResult {
  url: string;
  expiresIn: number;
}

export interface IMediaService {
  initUpload(
    input: { originalName: string; mimeType: string; size: number; chatId?: string },
    uploaderId?: string,
  ): Promise<InitUploadResult>;
  confirmUpload(fileId: string): Promise<FileResponse>;
  getById(id: string): Promise<FileResponse | null>;
  getFileUrl(id: string): Promise<FileUrlResult>;
  delete(id: string): Promise<{ success: boolean }>;
  getHistory(uploaderId: string): Promise<FileResponse[]>;
}
