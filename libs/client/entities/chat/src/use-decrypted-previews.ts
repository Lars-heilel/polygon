import { useEffect, useState } from 'react';

import { type RawMessage, decryptIncomingMessage } from '@org/entities-message';

import { getMessagePreview } from './chat-preview';

export function truncatePreviewText(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

type ChatPreviewSource = {
  id: string;
  lastMessage?: (Partial<RawMessage> & { id: string }) | null;
};

/**
 * Decrypted chat-list previews for E2EE chats. The server `lastMessage`
 * carries envelopes but no plaintext, so the sync `getMessagePreview`
 * falls back to the attachment label. This resolves readable previews
 * wherever the local device holds the keys; everything else keeps the
 * fallback (including undecryptable and keyless states).
 */
export function useDecryptedPreviews<TChat extends ChatPreviewSource>(
  chats: TChat[],
): Record<string, string> {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next: Record<string, string> = {};
      for (const chat of chats) {
        const raw = chat.lastMessage;
        if (!raw || raw.text?.trim() || !raw.envelopes?.length) continue;
        try {
          const decrypted = await decryptIncomingMessage(raw as RawMessage);
          if (!decrypted.undecryptable && decrypted.text?.trim()) {
            next[chat.id] = truncatePreviewText(decrypted.text);
          }
        } catch {
          // Fallback preview stays; retry and delta sync recover later.
        }
      }
      if (alive && Object.keys(next).length > 0) {
        setPreviews((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [chats]);

  return previews;
}

export function previewWithDecryptedFallback(
  chatId: string,
  fallback: string,
  decrypted: Record<string, string>,
): string {
  return decrypted[chatId] ?? fallback;
}
