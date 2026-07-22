import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Chat, ChatMediaFilter, ChatMember, Message, MessagePage } from '@org/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type {
  ChatWithPreview,
  ForwardMessagesData,
  IChatRepository,
  IChatService,
  MessageAttachmentAccessInput,
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
    return this.repo.findMessagesByChat(chatId, cursor, take, userId);
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
    return this.repo.findMediaMessagesByChat(chatId, cursor, take, filter, userId);
  }

  async getMessageAttachmentForAccess(
    input: MessageAttachmentAccessInput,
  ): Promise<{ mediaId: string }> {
    const logContext = {
      hasChatId: !!input.chatId,
      hasMessageId: !!input.messageId,
      hasAttachmentId: !!input.attachmentId,
      hasUserId: !!input.userId,
    };
    this.logger.debug({ eventType: 'message_attachment_access_requested', ...logContext });

    let member;
    try {
      member = await this.repo.findChatMember(input.chatId, input.userId);
    } catch (error) {
      this.logger.error({ eventType: 'message_attachment_access_failed', ...logContext, reason: 'membership_lookup_failed' });
      throw error;
    }

    if (!member) {
      this.logger.warn({ eventType: 'message_attachment_access_denied', ...logContext, reason: 'not_chat_member' });
      throw new ForbiddenException('Not a member of this chat');
    }

    this.logger.debug({ eventType: 'message_attachment_access_started', ...logContext });
    try {
      const attachment = await this.repo.findMessageAttachmentForAccess(input);
      if (!attachment) {
        this.logger.warn({
          eventType: 'message_attachment_access_denied',
          ...logContext,
          reason: 'attachment_not_in_message_chat',
        });
        throw new NotFoundException('Attachment not found');
      }

      this.logger.log({
        eventType: 'message_attachment_access_success',
        ...logContext,
        hasMediaId: !!attachment.mediaId,
      });
      return attachment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error({ eventType: 'message_attachment_access_failed', ...logContext, reason: 'attachment_lookup_failed' });
      throw error;
    }
  }

  async sendMessage(
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
  ): Promise<Message> {
    this.logger.debug({
      eventType: 'message_send_requested',
      hasChatId: !!chatId,
      hasSenderId: !!senderId,
      hasClientId: !!input.clientId,
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
      clientId: input.clientId ?? null,
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

  async editMessage(
    chatId: string,
    messageId: string,
    userId: string,
    text: string,
  ): Promise<Message> {
    this.logger.log({
      eventType: 'message_edit_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    await this.requireMember(chatId, userId);
    const message = await this.requireMessageInChat(chatId, messageId);

    if (message.senderId !== userId || message.type !== 'TEXT' || message.fileId || message.deletedAt) {
      this.logger.warn({
        eventType: 'message_edit_rejected',
        hasChatId: !!chatId,
        hasMessageId: !!messageId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Message cannot be edited');
    }

    const updated = await this.repo.updateMessageText(messageId, text);
    this.logger.log({
      eventType: 'message_edited',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    return updated;
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    userId: string,
    mode: 'ME' | 'EVERYONE',
  ): Promise<Message | { id: string; chatId: string }> {
    this.logger.log({
      eventType: 'message_delete_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
      mode,
    });
    await this.requireMember(chatId, userId);
    const message = await this.requireMessageInChat(chatId, messageId);

    if (mode === 'EVERYONE') {
      if (message.senderId !== userId) {
        this.logger.warn({
          eventType: 'message_delete_rejected',
          hasChatId: !!chatId,
          hasMessageId: !!messageId,
          hasUserId: !!userId,
          mode,
        });
        throw new ForbiddenException('Only the sender can delete this message for everyone');
      }

      const deleted = await this.repo.deleteMessageForEveryone(messageId, userId);
      this.logger.log({
        eventType: 'message_deleted_for_everyone',
        hasChatId: !!chatId,
        hasMessageId: !!messageId,
        hasUserId: !!userId,
      });
      return deleted;
    }

    await this.repo.hideMessageForUser(messageId, userId);
    this.logger.log({
      eventType: 'message_deleted_for_user',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    return { id: messageId, chatId };
  }

  async forwardMessages(data: ForwardMessagesData): Promise<Message[]> {
    const { sourceChatId, targetChatId, messageIds, userId } = data;
    this.logger.log({
      eventType: 'message_forward_requested',
      hasSourceChatId: !!sourceChatId,
      hasTargetChatId: !!targetChatId,
      hasUserId: !!userId,
      messageCount: messageIds.length,
    });

    const isSourceMember = await this.repo.findChatMember(sourceChatId, userId);
    if (!isSourceMember) {
      this.logger.warn({
        eventType: 'message_forward_source_membership_denied',
        hasSourceChatId: !!sourceChatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of the source chat');
    }

    const isTargetMember = await this.repo.findChatMember(targetChatId, userId);
    if (!isTargetMember) {
      this.logger.warn({
        eventType: 'message_forward_target_membership_denied',
        hasTargetChatId: !!targetChatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of the target chat');
    }

    const messages: Message[] = [];
    let missingCount = 0;
    let wrongChatCount = 0;
    for (const msgId of messageIds) {
      const original = await this.repo.findMessageById(msgId);
      if (!original) {
        missingCount += 1;
        continue;
      }
      if (original.chatId !== sourceChatId) {
        wrongChatCount += 1;
        continue;
      }

      const copied = await this.repo.createMessage({
        chatId: targetChatId,
        clientId: null,
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
        forwardedFromId: original.forwardedFromId ?? original.id,
        forwardedFromSenderId: original.forwardedFromSenderId ?? original.senderId,
        forwardedFromCreatedAt: original.forwardedFromCreatedAt ?? original.createdAt,
        forwardedFromType: original.forwardedFromType ?? original.type,
        forwardedFromText: original.forwardedFromText ?? original.text,
        forwardedFromFileName: original.forwardedFromFileName ?? original.fileName,
      });
      messages.push(copied);
    }

    if (missingCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_source_missing',
        hasSourceChatId: !!sourceChatId,
        missingCount,
      });
    }
    if (wrongChatCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_source_chat_mismatch',
        hasSourceChatId: !!sourceChatId,
        mismatchCount: wrongChatCount,
      });
    }
    this.logger.log({
      eventType: 'messages_forwarded',
      requestedCount: messageIds.length,
      createdCount: messages.length,
      missingCount,
      wrongChatCount,
    });

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

  private async requireMember(chatId: string, userId: string): Promise<void> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
  }

  private async requireMessageInChat(chatId: string, messageId: string): Promise<Message> {
    const message = await this.repo.findMessageById(messageId);
    if (!message || message.chatId !== chatId) throw new NotFoundException('Message not found');
    return message;
  }
}
