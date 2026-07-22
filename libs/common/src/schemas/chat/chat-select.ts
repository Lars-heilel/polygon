export const CHAT_SELECT_FIELDS = {
  id: true,
  type: true,
  name: true,
  avatarUrl: true,
  selfOwnerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const CHAT_MEMBER_SELECT_FIELDS = {
  chatId: true,
  userId: true,
  role: true,
  joinedAt: true,
  lastReadMessageId: true,
  lastReadAt: true,
} as const;

export const MESSAGE_ATTACHMENT_SELECT_FIELDS = {
  id: true,
  messageId: true,
  mediaId: true,
  fileNameSnapshot: true,
  fileSizeSnapshot: true,
  mimeSnapshot: true,
  category: true,
  createdAt: true,
} as const;

export const MESSAGE_FORWARD_CONTEXT_SELECT_FIELDS = {
  messageId: true,
  originalMessageId: true,
  originalChatId: true,
  originalAuthorId: true,
  originalAuthorNameSnapshot: true,
  originalAuthorDisplayNameSnapshot: true,
  originalMessageCreatedAt: true,
  originalMessageType: true,
  originalTextPreview: true,
  originalFileNamePreview: true,
  snapshotVersion: true,
  createdAt: true,
} as const;

export const MESSAGE_SELECT_FIELDS = {
  id: true,
  clientId: true,
  chatId: true,
  senderId: true,
  type: true,
  text: true,
  editedAt: true,
  deletedAt: true,
  deletedById: true,
  attachments: { select: MESSAGE_ATTACHMENT_SELECT_FIELDS },
  forwardContext: { select: MESSAGE_FORWARD_CONTEXT_SELECT_FIELDS },
  createdAt: true,
  updatedAt: true,
} as const;
