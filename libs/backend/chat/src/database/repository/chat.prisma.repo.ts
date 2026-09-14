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

import type {
  ChatWithPreview,
  CreateMessageWithRelationsData,
  IChatRepository,
  MessageAttachmentAccessInput,
} from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

// Translation boundary: message-scoped ids are BIGINT in Postgres but travel
// the stack as decimal strings. Convert on the way in, stringify on the way out.
// Chat/user ids stay UUID strings end to end. Mappers preserve row shape
// (no keys added) so partial mocks keep passing through untouched.
const toMessageId = (id: string | bigint): bigint => {
  if (typeof id === 'bigint') return id;
  try {
    return BigInt(id);
  } catch {
    throw new BadRequestException('Invalid message id');
  }
};

const fromMessageId = (id: bigint | string | null | undefined): string | null | undefined => {
  if (id === null || id === undefined) return id;
  return String(id);
};

const toFileSize = (size: bigint | number | null | undefined): bigint | null | undefined => {
  if (size === null || size === undefined) return size;
  return typeof size === 'bigint' ? size : BigInt(size);
};

const fromFileSize = (size: bigint | number | null | undefined): number | null | undefined => {
  if (size === null || size === undefined) return size;
  return Number(size);
};

type MessageRow = Omit<Message, 'id' | 'attachments' | 'forwardContext'> & {
  id: bigint | string;
  attachments: Array<
    Omit<Message['attachments'][number], 'messageId' | 'fileSizeSnapshot'> & {
      messageId: bigint | string;
      fileSizeSnapshot: bigint | number | null;
    }
  >;
  forwardContext: null | (Omit<
    NonNullable<Message['forwardContext']>,
    'messageId' | 'originalMessageId'
  > & {
    messageId: bigint | string;
    originalMessageId: bigint | string | null;
  });
};

const toMessage = (row: MessageRow): Message => {
  const mapped: Record<string, unknown> = { ...row };
  if ('id' in mapped) mapped['id'] = fromMessageId(mapped['id'] as bigint | string);
  if (Array.isArray(mapped['attachments'])) {
    mapped['attachments'] = (mapped['attachments'] as MessageRow['attachments']).map(
      (attachment) => {
        const result: Record<string, unknown> = { ...attachment };
        if ('messageId' in result) result['messageId'] = fromMessageId(result['messageId'] as bigint | string);
        if ('fileSizeSnapshot' in result) {
          result['fileSizeSnapshot'] = fromFileSize(
            result['fileSizeSnapshot'] as bigint | number | null,
          );
        }
        return result;
      },
    );
  }
  const forwardContext = mapped['forwardContext'] as MessageRow['forwardContext'];
  if (forwardContext) {
    const result: Record<string, unknown> = { ...forwardContext };
    if ('messageId' in result) result['messageId'] = fromMessageId(result['messageId'] as bigint | string);
    if ('originalMessageId' in result && result['originalMessageId'] !== null) {
      result['originalMessageId'] = fromMessageId(result['originalMessageId'] as bigint | string);
    }
    mapped['forwardContext'] = result;
  }
  return mapped as unknown as Message;
};

const toChat = <T extends { lastMessageId?: bigint | string | null }>(row: T): T => {
  if (!('lastMessageId' in row)) return row;
  return { ...row, lastMessageId: fromMessageId(row.lastMessageId) };
};

const toChatMember = <T extends { lastReadMessageId?: bigint | string | null }>(
  row: T,
): T => {
  if (!('lastReadMessageId' in row)) return row;
  return { ...row, lastReadMessageId: fromMessageId(row.lastReadMessageId) };
};

