import { useEffect, useState } from 'react';

import { decryptFileBytes } from '@org/crypto-e2ee';
import { frontendLog } from '@org/shared';

import type { Message } from '../message.types.js';

/**
 * Resolves a playable/downloadable URL for message media. Legacy
 * (non-encrypted) media returns the server content URL as-is. Encrypted
 * media (fileKeys attached at decrypt) is fetched as ciphertext, decrypted
 * with the envelope key, and exposed as a revoked-on-unmount blob URL —
 * ciphertext bytes never reach a renderer. Also overrides the redacted
 * server snapshots (name/mime) with the envelope values.
 */
export function useDecryptedMessageMedia(message: Message): {
  message: Message;
  isLoading: boolean;
} {
  const entry =
    message.fileKeys?.find((key) => message.media && key.mediaId === message.media.fileId) ?? null;
  const contentUrl = message.media?.contentUrl ?? '';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!entry || !contentUrl) return;
    let alive = true;
    let url: string | null = null;
    fetch(contentUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Media fetch failed: ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      })
      .then(async (ciphertext) => decryptFileBytes(ciphertext, entry.key, entry.iv))
      .then((plaintext) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([plaintext], { type: entry.mime }));
        setBlobUrl(url);
      })
      .catch(() => {
        if (alive) {
          frontendLog('warn', 'DecryptedMedia', 'media_decrypt_failed', {
            hasChatId: !!message.chatId,
            hasMessageId: !!message.id,
          });
          setFailed(true);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // entry identity is stable per message render; contentUrl likewise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.key, entry?.iv, entry?.mediaId, contentUrl]);

  if (!entry) return { message, isLoading: false };
  if (!blobUrl) return { message, isLoading: !failed };
  const media = message.media;
  if (!media) return { message, isLoading: false };
  return {
    message: {
      ...message,
      media: { ...media, contentUrl: blobUrl, fileName: entry.fileName, mime: entry.mime },
    },
    isLoading: false,
  };
}
