import { API_ROUTES } from '@org/common';
import { encryptFileBytes } from '@org/crypto-e2ee';
import { authedFetch, frontendLog, queryClient } from '@org/shared';

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

export function getCategoryFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

export async function initChatFileUpload(
  originalName: string,
  mimeType: string,
  size: number,
  chatId?: string,
  category?: string,
): Promise<InitUploadResponse> {
  return authedFetch<InitUploadResponse>(API_ROUTES.media.initUpload, {
    method: 'POST',
    body: JSON.stringify({
      originalName,
      mimeType,
      size,
      chatId,
      category: category ?? getCategoryFromMime(mimeType),
    }),
  });
}

export async function uploadFileToMinio(
  presignedUrl: string,
  file: File | Blob,
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

/** Read blob bytes where `Blob.arrayBuffer` may be missing (jsdom). */
function readBlobBytes(source: Blob): Promise<Uint8Array<ArrayBuffer>> {
  const direct = (source as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof direct === 'function') {
    return direct.call(source).then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
    reader.readAsArrayBuffer(source);
  });
}
export function getChatE2eeEnabled(chatId: string): boolean {
  const chats = queryClient.getQueryData<Array<{ id: string; e2eeEnabled?: boolean }>>(['chats']);
  return chats?.find((chat) => chat.id === chatId)?.e2eeEnabled ?? false;
}

export interface PreparedFileUpload {
  /** Bytes to PUT to MinIO (ciphertext when encrypted). */
  blob: Blob;
  /** Name for init-upload (redacted when encrypted). */
  name: string;
  /** Mime for init-upload (real: the server validates it against the category). */
  mime: string;
  /** Byte size of `blob`. */
  size: number;
  /** Content key — travels inside message envelopes, never to storage. */
  contentKey?: { keyB64: string; ivB64: string };
  encrypted: boolean;
}

/**
 * Prepare a file for upload. In E2EE chats the bytes are AES-GCM encrypted
 * client-side and only ciphertext reaches the server; the original name is
 * redacted (it travels inside message envelopes instead). The real MIME
 * type is still declared: the server validates it against the category,
 * and it reveals nothing beyond the file kind (already visible as category).
 */
export async function prepareFileForUpload(
  source: Blob,
  opts: { name: string; mime: string; e2eeEnabled: boolean },
): Promise<PreparedFileUpload> {
  if (!opts.e2eeEnabled) {
    return {
      blob: source,
      name: opts.name,
      mime: opts.mime || 'application/octet-stream',
      size: source.size,
      encrypted: false,
    };
  }
  const plaintext = await readBlobBytes(source);
  const encrypted = await encryptFileBytes(plaintext);
  frontendLog('debug', 'UploadChatFile', 'file_encrypted_for_upload', {
    hasSize: plaintext.length > 0,
  });
  return {
    blob: new Blob([encrypted.ciphertext as Uint8Array<ArrayBuffer>], {
      type: 'application/octet-stream',
    }),
    name: 'encrypted-file',
    mime: opts.mime || 'application/octet-stream',
    size: encrypted.ciphertext.length,
    contentKey: { keyB64: encrypted.keyB64, ivB64: encrypted.ivB64 },
    encrypted: true,
  };
}

export async function getChatFileUrl(fileId: string): Promise<{ url: string }> {
  return authedFetch<{ url: string }>(API_ROUTES.media.fileUrl(fileId));
}