@Injectable()
export class ChatPrismaRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatById(id: string): Promise<Chat | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      select: CHAT_SELECT_FIELDS,
    });
    return chat ? toChat(chat) : null;
  }

  async findDirectChatBetween(userId1: string, userId2: string): Promise<Chat | null> {
    const chat = await this.prisma.chat.findFirst({
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
    return chat ? toChat(chat) : null;
  }

  async findDirectChatByKey(directKey: string): Promise<Chat | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { directKey },
      select: CHAT_SELECT_FIELDS,
    });
    return chat ? toChat(chat) : null;
  }

  async findSelfChat(userId: string): Promise<Chat | null> {
    const chat = await this.prisma.chat.findFirst({
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
    return chat ? toChat(chat) : null;
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

        return toChat(chat);
      });
    } catch (error) {
      const existing = await this.findChatBySelfOwner(userId);
      if (existing) return existing;
      return handlePrismaError(error);
    }
  }

  private async findChatBySelfOwner(userId: string): Promise<Chat | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { selfOwnerId: userId },
      select: CHAT_SELECT_FIELDS,
    });
    return chat ? toChat(chat) : null;
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
          ...toChat(chat),
          members: chat.members.map((member) => toChatMember(member)),
          lastMessage: messages[0] ? toMessage(messages[0] as MessageRow) : null,
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
    directKey?: string | null;
  }): Promise<Chat> {
    const chat = await this.prisma.chat.create({ data, select: CHAT_SELECT_FIELDS });
    return toChat(chat);
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: toMessageId(cursor) }, skip: 1 } : {}),
      take,
      select: MESSAGE_SELECT_FIELDS,
    });

    return {
      messages: messages.reverse().map((message) => toMessage(message as MessageRow)),
      nextCursor: messages.length === take ? fromMessageId(messages[0].id) : null,
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
      ...(cursor ? { cursor: { id: toMessageId(cursor) }, skip: 1 } : {}),
      take,
      select: MESSAGE_SELECT_FIELDS,
    });

    return {
      messages: messages.reverse().map((message) => toMessage(message as MessageRow)),
      nextCursor: messages.length === take ? fromMessageId(messages[0].id) : null,
    };
  }

  async findMessagesDelta(
    chatId: string,
    userId: string,
    since: Date,
    sinceId: string | null,
    take: number,
  ): Promise<{ messages: Message[]; deletedIds: string[] }> {
    const changed = await this.prisma.message.findMany({
      where: {
        ...buildVisibleMessagesWhere(chatId, userId),
        OR: [
          { updatedAt: { gt: since } },
          ...(sinceId ? [{ updatedAt: since, id: { gt: toMessageId(sinceId) } }] : []),
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
      select: MESSAGE_SELECT_FIELDS,
    });

    const deletions = await this.prisma.messageDeletion.findMany({
      where: { userId, deletedAt: { gt: since } },
      select: { messageId: true },
    });

    return {
      messages: changed.map((message) => toMessage(message as MessageRow)),
      deletedIds: deletions.map((deletion) => fromMessageId(deletion.messageId)),
    };
  }

  async findMessageById(id: string): Promise<Message | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: toMessageId(id) },
      select: MESSAGE_SELECT_FIELDS,
    });
    return message ? toMessage(message as MessageRow) : null;
  }

  async findMessageByClientId(chatId: string, clientId: string): Promise<Message | null> {
    const message = await this.prisma.message.findFirst({
      where: { chatId, clientId },
      select: MESSAGE_SELECT_FIELDS,
    });
    return message ? toMessage(message as MessageRow) : null;
  }

  async findVisibleMessagesByIds(
    chatId: string,
    messageIds: string[],
    userId: string,
  ): Promise<Message[]> {
    if (messageIds.length === 0) return [];

    const messages = await this.prisma.message.findMany({
      where: {
        ...buildVisibleMessagesWhere(chatId, userId),
        id: { in: messageIds.map(toMessageId) },
      },
      select: MESSAGE_SELECT_FIELDS,
    });
    return messages.map((message) => toMessage(message as MessageRow));
  }

  async findMessageAttachmentForAccess(
    input: MessageAttachmentAccessInput,
  ): Promise<{ mediaId: string } | null> {
    return this.prisma.messageAttachment.findFirst({
      where: {
        id: input.attachmentId,
        messageId: toMessageId(input.messageId),
        message: {
          is: {
            chatId: input.chatId,
            chat: {
              is: {
                members: { some: { userId: input.userId } },
              },
            },
          },
        },
      },
      select: { mediaId: true },
    });
  }

  async createMessageWithRelations(data: CreateMessageWithRelationsData): Promise<Message> {
    try {
      const created = await this.prisma.message.create({
        data: {
          chatId: data.chatId,
          clientId: data.clientId ?? null,
          senderId: data.senderId,
          type: data.type ?? 'TEXT',
          text: data.text ?? null,
          hasLink: data.hasLink ?? false,
          attachments: data.attachments
            ? {
                create: data.attachments.map((attachment) => ({
                  mediaId: attachment.mediaId,
                  fileNameSnapshot: attachment.fileNameSnapshot ?? null,
                  fileSizeSnapshot: toFileSize(attachment.fileSizeSnapshot ?? null),
                  mimeSnapshot: attachment.mimeSnapshot ?? null,
                  category: attachment.category,
                })),
              }
            : undefined,
          forwardContext: data.forwardContext
            ? {
                create: {
                  originalMessageId: data.forwardContext.originalMessageId
                    ? toMessageId(data.forwardContext.originalMessageId)
                    : null,
                  originalChatId: data.forwardContext.originalChatId ?? null,
                  originalAuthorId: data.forwardContext.originalAuthorId,
                  originalAuthorNameSnapshot: data.forwardContext.originalAuthorNameSnapshot,
                  originalAuthorDisplayNameSnapshot:
                    data.forwardContext.originalAuthorDisplayNameSnapshot ?? null,
                  originalMessageCreatedAt: data.forwardContext.originalMessageCreatedAt,
                  originalMessageType: data.forwardContext.originalMessageType,
                  originalTextPreview: data.forwardContext.originalTextPreview ?? null,
                  originalFileNamePreview: data.forwardContext.originalFileNamePreview ?? null,
                },
              }
            : undefined,
        },
        select: MESSAGE_SELECT_FIELDS,
      });
      return toMessage(created as MessageRow);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async createMessageWithTouch(data: CreateMessageWithRelationsData): Promise<Message> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          chatId: data.chatId,
          clientId: data.clientId ?? null,
          senderId: data.senderId,
          type: data.type ?? 'TEXT',
          text: data.text ?? null,
          hasLink: data.hasLink ?? false,
          attachments: data.attachments?.length
            ? {
                create: data.attachments.map((attachment) => ({
                  mediaId: attachment.mediaId,
                  fileNameSnapshot: attachment.fileNameSnapshot ?? null,
                  fileSizeSnapshot: toFileSize(attachment.fileSizeSnapshot ?? null),
                  mimeSnapshot: attachment.mimeSnapshot ?? null,
                  category: attachment.category,
                })),
              }
            : undefined,
          forwardContext: data.forwardContext
            ? {
                create: {
                  originalMessageId: data.forwardContext.originalMessageId
                    ? toMessageId(data.forwardContext.originalMessageId)
                    : null,
                  originalChatId: data.forwardContext.originalChatId ?? null,
                  originalAuthorId: data.forwardContext.originalAuthorId,
                  originalAuthorNameSnapshot: data.forwardContext.originalAuthorNameSnapshot,
                  originalAuthorDisplayNameSnapshot:
                    data.forwardContext.originalAuthorDisplayNameSnapshot ?? null,
                  originalMessageCreatedAt: data.forwardContext.originalMessageCreatedAt,
                  originalMessageType: data.forwardContext.originalMessageType,
                  originalTextPreview: data.forwardContext.originalTextPreview ?? null,
                  originalFileNamePreview: data.forwardContext.originalFileNamePreview ?? null,
                },
              }
            : undefined,
        },
        select: MESSAGE_SELECT_FIELDS,
      });
      const message = toMessage(created as MessageRow);
      await tx.chat.update({
        where: { id: data.chatId },
        data: {
          lastMessageId: toMessageId(message.id),
          lastMessageAt: message.createdAt,
          updatedAt: message.createdAt,
        },
      });
      await tx.chatMember.updateMany({
        where: { chatId: data.chatId, userId: data.senderId },
        data: { lastReadMessageId: toMessageId(message.id), lastReadAt: message.createdAt },
      });
      return message;
    });
  }

  async touchChatLastMessage(chatId: string, messageId: string, at: Date): Promise<void> {
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageId: toMessageId(messageId), lastMessageAt: at, updatedAt: at },
    });
  }

  async deleteCreatedMessage(messageId: string): Promise<void> {
    try {
      await this.prisma.message.delete({ where: { id: toMessageId(messageId) } });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateMessageText(messageId: string, text: string, hasLink: boolean): Promise<Message> {
    try {
      const updated = await this.prisma.message.update({
        where: { id: toMessageId(messageId) },
        data: { text, hasLink, editedAt: new Date() },
        select: MESSAGE_SELECT_FIELDS,
      });
      return toMessage(updated as MessageRow);
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async deleteMessageForEveryone(messageId: string, userId: string): Promise<Message> {
    try {
      const deleted = await this.prisma.message.update({
        where: { id: toMessageId(messageId) },
        data: { deletedAt: new Date(), deletedById: userId },
        select: MESSAGE_SELECT_FIELDS,
      });
      return toMessage(deleted as MessageRow);
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async hideMessageForUser(messageId: string, userId: string): Promise<void> {
    try {
      await this.prisma.messageDeletion.upsert({
        where: { messageId_userId: { messageId: toMessageId(messageId), userId } },
        create: { messageId: toMessageId(messageId), userId },
        update: { deletedAt: new Date() },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async countUnreadMessages(
    chatId: string,
    userId: string,
    lastReadAt?: Date | null,
    lastReadMessageId?: string | bigint | null,
  ): Promise<number> {
    return this.prisma.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        deletedAt: null,
        deletions: { none: { userId } },
        ...(lastReadAt
          ? {
              OR: [
                { createdAt: { gt: lastReadAt } },
                ...(lastReadMessageId === null || lastReadMessageId === undefined
                  ? []
                  : [{ createdAt: lastReadAt, id: { gt: toMessageId(lastReadMessageId) } }]),
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
      let nextReadMessageId: bigint | null = null;
      let nextReadAt = new Date();

      if (messageId) {
        const message = await this.prisma.message.findUnique({
          where: { id: toMessageId(messageId) },
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
      return toChatMember(member);
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
    return { chatId, attachments: { some: { category: 'IMAGE' } } };
  }

  if (filter === 'VIDEO') {
    return { chatId, attachments: { some: { category: { in: ['VIDEO', 'CIRCLE'] } } } };
  }

  if (filter === 'AUDIO') {
    return { chatId, attachments: { some: { category: 'AUDIO' } } };
  }

  if (filter === 'FILE') {
    return { chatId, attachments: { some: { category: 'FILE' } } };
  }

  return {
    chatId,
    OR: [
      { attachments: { some: { category: { not: 'VOICE' } } } },
      ...linkWhere,
    ],
  };
}
