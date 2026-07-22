export const CHAT_QUEUE = 'chat_queue';
export const CHAT_CLIENT_TOKEN = 'CHAT_CLIENT';

export const CHAT_PATTERNS = {
  CREATE_DIRECT: 'chat.createDirect',
  CREATE_SELF: 'chat.createSelf',
  GET_CHATS: 'chat.getChats',
  GET_MESSAGES: 'chat.getMessages',
  GET_MEDIA_MESSAGES: 'chat.getMediaMessages',
  SEND_MESSAGE: 'chat.sendMessage',
  EDIT_MESSAGE: 'chat.editMessage',
  DELETE_MESSAGE: 'chat.deleteMessage',
  MARK_READ: 'chat.markRead',
  FORWARD_MESSAGES: 'chat.forwardMessages',
  PREPARE_FORWARD_MESSAGES: 'chat.prepareForwardMessages',
  CLONE_FORWARD_MESSAGES: 'chat.cloneForwardMessages',
  CHECK_MEMBERSHIP: 'chat.checkMembership',
  GET_MEMBERS: 'chat.getMembers',
  GET_MESSAGE_ATTACHMENT_FOR_ACCESS: 'chat.messageAttachment.getForAccess',
} as const;
