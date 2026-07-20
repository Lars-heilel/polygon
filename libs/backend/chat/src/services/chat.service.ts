import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Chat, ChatMediaFilter, ChatMember, Message, MessagePage } from '@org/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type {
  ChatWithPreview,
  ForwardMessagesData,
  IChatRepository,
  IChatService,
} from '../interfaces/chat.interface';

@Injectable()
export class ChatService implements IChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(@Inject(CHAT_PRISMA_REPOSITORY_TOKEN) private readonly repo: IChatRepository) {}

  async createDirectChat(userId: string, targetUserId: string): Promise<Chat> {
    const isSelfChat = targetUserId === userId;
    const existing = isSelfChat
      ? await this.repo.findSelfChat(userId)
      : await this.repo.findDirectChatBetween(userId, targetUserId);
    if (existing) return existing;

    if (isSelfChat) {
      return this.repo.createSelfChat(userId);
    }

    const chat = await this.repo.createChat({
      type: 'DIRECT',
      name: null,
    });
    await this.repo.addChatMember({ chatId: chat.id, userId });
    await this.repo.addChatMember({ chatId: chat.id, userId: targetUserId });

    return this.repo.findChatById(chat.id).then((c) => {
      if (!c) throw new NotFoundException('Chat not found after creation');
      return c;
    });
  }

  async getChats(userId: string): Promise<ChatWithPreview[]> {
    this.logger.log({ eventType: 'chat_list_requested', hasUserId: !!userId });
    return this.repo.findChatsForUser(userId);
  }

  async createSelfChat(userId: string): Promise<Chat> {
    this.logger.log({ eventType: 'self_chat_create_requested', hasUserId: !!userId });
    return this.createDirectChat(userId, userId);
  }

  async getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take = 50,
  ): Promise<MessagePage> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMessagesByChat(chatId, cursor, take);
  }

  async getMediaMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take = 50,
    filter: ChatMediaFilter,
  ): Promise<MessagePage> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMediaMessagesByChat(chatId, cursor, take, filter);
  }

  async sendMessage(
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
  ): Promise<Message> {
    this.logger.debug({
      eventType: 'message_send_requested',
      hasChatId: !!chatId,
      hasSenderId: !!senderId,
      type: input.type,
      hasText: !!input.text,
      hasFile: !!input.fileId,
    });
    const member = await this.repo.findChatMember(chatId, senderId);
    if (!member) {
      this.logger.warn({
        eventType: 'chat_membership_denied',
        hasChatId: !!chatId,
        hasUserId: !!senderId,
      });
      throw new ForbiddenException('Not a member of this chat');
    }

    return this.repo.createMessage({
      chatId,
      senderId,
      type: input.type as Message['type'],
      text: input.text ?? null,
      fileId: input.fileId ?? null,
      fileBucket: input.fileBucket ?? null,
      fileKey: input.fileKey ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      fileMime: input.fileMime ?? null,
      fileCategory: input.fileCategory ?? null,
    });
  }

  async forwardMessages(data: ForwardMessagesData): Promise<Message[]> {
    const { sourceChatId, targetChatId, messageIds, userId } = data;

    const isSourceMember = await this.repo.findChatMember(sourceChatId, userId);
    if (!isSourceMember) throw new ForbiddenException('Not a member of the source chat');

    const isTargetMember = await this.repo.findChatMember(targetChatId, userId);
    if (!isTargetMember) throw new ForbiddenException('Not a member of the target chat');

    const messages: Message[] = [];
    for (const msgId of messageIds) {
      const original = await this.repo.findMessageById(msgId);
      if (!original || original.chatId !== sourceChatId) continue;

      const copied = await this.repo.createMessage({
        chatId: targetChatId,
        senderId: userId,
        type: original.type,
        text: original.text,
        fileId: original.fileId,
        fileBucket: original.fileBucket,
        fileKey: original.fileKey,
        fileName: original.fileName,
        fileSize: original.fileSize,
        fileMime: original.fileMime,
        fileCategory: original.fileCategory ?? null,
        forwardedFromId: original.id,
      });
      messages.push(copied);
    }

    return messages;
  }

  async markRead(
    chatId: string,
    userId: string,
    messageId?: string | null,
  ): Promise<ChatMember> {
    this.logger.debug({
      eventType: 'chat_read_mark_requested',
      hasChatId: !!chatId,
      hasUserId: !!userId,
      hasMessageId: !!messageId,
    });
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) {
      this.logger.warn({
        eventType: 'chat_membership_denied',
        hasChatId: !!chatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of this chat');
    }
    const chatMember = await this.repo.markChatRead(chatId, userId, messageId ?? null);
    this.logger.log({
      eventType: 'chat_read_marked',
      hasChatId: !!chatId,
      hasUserId: !!userId,
      hasMessageId: !!messageId,
    });
    return chatMember;
  }

  async checkMembership(chatId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findChatMember(chatId, userId);
    return member !== null;
  }

  async getMembers(chatId: string): Promise<{ userId: string }[]> {
    const members = await this.repo.findMembersByChat(chatId);
    return members.map((m) => ({ userId: m.userId }));
  }
}
