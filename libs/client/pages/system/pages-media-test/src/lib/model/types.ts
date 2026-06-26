export interface MediaFile {
  id: string;
  url: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
}

export interface InitUploadResponse {
  fileId: string;
  presignedUrl: string;
}

export interface ConfirmUploadResponse {
  id: string;
  url: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
}
