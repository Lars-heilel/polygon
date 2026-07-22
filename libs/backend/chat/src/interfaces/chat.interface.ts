import type {
  Chat,
  ChatMediaFilter,
  ChatMember,
  ChatRole,
  ChatType,
  Message,
  MessagePage,
  MessageType,
} from '@org/common';

export type ChatWithPreview = Chat & {
  members: ChatMember[];
  lastMessage: Message | null;
  unreadCount: number;
};

export interface CreateMessageData {
  chatId: string;
  clientId?: string | null;
  senderId: string;
  type?: MessageType;
  text?: string | null;
  fileId?: string | null;
  fileBucket?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  fileCategory?: string | null;
  forwardedFromId?: string | null;
}

export interface ForwardMessagesData {
  sourceChatId: string;
  targetChatId: string;
  messageIds: string[];
  userId: string;
}

export interface IChatRepository {
  findChatById(id: string): Promise<Chat | null>;
  findDirectChatBetween(userId1: string, userId2: string): Promise<Chat | null>;
  findSelfChat(userId: string): Promise<Chat | null>;
  createSelfChat(userId: string): Promise<Chat>;
  findChatsForUser(userId: string): Promise<ChatWithPreview[]>;
  createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
    selfOwnerId?: string | null;
  }): Promise<Chat>;
  deleteChat(id: string): Promise<void>;
  findChatMember(chatId: string, userId: string): Promise<ChatMember | null>;
  findMembersByChat(chatId: string): Promise<ChatMember[]>;
  addChatMember(data: { chatId: string; userId: string; role?: ChatRole }): Promise<ChatMember>;
  removeChatMember(chatId: string, userId: string): Promise<void>;
  findMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
    userId: string,
  ): Promise<MessagePage>;
  findMediaMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
    filter: ChatMediaFilter,
    userId: string,
  ): Promise<MessagePage>;
  findMessageById(id: string): Promise<Message | null>;
  createMessage(data: CreateMessageData): Promise<Message>;
  updateMessageText(messageId: string, text: string): Promise<Message>;
  deleteMessageForEveryone(messageId: string, userId: string): Promise<Message>;
  hideMessageForUser(messageId: string, userId: string): Promise<void>;
  createMessagesMany(data: CreateMessageData[]): Promise<number>;
  countUnreadMessages(
    chatId: string,
    userId: string,
    lastReadAt?: Date | null,
    lastReadMessageId?: string | null,
  ): Promise<number>;
  markChatRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
}

export interface IChatService {
  createDirectChat(userId: string, targetUserId: string): Promise<Chat>;
  createSelfChat(userId: string): Promise<Chat>;
  getChats(userId: string): Promise<ChatWithPreview[]>;
  getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<MessagePage>;
  getMediaMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
    filter: ChatMediaFilter,
  ): Promise<MessagePage>;
  sendMessage(
    chatId: string,
    senderId: string,
    input: {
      clientId?: string | null;
      type: string;
      text?: string | null;
      fileId?: string | null;
      fileBucket?: string | null;
      fileKey?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      fileMime?: string | null;
      fileCategory?: string | null;
    },
  ): Promise<Message>;
  editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message>;
  deleteMessage(
    chatId: string,
    messageId: string,
    userId: string,
    mode: 'ME' | 'EVERYONE',
  ): Promise<Message | { id: string; chatId: string }>;
  forwardMessages(data: ForwardMessagesData): Promise<Message[]>;
  markRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
  checkMembership(chatId: string, userId: string): Promise<boolean>;
  getMembers(chatId: string): Promise<{ userId: string }[]>;
}

export interface IChatController {
  createDirect(payload: { userId: string; targetUserId: string }): Promise<Chat>;
  createSelf(payload: { userId: string }): Promise<Chat>;
  getChats(payload: { userId: string }): Promise<ChatWithPreview[]>;
  getMessages(payload: {
    chatId: string;
    userId: string;
    cursor?: string;
    take?: number;
  }): Promise<MessagePage>;
  getMediaMessages(payload: {
    chatId: string;
    userId: string;
    cursor?: string;
    take?: number;
    filter: ChatMediaFilter;
  }): Promise<MessagePage>;
  sendMessage(payload: {
    chatId: string;
    clientId?: string | null;
    senderId: string;
    type: string;
    text?: string | null;
    fileId?: string | null;
    fileBucket?: string | null;
    fileKey?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    fileMime?: string | null;
    fileCategory?: string | null;
  }): Promise<Message>;
  forwardMessages(payload: ForwardMessagesData): Promise<Message[]>;
  markRead(payload: { chatId: string; userId: string; messageId?: string | null }): Promise<ChatMember>;
  checkMembership(payload: { chatId: string; userId: string }): Promise<boolean>;
  getMembers(payload: { chatId: string }): Promise<{ userId: string }[]>;
}
