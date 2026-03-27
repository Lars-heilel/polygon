import { Injectable } from '@nestjs/common';
import { ChatRole, ChatType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  //chats
  async findChatById(id: string) {
    return this.prisma.chat.findUnique({ where: { id } });
  }

  async findDirectChatBetween(userId1: string, userId2: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        type: ChatType.DIRECT,
        members: { some: { userId: userId1 } },
      },
      include: { members: true },
    });
    return (
      chats.find(
        (c) =>
          c.members.length === 2 && c.members.some((m) => m.userId === userId2)
      ) ?? null
    );
  }

  async findChatsForUser(userId: string) {
    return this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
  }) {
    return this.prisma.chat.create({ data });
  }

  async deleteChat(id: string) {
    return this.prisma.chat.delete({ where: { id } });
  }

  //members

  async findChatMember(chatId: string, userId: string) {
    return this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  async findMembersByChat(chatId: string) {
    return this.prisma.chatMember.findMany({ where: { chatId } });
  }

  async addChatMember(data: {
    chatId: string;
    userId: string;
    role?: ChatRole;
  }) {
    return this.prisma.chatMember.create({ data });
  }

  async removeChatMember(chatId: string, userId: string) {
    return this.prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  //message

  async findMessagesByChat(chatId: string, skip = 0, take = 50) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async createMessage(data: {
    chatId: string;
    senderId: string;
    text?: string | null;
  }) {
    return this.prisma.message.create({ data });
  }
}
