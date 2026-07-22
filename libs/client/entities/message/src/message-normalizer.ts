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
  const normalizedRaw = normalizeAttachmentFields(raw);
  const media = normalizedRaw.media ?? buildLegacyMedia(normalizedRaw);
  return {
    ...normalizedRaw,
    clientId: normalizedRaw.clientId ?? null,
    editedAt: normalizedRaw.editedAt ?? null,
    deletedAt: normalizedRaw.deletedAt ?? null,
    deletedById: normalizedRaw.deletedById ?? null,
    forwardedFromSenderId: normalizedRaw.forwardedFromSenderId ?? null,
    forwardedFromCreatedAt: normalizedRaw.forwardedFromCreatedAt ?? null,
    forwardedFromType: normalizedRaw.forwardedFromType ?? null,
    forwardedFromText: normalizedRaw.forwardedFromText ?? null,
    forwardedFromFileName: normalizedRaw.forwardedFromFileName ?? null,
    forwardedFromSender: normalizedRaw.forwardedFromSender ?? null,
    kind: resolveKind(normalizedRaw, media),
    media,
    linkPreview: normalizedRaw.linkPreview ?? null,
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

type RawMessageAttachment = {
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: string;
};

type RawMessageWithAttachments = RawMessage & {
  attachments?: RawMessageAttachment[];
};

function normalizeAttachmentFields(raw: RawMessage): RawMessage {
  const attachment = (raw as RawMessageWithAttachments).attachments?.[0];
  if (!attachment) return raw;

  return {
    ...raw,
    fileId: attachment.mediaId,
    fileName: attachment.fileNameSnapshot,
    fileSize: attachment.fileSizeSnapshot,
    fileMime: attachment.mimeSnapshot,
    fileCategory: attachment.category,
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
