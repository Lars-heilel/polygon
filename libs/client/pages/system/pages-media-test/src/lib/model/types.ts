export interface MediaFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface InitUploadResponse {
  fileId: string;
  presignedUrl: string;
}

export interface ConfirmUploadResponse {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
