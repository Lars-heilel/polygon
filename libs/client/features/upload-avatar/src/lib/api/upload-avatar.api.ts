import { authedFetch } from '@org/shared';
import type { AvatarItem } from '../model/types.js';

interface InitUploadResponse {
  fileId: string;
  presignedUrl: string;
}

interface ConfirmUploadResponse {
  id: string;
  url: string;
  bucket: string;
  key: string;
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
    body: JSON.stringify({ originalName, mimeType, size, category: 'AVATAR' }),
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
  return authedFetch<AvatarItem[]>('media/history?category=AVATAR');
}

export async function fetchUserAvatarHistory(userId: string): Promise<AvatarItem[]> {
  return authedFetch<AvatarItem[]>(`users/${userId}/avatars`);
}

export async function deleteFile(fileId: string): Promise<void> {
  await authedFetch<void>(`media/${fileId}`, { method: 'DELETE' });
}

export async function uploadAvatar(file: File): Promise<AvatarItem> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/media/upload-avatar', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}
