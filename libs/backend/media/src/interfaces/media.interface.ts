import type { File, FileCategory } from '@org/common';

export interface IMediaRepository {
  findById(id: string): Promise<File | null>;
  findByUploaderId(uploaderId: string, category?: FileCategory): Promise<File[]>;
  findByChatId(chatId: string, uploaderId?: string): Promise<File[]>;
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
    category: FileCategory;
  }): Promise<File>;
  updateStatus(id: string, status: 'PENDING' | 'READY', url: string): Promise<File>;
  delete(id: string): Promise<void>;
}

export interface FileResponse {
  id: string;
  url: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
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

export interface UploadInput {
  originalName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  chatId?: string;
}

export interface IMediaService {
  initUpload(
    input: UploadInput,
    uploaderId?: string,
  ): Promise<InitUploadResult>;
  confirmUpload(fileId: string): Promise<FileResponse>;
  getById(id: string): Promise<FileResponse | null>;
  getFileUrl(id: string): Promise<FileUrlResult>;
  delete(id: string): Promise<{ success: boolean }>;
  getHistory(uploaderId: string, category?: FileCategory): Promise<FileResponse[]>;
  getChatHistory(chatId: string, uploaderId: string): Promise<FileResponse[]>;
}
