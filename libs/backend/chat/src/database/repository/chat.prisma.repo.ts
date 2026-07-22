import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CHAT_MEMBER_SELECT_FIELDS, CHAT_SELECT_FIELDS, MESSAGE_SELECT_FIELDS } from '@org/common';
import type {
  Chat,
  ChatMediaFilter,
  ChatMember,
  ChatRole,
  ChatType,
  Message,
  MessagePage,
} from '@org/common';
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

  async findSelfChat(userId: string): Promise<Chat | null> {
    return this.prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        selfOwnerId: userId,
        members: {
          some: { userId },
          every: { userId },
        },
      },
      select: CHAT_SELECT_FIELDS,
    });
  }

  async createSelfChat(userId: string): Promise<Chat> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const chat = await tx.chat.create({
          data: {
            type: 'DIRECT',
            name: 'Личное',
            selfOwnerId: userId,
            members: {
              create: { userId },
            },
          },
          select: CHAT_SELECT_FIELDS,
        });

        return chat;
      });
    } catch (error) {
      const existing = await this.findChatBySelfOwner(userId);
      if (existing) return existing;
      return handlePrismaError(error);
    }
  }

  private async findChatBySelfOwner(userId: string): Promise<Chat | null> {
    return this.prisma.chat.findUnique({
      where: { selfOwnerId: userId },
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

    return Promise.all(
      chats.map(async ({ messages, ...chat }) => {
        const ownMember = chat.members.find((member) => member.userId === userId);
        const unreadCount = await this.countUnreadMessages(
          chat.id,
          userId,
          ownMember?.lastReadAt ?? null,
          ownMember?.lastReadMessageId ?? null,
        );

        return {
          ...chat,
          lastMessage: messages[0] ?? null,
          unreadCount,
        };
      }),
    );
  }

  async createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
    selfOwnerId?: string | null;
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
    userId: string,
  ): Promise<MessagePage> {
    const messages = await this.prisma.message.findMany({
      where: buildVisibleMessagesWhere(chatId, userId),
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

  async findMediaMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
    filter: ChatMediaFilter,
    userId: string,
  ): Promise<MessagePage> {
    const messages = await this.prisma.message.findMany({
      where: {
        ...buildMediaMessagesWhere(chatId, filter),
        deletedAt: null,
        deletions: { none: { userId } },
      },
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
          clientId: data.clientId ?? null,
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
          forwardedFromSenderId: data.forwardedFromSenderId ?? null,
          forwardedFromCreatedAt: data.forwardedFromCreatedAt ?? null,
          forwardedFromType: data.forwardedFromType ?? null,
          forwardedFromText: data.forwardedFromText ?? null,
          forwardedFromFileName: data.forwardedFromFileName ?? null,
        },
        select: MESSAGE_SELECT_FIELDS,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateMessageText(messageId: string, text: string): Promise<Message> {
    try {
      return await this.prisma.message.update({
        where: { id: messageId },
        data: { text, editedAt: new Date() },
        select: MESSAGE_SELECT_FIELDS,
      });
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async deleteMessageForEveryone(messageId: string, userId: string): Promise<Message> {
    try {
      return await this.prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date(), deletedById: userId },
        select: MESSAGE_SELECT_FIELDS,
      });
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async hideMessageForUser(messageId: string, userId: string): Promise<void> {
    try {
      await this.prisma.messageDeletion.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: { deletedAt: new Date() },
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
          clientId: d.clientId ?? null,
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
          forwardedFromSenderId: d.forwardedFromSenderId ?? null,
          forwardedFromCreatedAt: d.forwardedFromCreatedAt ?? null,
          forwardedFromType: d.forwardedFromType ?? null,
          forwardedFromText: d.forwardedFromText ?? null,
          forwardedFromFileName: d.forwardedFromFileName ?? null,
        })),
      });
      return result.count;
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async countUnreadMessages(
    chatId: string,
    userId: string,
    lastReadAt?: Date | null,
    lastReadMessageId?: string | null,
  ): Promise<number> {
    return this.prisma.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        ...(lastReadAt
          ? {
              OR: [
                { createdAt: { gt: lastReadAt } },
                ...(lastReadMessageId
                  ? [{ createdAt: lastReadAt, id: { gt: lastReadMessageId } }]
                  : []),
              ],
            }
          : {}),
      },
    });
  }

  async markChatRead(
    chatId: string,
    userId: string,
    messageId?: string | null,
  ): Promise<ChatMember> {
    try {
      let nextReadMessageId: string | null = null;
      let nextReadAt = new Date();

      if (messageId) {
        const message = await this.prisma.message.findUnique({
          where: { id: messageId },
          select: { id: true, chatId: true, createdAt: true },
        });

        if (!message) throw new NotFoundException('Message not found');
        if (message.chatId !== chatId) throw new BadRequestException('Message does not belong to chat');

        nextReadMessageId = message.id;
        nextReadAt = message.createdAt;
      } else {
        const latestMessage = await this.prisma.message.findFirst({
          where: { chatId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, createdAt: true },
        });

        if (latestMessage) {
          nextReadMessageId = latestMessage.id;
          nextReadAt = latestMessage.createdAt;
        }
      }

      await this.prisma.chatMember.updateMany({
        where: {
          chatId,
          userId,
          OR: [
            { lastReadAt: null },
            { lastReadAt: { lt: nextReadAt } },
            ...(nextReadMessageId
              ? [
                  {
                    lastReadAt: nextReadAt,
                    OR: [
                      { lastReadMessageId: null },
                      { lastReadMessageId: { lt: nextReadMessageId } },
                    ],
                  },
                ]
              : []),
          ],
        },
        data: { lastReadMessageId: nextReadMessageId, lastReadAt: nextReadAt },
      });

      const member = await this.prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
        select: CHAT_MEMBER_SELECT_FIELDS,
      });

      if (!member) throw new NotFoundException('Chat member not found');
      return member;
    } catch (error) {
      return handlePrismaError(error);
    }
  }
}

function buildVisibleMessagesWhere(chatId: string, userId: string) {
  return {
    chatId,
    deletedAt: null,
    deletions: { none: { userId } },
  };
}

function buildMediaMessagesWhere(chatId: string, filter: ChatMediaFilter) {
  const linkWhere = [
    { text: { contains: 'http://', mode: 'insensitive' as const } },
    { text: { contains: 'https://', mode: 'insensitive' as const } },
    { text: { contains: 'www.', mode: 'insensitive' as const } },
  ];

  if (filter === 'LINK') {
    return {
      chatId,
      OR: linkWhere,
    };
  }

  if (filter === 'IMAGE') {
    return { chatId, fileId: { not: null }, fileCategory: 'IMAGE' };
  }

  if (filter === 'VIDEO') {
    return { chatId, fileId: { not: null }, fileCategory: { in: ['VIDEO', 'CIRCLE'] } };
  }

  if (filter === 'AUDIO') {
    return { chatId, fileId: { not: null }, fileCategory: 'AUDIO' };
  }

  if (filter === 'FILE') {
    return { chatId, fileId: { not: null }, fileCategory: 'FILE' };
  }

  return {
    chatId,
    OR: [
      { fileId: { not: null }, fileCategory: { not: 'VOICE' } },
      ...linkWhere,
    ],
  };
}
