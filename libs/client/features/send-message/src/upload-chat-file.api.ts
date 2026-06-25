import { API_ROUTES } from '@org/common';
import { authedFetch } from '@org/shared';

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

export async function initChatFileUpload(
  originalName: string,
  mimeType: string,
  size: number,
  chatId?: string,
): Promise<InitUploadResponse> {
  return authedFetch<InitUploadResponse>(API_ROUTES.media.initUpload, {
    method: 'POST',
    body: JSON.stringify({ originalName, mimeType, size, chatId }),
  });
}

export async function uploadFileToMinio(
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

export async function confirmChatFileUpload(fileId: string): Promise<ConfirmUploadResponse> {
  return authedFetch<ConfirmUploadResponse>(API_ROUTES.media.confirm, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  });
}

export async function getChatFileUrl(fileId: string): Promise<{ url: string }> {
  return authedFetch<{ url: string }>(API_ROUTES.media.fileUrl(fileId));
}
