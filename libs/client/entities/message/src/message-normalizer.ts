import type {
  Message,
  MessageKind,
  MessageMedia,
  MessageMediaCategory,
  MessagePage,
  RawMessage,
  RawMessagePage,
} from './message.types.js';

const mediaCategories = new Set(['IMAGE', 'VIDEO', 'CIRCLE', 'AUDIO', 'VOICE', 'FILE']);

export function normalizeMessage(raw: RawMessage): Message {
  const media = raw.media ?? buildLegacyMedia(raw);
  return {
    ...raw,
    clientId: raw.clientId ?? null,
    editedAt: raw.editedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    deletedById: raw.deletedById ?? null,
    forwardedFromSenderId: raw.forwardedFromSenderId ?? null,
    forwardedFromCreatedAt: raw.forwardedFromCreatedAt ?? null,
    forwardedFromSender: raw.forwardedFromSender ?? null,
    kind: resolveKind(raw, media),
    media,
    linkPreview: raw.linkPreview ?? null,
  };
}

export function normalizeMessagePage(raw: RawMessagePage): MessagePage {
  return {
    messages: raw.messages.map(normalizeMessage),
    nextCursor: raw.nextCursor,
  };
}

function buildLegacyMedia(raw: RawMessage): MessageMedia | null {
  if (!raw.fileId) return null;

  const category = normalizeCategory(raw.fileCategory);
  if (!category) return null;

  return {
    fileId: raw.fileId,
    contentUrl: `/api/media/files/${raw.fileId}/content`,
    thumbUrl: null,
    fileName: raw.fileName,
    mime: raw.fileMime,
    size: raw.fileSize,
    category,
    width: null,
    height: null,
    durationMs: null,
    waveform: null,
  };
}

function normalizeCategory(category: string | null): MessageMediaCategory | null {
  if (!category || !mediaCategories.has(category)) return null;
  return category as MessageMediaCategory;
}

function resolveKind(raw: RawMessage, media: MessageMedia | null): MessageKind {
  if (media) {
    switch (media.category) {
      case 'IMAGE':
        return 'image';
      case 'VIDEO':
        return 'video';
      case 'CIRCLE':
        return 'circle';
      case 'AUDIO':
        return 'audio';
      case 'VOICE':
        return 'voice';
      case 'FILE':
        return 'file';
    }
  }

  if (raw.linkPreview) return 'link_preview';
  if (raw.type === 'SYSTEM') return 'system';
  return 'text';
}
