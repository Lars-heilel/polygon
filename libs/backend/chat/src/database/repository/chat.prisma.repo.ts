import { Injectable } from '@nestjs/common';
import {
  CHAT_SELECT_FIELDS,
  CHAT_MEMBER_SELECT_FIELDS,
  MESSAGE_SELECT_FIELDS,
} from '@org/common';
import type { Chat, ChatMember, ChatType, ChatRole, Message } from '@org/common';
import type { IChatRepository, ChatWithPreview } from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatPrismaRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatById(id: string): Promise<Chat | null> {
    return this.prisma.chat.findUnique({ where: { id }, select: CHAT_SELECT_FIELDS });
  }

  async findDirectChatBetween(userId1: string, userId2: string): Promise<Chat | null> {
    return this.prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: userId1 } } },
          { members: { some: { userId: userId2 } } },
          { members: { every: { userId: { in: [userId1, userId2] } } } },
        ],
      },
      select: CHAT_SELECT_FIELDS,
    });
  }

  async findChatsForUser(userId: string): Promise<ChatWithPreview[]> {
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      select: {
        ...CHAT_SELECT_FIELDS,
        members: { select: CHAT_MEMBER_SELECT_FIELDS },
        messages: {
          select: MESSAGE_SELECT_FIELDS,
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map(({ messages, ...chat }) => ({
      ...chat,
      lastMessage: messages[0] ?? null,
    }));
  }

  async createChat(data: { type: ChatType; name?: string | null; avatarUrl?: string | null }): Promise<Chat> {
    return this.prisma.chat.create({ data, select: CHAT_SELECT_FIELDS });
  }

  async deleteChat(id: string): Promise<void> {
    await this.prisma.chat.delete({ where: { id } });
  }

  async findChatMember(chatId: string, userId: string): Promise<ChatMember | null> {
    return this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: CHAT_MEMBER_SELECT_FIELDS,
    });
  }

  async findMembersByChat(chatId: string): Promise<ChatMember[]> {
    return this.prisma.chatMember.findMany({ where: { chatId }, select: CHAT_MEMBER_SELECT_FIELDS });
  }

  async addChatMember(data: { chatId: string; userId: string; role?: ChatRole }): Promise<ChatMember> {
    return this.prisma.chatMember.create({ data, select: CHAT_MEMBER_SELECT_FIELDS });
  }

  async removeChatMember(chatId: string, userId: string): Promise<void> {
    await this.prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId } } });
  }

  async findMessagesByChat(chatId: string, skip: number, take: number): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      select: MESSAGE_SELECT_FIELDS,
    });
  }

  async createMessage(data: { chatId: string; senderId: string; text?: string | null }): Promise<Message> {
    return this.prisma.message.create({ data, select: MESSAGE_SELECT_FIELDS });
  }
}
