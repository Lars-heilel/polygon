import { authedFetch } from '@org/shared';
import type { AvatarItem } from '../model/types';

interface InitUploadResponse {
  fileId: string;
  presignedUrl: string;
}

interface ConfirmUploadResponse {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export async function initUpload(
  originalName: string,
  mimeType: string,
  size: number,
): Promise<InitUploadResponse> {
  return authedFetch<InitUploadResponse>('media/init-upload', {
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
  return authedFetch<ConfirmUploadResponse>('media/confirm', {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  });
}

export async function updateUserProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<void> {
  await authedFetch<void>('users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function fetchHistory(): Promise<AvatarItem[]> {
  return authedFetch<AvatarItem[]>('media/history');
}

export async function deleteFile(fileId: string): Promise<void> {
  await authedFetch<void>(`media/${fileId}`, { method: 'DELETE' });
}
