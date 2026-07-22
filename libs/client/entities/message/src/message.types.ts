import type { MessageType } from '@org/common';

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
  fileId: string | null;
  fileBucket: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  fileCategory: string | null;
  forwardedFromId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedById: string | null;
  createdAt: string;
  updatedAt: string;
  media?: MessageMedia | null;
  linkPreview?: LinkPreview | null;
}

export interface Message {
  id: string;
  clientId: string | null;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  type: MessageType | string;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  media: MessageMedia | null;
  linkPreview: LinkPreview | null;
  localStatus?: LocalMessageStatus;
  fileId: string | null;
  fileBucket: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  fileCategory: string | null;
  forwardedFromId: string | null;
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
