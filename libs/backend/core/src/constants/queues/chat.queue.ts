export const CHAT_QUEUE = 'chat_queue';
export const CHAT_CLIENT_TOKEN = 'CHAT_CLIENT';

export const CHAT_PATTERNS = {
  CREATE_DIRECT: 'chat.createDirect',
  GET_CHATS: 'chat.getChats',
  GET_MESSAGES: 'chat.getMessages',
  SEND_MESSAGE: 'chat.sendMessage',
  FORWARD_MESSAGES: 'chat.forwardMessages',
  CHECK_MEMBERSHIP: 'chat.checkMembership',
} as const;
