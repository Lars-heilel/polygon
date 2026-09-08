export const chatListKey = (userId: string): string => `chat:list:${userId}`;

export const chatMsgsKey = (
  chatId: string,
  cursor: string,
  userId?: string,
  take?: number | string,
): string => {
  const normalizedCursor = cursor || 'HEAD';
  if (userId === undefined && take === undefined) return `chat:msgs:${chatId}:${normalizedCursor}`;
  return `chat:msgs:${chatId}:${userId ?? '-'}:${normalizedCursor}:${take ?? '-'}`;
};

export const chatUnreadKey = (chatId: string, userId: string): string =>
  `chat:unread:${chatId}:${userId}`;

export const idemKey = (senderId: string, clientId: string): string =>
  `msg:idem:${senderId}:${clientId}`;
