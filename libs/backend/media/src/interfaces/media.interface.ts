import type { File, FileCategory } from '@org/common';

export interface IMediaRepository {
  findById(id: string): Promise<File | null>;
  findByUploaderId(uploaderId: string, category?: FileCategory): Promise<File[]>;
  findByChatId(
    chatId: string,
    options?: { uploaderId?: string; category?: FileCategory; take?: number; skip?: number },
  ): Promise<File[]>;
  countByChatId(chatId: string, options?: { category?: FileCategory }): Promise<number>;
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

export interface FileContentResult {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  originalName: string;
  bucket: string;
  key: string;
  size: number;
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
  uploaderId: string | null;
  chatId: string | null;
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

export interface CreateFileInput {
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploaderId: string;
  category: FileCategory;
}

export interface IMediaService {
  initUpload(
    input: UploadInput,
    uploaderId?: string,
  ): Promise<InitUploadResult>;
  confirmUpload(fileId: string): Promise<FileResponse>;
  getById(id: string): Promise<FileResponse | null>;
  getFileUrl(id: string): Promise<FileUrlResult>;
  getFileContent(id: string): Promise<FileContentResult>;
  delete(id: string): Promise<{ success: boolean }>;
  getHistory(uploaderId: string, category?: FileCategory): Promise<FileResponse[]>;
  getChatHistory(
    chatId: string,
    uploaderId: string,
    options?: { category?: FileCategory; take?: number; skip?: number },
  ): Promise<{ files: FileResponse[]; total: number }>;
  create(input: CreateFileInput): Promise<FileResponse>;
}
