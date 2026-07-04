export interface UploadResult {
  bucket: string;
  key: string;
  url: string;
}

export interface IStorageProvider {
  upload(bucket: string, key: string, file: Buffer, mimeType: string): Promise<UploadResult>;
  delete(bucket: string, key: string): Promise<void>;
  getPresignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getPresignedPutUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
  getFileStream(bucket: string, key: string): Promise<NodeJS.ReadableStream>;
  ensureBucket(name: string): Promise<void>;
  getAvatarsBucket(): string;
  getChatBucketName(chatId: string): string;
  getPublicUrl(bucket: string, key: string): string;
  putObject(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<void>;
  setBucketPublic(bucket: string): Promise<void>;
}
