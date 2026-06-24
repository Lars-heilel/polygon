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
}
