export const chatListKey = (userId: string): string => `chat:list:${userId}`;

export const chatMsgsKey = (chatId: string, cursor: string): string =>
  `chat:msgs:${chatId}:${cursor || 'HEAD'}`;

export const chatUnreadKey = (chatId: string, userId: string): string =>
  `chat:unread:${chatId}:${userId}`;

export const idemKey = (senderId: string, clientId: string): string =>
  `msg:idem:${senderId}:${clientId}`;
