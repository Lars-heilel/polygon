import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  // === Chat методы ===

  async findChatById(id: string): Promise<Chat | null> {
    return this.prisma.chat.findUnique({ where: { id } });
  }

  async findChatsByType(type: ChatType): Promise<Chat[]> {
    return this.prisma.chat.findMany({ where: { type } });
  }

  async findAllChats(): Promise<Chat[]> {
    return this.prisma.chat.findMany();
  }

  async createChat(data: {
    id?: string;
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<Chat> {
    return this.prisma.chat.create({ data });
  }

  async updateChat(id: string, data: {
    type?: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<Chat> {
    return this.prisma.chat.update({ where: { id }, data });
  }

  async deleteChat(id: string): Promise<Chat> {
    return this.prisma.chat.delete({ where: { id } });
  }

  // === ChatMember методы ===

  async findChatMember(chatId: string, userId: string): Promise<ChatMember | null> {
    return this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  async findMembersByChat(chatId: string): Promise<ChatMember[]> {
    return this.prisma.chatMember.findMany({ where: { chatId } });
  }

  async findChatsByUser(userId: string): Promise<ChatMember[]> {
    return this.prisma.chatMember.findMany({ where: { userId } });
  }

  async addChatMember(data: {
    chatId: string;
    userId: string;
    role?: ChatRole;
  }): Promise<ChatMember> {
    return this.prisma.chatMember.create({ data });
  }

  async updateChatMember(chatId: string, userId: string, data: {
    role?: ChatRole;
  }): Promise<ChatMember> {
    return this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data,
    });
  }

  async removeChatMember(chatId: string, userId: string): Promise<ChatMember> {
    return this.prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  // === Message методы ===

  async findMessageById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async findMessagesByChat(chatId: string, skip?: number, take?: number): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async findMessagesBySender(senderId: string): Promise<Message[]> {
    return this.prisma.message.findMany({ where: { senderId } });
  }

  async createMessage(data: {
    id?: string;
    chatId: string;
    senderId: string;
    text?: string | null;
  }): Promise<Message> {
    return this.prisma.message.create({ data });
  }

  async updateMessage(id: string, data: {
    text?: string | null;
  }): Promise<Message> {
    return this.prisma.message.update({ where: { id }, data });
  }

  async deleteMessage(id: string): Promise<Message> {
    return this.prisma.message.delete({ where: { id } });
  }

  async deleteMessagesByChat(chatId: string): Promise<number> {
    const result = await this.prisma.message.deleteMany({ where: { chatId } });
    return result.count;
  }
}
