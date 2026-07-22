import type {
  Message,
  MessageAttachment,
  MessageForwardContext,
  MessageKind,
  MessageMedia,
  MessageMediaCategory,
  MessagePage,
  RawMessageAttachment,
  RawMessage,
  RawMessagePage,
} from './message.types.js';

const mediaCategories = new Set(['IMAGE', 'VIDEO', 'CIRCLE', 'AUDIO', 'VOICE', 'FILE']);

export function normalizeMessage(raw: RawMessage): Message {
  const attachments = normalizeAttachments(raw.attachments ?? []);
  const forwardContext = normalizeForwardContext(raw.forwardContext ?? null);
  const media = raw.media ?? buildAttachmentMedia(raw, attachments[0]);
  return {
    ...raw,
    clientId: raw.clientId ?? null,
    editedAt: raw.editedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    deletedById: raw.deletedById ?? null,
    attachments,
    forwardContext,
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

function buildAttachmentMedia(
  raw: RawMessage,
  attachment: MessageAttachment | undefined,
): MessageMedia | null {
  if (!attachment) return null;

  return {
    fileId: attachment.mediaId,
    contentUrl: `/api/chats/${raw.chatId}/messages/${raw.id}/attachments/${attachment.id}/content`,
    thumbUrl: null,
    fileName: attachment.fileNameSnapshot,
    mime: attachment.mimeSnapshot,
    size: attachment.fileSizeSnapshot,
    category: attachment.category,
    width: null,
    height: null,
    durationMs: null,
    waveform: null,
  };
}

function normalizeAttachments(attachments: RawMessageAttachment[]): MessageAttachment[] {
  return attachments.flatMap((attachment) => {
    const category = normalizeCategory(attachment.category);
    if (!category) return [];

    return [{
      ...attachment,
      category,
    }];
  });
}

function normalizeForwardContext(
  forwardContext: RawMessage['forwardContext'] | null,
): MessageForwardContext | null {
  if (!forwardContext) return null;

  return {
    originalAuthor: {
      id: forwardContext.originalAuthorId,
      nameSnapshot: forwardContext.originalAuthorNameSnapshot,
      displayNameSnapshot: forwardContext.originalAuthorDisplayNameSnapshot,
    },
    originalMessageCreatedAt: forwardContext.originalMessageCreatedAt,
    originalMessageType: forwardContext.originalMessageType,
    preview: {
      text: forwardContext.originalTextPreview,
      fileName: forwardContext.originalFileNamePreview,
    },
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
