import type {
  EnvelopeFileKey,
  GroupMessageEnvelope,
  MessageEnvelope,
  MessageType,
} from '@org/common';

export type MessageKind =
  | 'text'
  | 'markdown'
  | 'image'
  | 'video'
  | 'circle'
  | 'audio'
  | 'voice'
  | 'file'
  | 'link_preview'
  | 'system';

export type LocalMessageStatus = 'sending' | 'sent' | 'error';

export type MessageMediaCategory = 'IMAGE' | 'VIDEO' | 'CIRCLE' | 'AUDIO' | 'VOICE' | 'FILE';

export interface MessageMedia {
  fileId: string;
  contentUrl: string;
  thumbUrl: string | null;
  fileName: string | null;
  mime: string | null;
  size: number | null;
  category: MessageMediaCategory;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[] | null;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: MessageMediaCategory;
  createdAt: string;
}

export interface RawMessageAttachment {
  id: string;
  messageId: string;
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: string;
  createdAt: string;
}

export interface RawMessageForwardContext {
  messageId: string;
  originalMessageId: string | null;
  originalChatId: string | null;
  originalAuthorId: string;
  originalAuthorNameSnapshot: string;
  originalAuthorDisplayNameSnapshot: string | null;
  originalMessageCreatedAt: string;
  originalMessageType: MessageType | string;
  originalTextPreview: string | null;
  originalFileNamePreview: string | null;
  snapshotVersion: number;
  createdAt: string;
}

export interface MessageForwardContext {
  originalAuthor: {
    id: string;
    nameSnapshot: string;
    displayNameSnapshot: string | null;
  };
  originalMessageCreatedAt: string;
  originalMessageType: MessageType | string;
  preview: {
    text: string | null;
    fileName: string | null;
  };
}

export interface LinkPreview {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface RawMessage {
  id: string;
  clientId?: string | null;
  chatId: string;
  senderId: string;
  type: MessageType | string;
  text: string | null;
  hasLink?: boolean | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedById: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: RawMessageAttachment[];
  forwardContext?: RawMessageForwardContext | null;
  media?: MessageMedia | null;
  linkPreview?: LinkPreview | null;
  envelopes?: Array<MessageEnvelope | GroupMessageEnvelope> | null;
}

export interface Message {
  id: string;
  clientId: string | null;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  type: MessageType | string;
  text: string | null;
  hasLink: boolean;
  createdAt: string;
  updatedAt: string;
  media: MessageMedia | null;
  linkPreview: LinkPreview | null;
  attachments: MessageAttachment[];
  forwardContext: MessageForwardContext | null;
  localStatus?: LocalMessageStatus;
  undecryptable?: boolean;
  /**
   * Raw server payload kept only on undecryptable envelope messages so the
   * «Не удалось расшифровать» retry action can re-run key-fetch + decrypt.
   * Never persisted for decryptable messages.
   */
  raw?: RawMessage | null;
  /**
   * Per-file content keys recovered from the decrypted envelope that
   * addressed this device. Present only on messages whose attachments are
   * stored as ciphertext — the media renderer decrypts through these.
   */
  fileKeys?: EnvelopeFileKey[];
  editedAt: string | null;
  deletedAt: string | null;
  deletedById: string | null;
}

export interface RawMessagePage {
  messages: RawMessage[];
  nextCursor: string | null;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}
