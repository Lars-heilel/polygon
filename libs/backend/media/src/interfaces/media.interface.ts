import type { File } from '@org/common';

export interface IMediaRepository {
  findById(id: string): Promise<File | null>;
  create(data: {
    bucket: string;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploaderId?: string | null;
  }): Promise<File>;
  delete(id: string): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IMediaService {}
