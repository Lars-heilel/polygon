import { authedFetch } from '@org/shared';
import type { ConfirmUploadResponse, InitUploadResponse, MediaFile } from '../model/types';

const BASE = 'media';

export async function initUpload(
  originalName: string,
  mimeType: string,
  size: number,
): Promise<InitUploadResponse> {
  return authedFetch<InitUploadResponse>(`${BASE}/init-upload`, {
    method: 'POST',
    body: JSON.stringify({ originalName, mimeType, size }),
  });
}

export async function uploadToMinio(
  presignedUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

export async function confirmUpload(fileId: string): Promise<ConfirmUploadResponse> {
  return authedFetch<ConfirmUploadResponse>(`${BASE}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  });
}

export async function fetchHistory(): Promise<MediaFile[]> {
  return authedFetch<MediaFile[]>(`${BASE}/history`);
}
