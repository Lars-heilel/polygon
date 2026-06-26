import { Injectable } from '@nestjs/common';
import { CHAT_MEMBER_SELECT_FIELDS, CHAT_SELECT_FIELDS, MESSAGE_SELECT_FIELDS } from '@org/common';
import type { Chat, ChatMember, ChatRole, ChatType, Message, MessagePage } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { ChatWithPreview, CreateMessageData, IChatRepository } from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatPrismaRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatById(id: string): Promise<Chat | null> {
    return this.prisma.chat.findUnique({
      where: { id },
      select: CHAT_SELECT_FIELDS,
    });
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

  async createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<Chat> {
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
    return this.prisma.chatMember.findMany({
      where: { chatId },
      select: CHAT_MEMBER_SELECT_FIELDS,
    });
  }

  async addChatMember(data: {
    chatId: string;
    userId: string;
    role?: ChatRole;
  }): Promise<ChatMember> {
    try {
      return await this.prisma.chatMember.create({
        data,
        select: CHAT_MEMBER_SELECT_FIELDS,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async removeChatMember(chatId: string, userId: string): Promise<void> {
    try {
      await this.prisma.chatMember.delete({
        where: { chatId_userId: { chatId, userId } },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<MessagePage> {
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
      select: MESSAGE_SELECT_FIELDS,
    });

    return {
      messages: messages.reverse(),
      nextCursor: messages.length === take ? messages[0].id : null,
    };
  }

  async findMessageById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
      select: MESSAGE_SELECT_FIELDS,
    });
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    try {
      return await this.prisma.message.create({
        data: {
          chatId: data.chatId,
          senderId: data.senderId,
          type: data.type ?? 'TEXT',
          text: data.text ?? null,
          fileId: data.fileId ?? null,
          fileBucket: data.fileBucket ?? null,
          fileKey: data.fileKey ?? null,
          fileName: data.fileName ?? null,
          fileSize: data.fileSize ?? null,
          fileMime: data.fileMime ?? null,
          fileCategory: data.fileCategory ?? null,
          forwardedFromId: data.forwardedFromId ?? null,
        },
        select: MESSAGE_SELECT_FIELDS,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async createMessagesMany(data: CreateMessageData[]): Promise<number> {
    try {
      const result = await this.prisma.message.createMany({
        data: data.map((d) => ({
          chatId: d.chatId,
          senderId: d.senderId,
          type: d.type ?? 'TEXT',
          text: d.text ?? null,
          fileId: d.fileId ?? null,
          fileBucket: d.fileBucket ?? null,
          fileKey: d.fileKey ?? null,
          fileName: d.fileName ?? null,
          fileSize: d.fileSize ?? null,
          fileMime: d.fileMime ?? null,
          fileCategory: d.fileCategory ?? null,
          forwardedFromId: d.forwardedFromId ?? null,
        })),
      });
      return result.count;
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
