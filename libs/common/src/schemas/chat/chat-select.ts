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

export const MESSAGE_SELECT_FIELDS = {
  id: true,
  clientId: true,
  chatId: true,
  senderId: true,
  type: true,
  text: true,
  fileId: true,
  fileBucket: true,
  fileKey: true,
  fileName: true,
  fileSize: true,
  fileMime: true,
  fileCategory: true,
  forwardedFromId: true,
  editedAt: true,
  deletedAt: true,
  deletedById: true,
  createdAt: true,
  updatedAt: true,
} as const;
