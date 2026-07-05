import type { Chat, ChatMember, ChatRole, ChatType, Message, MessagePage, MessageType } from '@org/common';

export type ChatWithPreview = Chat & {
  members: ChatMember[];
  lastMessage: Message | null;
};

export interface CreateMessageData {
  chatId: string;
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
  findChatsForUser(userId: string): Promise<ChatWithPreview[]>;
  createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
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
  ): Promise<MessagePage>;
  findMessageById(id: string): Promise<Message | null>;
  createMessage(data: CreateMessageData): Promise<Message>;
  createMessagesMany(data: CreateMessageData[]): Promise<number>;
}

export interface IChatService {
  createDirectChat(userId: string, targetUserId: string): Promise<Chat>;
  getChats(userId: string): Promise<ChatWithPreview[]>;
  getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<MessagePage>;
  sendMessage(
    chatId: string,
    senderId: string,
    input: {
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
  forwardMessages(data: ForwardMessagesData): Promise<Message[]>;
  checkMembership(chatId: string, userId: string): Promise<boolean>;
  getMembers(chatId: string): Promise<{ userId: string }[]>;
}

export interface IChatController {
  createDirect(payload: { userId: string; targetUserId: string }): Promise<Chat>;
  getChats(payload: { userId: string }): Promise<ChatWithPreview[]>;
  getMessages(payload: {
    chatId: string;
    userId: string;
    cursor?: string;
    take?: number;
  }): Promise<MessagePage>;
  sendMessage(payload: {
    chatId: string;
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
  checkMembership(payload: { chatId: string; userId: string }): Promise<boolean>;
  getMembers(payload: { chatId: string }): Promise<{ userId: string }[]>;
}
