export const CHAT_SELECT_FIELDS = {
  id: true,
  type: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const CHAT_MEMBER_SELECT_FIELDS = {
  chatId: true,
  userId: true,
  role: true,
  joinedAt: true,
} as const;

export const MESSAGE_SELECT_FIELDS = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  createdAt: true,
  updatedAt: true,
} as const;
