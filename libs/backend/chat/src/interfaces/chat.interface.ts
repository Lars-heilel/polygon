import type { Chat, ChatMember, ChatRole, ChatType, Message } from '@org/common';

export type ChatWithPreview = Chat & {
  members: ChatMember[];
  lastMessage: Message | null;
};

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
  findMessagesByChat(chatId: string, skip: number, take: number): Promise<Message[]>;
  createMessage(data: { chatId: string; senderId: string; text?: string | null }): Promise<Message>;
}

export interface IChatService {
  createDirectChat(userId: string, targetUserId: string): Promise<Chat>;
  getChats(userId: string): Promise<ChatWithPreview[]>;
  getMessages(chatId: string, userId: string, skip: number, take: number): Promise<Message[]>;
  sendMessage(chatId: string, senderId: string, text: string): Promise<Message>;
  checkMembership(chatId: string, userId: string): Promise<boolean>;
}

export interface IChatController {
  createDirect(payload: { userId: string; targetUserId: string }): Promise<Chat>;
  getChats(payload: { userId: string }): Promise<ChatWithPreview[]>;
  getMessages(payload: {
    chatId: string;
    userId: string;
    skip?: number;
    take?: number;
  }): Promise<Message[]>;
  sendMessage(payload: { chatId: string; senderId: string; text: string }): Promise<Message>;
  checkMembership(payload: { chatId: string; userId: string }): Promise<boolean>;
}
